/*!
 * Copyright 2015 Geoscience Australia (http://www.ga.gov.au/copyright.html)
 */

(function(L) {

'use strict';

L.Control.Features = L.Control.extend({
	_active: false,
	_map: null,
	includes: L.Mixin.Events,
	options: {
	    position: 'topleft',
	    className: 'fa fa-location-arrow fa-rotate-180',
	    modal: false
	},
	
	onAdd: function (map) {
	    this._map = map;
	    this._container = L.DomUtil.create('div', 'leaflet-feature-control leaflet-bar');
	    this._container.title = "Show features under point";
	    var link = L.DomUtil.create('a', this.options.className, this._container);
        link.href = "#";

        L.DomEvent.on(this._container, 'dblclick', L.DomEvent.stop)
	            .on(this._container, 'click', L.DomEvent.stop)
	            .on(this._container, 'click', function(e) {
	        
	        this._active = !this._active;
	       
	        if(this._active) {
	        	map.fireEvent("featuresactivate", e);
	        	L.DomUtil.addClass(this, 'active');
	        } else {
	        	map.fireEvent("featuresdeactivate", e);
	        	L.DomUtil.removeClass(this, 'active');
			}
	    });
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

L.control.features = function (options) {
	return new L.Control.Features(options);
};
	
})(L);
