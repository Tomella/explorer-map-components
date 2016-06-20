/*!
 * Copyright 2016 Geoscience Australia (http://www.ga.gov.au/copyright.html)
 */
/**
 * This version relies on 0.0.4+ of explorer-path-server as it uses the URL for intersection on the artesian basin plus the actual KML
 */
(function (angular, Exp) {
    'use strict';

    function TerrainLoader(options) {
        options = options || {};

        this.load = function(url, onload, onerror) {
            var request = new XMLHttpRequest();

            request.addEventListener( 'load', function ( event ) {
                var parser = new GeotiffParser();
                parser.parseHeader(event.target.response);
                onload(parser.loadPixels());
            }, false );


            if ( onerror !== undefined ) {
                request.addEventListener( 'error', function ( event ) {
                    onerror( event );
                }, false );
            }

            if ( options.crossOrigin !== undefined ) {
                request.crossOrigin = options.crossOrigin;
            }

            request.open( 'GET', url, true );
            request.responseType = 'arraybuffer';
            request.send( null );
        };

        this.setCrossOrigin = function( value ) {
            options.crossOrigin = value;
        };
    }

    angular.module("geo.transect", ['explorer.config','explorer.feature.summary','explorer.flasher','geo.path'])

        .provider("transectService", function() {
            var diagonal = 500,
                layers = {},
                ptElevationUrl,
                extent = {
                    lngMin: 112.99986111100009,
                    lngMax: 153.999861113351,
                    latMin: -44.0001389004617,
                    latMax: -10.00013890099995
                };

            this.extent = function(newExtent) {
                extent.lngMin = angular.isUndefined(newExtent.lngMin)? extent.lngMin: newExtent.lngMin;
                extent.lngMax = angular.isUndefined(newExtent.lngMax)? extent.lngMax: newExtent.lngMax;
                extent.latMin = angular.isUndefined(newExtent.latMin)? extent.latMin: newExtent.latMin;
                extent.latMax = angular.isUndefined(newExtent.latMax)? extent.latMax: newExtent.latMax;
            };

            this.setServiceUrl = function(name, url) {
                name = name.toLowerCase();
                layers[name] = {
                    urlTemplate: url
                };
                if (name === "elevation") ptElevationUrl = url.replace(/{height}|{width}/g,"1");
            };

            function calcSides(diagonal, ar) {
                // x * x + ar * ar * x * x = diagonal * diagonal
                // (1 + ar * ar) * x * x = diagonal * diagonal
                // x * x = diagonal * diagonal / (1 + ar * ar)
                var y = Math.sqrt(diagonal * diagonal / (1 + ar * ar));
                return {y: Math.ceil(y), x: Math.ceil(y * ar)};
            }

            this.$get = ['$q', 'httpData', 'flashService', function ($q, httpData, flashService) {

                return {
                    getElevation: function (geometry, buffer) {
                        return this.getServiceData("elevation", geometry, buffer);
                    },

                    getServiceData: function (name, geometry, buffer) {
                        var flasher = flashService.add("Retrieving " + name + " details...", 8000),
                            feature = Exp.Util.toGeoJSONFeature(geometry),
                            bbox = turf.extent(feature),
                            response  = {
                                type: "FeatureCollection",
                                features: []
                            },
                            lngMin = bbox[0],
                            latMin = bbox[1],
                            lngMax = bbox[2],
                            latMax = bbox[3];

                        // Sanity check for service url
                        name = name.toLowerCase();
                        var svcUrl = layers[name] && layers[name].urlTemplate;
                        if (!svcUrl) return $q.when(response);

                        // Sanity check for coordinates
                        lngMax = lngMax > lngMin?lngMax:lngMin + 0.0001;
                        latMax = latMax > latMin?latMax:latMin + 0.0001;
                        var dx = lngMax - lngMin, dy = latMax - latMin;
                        if (!buffer) buffer = 0;
                        latMin = latMin - (buffer * dy);
                        latMax = latMax + (buffer * dy);
                        lngMin = lngMin - (buffer * dx);
                        lngMax = lngMax + (buffer * dx);

                        var xy = calcSides(diagonal, dx/dy),
                            kiloms = turf.lineDistance(feature, "kilometers"),
                            terrainLoader = new TerrainLoader(),
                            deferred = $q.defer();
                        svcUrl = svcUrl.replace("{bbox}", lngMin + "," + latMin + "," + lngMax + "," + latMax)
                            .replace(/{width}/g, ""+Math.ceil(xy.x)).replace(/{height}/g, ""+Math.ceil(xy.y));
                        terrainLoader.load(svcUrl, function(loaded) {
//                            console.log("width: " + xy.x + ", height: " + xy.y + "calculated cells = " + (xy.x * xy.y) + " loaded length = " + loaded.length);

                            var delta = kiloms / (diagonal - 1);
                            for (var i = 0; i < diagonal; i++) {
                                var deltaFeature = turf.along(feature, i * delta, "kilometers");
                                deltaFeature.geometry.coordinates.push(toHeight(deltaFeature.geometry.coordinates));
                                response.features.push(deltaFeature);
                            }
                            deferred.resolve(response);

                            function toHeight(coord) {
                                var x = coord[0], y = coord[1], zeroX = lngMin, zeroY = latMax,
                                    cellY = Math.round((zeroY - y) / dy * (xy.y - 1)),
                                    cellX = Math.round((x - zeroX) / dx * (xy.x - 1)),
                                    index = cellY * xy.x + cellX;
                                // console.log("Cell x = " + cellX + ", y = " + cellY + " Index = " + index + ", value = " + loaded[index]);
                                return loaded[index];
                            }
                        });

                        return deferred.promise;
                    },

                    canGetElevationAtPoint: function () {
                        return ptElevationUrl;
                    },

                    getElevationAtPoint: function (latlng) {
                        var lng = latlng.lng, lat = latlng.lat;
                        if (lat < extent.latMin || lat > extent.latMax || lng < extent.lngMin || lng > extent.lngMax)
                            return $q.when(null);

                        var bbox = [
                            lng - 0.000001,
                            lat - 0.000001,
                            lng + 0.000001,
                            lat + 0.000001
                        ];
                        var deferred = $q.defer();
                        new TerrainLoader().load(ptElevationUrl.replace("{bbox}", bbox.join(",")), function(elev) {
                            deferred.resolve(elev);
                        });
                        return deferred.promise;
                    }
                };

            }];
        });

})(angular, Exp);