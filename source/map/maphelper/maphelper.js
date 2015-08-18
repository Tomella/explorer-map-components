/*!
 * Copyright 2015 Geoscience Australia (http://www.ga.gov.au/copyright.html)
 */

(function (angular, window, L) {

'use strict';


angular.module('geo.maphelper', ['geo.map'])

.factory("mapHelper", ["mapService",  "$timeout", "$q", "$rootScope", "flashService", 
                       function(mapService,  $timeout, $q, $rootScope, flashService){
	var  helper = { 
		timeoutPeriod: 200, 
		timeout : null,
		callbacks:{}, 
		checkMarkers:function(){}, 
		zoomToMarkPoints:function(results, marker){
			mapService.getMap().then(function(map) {
				map.setView(results[0], 12, {animate:true});
			});
		}, 
		zoomToLonLats:function(mapService){},
		markPoint:function(mapService){},
		getPseudoBaseLayer:function(){
			return mapService.getMap().then(function(map) {
				var response = null;
				map.eachLayer(function(layer) {
					if(layer.pseudoBaseLayer) {
						response = layer;
					}
				});
				return response;
			});
			
		},
		subscribe:function(name, func)	{	
			if (!this.callbacks[name]) this.callbacks[name]={ subscribers:[] };
			this.callbacks[name].subscribers.push(func);
        },
		pubChangeBaseLayerBias:function(mapService){},
		getExtentWkt:function(){
			return mapService.getMap().then(function(map) {
				return Exp.Util.boundsToWktPoly(map.getBounds());
			});
		},
		decorateWfsLayer:function(mapService){}
	};
	
	mapService.getMap().then(function(map) {
		map.on("moveend", handleChange);
		function handleChange(event) {
			$timeout.cancel(helper.timeout);
			helper.timeout = $timeout(function() {
				$rootScope.$broadcast("extentOfInterestChanged", map);
			}, helper.timoutPeriod);
		}
	});
	
	
	return helper;
}]);

})(angular, window, L);