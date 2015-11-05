/*!
 * Copyright 2015 Geoscience Australia (http://www.ga.gov.au/copyright.html)
 */
(function(angular, L){
'use strict';

angular.module("geo.extent", [])

.directive("geoExtent", ['$log', function($log) {
	// We are Australia.
	var DEFAULT_OPTIONS = {
        center:[-28, 135],
        zoom:5
	};
	return {
		require : "^geoMap",
		restrict : "AE",
		scope : {
			options: "="
		},
		link : function(scope, element, attrs, ctrl) {
			if(typeof scope.options == "undefined") {
				scope.options = {};
			}
			if(typeof scope.options.center == "undefined") {
				scope.options.center = DEFAULT_OPTIONS.center;
			} 
			if(typeof scope.options.zoom == "undefined") {
				scope.options.zoom = DEFAULT_OPTIONS.zoom;
			}
			
			ctrl.getMap().then(function(map) {
				L.control.zoommin(scope.options).addTo(map);
			});
		}
	};
}]);

})(angular, L);
