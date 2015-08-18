(function(L) {
	L.Polyline.prototype.getLength = function () {
        var total = 0,
        	coordinate = null;
        this._latlngs.forEach(function(latLng, index, latLngs) {
        	coordinate = latLng;
        	if(index) {
        		total += coordinate.distanceTo(latLngs[index - 1]);
        	}	
        });
        return total;
    };
})(L);