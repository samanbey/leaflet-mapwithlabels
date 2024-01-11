# leaflet-mapwithlabels
Extends L.Map with automatic labeling.
Labels layers if the `label` option is present.

# Usage
- include JavaScript and CSS file:
```HTML
<link rel="stylesheet" href="https://samanbey.github.io/leaflet-mapwithlabels/leaflet-mapwithlabels.css" />
<script src="https://samanbey.github.io/leaflet-mapwithlabels/leaflet-mapwithlabels.js"></script>
```
- use `L.mapWithLabels()` instead of `L.map()`
```javascript
const map = L.mapWithLabels('map_div');
``` 

- set `label` option for layer objects, either as a string literal 
  or a function assigning label to layer objects
```javascript
// add a marker with a label
L.marker([47.5, 19.05], { label: 'Budapest' }).addTo(map);

// fetch geojson data and create a polygon layer with labels
fetch('hu_megyek.geojson').then(r => r.json()).then(d => {
    L.geoJSON(d, {
        label: l => l.feature.properties.Nev, 
        labelPos: 'cc', 
        labelStyle: { color: 'darkblue', whiteSpace: 'normal', minWidth: '120px', textAlign: 'center'},
        labelPriority: l => l.feature.properties.Nepesseg,
    }).addTo(map);
});
```

## options of `MapWithLabels()`
- `labelPane`: which map pane to place labels on. Default: `'tooltipPane'`

## label-specific options of layers:
- `label`: label string literal or function assigning label to layer objects
- `labelGap`: gap between marker and label. Default: 2
- `labelPos`: label position. Possible values: `'l'`, `'r'`, `'cc'` or `'auto'` (default). 
               'auto' means first right position is tried, then left.
- `labelStyle`: label styling CSS object literal or function assigning style object to layer objects.
                Default: `{}`
- `labelPriority`: priority of label (higher numbers come earlier). Either a number or a function.

# Example
https://samanbey.github.io/leaflet-mapwithlabels/example.html