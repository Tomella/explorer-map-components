/*!
 * Copyright 2015 Geoscience Australia (http://www.ga.gov.au/copyright.html)
 */
(function(angular) {
'use strict';
/**
 * Uses: https://raw.githubusercontent.com/seiyria/angular-bootstrap-slider
 */
angular.module('geo.baselayer.control', ['geo.maphelper', 'geo.map', 'ui.bootstrap-slider'])

.directive('geoBaselayerControl', ['$rootScope', 'mapHelper', 'mapService', function($rootScope, mapHelper, mapService) {
	var DEFAULTS = {
		maxZoom: 12
	};
	
	return {
		template : '<slider min="0" max="1" step="0.1" ng-model="slider.opacity" updateevent="slideStop"></slider>',
		scope: {
			maxZoom: "="
		},
		link : function(scope, element) {
			if(typeof scope.maxZoom == "undefined") {
				scope.maxZoom = DEFAULTS.maxZoom;
			}
			scope.slider = {
				opacity:1,
				visibility:true, 
				lastOpacity:1 
			};
			
			// Get the initial value
			mapHelper.getPseudoBaseLayer().then(function(layer) {
				scope.layer = layer;
				scope.slider.opacity = layer.options.opacity;	
				scope.$watch("slider.opacity", function(newValue, oldValue) {
					scope.layer.setOpacity(newValue);
				});
			});
			
			mapService.getMap().then(function(map) {
				map.on("zoomend", execute);
				
				function execute() {
					var zoom = map.getZoom();

					if(scope.lastZoom < scope.maxZoom) {
						scope.lastOpacity = scope.layer.options.opacity;
					}
					
					if(zoom == scope.maxZoom) {
						if(scope.lastZoom > scope.maxZoom) {
							if(scope.lastOpacity < 0.5) {					
								scope.slider.opacity = scope.lastOpacity;
								scope.layer.setOpacity(scope.lastOpacity);					
							} else {		
								scope.slider.opacity = 0.5;
								scope.layer.setOpacity(0.5);			
							}							
						} else if(scope.slider.opacity > 0.5) {							
							scope.slider.opacity = 0.5;
							scope.layer.setOpacity(0.5);
						}
						scope.slider.visibility = false;
						setEnabled(false);
					} else if(zoom < scope.maxZoom) {
						if(scope.lastZoom <= scope.maxZoom) {
							scope.slider.opacity = scope.lastOpacity;
							scope.layer.setOpacity(scope.lastOpacity);
						}
						setEnabled(true);
					} else if(zoom > scope.maxZoom && scope.lastZoom <= scope.maxZoom) {
						scope.slider.visibility = false;
						scope.slider.opacity = 0;
						setEnabled(false);
					}					
					scope.lastZoom = zoom;
					
				}
				
				// Bit of a nasty workaround for the thing not working out the angular component 
				function setEnabled(enable) {
					$(element).find(".slider-input").eq(0).slider(enable?"enable":"disable");
				}
			});
		}
	};
}])

.run(['$rootScope', 'mapService', 'flashService', function($rootScope, mapService, flashService) {
	var showingMessage;
	
    mapService.getMap().then(function(map) {
    	map.oldZoomTo = map.zoomTo;
    	map.zoomTo = function(value) {
    		this.layers.forEach(function(layer) {
    			if(layer.pseudoBaseLayer && layer.visibility) {
    				var oldZoom    = map.zoom,
    					thresholdOpacity = 0.4,
    					thresholdZoom = layer.numZoomLevels,
    					isBlank = value > thresholdZoom -2,
    					isShowable = value < thresholdZoom - 1,
    					isHalf = value == thresholdZoom - 2,
    				
    					oldIsShowable = oldZoom < thresholdZoom - 1,
    					oldIsHalf = oldZoom == thresholdZoom - 2,
    					goingUp = value > oldZoom,
    					goingDown = value < oldZoom;
    				
    			
   					// Do we show a message?
   					if(goingUp) {
   						if(thresholdZoom <= value + 1 && !showingMessage) {
   							showingMessage = true;
   							flashService.add("No detail available at this scale for " + layer.name, 3000);
   							$rootScope.$broadcast('overlay.has.detail', false);
   						}
   					} else {
   						showingMessage = false;
   					}
    			
   					// Do we notify to enable the slider
   					if(isShowable) {
   						$rootScope.$broadcast('overlay.has.detail', true);
   					}
    			
   					// Do we save the opacity?
   					if(goingUp && oldIsShowable) {
   						if((isHalf || isBlank) && !oldIsHalf) {
   							layer.restoreOpacity = layer.opacity;
   						}
   						// 	Are we at that half way point?
   						if(layer.opacity >= thresholdOpacity && isHalf) {
   							layer.setOpacity(thresholdOpacity);
   						}
   					}
    					
   					if(isBlank && layer.opacity) {
   						layer.setOpacity(0);
   					}
    			
   					// Do we clobber restoreOpacity
   					if(goingDown && isShowable) {
   						// If its half we restore to half
   						if(isHalf) {
   							// unless it is already set
   							if(!layer.opacity) {
   								layer.setOpacity(layer.restoreOpacity < thresholdOpacity?layer.restoreOpacity:thresholdOpacity);
   							}
   						} else if(layer.restoreOpacity) {
   							layer.setOpacity(layer.restoreOpacity);
   							layer.restoreOpacity = null;
   						}
   					}
    			}
    		});
    		this.oldZoomTo(value);
    	};
    });
}]);

})(angular);