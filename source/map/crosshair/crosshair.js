/*!
 * Copyright 2015 Geoscience Australia (http://www.ga.gov.au/copyright.html)
 */
(function(angular, L) {

'use strict';

angular.module("explorer.crosshair", ['geo.map'])

.factory('crosshairService', ['mapService', function(mapService) {
	var map, crosshair;
	
	mapService.getMap().then(function(olMap) { 
		map = olMap; 
	});
	
	return {		
		add : function(point) {
            this.move(point);
		},
		
		remove : function() {
			if(crosshair) {
				map.removeLayer(crosshair);
				crosshair = null; 
			}
		},
		
		move : function(point) {
			var size, icon;
			if(!point) {
				return;
			}
			this.remove();
			icon = L.icon({
			    iconUrl: 'resources/img/cursor-crosshair.png',
			    iconAnchor : [16, 16]
			});

	        crosshair = L.marker([point.y, point.x], {icon: icon});
	        crosshair.addTo(map);
	        return point;
		},
	};
}]);

})(angular, L);