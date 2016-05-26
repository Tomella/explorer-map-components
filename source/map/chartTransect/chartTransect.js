(function(angular, $, d3) {

'use strict';

angular.module('geo.chart.transect', ['geo.transect'])

.directive('chartTransect', [function() {
    return {
        templateUrl : 'map/chartTransect/chartTransect.html',
        controller : 'transectChartController'
    };
}])

.controller('transectChartController', ['$rootScope', '$scope', 'chartState', 'transectChartService',
        function($rootScope, $scope, chartState, transectChartService) {

        $scope.chartState = chartState;
        $scope.transectChartService = transectChartService;

        $rootScope.$on("transect.plot.data", function (event, entity) {

            if (entity && entity.length && entity.positions && entity.positions.length > 1) {

                $scope.positions = entity.positions;
                transectChartService.drawChart(entity);
            }
            else {
                $rootScope.$broadcast("chart.update", {
                    targetChartId: ""
                });
            }
        });
}])

.factory('transectChartService', [
    '$rootScope',
    '$q', '$timeout',
    '$filter',
    'httpData',
    'chartState',
    'crosshairService',
    'mapHelper',
    'mapPanelState',
    'transectService',
    'featureSummaryService',
        function(
            $rootScope,
            $q, $timeout,
            $filter,
            httpData,
            chartState,
            crosshairService,
            mapHelper,
            mapPanelState,
            transectService,
            featureSummaryService
        ) {

        var chartMeta, metaKeys, service = {};
        service.url = "resources/mock-service/explorer-cossap-services/service/path/transect-esri.json"; //""; // set by consumer
        service.propertyColors = {};
        service.targetData = undefined;
        service.pathDistance = undefined;
        service.faultTransected = false;

        service.line = undefined;
        service.entity = undefined;

        service.hideChart = function(hide){
            $rootScope.$broadcast("chart.update", {
                targetChartId: false
            });
        };

        /*

        Convert esriJson geoms into geoJson to be plotted by chart

        TODO - we are crudely tacking on the meta data from a mock file; this meta data
        TODO - should be published and extracted from the service directly, when it's ready

         */
        function esriToGeoJsonReformat(){

            var deferred = $q.defer();
            var geoJsonOut = {
                meta: {},
                data: []
            };

            httpData.get(service.url).then(function(response) {

                var features = response.data.features;

                httpData.get('resources/mock-service/explorer-cossap-services/service/path/transect-esri-meta.json').then(function(response) {

                    // tack on meta data to geojson
                    geoJsonOut.meta = response.data.meta;

                    // loop each feature, and append in expected geojson format
                    for (var i = 0; (i < features.length); i++){

                        // build properties key/values
                        var properties = {}, geom = Terraformer.ArcGIS.parse(features[i].geometry);
                        for (var property in geoJsonOut.meta){
                            if(features[i].attributes[property]){
                                if (property === "ELEVATION")
                                    geom.push(features[i].attributes.ELEVATION);
                                else
                                    properties[property] = features[i].attributes[property];
                            }
                        }

                        geoJsonOut.data.push({
                            properties: properties,
                            geometry: geom
                        });
                    }
                    deferred.resolve(geoJsonOut);
                });
            });

            return deferred.promise;
        }

        service.processGeometry = function() {
            if (service.line) {
                mapHelper.removeLayer(service.line);
                service.line = undefined;
                crosshairService.remove();
                featureSummaryService.hidePopup();
            }
            if (service.entity && service.entity.positions) {
                service.line = L.polyline(service.entity.positions, {color: 'black', weight:2, opacity:0.8});
                mapHelper.addLayer(service.line);
            }
        };

        service.cleanUpCallback = function() {
            service.entity = undefined;
            service.processGeometry();
            document.getElementById("transectChartD3").innerHTML = "";
        };

        service.drawChart = function(entity){
            if (!chartMeta) {
                return httpData.get('resources/mock-service/explorer-cossap-services/service/path/transect.json').then(function(response) {
                    chartMeta = response.data.meta;
                    service.drawChart(entity);
                });
            }

            service.entity = entity;
            service.processGeometry();

            $rootScope.$broadcast("chart.update", {
                targetChartId: "transectChart",
                cleanUpCallback: service.cleanUpCallback
            });

            /*---------------------------------------- D3 -----------------------------------------*/
            // adapted from: http://bl.ocks.org/mbostock/3884955

            var mouseEventsActive = true;
            var xAxisOffset = 70;
            var margin = {top: 50, right: 20, bottom: 30, left: 50};

            // min height 235
            var height = ((document.body.clientHeight * 0.35 > 235) ? document.body.clientHeight * 0.35 : 235) - margin.top - margin.bottom;

            // min width for chart is 1000 - legend width
            var width = document.body.clientWidth - margin.left - margin.right - 275;
            width = (width > 725) ? width : 725;

            // min width for the whole panel is 1000
            var minPanelWidth = width + 260 + margin.left + margin.right;
            service.minPanelWidth = (minPanelWidth > 1000) ? minPanelWidth : 1000;

            var x = d3.scale.linear()
                .range([0, width]);

            var y = d3.scale.linear()
                .range([height, 0]);

            var xAxis = d3.svg.axis()
                .scale(x)
                .orient("bottom")
                .tickValues([0]);

            var yAxis = d3.svg.axis()
                .scale(y)
                .orient("left")
                .innerTickSize(-width)
                .outerTickSize(10)
                .tickPadding(10);

            var line = d3.svg.line()

                // smoothing?
                //.interpolate("basis")

                // cut out NO DATA values..?
                .defined(function(d) { return d.z !== 0; })
                .x(function(d) { return x(+d.x); })
                .y(function(d) { return y(+d.z); });

            var svg = d3.select("#transectChartD3").append("svg")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
                .attr("class", "chart-svg")
                .style("z-index", "2")
                .append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            service.properties = [];
            var propertyNames = [];
            var sortedXArray = [];
            var propertiesMap = {};
            var elevationShown = $q.defer();

            // get our meta data
            // init object for each defined property
            angular.forEach(chartMeta, function(value, key) {
                propertyNames.push(value.label);
                if(key != "FAULT") {
                    service.propertyColors[key] = value.color;
                    service.properties.push(propertiesMap[key] = {
                        name: key,
                        color: value.color,
                        label: value.label,
                        description: value.description,
                        values: []
                    });
                }
                var ii = 1000 * service.properties.length;
                transectService.getServiceData(key, entity.positions).then(function(response) {
                    if (key === "ELEVATION") {
                        showElevation(response.features);
                        redrawLines();
                        elevationShown.resolve(true);
                        if(!$rootScope.$$phase) $rootScope.$apply();
                    } else {
                        elevationShown.promise.then(function() {
                            if (key === "FAULT")
                                showFaults(response.features);
                            else {
                                $timeout(function() {
                                    showOther(key, response.features);
                                    redrawLines();
                                }, ii);
                            }
                            if(!$rootScope.$$phase) $rootScope.$apply();
                        });
                    }
                });
            });

            function getX(v) { return v.x; }
            function getZ(v) { return v.z; }

            function redrawLines() {
                // push the y range out 10% on top so we don't get data hanging outside our scale
                y.domain([
                    d3.min(service.properties, function(c) { return d3.min(c.values, getZ); }),
                    d3.max(service.properties, function(c) { return d3.max(c.values, getZ); }) * 1.1
                ]);
                svg.selectAll(".y.axis").remove();
                svg.append("g").attr("class", "y axis").call(yAxis);

                svg.selectAll(".property").remove();

                svg.selectAll(".property")
                    .data(service.properties)
                    .enter().append("g")
                    .attr("class", "property")
                    .append("path")
                    .attr("class", "line")
                    .attr("d", function(d) { return line(d.values); })
                    .style("stroke", function(d) { return d.color; })
                    .style("stroke-width", 4)
                    .style("z-index", "2")
                    .style("opacity", 0.6);
            }

            var elevdata = null;
            function showElevation(features) {
                elevdata = features;
                var values = propertiesMap.ELEVATION.values;
                var cartoArray = [];
                for(var i = 0; i < features.length; i++){
                    var coords = features[i].geometry.coordinates;
                    values.push({
                        x: coords[0],
                        y: coords[1],
                        z: coords[2]
                    });

                    // cartoArray to calc surface distance
                    cartoArray.push(viewerUtilsService.cartographicFromDegrees(coords[0], coords[1], coords[2]));

                    // for bisect lookup on mouseover
                    sortedXArray.push(coords[0]);
                }

                sortedXArray = sortedXArray.sort();
                service.pathDistance = viewerUtilsService.cartographicArrayToSurfaceDistance(cartoArray);
                service.pathDistance = $filter('length')(service.pathDistance, true);
                x.domain([d3.min(values, getX), d3.max(values, getX)]);

                svg.append("g")
                    .attr("class", "x axis")
                    .attr("transform", "translate(0," + height + ")")
                    .call(xAxis);

                // y label
                svg.append("text")
                    .attr("y", -30)
                    .attr("x", 20)
                    .attr("dy", ".71em")
                    .style("text-anchor", "end")
                    .text("Z (m)");

                // x label
                svg.append("text")
                    .attr("x", width / 2)
                    .attr("y", height + 10)
                    .attr("dy", ".71em")
                    .style("text-anchor", "middle")
                    .style("fill", "#000")
                    .text("Path Distance: "+ service.pathDistance);

                var vertical = d3.select("#transectChartD3")
                    .append("div")
                    .attr("class", "ng-hide")
                    .style("position", "absolute")
                    .style("z-index", "2")
                    .style("width", "2px")
                    .style("height", height+"px")
                    .style("top", "50px")
                    .style("bottom", "0px")
                    .style("left", "20px")
                    .style("margin-left", "-1px")
                    .style("background", "#000");


                d3.select("#transectChartD3")
                    .append("div")
                    .attr("class", "x-index")
                    .style("left", x(x) + xAxisOffset +"px");

                d3.select("#transectChartD3 .chart-svg")
                    .on("mousemove", function(){

                        if(!mouseEventsActive) return;

                        // get pos
                        d3.mousex = d3.mouse(this);
                        d3.mousex = d3.mousex[0] + 20;

                        // update y transect pos
                        if(d3.mousex > xAxisOffset && d3.mousex < width + xAxisOffset){
                            vertical.style("left", d3.mousex + "px" );
                            vertical.attr("class", "ng-show vertical-transect");
                        }
                        else {
                            vertical.attr("class", "ng-hide");
                            return false;
                        }

                        // adjust for svg x offest
                        d3.mousex = d3.mousex - xAxisOffset;

                        // use invertedX value to find index in our lookup array
                        var index = d3.bisectLeft(sortedXArray, x.invert(d3.mousex));
//                        index = sortedXArray.length - index;
                        var target = {};

                        service.properties.forEach(function(property){
                            target[property.name] = property.values[index];
                        });

                        var position = {
                            markerLonLat : L.latlng([target.ELEVATION.x, target.ELEVATION.y]),
                            point:target.ELEVATION
                        };
                        crosshairService.move(position);
                        featureSummaryService.getAndShowFeatures(position);
                        service.targetData = target;

                        if(!$rootScope.$$phase) {
                            $rootScope.$apply();
                        }

                    })
                    .on("mouseover", function() {

                        if(!mouseEventsActive) return;

                        // get pos
                        d3.mousex = d3.mouse(this);
                        d3.mousex = d3.mousex[0] + 20;

                        // update y transect pos
                        if (d3.mousex > xAxisOffset && d3.mousex < width + xAxisOffset) {
                            vertical.style("left", d3.mousex + "px");
                            vertical.attr("class", "ng-show vertical-transect");
                        }
                        else {
                            vertical.attr("class", "ng-hide");
                        }

                    });

                // pin chart for inspection
                d3.select("#transectChartD3")

                    .on("click", function() {

                        // toggle mouseEvents
                        mouseEventsActive = !mouseEventsActive;
                        d3.select(".vertical-transect")
                            .style("width", (mouseEventsActive ? 2 : 4)+"px")
                            .style("margin-left", -(mouseEventsActive ? 1 : 2)+"px");

                        // center target pos
                        if(!mouseEventsActive){
                            mapHelper.zoomToMarkPoints([[service.targetData.ELEVATION.x, service.targetData.ELEVATION.y]]);
                        }
                    });
            }

            function showFaults(features) {
                var parent = d3.select("#transectChartD3");
                for(var i = 0; i < features.length; i++){
                    var coords = features[i].geometry.coordinates;
                    if (coords[2] !== 0){
                        parent.append("div")
                            .attr("class", "fault-transect")
                            .style("height", height+"px")
                            .style("left", x(coords[0]) + xAxisOffset +"px");
                    }
                }
            }

            function showOther(key, features) {
                features = elevdata;
                var values = propertiesMap[key].values;
                var z = Math.random() * 100;
                for(var i = 0; i < features.length; i++){
                    var coords = features[i].geometry.coordinates;
                    values.push({
                        x: coords[0],
                        y: coords[1],
                        z: z += (Math.random() * 10) - 5
                    });
                }
            }

            /*---------------------------------------- /D3 -----------------------------------------*/

        };

        return service;
}]);

})(angular, $, d3);