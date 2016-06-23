/**
 * Created by danielwild on 26/08/2015.
 * Partially ported to leaflet by jammirali on 1/06/2016.
 */
(function(angular, L) {

'use strict';

angular.module('geo.drawhelper', ['geo.map'])

/**
 * A collection of helper functions for drawing shapes etc.
 *
 * PolyLine (renders with Primitive, for extruded 'fence')
 * Polygon
 * Extent
 *
 */


.factory('drawHelperService', ['$q', '$rootScope', 'mapService', function($q, $rootScope, mapService) {

    var service = {}, drawOptions, polygonDrawer, polylineDrawer, rectangleDrawer;

    service.getDrawHelper = function(){

        if (polygonDrawer) return $q.when(service);

        var deferred = $q.defer();
        mapService.getMap().then(function(map){
            var options = {
               color: '#000099',
               opacity: 0.4
            };
            polygonDrawer = new L.Draw.Polygon(map, options);
            polylineDrawer = new L.Draw.Polyline(map, options);
            rectangleDrawer = new L.Draw.Rectangle(map, options);
            function callCallback(event) {
                if (drawOptions.callback) {
                    var layer = event.layer || (event.layers && event.layers.getLayers()[0]);
                    if (!layer)
                        drawOptions.callback(null);
                    else ({
                        polygon : function() {
                            drawOptions.callback(layer.getLatLngs());
                        },
                        polyline : function() {
                            drawOptions.callback({length:layer.getLength(), positions:layer.getLatLngs()});
                        },
                        rectangle : function() {
                            drawOptions.callback(layer.getBounds());
                        }
                    })[drawOptions._layerType]();
                }
            }
            function doneDrawing(event) {
                callCallback(event);
                broadcastDrawState(false);
            }
            map.on("draw:created", function(event) {
                if (!drawOptions.editable) return doneDrawing(event);
                callCallback(event);
                map.addLayer(drawOptions._editLayer = event.layer);
                event.layer.options.editing = options;
                event.layer.editing.enable();
            });
            map.on("draw:deleted", doneDrawing);
            map.on("draw:edited", doneDrawing);
            map.on("draw:editvertex", callCallback);
            deferred.resolve(service);
        });
        return deferred.promise;
    };

    /**
     *
     * Wrapper for DrawHelper.startDrawingPolyline
     *
     * @param options {
 *      callback: Function,
 *      editable: Boolean,
 *      width: Number, // ignored
 *      geodesic: Boolean // ignored
 * }
     *
     */
    service.drawPolyline = function(options){
        broadcastDrawState(true);
        drawOptions = options;
        drawOptions._layerType = "polyline";
        polylineDrawer.enable();
    };

    /**
     *
     * Wrapper for DrawHelper.startDrawingPolygon
     *
     * @param options {
*      callback: Function,
*       editable: Boolean
* }
     *
     */
    service.drawPolygon = function(options){
        broadcastDrawState(true);
        drawOptions = options;
        drawOptions._layerType = "polygon";
        polygonDrawer.enable();
    };

    /**
     *
     * Wrapper for DrawHelper.startDrawingExtent
     *
     * @param options {
*      callback: Function,
*      editable: Boolean
* }
     *
     */
    service.drawExtent = function(options){
        broadcastDrawState(true);
        drawOptions = options;
        drawOptions._layerType = "rectangle";
        rectangleDrawer.enable();
    };

    service.stopDrawing = function(){
        if (drawOptions && drawOptions._editLayer) {
            var layer = drawOptions._editLayer;
            mapService.getMap().then(function(map) {
                map.removeLayer(layer);
            });
        }
        drawOptions = undefined;
        polygonDrawer.disable();
        polylineDrawer.disable();
        rectangleDrawer.disable();
        broadcastDrawState(false);
    };

    function broadcastDrawState(active){
        $rootScope.$broadcast('drawhelper.active', active);
    }

    return service;

}]);

})(angular, L);