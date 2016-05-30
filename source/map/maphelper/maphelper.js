/*!
 * Copyright 2015 Geoscience Australia (http://www.ga.gov.au/copyright.html)
 */

(function (angular, window, L) {

'use strict';


angular.module('geo.maphelper', ['geo.map'])

.factory("mapHelper", ["mapService", "$timeout", "$q", "$rootScope", "flashService",
                       function(mapService, $timeout, $q, $rootScope, flashService){
    var gridLayer, homeBounds = [[-47, 107],[-9, 156]];
    mapService.getMap().then(function(map) {
        gridLayer = mapService.getGridLayer();
        homeBounds = map.getBounds();
    });

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
        zoomToBounds:function(bounds){
            mapService.getMap().then(function(map) {
                map.fitBounds(bounds, {animate:true});
            });
        },
        takeMeHomeCountryRoads:function(){
            mapService.getMap().then(function(map) {
                map.fitBounds(homeBounds, {animate:true});
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
            if (gridLayer) mapService.getMap().then(function(map) {
                if (show)
                    gridLayer.addTo(map);
                else
                    map.removeLayer(gridLayer);
            });
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
		map.on("moveend", function(event) {
			$timeout.cancel(helper.timeout);
			helper.timeout = $timeout(function() {
				$rootScope.$broadcast("extentOfInterestChanged", map);
			}, helper.timoutPeriod);
		});
	});
	
	
	return helper;
}]);

})(angular, window, L);