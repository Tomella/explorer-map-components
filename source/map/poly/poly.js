/*!
 * Copyright 2015 Geoscience Australia (http://www.ga.gov.au/copyright.html)
 */
(function(angular) {

'use strict';

angular.module("mars.poly", ['openLayers.service'])

.directive('marsBoundingArea', ['$timeout', '$rootScope', 'polyService', function($timeout, $rootScope, polyService) {
	var KEY = "boundingArea";
	
	return {
		template : '<i class="fa fa-bookmark-o fa-rotate-270" ></i>',
		scope : {
			item : "="
		},
		link : function(scope, element, attrs) {
			element.on('click', function(event) {
				if(polyService.isActive()) {
					scope.item = "";
				} else {
					scope.item = KEY;
					// We pass a callback and it tells us when the geometry changes.
					polyService.initiate(function(map) {
						$timeout(function() {
							scope.item = "";
							$rootScope.$broadcast("extentOfInterestChanged", map);
						});
					});
					$rootScope.$broadcast("extentOfInterestChanged", map);
				}
			}).on("dblclick", function(event) {
				scope.item = "";
				polyService.remove().then(function(map) {
					$rootScope.$broadcast("extentOfInterestChanged", map);
				});
			});
			
			scope.$watch("item", function(newValue, oldValue){
				if(oldValue == KEY) {
					polyService.stop();					
				}
			});
		}
	};
}])

.factory('polyService', ['$q', 'mapService', function($q, mapService) {
   var LAYER_KEY = "Restricted Extent Poly",
   		poly,
   		draw,
   		map;
	
   return {
	
      // Remove the 
      initiate : function(doneHandler) {
         var deferred = $q.defer();
         
         if(draw) {
        	this.remove();
    	    draw.activate();
    	    deferred.resolve(map);
    	 } else {
            mapService.getMap().then(function(olMap) {
                map = olMap;
                poly = new OpenLayers.Layer.Vector(LAYER_KEY);
                draw = new OpenLayers.Control.DrawFeature(
                 		poly,
               			OpenLayers.Handler.Polygon,
               			{
               			   callbacks: { 
               				   done : function(geom) {
               					   this.drawFeature(geom);
               					   if(doneHandler) {
               						   doneHandler(geom);
               					   }
               				   }
               			   },
               			   handlerOptions: {
               				   holeModifier: "altKey",
               				   persist : true
               			   }
               			}
                   	);

      			map.addLayer(poly);
       			map.addControl(draw);        			  
       			draw.activate();
         	    deferred.resolve(map);           	   
    	    });
         }
         return deferred.promise;
      },

      getFeatures : function() {
    	  var response = null;
    	  if(draw && draw.layer && draw.layer.features && draw.layer.features.length > 0) {
    		  response = draw.layer.features;
    	  }
    	  return response;
      },
      
        
      isActive : function() {
    	 return draw && draw.active;  
      },
        
      // A bit misleading. All we do is remove the layer
      remove : function() {        
  		 // Remove the old layer?
  		 if(map && draw) {
  		    var layers = map.getLayersByName(LAYER_KEY);
  		    if(layers) {
  		    	layers.forEach(function(layer) {
  		  		    layer.removeAllFeatures();
  		    	});
  		    }
  		 }
  		 return $q.when(map);
      },
      
  	  stop : function() {
  	     if(draw) {
  		    draw.deactivate();
  		 }
  		 return $q.when(map);
  	  }		
   };
}]);

})(angular);