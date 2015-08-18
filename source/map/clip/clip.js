/*!
 * Copyright 2015 Geoscience Australia (http://www.ga.gov.au/copyright.html)
 */

(function(angular) {
'use strict';

angular.module("mars.clip", ['explorer.asynch', 'openLayers.service', 'explorer.flasher', 'explorer.httpdata', 'explorer.message', 'explorer.persist'])
			
.directive("marsClip", ['$filter', 'clipService', 'flashService', 'messageService', function($filter, clipService, flashService, messageService) {
	return {
		restrict:"AE",
		scope : {
			item : "="
		},
		templateUrl : 'components/clip/clip.html?v=2',
		link : function(scope, element, attrs) {
			scope.noRfcSelector = function() {
				scope.rfcSelector = false;
				clipService.deactivateBoundingBox();
				scope.item = "";
			};
			
			scope.$watch("item", function(newValue, oldValue) {
				if(oldValue == "clip") {
					clipService.deactivateBoundingBox();
				} else if(newValue == 'clip') {
					clipService.activateBoundingBox().then(function(extent) {
						var sqKm = extent.clone().toGeometry().getGeodesicArea() / 1000000;
						if(sqKm > 10000) {
							messageService.error("You selected an area of size " + $filter("number")(sqKm, 0) + " sq km, reduce to under 10,000 sq km.");
							scope.item = "";
							return;
						}
						scope.extent = extent;
						scope.rfcSelector = true;
					});
					flashService.add("Drag the mouse across an area of interest...", 4000);
				}
			});
		}
	};
}])

.directive("marsRfcSelector", ['$log', '$modal', 'flashService', 'clipService', 'persistService', function($log, $modal, flashService, clipService, persistService){	
	return {
		scope:{
			extent:"=",
			hide : "=",
			selector : "="
		},
		link: function(scope, element) {
			var modalInstance;			
			scope.$watch("selector", function(newValue, oldValue) {
				if(newValue) {
					flashService.add("Select the reference feature classes that you want to download.", 4000);
					scope.confirmed = false;
					modalInstance = $modal.open({
						templateUrl: 'components/clip/rfcSelector.html?v=3',
						size: "sm",
						backdrop : "static",
						keyboard : false,
						controller :  ['$scope', '$modalInstance', function($scope, $modalInstance) {
							clipService.getClipShipAndZipClasses().then(function(classes){
								$scope.featureClasses = classes;
								persistService.getItem("rfcSelected").then(function(values) {
									if(values) {
										values.forEach(function(persist) {
											if($scope.featureClasses[persist.key]) {
												$scope.featureClasses[persist.key].clipSelected = persist.value;
											}
										});
									}
								});
							});
							
							persistService.getItem("email").then(function(email) {
								$scope.email = email;
								$scope.oldEmail = email;
							}); 
										
							$scope.startClipZipShip = function() {
								var flash = flashService.add("Initiating clip, ship and zip process.", 5000),
									rfcs = [],
									persist = [];
								angular.forEach($scope.featureClasses, function(item, key) {
									if(item.clipSelected) {
										// The service likes parameters in arrays.
										persist.push({key:key, value:true});
										rfcs.push({data:item, key:key});
									}
								});
								persistService.setItem("rfcSelected", persist);
								
								clipService.initiateShipZip(rfcs, scope.extent, $scope.email).then(function() {
									flash.text = "Clip ship and zip process initiated succesfully";
									cleanUp();
								});				
							};
							
							$scope.cancel = function () {
								cleanUp();
							};
							
							function cleanUp() {
								if($scope.email != $scope.oldEmail) {
									persistService.setItem("email", $scope.email);
									$scope.oldEmail = $scope.email;
								}
							    $modalInstance.dismiss('cancel');
							}
							
							
						}],
						resolve: {
							message : function() {
								return scope.expConfirm;
							}
						}
					});				    
					modalInstance.result.then(function (confirmed) {
						modalInstanceClosed(confirmed);
					},
					function(rejected) {
						modalInstanceClosed(false);						
					});
				}

				function modalInstanceClosed(confirmed) {
					$log.info("Confirmed : " + confirmed);
					if(confirmed) {
						scope.success();
					}
					scope.selector = false;
					scope.hide();
				}
			});
		} 
	};
}])

.factory("clipService", ['$log', '$q', 'asynch', 'mapService', 'httpData', function($log, $q, asynch, mapService, httpData) {
	var bboxControl = null,
		bboxLayer = null,
		lastLayer = null,
		deferred,
		clipShipaAndZipClassesUrl = "resources/config/clipShipaAndZipClasses.json?v=1";
	
	return {
		getClipShipAndZipClasses : function() {
			return httpData.get(clipShipaAndZipClassesUrl, {cache:true});
		},
		
		initiateShipZip : function(rfcs, extent, to) {			
			var wkt = new OpenLayers.Format.WKT().write(new OpenLayers.Feature.Vector(extent.toGeometry())),
				data, fclist = [], names = [];
			
			rfcs.forEach(function(item) {
				fclist.push(item.key);
				names.push(item.data.label);
			});
			
			data = {
					now:Date.now(),
					left:extent.left,
					right:extent.right,
					top:extent.top,
					bottom:extent.bottom,
					envelope : wkt,
					to:to,
					names:names.join(","),
					fcList: fclist.join(","),
					f : "json",
					spatialRef:4326,
					returnM:false,
					returnZ:false
			};
			
			return asynch("clipZipShip", data, {
				urlEncoded : true,
				noWait : true,
				timeToLive:30
			});
		},
		
		activateBoundingBox : function() {
			// Lots of verbose OpenLayers follows
			deferred = $q.defer();
			if(bboxControl === null) {
				bboxLayer = new OpenLayers.Layer.Vector("Prepare clip ship and zip extent");
				bboxControl = new OpenLayers.Control.DrawFeature(bboxLayer,
                     OpenLayers.Handler.RegularPolygon, {
						handlerOptions: {
                        sides: 4,
                        irregular: true
                    },
                    featureAdded : featureAdded            
                });
				
				mapService.getMap().then(function(map) {
					map.addLayer(bboxLayer);
					map.addControl(bboxControl);
					bboxControl.activate();					
				});				
			} else {
				bboxControl.activate();
			}
			return deferred.promise;
			
			function featureAdded() {
				$log.debug("Bounding box drawn");
                mapService.getMap().then(function() {
                	var feature = bboxLayer.features[0],
                		bounds = feature.geometry.clone().transform(new OpenLayers.Projection("EPSG:3857"), new OpenLayers.Projection("EPSG:4326")).getBounds();
                	bboxControl.deactivate();
                	if(lastLayer) {
                		map.removeLayer(lastLayer);
                		lastLayer.destroy();
                	}
                	lastLayer = bboxLayer.clone();
                	lastLayer.name = "Drawn clip, ship and zip extent.";
                	map.addLayer(lastLayer);
                	bboxLayer.destroyFeatures();
                	deferred.resolve(bounds);
                });        
			}			
		},
		
		deactivateBoundingBox : function() {
			if(this.isActiveBoundingBox()) {
				bboxControl.deactivate();
			}
			if(bboxLayer) {
				bboxLayer.removeAllFeatures();
			}
			if(lastLayer) {
				lastLayer.removeAllFeatures();
			}
		},
		
		isActiveBoundingBox : function() {
			return bboxControl !== null && bboxControl.active;
		},
		
		destroyBoundingBox : function() {
			if(bboxControl) {
				mapService.getMap().then(function(map){
					map.removeControl(bboxControl);
					map.removeLayer(bboxLayer);
					bboxControl.destroy();
					bboxControl = bboxLayer = null;					
					if(lastLayer) {
						map.removeLayer(lastLayer);
						lastLayer.destroy();
						lastLayer = null;
					}
				});
			}
		}
	};
}])

.filter('noClipSelected', [function($filter) {
	return function(features) {
		var selected = false;
		angular.forEach(features, function(item) {
			selected |= item.clipSelected;
		});
		return !selected;
	};
}]);

})(angular);