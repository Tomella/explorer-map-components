/*!
 * Copyright 2015 Geoscience Australia (http://www.ga.gov.au/copyright.html)
 */
(function(angular) {	

'use strict';

angular.module('explorer.layer.inpector', ['explorer.layers'])

.directive('layerInspector', ['$rootScope', 'layerService', function($rootScope, layerService) {
	return {
		restrict:"AE",
		scope:{
			click : "&",
			showClose : "=?",
			active:"=",
			name:"=?"
		},
		controller : ['$scope', function($scope){
			$scope.toggleShow = function() {
				var active = this.active;
				if(!active.isWrapped) {
					active = layerService.decorate(active);
					active.init();
					active.show = true;
					active.showExtra = true;
				}
				active.displayed = active.handleShow();
			};
		}],		
		templateUrl : "map/layerinspector/layerInspector.html?v=1"
	};
}]);

})(angular);