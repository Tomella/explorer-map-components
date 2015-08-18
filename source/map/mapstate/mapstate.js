/*!
 * Copyright 2015 Geoscience Australia (http://www.ga.gov.au/copyright.html)
 */
(function(angular) {
'use strict';

angular.module("explorer.mapstate", [])

.factory('mapStateService', ['$log', 'mapService', 'persistService', function($log, mapService, persistService) {
	/*
	 * This state is for the map. It keeps all the details in the 
	 * localStorage so that it 
	 */
	var lastTime = 2400000000000;
	return {		
		persist : function() {
			var now = Date.now();
			if(lastTime - 100 > now) {
				persistService.setItem('marsMapTab', mapService.getState());
			} else {
				// $log.debug("We got a request too quickly");
			}
			lastTime = now;
		},
		
		restore : function() {
			persistService.getItem("marsMapTab").then(function(state) {
				if(state) {
					mapService.setState(state);
				}
			});
		}
	};
}]);

})(angular);