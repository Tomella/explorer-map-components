/*!
 * Copyright 2015 Geoscience Australia (http://www.ga.gov.au/copyright.html)
 */
(function(angular, L){
	
'use strict';

angular.module("geo.draw", ['geo.map'])

.directive("geoDraw", ['$log', '$rootScope', 'mapService', function($log, $rootScope, mapService) {
	var DEFAULTS = {
		rectangleEvent : "geo.draw.rectangle.created",
		lineEvent : "geo.draw.line.created"
	};
	
	
	return {
		restrict : "AE",
		scope : {
			data: "=",
			rectangleEvent : "@",
			lineEvent : "@"
		},
		link : function(scope, element, attrs, ctrl) {
			angular.forEach(DEFAULTS, function(value, key) {
				if(!scope[key]) {
					scope[key] = value;
				}
			});
						
			mapService.getMap().then(function(map) {
				var drawnItems = new L.FeatureGroup(),
				    drawControl,
				    options = { 
				       edit: {
				          featureGroup: drawnItems
				       }
				    };
	
				if(scope.data) {
					angular.extend(options, scope.data);
				}				
				scope.drawnItems = drawnItems;
				
				map.addLayer(drawnItems);
				// Initialise the draw control and pass it the FeatureGroup of editable layers
				drawControl = new L.Control.Draw(options);
				map.addControl(drawControl);
				map.on("draw:created", function(event) {
					scope.$apply(function() {
						({
							polyline : function() {
								var data = {length:event.layer.getLength(), geometry:event.layer.getLatLngs()};
								$rootScope.$broadcast(scope.lineEvent, data);
							},
							rectangle : function() {
								$log.info("rect");
							}
						})[event.layerType]();
					});
				});					
			});
		}
	};
}]);

})(angular, L);