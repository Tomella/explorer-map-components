(function(angular, L, global) {

'use strict';

angular.module("geo.map", [])

.directive("geoMap", ["mapService", "waiting", function(mapService, waiting) {
	var waiters;
	
	return {
		restrict: "AE",
		scope : {
			configuration : "="
		},
		controller : ["$q", "$scope", function($q, $scope) {
			this.getMap = function() {
				if($scope.map) {
					$q.when($scope.map);
				} else {
					if(!waiters) {
						waiters = waiting.wait();
					}
					return waiters.waiter().promise;
				}
			};
		}],
		
		link : function(scope, element) {
			scope.$watch("configuration" , function(config) {
				if(config) {
					config.element = element[0];
					scope.map = mapService.addMap(config);
					if(waiters) {
						waiters.resolve(scope.map);
					}
				}
			});
			
		}
	};
}])

.factory("mapService", ['$q', 'waiting', function($q, waiting) {
	var START_NAME = "MAP_",
		nameIndex = 0,
		lastMap,
		waiters,
		layerControl,
		groups = {},
		service = {
			maps: {}
		};
	
	service.getMap = function(name) {
		if(!name) {
			name = lastMap;
		}
		
		if(lastMap) {
			return $q.when(service.maps[name]);
		}

		if(!waiters) {
			waiters = waiting.wait();
		}
		return waiters.waiter().promise;	
	};

	service.addToGroup = function(layer, groupName) {
		this.getMap().then(function(map) { 
			var group = groups[groupName];
			if(group) {
				addLayer(layer, group, map);
			}
		});
	};

	service.getGroup = function(groupName) {
		return groups[groupName];
	};
	
	service.clearGroup = function(groupName) {
		var layerGroup = groups[groupName],
			layers = layerGroup.getLayers();
		
		layers.forEach(function(layer) {
			layerGroup.removeLayer(layer);
		});	
	};
	
	service.removeFromGroup = function(data, groupName) {
		var group = groups[groupName];
		if(group) {
			group.removeLayer(data.layer);
			data.layer = null;
		}
	};
	
	service.addMap = function(config) {
		var map, gridLayer,
			legendControlOptions = null;
		
		if(!config.name) {
			config.name = START_NAME + (nameIndex++);
		}
		
		lastMap = config.name;
		
		map = service.maps[config.name] = new L.Map(config.element, {
            center: config.options.center,
            zoom: config.options.zoom,
            zoomControl: !config.options.noZoomControl
        });

        if (config.gridLayer) {
            config.gridLayer.name = "Grid";
            gridLayer = addLayer(config.gridLayer, map, map);
        }

		if(config.layers) {
			config.layers.forEach(function(layer) {
				var group;
				if(layer.type == "LayerGroup") {
					if(layer.layers) {
						groups[layer.name] = group = L.layerGroup([]);
						layer.layers.forEach(function(child) {
							addLayer(child, map, group);
						});
						map.addLayer(group);
					}					
				} else {
					addLayer(layer, map, map);
					if(layer.pseudoBaseLayer && layer.legendUrl) {
						legendControlOptions = {
							url: layer.legendUrl
						};
					}
				}
			});
		}

		L.control.scale({imperial:false}).addTo(map);
		L.control.mousePosition({
				position:"bottomright", 
				emptyString:"",
				seperator : " ",
				latFormatter : function(lat) {
					return "Lat " + L.Util.formatNum(lat, 5) + "°";
				},
				lngFormatter : function(lng) {
					return "Lng " + L.Util.formatNum(lng, 5) + "°";
				}
		}).addTo(map);
        if (!config.options.noZoomControl) {
            L.control.zoomBox({
                //modal: true,  // If false (default), it deactivates after each use.
                // If true, zoomBox control stays active until you click on the control to deactivate.
                // position: "topleft",
                // className: "customClass"  // Class to use to provide icon instead of Font Awesome
            }).addTo(map);
            //L.control.zoomout().addTo(map);
        }

		global.map = map;
		if(waiters) {
			waiters.resolve(map);
		}
		// This is the pseudo base layers
		if(legendControlOptions) {
			map.addControl(L.control.legend(legendControlOptions));
		}
		
		return map;
		
	};
	
	return service;
	
	function addLayer(layer, target, map) {
		var leafLayer = expandLayer(layer);
		leafLayer.pseudoBaseLayer = layer.pseudoBaseLayer;
		
		if(layer.addLayerControl) {
			if(!layerControl) {
				layerControl = {};
			} 
			layerControl[layer.name] = leafLayer;
		}
		if(layer.defaultLayer || layer.pseudoBaseLayer) {
			target.addLayer(leafLayer);
		}
		
		if(layerControl) {
			map.addControl(new L.Control.Layers( layerControl, {}));
		}
		layer.layer = leafLayer;
	}
	
	function expandLayer(data) {
		var Clazz = [];
		if(angular.isArray(data.type)) {
			Clazz = L;
			data.type.forEach(function(type) {
				Clazz = Clazz[type];
			});
		} else {
			Clazz = L[data.type];
		}
		if(data.parameters && data.parameters.length > 0) {
			return new Clazz(data.parameters[0], data.parameters[1], data.parameters[2], data.parameters[3], data.parameters[4]);
		} 
		return new Clazz();
	}
	
}]);

})(angular, L, window);