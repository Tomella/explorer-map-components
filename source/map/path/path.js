/*!
 * Copyright 2015 Geoscience Australia (http://www.ga.gov.au/copyright.html)
 */

(function(angular, L) {

'use strict';

angular.module("geo.path", ['geo.map', 'explorer.config', 'explorer.flasher', 'explorer.message'])

.directive("geoPath", ['mapService', 'pathService', '$rootScope', 'flashService', 'messageService', 'configService', '$timeout', '$q',
                              function(mapService, pathService, $rootScope, flashService, messageService, configService, $timeout, $q) {
	var KEY = "distance",
		plotter;
	
	return {
		controller:['$scope', function($scope) {
			$scope.name = "PATH";
			
		}],
		link :function(scope, element, attrs) {
			scope.distanceMeasure = {
					distance:"-"
			};
			
			
			// Set up some methods to get data
			scope.showElevation = function() {
				var points = plotter.getLatLngs();
				
				
				var geometry = mapService.getDistanceGeometry(),
					distance = geometry.clone().transform(EPSG3857, EPSG4326).getGeodesicLength();

				scope.disable();
				pathService.triggerElevationPlot({length:distance, geometry:geometry});
			};
			
			scope.disable = function() {
				scope.item = "";
				closeHandler();
			};
			
			scope.$watch("item", function(newValue, oldValue) {
				if(newValue == KEY) {
					flashService.add("Click on map to start a path or add next point. Double click to end path.", 4000);
					mapService.getMap().then(function(map) {
						plotter = L.Polyline.Plotter([], {weight:4});
						plotter.addTo(map);
					});
				} else if(oldValue == KEY) {
					closeHandler();					
				}
			});
			
			function closeHandler() {
				mapService.getMap().then(function(map) {
					map.removeLayer(plotter);
				});
			}
		}
	};
}])

.factory("pathService", ['$rootScope', function($rootScope) {
	return {
		triggerElevationPlot : function(data) {
			$rootScope.$broadcast("elevation.plot.data", data);
		}
	};
}])

.filter('length', ['$filter', function($filter) {
	// Nice representation of length for the UI.
	var map = {units: "m", threshold: 100000, aboveThresholdUnits: "km", divideBy: 1000};

	return function(length, free) {
		var units, buffer;
		
		if(!length && length !== 0) {
			return null;
		}
		
		if(map.threshold && length > map.threshold) {
			length = length / map.divideBy;
			units = map.aboveThresholdUnits;
		} else {
			units = map.units;
		}
		
		buffer = $filter("number")(length, 0) + " " + units;
		if(free) {
			return buffer;
		}
		return "(" + buffer + ")";
	};
}]);


})(angular, L);