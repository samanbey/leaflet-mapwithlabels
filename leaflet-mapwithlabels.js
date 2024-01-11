/**
 * class L.MapWithLabels()
 *
 * extends L.Map
 * automatically labels layers with `label` option set
 *
 * MIT License
 * Copyright (c) 2024 Gede Mátyás
 */

/** Default label settings for layers */
L.Layer.mergeOptions({
    labelGap: 2,
    labelPos: 'auto',
    labelStyle: {}
});

// LayerGroup has to be modified to prevent updating labels after the addition of each single sublayer
L.LayerGroup.include({
	onAdd(map) {
		this.eachLayer(l => map.addLayer(l, false), map);
        map._updateLabels();
	}    
});

L.MapWithLabels = L.Map.extend({
    options: {
        labelPane: 'tooltipPane'
    },

    _labels: {}, // labels, stored by their respective layerId
    _labelPosOrder: ['r', 'l'],
    
    initialize(id, options) {
        L.Map.prototype.initialize.call(this, id, options);
        this._labelContainer = L.DomUtil.create('div', '', this.getPane(this.options.labelPane));
        this.on('zoomend', this._updateLabels);
        this.on('moveend', this._updateLabels);
        this.on('zoomanim', this._zoomAnim);
    },
       
    addLayer(layer, updateLabels = true) {
        L.Map.prototype.addLayer.call(this, layer);
        // if it is not a layer group, look for label
        if (!layer.getLayers && layer.options.label) {
            let layerId = layer._leaflet_id; // ID of the layer the label belongs to
            let anchor = [0, 0], size = [0, 0]; // icon anchor point and size (if there is an icon)
            let geomType = layer.feature ? layer.feature.geometry.type : 'Marker';
            
            // for points with an icon or a circle, get symbol size and anchor point
            if (geomType == 'Point' || geomType == 'Marker') {
                anchor = layer.getIcon ? layer.getIcon().options.iconAnchor : [layer.getRadius(), layer.getRadius()];
                size = layer.getIcon ? layer.getIcon().options.iconSize : [layer.getRadius() * 2, layer.getRadius() * 2];
            }
            
            // geographic reference point of the label: 
            // position of the marker or centroid of polygon or central opint of polyline
            let latLng = layer.getLatLng ? layer.getLatLng() :
                geomType.endsWith('Polygon') ? L.PolyUtil.polygonCenter(layer._defaultShape(), L.CRS.EPSG3857)
                                             : L.LineUtil.polylineCenter(layer._defaultShape(), L.CRS.EPSG3857);
        
            let pri = layer.options.labelPriority ? typeof layer.options.labelPriority == "function" ? layer.options.labelPriority(layer) : layer.options.labelPriority : 0;
            // labels are stored by their layer ID
            this._labels[layerId] = {
                label: layer.options.label,
                anchor: anchor, 
                size: size,
                latLng: latLng,
                layer: layer,
                geomType: geomType,
                priority: pri
            }
            if (updateLabels)
                this._updateLabels();
        }        
    },
    
    removeLayer(layer) {
        let layerId = layer._leaflet_id;
        L.Map.prototype.removeLayer.call(this, layer);        
        if (this._labels[layerId]) {
            delete this._labels[layerId];
            this._updateLabels();
        }
    },

    _zoomAnim(e) {
        /** recalculating label positions during zoom animation steps */
        for (let l in this._labels) {
            let lab = this._labels[l];
            let ls = lab.span;
            if (ls) {
                let pos = this._latLngToNewLayerPoint(lab.latLng, e.zoom, e.center);
                this._addOffset(pos, lab.pos, lab.layer.options.labelGap, lab);
                ls.style.top = `${pos.y}px`;
                ls.style.left = `${pos.x}px`; 
            }
        }
    },
    
    _addOffset(pos, labelPos, gap, label) {
        /** calculates the label position relative to the anchor point */
        let ls = label.span;
        switch (labelPos) {
            case 'r':
                pos.x += label.size[0] - label.anchor[0] + gap;
                pos.y += label.size[1]/2 - label.anchor[1] - ls.clientHeight/2;
                break;
            case 'l':
                pos.x -= label.anchor[0] + gap + ls.clientWidth;
                pos.y += label.size[1]/2 - label.anchor[1] - ls.clientHeight/2;
                break;
            case 'cc':
                pos.x -= label.anchor[0] + ls.clientWidth/2;
                pos.y -= label.anchor[1] + ls.clientHeight/2;
                break;
        }
    },
        
    _intersects(bb1, bb2) {
        /// checks if two bounding boxes intersect
        let b1 = L.bounds([[bb1.x1, bb1.y1], [bb1.x2, bb1.y2]]), 
            b2 = L.bounds([[bb2.x1, bb2.y1], [bb2.x2, bb2.y2]]);
        return b1.intersects(b2);
    },
    
    _updateLabels() {
        let t1=Date.now();
        this._labelContainer.innerHTML = ''; // remove all labels
        
        this._bbs=[]; // array of bounding boxes.
        let bb;

        // order labels by priority
        this._labelPriOrder = [];
        for (let l in this._labels) {
            let lab = this._labels[l]
            this._labelPriOrder.push({ id: l, p: lab.priority });
        }
        this._labelPriOrder.sort((a, b) => (b.p - a.p));
        
        // calculate pixelcoordinates of the current map view extent
        let maptr = this._panes.mapPane.style.transform.substring(12).split(', ');
        let mapx1 = -parseFloat(maptr[0]), mapy1=-parseFloat(maptr[1]);
        let mapx2 = mapx1 + this._container.clientWidth,
            mapy2 = mapy1 + this._container.clientHeight;
            
        // placing labels in priority order
        for(let i = 0; i < this._labelPriOrder.length; i++) {
            let lab = this._labels[this._labelPriOrder[i].id]; // the label to place
            let pos = this.latLngToLayerPoint(lab.latLng); // label reference point pixel position
            let markerbb = { 
                x1: pos.x - lab.anchor[0], 
                y1: pos.y - lab.anchor[1], 
                x2: pos.x - lab.anchor[0] + lab.size[0], 
                y2: pos.y - lab.anchor[1] + lab.size[1] 
            }; // bounding box of a marker icon
            let fits = true;
            // check icon placing conflict for point features with markers
            if (lab.size[0] > 0 && lab.size[1] > 0) 
                this._bbs.some(b => {
                    if (this._intersects(b, markerbb)) {                        
                        fits = false;
                        return true;
                    }
                });
            // create <span> element for label
            let ls = L.DomUtil.create('span', 'leaflet-label', this._labelContainer);
            // set custom label style
            let st = (typeof lab.layer.options.labelStyle == 'function') ? lab.layer.options.labelStyle(lab.layer) : lab.layer.options.labelStyle;
            for (let r in st)
                ls.style[r] = st[r];
            lab.span = ls;
            // set label text
            ls.innerHTML = typeof lab.label == 'function' ? lab.label(lab.layer) : lab.label;
            if (fits) {
                // possible label positions
                let po = lab.layer.options.labelPos == 'auto' ? this._labelPosOrder : [ lab.layer.options.labelPos ];
                // try possible label positions
                for (let posi in po) {
                    fits = true;
                    let lp = po[posi];
                    let p = {...pos}; // copy position for later
                    this._addOffset(pos, lp, lab.layer.options.labelGap, lab);
                    bb = { x1: pos.x, y1: pos.y, x2: pos.x+ls.clientWidth, y2: pos.y+ls.clientHeight };
                    // check if label fits in view
                    if (bb.x1 > mapx2 || bb.x2 < mapx1 || bb.y1 > mapy2 || bb.y2 < mapy1) {
                        fits = false;
                    }
                    else 
                        this._bbs.some(b => {
                            if (this._intersects(b,bb)) {                        
                                fits = false;
                                return true;
                            }
                        }); // check for conflicts with already existing labels
                    if (fits) {
                        lab.pos = lp;
                        break;
                    }
                    pos = p; // if this position did not fit, return to original marker position and try next one                   
                }
            }
            if (fits) { 
                // place label if fits
                this._bbs.push(bb);
                this._bbs.push(markerbb);
                lab.span.style.top = `${pos.y}px`;
                lab.span.style.left = `${pos.x}px`; 
                // check whether the respective marker also has to be (re-)displayed
                if (lab.layer.options.markerWithLabelOnly) {
                    let o = lab.layer._icon || lab.layer._path;
                    //o.style.visibility = '';
                    o.style.display = '';
                }            }
            else {
                // remove label <span> if does not fit
                this._labelContainer.removeChild(lab.span);
                // check whether the respective marker also has to be hidden
                if (lab.layer.options.markerWithLabelOnly) {
                    let o = lab.layer._icon || lab.layer._path;
                    //o.style.visibility = 'hidden';
                    o.style.display = 'none';
                }
            }
            lab.span.style.top = `${pos.y}px`;
            lab.span.style.left = `${pos.x}px`; 
        }
    }
});

/// factory function
L.mapWithLabels = function(id, options) {
    return new L.MapWithLabels(id, options);
};