(function(angular, global) {

'use strict';

angular.module("geo.map", [])

.directive("geoMap", ["$rootScope", "mapService", "waiting", function($rootScope, mapService, waiting) {
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
		pseudoBaseLayers = [],
		waiters,
		service = {
			maps: {}
		},
		layerLookup = {
			WMS : []
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
	
	service.addMap = function(config) {
		var layerControl = null,
			map,
			zoomControl;
		
		if(!config.name) {
			config.name = START_NAME + (nameIndex++);
		}
		
		lastMap = config.name;
		
		map = service.maps[config.name] = new L.Map(config.element, {center: config.options.center, zoom: config.options.zoom});
		
		if(config.layers) {
			config.layers.forEach(function(layer) {
				var leafLayer = expandLayer(layer);
				leafLayer.pseudoBaseLayer = layer.pseudoBaseLayer;
				
				if(layer.addLayerControl) {
					if(!layerControl) {
						layerControl = {};
					} 
					layerControl[layer.name] = leafLayer;
				}
				if(layer.defaultLayer || layer.pseudoBaseLayer) {
					map.addLayer(leafLayer);
				}
				
				if(layerControl) {
					map.addControl(new L.Control.Layers( layerControl, {}));
				}
			});
		}

		L.control.scale({imperial:false}).addTo(map);
		L.control.mousePosition({
				position:"bottomright", 
				emptyString:"",
				separator : " ",
				latFormatter : function(lat) {
					return "Lat " + L.Util.formatNum(lat, 5) + "°";
				},
				lngFormatter : function(lng) {
					return "Lng " + L.Util.formatNum(lng, 5) + "°";
				}
		}).addTo(map);
		zoomControl = L.control.zoomBox({
		    //modal: true,  // If false (default), it deactivates after each use.  
		                  // If true, zoomBox control stays active until you click on the control to deactivate.
		    // position: "topleft",                  
		    // className: "customClass"  // Class to use to provide icon instead of Font Awesome
		});
		map.addControl(zoomControl);
		
		//L.control.zoomout().addTo(map);
		
		
		global.map = map;
		if(waiters) {
			waiters.resolve(map);
		}
		
		map.addControl(L.control.legend());
		
		return map;
		
	};
	
	service.zoomTo = function(y, x) {
		this.getMap().then(function(map) {
			map.panTo([y, x], {animate: true});
		});
	};
	
	return service;
	

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


})(angular, window);