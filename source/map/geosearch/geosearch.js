{

angular.module('geo.geosearch', ['ngAutocomplete'])

.directive("expSearch", [function() {
	return {
		templateUrl : "components/geosearch/search.html",
		scope : {
			hideTo:"="
		},
		link : function(scope, element) {
			element.addClass("");
		}
	};
}])

.directive('geoSearch', ['$log', '$q', 'googleService', 'mapHelper',
                       function($log, $q, googleService, mapHelper) {
	return {
		controller:["$scope", function($scope) {
			// Place holders for the google response.
			$scope.values = {
				from:{},
				to:{}
			};

			$scope.zoom = function(marker) {
				var promise, promises = [];
				if($scope.values.from.description) {
					promise = googleService.getAddressDetails($scope.values.from.description, $scope).then(function(results) {
						$log.debug("Received the results for from");
						$scope.values.from.results = results;
						// Hide the dialog.
						$scope.item = "";
					}, function(error) {
						$log.debug("Failed to complete the from lookup.");
					});
					promises.push(promise);
				}

				if($scope.values.to && $scope.values.to.description) {
					promise = googleService.getAddressDetails($scope.values.to.description, $scope).then(function(results) {
						$log.debug("Received the results for to");
						$scope.values.to.results = results;
					}, function(error) {
						$log.debug("Failed to complete the to lookup.");
					});
					promises.push(promise);
				}

				if(promises.length > 0) {
					$q.all(promises).then(function() {
						var results = [];
						if($scope.values.from && $scope.values.from.results) {
							results.push($scope.values.from.results);
						}
						if($scope.values.to && $scope.values.to.results) {
							results.push($scope.values.to.results);
						}
						mapHelper.zoomToMarkPoints(results, marker);
						if(promises.length == 1) {

						}
						$log.debug("Updating the map with what we have");
					});
				}
				$log.debug("Zooming to map soon.");
			};
		}]
	};
}])

.factory('googleService', ['$log', '$q', function($log, $q){
	var geocoder = new google.maps.Geocoder(),
	service;
	try {
		service = new google.maps.places.AutocompleteService(null, {
						types: ['geocode']
					});
	} catch(e) {
		$log.debug("Catching google error that manifests itself when debugging in Firefox only");
	}

	return {
		getAddressDetails: function(address, digester) {
			var deferred = $q.defer();
			geocoder.geocode({ address: address, region: "au" }, function(results, status) {
				if (status != google.maps.GeocoderStatus.OK) {
					digester.$apply(function() {
						deferred.reject("Failed to find address");
					});
				} else {
					digester.$apply(function() {
						deferred.resolve({
							lat: results[0].geometry.location.lat(),
							lon: results[0].geometry.location.lng(),
							address: results[0].formatted_address
						});
					});
				}
			});
			return deferred.promise;
		}
	};
}]);

}