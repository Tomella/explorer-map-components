/*!
 * Copyright 2015 Geoscience Australia (http://www.ga.gov.au/copyright.html)
 */
(function(angular, context) {
'use strict';

angular.module("explorer.feature.summary", ["geo.map"])

.directive("expPointFeatures", ['mapService', 'featureSummaryService', function(mapService, featureSummaryService) {
	return {
		scope : {
			features:"="
		},
		link:function(scope, element) {
			scope.$watch("features", function(data, old) {
				if(scope.features) {
					featureSummaryService.showPopup(scope.features);
				} else if(old){
					featureSummaryService.hidePopup();
				}
			});
			
		}
	};
}])

.directive("featuresUnderPoint", ['$timeout', 'featureSummaryService', 'mapService', function($timeout, featureSummaryService, mapService) {
	var DELAY = 400;
	return {
		restrict :"AE",
		scope : true,		
		link : function(scope, element) {
			mapService.getMap().then(function(map) {
				var timeout, control = L.control.features();
				
				map.addControl(control);
				map.on("featuresactivate", featuresActivated);
				map.on("featuresdeactivate", featuresDeactivated);
				
				function featuresActivated(event) {
					map.on("mousemove", moveHandler);
					map.on("mouseout", moveCancel);
				}
				
				function featuresDeactivated(event) {
					$timeout.cancel(timeout);
					featureSummaryService.hidePopup();
					map.off("mousemove", moveHandler);
					map.off("mouseout", moveCancel);
				}
				
				function moveCancel() {
					$timeout.cancel(timeout);					
				} 
				
				function moveHandler(event) {
					$timeout.cancel(timeout);
					timeout = $timeout(function() {
						var position = {
							markerLonLat : event.latlng,
							point:{x:event.latlng.lng, y:event.latlng.lat}
						};
						featureSummaryService.getAndShowFeatures(position);
					}, DELAY);
				}
			});			
		}
	};
}])

.factory("featureSummaryService", ['$log', 'configService', 'mapService', '$timeout', '$rootScope', '$q', '$http', function($log, configService, mapService, $timeout, $rootScope, $q, $http) {
	var featuresUnderPointUrl = "service/path/featureCount",
		featuresUnderPoint,
		map, marker, 
		lastDeferredTimeout,
		control;
	
	mapService.getMap().then(function(olMap) {
		map = olMap; 
	});
	
	return {
		getAndShowFeatures : function(position) {
			this.view(position).then(function(features) {
				this.showPopup(features);
			}.bind(this));
		},
		
		showPopup : function(features) {
			var latlng = features.position.point;

			mapService.getMap().then(function(map){
				var buffer = [];
				angular.forEach(features.data, function(val, key) {
					buffer.push(key + " (" + val + ")");
				});
					
				L.popup()
			   		.setLatLng([latlng.y, latlng.x])
			   		.setContent(buffer.length?buffer.join('<br />'):"No nearby features")
			   		.openOn(map);
			});						 
		},		
		
		hidePopup : function() {
			// Blow away the popup if we no longer have features.
			mapService.getMap().then(function(map) {
				map.closePopup();
			});
		},
		
		view : function(position) {
			var deferred = $q.defer();
			
			lastDeferredTimeout = null;
			if(position.point) {
				this.featuresUnderPoint(position.point).then(function(data) {
					var count = 0;
					angular.forEach(data, function(item) {
						count += item;
					});
				
					deferred.resolve({data:data, position:position, count:count});
				});
			}
			return deferred.promise;
		},
		
		deferView : function(position) {
			var self = this, 
				deferred = $q.defer();
			
			this.cancelView();
			lastDeferredTimeout = $timeout(function(){
				self.view(position).then(function(data) {
					deferred.resolve(data);
				});
			}.bind(this), 200);
			
			return deferred.promise;
		},
		
		cancelView : function() {
			if(lastDeferredTimeout) {
				$timeout.cancel(lastDeferredTimeout);
			}
		},
		
		clearView : function() {
			
		},
		
		onMapMove : function(callback) {
			$log.debug("Adding event handler");			
			map.on("moveend", map, callback);
			return callback;
		},
		
		offMapMove : function(callback) {
			$log.debug("Removing event handler");
			map.off("moveend", map, callback);
		},
		
		positionFromLonlat : function(lonlat) {
			var lat = lonlat.lat?lonlat.lat:lonlat.y,
				lon = lonlat.lon?lonlat.lon:lonlat.x,
				wrap = [lat, lon];
			
			var position = map.project(wrap);
			

			console.log([wrap, position]);
			return position;
		},
		
		getViewPort : function() {
			return  map._container.getBoundingClientRect();
		},
		
		featuresUnderPoint : function(point) {
			var deferred = $q.defer(),
				bounds = map._container.getBoundingClientRect(),
				ratio = (window.devicePixelRatio)?window.devicePixelRatio : 1,
				extent = map.getBounds();
			
			configService.getConfig("clientSessionId").then(function(id) {			
				$http.post(featuresUnderPointUrl, {
					clientSessionId:id,
					x:point.x, 
					y:point.y,
					width:bounds.width / ratio, 
					height:bounds.height / ratio,
					extent : {
						left : extent.left,
						right : extent.right,
						top: extent.top,
						bottom: extent.bottom
					}}).then(function(response) {
						deferred.resolve(response.data);
				});
				
			});

			return deferred.promise;
		}
	};
}]);

})(angular, window);