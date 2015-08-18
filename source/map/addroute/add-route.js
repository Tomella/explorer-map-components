/*!
 * Copyright 2015 Geoscience Australia (http://www.ga.gov.au/copyright.html)
 */
(function(angular) {

'use strict';

/**
 * @ngdoc object
 * @name fairways.add.route
 * @description
 *
 * The fairways add route module is a coase grained module for managing the complete life cycle of user input routes.
 * That includes creating them, storing them, retrieving them and showing them. It also broadcasts the "elevation.plot.data"
 * event on the rootscope with the geometry of a selected path so that if there is a listener that it can be acted on.
 */
angular.module('fairways.add.route', ['openLayers.service', 'explorer.persist', 'explorer.flasher', 'explorer.config'])

/**
* @ngdoc directive
* @name fairwaysRoutes
* @restrict AE
*
* @description
* The fairways route directive is the root directive for the module and it displays a modal or popup that allows the
* user to interact with the module. It hooks intp the map service to display the routes and allows the capture of events 
* for user interaction such as the firing an event to view the path's elevation.
*/
.directive("fairwaysRoutes", ['$timeout', 'mapService', 'flashService', 'routeService', 
                      function($timeout, mapService, flashService, routeService){
	var KEY = "manageRoutes",
		addRouteTemplate = {
			type : "ROAD",
			name : "",
			description : "",
			wkt : ""
		};
	
	return {
		templateUrl : 'components/addroute/routeManager.html',
		restrict : "AE",
		scope : {
			item : "="
		},
		link : function(scope, element, attrs) {
			scope.distanceMeasure = {
					distance:"-"
			};
			

			routeService.getConfig().then(function(config) {
				scope.types = {};
				config.routeTypes.forEach(function(type) {
					scope.types[type.code] = type.title;
				});
			});
						
			routeService.getRoutes().then(function(routes){
				if(routes) {
					routes.forEach(function(route){
						routeService.addToMap(route);
					});
					scope.routes = routes;
				} else {
					scope.routes = [];
				}
			});

			scope.showAddRoute = function() {
				scope.addRoute = true;
				scope.newRoute = Object.create(addRouteTemplate);
				
				flashService.add("Click on map to start a path or add next point. Double click to end path.", 4000);
				mapService.showDistance(null, {endOnDblClick:true, geometry:scope.lastGeometry}, function(value, complete) {
					scope.$apply(function() {
						if(complete) {
							// Arrgghh! Arbitrary timeout for OpenLayers. It says complete even though it hasn't added the last point
							// This gives it time to add the last point.
							$timeout(scope.setWkt, 100);
						}
						scope.distanceMeasure.distance = value?value:"-";
						
					});
				});	
			};
			
			scope.showElevation = function() {
				routeService.showElevation(this.route.layer);
			};
			
			scope.panToVector = function() {
				routeService.panTo(this.route.layer);
			};

			scope.mouseenter = function() {
				routeService.overFeatures(this.route);
			};
			
			scope.mouseleave = function() {
				routeService.outFeatures(this.route);
			};
			
		},
		
		controller : ['$scope', function AddRouteController($scope) {
			
			$scope.setWkt = function() {
				var geometry = mapService.getDistanceGeometry();
				
				$scope.newRoute.wkt = new OpenLayers.Format.WKT().write(new OpenLayers.Feature.Vector(geometry));
			};
			
			$scope.toggleRoute = function() {
				this.route.showing = routeService.toggleRoute(this.route.layer);
			};

			$scope.removeRoute = function() {
				var index = this.routes.indexOf(this.route);
				
				routeService.removeRoute(this.route);
				this.routes.splice(index, 1);
				routeService.saveRoutes(this.routes);	
			};
			
			$scope.cancelRoute = function() {
				$scope.addRoute = false;
			};
			
			$scope.saveRoute = function() {
				routeService.removeDrawTool();
				$scope.addRoute = false;
				$scope.routes.push($scope.newRoute);
				routeService.saveRoutes($scope.routes);	
				flashService.add("Succesfully added route to collection");
				routeService.addToMap($scope.newRoute);
			};
		}]
	};
}])

/**
* @ngdoc object
* @name routeService
*
* @description
* The fairways route servcie is sadly a highly coupled service due to the extent of concerns.
* It adds the paths to the map.
* Manages the path drawing tool.
* It needs to download some configuration.
* It saves and restores routes to the persistence tier. (When the WFS-T service is provided this will change.)
* Broad casts the "elevation.plot.data" event if the leevation button is clicked with relevant information.
* Controls the bound checking of the tool to stop users getting over zealous with their selection.
* 
*/
.factory("routeService", ['$q', '$rootScope', 'mapService', 'persistService', 'configService', function($q, $rootScope, mapService, persistService, configService) {
	var layers = {},
		defaultStyleParameters = {
			stroke : true,
			strokeColor : "#000000",
			strokeDashstyle : "4 4",
			strokeOpacity : 0.7,
			strokeWidth : 1.5
		},
		control;
	
	return {
		addToMap : function(route) {
			$q.all([this.getConfig(), mapService.getMap()]).then(function(configMap) {
				var map = configMap[1], config = configMap[0],
					vector,
					features = new OpenLayers.Format.WKT().read(route.wkt),
					styles, styleParameters;
				
				// .some returns true if it matches so if we get false use a default.
				if(!config.routeTypes.some(function(type) {
						var response = route.type == type.code;
						if(response) {
							styleParameters = type.lineStyle;
						}
						return response;
					})) {
					styleParameters = defaultStyleParameters;
				}			
					
				styles = new OpenLayers.StyleMap({
					"default": new OpenLayers.Style(styleParameters)
				});
				vector = new OpenLayers.Layer.Vector("Your route: " + route.name, {styleMap: styles});
				
				features = angular.isArray(features)?features:[features];
				vector.addFeatures(features);

				route.control = new OpenLayers.Control.SelectFeature(
		              vector, {
		                    hover : true,
		                    highlightOnly : true,
		                    clickOut : false,
		                    toggle : true,
		                    renderIntent : "temporary",
		                    eventListeners : {
		                     //   beforefeaturehighlighted : this.report,
		                     //   featurehighlighted : this.over,
		                     //   featureunhighlighted : this.out
		                    }
		                });
				route.layer = vector;
			});
		},
		
		removeDrawTool : function() {
			mapService.hideDistance();
		},
		
		removeRoute : function(route) {
			var vector = route.layer;
			if(vector.map) {
				vector.map.removeLayer(vector);
			}
			vector.destroy();
		},
		
		toggleRoute : function(vector) {
			var showing = !!vector.map;
			
			if(showing) {
				vector.map.removeLayer(vector);
			} else {
				mapService.getMap().then(function(map) {
					map.addLayers([vector]);
				});
			}
			// We've toggled it
			return !showing;
		},
		
		getConfig : function() {
			return configService.getConfig();
		},
		
		getRoutes : function() {
			return persistService.getItem("fwsRoutes");
		},
		
		saveRoutes : function(routes) {
			persistService.setItem("fwsRoutes", reduceRoutes(routes));
			
			function reduceRoutes(routes) {
				var response = [];
				routes.forEach(function(route) {
					response.push({
						type : route.type,
						name : route.name,
						description : route.description,
						wkt : route.wkt						
					});
				});
				return response;
			}
		},
		
		showElevation : function(vector, feature) {
			if(!feature) {
				feature = vector.features[0];
			}
			var geometry = feature.geometry, 
				distance = geometry.clone().transform(new OpenLayers.Projection("EPSG:3857"), new OpenLayers.Projection("EPSG:4326")).getGeodesicLength(),
				data = {length:distance, geometry:geometry, heading:"KML"};
			
			$rootScope.$broadcast("elevation.plot.data", data);
		},	
		
		overFeatures : function(route) {
			var layer, 
				features = route.layer.features;
			
			
			if(!features) {
				return;
			}
			layer = features[0].layer;
			if(layer) {
				layer.removeFeatures(features);
				layer.addFeatures(features);
				features.forEach(function(feature) {
					route.control.overFeature(feature);
				});
			}
		},
		
		outFeatures : function(route) {
			var features = route.layer.features;
			if(!features) {
				return;
			}
			
			features.forEach(function(feature) {
				if(feature.layer) {
					route.control.outFeature(feature);
				}
			}); 
			
		},	
		
		panTo : function(layer) {
			var bounds = this._boundsPlusPercent(layer.getDataExtent(), 0.2);
			mapService.getMap().then(function(map) {
				map.zoomToExtent(bounds);
			});
		},
		
		_boundsPlusPercent : function(bounds, bufferPercent) {
			var xBuff = (bounds.right - bounds.left) * bufferPercent,
				yBuff = (bounds.top - bounds.bottom) * bufferPercent;
			
			return new OpenLayers.Bounds(
						bounds.left - xBuff,
						bounds.bottom - yBuff,
						bounds.right + xBuff,
						bounds.top + yBuff
					);
		}		
	};
}]);

})(angular);