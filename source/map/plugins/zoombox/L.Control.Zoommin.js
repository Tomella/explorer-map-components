L.Control.Zoommin = L.Control.extend({
    _active: false,
    _map: null,
    includes: L.Mixin.Events,
    options: {
        position: 'topleft',
        className: 'fa fa-home',
        modal: false
    },
    onAdd: function (map) {
        this._map = map;
        this._container = L.DomUtil.create('div', 'leaflet-zoom-box-control leaflet-bar');
        this._container.title = "Zoom to max extent";
        var link = L.DomUtil.create('a', this.options.className, this._container);
        link.href = "#";

        L.DomEvent
            .on(this._container, 'dblclick', L.DomEvent.stop)
            .on(this._container, 'click', L.DomEvent.stop)
            .on(this._container, 'click', function(){
                this._active = !this._active;
             
				map.setView(this.options.center, this.options.zoom);				
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

L.control.zoommin = function (options) {
  return new L.Control.Zoommin(options);
};