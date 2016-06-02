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

    var service = {}, callback, polygonDrawer, polylineDrawer, rectangleDrawer;

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
            map.on("draw:created", function(event) {
                if (callback) ({
                    polygon : function() {
                        callback(event.layer.getLatLngs());
                    },
                    polyline : function() {
                        callback({length:event.layer.getLength(), positions:event.layer.getLatLngs()});
                    },
                    rectangle : function() {
                        callback(event.layer.getBounds());
                    }
                })[event.layerType]();
                broadcastDrawState(false);
            });
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
        callback = options.callback;
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
        callback = options.callback;
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
        callback = options.callback;
        rectangleDrawer.enable();
    };

    service.stopDrawing = function(){
        callback = undefined;
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