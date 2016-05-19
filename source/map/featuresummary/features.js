/*!
 * Copyright 2015 Geoscience Australia (http://www.ga.gov.au/copyright.html)
 */
(function (angular, L) {
    'use strict';

    angular.module("explorer.features", ['geo.maphelper', "explorer.httpdata"])

        .directive('featureSummaryToggle', ['mapHelper', function (mapHelper) {
            return {
                template: '<i class="fa fa-location-arrow fa-rotate-180"></i>',
                link: function(scope) {
                    scope.$watch("unlinked", function(unlinked) {
                        mapHelper.fireEvent(unlinked.featureSummary? "featuresactivate": "featuresdeactivate");
                    }, true);
                }
            };
        }])

        .directive('featureGridToggle', ['mapHelper', function (mapHelper) {
            return {
                template: '<i class="fa fa-th"></i>',
                link: function(scope) {
                    scope.$watch("unlinked", function(unlinked) {
                        mapHelper.showGrid(unlinked.featureGrid);
                    }, true);
                }
            };
        }])

        .directive("xmarsPointFeatures", ['httpData', function (httpData) {
            var anchorLeftTopMap = {
                "rx_gt_lx": {
                    "by_gt_ty": "leftTop",
                    "by_le_ty": "leftBottom"
                },
                "rx_le_lx": {
                    "by_gt_ty": "rightTop",
                    "by_le_ty": "rightBottom"
                }
            };

            return {
                templateUrl: "cesium/featuresSummary.html",
                scope: {
                    features: "="
                },
                link: function (scope, element) {
                    var unregister = scope.$watch("features", function () {
                        if (scope.features) {
                            httpData.get("resources/config/mars_feature_icon_mapping.json", {cache: true}).then(function (response) {
                                scope.mappings = response && response.data;
                                unregister();
                            });
                        }
                    });

                    scope.featurePanelPosition = function () {
                        if (!scope.features || !scope.features.data) {
                            return {left: -300, top: -200};
                        }
                        var textElement = element.find(".marsfeatures")[0],
                            textBox = {
                                element: textElement,
                                connectionPoint: null
                            },
                            x = scope.features.mousePos.x,
                            y = scope.features.mousePos.y,
                            box = scope.features.viewer.canvas,
                            rightX = box.width - x,
                            leftX = x,
                            topY = y,
                            bottomY = box.height - y,
                            anchorLeft = rightX > leftX ? "rx_gt_lx" : "rx_le_lx",
                            anchorTop = bottomY > topY ? "by_gt_ty" : "by_le_ty",
                            bottomOffset = scope.features.maxExtent ? 20 : 140;

                        // Let the object look after itself.
                        textBox.connectionPoint = function () {
                            var textBox = this.element.getBoundingClientRect(),
                                top = anchorTop ? y + 10 : y - textBox.height - 10,
                                left = anchorTop ? x + 10 : x - textBox.width - 10;
                            if (top < 20) {
                                top = 20;
                            } else if ((y + textBox.height) > (box.height - bottomOffset)) {
                                top = box.height - bottomOffset - textBox.height;
                            }
                            if (left < 20) {
                                left = 20;
                            } else if ((left + textBox.width) > (box.width - 20)) {
                                left = box.width - 20 - textBox.width;
                            }
                            return {left: left, top: top + 80};
                        };
                        scope.features.popupClass = anchorLeftTopMap[anchorLeft][anchorTop];

                        return textBox.connectionPoint();
                    };
                }
            };
        }])

        .directive("xfeaturesUnderPoint", ['featuresService', function (featuresService) {
            return {
                restrict: "EA",
                template: '<div mars-point-features features="featuresUnderPoint" class="featuresUnderPoint"></div>',
                link: function (scope) {
                    featuresService.setSummaryHandler(function (features) {
                        scope.featuresUnderPoint = features;
                    });
                }
            };
        }])

        .factory("featuresService", ['configService', 'viewerService', 'viewerUtilsService', '$timeout', '$rootScope', '$q', 'httpData', function (configService, viewerService, viewerUtilsService, $timeout, $rootScope, $q, httpData) {
            var clientSessionId,
                pixelRatio = window.devicePixelRatio || 1,
                featureCountUnderPointUrl = "service/path/featureCount",
                featureInfoUnderPointUrl = "service/path/featureInfo",
                ignorePendingSummaryResponse = true, // when summary is hidden during pending ajax call
                featuresHandler,
                mouseHoverOff,
                mouseMovedOff;

            function getFeatures(viewer, carto, url) {
                if (!carto) return $q.when(null);

                var deferred = $q.defer(), extent = viewerUtilsService.getBounds(viewer);
                httpData.post(url || featureCountUnderPointUrl, {
                    clientSessionId: clientSessionId,
                    x: Cesium.Math.toDegrees(carto.longitude),
                    y: Cesium.Math.toDegrees(carto.latitude),
                    width: viewer.canvas.width / pixelRatio,
                    height: viewer.canvas.height / pixelRatio,
                    extent: {
                        left: extent.left,
                        right: extent.right,
                        top: extent.top,
                        bottom: extent.bottom
                    }})
                    .then(function (response) {
                        deferred.resolve(response && response.data);
                    }, function () {
                        deferred.resolve(null);
                    });

                return deferred.promise;
            }

            function hideSummary() {
                ignorePendingSummaryResponse = true;
                if (featuresHandler) featuresHandler();
            }

            function onMouseMove(event, data) {
                showSummary(data);
            }

            function showSummary(data) {
                if (!featuresHandler) return;
                ignorePendingSummaryResponse = false;
                getFeatures(data.viewer, data.cartographic).then(function (response) {
                    if (!featuresHandler || ignorePendingSummaryResponse) return;
                    var features = {
                        data: response, count: 0, viewer: data.viewer, mousePos: data.mousePos
                    };
                    angular.forEach(features.data || [], function (item) {
                        features.count += item;
                    });
                    featuresHandler(features);
                });
            }

            return {
                getDetailsAtCartesian: function(cartesian) {
                    return viewerService.getViewer().then(function(viewer) {
                        return getFeatures(viewer,
                            Cesium.Ellipsoid.WGS84.cartesianToCartographic(cartesian),
                            featureInfoUnderPointUrl
                        );
                    });
                },

                setSummaryHandler: function (handler) {
                    configService.getConfig("clientSessionId").then(function (id) {
                        clientSessionId = id;
                        featuresHandler = handler;
                    });
                },

                showSummaryAtCartesian: function(cartesian) {
                    if (cartesian) {
                        viewerService.getViewer().then(function(viewer) {
                            showSummary({
                                cartesian: cartesian,
                                cartographic: Cesium.Ellipsoid.WGS84.cartesianToCartographic(cartesian),
                                mousePos: Cesium.SceneTransforms.wgs84ToWindowCoordinates(viewer.scene, cartesian),
                                viewer: viewer
                            });
                        });
                    } else {
                        hideSummary();
                    }
                },

                trackMouseMove: function (enable) {
                    viewerService.showGrid(enable);
                    if (enable) {
                        if (!mouseHoverOff) {
                            mouseHoverOff = $rootScope.$on('viewer.mouse.hover', onMouseMove);
                            mouseMovedOff = $rootScope.$on('viewer.mouse.moved', hideSummary);
                        }
                    } else {
                        hideSummary();
                        if (mouseHoverOff) {
                            mouseHoverOff();
                            mouseMovedOff();
                            mouseHoverOff = mouseMovedOff = undefined;
                        }
                    }
                }
            };
        }]);
})(angular, L);