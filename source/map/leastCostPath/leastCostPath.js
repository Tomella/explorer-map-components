/*!
 * Copyright 2015 Geoscience Australia (http://www.ga.gov.au/copyright.html)
 */
(function (angular, L) {
    'use strict';

    var leastCostPathExtent;

    angular.module("explorer.least.cost.path", [
        'explorer.config',
        'explorer.flasher',
        'explorer.persist',
        'explorer.message'])

        .directive("leastCostPathDraw", ['$log', 'lcpService', 'flashService', 'persistService', 'configService',
            function($log, lcpService, flashService, persistService, configService) {
                return {
                    templateUrl:'map/leastCostPath/draw.html',
                    replace:true,
                    restrict:"AE",
                    controller:['$scope', '$rootScope', function($scope, $rootScope) {
                        $scope.points = [];

                        configService.getConfig().then(function(config){
                            leastCostPathExtent = config.leastCostPathExtent;
                        });

                        $scope.remove = function() {
                            var index = $scope.points.indexOf(this.point);
                            if (index > -1) {
                                $scope.points.splice(index, 1);
                                lcpService.removePoint(this.point);
                            }
                        };

                        var isPathCompleteEvent = false;
                        $scope.pathComplete = function() {
                            isPathCompleteEvent = true;
                            $rootScope.$broadcast("leastCost.path.data", null);
                            isPathCompleteEvent = false;
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

                        $rootScope.$on("leastCost.path.draw", function (event) {
                            $scope.show = true;
                            $scope.points = [];
                        });

                        $rootScope.$on("leastCost.path.data", function (event, entity) {
                            if (isPathCompleteEvent) return;
                            if (entity && entity.positions && entity.positions.length) {
                                $scope.show = true;
                                $scope.points = entity.positions;
                                $scope.distance = entity.length;
                                lcpService.setPathGeometry(entity.positions);
                            } else {
                                $scope.show = false;
                                $scope.points = [];
                                $scope.distance = 0;
                                lcpService.reset();
                            }
                        });

                        // Here is where we persist state..
                        $scope.$watch("resistanceCategories", function(newValue, oldValue){
                            if(oldValue) {
                                if (!newValue) $scope.show = false; // weightings dialog dismissed
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
                            }
                        });
                    }]
                };
            }])

        .directive("leastCostWeightings", ['$log', '$modal', 'lcpService', 'messageService',
            function($log, $modal, lcpService, messageService) {
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
                                templateUrl : "map/leastCostPath/leastCostWeightings.html",
                                size:"md",
                                backdrop:'static',
                                controller : ['$scope', '$rootScope', '$modalInstance', 'weightings', 'pathGeometry',
                                    function($scope, $rootScope, $modalInstance, weightings, pathGeometry) {
                                    $scope.weightings = weightings;
                                    $scope.pathGeometry = pathGeometry;

                                    // Show the panel
                                    determineBufferRange();

                                    $scope.close = function() {
                                        $scope.weightings = null;
                                    };

                                    $scope.cancelLeastCostPath = function() {
                                        $scope.weightings = null;
                                        $modalInstance.dismiss(null);
                                    };

                                    $scope.showLeastCostPath = function(event) {
                                        event.stopPropagation();
                                        $modalInstance.close($scope.bufferPercent);
                                    };

                                    function determineBufferRange() {
                                        var lbounds = L.polyline($scope.pathGeometry).getBounds(),
                                            bounds = {
                                               right: lbounds.getEast(),
                                               left: lbounds.getWest(),
                                               top: lbounds.getNorth(),
                                               bottom: lbounds.getSouth()
                                            },
                                            bufferValues = {"0":0},
                                            bufferPercent = "0",
                                            restrictionMessage = null;

                                        if(inBounds(0.1)) {
                                            bufferValues[bufferPercent = "0.1"] = 10;
                                            if(inBounds(0.25)) {
                                                bufferValues[bufferPercent = "0.25"] = 25;
                                                if(inBounds(0.5))
                                                    bufferValues[bufferPercent = "0.5"] = 50;
                                                else
                                                    restrictionMessage = "Can not buffer extent by more than 25% as it would exceed the extent of our data";
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

                                        function inBounds(bufferPercent) {
                                            var xBuff = (bounds.right - bounds.left) * bufferPercent,
                                                yBuff = (bounds.top - bounds.bottom) * bufferPercent,
                                                buff  = xBuff > yBuff? xBuff : yBuff,
                                                left = bounds.left - buff,
                                                right = bounds.right + buff,
                                                bottom = bounds.bottom - buff,
                                                top = bounds.top + buff;

                                            return leastCostPathExtent.top > top &&
                                                leastCostPathExtent.left < left &&
                                                leastCostPathExtent.right > right &&
                                                leastCostPathExtent.bottom < bottom;
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
                                processSelections(scope.weightings, scope.pathGeometry, bufferPercent);
                                closed();
                            }, function () {
                                closed();
                            });

                        }

                        function processSelections(selectedWeightings, geometry, bufferPercent) {
                            var weightings = {};

                            // Normalise what we send the service. It doesn't need know about our structure.
                            selectedWeightings.forEach(function(resistance) {
                                resistance.group.forEach(function(item) {
                                    weightings[item.key] = item;
                                });
                            });
                            lcpService.getLeastCostPath(geometry, weightings, (bufferPercent === 0 || bufferPercent?bufferPercent:0.25)).then(function(response) {
                                lcpService.reset();
                                if (!response) {
                                    failed({
                                        text: "Least cost path request failed."
                                    });
                                } else if(response.jobName == "displayMessage" || response.error) {
                                    if(!response.text) response.text = response.details;
                                    failed(response);
                                    scope.leastCostPath = null;
                                } else {
                                    var results = lcpService.results();
                                    results.data = response.data;
                                    results.data.geometry = geometry;
                                    results.distance = Exp.Util.toLineDistance(geometry);
                                    results.data.timeStamp = Date.now();
                                }
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

        .directive("expLeastCostPathDisplay", ['$log', 'lcpService', '$filter', function($log, lcpService, $filter) {
            return {
                templateUrl : "map/leastCostPath/leastCostDisplay.html",
                restrict:"AE",
                controller : ['$scope', function($scope) {
                    $scope.results = lcpService.results();

                    $scope.urls = {};

                    $scope.$watch("results.data", function(data) {
                        if(data) {
                            // Clear showing flags.
                            $scope.lcpKmlShown = $scope.lcpBufferKmlShown = $scope.pathShown = $scope.costSurfaceShown = false;
                            angular.forEach(data.results, function(value, key) {
                                lcpService.getResourceUrl(data.jobId, key).then(function(url) {
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
                    };

                    $scope.toggleLcpBufferKml = function() {
                        $scope.lcpBufferKmlShown = lcpService.toggleBufferKml($scope.urls.lcpCorridorKml);
                    };

                    $scope.togglePath = function() {
                        $scope.pathShown = lcpService.toggleLcpSourcePath($scope.results.data.geometry, "Least cost path elevation plot");
                    };

                    $scope.elevationLcpKml = function() {
                        lcpService.elevationLcpKml();
                    };

                    $scope.elevationPath = function(label) {
                        lcpService.elevationPath($scope.results.data.geometry, "Elevation plot of original path for least cost path");
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
                            lcpService.reset();
                        }
                    });
                }
            };
        }])

        .directive("pathLeastCostSlider", [function() {
            return {
                template : '<slider min="0" max="1" step="0.1" ng-model="weighting.value" updateevent="slideStop" ng-disabled="!weighting.selected" ui-tooltip="hide"></slider>',
                link : function() {}
            };
        }])

        .factory('lcpService', ['$log', '$q', 'httpData', '$timeout', '$rootScope', 'mapHelper', 'flashService',
            function($log, $q, httpData, $timeout, $rootScope, mapHelper, flashService) {
                var pathGeometry;

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
                    interimPath = null,
                    lcpResults = {
                        data: null,
                        distance: null
                    };

                function isShowingLayer(name) {
                    var layer = layers[name];
                    return layer !== undefined && layer !== null;
                }

                function removeLayer(name) {
                    var layer = layers[name];
                    if(layer) {
                        mapHelper.removeLayer(layer);
                        layers[name] = null;
                    }
                }

                function renderPaths() {
                    var nonNullLayers = [];

                    layerIndexes.forEach(function(layerName) {
                        var layer = layers[layerName];
                        if(layer) {
                            nonNullLayers.push(layer);
                            mapHelper.removeLayer(layer);
                        }
                    });

                    mapHelper.addLayers(nonNullLayers);
                }

                function showInterimPath() {
                     if (interimPath) mapHelper.removeLayer(interimPath);
                     mapHelper.addLayer(interimPath = L.polyline(pathGeometry, {
                         width: 2,
                         color: '#000',
                     }));
                }

                return {
                    results : function() {
                        return lcpResults;
                    },

                    reset: function() {
                        lcpResults.data = pathGeometry = null;
                        this.removePathKml();
                        this.removeBufferKml();
                        this.removeLcpSourcePath();
                        this.removePathBuffers();
                        this.removeCostSurface();
                        if (interimPath) {
                            mapHelper.removeLayer(interimPath);
                            interimPath = null;
                        }
                    },

                    triggerElevationPlot : function(data) {
                        $rootScope.$broadcast("elevation.plot.data", data);
                    },

                    elevationPath : function(geometry, label) {
                        var length = Exp.Util.toLineDistance(geometry);
                        this.triggerElevationPlot({length:length, positions:geometry, heading:label});
                    },

                    elevationLcpKml : function() {
                        var positions = layers.pathKmlLayer.getLatLngs();
                        var distance = Exp.Util.toLineDistance(positions);
                        this.triggerElevationPlot({length:distance, positions:positions, heading:"Least cost path elevation plot"});
                    },

                    bringToTop : function() {
                        renderPaths();
                    },

                    removeLcpSourcePath : function() {
                        removeLayer("lcpSourcePath");
                    },

                    removeBufferKml : function() {
                        removeLayer("bufferKmlLayer");
                    },

                    removeCostSurface : function() {
                        removeLayer("imageLayer");
                    },

                    removePathBuffers : function() {
                        removeLayer("pathBuffersKmlLayer");
                    },

                    removePathKml : function() {
                        removeLayer("pathKmlLayer");
                    },

                    zoomToBufferlLayer : function() {
                        // Use the first in the list of entitiesDS
                        layerIndexes.some(function(name) {
                            var layer = layers[name];
                            if(layer) {
                                mapHelper.zoomToBounds(layer.getBounds());
                                return true;
                            }
                            return false;
                        });
                    },

                    toggleLcpSourcePath : function(geometry) {
                        var showing = isShowingLayer("lcpSourcePath");
                        if(showing) {
                            this.removeLcpSourcePath();
                        } else {
                            this.showLcpSourcePath(geometry);
                        }
                        return !showing;
                    },

                    showLcpSourcePath : function(geometry) {
                        this.removeLcpSourcePath();
                        layers.lcpSourcePath = L.polyline(geometry, {
                            width: 2,
                            color: '#000',
                        });
                        renderPaths();
                    },

                    toggleCostSurface : function(imageExtent) {
                        var showing = isShowingLayer("imageLayer");
                        if(showing) {
                            this.removeCostSurface();
                            this.removePathBuffers();
                        } else {
                            this.showCostSurface(imageExtent);
                        }
                        return !showing;
                    },

                    showCostSurface : function( imageExtent) {
                        this.removeCostSurface();
                        // We render the outline first
                        this.showPathBuffers(imageExtent.outline).then(function() {
                            new L.KML(imageExtent.extent, { async: true }).on("loaded", function(e) {
                                layers.imageLayer = L.imageOverlay(imageExtent.image, e.target.getBounds(), {
                                    opacity: 0.7
                                });
                                renderPaths();
                            });
                        });
                    },

                    showPathBuffers : function(url) {
                        var deferred = $q.defer();
                        this.removePathBuffers();
                        layers.pathBuffersKmlLayer = new L.KML(url, { async: true });
                        layers.pathBuffersKmlLayer.on("loaded", function(e) {
                            e.target.setStyle({
                               width: 2,
                                color: "#44ee11",
                                fillColor: "#ccff77",
                                fillOpacity: 0.15
                            });
                            deferred.resolve(e.target);
                        });
                        return deferred.promise;
                    },

                    toggleBufferKml : function(url) {
                        var showing = isShowingLayer("bufferKmlLayer");
                        if(showing) {
                            this.removeBufferKml();
                        } else {
                            this.showBufferKml(url);
                        }
                        return !showing;
                    },

                    showBufferKml : function(url) {
                        this.removeBufferKml();
                        layers.bufferKmlLayer = new L.KML(url, { async: true });
                        layers.bufferKmlLayer.on("loaded", function(e) {
                            e.target.setStyle({
                                width: 2,
                                color: "#ff4411",
                                fillColor: "#bbff55",
                                fillOpacity: 0.3
                            });
                        });
                        renderPaths();
                    },

                    togglePathKml : function(url) {
                        var showing = isShowingLayer("pathKmlLayer");
                        if(showing) {
                            this.removePathKml();
                        } else {
                            this.showPathKml(url);
                        }
                        return !showing;
                    },

                    showPathKml : function(url) {
                        this.removePathKml();
                        layers.pathKmlLayer = new L.KML(url, { async: true });
                        layers.pathKmlLayer.on("loaded", function(e) {
                            e.target.setStyle({
                                width: 2,
                                color: "#ff9933",
                                fillColor: "ffcc66",
                                fillOpacity: 0.5
                            });
                        });
                        renderPaths();
                    },

                    getResourceUrl : function(jobId, param) {
                        var deferred = $q.defer();
                        httpData.get("service/proxied/lcpService/jobs/" + jobId + "/results/" + param + "?f=json").then(function(response) {
                            if(response.data && response.data.value) {
                                deferred.resolve(response.data.value.url);
                            }
                            deferred.reject();
                        });
                        return deferred.promise;
                    },

                    getLeastCostPath : function(geometry, weightings, bufferPercent) {
                        var wktStr = Exp.Util.toLineStringWkt(geometry),
                            deferred = $q.defer(),
                            weightArray = [],
                            complete = false;

                        showInterimPath();
                        flashService.add("Initiating least cost path process...", 3000);

                        $timeout(function() {
                            if(!complete) {
                                notificationFlash = flashService.add("Least cost path process is running.", 120000, true);
                            }
                        }, 4500);

                        // We have to send the data as urlencoded parameters instead of JSON <doh/>
                        angular.forEach(weightings, function(item, key) {
                            if(item.selected) {
                                weightArray.push('["' + key + '","' + item.label + '",' + item.value + "]");
                            }
                        });

                        httpData.get("service/proxied/lcpService/submitJob", {
                            params: {
                                wkt : wktStr,
                                wTable : "[" + weightArray.join() + "]",
                                f : 'json',
                                buffPct:bufferPercent,
                                returnZ : false,
                                returnM : false
                            }
                        }).then(function(response) {
                            var jobId = response.data.jobId, count = 0;

                            $timeout(poll, 12000);

                            function poll() {
                                count++;
                                httpData.get("service/proxied/lcpService/jobs/" + jobId + "?f=json").then(function(message) {
                                    var status = message.data.jobStatus;
                                    if(status == "esriJobSucceeded" || status == "esriJobFailed") {
                                        var screenMessage = "A least cost process has completed";
                                        if(message.data && message.data.jobStatus == "esriJobFailed") {
                                            screenMessage = "A least cost process has failed";
                                        }
                                        complete = true;
                                        flashService.remove(notificationFlash);
                                        flashService.add(screenMessage, 4000);

                                        deferred.resolve(message);
                                    } else if(count++ < 100 ) {
                                        $timeout(poll, 4000);
                                    }
                                });
                            }
                        });
                        return deferred.promise;
                    },

                    getPathGeometry : function() {
                        return pathGeometry;
                    },

                    setPathGeometry : function(geometry) {
                        pathGeometry = geometry;
                    },

                    weightings : function() {
                        var deferred = $q.defer();

                        httpData.get("resources/config/defaultLeastCostPathWeightings.json", {cache:true}).then(function(response) {
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
            $templateCache.put("map/leastCostPath/draw.html",
                    '<div class="popover bottom lcpPathDisplay" mars-lcp-path ng-show="show || resistanceCategories">' +
                    '	<div class="arrow"></div>' +
                    '	<div class="popover-inner">' +
                    '		<div class="pathHeader">' +
                    '			<span style="font-weight:bold">Least Cost Path</span><div style="float:right" ng-show="distance">{{(distance/1000) | number : 3}}km</div>' +
                    '		</div>' +
                    '       <div ng-hide="resistanceCategories">' +
                    '		   <div ng-show="points.length == 0">Click on map to start path. Double click to end path.</div>' +
                    '		   <div ng-show="points.length > 0">Drag vertices with mouse to change waypoints. Hover over waypoints and use the delete key to remove.</div>' +
                    '		   <div style="font-weight:bold;text-align:center" ng-cloak ng-show="distance > 300000">Reduce the length of your path. <br/>A limit of 300k applies.</div>' +
                    '		   <div class="buttons">' +
                    '			  <button ng-show="points.length > 1" type="button" class="btn btn-default" style="width:98%;margin:2px" ng-click="pathComplete($event)" ng-disabled="distance > 300000">Least cost path...</button>' +
                    '		   </div>' +
                    '       </div>' +
                    '	</div>' +
                    '	<div least-cost-weightings weightings="resistanceCategories" path-geometry="pathGeometry" class="expWeightings" success="disable"></div>' +
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
                var value = lookup[key];
                return (value || { name : key,	fileType: ""})[type || "name"];
            };
        }]);


})(angular, L);