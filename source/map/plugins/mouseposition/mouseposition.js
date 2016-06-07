L.Control.MousePosition = L.Control.extend({
  options: {
    position: 'bottomleft',
    separator: ' : ',
    emptyString: 'Unavailable',
    lngFirst: false,
    numDigits: 5,
    elevGetter: undefined,
    lngFormatter: undefined,
    latFormatter: undefined,
    prefix: ""
  },

  onAdd: function (map) {
    this._container = L.DomUtil.create('div', 'leaflet-control-mouseposition');
    L.DomEvent.disableClickPropagation(this._container);
    map.on('mousemove', this._onMouseMove, this);
    this._container.innerHTML=this.options.emptyString;
    return this._container;
  },

  onRemove: function (map) {
    map.off('mousemove', this._onMouseMove);
  },

  _onMouseHover: function () {
    var info = this._hoverInfo;
    this._hoverInfo = undefined;
    this.options.elevGetter(info).then(function(elevStr) {
       if (this._hoverInfo) return; // a new _hoverInfo was created => mouse has moved meanwhile
       this._container.innerHTML = this.options.prefix + ' ' + elevStr + ' ' + this._latLngValue;
    }.bind(this));
  },

  _onMouseMove: function (e) {
    var w = e.latlng.wrap();
    lng = this.options.lngFormatter ? this.options.lngFormatter(w.lng) : L.Util.formatNum(w.lng, this.options.numDigits);
    lat = this.options.latFormatter ? this.options.latFormatter(w.lat) : L.Util.formatNum(w.lat, this.options.numDigits);
    this._latLngValue = this.options.lngFirst ? lng + this.options.separator + lat : lat + this.options.separator + lng;
    if (this.options.elevGetter) {
        if (this._hoverInfo) window.clearTimeout(this._hoverInfo.timeout);
        this._hoverInfo = {
            lat: w.lat,
            lng: w.lng,
            timeout: window.setTimeout(this._onMouseHover.bind(this), 400)
        };
    }
    this._container.innerHTML = this.options.prefix + ' ' + this._latLngValue;
  }

});

L.Map.mergeOptions({
    positionControl: false
});

L.Map.addInitHook(function () {
    if (this.options.positionControl) {
        this.positionControl = new L.Control.MousePosition();
        this.addControl(this.positionControl);
    }
});

L.control.mousePosition = function (options) {
    return new L.Control.MousePosition(options);
};
