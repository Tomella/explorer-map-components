(function (angular, L, global) {

   'use strict';

   angular.module("geo.map", [])

      .directive("geoMap", ["mapService", "waiting", function (mapService, waiting) {
         var waiters;

         return {
            restrict: "AE",
            scope: {
               configuration: "="
            },
            controller: ["$q", "$scope", function ($q, $scope) {
               this.getMap = function () {
                  if ($scope.map) {
                     $q.when($scope.map);
                  } else {
                     if (!waiters) {
                        waiters = waiting.wait();
                     }
                     return waiters.waiter().promise;
                  }
               };
            }],

            link: function (scope, element) {
               scope.$watch("configuration", function (config) {
                  if (config) {
                     config.element = element[0];
                     scope.map = mapService.addMap(config);
                     if (waiters) {
                        waiters.resolve(scope.map);
                     }
                  }
               });

            }
         };
      }])

      .factory("mapService", ['$injector', '$filter', '$q', '$rootScope', 'waiting', function ($injector, $filter, $q, $rootScope, waiting) {
         var START_NAME = "MAP_",
            nameIndex = 0,
            lastMap,
            waiters,
            layerControl,
            gridLayer,
            groups = {},
            service = {
               maps: {}
            };

         service.getMap = function (name) {
            if (!name) {
               name = lastMap;
            }

            if (lastMap) {
               return $q.when(service.maps[name]);
            }

            if (!waiters) {
               waiters = waiting.wait();
            }
            return waiters.waiter().promise;
         };

         service.addToGroup = function (layer, groupName) {
            this.getMap().then(function (map) {
               var group = groups[groupName];
               if (group) {
                  addLayer(layer, group, map);
               }
            });
         };

         service.getGroup = function (groupName) {
            return groups[groupName];
         };

         service.clearGroup = function (groupName) {
            var layerGroup = groups[groupName],
               layers = layerGroup.getLayers();

            layers.forEach(function (layer) {
               layerGroup.removeLayer(layer);
            });
         };

         service.removeFromGroup = function (data, groupName) {
            var group = groups[groupName];
            if (group) {
               group.removeLayer(data.layer);
               data.layer = null;
            }
         };

         service.getGridLayer = function () {
            return gridLayer;
         };

         service.addMap = function (config) {
            var map,
               legendControlOptions = null;

            if (!config.name) {
               config.name = START_NAME + (nameIndex++);
            }

            lastMap = config.name;

            map = service.maps[config.name] = new L.Map(config.element, {
               center: config.options.center,
               zoom: config.options.zoom,
               zoomControl: !config.options.noZoomControl,
               maxZoom: config.options.maxZoom,
               minZoom: config.options.minZoom
            });

            if (config.gridLayer) {
               config.gridLayer.name = "Grid";
               gridLayer = expandLayer(config.gridLayer);
            }

            if (config.layers) {
               config.layers.forEach(function (layer) {
                  var group;
                  if (layer.type === "LayerGroup") {
                     if (layer.layers) {
                        groups[layer.name] = group = L.layerGroup([]);
                        layer.layers.forEach(function (child) {
                           addLayer(child, map, group);
                        });
                        map.addLayer(group);
                     }
                  } else {
                     addLayer(layer, map, map);
                     if (layer.pseudoBaseLayer && layer.legendUrl) {
                        legendControlOptions = {
                           url: layer.legendUrl
                        };
                     }
                  }
               });
            }

            // An application doesn't have to provide a point service but if it has one we will ise
            var elevGetter;
            try {
               var elevationPointService = $injector.get('elevationPointService');
               if (elevationPointService && elevationPointService.getElevation) {
                  elevGetter = function (latlng) {
                     return elevationPointService.getElevation(latlng).then(function (elev) {
                        if (elev === null) return '';
                        return "Elev " + $filter('length')(Math.round(elev), true) + " : ";
                     });
                  };
               }
            } catch (e) {
               console.log("No elevation point service available");
            }

            L.control.scale({ imperial: false }).addTo(map);
            L.control.mousePosition({
               position: "bottomright",
               emptyString: "",
               seperator: " ",
               elevGetter: elevGetter,
               latFormatter: function (lat) {
                  return "Lat " + L.Util.formatNum(lat, 5) + "°";
               },
               lngFormatter: function (lng) {
                  return "Lng " + L.Util.formatNum(lng % 180, 5) + "°";
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
            if (waiters) {
               waiters.resolve(map);
            }
            // This is the pseudo base layers
            if (legendControlOptions) {
               map.addControl(L.control.legend(legendControlOptions));
            }

            return map;

         };

         return service;

         function addLayer(layer, target, map) {
            var leafLayer = expandLayer(layer);
            leafLayer.pseudoBaseLayer = layer.pseudoBaseLayer;

            if (layer.addLayerControl) {
               if (!layerControl) {
                  layerControl = {};
               }
               layerControl[layer.name] = leafLayer;
            }
            if (layer.defaultLayer || layer.pseudoBaseLayer) {
               target.addLayer(leafLayer);
            }

            if (layerControl) {
               map.addControl(new L.Control.Layers(layerControl, {}));
            }
            layer.layer = leafLayer;
         }

         function expandLayer(data) {
            var Clazz = [];
            if (angular.isArray(data.type)) {
               Clazz = L;
               data.type.forEach(function (type) {
                  Clazz = Clazz[type];
               });
            } else {
               Clazz = L[data.type];
            }
            if (data.parameters && data.parameters.length > 0) {
               var options = data.parameters[1];
               if (options) {
                  options = transformOptions(options);
               }
               return new Clazz(data.parameters[0], options, data.parameters[2], data.parameters[3], data.parameters[4]);
            }
            return new Clazz();
         }

         function transformOptions(options) {
            if (options.bounds && angular.isArray(options.bounds)) {
               var bounds = options.bounds;
               var ll = bounds[0];
               var ur = bounds[1];
               if (angular.isArray(ll) && angular.isArray(ur)) {
                  options.bounds = L.latLngBounds(bounds);
               }
            }
            return options;
         }
      }]);

})(angular, L, window);