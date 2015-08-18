L.Control.Zoomout = L.Control.extend({
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