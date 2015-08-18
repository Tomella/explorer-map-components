/*!
 * Copyright 2015 Geoscience Australia (http://www.ga.gov.au/copyright.html)
 */
(function(L) {

'use strict';	

L.Control.Legend = L.Control.extend({
    _active: false,
    _map: null,
    includes: L.Mixin.Events,
    options: {
        position: 'topleft',
        className: 'fa fa-search-minus',
        modal: false
    },
    onAdd: function (map) {
        this._map = map;
        this._container = L.DomUtil.create('div', 'leaflet-zoom-box-control leaflet-bar');
        this._container.title = "Zoom out";
        var link = L.DomUtil.create('a', this.options.className, this._container);
        link.href = "#";

        map.on('zoomend', function(){
            if (map.getZoom() == map.getMaxZoom()){
                L.DomUtil.addClass(link, 'leaflet-disabled');
            }
            else {
                L.DomUtil.removeClass(link, 'leaflet-disabled');
            }
        }, this);
        map.on('boxzoomend', this.deactivate, this);

        L.DomEvent
            .on(this._container, 'dblclick', L.DomEvent.stop)
            .on(this._container, 'click', L.DomEvent.stop)
            .on(this._container, 'click', function(){
                this._active = !this._active;

				var newZoom, zoom = map.getZoom();
				if(zoom <= map.getMinZoom()) {
					return;
				} 				
				if(zoom < 10) {
					newZoom = zoom - 1;
				} else if(zoom < 13) {
					newZoom = zoom - 2;
				} else {
					newZoom = zoom - 3;
				}
				map.setZoom(newZoom);				
            }, this);
        return this._container;
    },
    activate: function() {
        L.DomUtil.addClass(this._container, 'active');
    },
    deactivate: function() {
        L.DomUtil.removeClass(this._container, 'active');
        this._active = false;
    }
});

L.control.zoomout = function (options) {
  return new L.Control.Zoomout(options);
};




var populationLegend = L.control({position: 'bottomright'});
var populationChangeLegend = L.control({position: 'bottomright'});

populationLegend.onAdd = function (map) {
var div = L.DomUtil.create('div', 'info legend');
    div.innerHTML +=
    '<img src="legend.png" alt="legend" width="134" height="147">';
return div;
};

populationChangeLegend.onAdd = function (map) {
var div = L.DomUtil.create('div', 'info legend');
    div.innerHTML +=
    '<img src="change_legend.png" alt="legend" width="134" height="147">';
return div;
};

// Add this one (only) for now, as the Population layer is on by default
populationLegend.addTo(map);

map.on('overlayadd', function (eventLayer) {
    // Switch to the Population legend...
    if (eventLayer.name === 'Population') {
        this.removeControl(populationChangeLegend);
        populationLegend.addTo(this);
    } else { // Or switch to the Population Change legend...
        this.removeControl(populationLegend);
        populationChangeLegend.addTo(this);
    }
});

})(L);