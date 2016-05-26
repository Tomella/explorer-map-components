/*!
 * Copyright 2015 Geoscience Australia (http://www.ga.gov.au/copyright.html)
 */
(function(angular, L, window) {
'use strict';

angular.module("explorer.point", ['geo.map', 'explorer.flasher'])

.directive("expPoint", ['pointService', function(pointService) {
	return {
		scope : {
			data : "=point"
		},		
		controller : ['$scope', function($scope) {
			$scope.$watch("data", function(newData, oldData) {
				if(newData || oldData) {
					pointService.showPoint($scope.data);
				}
			});
		}]
	};
}])

.directive("expClickMapPoint", ['pointService', function(pointService) {
	return {
        template: '<div style="position:relative;overflow:hidden"><i style="position:relative;display:inline-block;right:-3px;top:-3px" class="fa fa-location-arrow fa-rotate-180"></i><i style="position:absolute;display:inline-block;right:4px;top:7px" class="fa fa-location-arrow fa-rotate-180"></i></div>',
		restrict:'AE',
		scope : {
		},		
		link : function(scope, element) {
			pointService.addMapListener(function(latlon) {
				pointService.showPoint(latlon);
			}, this);
		}
	};
}])

.directive("expPointInspector", ['pointService', 'flashService', '$rootScope', '$filter', function(pointService, flashService, $rootScope, $filter) {
	var defaultOptions = {
			actions : [],
			visible : true,
			modal : false,
			minWidth : 240,
			title : "Features within approx 2km",
			position : {top:140, left:40}
		};
	
	return {
		restrict:"AE",
		templateUrl : "map/point/point.html",
		scope :true,
		controller : ['$scope', function($scope) {
			if($scope.options) {
				$scope.windowOptions = angular.extend({}, defaultOptions, scope.options);
			} else {
				$scope.windowOptions = angular.extend({}, defaultOptions);
			}
		}],
		link : function(scope, element) {
			// This things is a one shot wonder so we listen for an event.
			$rootScope.$on("map.point.changed", function(event, point) {
				scope.point = point;
				pointService.removeLayer();
                scope.changePoint(point);
				if(point) {
					pointService.getMetaData().then(function(response) {
						scope.metadata = response.data;
					});
				}
			});
			
			scope.createTitle = function() {
				var oneItem = !this.greaterThanOneItem(),
					layerName = this.feature.layerName,
					metadata = this.metadata[layerName],
					preferredLabel = metadata.preferredLabel,
					value = this.feature.attributes[preferredLabel];
				
				if(!oneItem && value && value != "Null") {
					return value;
				} else {
					return metadata.label;
				}				
			};
			
			scope.changePoint = function(newValue) {
				pointService.moveMarker(newValue);
				if(newValue) {
					pointService.getInfo(newValue).then(function(data) {
						handleResponse(data);
					});
				}
				pointService.removeLayer();
			};
			
			scope.clearPoint = function() {
				scope.point = false;
				pointService.removeLayer();
				pointService.removeMarker();
			};
			
			scope.toggleShow = function() {
				this.feature.displayed = !this.feature.displayed;
				if(this.feature.displayed) {
					this.feature.feature = pointService.showFeature(this.feature);
				} else {
					pointService.hideFeature(this.feature.feature);
					this.feature.layer = null;
				}
			};			
			
			scope.oneShowing = function() {
				var group = $filter("filterGroupsByLayername")(scope.featuresInfo.results, this.item),
					oneShown = false;
				group.forEach(function(feature) {
					oneShown |= feature.displayed;
				});
				return oneShown;
			};
			
			scope.greaterThanOneItem = function() {
				return $filter("filterGroupsByLayername")(scope.featuresInfo.results, this.item).length > 1;
			};
			
			scope.groupShow = function() {
				var group = $filter("filterGroupsByLayername")(scope.featuresInfo.results, this.item),
					oneShown = false;
				
				group.forEach(function(feature) {
					oneShown |= feature.displayed;
				});
				
				group.forEach(function(feature) {
					if(oneShown) {
						feature.feature = pointService.hideFeature(feature.feature);
						feature.displayed = false;
					} else {
						feature.feature = pointService.showFeature(feature);
						feature.displayed = true;
					}
				});
			};			
			
			scope.allHidden = function() {
				var allHidden = true;
				if(this.featuresInfo && this.featuresInfo.results) {
					this.featuresInfo.results.forEach(function(feature) {
						allHidden &= !feature.displayed;
					});
				}
				return allHidden;
			};
			
			scope.toggleAll = function() {
				var allHidden = scope.allHidden();
				this.featuresInfo.results.forEach(function(feature) {
					if(allHidden) {
						if(!feature.displayed) {
							feature.displayed = true;
							feature.feature = pointService.showFeature(feature);
						}
					} else {
						if(feature.displayed) {
							feature.displayed = false;
							feature.feature = pointService.hideFeature(feature.feature);
						}
					}
				});
			};
			
			scope.elevationPath = function(label) {
				if(!this.feature.feature) {
					this.feature.feature = pointService.createFeature(this.feature);
				}
				pointService.triggerElevationPlot(this.feature.feature[0], label);
			};
			
			function handleResponse(data) {
				scope.featuresInfo = data;
				pointService.createLayer();				
			}
		}
	};
}])

.factory("pointService", ['httpData', '$q', 'configService', 'mapService', '$rootScope', function(httpData, $q, configService, mapService, $rootScope){
	var featuresUnderPointUrl = "service/path/featureInfo",
		layer = null,
		control = null,
		esriGeometryMapping = {
			"esriGeometryPoint"   : {
				createFeatures : function(geometry) {
					var point = [geometry.y, geometry.x];
					return [L.circleMarker(point)];
				},
				type : "x,y"
			},
			"esriGeometryPolyline": {
				createFeatures : function(geometry) {
					var features = [];
					geometry.paths.forEach(function(path) {
						var points = [];
						path.forEach(function(point) {
							points.push([point[1], point[0]]);
						});						
						features.push(L.polyline(points));
					});
					return features;
				},
				type: "paths"
			},
			"esriGeometryPolygon" : {
				createFeatures : function(geometry) {
					var polygonGeometry,
						rings = [];
					
					geometry.rings.forEach(function(ring) {
						var linearRing, polygon, points = [];
						ring.forEach(function(pointArr) {
							points.push([pointArr[1], pointArr[0]]);
						});
					    rings.push(points);
					});
					polygonGeometry = L.multiPolygon(rings);
					return [polygonGeometry];
				},
				type: "rings"
			}
		},
		metaDataUrl = httpData.baseUrlForPkg('ga-explorer-map') + 'resources/point/pointMetadata.json',
		marker = null,
		clickControl = null,
		clickListeners = [];

	return {
		triggerElevationPlot : function(geometry, label) {
			var distance = geometry.getLength();
			$rootScope.$broadcast("elevation.plot.data", {length:distance, geometry:geometry.getLatLngs(), heading:label});
		},
		
		addMapListener : function(callback, bound) {
			var alreadyBound = false;
			clickListeners.forEach(function(obj) {
				if(obj.callback == callback && obj.bound == bound) {
					alreadyBound = true;
				}
			});
			if(!alreadyBound) {
				clickListeners.push({callback : callback, bound : bound});
			}
			
			if(!clickControl) {
				clickControl = true;
				mapService.getMap().then(function(map) {
		            map.on("click", function(e) {
		               clickListeners.forEach(function(listener) {
		            	   var callback = listener.callback,
		            	   		point = {
		            			   x: e.latlng.lng,
		            			   y: e.latlng.lat
		            	   		};
		            	   
		            	   point.lat = point.y;
		            	   point.lng = point.x;
		                   if(listener.bound) {
		                	   callback.bind(listener.bound);
		                   }
		                   callback(point);
		                }); 
		            });
				});
			}
		},
		
		getMetaData : function() {
			return httpData.get(metaDataUrl, {cache:true});
		},
		
		moveMarker : function(point) {
			mapService.getMap().then(function(map) {
				var size, offset, icon;
	
				if(marker) {
					map.removeLayer(marker);
				}
				marker = point? L.marker(point).addTo(map): null;
			});
			
		},
		
		removeMarker : function() {
			if(marker) {
				mapService.getMap().then(function(map) {
					map.removeLayer(marker);
					marker = null;					
				});
			}			
		},
		
		showPoint : function(point) {
			$rootScope.$broadcast("map.point.changed", point);
		},
		
		removePoint : function() {
			$rootScope.$broadcast("map.point.changed", null);
		},
		
		getBehaviour : function(geometryType) {
			
		},
		
		getInfo : function(point) {
			return mapService.getMap().then(function(map) {
				var bounds = map._container.getBoundingClientRect(),
					ratio = (window.devicePixelRatio)?window.devicePixelRatio : 1,
					extent = map.getBounds();

				return configService.getConfig("clientSessionId").then(function(id) {			
					return httpData.post(featuresUnderPointUrl, {
							clientSessionId : id,
							x:point.x, 
							y:point.y, 
							width:bounds.width / ratio, 
							height:bounds.height / ratio,
							extent : {
								left : extent.left,
								right : extent.right,
								top: extent.top,
								bottom: extent.bottom
					}}).then(function(response) {
						return response.data;
					});
				});
			});
		},
		
		overFeatures : function(features) {
			var item;
			if(!features) {
				return;
			}
			if(angular.isArray(features)) {
				item = features[0];
			} else {
				item = features;
			}
			if(item) {
				item.bringToFront().setStyle({color:"red"});
			}
		},
		
		outFeatures : function(features) {
			if(!features) {
				return;
			}
			features.forEach(function(feature) {
				feature.setStyle({color : '#03f'});
			}); 			
		},
		
		createLayer : function() {
			return mapService.getMap().then(function(map) {
				layer = L.layerGroup();
				map.addLayer(layer);
				return layer;
			});	
		},
		
		removeLayer : function() {		
			return mapService.getMap().then(function(map) {
				if(layer) {
					map.removeLayer(layer);
				}
                /* jshint -W093 */
				return layer = null;
			});	
		},
		
		createFeature : function(data) {
			return esriGeometryMapping[data.geometryType].createFeatures(data.geometry);
		},
		
		showFeature : function(data) {
			var features = this.createFeature(data);
			features.forEach(function(feature) {
				layer.addLayer(feature);				
			});
			return features;
		},
		
		hideFeature : function(features) {
			if(features) {
				features.forEach(function(feature) {
					layer.removeLayer(feature);					
				});
			}
		}
	};
}])

.filter("dashNull", [function() {
	return function(value) {
		if(!value || "Null" == value) {
			return "-";
		}
		return value;
	};
}])

.filter("featureGroups", [function() {
	return function(items) {
		var groups = [],
			set = {};
		if(!items) {
			return groups;
		}
		items.forEach(function(item) {
			var layerName = item.layerName;
			if(!set[layerName]) {
				set[layerName] = true;
				groups.push(layerName);
			}
		});
		return groups;
	};
}])

.filter("filterGroupsByLayername", [function() {
	return function(items, layerName) {
		var group = [];
		if(!items) {
			return group;
		}
		items.forEach(function(item) {
			if(layerName == item.layerName) {
				group.push(item);
			}
		});
		return group;
	};
}])


.controller("OverFeatureCtrl", OverFeatureCtrl);

OverFeatureCtrl.$invoke = ['$filter', 'pointService'];
function OverFeatureCtrl($filter, pointService) {
	this.click = function() {
	};

	this.mouseenter = function(feature) {
		pointService.overFeatures(feature.feature);
	};
	
	this.mouseleave = function(feature) {
		pointService.outFeatures(feature.feature);
	};
	
	this.groupEnter = function(results, item) {
		var group = $filter("filterGroupsByLayername")(results, item);
		group.forEach(function(feature){
			pointService.overFeatures(feature.feature);
		});
	};
	
	this.groupLeave = function(results, item) {
		var group = $filter("filterGroupsByLayername")(results, item);
		group.forEach(function(feature){
			pointService.outFeatures(feature.feature);
		});
	};
}

})(angular, L, window);
