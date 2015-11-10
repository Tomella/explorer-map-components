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
		overlayClass: 'leaflet-legend',
	    className: 'fa fa-list',
	    modal: false,
		url: 'resources/img/NationalLegend.png'
	},
	
	onAdd: function (map) {
		var them = this;
	    this._map = map;
	    this._container = L.DomUtil.create('div', 'leaflet-legend-control leaflet-bar');
	    this._container.title = "Show legend";
	    var link = L.DomUtil.create('a', this.options.className, this._container);
        link.href = "#";

        L.DomEvent
	            .on(this._container, 'dblclick', L.DomEvent.stop)
	            .on(this._container, 'click', L.DomEvent.stop)
	            .on(this._container, 'click', function(){
	        this._active = !this._active;
	       
	        if(this._active) {
	        	this._legend = L.control({position: 'topleft'});

	        	this._legend.onAdd = function (map) {
	        		var div = L.DomUtil.create('div', them.options.overlayClass),
						html = '<img src="' + them.options.url + '"></img>';

	        		div.innerHTML = html;
	        		return div;
	        	};
	        	map.addControl(this._legend);
	        } else {
	        	map.removeControl(this._legend);
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

L.control.legend = function (options) {
	return new L.Control.Legend(options);
};
	
})(L);
