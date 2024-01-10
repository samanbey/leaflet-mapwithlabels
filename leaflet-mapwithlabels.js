/**
 * class L.MapWithLabels()
 *
 * extends L.Map
 * automatically labels layers with `label` option set
 *
 * MIT License
 * Copyright (c) 2024 Gede Mátyás
 */

L.Layer.mergeOptions({
    labelGap: 2,
    labelPos: 'auto',
    labelStyle: {}
});

L.MapWithLabels = L.Map.extend({
    options: {
        labelPane: 'tooltipPane',
    },

    _labels: {},
    _labelPosOrder: ['r','l'],
    _labelPriOrder: [], // array to store labels in priority order
    
    initialize(id, options) {
        L.Map.prototype.initialize.call(this, id, options);
        this._labelContainer = L.DomUtil.create('div', '', this.getPane(this.options.labelPane));
        this.on('zoomend', this._updateLabels);
        this.on('moveend', this._updateLabels);
        this.on('zoomanim', this._zoomAnim);
    },
       
    addLayer(layer) {
        L.Map.prototype.addLayer.call(this, layer);
        
        // if it is not a layer group, look for label
        if (!layer.getLayers && layer.options.label) {
            let layerId = layer._leaflet_id;
            let anchor = [0,0], size = [0,0];
            let geomType = layer.feature?layer.feature.geometry.type:'Marker';
            
            // for points with an icon or a circle, get symbol size and anchor point
            if (geomType == 'Point' || geomType == 'Marker') {
                anchor = layer.getIcon?layer.getIcon().options.iconAnchor:[layer.getRadius(),layer.getRadius()];
                size = layer.getIcon?layer.getIcon().options.iconSize:[layer.getRadius()*2,layer.getRadius()*2];
            }
            
            let latLng = layer.getLatLng ? layer.getLatLng() :
                geomType.endsWith('Polygon') ? L.PolyUtil.polygonCenter(layer._defaultShape(), L.CRS.EPSG3857)
                                             : L.LineUtil.polylineCenter(layer._defaultShape(), L.CRS.EPSG3857);
        
            let pri = layer.options.labelPriority ? typeof layer.options.labelPriority == "function" ? layer.options.labelPriority(layer) : layer.options.labelPriority : 0;
            this._labels[layerId] = {
                label: layer.options.label,
                anchor: anchor, 
                size: size,
                latLng: latLng,
                layer: layer,
                geomType: geomType,
                priority: pri
            }
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
                pos.x+=label.size[0]-label.anchor[0]+gap;
                pos.y+=label.size[1]/2-label.anchor[1]-ls.clientHeight/2;
                break;
            case 'l':
                pos.x-=label.anchor[0]+gap+ls.clientWidth;
                pos.y+=label.size[1]/2-label.anchor[1]-ls.clientHeight/2;
                break;
            case 'cc':
                pos.x-=label.anchor[0]+ls.clientWidth/2;
                pos.y-=label.anchor[1]+ls.clientHeight/2;
                break;
        }
    },
        
    _intersects(bb1,bb2) {
        // checks if two bounding boxes intersect
        let b1=L.bounds([[bb1.x1,bb1.y1],[bb1.x2,bb1.y2]]), 
            b2=L.bounds([[bb2.x1,bb2.y1],[bb2.x2,bb2.y2]]);
        return b1.intersects(b2);
    },
    
    _updateLabels() {
        this._labelContainer.innerHTML = '';
        
        this._bbs=[]; // array of bounding boxes.
        let bb;

        // order labels by priority
        this._labelPriOrder=[];
        this._viewFilter=this.options.viewFilter;
        for (let l in this._labels) {
            let lab=this._labels[l]
            this._labelPriOrder.push({ id: l, p: lab.priority });
        }
        this._labelPriOrder.sort((a,b)=>(b.p-a.p));
        
        let maptr=this._panes.mapPane.style.transform.substring(12).split(', ');
        let mapx1=-parseFloat(maptr[0]), mapy1=-parseFloat(maptr[1]);
        let mapx2=mapx1+this._container.clientWidth,
            mapy2=mapy1+this._container.clientHeight;
            
        for(let i = 0; i < this._labelPriOrder.length; i++) {
            let lab = this._labels[this._labelPriOrder[i].id];
            let pos = this.latLngToLayerPoint(lab.latLng);
            lab.pos = lab.layer.options.labelPos == 'auto' ? this._labelPosOrder[0] : lab.layer.options.labelPos; /// TODO: manage positions
            let markerbb = { x1: pos.x-lab.anchor[0], y1: pos.y-lab.anchor[1], x2: pos.x-lab.anchor[0]+lab.size[0], y2: pos.y-lab.anchor[1]+lab.size[1] }
            let fits = true;
            // check icon placing conflict for point features with markers
            if (lab.size[0]>0&&lab.size[1]>0) 
                this._bbs.some(b => {
                    if (this._intersects(b,markerbb)) {                        
                        fits=false;
                        return true;
                    }
                });
            let ls = L.DomUtil.create('span', 'leaflet-label', this._labelContainer);
            // set custom label style
            let st = (typeof lab.layer.options.labelStyle == 'function') ? lab.layer.options.labelStyle(lab.layer) : lab.layer.options.labelStyle;
            for (let r in st)
                ls.style[r] = st[r];
            lab.span = ls;
            ls.innerHTML = typeof lab.label == 'function' ? lab.label(lab.layer) : lab.label;
            if (fits) {
                let po = lab.layer.options.labelPos == 'auto' ? this._labelPosOrder : [ lab.layer.options.labelPos ];
                for (let posi in po) {
                    fits=true;
                    let lp=po[posi];
                    let p={...pos}; // copy position for later
                    this._addOffset(pos, lp, lab.layer.options.labelGap, lab);
                    bb={ x1: pos.x, y1: pos.y, x2: pos.x+ls.clientWidth, y2: pos.y+ls.clientHeight }
                    if (bb.x1>mapx2||bb.x2<mapx1||bb.y1>mapy2||bb.y2<mapy1) {
                        fits=false;
                        //if (lab.layer._map) console.log(lab.label+' went out of view');
                    }
                    else
                        this._bbs.some(b => {
                            if (this._intersects(b,bb)) {                        
                                fits=false;
                                return true;
                            }
                        });
                    if (fits) {
                        lab.pos = lp;
                        break;
                    }
                    pos=p; // if this position did not fit, return to original marker position and try next one                   
                }
            }
            if (fits) {
                //if (!lab.layer._map) console.log(lab.label+' came back to view');
                this._bbs.push(bb);
                this._bbs.push(markerbb);
                lab.span.style.top = `${pos.y}px`;
                lab.span.style.left = `${pos.x}px`; 
                if (lab.layer.options.markerWithLabelOnly) {
                    let o = lab.layer._icon || lab.layer._path;
                    o.style.visibility='';
                }            }
            else {
                this._labelContainer.removeChild(lab.span);
                if (lab.layer.options.markerWithLabelOnly) {
                    let o = lab.layer._icon || lab.layer._path;
                    o.style.visibility='hidden';
                }
            }
            lab.span.style.top = `${pos.y}px`;
            lab.span.style.left = `${pos.x}px`; 
        }
    }
});

L.mapWithLabels = function(id, options) {
    return new L.MapWithLabels(id, options);
};