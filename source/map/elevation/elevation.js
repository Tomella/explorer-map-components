/*!
 * Copyright 2015 Geoscience Australia (http://www.ga.gov.au/copyright.html)
 */
/**
 * This version relies on 0.0.4+ of explorer-path-server as it uses the URL for intersection on the artesian basin plus the actual KML
 */
(function(angular, Exp, L) {
'use strict';

angular.module("geo.elevation", [
                                  'graph',
                                  'explorer.crosshair',
                                  'explorer.flasher',
                                  'explorer.feature.summary',
                                  'geo.map',
                                  'geo.path'])

.directive("pathElevationPlot", ['$log', '$timeout', '$rootScope','$filter', 'elevationService', 'crosshairService',   'featureSummaryService',
             function($log, $timeout, $rootScope, $filter, elevationService, crosshairService, featureSummaryService) {
	var WIDTH = 1000,
		HEIGHT = 90,
		elevationStyle = {
			fill:"orange",
			fillOpacity : 0.4,
			stroke : "darkred",
			strokeWidth : 1.5
		},
		waterTableStyle = {
			fill:"lightblue",
			fillOpacity:0.8,
			stroke:"darkblue",
			strokeWidth : 1.5
		},
		infoLoading = '<span><img alt="Waiting..." src="resources/img/tinyloader.gif" ng-show="message.spinner" style="position:relative;top:2px;" width="12"></img></span>';	
	
	return {
		templateUrl : "map/elevation/elevation.html",
		scope:true,
		controller : ['$scope', function($scope) {
			$scope.paths = [];
			$scope.config = {
					yLabel : "Elevation (m)",
					xLabel : "Distance: 3000m"
			};
			
			$rootScope.$on("elevation.plot.data", function(event, data) {
				$scope.length = data.length;
				$scope.geometry = data.geometry;
				$scope.config.xLabel = "Distance: " + $filter("length")(data.length);
				$scope.waterTable = null;
			
				if($scope.length && $scope.geometry) {
					elevationService.getElevation($scope.geometry, $scope.length).then(function(elevation) {
						// Keep a handle on it as we will generally build a collection after the first build
						$scope.elevation = {
								style: elevationStyle,
								data: elevation
						};
						// Show the range.
						$scope.config.leftText = "Elevation Range: " + 
							$filter("length")(d3.min(elevation, function(d) { return d.z; }), true) + " to " + 
							$filter("length")(d3.max(elevation, function(d) { return d.z; }), true);
					
						// If we got here we always want to wipe out existing paths.						
						$scope.paths = [$scope.elevation];
					});

					elevationService.intersectsWaterTable($scope.geometry).then(function(intersects) {
						$scope.intersectsWaterTable = intersects;
					});
				}
			});	
		
			$scope.getInfoText = function() {
				if(!$scope.infoText) {
					$scope.infoText = infoLoading;
					elevationService.getInfoText().then(function(html) {
						$scope.infoText = html;
					});
				}
			};
			
			$scope.toggleWaterTable = function() {
				var length = $scope.paths.length;
				// We have to clear the paths so that it re-renders from scratch.
				$scope.paths = [];
				// Then we re-render on the next animation frame.
				if($scope.waterTable) {
					$timeout(function() {
						if(length == 1) {
							$scope.paths = [$scope.elevation, $scope.waterTable];
						} else {
							$scope.paths = [$scope.elevation];
						}
					});
				} else {
					elevationService.getWaterTable($scope.geometry, $scope.length).then(function(waterTable) {
						$scope.waterTable = {
								style : waterTableStyle,
								data : waterTable
						};
						$scope.paths = [$scope.elevation, $scope.waterTable];							
					});
				}
			};

			$scope.close = function() {
				$scope.paths = $scope.geometry = $scope.length = null;
			};
		}],

		link : function(scope, element) {				
			scope.graphClick = function(event) {
				if(event.position) {
					var point = event.position.points[0].point;
					elevationService.panToPoint(point);
					scope.point = point;
				}				
			};

			scope.graphLeave = function(event) {
				scope.position = null;
				crosshairService.remove();
				cancelDeferredView();
				$log.debug("Mouse left");
				if(scope.mapListener) {
					$log.info("offMapMove");
					featureSummaryService.offMapMove(scope.mapListener);
				}
			};

			scope.graphEnter = function(event) {
				$log.debug("Graph be entered");
			};

			scope.graphMove = function(event) {
				var point;
				
				scope.position = event.position;
				
				if(scope.position) {
					point = scope.position.point;
					scope.position.markerLonlat = crosshairService.move(point);
					deferredView();
				}
				if(!scope.mapListener) {
					scope.mapListener = function() {
						cancelDeferredView();
						deferredView();
					};
					$log.info("onMapMove");
					featureSummaryService.onMapMove(scope.mapListener);
				}
				$log.debug("Mouse moving...");
			};

			scope.$watch("geometry", processGeometry);
			
			function processGeometry() {
				if(scope.line) {
					scope.line = elevationService.pathHide(scope.line);
				}
				if(scope.geometry) {
					scope.line = elevationService.pathShow(scope.geometry);
				} else {
					elevationService.hideWaterTable();
				}
			
			}
			
			function deferredView() {
				$log.info("Deferred view");
				featureSummaryService.deferView(scope.position).then(function(data) {
					scope.featuresUnderPoint = data;
				});
			}
			
			function cancelDeferredView() {
				$log.info("Cancel deferred view");
				featureSummaryService.cancelView();
				scope.featuresUnderPoint = null;
			}
		}
	};
}])

.directive('marsInfoElevation', ['$log', 'elevationService', function($log, elevationService){
	return {
		templateUrl:"map/elevation/elevationInfo.html",
		scope:true,
		link : function(scope, element) {
			scope.toggleWaterTableShowing = function() {
				scope.state = elevationService.getState();
				
				if(!elevationService.isWaterTableShowing()) {
					elevationService.showWaterTable();
				} else {
					elevationService.hideWaterTable();
				}
			};
		}
	};
}]) 

.provider("elevationService", function ConfigServiceProvider() {
	var pointCount = 500,
		elevationUrl = "service/path/elevation",
		waterTableUrl = "service/path/waterTable",
		artesianBasinKmlUrl = "service/artesianBasin/geometry/kml",
		intersectUrl = "service/artesianBasin/intersects",
		waterTableLayer = null,
		map,
		state = {
			isWaterTableShowing : false
		};
		
	this.setIntersectUrl = function(url) {
		intersectUrl = url;
	};

	this.setKmlUrl = function(url) {
		artesianBasinKmlUrl = url;
	};

	this.setElevationUrl = function(url) {
		elevationUrl = url;
	};

	this.setWaterTableUrl = function(url) {
		waterTableUrl = url;
	};
	
	this.$get = ['$log', '$http', '$q', 'mapService', 'flashService', function($log, $http, $q, mapService, flashService) {

		// We are safe doing this as it can't be triggered until the map is drawn anyway.
		mapService.getMap().then(function(olMap) {map = olMap;});

		var $elevation = {
			panToPoint : function(point) {
				mapService.zoomTo(point.y, point.x);
			},
	
			getState : function() {
				return state;
			},
			
			getElevation : function(geometry, distance) {
				var flasher = flashService.add("Retrieving elevation details...", 8000),
					wktStr = Exp.Util.toLineStringWkt(geometry);

				return $http.post(elevationUrl, {wkt:wktStr, count:pointCount, distance:distance}).then(function(response) {
					flashService.remove(flasher);
					return response.data;
				});	
			},
	
			intersectsWaterTable :function(geometry) {
				var url = intersectUrl + (intersectUrl.indexOf("?") > -1?"":"?wkt=");
				return $http.get(url + Exp.Util.toLineStringWkt(geometry), {cache:true}).then(function(response) {
					return response.data.intersects;
				});
			},
		
			isWaterTableShowing : function() {
                /* jshint -W093 */
				return state.isWaterTableShowing = waterTableLayer !== null;
			},
			
			showWaterTable : function() {
				if(!waterTableLayer) {
					this.getWaterTableLayer().then(function(layer) {
						layer.addTo(map);
					});
				}
				state.isWaterTableShowing = true;
			},
	
			hideWaterTable : function() {
				if(waterTableLayer) {
					map.removeLayer(waterTableLayer);
				}
				waterTableLayer = null;
				state.isWaterTableShowing = false;
			},
		
			createWaterTableLayer : function() {
				return mapService.getMap().then(function(map) {
					var kml = new L.KML(artesianBasinKmlUrl, {async: true});
				
					return kml.on("loaded", function(e) {
						waterTableLayer = e.target;
						return waterTableLayer;
					});				
				});			
			},
		
			getWaterTableLayer : function() {
				return this.createWaterTableLayer();
			},
	
			getWaterTable : function(geometry, distance) {
				var flasher = flashService.add("Retrieving water table details...", 8000),
					wktStr = Exp.Util.toLineStringWkt(geometry);

				return $http.post(waterTableUrl, {wkt:wktStr, count:pointCount, distance:distance}).then(function(response) {
					flashService.remove(flasher);
					return response.data;
				});
			},
	
			getInfoText : function() {
				return $http("map/elevation/elevationInfo.html", {cache : true}).then(function(response) {
					return response.data;
				});
			},
	
			pathShow : function(latlngs) {
				var lineLayer = L.polyline(latlngs, {color: 'black', weight:2}).addTo(map);
				return lineLayer;
			},
	
			pathHide : function(lineLayer) {
				map.removeLayer(lineLayer);
				return null;
			}		
		};
		
		return $elevation;
	}];
});

})(angular, Exp, L);