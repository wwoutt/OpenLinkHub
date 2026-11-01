package xeneonlayout

// Package: XENEON EDGE free layout
// Author: wwoutt (2026-11-01), part of a fork of OpenLinkHub by Nikola Jurkovic
// License: GPL-3.0 or later
//
// Stores a free grid layout for the widgets on the XENEON EDGE kiosk page
// (/xeneon). The widgets themselves stay upstream; this package only keeps
// their position, size and visibility.

import (
	"OpenLinkHub/src/common"
	"OpenLinkHub/src/config"
	"OpenLinkHub/src/dashboard"
	"OpenLinkHub/src/devices"
	"OpenLinkHub/src/devices/xeneonedge"
	"OpenLinkHub/src/logger"
	"OpenLinkHub/src/templates"
	"OpenLinkHub/src/version"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"sync"
)

const (
	maxGridSize = 48
	maxItems    = 64
)

// Item is the position of one widget in the grid: an upstream widget (WidgetId)
// or a custom widget served by the widget helper (Custom)
type Item struct {
	WidgetId int    `json:"widgetId"`
	Custom   string `json:"custom,omitempty"`
	X        int    `json:"x"`
	Y        int    `json:"y"`
	W        int    `json:"w"`
	H        int    `json:"h"`
	Hidden   bool   `json:"hidden"`
}

// Layout is the saved grid layout
type Layout struct {
	Columns int    `json:"columns"`
	Rows    int    `json:"rows"`
	Items   []Item `json:"items"`
}

// Area is a widget area of the XENEON EDGE device profile
type Area struct {
	AreaId   int    `json:"areaId"`
	WidgetId int    `json:"widgetId"`
	Name     string `json:"name"`
	Template string `json:"template"`
}

// Widget is an available widget definition
type Widget struct {
	Id       int    `json:"id"`
	Name     string `json:"name"`
	Template string `json:"template"`
	Columns  []int  `json:"columns"`
}

type response struct {
	Status  int         `json:"status"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
}

var (
	mutex sync.Mutex
	// Same rule as the widget helper uses for widget folder names
	customId = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{0,63}$`)
)

// RegisterRoutes registers the layout API, and the editor page when the web UI is enabled
func RegisterRoutes(mux *http.ServeMux) {
	if config.GetConfig().Frontend {
		mux.HandleFunc("/xeneonLayout", func(w http.ResponseWriter, r *http.Request) {
			if r.Method != http.MethodGet {
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
				return
			}
			editorPage(w)
		})
	}

	mux.HandleFunc("/api/xeneonLayout", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			getLayout(w)
		case http.MethodPost:
			saveLayout(w, r)
		case http.MethodDelete:
			resetLayout(w)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})
}

// editorPage serves the layout editor with the regular OpenLinkHub head and sidebar
func editorPage(w http.ResponseWriter) {
	web := templates.Web{}
	web.Title = dashboard.GetDashboard().PageTitle
	web.Devices = devices.GetDevices()
	web.BuildInfo = version.GetBuildInfo()
	web.Dashboard = dashboard.GetDashboard()
	web.Page = "xeneonLayout"

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Expires", "0")
	if err := templates.GetTemplate().ExecuteTemplate(w, "xeneon-layout-editor.html", web); err != nil {
		logger.Log(logger.Fields{"error": err}).Error("Unable to render XENEON EDGE layout editor")
		http.Error(w, "Unable to serve web content", http.StatusInternalServerError)
	}
}

// layoutPath returns the location of the layout file
func layoutPath() string {
	return filepath.Join(config.GetConfig().ConfigPath, "database", "xeneon-layout", "layout.json")
}

// getXeneon returns the XENEON EDGE device, or nil when it is not available
func getXeneon() (*common.Device, *xeneonedge.Device) {
	for _, device := range devices.GetDevices() {
		if device.ProductType != common.ProductTypeXeneonEdge {
			continue
		}
		if d, ok := device.Instance.(*xeneonedge.Device); ok {
			return device, d
		}
	}
	return nil, nil
}

// loadLayout returns the saved layout, or nil when none is saved
func loadLayout() (*Layout, error) {
	data, err := os.ReadFile(layoutPath())
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	layout := &Layout{}
	if err = json.Unmarshal(data, layout); err != nil {
		return nil, err
	}
	return layout, nil
}

// validate checks that a layout fits the grid
func (l *Layout) validate() bool {
	if l.Columns < 1 || l.Columns > maxGridSize || l.Rows < 1 || l.Rows > maxGridSize || len(l.Items) > maxItems {
		return false
	}

	seen := make(map[string]bool, len(l.Items))
	for _, item := range l.Items {
		key := item.Custom
		if key == "" {
			if item.WidgetId < 1 {
				return false
			}
			key = strconv.Itoa(item.WidgetId)
		} else if item.WidgetId != 0 || !customId.MatchString(item.Custom) {
			return false
		}
		if seen[key] {
			return false
		}
		seen[key] = true

		if item.X < 0 || item.Y < 0 || item.W < 1 || item.H < 1 || item.X+item.W > l.Columns || item.Y+item.H > l.Rows {
			return false
		}
	}
	return true
}

func send(w http.ResponseWriter, code int, value response) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.WriteHeader(code)
	if err := json.NewEncoder(w).Encode(value); err != nil {
		logger.Log(logger.Fields{"error": err}).Error("Unable to encode XENEON EDGE layout response")
	}
}

// getLayout returns the saved layout with the current widget areas and available widgets
func getLayout(w http.ResponseWriter) {
	device, xeneon := getXeneon()
	if xeneon == nil || xeneon.DeviceProfile == nil {
		send(w, http.StatusNotFound, response{Message: "XENEON EDGE is not available"})
		return
	}

	mutex.Lock()
	layout, err := loadLayout()
	mutex.Unlock()
	if err != nil {
		logger.Log(logger.Fields{"error": err, "location": layoutPath()}).Warn("Unable to load XENEON EDGE layout")
	}

	areas := make([]Area, 0, len(xeneon.DeviceProfile.WidgetAreas))
	for areaId, area := range xeneon.DeviceProfile.WidgetAreas {
		if area.Widget == nil {
			continue
		}
		areas = append(areas, Area{
			AreaId:   areaId,
			WidgetId: area.WidgetId,
			Name:     area.Widget.Name,
			Template: area.Widget.Template,
		})
	}

	// Widgets are rendered in area order, the page maps DOM elements by this order
	sort.Slice(areas, func(i, j int) bool { return areas[i].AreaId < areas[j].AreaId })

	widgets := make([]Widget, 0, len(xeneon.Widgets))
	for _, widget := range xeneon.Widgets {
		widgets = append(widgets, Widget{Id: widget.Id, Name: widget.Name, Template: widget.Template, Columns: widget.Columns})
	}

	send(w, http.StatusOK, response{Status: 1, Data: map[string]interface{}{
		"serial":   device.Serial,
		"layout":   layout,
		"areas":    areas,
		"widgets":  widgets,
		"revision": revision(xeneon.DeviceProfile.Path),
	}})
}

// revision changes whenever the layout or the widget settings (device profile)
// change, so the kiosk can reload after an edit made in another browser
func revision(profilePath string) string {
	value := ""
	for _, path := range []string{layoutPath(), profilePath} {
		if info, err := os.Stat(path); err == nil {
			value += strconv.FormatInt(info.ModTime().UnixNano(), 36) + "."
		} else {
			value += "-."
		}
	}
	return value
}

// saveLayout stores a new layout
func saveLayout(w http.ResponseWriter, r *http.Request) {
	layout := &Layout{}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64*1024)).Decode(layout); err != nil || !layout.validate() {
		send(w, http.StatusBadRequest, response{Message: "Invalid layout"})
		return
	}

	mutex.Lock()
	defer mutex.Unlock()

	location := layoutPath()
	if err := os.MkdirAll(filepath.Dir(location), 0755); err != nil {
		logger.Log(logger.Fields{"error": err, "location": location}).Error("Unable to create XENEON EDGE layout folder")
		send(w, http.StatusInternalServerError, response{Message: "Unable to save layout"})
		return
	}
	if err := common.SaveJsonData(location, layout); err != nil {
		logger.Log(logger.Fields{"error": err, "location": location}).Error("Unable to save XENEON EDGE layout")
		send(w, http.StatusInternalServerError, response{Message: "Unable to save layout"})
		return
	}
	send(w, http.StatusOK, response{Status: 1, Message: "Layout saved"})
}

// resetLayout removes the saved layout, so the page falls back to the upstream layout
func resetLayout(w http.ResponseWriter) {
	mutex.Lock()
	defer mutex.Unlock()

	if err := os.Remove(layoutPath()); err != nil && !errors.Is(err, os.ErrNotExist) {
		logger.Log(logger.Fields{"error": err, "location": layoutPath()}).Error("Unable to remove XENEON EDGE layout")
		send(w, http.StatusInternalServerError, response{Message: "Unable to reset layout"})
		return
	}
	send(w, http.StatusOK, response{Status: 1, Message: "Layout reset"})
}
