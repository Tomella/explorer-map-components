/*!
 * Copyright 2015 Geoscience Australia (http://www.ga.gov.au/copyright.html)
 */

(function(angular, L) {

'use strict';

angular.module('explorer.layers', ['geo.map'])

.factory('layerService', ['mapService', '$log', '$q', function(mapService, $log, $q) {
	var map = null,		
	interfaceMethods = [
	    "addToMap",
	    "removeFromMap",
	    "handleShow",
	    "init",
	    "destroy",
	    "moveUp",
	    "moveDown"
	],
	featuresMap = {},
	bogusAssetCount = 0,		
	
	// Handle WMS
	typeProtos = {
		WMS : {
			addToMap : function() {
				// IT really does nothing
				this.layer = L.tileLayer.wms(this.wmsUrl, {
				    layers: this.layers,
				    format: 'image/png',
				    transparent: true
				});
				return $q.when(this.layer);
			},
		
			removeFromMap : function() {
				if(this.layer.map) {
					this.map.removeLayer(this.layer);
				}
			},
		
			handleShow : function() {
				if(!this.layer._map) {
					this.layer.addTo(this.map);
					return true;
				} else {
					this.map.removeLayer(this.layer);
					return false;
				}
			},
			
			moveUp : function() {
				var i, layer, layers = this.map.layers,
					overlaysIndex = 0,
					myIndex = this.map.getLayerIndex(this.layer);
				
				for(i = 0; i < layers.length; i++) {
					layer = layers[i];
					if(!layer.isBaseLayer && !layer.pseudoBaseLayer) {
						overlaysIndex = i;
						break;
					}
				}
			
				if(myIndex > overlaysIndex) {
					map.raiseLayer(this.layer, -1);
					return true;
				}
				return false;
			},
		
			moveDown : function() {
				var layerIndex = map.getLayerIndex(this.layer),
					layersLength = map.layers.length;
				if(layerIndex < layersLength - 1) {
					map.raiseLayer(this.layer, 1);
					return true;
				}
				return false;
			},
		
			init : function() {
				return this.addToMap();
			},
			
			destroy : function() {
				this.removeFromMap();
			}
		}
	}, 

	transformers = {
		WMS : function(data) {
			this.legend = this.legendUrl;
			if(!this.thumbUrl) {
			
				this.thumbUrl = window.location.protocol + "//" +
					window.location.host +
					window.location.pathname.substr(0, window.location.pathname.substr(1).indexOf("/") + 2) +
					"service/thumb/wms?wmsService=" +
				    encodeURIComponent(this.url) + "&layers=" +
				    encodeURIComponent(this.layers);
			}
		},
		Tile : function(data) {
			this.legend = this.legendUrl;
		},
		
		Vector : function(data) {			
		}
	};

	window.typeProtos = typeProtos;
	
	// Tile is pretty similar to WMS so extend and override the difference.
	// Because it is asynch it uses a promise instead of a lump to draw.
	typeProtos.Tile = Object.create(typeProtos.WMS);
	typeProtos.Tile.addToMap = function() {
		// This might be the second time in.
		if(!this.layer) {
			mapService.addLayer(this).then(function(layer) {
				try {
					this.layer = layer;
					this.layer.feature = this;
					shuffleBelowMarkers(this);
				} catch(e) {
					$log.warn("Why is there no function?");
				}
			}.bind(this));
		} else {
			this.layer.visibility = this.visibility = false;
			this.map.addLayer(this.layer);
			shuffleBelowMarkers(this);
		}	
		
		function shuffleBelowMarkers(that) {
			var markers = that.map.getLayersByClass("OpenLayers.Layer.Markers");
			markers.forEach(function(marker) {
				that.map.setLayerIndex(marker, that.map.layers.length - 1);
			}.bind(that));
		}			
	};

	typeProtos.Vector = Object.create(typeProtos.WMS);
	typeProtos.Vector.addToMap = function() {
		// TODO Nothing at the moment. We've never had one. 
	};
	
	return {
		decorate : function(feature) {
			var type, wrapWith;
			
			// We allow people to inject unknown assets
			if(!feature.assetId) {
				feature.assetId = "bogus_" + (bogusAssetCount++);
			}

			if(featuresMap[feature.assetId]) {
				return feature;
			} 
			
			this._createMapFeature(feature);
			
			feature.isWrapped = true;
			type = feature.type;
			wrapWith = typeProtos[type];
			
			// Decorate the feature
			if(wrapWith) {
				angular.forEach(interfaceMethods, function(name) {
					feature[name] = wrapWith[name];
				}); 
			}
			return feature;
		},

		_createMapFeature : function(data) {
			var response, trans;
			
			if(data.type == "Vector") {
				$log.debug("Handling a vector service");
			}
			
			trans = transformers[data.type];
			if(trans) {
				transformers[data.type].call(data);
				featuresMap[data.assetId] = data;
			}
		}
	};		
}]);

})(angular, L);