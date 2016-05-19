if(window.Exp === undefined) {
	window.Exp = {};
}
(function(L, Exp) {

'use strict';

if(!Exp.Util) {
	Exp.Util = {};
}

Exp.Util.toGeoJSONFeature = toGeoJSONFeature;
Exp.Util.toLineStringWkt = toLineStringWkt;
Exp.Util.intersects = intersects;
Exp.Util.boundsToWktPoly = boundsToWktPoly;

function intersects(source, target) {
    var intersect = false;
    
    if(source instanceof L.Polyline ||
    		source instanceof L.Polygon ||
    		source instanceof L.Marker) {
        var segs1 = getSortedSegments(target);
        var segs2, latlng;
        
        
        if(source instanceof L.Marker) {
        	latlng = source.getLatLng();
            segs2 = [{
                x1: latlng.lng, y1: latlng.lat,
                x2: latlng.lng, y2: latlng.lat
            }];
        } else {
            segs2 = getSortedSegments(source);
        }
        var seg1, seg1x1, seg1x2, seg1y1, seg1y2,
            seg2, seg2y1, seg2y2;
        // sweep right
        outer: for(var i=0, len=segs1.length; i<len; ++i) {
            seg1 = segs1[i];
            seg1x1 = seg1.x1;
            seg1x2 = seg1.x2;
            seg1y1 = seg1.y1;
            seg1y2 = seg1.y2;
            inner: for(var j=0, jlen=segs2.length; j<jlen; ++j) {
                seg2 = segs2[j];
                if(seg2.x1 > seg1x2) {
                    // seg1 still left of seg2
                    break;
                }
                if(seg2.x2 < seg1x1) {
                    // seg2 still left of seg1
                    continue;
                }
                seg2y1 = seg2.y1;
                seg2y2 = seg2.y2;
                if(Math.min(seg2y1, seg2y2) > Math.max(seg1y1, seg1y2)) {
                    // seg2 above seg1
                    continue;
                }
                if(Math.max(seg2y1, seg2y2) < Math.min(seg1y1, seg1y2)) {
                    // seg2 below seg1
                    continue;
                }
                if(segmentsIntersect(seg1, seg2)) {
                    intersect = true;
                    break outer;
                }
            }
        }
    } else {
        intersect = intersects(target, source);
    }
    return intersect;
    

    function getSortedSegments(source){
    	window.bugger = source;
    	var latlngs = source.getLatLngs();
        var numSeg = latlngs.length - 1;
        var segments = [], point1, point2;
        
        for(var i=0; i<numSeg; ++i) {
            point1 = latlngs[i];
            point2 = latlngs[i + 1];
            if(point1.lng < point2.lng) {
                segments[i] = {
                    x1: point1.lng,
                    y1: point1.lat,
                    x2: point2.lng,
                    y2: point2.lat
                };
            } else {
                segments[i] = {
                    x1: point2.lng,
                    y1: point2.lat,
                    x2: point1.lng,
                    y2: point1.lat
                };
            }
        }
        // more efficient to define this somewhere static
        function byX1(seg1, seg2) {
            return seg1.x1 - seg2.x1;
        }
        return segments.sort(byX1);
    }

    
    function segmentsIntersect(seg1, seg2, options) {
        var point = options && options.point;
        var tolerance = options && options.tolerance;
        var intersection = false;
        var x11_21 = seg1.x1 - seg2.x1;
        var y11_21 = seg1.y1 - seg2.y1;
        var x12_11 = seg1.x2 - seg1.x1;
        var y12_11 = seg1.y2 - seg1.y1;
        var y22_21 = seg2.y2 - seg2.y1;
        var x22_21 = seg2.x2 - seg2.x1;
        var d = (y22_21 * x12_11) - (x22_21 * y12_11);
        var n1 = (x22_21 * y11_21) - (y22_21 * x11_21);
        var n2 = (x12_11 * y11_21) - (y12_11 * x11_21);
        var x, y;
        if(d === 0) {
            // parallel
            if(n1 === 0 && n2 === 0) {
                // coincident
                intersection = true;
            }
        } else {
            var along1 = n1 / d;
            var along2 = n2 / d;
            if(along1 >= 0 && along1 <= 1 && along2 >=0 && along2 <= 1) {
                // intersect
                if(!point) {
                    intersection = true;
                } else {
                    // calculate the intersection point
                    x = seg1.x1 + (along1 * x12_11);
                    y = seg1.y1 + (along1 * y12_11);
                    intersection = new OpenLayers.Geometry.Point(x, y);
                }
            }
        }
        if(tolerance) {
            var segs = [seg1, seg2];
            var dist, seg, i, j;
            if(intersection) {
                if(point) {
                    // check segment endpoints for proximity to intersection
                    // set intersection to first endpoint within the tolerance
                    pouter: for(i=0; i<2; ++i) {
                        seg = segs[i];
                        for(j=1; j<3; ++j) {
                            x = seg["x" + j];
                            y = seg["y" + j];
                            dist = Math.sqrt(
                                Math.pow(x - intersection.x, 2) +
                                Math.pow(y - intersection.y, 2)
                            );
                            if(dist < tolerance) {
                                intersection.x = x;
                                intersection.y = y;
                                break pouter;
                            }
                        }
                    }
                    
                }
            } else {
                // no calculated intersection, but segments could be within
                // the tolerance of one another
                var source, target, p, result;
                // check segment endpoints for proximity to intersection
                // set intersection to first endpoint within the tolerance
                outer: for(i=0; i<2; ++i) {
                    source = segs[i];
                    target = segs[(i+1)%2];
                    for(j=1; j<3; ++j) {
                        p = {x: source["x"+j], y: source["y"+j]};
                        result = OpenLayers.Geometry.distanceToSegment(p, target);
                        if(result.distance < tolerance) {
                            if(point) {
                                intersection = new OpenLayers.Geometry.Point(p.x, p.y);
                            } else {
                                intersection = true;
                            }
                            break outer;
                        }
                    }
                }
            }
        }
        return intersection;
    }    
}

function boundsToWktPoly(bounds) {
	var buffer = [],
		start = bounds.getWest() + " " + bounds.getSouth();
	
	buffer.push(start);
	buffer.push(bounds.getEast() + " " + bounds.getSouth());
	buffer.push(bounds.getEast() + " " + bounds.getNorth());
	buffer.push(bounds.getWest() + " " + bounds.getNorth());
	buffer.push(start);
	
	return "POLYGON((" + buffer.join(",") + "))";
}

function toLineStringWkt(latlngs) {
    var lng, lat, coords = [];
    if(latlngs) {
    	latlngs.forEach(function(latlng) {
    	   	coords.push(latlng.lng + " " + latlng.lat);
    	});
    }
    return "LINESTRING(" + coords.join(",") + ")";
}

function toGeoJSONFeature(latlngs) {
    var lng, lat, coords = [];
    if(latlngs) {
        latlngs.forEach(function(latlng) {
            coords.push([latlng.lng, latlng.lat]);
        });
    }
    return {
        type: "Feature",
        properties: {prop0: "value0"},
        geometry: {
            type: "LineString",
            coordinates: coords
        }
    };
}

// Plugged in from
// https://github.com/mapbox/togeojson
// Conforms to usage described in licence
Exp.Util.toGeoJSON = (function() {
    var removeSpace = (/\s*/g),
        trimSpace = (/^\s*|\s*$/g),
        splitSpace = (/\s+/);
    // generate a short, numeric hash of a string
    function okhash(x) {
        if (!x || !x.length) return 0;
        for (var i = 0, h = 0; i < x.length; i++) {
            h = ((h << 5) - h) + x.charCodeAt(i) | 0;
        } return h;
    }
    // all Y children of X
    function get(x, y) { return x.getElementsByTagName(y); }
    function attr(x, y) { return x.getAttribute(y); }
    function attrf(x, y) { return parseFloat(attr(x, y)); }
    // one Y child of X, if any, otherwise null
    function get1(x, y) { var n = get(x, y); return n.length ? n[0] : null; }
    // https://developer.mozilla.org/en-US/docs/Web/API/Node.normalize
    function norm(el) { if (el.normalize) { el.normalize(); } return el; }
    // cast array x into numbers
    function numarray(x) {
        for (var j = 0, o = []; j < x.length; j++) { o[j] = parseFloat(x[j]); }
        return o;
    }
    function clean(x) {
        var o = {};
        for (var i in x) { if (x[i]) { o[i] = x[i]; } }
        return o;
    }
    // get the content of a text node, if any
    function nodeVal(x) {
        if (x) { norm(x); }
        return (x && x.textContent) || '';
    }
    // get one coordinate from a coordinate array, if any
    function coord1(v) { return numarray(v.replace(removeSpace, '').split(',')); }
    // get all coordinates from a coordinate array as [[],[]]
    function coord(v) {
        var coords = v.replace(trimSpace, '').split(splitSpace),
            o = [];
        for (var i = 0; i < coords.length; i++) {
            o.push(coord1(coords[i]));
        }
        return o;
    }
    function coordPair(x) {
        var ll = [attrf(x, 'lon'), attrf(x, 'lat')],
            ele = get1(x, 'ele'),
            // handle namespaced attribute in browser
            heartRate = get1(x, 'gpxtpx:hr') || get1(x, 'hr'),
            time = get1(x, 'time'),
            e;
        if (ele) {
            e = parseFloat(nodeVal(ele));
            if (e) {
              ll.push(e);
            }
        }
        return {
            coordinates: ll,
            time: time ? nodeVal(time) : null,
            heartRate: heartRate ? parseFloat(nodeVal(heartRate)) : null
        };
    }

    // create a new feature collection parent object
    function fc() {
        return {
            type: 'FeatureCollection',
            features: []
        };
    }

    var serializer;
    if (typeof XMLSerializer !== 'undefined') {
        serializer = new XMLSerializer();
    // only require xmldom in a node environment
    } else if (typeof exports === 'object' && typeof process === 'object' && !process.browser) {
        serializer = new (require('xmldom').XMLSerializer)();
    }
    function xml2str(str) {
        // IE9 will create a new XMLSerializer but it'll crash immediately.
        if (str.xml !== undefined) return str.xml;
        return serializer.serializeToString(str);
    }

    var t = {
        kml: function(doc) {

            var gj = fc(),
                // styleindex keeps track of hashed styles in order to match features
                styleIndex = {},
                // atomic geospatial types supported by KML - MultiGeometry is
                // handled separately
                geotypes = ['Polygon', 'LineString', 'Point', 'Track', 'gx:Track'],
                // all root placemarks in the file
                placemarks = get(doc, 'Placemark'),
                styles = get(doc, 'Style');

            for (var k = 0; k < styles.length; k++) {
                styleIndex['#' + attr(styles[k], 'id')] = okhash(xml2str(styles[k])).toString(16);
            }
            for (var j = 0; j < placemarks.length; j++) {
                gj.features = gj.features.concat(getPlacemark(placemarks[j]));
            }
            function kmlColor(v) {
                var color, opacity;
                v = v || "";
                if (v.substr(0, 1) === "#") { v = v.substr(1); }
                if (v.length === 6 || v.length === 3) { color = v; }
                if (v.length === 8) {
                    opacity = parseInt(v.substr(0, 2), 16) / 255;
                    color = v.substr(2);
                }
                return [color, isNaN(opacity) ? undefined : opacity];
            }
            function gxCoord(v) { return numarray(v.split(' ')); }
            function gxCoords(root) {
                var i, elems = get(root, 'coord', 'gx'), coords = [], times = [];
                if (elems.length === 0) elems = get(root, 'gx:coord');
                for (i = 0; i < elems.length; i++) coords.push(gxCoord(nodeVal(elems[i])));
                var timeElems = get(root, 'when');
                for (i = 0; i < timeElems.length; i++) times.push(nodeVal(timeElems[i]));
                return {
                    coords: coords,
                    times: times
                };
            }
            function getGeometry(root) {
                var geomNode, geomNodes, i, j, k, geoms = [], coordTimes = [];
                if (get1(root, 'MultiGeometry')) { return getGeometry(get1(root, 'MultiGeometry')); }
                if (get1(root, 'MultiTrack')) { return getGeometry(get1(root, 'MultiTrack')); }
                if (get1(root, 'gx:MultiTrack')) { return getGeometry(get1(root, 'gx:MultiTrack')); }
                for (i = 0; i < geotypes.length; i++) {
                    geomNodes = get(root, geotypes[i]);
                    if (geomNodes) {
                        for (j = 0; j < geomNodes.length; j++) {
                            geomNode = geomNodes[j];
                            if (geotypes[i] === 'Point') {
                                geoms.push({
                                    type: 'Point',
                                    coordinates: coord1(nodeVal(get1(geomNode, 'coordinates')))
                                });
                            } else if (geotypes[i] === 'LineString') {
                                geoms.push({
                                    type: 'LineString',
                                    coordinates: coord(nodeVal(get1(geomNode, 'coordinates')))
                                });
                            } else if (geotypes[i] === 'Polygon') {
                                var rings = get(geomNode, 'LinearRing'),
                                    coords = [];
                                for (k = 0; k < rings.length; k++) {
                                    coords.push(coord(nodeVal(get1(rings[k], 'coordinates'))));
                                }
                                geoms.push({
                                    type: 'Polygon',
                                    coordinates: coords
                                });
                            } else if (geotypes[i] === 'Track' ||
                                geotypes[i] === 'gx:Track') {
                                var track = gxCoords(geomNode);
                                geoms.push({
                                    type: 'LineString',
                                    coordinates: track.coords
                                });
                                if (track.times.length) coordTimes.push(track.times);
                            }
                        }
                    }
                }
                return {
                    geoms: geoms,
                    coordTimes: coordTimes
                };
            }
            function getPlacemark(root) {
                var geomsAndTimes = getGeometry(root), i, properties = {},
                    name = nodeVal(get1(root, 'name')),
                    styleUrl = nodeVal(get1(root, 'styleUrl')),
                    description = nodeVal(get1(root, 'description')),
                    timeSpan = get1(root, 'TimeSpan'),
                    extendedData = get1(root, 'ExtendedData'),
                    lineStyle = get1(root, 'LineStyle'),
                    polyStyle = get1(root, 'PolyStyle');

                if (!geomsAndTimes.geoms.length) return [];
                if (name) properties.name = name;
                if (styleUrl && styleIndex[styleUrl]) {
                    properties.styleUrl = styleUrl;
                    properties.styleHash = styleIndex[styleUrl];
                }
                if (description) properties.description = description;
                if (timeSpan) {
                    var begin = nodeVal(get1(timeSpan, 'begin'));
                    var end = nodeVal(get1(timeSpan, 'end'));
                    properties.timespan = { begin: begin, end: end };
                }
                if (lineStyle) {
                    var linestyles = kmlColor(nodeVal(get1(lineStyle, 'color'))),
                        color = linestyles[0],
                        opacity = linestyles[1],
                        width = parseFloat(nodeVal(get1(lineStyle, 'width')));
                    if (color) properties.stroke = color;
                    if (!isNaN(opacity)) properties['stroke-opacity'] = opacity;
                    if (!isNaN(width)) properties['stroke-width'] = width;
                }
                if (polyStyle) {
                    var polystyles = kmlColor(nodeVal(get1(polyStyle, 'color'))),
                        pcolor = polystyles[0],
                        popacity = polystyles[1],
                        fill = nodeVal(get1(polyStyle, 'fill')),
                        outline = nodeVal(get1(polyStyle, 'outline'));
                    if (pcolor) properties.fill = pcolor;
                    if (!isNaN(popacity)) properties['fill-opacity'] = popacity;
                    if (fill) properties['fill-opacity'] = fill === "1" ? 1 : 0;
                    if (outline) properties['stroke-opacity'] = outline === "1" ? 1 : 0;
                }
                if (extendedData) {
                    var datas = get(extendedData, 'Data'),
                        simpleDatas = get(extendedData, 'SimpleData');

                    for (i = 0; i < datas.length; i++) {
                        properties[datas[i].getAttribute('name')] = nodeVal(get1(datas[i], 'value'));
                    }
                    for (i = 0; i < simpleDatas.length; i++) {
                        properties[simpleDatas[i].getAttribute('name')] = nodeVal(simpleDatas[i]);
                    }
                }
                if (geomsAndTimes.coordTimes.length) {
                    properties.coordTimes = (geomsAndTimes.coordTimes.length === 1) ?
                        geomsAndTimes.coordTimes[0] : geomsAndTimes.coordTimes;
                }
                var feature = {
                    type: 'Feature',
                    geometry: (geomsAndTimes.geoms.length === 1) ? geomsAndTimes.geoms[0] : {
                        type: 'GeometryCollection',
                        geometries: geomsAndTimes.geoms
                    },
                    properties: properties
                };
                if (attr(root, 'id')) feature.id = attr(root, 'id');
                return [feature];
            }
            return gj;
        },
        gpx: function(doc) {
            var i,
                tracks = get(doc, 'trk'),
                routes = get(doc, 'rte'),
                waypoints = get(doc, 'wpt'),
                // a feature collection
                gj = fc(),
                feature;
            for (i = 0; i < tracks.length; i++) {
                feature = getTrack(tracks[i]);
                if (feature) gj.features.push(feature);
            }
            for (i = 0; i < routes.length; i++) {
                feature = getRoute(routes[i]);
                if (feature) gj.features.push(feature);
            }
            for (i = 0; i < waypoints.length; i++) {
                gj.features.push(getPoint(waypoints[i]));
            }
            function getPoints(node, pointname) {
                var pts = get(node, pointname),
                    line = [],
                    times = [],
                    heartRates = [],
                    l = pts.length;
                if (l < 2) return {};  // Invalid line in GeoJSON
                for (var i = 0; i < l; i++) {
                    var c = coordPair(pts[i]);
                    line.push(c.coordinates);
                    if (c.time) times.push(c.time);
                    if (c.heartRate) heartRates.push(c.heartRate);
                }
                return {
                    line: line,
                    times: times,
                    heartRates: heartRates
                };
            }
            function getTrack(node) {
                var segments = get(node, 'trkseg'),
                    track = [],
                    times = [],
                    heartRates = [],
                    line;
                for (var i = 0; i < segments.length; i++) {
                    line = getPoints(segments[i], 'trkpt');
                    if (line.line) track.push(line.line);
                    if (line.times && line.times.length) times.push(line.times);
                    if (line.heartRates && line.heartRates.length) heartRates.push(line.heartRates);
                }
                if (track.length === 0) return;
                var properties = getProperties(node);
                if (times.length) properties.coordTimes = track.length === 1 ? times[0] : times;
                if (heartRates.length) properties.heartRates = track.length === 1 ? heartRates[0] : heartRates;
                return {
                    type: 'Feature',
                    properties: properties,
                    geometry: {
                        type: track.length === 1 ? 'LineString' : 'MultiLineString',
                        coordinates: track.length === 1 ? track[0] : track
                    }
                };
            }
            function getRoute(node) {
                var line = getPoints(node, 'rtept');
                if (!line) return;
                var routeObj = {
                    type: 'Feature',
                    properties: getProperties(node),
                    geometry: {
                        type: 'LineString',
                        coordinates: line.line
                    }
                };
                return routeObj;
            }
            function getPoint(node) {
                var prop = getProperties(node);
                prop.sym = nodeVal(get1(node, 'sym'));
                return {
                    type: 'Feature',
                    properties: prop,
                    geometry: {
                        type: 'Point',
                        coordinates: coordPair(node).coordinates
                    }
                };
            }
            function getProperties(node) {
                var meta = ['name', 'desc', 'author', 'copyright', 'link',
                            'time', 'keywords'],
                    prop = {},
                    k;
                for (k = 0; k < meta.length; k++) {
                    prop[meta[k]] = nodeVal(get1(node, meta[k]));
                }
                return clean(prop);
            }
            return gj;
        }
    };
    return t;
})();

/*global L: true */

L.KML = L.FeatureGroup.extend({
	options: {
		async: true
	},

	initialize: function(kml, options) {
		L.Util.setOptions(this, options);
		this._kml = kml;
		this._layers = {};

		if (kml) {
			this.addKML(kml, options, this.options.async);
		}
	},

	loadXML: function(url, cb, options, async) {
		if (async === undefined) async = this.options.async;
		if (options === undefined) options = this.options;

		var req = new window.XMLHttpRequest();
		req.open('GET', url, async);
		try {
			req.overrideMimeType('text/xml'); // unsupported by IE
		} catch(e) {}
		req.onreadystatechange = function() {
			if (req.readyState != 4) return;
			if(req.status == 200) cb(req.responseXML, options);
		};
		req.send(null);
	},

	addKML: function(url, options, async) {
		var _this = this;
		var cb = function(gpx, options) { _this._addKML(gpx, options); };
		this.loadXML(url, cb, options, async);
	},

	_addKML: function(xml, options) {
		var layers = L.KML.parseKML(xml);
		if (!layers || !layers.length) return;
		for (var i = 0; i < layers.length; i++)
		{
			this.fire('addlayer', {
				layer: layers[i]
			});
			this.addLayer(layers[i]);
		}
		this.latLngs = L.KML.getLatLngs(xml);
		this.fire("loaded");
	},

	latLngs: []
});

L.Util.extend(L.KML, {
	parseKML: function (xml) {
		var style = this.parseStyle(xml);
		var el = xml.getElementsByTagName("Folder");
		var layers = [], l;
		for (var i = 0; i < el.length; i++) {
			if (!this._check_folder(el[i])) { continue; }
			l = this.parseFolder(el[i], style);
			if (l) { layers.push(l); }
		}
		el = xml.getElementsByTagName('Placemark');
		for (var j = 0; j < el.length; j++) {
			if (!this._check_folder(el[j])) { continue; }
			l = this.parsePlacemark(el[j], xml, style);
			if (l) { layers.push(l); }
		}
		return layers;
	},

	// Return false if e's first parent Folder is not [folder]
	// - returns true if no parent Folders
	_check_folder: function (e, folder) {
		e = e.parentElement;
		while (e && e.tagName !== "Folder")
		{
			e = e.parentElement;
		}
		return !e || e === folder;
	},

	parseStyle: function (xml) {
		var style = {};
		var sl = xml.getElementsByTagName("Style");

		//for (var i = 0; i < sl.length; i++) {
		var attributes = {color: true, width: true, Icon: true, href: true,
						  hotSpot: true};

		function _parse(xml) {
			var options = {};
			for (var i = 0; i < xml.childNodes.length; i++) {
				var e = xml.childNodes[i];
				var key = e.tagName;
				if (!attributes[key]) { continue; }
				if (key === 'hotSpot')
				{
					for (var j = 0; j < e.attributes.length; j++) {
						options[e.attributes[j].name] = e.attributes[j].nodeValue;
					}
				} else {
					var value = e.childNodes[0].nodeValue;
					if (key === 'color') {
						options.opacity = parseInt(value.substring(0, 2), 16) / 255.0;
						options.color = "#" + value.substring(2, 8);
					} else if (key === 'width') {
						options.weight = value;
					} else if (key === 'Icon') {
						ioptions = _parse(e);
						if (ioptions.href) { options.href = ioptions.href; }
					} else if (key === 'href') {
						options.href = value;
					}
				}
			}
			return options;
		}

		for (var i = 0; i < sl.length; i++) {
			var e = sl[i], el;
			var options = {}, poptions = {}, ioptions = {};
			el = e.getElementsByTagName("LineStyle");
			if (el && el[0]) { options = _parse(el[0]); }
			el = e.getElementsByTagName("PolyStyle");
			if (el && el[0]) { poptions = _parse(el[0]); }
			if (poptions.color) { options.fillColor = poptions.color; }
			if (poptions.opacity) { options.fillOpacity = poptions.opacity; }
			el = e.getElementsByTagName("IconStyle");
			if (el && el[0]) { ioptions = _parse(el[0]); }
			if (ioptions.href) {
				// save anchor info until the image is loaded
				options.icon = new L.KMLIcon({
					iconUrl: ioptions.href,
					shadowUrl: null,
					iconAnchorRef: {x: ioptions.x, y: ioptions.y},
					iconAnchorType:	{x: ioptions.xunits, y: ioptions.yunits}
				});
			}
			style['#' + e.getAttribute('id')] = options;
		}
		return style;
	},

	parseFolder: function (xml, style) {
		var el, layers = [], l;
		el = xml.getElementsByTagName('Folder');
		for (var i = 0; i < el.length; i++) {
			if (!this._check_folder(el[i], xml)) { continue; }
			l = this.parseFolder(el[i], style);
			if (l) { layers.push(l); }
		}
		el = xml.getElementsByTagName('Placemark');
		for (var j = 0; j < el.length; j++) {
			if (!this._check_folder(el[j], xml)) { continue; }
			l = this.parsePlacemark(el[j], xml, style);
			if (l) { layers.push(l); }
		}
		if (!layers.length) { return; }
		if (layers.length === 1) { return layers[0]; }
		return new L.FeatureGroup(layers);
	},

	parsePlacemark: function (place, xml, style) {
		var i, j, el, options = {};
		el = place.getElementsByTagName('styleUrl');
		for (i = 0; i < el.length; i++) {
			var url = el[i].childNodes[0].nodeValue;
			for (var a in style[url])
			{
				// for jshint
				if (true)
				{
					options[a] = style[url][a];
				}
			}
		}
		var layers = [];

		var parse = ['LineString', 'Polygon', 'Point'];
		for (j in parse) {
			// for jshint
			if (true)
			{
				var tag = parse[j];
				el = place.getElementsByTagName(tag);
				for (i = 0; i < el.length; i++) {
					var l = this["parse" + tag](el[i], xml, options);
					if (l) { layers.push(l); }
				}
			}
		}

		if (!layers.length) {
			return;
		}
		var layer = layers[0];
		if (layers.length > 1) {
			layer = new L.FeatureGroup(layers);
		}

		var name, descr = "";
		el = place.getElementsByTagName('name');
		if (el.length) {
			name = el[0].childNodes[0].nodeValue;
		}
		el = place.getElementsByTagName('description');
		for (i = 0; i < el.length; i++) {
			for (j = 0; j < el[i].childNodes.length; j++) {
				descr = descr + el[i].childNodes[j].nodeValue;
			}
		}

		if (name) {
			layer.bindPopup("<h2>" + name + "</h2>" + descr);
		}

		return layer;
	},

	parseCoords: function (xml) {
		var el = xml.getElementsByTagName('coordinates');
		return this._read_coords(el[0]);
	},

	parseLineString: function (line, xml, options) {
		var coords = this.parseCoords(line);
		if (!coords.length) { return; }
		return new L.Polyline(coords, options);
	},

	parsePoint: function (line, xml, options) {
		var el = line.getElementsByTagName('coordinates');
		if (!el.length) {
			return;
		}
		var ll = el[0].childNodes[0].nodeValue.split(',');
		return new L.KMLMarker(new L.LatLng(ll[1], ll[0]), options);
	},

	parsePolygon: function (line, xml, options) {
		var el, polys = [], inner = [], i, coords;
		el = line.getElementsByTagName('outerBoundaryIs');
		for (i = 0; i < el.length; i++) {
			coords = this.parseCoords(el[i]);
			if (coords) {
				polys.push(coords);
			}
		}
		el = line.getElementsByTagName('innerBoundaryIs');
		for (i = 0; i < el.length; i++) {
			coords = this.parseCoords(el[i]);
			if (coords) {
				inner.push(coords);
			}
		}
		if (!polys.length) {
			return;
		}
		if (options.fillColor) {
			options.fill = true;
		}
		if (polys.length === 1) {
			return new L.Polygon(polys.concat(inner), options);
		}
		return new L.MultiPolygon(polys, options);
	},

	getLatLngs: function (xml) {
		var el = xml.getElementsByTagName('coordinates');
		var coords = [];
		for (var j = 0; j < el.length; j++) {
			// text might span many childnodes
			coords = coords.concat(this._read_coords(el[j]));
		}
		return coords;
	},

	_read_coords: function (el) {
		var text = "", coords = [], i;
		for (i = 0; i < el.childNodes.length; i++) {
			text = text + el.childNodes[i].nodeValue;
		}
		text = text.split(/[\s\n]+/);
		for (i = 0; i < text.length; i++) {
			var ll = text[i].split(',');
			if (ll.length < 2) {
				continue;
			}
			coords.push(new L.LatLng(ll[1], ll[0]));
		}
		return coords;
	}

});

L.KMLIcon = L.Icon.extend({

	createIcon: function () {
		var img = this._createIcon('icon');
		img.onload = function () {
			var i = new Image();
			i.src = this.src;
			this.style.width = i.width + 'px';
			this.style.height = i.height + 'px';

			if (this.anchorType.x === 'UNITS_FRACTION' || this.anchorType.x === 'fraction') {
				img.style.marginLeft = (-this.anchor.x * i.width) + 'px';
			}
			if (this.anchorType.y === 'UNITS_FRACTION' || this.anchorType.x === 'fraction') {
				img.style.marginTop  = (-(1 - this.anchor.y) * i.height) + 'px';
			}
			this.style.display = "";
		};
		return img;
	},

	_setIconStyles: function (img, name) {
		L.Icon.prototype._setIconStyles.apply(this, [img, name]);
		// save anchor information to the image
		img.anchor = this.options.iconAnchorRef;
		img.anchorType = this.options.iconAnchorType;
	}
});


L.KMLMarker = L.Marker.extend({
	options: {
		icon: new L.KMLIcon.Default()
	}
});



})(L, Exp);