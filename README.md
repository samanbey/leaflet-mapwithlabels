# leaflet-mapwithlabels
Extends L.Map with automatic labeling.
Labels layers if the `label` option is present.

Labels are only placed if there is no overlap.

# Usage
- include JavaScript and CSS file:
```HTML
<link rel="stylesheet" href="https://samanbey.github.io/leaflet-mapwithlabels/leaflet-mapwithlabels.css" />
<script src="https://samanbey.github.io/leaflet-mapwithlabels/leaflet-mapwithlabels.js"></script>
```
- use `L.mapWithLabels()` instead of `L.map()`
```JavaScript
const map = L.mapWithLabels('map_div');
``` 

- set `label` option for layer objects, either as a string literal 
  or a function assigning label to layer objects
```JavaScript
// add a marker with a label
L.marker([47.5, 19.05], { label: 'Budapest' }).addTo(map);

// fetch geojson data and create a polygon layer with labels
fetch('hu_megyek.geojson').then(r => r.json()).then(d => {
    L.geoJSON(d, {
        label: l => l.feature.properties.Nev, 
        labelPos: 'cc', 
        labelStyle: { color: 'darkblue', whiteSpace: 'normal', minWidth: '120px', textAlign: 'center' },
        labelPriority: l => l.feature.properties.Nepesseg,
    }).addTo(map);
});
```

## options of `MapWithLabels()`
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `labelPane` | String | `'tooltipPane'` | which map pane to place labels on. |

## label-specific options of layers:
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `label` | `String\|Function(<Layer>)` | undefined | label string literal or function assigning label to layer objects. |
| `labelGap` | `Number` | `2` | gap between marker and label. |
| `labelPos` | `String` | `'auto'` | label position. Possible values: `'l'`, `'r'`, `'cc'` or `'auto'`. 'auto' means first right position is tried, then left. |
| `labelStyle` | `Object\|Function(<Layer>)` | `{}` | label styling CSS object literal or function assigning style object to layer objects. |
| `labelPriority` | `Number\|Function(<Layer>)` | 0 | priority of label (higher numbers come earlier). Either a number or a function. |
| `markerWithLabelOnly` | `Boolean` | `false` | marker is displayed if its label also fits. |
| `labelRepeatAlongLines` | `Boolean` | `false` | repeat labels along linestrings. |
| `labelRepeatDistance` | `Number` | `200` | distance of repeated labels along linestrings in pixels. Only takes effect if `labelRepeatAlongLines` is true. |

## Deafult label style
Labels are `<span>` elements with `leaflet-label` class. Default label style is set in `leaflet-mapwithlabels.css`.

## Label text
Label text is assigned to the `innerHTML` property of `<span>` elements, therefore it is treated as HTML code. 
This gives extra possibilities (e.g. labels can be links) but also requires some attention. 
If any client input is used as labels, it is advisable to apply proper escaping to prevent XSS vulnerabilities.

# Known issues
- L.GeoJSON does not pass over options to its custom Marker layers, 
  therefore if custom markers are used for GeoJSON points, label-specific options has to be included within marker factory function options:
    ``` javascript
    L.geoJSON(d, {
        pointToLayer: (gj, ll) => L.circleMarker(ll, {
            labelStyle: l => (l.feature.properties.place=='city'?{ textTransform: 'uppercase', fontWeight:'bold' }:{}),
            labelPriority: l => l.feature.properties.population,
            markerWithLabelOnly: true,
            label: l => l.feature.properties.name,
            radius: gj.properties.population?Math.pow(gj.properties.population,.2)-1:1,
        }), 
        style: f => ({ color: '#000', weight: f.properties.place=='city'?3:1 })
    })    
    ```
  If the pointToLayer option is not used, it is enough to include `markersInheritOptions: true` in options.
        
# Examples
- 3182 Hungarian settlements as point objects: https://samanbey.github.io/leaflet-mapwithlabels/examples/example_points.html
- Roads with numbers: https://samanbey.github.io/leaflet-mapwithlabels/examples/example_line.html
- Polygons with label: https://samanbey.github.io/leaflet-mapwithlabels/examples/example_poly.html
- Several layers with labels: https://samanbey.github.io/leaflet-mapwithlabels/examples/example.html