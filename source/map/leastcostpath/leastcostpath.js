/*!
 * Copyright 2015 Geoscience Australia (http://www.ga.gov.au/copyright.html)
 */

(function(angular, context) {
'use strict'; 

angular.module("explorer.least.cost.path", [
                  'openLayers.service', 
                  'explorer.config', 
                  'explorer.flasher', 
                  'explorer.persist', 
                  'explorer.message', 
                  'explorer.asynch'])

.directive("leastCostPathDraw", ['$log', 'lcpService', 'flashService', 'persistService', 'configService', 
                                 function($log, lcpService, flashService, persistService, configService) {
	return {
		templateUrl:'components/leastcostpath/draw.html',
		replace:true,
		restrict:"AE",
		scope: {
			item : "="
		},
		controller:['$scope', function($scope) {
			$scope.points = [];

			configService.getConfig().then(function(config){
				$scope.lcpExtent = config.leastCostPathExtent; 
			});
						
			$scope.remove = function() {
				var index = $scope.points.indexOf(this.point);
				if (index > -1) {
				    $scope.points.splice(index, 1);
				    lcpService.removePoint(this.point);
				}
			};
			
			$scope.pathComplete = function() {	
				$scope.item = "";
				$scope.pathGeometry = lcpService.getPathGeometry();				
				if($scope.lastResistanceCategories) {
					// This way we preserve the last entered weightings.
					$scope.resistanceCategories = $scope.lastResistanceCategories;
				} else {
					// Alternatively retrieve them from the service.
					lcpService.weightings().then(function(weightObj) {	
						// Merge in those from previous sessions.
						persistService.getItem("lcpWeightings").then(function(weightings) {
							if(weightings) {
								weightObj.forEach(function(category) {
									category.group.forEach(function(child) {
										var matched = weightings[child.key];
										if(matched || matched === 0) {
											child.value = matched.value;
											child.selected = matched.selected;
										}
									});
								});
							}
						});					
						$scope.resistanceCategories = weightObj;
					});
				}
			};	
			
			// Here is where we persist state..
			$scope.$watch("resistanceCategories", function(newValue, oldValue){
				if(oldValue) {
					$scope.lastResistanceCategories = oldValue;
					var savedKeys = {};
					oldValue.forEach(function(category) {
						category.group.forEach(function(child) {
							savedKeys[child.key] = {
								value :child.value,
								selected:child.selected
							};
						});
					});
					persistService.setItem("lcpWeightings", savedKeys);
				} else {
					$scope.item = "";
				}
			});	
		}],
		link:function(scope, element) {
			var lastOutOfBoundsFlash,
				tooLongFlash;
			
			scope.$watch("item", function(value, oldValue) {
				if(value == "leastCostPath") {
					scope.show = true;
					lcpService.activatePath(scope.lcpExtent).then(function(complete) {
						$log.debug("Complete");
					}, function(error) {
						$log.debug("Error");
					}, function(notify) {
						$log.debug("Notification type " + notify.type);
						if(notify.type == "maximumVertices") {
							maximumVertices();
						} else if(notify.type == "pointOutOfBounds") {
							flashService.remove(lastOutOfBoundsFlash);
							lastOutOfBoundsFlash = flashService.add("Point is out of area with data", 4000);
						} else if(notify.points) {
							scope.points = notify.points;
						}
						if("distance" in notify) {
							scope.distance = notify.distance;
							flashService.remove(tooLongFlash);
							if(notify.distance > 300000) {
								tooLongFlash = flashService.add("Reduce the length of your path. A limit of 300km applies.", 12000);
							}
						}
					});
					
				} else if(oldValue == "leastCostPath"){
					scope.show = false;
					scope.points = [];
					lcpService.deactivateAll();
				}
			});
					
			function maximumVertices(points) {
				// There is no $apply because there is always another update in this digest that takes care of re-rendering.
				flashService.add("The maximum 4 way points have been added to the path.", 4500);
				scope.points = points;
			}
		}		
	};
}])

.directive("marsLeastCostWeightings", ['$log', '$modal', 'lcpService', 'configService', 'messageService', function($log, $modal, lcpService, configService, messageService) {
	return {
		scope: {
			weightings : "=",
			pathGeometry : "="
		},
		controller:[function() {
			
		}],
		link:function(scope, element, attrs) {
			var modalInstance;
			
			scope.$watch("weightings", function(newValue, oldValue) {
				if(newValue) {
					
					modalInstance = $modal.open({
						templateUrl : "components/leastcostpath/leastCostWeightings.html?v=5",
						size:"md",
						controller : ['$scope', '$modalInstance', 'weightings', 'pathGeometry', function($scope, $modalInstance, weightings, pathGeometry) {
							$scope.weightings = weightings;
							$scope.pathGeometry = pathGeometry;
							
							// Show the panel
							lcpService.showInterimPath(pathGeometry);
							determineBufferRange();
							
							$scope.close = function() {
								$scope.weightings = null;
							};
								
							configService.getConfig().then(function(config) {
								$scope.maxExtent = config.leastCostPathExtent;
							});
								
							$scope.cancelLeastCostPath = function() {
								$scope.weightings = null;
								lcpService.removeInterimPath();
								$modalInstance.dismiss(null);
							};
								
							$scope.showLeastCostPath = function(event) {
								event.stopPropagation();
								$modalInstance.close($scope.bufferPercent);
							};	

							function determineBufferRange() {	
								configService.getConfig().then(function(config) {
									var bounds = $scope.pathGeometry.clone().transform(new OpenLayers.Projection("EPSG:3857"), new OpenLayers.Projection("EPSG:4326")).getBounds(),
										bufferValues = {"0":0},
										bufferPercent = "0",
										maxExtent = config.leastCostPathExtent,
										inBounds = checkBounds(bounds, maxExtent),
										restrictionMessage = null;
									
									if(inBounds(0.1)) {
										bufferValues["0.1"] = 10;
										bufferPercent = "0.1";
										
										if(inBounds(0.25)) {
											bufferValues["0.25"] = 25;
											bufferPercent = "0.25";
											
											if(inBounds(0.5)) {
												bufferValues["0.5"] = 50;
												bufferPercent = "0.25";
											} else {
												restrictionMessage = "Can not buffer extent by more than 25% as it would exceed the extent of our data";
											}
										} else {
											restrictionMessage = "Can not buffer extent by more than 10% as it would exceed the extent of our data";
										}
									} else {
										restrictionMessage = "Extent buffering restricted to line extent due to lack of data";
									}
									
									$scope.bufferValues = bufferValues; 		// {"0":0, "0.1":10, "0.25":25, "0.50":50};		
									$scope.bufferPercent = bufferPercent; 	// "0.25";
									if(restrictionMessage) {
										messageService.info(restrictionMessage);
									}
								});
								
								function checkBounds(bounds, maxExtent) {
									return function(bufferPercent) {
										var xBuff = (bounds.right - bounds.left) * bufferPercent,
											yBuff = (bounds.top - bounds.bottom) * bufferPercent,
											buff  = xBuff > yBuff? xBuff : yBuff,
											left = bounds.left - buff,
											right = bounds.right + buff,
											bottom = bounds.bottom - buff,
											top = bounds.top + buff;
											
										return maxExtent.top > top &&
											maxExtent.left < left &&
											maxExtent.right > right &&
											maxExtent.bottom < bottom;						
									};
								}	
							}
						}],
						resolve: {
							weightings : function() {
								return scope.weightings;
							},
							pathGeometry : function() {
								return scope.pathGeometry;
							}
						}
					});
					
				    modalInstance.result.then(function (bufferPercent) {
				    	processSelections(scope.weightings, bufferPercent);
				    	closed();
				    }, function () {
				    	closed();
				    });
					
				}
				
				function processSelections(selectedWeightings, bufferPercent) {
					var geometry = scope.pathGeometry, 
						distance = geometry.clone().transform(new OpenLayers.Projection("EPSG:3857"), new OpenLayers.Projection("EPSG:4326")).getGeodesicLength(),
						weightings = {};

					// Normalise what we send the service. It doesn't need know about our structure.
					selectedWeightings.forEach(function(resistance) {
						resistance.group.forEach(function(item) {
							weightings[item.key] = item;
						});
					});
					lcpService.getLeastCostPath(geometry, weightings, (bufferPercent === 0 || bufferPercent?bufferPercent:0.25)).then(function(response) {
						var results = lcpService.results();
						if(response && (response.jobName == "displayMessage" || response.error)) {
							if(!response.text) {
								response.text = response.details;
							}
							failed(response);
							scope.leastCostPath = null;
						} else {
							window.scoopla = scope;
							results.data = response.data;
							results.data.geometry = geometry;
							results.distance = distance;
							results.data.timeStamp = Date.now();
						}
						lcpService.removeInterimPath();
					}, failed);	
				}
				
			});
			
			function failed(message) {
				messageService.error(message.text);
			}
			
			function closed() {
				scope.weightings = null;
			}
		}
	};
}])

.directive("marsLeastCostPathDisplay", ['$log', 'lcpService', '$filter', function($log, lcpService, $filter) {
	return {
		templateUrl : "components/leastcostpath/leastCostDisplay.html?v=2",
		restrict:"AE",
		controller : ['$scope', function($scope) {
			$scope.results = lcpService.results();
			
			$scope.urls = {};
			
			$scope.$watch("results.data", function() {
				if($scope.results.data) {
					// Clear showing flags.
					$scope.lcpKmlShown = $scope.lcpBufferKmlShown = $scope.pathShown = $scope.costSurfaceShown = false;
					angular.forEach($scope.results.data.results, function(value, key) {
						lcpService.getResourceUrl($scope.results.data.jobId, key).then(function(url) {
							$scope.urls[key] = url;
							if(key == "lcpKml") {
								$scope.lcpKmlShown = true;
								lcpService.showPathKml(url);
							} else if(key == "lcpCorridorKml") {
								$scope.lcpBufferKmlShown = true;
								lcpService.showBufferKml(url);
							}
						});
					});
				}
			});
			
			$scope.clear = function() {
				$scope.results.data = $scope.results.distance = null;
			};
			
			$scope.stringify = function(what) {
				if(what) {
					return JSON.stringify(what);
				}
			};
			
			$scope.bringToTop = function() {
				lcpService.bringToTop();
			};
			
			$scope.zoomToCentre = function() {
				lcpService.zoomToBufferlLayer();
			};
			
			$scope.toggleLcpKml = function() {
				$scope.lcpKmlShown = lcpService.togglePathKml($scope.urls.lcpKml);
				$log.debug("Showing path from KML");
			};
			
			$scope.toggleLcpBufferKml = function() {
				$scope.lcpBufferKmlShown = lcpService.toggleBufferKml($scope.urls.lcpCorridorKml);
				$log.debug("Showing buffer from KML");
			};
			
			$scope.togglePath = function() {
				$scope.pathShown = lcpService.toggleLcpSourcePath($scope.results.data.geometry, "Least cost path elevation plot");
			};
			
			$scope.elevationLcpKml = function() {
				lcpService.elevationLcpKml();
				$log.debug("Showing path from KML");
			};
			
			$scope.elevationPath = function(label) {
				lcpService.elevationPath($scope.results.data.geometry, "Elevation plot of original path for least cost path");
			};
			
			$scope.mouseenterPathBuffers = function() {
				$log.debug("mouse enter path buffers");
			};
			
			$scope.mouseleavePathBuffers = function() {
				$log.debug("mouse leave Path Buffers");
			};
			
			$scope.mouseenterCostSurface = function() {
				$log.debug("mouse enter cost surface");
			};
			
			$scope.mouseleaveCostSurface = function() {
				$log.debug("mouse leave cost surface");
			};
			
			$scope.toggleCostSurface = function() {
				$scope.costSurfaceShown = lcpService.toggleCostSurface({
					outline: $scope.urls.fullSegExtKml,
					image: $scope.urls.png,
					extent: $scope.urls.csExtKml
				});
			};
		}],
		link : function(scope, element, attrs) {
			scope.$watch("results.distance", function(newValue, oldValue) {
				if(newValue) {
					scope.pathShown = true;
					lcpService.showLcpSourcePath(scope.results.data.geometry);
				} else if(oldValue) {
					lcpService.removePathKml();
					lcpService.removeBufferKml();
					lcpService.removeLcpSourcePath();
					lcpService.removePathBuffers();
					lcpService.removeCostSurface();
				}				
			});
		}
	};
}])

.directive("pathLeastCostSlider", [function() {
	return {
		template : '<slider min="0" max="1" step="0.1" ng-model="weighting.value" updateevent="slideStop" ng-disabled="!weighting.selected" ui-tooltip="hide"></slider>',
		link : function(scope, element) {}
	};
}])

.factory('lcpService', ['$log', '$q', '$http', '$timeout', '$rootScope', 'asynch', 'mapService', 'flashService', 
                        function($log, $q, $http, $timeout, $rootScope, asynch, mapService, flashService) {
	var lineControl, vector, modifyControl, lastCount = 0;
	
	var leastCostPathJob = "leastCostPath",
		layers = {
		 	pathBuffersKmlLayer:null,
			imageLayer:null,
			bufferKmlLayer:null,
			lcpSourcePath:null,
			pathKmlLayer:null
		},
		layerIndexes = [
			"pathBuffersKmlLayer",
			"imageLayer",
			"bufferKmlLayer",
			"lcpSourcePath",
			"pathKmlLayer"
		],
		bufferExtent = null,
		notificationFlash = null,
		interimPath,
		wayPoints,
		wpMarker,
		lcpResults = {
			data: null,
			distance:null
		};
	
	return {
		results : function() {
			return lcpResults;
		},
		
		triggerElevationPlot : function(data) {
			$rootScope.$broadcast("elevation.plot.data", data);
		},
		elevationPath : function(geometry, label) {
			var distance = geometry.clone().transform(new OpenLayers.Projection("EPSG:3857"), new OpenLayers.Projection("EPSG:4326")).getGeodesicLength();
			this.triggerElevationPlot({length:distance, geometry:geometry, heading:label});
		},
		
		elevationLcpKml : function() {
			// Sadly the KML comes in as multiple lines so we have to merge them as sadly the service we call does not handle multiple lines.
			var points = [], line, distance;
			layers.pathKmlLayer.features.forEach(function(feature) {
				points = feature.geometry.getVertices().concat(points);
			});
			
			line = new OpenLayers.Geometry.LineString(points);			
			distance = line.clone().transform(new OpenLayers.Projection("EPSG:3857"), new OpenLayers.Projection("EPSG:4326")).getGeodesicLength();
			this.triggerElevationPlot({length:distance, geometry:line, heading:"Least cost path elevation plot"});			
		},
		
		bringToTop : function() {
			this._renderPaths();
		},
		
		_renderPaths : function(map) {
			if(map) {
				render(map);
			} else {
				mapService.getMap().then(function(map) {
					render(map);
				});
			}			
			
			function render(map) {
				var nonNullLayers = [];
			
				layerIndexes.forEach(function(layerName) {
					var layer = layers[layerName];
					if(layer) {
						nonNullLayers.push(layer);
						if(layer.map) {
							map.removeLayer(layer);
						}
					}
				});
				if(nonNullLayers.length) {
					map.addLayers(nonNullLayers);
				}
			}
		},
		
		removeLcpSourcePath : function() {
			return this._remove("lcpSourcePath");
		},
		
		removeBufferKml : function() {
			return this._remove("bufferKmlLayer");
		},
		
		removeCostSurface : function() {
			return this._remove("imageLayer");
		},
		
		removePathBuffers : function() {
			return this._remove("pathBuffersKmlLayer");
		},
		
		removePathKml : function() {
			return this._remove("pathKmlLayer");
		},
		
		_remove : function(name) {
			var map = null,
				layer = layers[name];
			
			if(layer && layer.map) {
				map = layer.map;
				map.removeLayer(layer);
				layer.destroy();
				layers[name] = null; 
			}
			return map;
		},
		
		_showing : function(name) {
			var layer = layers[name];
			return layer && layer.map;
		},
		
		showInterimPath : function(geometry, waypoints) {
			var size;
			
			this.removeInterimPath();
			interimPath = new OpenLayers.Layer.Vector("Interim source layer for least cost path", {style : new OpenLayers.Style({ 'strokeColor': '#000000'})});
			interimPath.addFeatures([new OpenLayers.Feature.Vector(geometry)]);
			map.addLayer(interimPath);
			
			wpMarker = new OpenLayers.Layer.Markers( "Waypoint Markers" );
			map.addLayer(wpMarker);

	        size = new OpenLayers.Size(16,16);
			
			geometry.components.forEach(function(component, index) {
				var x, y, feature, icon;
				x = component.x;
				y = component.y;
				if(index > 0 && index < geometry.components.length - 1) {
			        icon = new OpenLayers.TextIcon('<i class="fa fa-anchor textMarker"></i>',size);
				} else if(index === 0) {
					icon = new OpenLayers.TextIcon('<i class="fa fa-bullseye" style="color:green;font-size:120%"></i>',size);
				} else { // Must be the last one
					size = new OpenLayers.Size(11,15);
					icon = new OpenLayers.TextIcon('<i class="fa fa-remove textMarker" style="color:red; font-size:120%"></i>',size);
				}
		        wpMarker.addMarker(new OpenLayers.Marker(new OpenLayers.LonLat(x, y), icon));
			});			
		},
		
		removeInterimPath : function() {
			if(interimPath) {
				map.removeLayer(interimPath);
				interimPath.destroy();
				interimPath = null;
			}
			if(wpMarker) {
				map.removeLayer(wpMarker);
				wpMarker.destroy();
				wpMarker = null;
			}
		},
		
		getKml : function(url) {
			var deferred = $q.defer();
			
			if(url.indexOf("http") < 0) {
				url = window.location.href + url;
			}
			
			$http.post(kmlEndpoint, {
				url:url
			}).then(function(response) {
				deferred.resolve(response.data);
			},
			function(err) {
				deferred.reject({error:"E1101", text :"Failed to retrieve KMZ"});
			});
			return deferred.promise;
		},
		
		zoomToBufferlLayer : function() {
			// Use the first in the list of layers
			layerIndexes.some(function(name) {
				var layer = layers[name];
				if(layer) {
					map.zoomToExtent(layer.getDataExtent());
					return true;
				}
				return false;
			});
		},
		
		toggleLcpSourcePath : function(geometry) {
			var showing = this._showing("lcpSourcePath");
			if(showing) {
				this.removeLcpSourcePath();
			} else {
				this.showLcpSourcePath(geometry);
			}			
			return !showing;
		},
		
		showLcpSourcePath : function(geometry) {
			this.removeLcpSourcePath();
			layers.lcpSourcePath = new OpenLayers.Layer.Vector("Source layer for least cost path", {style : new OpenLayers.Style({ 'strokeColor': '#101000'})});
			layers.lcpSourcePath.addFeatures([new OpenLayers.Feature.Vector(geometry)]);
			this._renderPaths();
		}, 

		toggleCostSurface : function(imageExtent) {
			var showing = this._showing("imageLayer");
			if(showing) {
				this.removeCostSurface();
				this.removePathBuffers();
			} else {
				this.showCostSurface(imageExtent);
			}			
			return !showing;
		},
		
		showCostSurface : function( imageExtent) {
			var self = this,
				image = new Image();
			// We have to find the native size of the image so we preload it...
			image.onload = function(){
				// Grab the dimensions....
				var width = this.width,
					height = this.height;
				// We render the outline first (which returns the map in a promise).
				$q.all([self.showPathBuffers(imageExtent.outline), $http.get(imageExtent.extent, {cache:true})]).then(function(details) {
					// Render the image.
					var map = details[0],
						extentKml = details[1].data,
						format = new OpenLayers.Format.KML({
							internalProjection: map.baseLayer.projection,
							externalProjection: new OpenLayers.Projection("EPSG:4326")
						}),
						features = format.read(extentKml),
						extent = features[0].geometry.getBounds();
					
					self.removeCostSurface(map);
					layers.imageLayer = new OpenLayers.Layer.Image(
						'Cost surface image',
						imageExtent.image,
						extent,
						new OpenLayers.Size(width, height),
						{
							alwaysInRange : true,
							isBaseLayer : false,
							visibility : true, 
							opacity:0.9,
							displayOutsideMaxExtent: true,
							numZoomLevels:17
						}
					);
	 				self._renderPaths(map);
				});					
			};
			image.src = imageExtent.image;		
		},
		
		showPathBuffers : function(url) {
			var self = this,
				deferred = $q.defer();

			mapService.getMap().then(function(map){
				self.removePathBuffers(map);
				layers.pathBuffersKmlLayer = new OpenLayers.Layer.Vector("Path segment buffers", {
				    strategies: [new OpenLayers.Strategy.Fixed()],
				    protocol: new OpenLayers.Protocol.HTTP({
				        url: url,
				        format: new OpenLayers.Format.KML({
				            maxDepth: 2,
				            internalProjection : map.getProjectionObject(),
				            externalProjection : new OpenLayers.Projection("EPSG:4326")
				        })
				    }),
				    styleMap: new OpenLayers.StyleMap({
				        "default": new OpenLayers.Style({
				            pointRadius: 6,
				            fillOpacity: 0.15,
				            fillColor: "#ccff77",
				            strokeColor: "#44ee11",
				            strokeWidth: 2
				        })
				    })
				});
				self._renderPaths(map);
				deferred.resolve(map);
			});	
			return deferred.promise;
		},

		toggleBufferKml : function(url) {
			var showing = this._showing("bufferKmlLayer");
			if(showing) {
				this.removeBufferKml();
			} else {
				this.showBufferKml(url);
			}			
			return !showing;
		},
		
		showBufferKml : function(url) {
			var self = this;
			mapService.getMap().then(function(map){
				self.removeBufferKml(map);
				layers.bufferKmlLayer = new OpenLayers.Layer.Vector("Least cost path buffer KML", {
				    strategies: [new OpenLayers.Strategy.Fixed()],
				    protocol: new OpenLayers.Protocol.HTTP({
				        url: url,
				        format: new OpenLayers.Format.KML({
				            maxDepth: 2,
				            internalProjection : map.getProjectionObject(),
				            externalProjection : new OpenLayers.Projection("EPSG:4326")
				        })
				    }),
				    styleMap: new OpenLayers.StyleMap({
				        "default": new OpenLayers.Style({
				            pointRadius: 6,
				            fillOpacity: 0.30,
				            fillColor: "#bbff55",
				            strokeColor: "#ff4411",
				            strokeWidth: 2
				        })
				    })
				});
				self._renderPaths(map);
			});
		},
		
		togglePathKml : function(url) {
			var showing = this._showing("pathKmlLayer");
			if(showing) {
				this.removePathKml();
			} else {
				this.showPathKml(url);
			}			
			return !showing;
		},
		
		showPathKml : function(url) {
			var self = this;
			mapService.getMap().then(function(map){
				self.removePathKml();
				layers.pathKmlLayer = new OpenLayers.Layer.Vector("Least cost path KML", {
				    strategies: [new OpenLayers.Strategy.Fixed()],
				    protocol: new OpenLayers.Protocol.HTTP({
				        url: url,
				        format: new OpenLayers.Format.KML({
				            maxDepth: 2,
				            internalProjection : map.getProjectionObject(),
				            externalProjection : new OpenLayers.Projection("EPSG:4326")
				        })
				    }),
				    styleMap: new OpenLayers.StyleMap({
				        "default": new OpenLayers.Style({
				            graphicName: "cross",
				            pointRadius: 6,
				            fillOpacity: 0.50,
				            fillColor: "#ffcc66",
				            strokeColor: "#ff9933",
				            strokeWidth: 2
				        })
				    })
				});
				self._renderPaths(map);
			});
		},
		
		getResourceUrl : function(jobId, param) {
			var deferred = $q.defer();
			$http.get("service/resource/leastCostPath/" + jobId + "/" + param).then(function(response) {
				if(response.data && response.data.value) {
					deferred.resolve(response.data.value.url);
				}
				deferred.reject();
			});
			return deferred.promise;
		},
		
		getLeastCostPath : function(geometry, weightings, bufferPercent) {
			var geom4326 = new OpenLayers.Feature.Vector(geometry.clone().transform(new OpenLayers.Projection("EPSG:3857"), new OpenLayers.Projection("EPSG:4326"))),
				wktStr = new OpenLayers.Format.WKT().write(geom4326),
				deferred = $q.defer(),
				weightArray = [], 
				complete = false;
			
			flashService.add("Initiating least cost path process...", 3000);
			
			$timeout(function() {
				if(!complete) {
					notificationFlash = flashService.add("Least cost path process is running.", 60000, true);
				}
			}, 4500);			
			
			// We have to send the data as urlencoded parameters instead of JSON <doh/>
			angular.forEach(weightings, function(item, key) {
				if(item.selected) {
					weightArray.push('["' + key + '","' + item.label + '",' + item.value + "]");
				}
			});			
			
			asynch(leastCostPathJob, {
					wkt : wktStr,
					wTable : "[" + weightArray.join() + "]",
					f : 'json',
					buffPct:bufferPercent,
					returnZ : false,
					returnM : false
			}, {urlEncoded:true}).then(function(message) {
					var screenMessage = "A least cost process has completed";
					if(message.data && message.data.jobStatus == "esriJobFailed") {
						screenMessage = "A least cost process has failed";
					}
					complete = true;
					flashService.remove(notificationFlash);
					flashService.add(screenMessage, 4000);
					
					deferred.resolve(message);
				}, function(err) {
					complete = true;
					flashService.remove(notificationFlash);
					flashService.add("A least cost process has failed", 4000);
					$log.debug(JSON.stringify(err));
				}
			);
			
			return deferred.promise;
		},
		
		getPathGeometry : function() {
			return vector.features[0].geometry;
		},
		
		activatePath : function(bounds) {
			var deferred = $q.defer();
			mapService.getMap().then(function(map) {
				if(!lineControl) {
					var vertexStyle = {
						    strokeColor: "#ff0000",
						    fillColor: "#ff0000",
						    strokeOpacity: 1,
						    strokeWidth: 2,
						    pointRadius: 5,
						    graphicName: "cross",
						    cursor : "pointer"						    	
						},

						styleMap = new OpenLayers.StyleMap({
						    "default": OpenLayers.Feature.Vector.style['default'],
						    "vertex": vertexStyle
						}, {extendDefault: false});
					
					vector = new OpenLayers.Layer.Vector("Least Cost Input Path", {styleMap: styleMap});
					vector.events.on({
						featuremodified: function(event) {
							var components = event.feature.geometry.components,
								length = components.length;
							if(components.length > 5) {
								modifyControl.createVertices = false;
								if(lastCount == 5) {
									modifyControl.resetVertices();
									deferred.notify({
										type : "maximumVertices",
										points:components
									});
								}
							} else {
								modifyControl.createVertices = true;
								if(lastCount == 6) {
									modifyControl.resetVertices();
								}
							}
							lastCount = length;

							deferred.notify({
								type : "changed",
								points:components,
								distance : event.feature.geometry.getLength()
							});
						}
					});
					
					lineControl = new OpenLayers.Control.DrawFeatureOpt(vector, OpenLayers.Handler.RestrictedPath, {
	                    title: "Draw",
	                    displayClass: "olControlDraw",
						handlerOptions:{
							maxVertices : 6,
							restrictedExtent:bounds
						},
						callbacks : {
							outofbounds : function(lonlat) {
								deferred.notify({
									type : "pointOutOfBounds",
									lonlat : lonlat
								});
							},
							point : function(point, geometry) {
								deferred.notify({
									type : "adding",
									distance : geometry.getLength()
								});
							}
						}
	                });
					
					modifyControl = new OpenLayers.Control.RestrictedModifyFeature(vector, {
						restrictedExtent:bounds,
	                    clickout: false,
	                    toggle: false,
	                    deleteCodes: [46, 68, 27],
	                    title: "Modify",
	                    vertexRenderIntent: "vertex",
	                    outOfBounds : function(lonlat) {
							deferred.notify({
								type : "pointOutOfBounds",
								lonlat : lonlat
							});
	                    } 
					});
					map.addControl(lineControl);
					map.addControl(modifyControl);
					map.addLayer(vector);
	                					
					lineControl.events.register("featureadded", this, function(event) {
						var components = event.feature.geometry.components;
							
						lastCount = components.length;
						
						if(lastCount > 5) {
							modifyControl.createVertices = false;
							deferred.notify({
								type : "maximumVertices",
								points:components
							});
						}
	                    modifyControl.selectFeature(event.feature);
	                    modifyControl.activate();
	                    lineControl.deactivate();
	                    deferred.notify( {
	                    	type:"created",
	                    	points:components,
	                    	distance:event.feature.geometry.getLength()
	                    });
	                });

				}
				lastCount = 0;
				lineControl.activate();
				modifyControl.deactivate();
				// Bring the layer back to the top.
				map.addLayer(vector);
			});			
			return deferred.promise;
		},
		
		removePoint : function(point) {
			vector.features[0].geometry.removeComponent(point);
		},
		
		deactivateAll : function() {
			if(lineControl) {			
				lineControl.deactivate();	
			}
			if(modifyControl) {			
				modifyControl.deactivate();	
			}
			if(vector) {
				vector.removeAllFeatures();
				map.removeLayer(vector);
			}
		},
		
		deactivatePath : function() {			
			lineControl.deactivate();	
		},
		
		activateModify : function() {
			modifyControl.mode = OpenLayers.Control.ModifyFeature.RESHAPE;
			modifyControl.activate();
			lineControl.deactivate();
		},
		
		deactivateModify : function() {
			modifyControl.deactivate();
			lineControl.activate();
		},
		
		weightings : function() {
			var deferred = $q.defer();
			
			$http.get("resources/config/defaultLeastCostPathWeightings.json?v=1", {cache:true}).then(function(response) {
				deferred.resolve(response.data);
			},
			function(err) {
				deferred.reject({error:"E1100", text :"Failed to retrieve weightings"});
			});
			return deferred.promise;
		}
	};
}])

.run(["$templateCache", function($templateCache) {
  $templateCache.put("components/leastcostpath/draw.html",
    '<div class="popover bottom lcpPathDisplay" mars-lcp-path ng-show="show || resistanceCategories">' +
	'	<div class="arrow"></div>' +
	'	<div class="popover-inner">' +
	'		<div class="pathHeader">' +
	'			<span style="font-weight:bold">Least Cost Path</span><div style="float:right" ng-show="distance">{{(distance/1000) | number : 3}}km</div>' +
	'		</div>' +
	'       <div ng-hide="resistanceCategories">' +
	'		   <div ng-hide="points.length > 0">Click on map to start path. Double click to end path.</div>' +
	'		   <div ng-show="points.length > 0">Drag vertices with mouse to change waypoints. Hover over waypoints and use the delete key to remove.</div>' +
	'		   <div style="font-weight:bold;text-align:center" ng-cloak ng-show="distance > 300000">Reduce the length of your path. <br/>A limit of 300k applies.</div>' +
	'		   <div class="buttons">' +
	'			  <button ng-show="points.length > 1" type="button" class="btn btn-default" style="width:98%;margin:2px" ng-click="pathComplete($event)" ng-disabled="distance > 300000">Least cost path...</button>' +
	'		   </div>' +
	'       </div>' +
	'	</div>' +
	'	<div mars-least-cost-weightings weightings="resistanceCategories" path-geometry="pathGeometry" class="marsWeightings" success="disable"></div>' +
	'</div>');
}])

.filter('lcpLookup', [function() {
	// We use this to map to nice names on the UI for a given parameter name from ArcGIS least cost path service.
	var lookup = {
		"lcpKml" : {
			name: "Least cost path KML",
			fileType : "kml",
			fileName : "lcp.kml",
			showInGoogle : false
		},
		"lcpCorridorKml" : {
			name: "Least cost path buffer KML",
			fileType : "kml",
			fileName : "lcpCorridor.kml",
			showInGoogle : false
		},
		"cRasterKmz" : {
			name: "Cost surface KML",
			fileType : "kmz",
			fileName : "costRaster.kmz",
			showInGoogle : false
		},
		"combinedKMZ" : {
			name: "Combined KMZ",
			fileType : "kmz",
			fileName : "combinedKMZ",
			showInGoogle : true
		},
		"docPath" : {
			name: "Least cost path report",
			fileType : "pdf",
			fileName : "lcpReport.pdf",
			showInGoogle : true
		}	
	};
	return function(key, type) {
		var value;
		return ((value = lookup[key])?value : {	name : key,	fileType: ""})[type?type : "name"];		
	};
}]);

OpenLayers.Control.DrawFeatureOpt = OpenLayers.Class(OpenLayers.Control.DrawFeature, {
    handlers: null,
    initialize: function(layer, handler, options) {
        OpenLayers.Control.DrawFeature.prototype.initialize.apply(this, [layer, handler, options]);
        // configure the keyboard handler
        var keyboardOptions = {
            keydown: this.handleKeypress
        };
        this.handlers = {
            keyboard: new OpenLayers.Handler.Keyboard(this, keyboardOptions)
        };
    },
    handleKeypress: function(evt) {
        var index, code = evt.keyCode;
        if (this.handler.active) {
            /*
             * ESCAPE pressed. Remove second last vertix and finalize the drawing
             */
            if (code === 27) {
                index = this.handler.line.geometry.components.length - 1;
                this.handler.line.geometry.removeComponent(this.handler.line.geometry.components[index]);
                this.handler.finalize();
            }
            /*
             * DELETE pressed. Remove third last vertix (actually the last drawn one) 
             * and redraw the feature
             */
            if (code === 46) {
                index = this.handler.line.geometry.components.length - 2;
                this.handler.line.geometry.removeComponent(this.handler.line.geometry.components[index]);
                this.handler.drawFeature();
            }
        }
        return true;
    },
    activate: function() {
        return this.handlers.keyboard.activate() &&
            OpenLayers.Control.DrawFeature.prototype.activate.apply(this, arguments);
    },
    deactivate: function() {
        var deactivated = false;
        // the return from the controls is unimportant in this case
        if(OpenLayers.Control.DrawFeature.prototype.deactivate.apply(this, arguments)) {
            this.handlers.keyboard.deactivate();
            deactivated = true;
        }
        return deactivated;
    },
    
    CLASS_NAME: "OpenLayers.Control.DrawFeatureOpt"
});

var inBounds = function(pixel) {
	if(this.restrictedExtent === null) {
		return true;
	}		
	if(!this.restrictedBound) {
		this.restrictedBounds = new OpenLayers.Bounds(
				this.restrictedExtent.left,
				this.restrictedExtent.bottom,
				this.restrictedExtent.right,
				this.restrictedExtent.top
			).transform(new OpenLayers.Projection("EPSG:4326"), new OpenLayers.Projection("EPSG:3857"));
	}
	var lonLat = this.map.getLonLatFromPixel(pixel);
	return this.restrictedBounds.containsLonLat(lonLat);		
};

OpenLayers.Control.RestrictedModifyFeature =  OpenLayers.Class(OpenLayers.Control.ModifyFeature, {
	restrictedExtent : null,
	outOfBounds : null,

    dragVertex: function(vertex, pixel) {
    	if(this.inBounds(pixel)) {
    		OpenLayers.Control.ModifyFeature.prototype.dragVertex.apply(this, arguments);
    	} else if(this.outOfBounds){
    		this.outOfBounds(this.map.getLonLatFromPixel(pixel));
    	}
    },
    CLASS_NAME : "OpenLayers.Control.RestrictedModifyFeature"
});
OpenLayers.Control.RestrictedModifyFeature.prototype.inBounds = inBounds;


OpenLayers.Handler.RestrictedPath = OpenLayers.Class(OpenLayers.Handler.Path, {
	// Add an extent to the path so if the the user draws outside this extent then it fails
	restrictedExtent : null,
    addPoint: function(pixel) {
        var intersect = this.inBounds(pixel);
        if(intersect) {
        	OpenLayers.Handler.Path.prototype.addPoint.apply(this, arguments);
        } else {
        	this.callback("outofbounds", this.map.getLonLatFromPixel(pixel));
        }
    },
    CLASS_NAME : "OpenLayers.Handler.RestrictedPath"
});
OpenLayers.Handler.RestrictedPath.prototype.inBounds = inBounds;

OpenLayers.TextIcon = OpenLayers.Class(OpenLayers.Icon, {
    initialize: function(text, size, offset, calculateOffset) {
        this.text = text;
        this.size = size || {w: 20, h: 20};
        this.offset = offset || {x: -(this.size.w/2), y: -(this.size.h/2)};
        this.calculateOffset = calculateOffset;

        var id = OpenLayers.Util.createUniqueID("OL_TextIcon_");
        this.imageDiv = OpenLayers.Util.createDiv(id);
    },
	
    draw: function(px) {
    	$(this.imageDiv).html( this.text);
    	OpenLayers.Util.modifyDOMElement(this.imageDiv, 
                null, 
                null, 
                this.size, 
                "absolute");
    	this.moveTo(px);
        return this.imageDiv;
    }, 
});


})(angular, window);