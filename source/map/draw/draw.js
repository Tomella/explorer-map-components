/*!
 * Copyright 2015 Geoscience Australia (http://www.ga.gov.au/copyright.html)
 */

(function(angular){
'use strict';

angular.module("geo.draw", ['geo.map'])

.directive("geoDraw", ['$log', '$rootScope', 'drawService', function($log, $rootScope, drawService) {
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


			drawService.createControl(scope);
		}
	};
}])

.factory("drawService", ['$q', '$rootScope', 'mapService', function($q, $rootScope, mapService) {
	var drawControl,
		drawer,
		featureGroup,
		rectangleDeferred;

	return {
		createControl : function(parameters) {
			if(drawControl) {
				$q.when(drawControl);
			}

			return mapService.getMap().then(function(map) {
				var drawnItems = new L.FeatureGroup(),
				    options = {
				       edit: {
				          featureGroup: drawnItems
				       }
				    };

				if(parameters.data) {
					angular.extend(options, parameters.data);
				}

				featureGroup = parameters.drawnItems = drawnItems;

				map.addLayer(drawnItems);
				// Initialise the draw control and pass it the FeatureGroup of editable layers
				drawControl = new L.Control.Draw(options);
				map.addControl(drawControl);
				map.on("draw:created", function(event) {
					({
						polyline : function() {
							var data = {length:event.layer.getLength(), geometry:event.layer.getLatLngs()};
							$rootScope.$broadcast(parameters.lineEvent, data);
						},
						// With rectangles only one can be drawn at a time.
						rectangle : function() {
							var data = {bounds:event.layer.getBounds()};
							rectangleDeferred.resolve(data);
							rectangleDeferred = null;
							$rootScope.$broadcast(parameters.rectangleEvent, data);
						}
					})[event.layerType]();
				});

				return drawControl;
			});
		},

		cancelDrawRectangle : function() {
			if(rectangleDeferred) {
				rectangleDeferred.reject();
				rectangleDeferred = null;
				if(drawer) {
					drawer.disable();
				}
			}
		},

		drawRectangle : function() {
			this.cancelDrawRectangle();
			rectangleDeferred = $q.defer();
			if(drawer) {
				drawer.enable();
			} else {
				mapService.getMap().then(function(map) {
					drawer = new L.Draw.Rectangle(map, drawControl.options.polyline);
					drawer.enable();
				});
			}
			return rectangleDeferred.promise;
		}
	};
}]);

})(angular);