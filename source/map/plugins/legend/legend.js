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
	        them._active = !them._active;
	       
	        if(them._active) {
	        	them._legend = L.control({position: 'topleft'});

	        	them._legend.onAdd = function (map) {
	        		var div = L.DomUtil.create('div', them.options.overlayClass),
						html = '<img src="' + them.options.url + '"></img>';
					
					L.DomEvent.disableClickPropagation(div).disableScrollPropagation(div).on(div, 'keydown', function(event) {
						if (event.keyCode == 24) {
							this.scrollTop -= 20;
							stop(event);
						} else if (event.keyCode == 25) {
							this.scrollTop += 20;
							stop(event);
						}
						
						function stop(event) {
							event.stopPropogation();
							event.preventDefault();
						}
					});
						
	        		div.innerHTML = html;
					div.tabIndex = 0;
					div.focus();
	        		return div;
	        	};
	        	map.addControl(them._legend);
	    		L.DomUtil.addClass(them._container, 'active');
	        } else {
				
	        	map.removeControl(them._legend);
				L.DomUtil.removeClass(them._container, 'active');
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
