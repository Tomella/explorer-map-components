/*!
 * Copyright 2015 Geoscience Australia (http://www.ga.gov.au/copyright.html)
 */

'use strict';

angular.module("geo.zoom", [])

.directive('geoZoomExtent', ['zoomService', 'flashService', function(zoomService, flashService) {
    return {
    	restrict: "AE",
    	scope : {
    		item : "="
    	},    	
    	link : function(scope, element, attr) {
    		element.on("click", prepareZoom);
    		
			function prepareZoom() {
				var oldValue = scope.item,
					newValue = (oldValue == "zoomIn")?"":"zoomIn";
				
				if(oldValue == "zoomIn") {
					zoomService.deactivateBoundingBox();
				} else if(newValue == 'zoomIn') {
					flashService.add("Drag diagonally to zoom to an area", 4000);
					zoomService.activateBoundingBox().then(function(extent){
						scope.item = "";
						zoomService.zoomTo(extent);
					});
				}				
				scope.item = newValue;
			}
    	}
    };
}])

.directive('geoZoomOutExtent', ['zoomService', function(zoomService) {
    return {
    	template:'<i class="fa fa-search-minus"></i>',
    	link : function(scope, element, attr) {
			element.on("click", function() {
				zoomService.zoomOut();
			});
    	}
    };
}])

.factory("zoomService", ['mapService', '$log', '$q', function(mapService, $log, $q) {
	var bboxControl, bboxLayer, zoomContainer = {};
	return {
		activateBoundingBox : function() {
			// Lots of verbose OpenLayers follows
			zoomContainer.deferred = $q.defer();
			if(bboxControl == null) {				
				bboxLayer = new OpenLayers.Layer.Vector("Prepare to define an area to zoom to");
				bboxControl = new OpenLayers.Control.DrawFeature(bboxLayer,
						OpenLayers.Handler.RegularPolygon, {
						handlerOptions: {
							sides: 4,
							irregular: true
						},
						featureAdded : function() {
							$log.debug("Bounding box drawn");
							mapService.getMap().then(function() {
								var feature = bboxLayer.features[0],
			            			bounds = feature.geometry.clone().getBounds();
								bboxControl.deactivate();
								bboxLayer.destroyFeatures();
								zoomContainer.deferred.resolve(bounds);
							});        
						}	
				});
			
				mapService.getMap().then(function(map) {
					map.addLayer(bboxLayer);
					map.addControl(bboxControl);
					bboxControl.activate();					
				});				
			} else {
				bboxControl.activate();
			}
			return zoomContainer.deferred.promise;					
		},
	
		zoomTo : function(bounds) {
			bboxLayer.map.zoomToExtent(bounds);			
		},
		
		zoomOut : function() {
			mapService.getMap().then(function(map) {
				var newZoom, zoom = map.zoom;
				if(zoom <= map.getMinZoom()) {
					return;
				} 				
				if(zoom < 10) {
					newZoom = zoom - 1;
				} else if(zoom < 13) {
					newZoom = zoom - 2;
				} else {
					newZoom = zoom - 3;
				}
				map.zoomTo(newZoom);				
			});
		},
		
		deactivateBoundingBox : function() {
			if(this.isActiveBoundingBox()) {
				bboxControl.deactivate();
			}
			if(bboxLayer) {
				bboxLayer.removeAllFeatures();
			}
		},
	
		isActiveBoundingBox : function() {
			return bboxControl != null && bboxControl.active;
		},
		
		destroyBoundingBox : function() {
			if(bboxControl) {
				mapService.getMap().then(function(map){
					map.removeControl(bboxControl);
					map.removeLayer(bboxLayer);
					bboxControl.destroy();
					bboxControl = bboxLayer = null;	
				});
			}
		}
	};
}]);