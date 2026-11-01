// XENEON EDGE free layout
// Author: wwoutt (2026-11-01), part of a fork of OpenLinkHub by Nikola Jurkovic
// License: GPL-3.0 or later
//
// Turns the fixed XENEON EDGE kiosk layout into a free grid. Widgets keep being
// rendered by upstream; this script moves them into a GridStack grid, and adds an
// edit mode to drag, resize, hide and configure them. Without a saved layout the
// grid starts from the current upstream positions.
(function () {
    'use strict';

    const COLUMNS = 24;
    const ROWS = 12;
    const MARGIN = 6;
    const API = '/api/xeneonLayout';

    const texts = {
        en: {
            edit: 'Edit layout', save: 'Save', cancel: 'Cancel', reset: 'Reset to default', add: 'Add widget',
            hide: 'Hide', settings: 'Settings', noWidgets: 'No widgets available', resetConfirm: 'Reset the layout to the default?',
            saved: 'Layout saved', saveFailed: 'Unable to save layout', widgetSaveFailed: 'Unable to save widget settings',
            noArea: 'No free area for this widget', advanced: 'Advanced settings', headerText: 'Title', textColor: 'Text color',
            subTextColor: 'Secondary text color', dataColor: 'Accent color', fontSize: 'Font size', subFontSize: 'Secondary font size',
            max: 'Maximum value', hideArtwork: 'Hide artwork', hideControls: 'Hide controls', hideForecast: 'Hide forecast',
            showSwap: 'Show swap', weekStart: 'Week starts on', monday: 'Monday', sunday: 'Sunday', hidden: 'hidden'
        },
        nl: {
            edit: 'Indeling bewerken', save: 'Opslaan', cancel: 'Annuleren', reset: 'Standaard herstellen', add: 'Widget toevoegen',
            hide: 'Verbergen', settings: 'Instellingen', noWidgets: 'Geen widgets beschikbaar', resetConfirm: 'Indeling terugzetten naar de standaard?',
            saved: 'Indeling opgeslagen', saveFailed: 'Indeling opslaan mislukt', widgetSaveFailed: 'Widget-instellingen opslaan mislukt',
            noArea: 'Geen vrij vak voor deze widget', advanced: 'Geavanceerde instellingen', headerText: 'Titel', textColor: 'Tekstkleur',
            subTextColor: 'Tweede tekstkleur', dataColor: 'Accentkleur', fontSize: 'Lettergrootte', subFontSize: 'Tweede lettergrootte',
            max: 'Maximale waarde', hideArtwork: 'Albumhoes verbergen', hideControls: 'Knoppen verbergen', hideForecast: 'Voorspelling verbergen',
            showSwap: 'Swap tonen', weekStart: 'Week begint op', monday: 'Maandag', sunday: 'Zondag', hidden: 'verborgen'
        }
    };
    const t = texts[(navigator.language || 'en').toLowerCase().startsWith('nl') ? 'nl' : 'en'];

    // Widget settings that can be changed from the edit mode, per template.
    // Everything else (data sources, devices, location) stays on the device page.
    const commonFields = ['textColor', 'subTextColor', 'fontSize', 'subFontSize'];
    const templateFields = {
        'xeneon-battery-status': ['dataColor'],
        'xeneon-calendar': ['dataColor', 'weekStart'],
        'xeneon-media-player': ['dataColor', 'hideArtwork', 'hideControls'],
        'xeneon-weather': ['hideForecast'],
        'xeneon-memory': ['headerText', 'dataColor', 'showSwap'],
        'xeneon-storage': ['headerText', 'dataColor'],
        'xeneon-cpu-temp': ['headerText', 'dataColor', 'max'],
        'xeneon-cpu-load': ['headerText', 'dataColor', 'max'],
        'xeneon-gpu-temp': ['headerText', 'dataColor', 'max'],
        'xeneon-gpu-load': ['headerText', 'dataColor', 'max'],
        'xeneon-device-temp': ['headerText', 'dataColor', 'max'],
        'xeneon-device-rpm': ['headerText', 'dataColor', 'max'],
        'xeneon-temperature-history': ['headerText', 'dataColor'],
        'xeneon-cooling-overview': ['headerText', 'dataColor'],
        'xeneon-profile-shortcuts': ['headerText', 'dataColor']
    };
    // Upstream defaults (device page) for widgets that have no value saved yet
    const ring = {fontSize: 80, subFontSize: 15, textColor: '#a1a1a1', subTextColor: '#a1a1a1'};
    const panel = {textColor: '#e6e6e6', subTextColor: '#a1a1a1', dataColor: '#38bdf8'};
    const templateDefaults = {
        'xeneon-clock': {fontSize: 80, subFontSize: 50, textColor: '#e6e6e6', subTextColor: '#a1a1a1'},
        'xeneon-weather': Object.assign({fontSize: 100, subFontSize: 30}, panel),
        'xeneon-media-player': Object.assign({fontSize: 20, subFontSize: 20}, panel),
        'xeneon-battery-status': {fontSize: 25, subFontSize: 25, textColor: '#a1a1a1', subTextColor: '#e6e6e6', dataColor: '#198754'},
        'xeneon-calendar': Object.assign({fontSize: 18, subFontSize: 13}, panel),
        'xeneon-memory': Object.assign({fontSize: 36, subFontSize: 15}, panel),
        'xeneon-storage': Object.assign({fontSize: 36, subFontSize: 15}, panel),
        'xeneon-temperature-history': Object.assign({fontSize: 48, subFontSize: 15}, panel),
        'xeneon-cooling-overview': Object.assign({fontSize: 24, subFontSize: 15}, panel),
        'xeneon-profile-shortcuts': Object.assign({fontSize: 24, subFontSize: 15}, panel),
        'xeneon-cpu-temp': Object.assign({dataColor: '#ffc107'}, ring),
        'xeneon-gpu-temp': Object.assign({dataColor: '#ffc107'}, ring),
        'xeneon-device-temp': Object.assign({dataColor: '#ffc107'}, ring),
        'xeneon-cpu-load': Object.assign({dataColor: '#38bdf8'}, ring),
        'xeneon-gpu-load': Object.assign({dataColor: '#38bdf8'}, ring),
        'xeneon-device-rpm': Object.assign({dataColor: '#38bdf8'}, ring)
    };
    const numberLimits = {fontSize: [8, 200], subFontSize: [8, 100], max: [0, 100000]};

    const fieldTypes = {
        textColor: 'color', subTextColor: 'color', dataColor: 'color',
        fontSize: 'number', subFontSize: 'number', max: 'number',
        headerText: 'text', weekStart: 'weekStart',
        hideArtwork: 'checkbox', hideControls: 'checkbox', hideForecast: 'checkbox', showSwap: 'checkbox'
    };

    let grid = null;
    let state = null;       // API data: serial, layout, areas, widgets
    let items = {};         // widgetId -> {area, element, hidden, x, y, w, h}
    let hiddenHolder = null;

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function loadCss(href) {
        const link = el('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
    }

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            const script = el('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    function postJson(url, body) {
        return fetch(url, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body)
        }).then(function (r) { return r.json(); });
    }

    function notify(message, type) {
        if (window.toastr) {
            window.toastr[type || 'success'](message);
        }
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    // Position of a widget in the upstream layout, converted to grid cells
    function measure(parts, origin, cellWidth, cellHeight) {
        let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
        parts.forEach(function (part) {
            const rect = part.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) return;
            left = Math.min(left, rect.left);
            top = Math.min(top, rect.top);
            right = Math.max(right, rect.right);
            bottom = Math.max(bottom, rect.bottom);
        });
        if (left === Infinity) return {x: 0, y: 0, w: 4, h: 4};
        const x = clamp(Math.round((left - origin.left) / cellWidth), 0, COLUMNS - 1);
        const y = clamp(Math.round((top - origin.top) / cellHeight), 0, ROWS - 1);
        return {
            x: x,
            y: y,
            w: clamp(Math.round((right - left) / cellWidth), 1, COLUMNS - x),
            h: clamp(Math.round((bottom - top) / cellHeight), 1, ROWS - y)
        };
    }

    // A widget template can render more than one element (weather renders its
    // forecast as a sibling), so take the siblings up to the next widget along
    function widgetParts(element, templates) {
        const parts = [element];
        let next = element.nextElementSibling;
        while (next && !templates[next.id]) {
            next.classList.add('olh-part-extra');
            parts.push(next);
            next = next.nextElementSibling;
        }
        return parts;
    }

    function buildItems(layoutElement) {
        const origin = layoutElement.getBoundingClientRect();
        const cellWidth = origin.width / COLUMNS;
        const cellHeight = origin.height / ROWS;
        const saved = {};
        if (state.layout) {
            state.layout.items.forEach(function (item) { saved[item.widgetId] = item; });
        }

        const templates = {};
        state.areas.forEach(function (area) { templates[area.template] = true; });

        state.areas.forEach(function (area) {
            // Every widget template renders a root element with the template name as id
            const element = document.getElementById(area.template);
            if (!element) return;
            const parts = widgetParts(element, templates);

            let position = saved[area.widgetId];
            if (!position) {
                position = measure(parts, origin, cellWidth, cellHeight);
                position.hidden = false;
            }
            items[area.widgetId] = {
                area: area,
                element: element,
                parts: parts,
                hidden: !!position.hidden,
                measured: !saved[area.widgetId],
                x: position.x, y: position.y, w: position.w, h: position.h
            };
        });

        // Some widgets fill in their content later (weather), so let measured
        // widgets grow down to the next widget, like the upstream column layout
        const list = Object.keys(items).map(function (id) { return items[id]; });
        list.forEach(function (item) {
            if (!item.measured) return;
            let bottom = ROWS;
            list.forEach(function (other) {
                const overlaps = other.x < item.x + item.w && item.x < other.x + other.w;
                if (other !== item && overlaps && other.y > item.y) bottom = Math.min(bottom, other.y);
            });
            item.h = Math.max(item.h, bottom - item.y);
        });
    }

    function itemContent(item) {
        const content = el('div', 'grid-stack-item-content olh-cell edge-panel');
        if (item.element.classList.contains('card')) {
            // Ring widgets expect to sit in a rings grid
            const rings = el('div', 'rings-grid');
            item.parts.forEach(function (part) { rings.appendChild(part); });
            content.appendChild(rings);
        } else {
            item.parts.forEach(function (part) { content.appendChild(part); });
        }

        const overlay = el('div', 'olh-overlay');
        const bar = el('div', 'olh-overlay-bar');
        bar.appendChild(el('span', 'olh-overlay-name', item.area.name));
        const settings = el('button', 'olh-icon-button olh-no-drag');
        settings.type = 'button';
        settings.title = t.settings;
        settings.innerHTML = '<i class="bi bi-gear"></i>';
        settings.addEventListener('click', function () { openSettings(item); });
        const hide = el('button', 'olh-icon-button olh-no-drag');
        hide.type = 'button';
        hide.title = t.hide;
        hide.innerHTML = '<i class="bi bi-eye-slash"></i>';
        hide.addEventListener('click', function () { hideItem(item); });
        bar.appendChild(settings);
        bar.appendChild(hide);
        overlay.appendChild(bar);
        content.appendChild(overlay);
        return content;
    }

    function addToGrid(item) {
        const node = el('div', 'grid-stack-item');
        node.setAttribute('gs-id', String(item.area.widgetId));
        node.appendChild(itemContent(item));
        grid.el.appendChild(node);
        const options = {w: item.w, h: item.h, id: String(item.area.widgetId)};
        if (item.x === undefined) {
            options.autoPosition = true;
        } else {
            options.x = item.x;
            options.y = item.y;
        }
        grid.makeWidget(node, options);
        item.node = node;
    }

    function hideItem(item) {
        syncPositions();
        item.hidden = true;
        // Keep the widget in the page, upstream scripts keep updating it
        item.parts.forEach(function (part) { hiddenHolder.appendChild(part); });
        grid.removeWidget(item.node, true);
        item.node = null;
    }

    function showItem(item) {
        item.hidden = false;
        if (!grid.willItFit({x: item.x, y: item.y, w: item.w, h: item.h})) {
            item.x = undefined;
            item.y = undefined;
        }
        addToGrid(item);
        syncPositions();
    }

    function syncPositions() {
        grid.save(false).forEach(function (node) {
            const item = items[parseInt(node.id, 10)];
            if (item) {
                item.x = node.x; item.y = node.y; item.w = node.w; item.h = node.h;
            }
        });
    }

    function currentLayout() {
        syncPositions();
        return {
            columns: COLUMNS,
            rows: ROWS,
            items: Object.keys(items).map(function (id) {
                const item = items[id];
                return {
                    widgetId: item.area.widgetId,
                    x: item.x || 0, y: item.y || 0, w: item.w || 1, h: item.h || 1,
                    hidden: item.hidden
                };
            })
        };
    }

    function saveLayout() {
        return postJson(API, currentLayout()).then(function (response) {
            if (response.status !== 1) throw new Error(response.message);
            return response;
        });
    }

    function reload(edit) {
        const url = new URL(window.location.href);
        if (edit) url.searchParams.set('edit', '1'); else url.searchParams.delete('edit');
        window.location.replace(url.toString());
    }

    // Widgets that can be added: hidden ones, and widgets not placed in any area yet
    function addableWidgets() {
        const list = [];
        Object.keys(items).forEach(function (id) {
            if (items[id].hidden) list.push({hidden: items[id]});
        });
        const placed = {};
        state.areas.forEach(function (area) { placed[area.widgetId] = true; });
        state.widgets.forEach(function (widget) {
            if (!placed[widget.id]) list.push({widget: widget});
        });
        return list;
    }

    // Upstream only knows 11 widget areas, a new widget needs a free one that allows it
    function freeArea(widget) {
        const used = {};
        state.areas.forEach(function (area) { used[area.areaId] = true; });
        for (let areaId = 1; areaId <= 11; areaId++) {
            const column = areaId <= 2 ? 1 : (areaId >= 9 ? 3 : 2);
            if (!used[areaId] && widget.columns.indexOf(column) !== -1) return areaId;
        }
        return 0;
    }

    function addWidget(widget) {
        const areaId = freeArea(widget);
        if (!areaId) {
            notify(t.noArea, 'warning');
            return;
        }
        saveLayout().then(function () {
            return postJson('/api/xeneon/setWidgetArea', {deviceId: state.serial, areaId: areaId, widgetId: widget.id});
        }).then(function (response) {
            if (response.status !== 1) throw new Error(response.message);
            reload(true);
        }).catch(function () { notify(t.saveFailed, 'error'); });
    }

    function toggleAddMenu(button) {
        const existing = document.querySelector('.olh-menu');
        if (existing) {
            existing.remove();
            return;
        }
        const menu = el('div', 'olh-menu');
        const list = addableWidgets();
        if (list.length === 0) {
            menu.appendChild(el('div', 'olh-menu-empty', t.noWidgets));
        }
        list.forEach(function (entry) {
            const name = entry.hidden ? entry.hidden.area.name + ' (' + t.hidden + ')' : entry.widget.name;
            const option = el('button', 'olh-menu-item', name);
            option.type = 'button';
            option.addEventListener('click', function () {
                menu.remove();
                if (entry.hidden) showItem(entry.hidden); else addWidget(entry.widget);
            });
            menu.appendChild(option);
        });
        button.parentNode.appendChild(menu);
    }

    function buildToolbar() {
        const toolbar = el('div', 'olh-toolbar');
        const buttons = [
            {text: t.add, icon: 'bi-plus-lg', action: function (b) { toggleAddMenu(b); }},
            {text: t.reset, icon: 'bi-arrow-counterclockwise', action: function () {
                if (!window.confirm(t.resetConfirm)) return;
                fetch(API, {method: 'DELETE'}).then(function () { reload(true); });
            }},
            {text: t.cancel, icon: 'bi-x-lg', action: function () { reload(false); }},
            {text: t.save, icon: 'bi-check-lg', primary: true, action: function () {
                saveLayout().then(function () { reload(false); })
                    .catch(function () { notify(t.saveFailed, 'error'); });
            }}
        ];
        buttons.forEach(function (definition) {
            const wrapper = el('div', 'olh-toolbar-entry');
            const button = el('button', 'olh-button' + (definition.primary ? ' olh-primary' : ''));
            button.type = 'button';
            button.innerHTML = '<i class="bi ' + definition.icon + '"></i> ';
            button.appendChild(document.createTextNode(definition.text));
            button.addEventListener('click', function () { definition.action(button); });
            wrapper.appendChild(button);
            toolbar.appendChild(wrapper);
        });
        document.body.appendChild(toolbar);
    }

    function setEditMode(enabled) {
        document.body.classList.toggle('olh-editing', enabled);
        grid.setStatic(!enabled);
        if (enabled && !document.querySelector('.olh-toolbar')) buildToolbar();
    }

    function buildEditToggle() {
        const toggle = el('button', 'olh-edit-toggle');
        toggle.type = 'button';
        toggle.title = t.edit;
        toggle.innerHTML = '<i class="bi bi-pencil"></i>';
        toggle.addEventListener('click', function () { setEditMode(true); });
        document.body.appendChild(toggle);
    }

    function settingsInput(field, value) {
        const row = el('label', 'olh-field');
        row.appendChild(el('span', 'olh-field-label', t[field] || field));
        let input;
        switch (fieldTypes[field]) {
            case 'checkbox':
                input = el('input');
                input.type = 'checkbox';
                input.checked = !!value;
                row.classList.add('olh-field-check');
                break;
            case 'weekStart':
                input = el('select');
                [[0, t.monday], [1, t.sunday]].forEach(function (option) {
                    const o = el('option', null, option[1]);
                    o.value = String(option[0]);
                    input.appendChild(o);
                });
                input.value = String(value || 0);
                break;
            case 'color':
                input = el('input');
                input.type = 'color';
                input.value = /^#[0-9a-fA-F]{6}$/.test(value || '') ? value : '#ffffff';
                break;
            case 'number':
                input = el('input');
                input.type = 'number';
                input.value = value || 0;
                if (numberLimits[field]) {
                    input.min = numberLimits[field][0];
                    input.max = numberLimits[field][1];
                }
                break;
            default:
                input = el('input');
                input.type = 'text';
                input.maxLength = 64;
                input.value = value || '';
        }
        input.dataset.field = field;
        row.appendChild(input);
        return row;
    }

    function readInput(input) {
        switch (fieldTypes[input.dataset.field]) {
            case 'checkbox': return input.checked;
            case 'weekStart': return parseInt(input.value, 10) || 0;
            case 'number': {
                const limits = numberLimits[input.dataset.field] || [0, 100000];
                return clamp(parseInt(input.value, 10) || 0, limits[0], limits[1]);
            }
            default: return input.value;
        }
    }

    function openSettings(item) {
        postJson('/api/xeneon/getWidget', {deviceId: state.serial, widgetId: item.area.widgetId}).then(function (response) {
            if (response.status !== 1 || !response.data) return;
            const widget = response.data;
            const fields = commonFields.concat(templateFields[item.area.template] || []);
            const defaults = templateDefaults[item.area.template] || {};
            Object.keys(defaults).forEach(function (field) {
                if (!widget[field]) widget[field] = defaults[field];
            });

            const backdrop = el('div', 'olh-modal-backdrop');
            const modal = el('div', 'olh-modal');
            modal.appendChild(el('h3', 'olh-modal-title', item.area.name));
            const form = el('div', 'olh-modal-fields');
            fields.forEach(function (field) { form.appendChild(settingsInput(field, widget[field])); });
            modal.appendChild(form);

            const actions = el('div', 'olh-modal-actions');
            const advanced = el('a', 'olh-link', t.advanced);
            advanced.href = '/device/' + encodeURIComponent(state.serial);
            advanced.target = '_blank';
            const cancel = el('button', 'olh-button', t.cancel);
            cancel.type = 'button';
            cancel.addEventListener('click', function () { backdrop.remove(); });
            const save = el('button', 'olh-button olh-primary', t.save);
            save.type = 'button';
            save.addEventListener('click', function () {
                form.querySelectorAll('[data-field]').forEach(function (input) {
                    widget[input.dataset.field] = readInput(input);
                });
                // Widgets are rendered by the server, so save the layout and reload
                saveLayout().then(function () {
                    return postJson('/api/xeneon/saveWidget', {deviceId: state.serial, widget: widget});
                }).then(function (result) {
                    if (result.status !== 1) throw new Error(result.message);
                    reload(true);
                }).catch(function () { notify(t.widgetSaveFailed, 'error'); });
            });
            actions.appendChild(advanced);
            actions.appendChild(cancel);
            actions.appendChild(save);
            modal.appendChild(actions);
            backdrop.appendChild(modal);
            backdrop.addEventListener('click', function (e) { if (e.target === backdrop) backdrop.remove(); });
            document.body.appendChild(backdrop);
        });
    }

    function init(data) {
        state = data;
        const shell = document.querySelector('.edge-shell');
        const layoutElement = document.querySelector('.edge-layout');
        if (!shell || !layoutElement) return;

        buildItems(layoutElement);

        const gridElement = el('div', 'grid-stack olh-grid');
        shell.appendChild(gridElement);
        hiddenHolder = el('div', 'olh-hidden');
        document.body.appendChild(hiddenHolder);

        // The kiosk window can still be resized to fullscreen after loading
        function cellHeight() {
            const style = getComputedStyle(shell);
            const height = shell.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
            return Math.max(10, Math.floor(height / ROWS));
        }
        window.addEventListener('resize', function () {
            if (grid) grid.cellHeight(cellHeight());
        });

        const GridStack = window.GridStack.GridStack || window.GridStack;
        grid = GridStack.init({
            column: COLUMNS,
            maxRow: ROWS,
            cellHeight: cellHeight(),
            margin: MARGIN,
            mode: 'float',
            staticGrid: true,
            animate: true,
            draggable: {cancel: '.olh-no-drag'},
            resizable: {handles: 'se,sw,ne,nw,e,w,s,n'}
        }, gridElement);

        Object.keys(items).forEach(function (id) {
            const item = items[id];
            if (item.hidden) {
                item.parts.forEach(function (part) { hiddenHolder.appendChild(part); });
            } else {
                addToGrid(item);
            }
        });
        layoutElement.remove();
        document.body.classList.add('olh-layout');

        buildEditToggle();
        if (new URLSearchParams(window.location.search).get('edit') === '1') setEditMode(true);
    }

    // The window manager makes the kiosk window fullscreen after it opens. The
    // default layout is measured from the upstream layout, so wait until the
    // window size has settled (no resize for a while, at most a few seconds).
    function waitForStableSize() {
        return new Promise(function (resolve) {
            let timer = null;
            function settled() {
                window.removeEventListener('resize', changed);
                resolve();
            }
            function changed() {
                clearTimeout(timer);
                timer = setTimeout(settled, 800);
            }
            window.addEventListener('resize', changed);
            changed();
            setTimeout(settled, 5000);
        });
    }

    loadCss('/static/vendor/gridstack/gridstack.min.css');
    loadCss('/static/css/xeneon-layout.css');
    Promise.all([
        loadScript('/static/vendor/gridstack/gridstack-all.js'),
        fetch(API).then(function (r) { return r.ok ? r.json() : null; }),
        new Promise(function (resolve) {
            if (document.readyState === 'complete') resolve(); else window.addEventListener('load', resolve);
        }).then(waitForStableSize)
    ]).then(function (results) {
        if (results[1] && results[1].status === 1) init(results[1].data);
    }).catch(function (error) {
        // Without the layout API the upstream layout stays as it is
        console.warn('XENEON EDGE layout unavailable', error);
    });
})();
