/*!
 * Copyright 2015 Geoscience Australia (http://www.ga.gov.au/copyright.html)
 */

(function (angular, window, L) {

'use strict';


angular.module('geo.maphelper', ['geo.map'])

.factory("mapHelper", ["mapService", "$timeout", "$q", "$rootScope", "flashService",
                       function(mapService, $timeout, $q, $rootScope, flashService){

	var  helper = { 
		timeoutPeriod: 200, 
		timeout : null,
		callbacks:{}, 
		checkMarkers:function(){},
		zoomToMarkPoints:function(results, marker){
            console.log("zooming to  " + results[0]);
			mapService.getMap().then(function(map) {
                console.log("really zooming to  " + results[0]);
				map.setView(results[0], 12, {animate:true});
			});
		}, 
		zoomToLonLats:function(mapService){},
        zoomToBounds:function(bounds){
            mapService.getMap().then(function(map) {
                map.setView(results[0], 12, {animate:true});
            });
        },
        zoomOut:function(factor){
            mapService.getMap().then(function(map) {
                map.zoomOut(factor);
            });
        },
        addLayer:function(layer) {
            mapService.getMap().then(function(map) {
                layer.addTo(map);
            });
        },
        removeLayer:function(layer) {
            mapService.getMap().then(function(map) {
                map.removeLayer(layer);
            });
        },
        fireEvent:function(name, event) {
            mapService.getMap().then(function(map) {
                map.fireEvent(name, event);
            });
        },
        showGrid:function(show) {
            /// TODO
        },
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