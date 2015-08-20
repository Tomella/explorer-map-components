/*!
 * Copyright 2015 Geoscience Australia (http://www.ga.gov.au/copyright.html)
 */
(function(angular) {
'use strict';

angular.module("explorer.layer.slider", [])

.directive('explorerLayerSlider', [function() {
	return {
		template : '<slider min="0" max="1" step="0.1" updateevent="slideStop" ng-model="slider.opacity" ng-disabled="!slider.visibility" ui-tooltip="hide"></slider>',
		scope: {
			layer:"=?"
		},
		
		link: function(scope, element, attrs) {
			scope.slider = {
				opacity:1,
				visibility:true
			};

			scope.$watch("slider.opacity", function(newValue, oldValue) {
				if(scope.layer) {
					scope.layer.setOpacity(newValue);
				}
			});

			scope.$watch("layer.options.opacity", function(newValue, oldValue) {
				if(typeof newValue != "undefined" && typeof oldValue != "undefined") {
					scope.slider.opacity = newValue;
				} else if(scope.layer && typeof oldValue == "undefined"){
					scope.layer.setOpacity(scope.slider.opacity);
				}
			});
		}
	};	
}]);

})(angular);