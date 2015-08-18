/*!
 * Copyright 2015 Geoscience Australia (http://www.ga.gov.au/copyright.html)
 */

(function(angular){
'use strict';

angular.module("geo.measure", [])

.directive("geoMeasure", ['$log', function($log) {
	return {
		require : "^geoMap",
		restrict : "AE",
		link : function(scope, element, attrs, ctrl) {
			ctrl.getMap().then(function(map) {
				L.Control.measureControl().addTo(map);
				// TODO. See if it is useful
				map.on("draw:drawstop", function(data) {
					$log.info("Draw stopped");
					$log.info(data);
				});
			});
		}
	};
}]);

})(angular);