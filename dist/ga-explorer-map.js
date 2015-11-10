if(window.Exp === undefined) {
	window.Exp = {};
}
(function(L, Exp) {

'use strict';

if(!Exp.Util) {
	Exp.Util = {};
}

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
/*!
 * Copyright 2015 Geoscience Australia (http://www.ga.gov.au/copyright.html)
 */
(function(angular) {
'use strict';
/**
 * Uses: https://raw.githubusercontent.com/seiyria/angular-bootstrap-slider
 */
angular.module('geo.baselayer.control', ['geo.maphelper', 'geo.map', 'ui.bootstrap-slider'])

.directive('geoBaselayerControl', ['$rootScope', 'mapHelper', 'mapService', function($rootScope, mapHelper, mapService) {
	return {
		template : '<slider min="0" max="1" step="0.1" ng-model="slider.opacity" updateevent="slideStop"></slider>',
		link : function(scope, element) {
			scope.slider = {
				opacity:1,
				visibility:true, 
				lastOpacity:1 
			};
			
			// Get the initial value
			mapHelper.getPseudoBaseLayer().then(function(layer) {
				scope.layer = layer;
				scope.slider.opacity = layer.options.opacity;	
				scope.$watch("slider.opacity", function(newValue, oldValue) {
					scope.layer.setOpacity(newValue);
				});
			});
			
			mapService.getMap().then(function(map) {
				map.on("zoomend", execute);
				
				function execute() {
					var zoom = map.getZoom();

					if(scope.lastZoom < 12) {
						scope.lastOpacity = scope.layer.options.opacity;
					}
					
					if(zoom == 12) {
						if(scope.lastZoom > 12) {
							if(scope.lastOpacity < 0.5) {					
								scope.slider.opacity = scope.lastOpacity;
								scope.layer.setOpacity(scope.lastOpacity);					
							} else {		
								scope.slider.opacity = 0.5;
								scope.layer.setOpacity(0.5);			
							}							
						} else if(scope.slider.opacity > 0.5) {							
							scope.slider.opacity = 0.5;
							scope.layer.setOpacity(0.5);
						}
						scope.slider.visibility = false;
						setEnabled(false);
					} else if(zoom < 12) {
						if(scope.lastZoom <= 12) {
							scope.slider.opacity = scope.lastOpacity;
							scope.layer.setOpacity(scope.lastOpacity);
						}
						setEnabled(true);
					} else if(zoom > 12 && scope.lastZoom < 13) {
						scope.slider.visibility = false;
						scope.slider.opacity = 0;
						setEnabled(false);
					}					
					scope.lastZoom = zoom;
					
				}
				
				// Bit of a nasty workaround for the thing not working out the angular component 
				function setEnabled(enable) {
					$(element).find(".slider-input").eq(0).slider(enable?"enable":"disable");
				}
			});
		}
	};
}])

.run(['$rootScope', 'mapService', 'flashService', function($rootScope, mapService, flashService) {
	var showingMessage;
	
    mapService.getMap().then(function(map) {
    	map.oldZoomTo = map.zoomTo;
    	map.zoomTo = function(value) {
    		this.layers.forEach(function(layer) {
    			if(layer.pseudoBaseLayer && layer.visibility) {
    				var oldZoom    = map.zoom,
    					thresholdOpacity = 0.4,
    					thresholdZoom = layer.numZoomLevels,
    					isBlank = value > thresholdZoom -2,
    					isShowable = value < thresholdZoom - 1,
    					isHalf = value == thresholdZoom - 2,
    				
    					oldIsShowable = oldZoom < thresholdZoom - 1,
    					oldIsHalf = oldZoom == thresholdZoom - 2,
    					goingUp = value > oldZoom,
    					goingDown = value < oldZoom;
    				
    			
   					// Do we show a message?
   					if(goingUp) {
   						if(thresholdZoom <= value + 1 && !showingMessage) {
   							showingMessage = true;
   							flashService.add("No detail available at this scale for " + layer.name, 3000);
   							$rootScope.$broadcast('overlay.has.detail', false);
   						}
   					} else {
   						showingMessage = false;
   					}
    			
   					// Do we notify to enable the slider
   					if(isShowable) {
   						$rootScope.$broadcast('overlay.has.detail', true);
   					}
    			
   					// Do we save the opacity?
   					if(goingUp && oldIsShowable) {
   						if((isHalf || isBlank) && !oldIsHalf) {
   							layer.restoreOpacity = layer.opacity;
   						}
   						// 	Are we at that half way point?
   						if(layer.opacity >= thresholdOpacity && isHalf) {
   							layer.setOpacity(thresholdOpacity);
   						}
   					}
    					
   					if(isBlank && layer.opacity) {
   						layer.setOpacity(0);
   					}
    			
   					// Do we clobber restoreOpacity
   					if(goingDown && isShowable) {
   						// If its half we restore to half
   						if(isHalf) {
   							// unless it is already set
   							if(!layer.opacity) {
   								layer.setOpacity(layer.restoreOpacity < thresholdOpacity?layer.restoreOpacity:thresholdOpacity);
   							}
   						} else if(layer.restoreOpacity) {
   							layer.setOpacity(layer.restoreOpacity);
   							layer.restoreOpacity = null;
   						}
   					}
    			}
    		});
    		this.oldZoomTo(value);
    	};
    });
}]);

})(angular);
/*!
 * Copyright 2015 Geoscience Australia (http://www.ga.gov.au/copyright.html)
 */

(function(angular){
'use strict';

angular.module("geo.draw", ['geo.map'])

.directive("geoDraw", ['$log', '$rootScope', 'drawService', function($log, $rootScope, drawService) {
	var DEFAULTS = {
		rectangleEvent : "geo.draw.rectangle.created",
		lineEvent : "geo.draw.line.created"
	};
	
	
	return {
		restrict : "AE",
		scope : {
			data: "=",
			rectangleEvent : "@",
			lineEvent : "@"
		},
		link : function(scope, element, attrs, ctrl) {
			
			angular.forEach(DEFAULTS, function(value, key) {
				if(!scope[key]) {
					scope[key] = value;
				}
			});
			
				
			drawService.createControl(scope);
		}
	};
}])

.factory("drawService", ['$q', '$rootScope', 'mapService', function($q, $rootScope, mapService) {
	var drawControl,
		drawer,
		featureGroup,
		rectangleDeferred;	
	
	return {
		createControl : function(parameters) {
			if(drawControl) {
				$q.when(drawControl);
			}
			
			return mapService.getMap().then(function(map) {
				var drawnItems = new L.FeatureGroup(),
				    options = { 
				       edit: {
				          featureGroup: drawnItems
				       }
				    };
	
				if(parameters.data) {
					angular.extend(options, parameters.data);
				}			
				
				featureGroup = parameters.drawnItems = drawnItems;
				
				map.addLayer(drawnItems);
				// Initialise the draw control and pass it the FeatureGroup of editable layers
				drawControl = new L.Control.Draw(options);
				map.addControl(drawControl);
				map.on("draw:created", function(event) {
					({
						polyline : function() {
							var data = {length:event.layer.getLength(), geometry:event.layer.getLatLngs()};
							$rootScope.$broadcast(parameters.lineEvent, data);
						},
						// With rectangles only one can be drawn at a time.
						rectangle : function() {
							var data = {bounds:event.layer.getBounds()};
							rectangleDeferred.resolve(data);
							rectangleDeferred = null;
						}
					})[event.layerType]();
				});
				
				return drawControl;
			});
		},
		
		cancelDrawRectangle : function() {
			if(rectangleDeferred) {
				rectangleDeferred.reject();
				rectangleDeferred = null;
				if(drawer) {
					drawer.disable();
				}
			}
		},
		
		drawRectangle : function() {
			this.cancelDrawRectangle();
			rectangleDeferred = $q.defer();
			if(drawer) {
				drawer.enable();
			} else {
				mapService.getMap().then(function(map) {
					drawer = new L.Draw.Rectangle(map, drawControl.options.polyline);
					drawer.enable();
				});
			}			
			return rectangleDeferred.promise;
		}
	};
}]);

})(angular);
/*!
 * Copyright 2015 Geoscience Australia (http://www.ga.gov.au/copyright.html)
 */
(function(angular, L) {

'use strict';

angular.module("explorer.crosshair", ['geo.map'])

.factory('crosshairService', ['mapService', function(mapService) {
	var map, crosshair;
	
	mapService.getMap().then(function(olMap) { 
		map = olMap; 
	});
	
	return {		
		add : function(point) {
            this.move(point);
		},
		
		remove : function() {
			if(crosshair) {
				map.removeLayer(crosshair);
				crosshair = null; 
			}
		},
		
		move : function(point) {
			var size, icon;
			if(!point) {
				return;
			}
			this.remove();
			icon = L.icon({
			    iconUrl: 'resources/img/cursor-crosshair.png',
			    iconAnchor : [16, 16]
			});

	        crosshair = L.marker([point.y, point.x], {icon: icon});
	        crosshair.addTo(map);
	        return point;
		},
	};
}]);

})(angular, L);
/*!
 * Copyright 2015 Geoscience Australia (http://www.ga.gov.au/copyright.html)
 */
/**
 * This version relies on 0.0.4+ of explorer-path-server as it uses the URL for intersection on the artesian basin plus the actual KML
 */
(function(angular, Exp, L) {
'use strict';

angular.module("geo.elevation", [
                                  'graph',
                                  'explorer.crosshair',
                                  'explorer.flasher',
                                  'explorer.feature.summary',
                                  'geo.map',
                                  'geo.path'])

.directive("pathElevationPlot", ['$log', '$timeout', '$rootScope','$filter', 'elevationService', 'crosshairService',   'featureSummaryService',
             function($log, $timeout, $rootScope, $filter, elevationService, crosshairService, featureSummaryService) {
	var WIDTH = 1000,
		HEIGHT = 90,
		elevationStyle = {
			fill:"orange",
			fillOpacity : 0.4,
			stroke : "darkred",
			strokeWidth : 1.5
		},
		waterTableStyle = {
			fill:"lightblue",
			fillOpacity:0.8,
			stroke:"darkblue",
			strokeWidth : 1.5
		},
		infoLoading = '<span><img alt="Waiting..." src="resources/img/tinyloader.gif" ng-show="message.spinner" style="position:relative;top:2px;" width="12"></img></span>';	
	
	return {
		templateUrl : "map/elevation/elevation.html",
		scope:true,
		controller : ['$scope', function($scope) {
			$scope.paths = [];
			$scope.config = {
					yLabel : "Elevation (m)",
					xLabel : "Distance: 3000m"
			};
			
			$rootScope.$on("elevation.plot.data", function(event, data) {
				$scope.length = data.length;
				$scope.geometry = data.geometry;
				$scope.config.xLabel = "Distance: " + $filter("length")(data.length, true);
				$scope.waterTable = null;
			
				if($scope.length && $scope.geometry) {
					elevationService.getElevation($scope.geometry, $scope.length).then(function(elevation) {
						// Keep a handle on it as we will generally build a collection after the first build
						$scope.elevation = {
								style: elevationStyle,
								data: elevation
						};
						// Show the range.
						$scope.config.leftText = "Elevation Range: " + 
							$filter("length")(d3.min(elevation, function(d) { return d.z; }), true) + " to " + 
							$filter("length")(d3.max(elevation, function(d) { return d.z; }), true);
					
						// If we got here we always want to wipe out existing paths.						
						$scope.paths = [$scope.elevation];
					});

					elevationService.intersectsWaterTable($scope.geometry).then(function(intersects) {
						$scope.intersectsWaterTable = intersects;
					});
				}
			});	
		
			$scope.getInfoText = function() {
				if(!$scope.infoText) {
					$scope.infoText = infoLoading;
					elevationService.getInfoText().then(function(html) {
						$scope.infoText = html;
					});
				}
			};
			
			$scope.toggleWaterTable = function() {
				var length = $scope.paths.length;
				// We have to clear the paths so that it re-renders from scratch.
				$scope.paths = [];
				// Then we re-render on the next animation frame.
				if($scope.waterTable) {
					$timeout(function() {
						if(length == 1) {
							$scope.paths = [$scope.elevation, $scope.waterTable];
						} else {
							$scope.paths = [$scope.elevation];
						}
					});
				} else {
					elevationService.getWaterTable($scope.geometry, $scope.length).then(function(waterTable) {
						$scope.waterTable = {
								style : waterTableStyle,
								data : waterTable
						};
						$scope.paths = [$scope.elevation, $scope.waterTable];							
					});
				}
			};

			$scope.close = function() {
				$scope.paths = $scope.geometry = $scope.length = null;
			};
		}],

		link : function(scope, element) {				
			scope.graphClick = function(event) {
				if(event.position) {
					var point = event.position.points[0].point;
					elevationService.panToPoint(point);
					scope.point = point;
				}				
			};

			scope.graphLeave = function(event) {
				scope.position = null;
				crosshairService.remove();
				cancelDeferredView();
				$log.debug("Mouse left");
				if(scope.mapListener) {
					$log.info("offMapMove");
					featureSummaryService.offMapMove(scope.mapListener);
				}
			};

			scope.graphEnter = function(event) {
				$log.debug("Graph be entered");
			};

			scope.graphMove = function(event) {
				var point;
				
				scope.position = event.position;
				
				if(scope.position) {
					point = scope.position.point;
					window.eve = event;
					scope.position.markerLonlat = crosshairService.move(point);
					deferredView();
				}
				if(!scope.mapListener) {
					scope.mapListener = function() {
						cancelDeferredView();
						deferredView();
					};
					$log.info("onMapMove");
					featureSummaryService.onMapMove(scope.mapListener);
				}
				$log.debug("Mouse moving...");
			};

			scope.$watch("geometry", processGeometry);
			
			function processGeometry() {
				if(scope.line) {
					scope.line = elevationService.pathHide(scope.line);
				}
				if(scope.geometry) {
					scope.line = elevationService.pathShow(scope.geometry);
				} else {
					elevationService.hideWaterTable();
				}
			
			}
			
			function deferredView() {
				$log.info("Deferred view");
				featureSummaryService.deferView(scope.position).then(function(data) {
					scope.featuresUnderPoint = data;
				});
			}
			
			function cancelDeferredView() {
				$log.info("Cancel deferred view");
				featureSummaryService.cancelView();
				scope.featuresUnderPoint = null;
			}
		}
	};
}])

.directive('marsPanTo', ['$rootScope', 'mapService', function($rootScope, mapService) {
	var DEFAULTS = {
		eventName: "elevation.plot.data",
		options: {
			paddingTopLeft:[50, 50], 
			paddingBottomRight:[50, 250]
		}		
	};
	return {
		restrict: 'AE',
		scope: {
			eventName: "=",
			options: "="
		},
		link: function(scope) {
			angular.forEach(DEFAULTS, function(value, key) {
				if(typeof scope[key] == "undefined") {
					scope[key] = value;
				}
			});
						
			$rootScope.$on(scope.eventName, function(event, data) {
				var line = L.polyline(data.geometry);
				var bounds = line.getBounds();
				mapService.getMap().then(function(map) {
					map.fitBounds(bounds, scope.options);
				});
			});	
		}
	};
}])

.directive('marsInfoElevation', ['$log', 'elevationService', function($log, elevationService){
	return {
		templateUrl:"map/elevation/elevationInfo.html",
		scope:true,
		link : function(scope, element) {
			scope.toggleWaterTableShowing = function() {
				scope.state = elevationService.getState();
				
				if(!elevationService.isWaterTableShowing()) {
					elevationService.showWaterTable();
				} else {
					elevationService.hideWaterTable();
				}
			};
		}
	};
}]) 

.provider("elevationService", function ConfigServiceProvider() {
	var pointCount = 500,
		elevationUrl = "service/path/elevation",
		waterTableUrl = "service/path/waterTable",
		artesianBasinKmlUrl = "service/artesianBasin/geometry/kml",
		intersectUrl = "service/artesianBasin/intersects",
		waterTableLayer = null,
		map,
		state = {
			isWaterTableShowing : false
		};
		
	this.setIntersectUrl = function(url) {
		intersectUrl = url;
	};

	this.setKmlUrl = function(url) {
		artesianBasinKmlUrl = url;
	};

	this.setElevationUrl = function(url) {
		elevationUrl = url;
	};

	this.setWaterTableUrl = function(url) {
		waterTableUrl = url;
	};
	
	this.$get = ['$log', '$http', '$q', 'mapService', 'flashService', function($log, $http, $q, mapService, flashService) {

		// We are safe doing this as it can't be triggered until the map is drawn anyway.
		mapService.getMap().then(function(olMap) {map = olMap;});

		var $elevation = {
			panToPoint : function(point) {
				mapService.zoomTo(point.y, point.x);
			},
	
			getState : function() {
				return state;
			},
			
			getElevation : function(geometry, distance) {
				var flasher = flashService.add("Retrieving elevation details...", 8000),
					wktStr = Exp.Util.toLineStringWkt(geometry);

				return $http.post(elevationUrl, {wkt:wktStr, count:pointCount, distance:distance}).then(function(response) {
					flashService.remove(flasher);
					return response.data;
				});	
			},
	
			intersectsWaterTable :function(geometry) {
				var url = intersectUrl + (intersectUrl.indexOf("?") > -1?"":"?wkt=");
				return $http.get(url + Exp.Util.toLineStringWkt(geometry), {cache:true}).then(function(response) {
					return response.data.intersects;
				});
			},
		
			isWaterTableShowing : function() {
                /* jshint -W093 */
				return state.isWaterTableShowing = waterTableLayer !== null;
			},
			
			showWaterTable : function() {
				if(!waterTableLayer) {
					this.getWaterTableLayer().then(function(layer) {
						layer.addTo(map);
					});
				}
				state.isWaterTableShowing = true;
			},
	
			hideWaterTable : function() {
				if(waterTableLayer) {
					map.removeLayer(waterTableLayer);
				}
				waterTableLayer = null;
				state.isWaterTableShowing = false;
			},
		
			createWaterTableLayer : function() {
				return mapService.getMap().then(function(map) {
					var kml = new L.KML(artesianBasinKmlUrl, {async: true});
				
					return kml.on("loaded", function(e) {
						waterTableLayer = e.target;
						return waterTableLayer;
					});				
				});			
			},
		
			getWaterTableLayer : function() {
				return this.createWaterTableLayer();
			},
	
			getWaterTable : function(geometry, distance) {
				var flasher = flashService.add("Retrieving water table details...", 8000),
					wktStr = Exp.Util.toLineStringWkt(geometry);

				return $http.post(waterTableUrl, {wkt:wktStr, count:pointCount, distance:distance}).then(function(response) {
					flashService.remove(flasher);
					return response.data;
				});
			},
	
			getInfoText : function() {
				return $http("map/elevation/elevationInfo.html", {cache : true}).then(function(response) {
					return response.data;
				});
			},
	
			pathShow : function(latlngs) {
				var lineLayer = L.polyline(latlngs, {color: 'red', weight:3, opacity:0.8}).addTo(map);
				return lineLayer;
			},
	
			pathHide : function(lineLayer) {
				map.removeLayer(lineLayer);
				return null;
			}		
		};
		
		return $elevation;
	}];
});

})(angular, Exp, L);
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

/*!
 * Copyright 2015 Geoscience Australia (http://www.ga.gov.au/copyright.html)
 */
(function(angular, context) {
'use strict';

angular.module("explorer.feature.summary", ["geo.map"])

.directive("expPointFeatures", ['mapService', 'featureSummaryService', function(mapService, featureSummaryService) {
	return {
		scope : {
			features:"="
		},
		link:function(scope, element) {
			scope.$watch("features", function(data, old) {
				if(scope.features) {
					featureSummaryService.showPopup(scope.features);
				} else if(old){
					featureSummaryService.hidePopup();
				}
			});
			
		}
	};
}])

.directive("featuresUnderPoint", ['$timeout', 'featureSummaryService', 'mapService', function($timeout, featureSummaryService, mapService) {
	var DELAY = 400;
	return {
		restrict :"AE",
		scope : true,		
		link : function(scope, element) {
			mapService.getMap().then(function(map) {
				var timeout, control = L.control.features();
				
				map.addControl(control);
				map.on("featuresactivate", featuresActivated);
				map.on("featuresdeactivate", featuresDeactivated);
				
				function featuresActivated(event) {
					map.on("mousemove", moveHandler);
					map.on("mouseout", moveCancel);
				}
				
				function featuresDeactivated(event) {
					$timeout.cancel(timeout);
					featureSummaryService.hidePopup();
					map.off("mousemove", moveHandler);
					map.off("mouseout", moveCancel);
				}
				
				function moveCancel() {
					$timeout.cancel(timeout);					
				} 
				
				function moveHandler(event) {
					$timeout.cancel(timeout);
					timeout = $timeout(function() {
						var position = {
							markerLonLat : event.latlng,
							point:{x:event.latlng.lng, y:event.latlng.lat}
						};
						featureSummaryService.getAndShowFeatures(position);
					}, DELAY);
				}
			});			
		}
	};
}])

.factory("featureSummaryService", ['$log', 'configService', 'mapService', '$timeout', '$rootScope', '$q', '$http', function($log, configService, mapService, $timeout, $rootScope, $q, $http) {
	var featuresUnderPointUrl = "service/path/featureCount",
		featuresUnderPoint,
		map, marker, 
		lastDeferredTimeout,
		control;
	
	mapService.getMap().then(function(olMap) {
		map = olMap; 
	});
	
	return {
		getAndShowFeatures : function(position) {
			this.view(position).then(function(features) {
				this.showPopup(features);
			}.bind(this));
		},
		
		showPopup : function(features) {
			var latlng = features.position.point;

			mapService.getMap().then(function(map){
				var buffer = [];
				angular.forEach(features.data, function(val, key) {
					buffer.push(key + " (" + val + ")");
				});
					
				L.popup()
			   		.setLatLng([latlng.y, latlng.x])
			   		.setContent(buffer.length?buffer.join('<br />'):"No nearby features")
			   		.openOn(map);
			});						 
		},		
		
		hidePopup : function() {
			// Blow away the popup if we no longer have features.
			mapService.getMap().then(function(map) {
				map.closePopup();
			});
		},
		
		view : function(position) {
			var deferred = $q.defer();
			
			lastDeferredTimeout = null;
			if(position.point) {
				this.featuresUnderPoint(position.point).then(function(data) {
					var count = 0;
					angular.forEach(data, function(item) {
						count += item;
					});
				
					deferred.resolve({data:data, position:position, count:count});
				});
			}
			return deferred.promise;
		},
		
		deferView : function(position) {
			var self = this, 
				deferred = $q.defer();
			
			this.cancelView();
			lastDeferredTimeout = $timeout(function(){
				self.view(position).then(function(data) {
					deferred.resolve(data);
				});
			}.bind(this), 200);
			
			return deferred.promise;
		},
		
		cancelView : function() {
			if(lastDeferredTimeout) {
				$timeout.cancel(lastDeferredTimeout);
			}
		},
		
		clearView : function() {
			
		},
		
		onMapMove : function(callback) {
			$log.debug("Adding event handler");			
			map.on("moveend", map, callback);
			return callback;
		},
		
		offMapMove : function(callback) {
			$log.debug("Removing event handler");
			map.off("moveend", map, callback);
		},
		
		positionFromLonlat : function(lonlat) {
			var lat = lonlat.lat?lonlat.lat:lonlat.y,
				lon = lonlat.lon?lonlat.lon:lonlat.x,
				wrap = [lat, lon];
			
			var position = map.project(wrap);
			

			console.log([wrap, position]);
			return position;
		},
		
		getViewPort : function() {
			return  map._container.getBoundingClientRect();
		},
		
		featuresUnderPoint : function(point) {
			var deferred = $q.defer(),
				bounds = map._container.getBoundingClientRect(),
				ratio = (window.devicePixelRatio)?window.devicePixelRatio : 1,
				extent = map.getBounds();
			
			configService.getConfig("clientSessionId").then(function(id) {			
				$http.post(featuresUnderPointUrl, {
					clientSessionId:id,
					x:point.x, 
					y:point.y,
					width:bounds.width / ratio, 
					height:bounds.height / ratio,
					extent : {
						left : extent.left,
						right : extent.right,
						top: extent.top,
						bottom: extent.bottom
					}}).then(function(response) {
						deferred.resolve(response.data);
				});
				
			});

			return deferred.promise;
		}
	};
}]);

})(angular, window);
(function (angular, google, window) {

'use strict';

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

}(angular, google, window));
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
		templateUrl : "map/layerinspector/layerInspector.html"
	};
}]);

})(angular);
/*!
 * Copyright 2015 Geoscience Australia (http://www.ga.gov.au/copyright.html)
 */
(function(angular) {
'use strict';

angular.module("explorer.layer.slider", [])

.directive('explorerLayerSlider', [function() {
	return {
		template : '<slider min="0" ng-show="layer" max="1" step="0.1" updateevent="slideStop" ng-model="slider.opacity" ng-disabled="!slider.visibility" ui-tooltip="hide"></slider>',
		scope: {
			layer:"=?"
		},
		
		link: function(scope, element, attrs) {
			scope.slider = {
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
					if(typeof scope.slider.opacity == "undefined") {
						scope.slider.opacity = scope.layer.options.opacity;
					} else {
						scope.layer.setOpacity(scope.slider.opacity);						
					}
				}
			});
		}
	};	
}]);

})(angular);
/*!
 * Copyright 2015 Geoscience Australia (http://www.ga.gov.au/copyright.html)
 */

(function (angular, window, L) {

'use strict';


angular.module('geo.maphelper', ['geo.map'])

.factory("mapHelper", ["mapService",  "$timeout", "$q", "$rootScope", "flashService", 
                       function(mapService,  $timeout, $q, $rootScope, flashService){
	var  helper = { 
		timeoutPeriod: 200, 
		timeout : null,
		callbacks:{}, 
		checkMarkers:function(){}, 
		zoomToMarkPoints:function(results, marker){
			mapService.getMap().then(function(map) {
				map.setView(results[0], 12, {animate:true});
			});
		}, 
		zoomToLonLats:function(mapService){},
		markPoint:function(mapService){},
		getPseudoBaseLayer:function(){
			return mapService.getMap().then(function(map) {
				var response = null;
				map.eachLayer(function(layer) {
					if(layer.pseudoBaseLayer) {
						response = layer;
					}
				});
				return response;
			});
			
		},
		subscribe:function(name, func)	{	
			if (!this.callbacks[name]) this.callbacks[name]={ subscribers:[] };
			this.callbacks[name].subscribers.push(func);
        },
		pubChangeBaseLayerBias:function(mapService){},
		getExtentWkt:function(){
			return mapService.getMap().then(function(map) {
				return Exp.Util.boundsToWktPoly(map.getBounds());
			});
		},
		decorateWfsLayer:function(mapService){}
	};
	
	mapService.getMap().then(function(map) {
		map.on("moveend", handleChange);
		function handleChange(event) {
			$timeout.cancel(helper.timeout);
			helper.timeout = $timeout(function() {
				$rootScope.$broadcast("extentOfInterestChanged", map);
			}, helper.timoutPeriod);
		}
	});
	
	
	return helper;
}]);

})(angular, window, L);
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
/*!
 * Copyright 2015 Geoscience Australia (http://www.ga.gov.au/copyright.html)
 */

(function(angular, L) {

'use strict';

angular.module("geo.path", ['geo.map', 'explorer.config', 'explorer.flasher', 'explorer.message'])

.directive("geoPath", ['mapService', 'pathService', '$rootScope', 'flashService', 'messageService', 'configService', '$timeout', '$q',
                              function(mapService, pathService, $rootScope, flashService, messageService, configService, $timeout, $q) {
	var KEY = "distance",
		plotter;
	
	return {
		controller:['$scope', function($scope) {
			$scope.name = "PATH";
			
		}],
		link :function(scope, element, attrs) {
			scope.distanceMeasure = {
					distance:"-"
			};
			
			
			// Set up some methods to get data
			scope.showElevation = function() {
				var points = plotter.getLatLngs();
				
				
				var geometry = mapService.getDistanceGeometry(),
					distance = geometry.clone().transform(EPSG3857, EPSG4326).getGeodesicLength();

				scope.disable();
				pathService.triggerElevationPlot({length:distance, geometry:geometry});
			};
			
			scope.disable = function() {
				scope.item = "";
				closeHandler();
			};
			
			scope.$watch("item", function(newValue, oldValue) {
				if(newValue == KEY) {
					flashService.add("Click on map to start a path or add next point. Double click to end path.", 4000);
					mapService.getMap().then(function(map) {
						plotter = L.Polyline.Plotter([], {weight:4});
						plotter.addTo(map);
					});
				} else if(oldValue == KEY) {
					closeHandler();					
				}
			});
			
			function closeHandler() {
				mapService.getMap().then(function(map) {
					map.removeLayer(plotter);
				});
			}
		}
	};
}])

.factory("pathService", ['$http', 'mapService', '$q', 'flashService', '$timeout', '$window', '$rootScope', 
                            function($http, mapService, $q, flashService, $timeout, $window, $rootScope) {
	return {	
		triggerElevationPlot : function(data) {
			$rootScope.$broadcast("elevation.plot.data", data);
		}
	};
}])

.filter('length', ['$filter', function($filter) {
	// Nice representation of length for the UI.
	var map = {units: "m", threshold: 100000, aboveThresholdUnits: "km", divideBy: 1000};

	return function(length, free) {
		var units, buffer;
		
		if(!length && length !== 0) {
			return null;
		}
		
		if(map.threshold && length > map.threshold) {
			length = length / map.divideBy;
			units = map.aboveThresholdUnits;
		} else {
			units = map.units;
		}
		
		buffer = $filter("number")(length, 0) + " " + units;
		if(free) {
			return buffer;
		}
		return "(" + buffer + ")";
	};
}]);


})(angular, L);
(function () {

    "use strict";


    /**
     * @constant MODES
     * @type {{VIEW: number, CREATE: number, EDIT: number, DELETE: number, APPEND: number, EDIT_APPEND: number, ALL: number}}
     */
    var MODES = {
        VIEW:        1,
        CREATE:      2,
        EDIT:        4,
        DELETE:      8,
        APPEND:      16,
        EDIT_APPEND: 4 | 16,
        ALL:         1 | 2 | 4 | 8 | 16
    };

    /**
     * @module Pather
     * @author Adam Timberlake
     * @link https://github.com/Wildhoney/L.Pather
     */
    L.Pather = L.FeatureGroup.extend({

        /**
         * @method initialize
         * @param {Object} [options={}]
         * @return {void}
         */
        initialize: function initialize(options) {

            this.options       = Object.assign(this.defaultOptions(), options || {});
            this.creating      = false;
            this.polylines     = [];
            this.eventHandlers = [];

        },

        /**
         * @method createPath
         * @param {L.LatLng[]} latLngs
         * @return {L.Pather.Polyline|Boolean}
         */
        createPath: function createPath(latLngs) {

            if (latLngs.length <= 1) {
                return false;
            }

            this.clearAll();

            var polyline = new L.Pather.Polyline(this.map, latLngs, this.options, {
                fire: this.fire.bind(this),
                mode: this.getMode.bind(this),
                remove: this.removePath.bind(this)
            });

            this.polylines.push(polyline);

            this.fire('created', {
                polyline: polyline,
                latLngs: polyline.getLatLngs()
            });

            return polyline;

        },

        /**
         * @method removePath
         * @param {L.Pather.Polyline} model
         * @return {Boolean}
         */
        removePath: function removePath(model) {

            if (model instanceof L.Pather.Polyline) {

                var indexOf = this.polylines.indexOf(model);
                this.polylines.splice(indexOf, 1);

                model.softRemove();

                this.fire('deleted', {
                    polyline: model,
                    latLngs: []
                });

                return true;

            }

            return false;

        },

        /**
         * @method getPaths
         * @return {Array}
         */
        getPaths: function getPolylines() {
            return this.polylines;
        },

        /**
         * @method onAdd
         * @param {L.Map} map
         * @return {void}
         */
        onAdd: function onAdd(map) {

            var element        = this.element = this.options.element || map.getContainer();
            this.draggingState = map.dragging._enabled;
            this.map           = map;
            this.fromPoint     = { x: 0, y: 0 };
            this.svg           = d3.select(element)
                                   .append('svg')
                                       .attr('pointer-events', 'none')
                                       .attr('class', this.getOption('moduleClass'))
                                       .attr('width', this.getOption('width'))
                                       .attr('height', this.getOption('height'));

            map.dragging.disable();

            // Attach the mouse events for drawing the polyline.
            this.attachEvents(map);
            this.setMode(this.options.mode);

        },

        /**
         * @method onRemove
         * @return {void}
         */
        onRemove: function onRemove() {

            this.svg.remove();

            if (this.options.removePolylines) {

                var length = this.polylines.length;

                while (length--) {
                    this.removePath(this.polylines[length]);
                }

            }

            this.map.off('mousedown', this.eventHandlers.mouseDown);
            this.map.off('mousemove', this.eventHandlers.mouseMove);
            this.map.off('mouseup',   this.eventHandlers.mouseUp);
            this.map.getContainer().removeEventListener('mouseleave', this.eventHandlers.mouseLeave);

            this.element.classList.remove('mode-create');
            this.element.classList.remove('mode-delete');
            this.element.classList.remove('mode-edit');
            this.element.classList.remove('mode-append');

            var tileLayer     = this.map.getContainer().querySelector('.leaflet-tile-pane'),
                originalState = this.draggingState ? 'enable' : 'disable';
            tileLayer.style.pointerEvents = 'all';
            this.map.dragging[originalState]();

        },

        /**
         * @method getEvent
         * @param {Object} event
         * @return {Object}
         */
        getEvent: function getEvent(event) {

            if (event.touches) {
                return event.touches[0];
            }

            return event;

        },

        /**
         * @method edgeBeingChanged
         * @return {Array}
         */
        edgeBeingChanged: function edgeBeingChanged() {

            var edges = this.polylines.filter(function filter(polyline) {
                return polyline.manipulating;
            });

            return edges.length === 0 ? null : edges[0];

        },

        /**
         * @method isPolylineCreatable
         * @return {Boolean}
         */
        isPolylineCreatable: function isPolylineCreatable() {
            return !!(this.options.mode & MODES.CREATE);
        },

        /**
         * @property events
         * @type {Object}
         */
        events: {

            /**
             * @method mouseDown
             * @param {Object} event
             */
            mouseDown: function mouseDown(event) {

                event = event.originalEvent || this.getEvent(event);

                var point  = this.map.mouseEventToContainerPoint(event),
                    latLng = this.map.containerPointToLatLng(point);

                if (this.isPolylineCreatable() && !this.edgeBeingChanged()) {

                    this.creating  = true;
                    this.fromPoint = this.map.latLngToContainerPoint(latLng);
                    this.latLngs   = [];

                }

            },

            /**
             * @method mouseMove
             * @param {Object} event
             * @return {void}
             */
            mouseMove: function mouseMove(event) {

                event     = event.originalEvent || this.getEvent(event);
                var point = this.map.mouseEventToContainerPoint(event);

                if (this.edgeBeingChanged()) {
                    this.edgeBeingChanged().moveTo(this.map.containerPointToLayerPoint(point));
                    return;
                }

                var lineFunction = d3.svg.line()
                    .x(function x(d) { return d.x; })
                    .y(function y(d) { return d.y; })
                    .interpolate('linear');

                if (this.creating) {

                    var lineData = [this.fromPoint, new L.Point(point.x, point.y, false)];
                    this.latLngs.push(point);

                    this.svg.append('path')
                        .classed(this.getOption('lineClass'), true)
                        .attr('d', lineFunction(lineData))
                        .attr('stroke', this.getOption('strokeColour'))
                        .attr('stroke-width', this.getOption('strokeWidth'))
                        .attr('fill', 'none');

                    this.fromPoint = { x: point.x, y: point.y };

                }

            },

            /**
             * @method mouseLeave
             * @return {void}
             */
            mouseLeave: function mouseLeave() {
                this.clearAll();
                this.creating = false;
            },

            /**
             * @method mouseUp
             * @return {void}
             */
            mouseUp: function mouseup() {

                if (this.creating) {

                    this.creating = false;
                    this.createPath(this.convertPointsToLatLngs(this.latLngs));
                    this.latLngs  = [];
                    return;

                }

                if (this.edgeBeingChanged()) {

                    this.edgeBeingChanged().attachElbows();
                    this.edgeBeingChanged().finished();
                    this.edgeBeingChanged().manipulating = false;

                }

            }

        },

        /**
         * @method attachEvents
         * @param {L.Map} map
         * @return {void}
         */
        attachEvents: function attachEvents(map) {

            this.eventHandlers = {
                mouseDown:  this.events.mouseDown.bind(this),
                mouseMove:  this.events.mouseMove.bind(this),
                mouseUp:    this.events.mouseUp.bind(this),
                mouseLeave: this.events.mouseLeave.bind(this)
            };

            this.map.on('mousedown', this.eventHandlers.mouseDown);
            this.map.on('mousemove', this.eventHandlers.mouseMove);
            this.map.on('mouseup', this.eventHandlers.mouseUp);
            this.map.getContainer().addEventListener('mouseleave', this.eventHandlers.mouseLeave);

            // Attach the mobile events that delegate to the desktop events.
            this.map.getContainer().addEventListener('touchstart', this.fire.bind(map, 'mousedown'));
            this.map.getContainer().addEventListener('touchmove', this.fire.bind(map, 'mousemove'));
            this.map.getContainer().addEventListener('touchend', this.fire.bind(map, 'mouseup'));

        },

        /**
         * @method convertPointsToLatLngs
         * @param {Point[]} points
         * @return {LatLng[]}
         */
        convertPointsToLatLngs: function convertPointsToLatLngs(points) {

            return points.map(function map(point) {
                return this.map.containerPointToLatLng(point);
            }.bind(this));

        },

        /**
         * @method clearAll
         * @return {void}
         */
        clearAll: function clearAll() {
            this.svg.text('');
        },

        /**
         * @method getOption
         * @param {String} property
         * @return {String|Number}
         */
        getOption: function getOption(property) {
            return this.options[property] || this.defaultOptions()[property];
        },

        /**
         * @method defaultOptions
         * @return {Object}
         */
        defaultOptions: function defaultOptions() {

            return {
                moduleClass: 'pather',
                lineClass: 'drawing-line',
                detectTouch: true,
                elbowClass: 'elbow',
                removePolylines: true,
                strokeColour: 'rgba(0,0,0,.5)',
                strokeWidth: 2,
                width: '100%',
                height: '100%',
                smoothFactor: 10,
                pathColour: 'black',
                pathOpacity: 0.55,
                pathWidth: 3,
                mode: MODES.ALL
            };

        },

        /**
         * @method setSmoothFactor
         * @param {Number} smoothFactor
         * @return {void}
         */
        setSmoothFactor: function setSmoothFactor(smoothFactor) {
            this.options.smoothFactor = parseInt(smoothFactor);
        },

        /**
         * @method setMode
         * @param {Number} mode
         * @return {void}
         */
        setMode: function setMode(mode) {

            this.setClassName(mode);
            this.options.mode = mode;

            var tileLayer = this.map.getContainer().querySelector('.leaflet-tile-pane');

            /**
             * @method shouldDisableDrag
             * @return {Boolean}
             * @see http://www.stucox.com/blog/you-cant-detect-a-touchscreen/
             */
            var shouldDisableDrag = function shouldDisableDrag() {

                if (this.detectTouch && ('ontouchstart' in $window || 'onmsgesturechange' in $window)) {
                    return (this.options.mode & MODES.CREATE || this.options.mode & MODES.EDIT);
                }

                return (this.options.mode & MODES.CREATE);

            }.bind(this);

            if (shouldDisableDrag()) {

                var originalState = this.draggingState ? 'disable' : 'enable';
                tileLayer.style.pointerEvents = 'none';
                return void this.map.dragging[originalState]();

            }

            tileLayer.style.pointerEvents = 'all';
            this.map.dragging.enable();

        },

        /**
         * @method setClassName
         * @param {Number} mode
         * @return {void}
         */
        setClassName: function setClassName(mode) {

            /**
             * @method conditionallyAppendClassName
             * @param {String} modeName
             * @return {void}
             */
            var conditionallyAppendClassName = function conditionallyAppendClassName(modeName) {

                var className = ['mode', modeName].join('-');

                if (MODES[modeName.toUpperCase()] & mode) {
                    return void this.element.classList.add(className);
                }

                this.element.classList.remove(className);

            }.bind(this);

            conditionallyAppendClassName('create');
            conditionallyAppendClassName('delete');
            conditionallyAppendClassName('edit');
            conditionallyAppendClassName('append');
        },

        /**
         * @method getMode
         * @return {Number}
         */
        getMode: function getMode() {
            return this.options.mode;
        },

        /**
         * @method setOptions
         * @param {Object} options
         * @return {void}
         */
        setOptions: function setOptions(options) {
            this.options = Object.assign(this.options, options || {});
        }

    });

    /**
     * @constant L.Pather.MODE
     * @type {Object}
     */
    L.Pather.MODE = MODES;

    // Simple factory that Leaflet loves to bundle.
    L.pather = function pather(options) {
        return new L.Pather(options);
    };

})(window);
(function main() {

    "use strict";

    /* jshint ignore:start */

    if (!Object.assign) {
        Object.defineProperty(Object, 'assign', {
            enumerable: false,
            configurable: true,
            writable: true,
            value: function(target, firstSource) {
                'use strict';
                if (target === undefined || target === null) {
                    throw new TypeError('Cannot convert first argument to object');
                }

                var to = Object(target);
                for (var i = 1; i < arguments.length; i++) {
                    var nextSource = arguments[i];
                    if (nextSource === undefined || nextSource === null) {
                        continue;
                    }
                    nextSource = Object(nextSource);

                    var keysArray = Object.keys(Object(nextSource));
                    for (var nextIndex = 0, len = keysArray.length; nextIndex < len; nextIndex++) {
                        var nextKey = keysArray[nextIndex];
                        var desc = Object.getOwnPropertyDescriptor(nextSource, nextKey);
                        if (desc !== undefined && desc.enumerable) {
                            to[nextKey] = nextSource[nextKey];
                        }
                    }
                }
                return to;
            }
        });
    }

    /* jshint ignore:end */

})();
(function main() {

    "use strict";

    /**
     * @constant DATA_ATTRIBUTE
     * @type {String|Symbol}
     */
    var DATA_ATTRIBUTE = typeof Symbol === 'undefined' ? '_pather' : Symbol["for"]('pather');

    /**
     * @module Pather
     * @submodule Polyline
     * @param {L.Map} map
     * @param {L.LatLng[]} latLngs
     * @param {Object} [options={}]
     * @param {Object} methods
     * @return {Polyline}
     * @constructor
     */
    L.Pather.Polyline = function Polyline(map, latLngs, options, methods) {

        this.options = {
            color:        options.pathColour,
            opacity:      options.pathOpacity,
            weight:       options.pathWidth,
            smoothFactor: options.smoothFactor || 1,
            elbowClass:   options.elbowClass
        };

        this.polyline     = new L.Polyline(latLngs, this.options).addTo(map);
        this.map          = map;
        this.methods      = methods;
        this.edges        = [];
        this.manipulating = false;

        this.attachPolylineEvents(this.polyline);
        this.select();

    };

    /**
     * @property prototype
     * @type {Object}
     */
    L.Pather.Polyline.prototype = {

        /**
         * @method select
         * @return {void}
         */
        select: function select() {
            this.attachElbows();
        },

        /**
         * @method deselect
         * @return {void}
         */
        deselect: function deselect() {
            this.manipulating = false;
        },

        /**
         * @method attachElbows
         * @return {void}
         */
        attachElbows: function attachElbows() {

            this.detachElbows();

            this.polyline._parts[0].forEach(function forEach(point) {

                var divIcon = new L.DivIcon({ className: this.options.elbowClass }),
                    latLng  = this.map.layerPointToLatLng(point),
                    edge    = new L.Marker(latLng, { icon: divIcon }).addTo(this.map);

                edge[DATA_ATTRIBUTE] = { point: point };
                this.attachElbowEvents(edge);
                this.edges.push(edge);

            }.bind(this));

        },

        /**
         * @method detachElbows
         * @return {void}
         */
        detachElbows: function detachElbows() {

            this.edges.forEach(function forEach(edge) {
                this.map.removeLayer(edge);
            }.bind(this));

            this.edges.length = 0;

        },

        /**
         * @method attachPolylineEvents
         * @param {L.Polyline} polyline
         * @return {void}
         */
        attachPolylineEvents: function attachPathEvent(polyline) {

            polyline.on('click', function click(event) {

                event.originalEvent.stopPropagation();
                event.originalEvent.preventDefault();

                if (this.methods.mode() & L.Pather.MODE.APPEND) {

                    // Appending takes precedence over deletion!
                    var latLng = this.map.mouseEventToLatLng(event.originalEvent);
                    this.insertElbow(latLng);

                } else if (this.methods.mode() & L.Pather.MODE.DELETE) {
                    this.methods.remove(this);
                }

            }.bind(this));

        },

        /**
         * @method attachElbowEvents
         * @param {L.Marker} marker
         * @return {void}
         */
        attachElbowEvents: function attachElbowEvents(marker) {

            marker.on('mousedown', function mousedown(event) {

                event = event.originalEvent || event;

                if (this.methods.mode() & L.Pather.MODE.EDIT) {

                    if (event.stopPropagation) {
                        event.stopPropagation();
                        event.preventDefault();
                    }

                    this.manipulating = marker;

                }

            }.bind(this));

            marker.on('mouseup', function mouseup(event) {

                event = event.originalEvent || event;

                if (event.stopPropagation) {
                    event.stopPropagation();
                    event.preventDefault();
                }

                this.manipulating = false;

            });

            // Attach the mobile events to delegate to the desktop equivalent events.
            marker._icon.addEventListener('touchstart', marker.fire.bind(marker, 'mousedown'));
            marker._icon.addEventListener('touchend', marker.fire.bind(marker, 'mouseup'));

        },

        /**
         * @method insertElbow
         * @param {L.LatLng} latLng
         * @return {void}
         */
        insertElbow: function insertElbow(latLng) {

            var newPoint      = this.map.latLngToLayerPoint(latLng),
                leastDistance = Infinity,
                insertAt      = -1,
                points        = this.polyline._parts[0];

            points.forEach(function forEach(currentPoint, index) {

                var nextPoint = points[index + 1] || points[0],
                    distance  = L.LineUtil.pointToSegmentDistance(newPoint, currentPoint, nextPoint);

                if (distance < leastDistance) {
                    leastDistance = distance;
                    insertAt      = index;
                }

            }.bind(this));

            points.splice(insertAt + 1, 0, newPoint);

            var parts = points.map(function map(point) {
                var latLng = this.map.layerPointToLatLng(point);
                return { _latlng: latLng };
            }.bind(this));

            this.redraw(parts);
            this.attachElbows();

        },

        /**
         * @method moveTo
         * @param {L.Point} point
         * @return {void}
         */
        moveTo: function moveTo(point) {

            var latLng = this.map.layerPointToLatLng(point);
            this.manipulating.setLatLng(latLng);
            this.redraw(this.edges);

        },

        /**
         * @method finished
         * @return {void}
         */
        finished: function finished() {

            this.methods.fire('edited', {
                polyline: this,
                latLngs: this.getLatLngs()
            });

        },

        /**
         * @method redraw
         * @param {Array} edges
         * @return {void}
         */
        redraw: function redraw(edges) {

            var latLngs = [],
                options = {};

            edges.forEach(function forEach(edge) {
                latLngs.push(edge._latlng);
            });

            Object.keys(this.options).forEach(function forEach(key) {
                options[key] = this.options[key];
            }.bind(this));

            options.smoothFactor = 0;

            this.softRemove(false);
            this.polyline = new L.Polyline(latLngs, options).addTo(this.map);
            this.attachPolylineEvents(this.polyline);

        },

        /**
         * @method softRemove
         * @param {Boolean} [edgesToo=true]
         * @return {void}
         */
        softRemove: function softRemove(edgesToo) {

            edgesToo = typeof edgesToo === 'undefined' ? true : edgesToo;

            this.map.removeLayer(this.polyline);

            if (edgesToo) {

                this.edges.forEach(function forEach(edge) {
                    this.map.removeLayer(edge);
                }.bind(this));

            }

        },

        /**
         * @method getLatLngs
         * @return {LatLng[]}
         */
        getLatLngs: function getLatLngs() {

            return this.polyline._parts[0].map(function map(part) {
                return this.map.layerPointToLatLng(part);
            }.bind(this));

        }
        
    };

})();
/*!
 * Copyright 2015 Geoscience Australia (http://www.ga.gov.au/copyright.html)
 */
(function(angular, L, window) {
'use strict';

angular.module("explorer.point", ['geo.map', 'explorer.flasher'])

.directive("expPoint", ['pointService', function(pointService) {
	return {
		scope : {
			data : "=point"
		},		
		controller : ['$scope', function($scope) {
			$scope.$watch("data", function(newData, oldData) {
				if(newData || oldData) {
					pointService.showPoint($scope.data);
				}
			});
		}]
	};
}])

.directive("expClickMapPoint", ['pointService', function(pointService) {
	return {
		restrict:'AE',
		scope : {
		},		
		link : function(scope, element) {
			pointService.addMapListener(function(latlon) {
				pointService.showPoint(latlon);
			}, this);
		}
	};
}])

.directive("expPointInspector", ['pointService', 'flashService', '$rootScope', '$filter', function(pointService, flashService, $rootScope, $filter) {
	var defaultOptions = {
			actions : [],
			visible : true,
			modal : false,
			minWidth : 240,
			title : "Features within approx 2km",
			position : {top:140, left:40}
		};
	
	return {
		restrict:"AE",
		templateUrl : "map/point/point.html",
		scope :true,
		controller : ['$scope', function($scope) {
			if($scope.options) {
				$scope.windowOptions = angular.extend({}, defaultOptions, scope.options);
			} else {
				$scope.windowOptions = angular.extend({}, defaultOptions);
			}
		}],
		link : function(scope, element) {
			console.log("Id = ", scope.$id);
			// This things is a one shot wonder so we listen for an event.
			$rootScope.$on("map.point.changed", function(event, point) {
				scope.point = point;
				pointService.removeLayer();
				if(typeof point != "undefined" && point) {
					scope.changePoint(point);
					pointService.getMetaData().then(function(response) {
						scope.metadata = response.data;
					});
				}
			});
			
			scope.createTitle = function() {
				var oneItem = !this.greaterThanOneItem(),
					layerName = this.feature.layerName,
					metadata = this.metadata[layerName],
					preferredLabel = metadata.preferredLabel,
					value = this.feature.attributes[preferredLabel];
				
				if(!oneItem && value && value != "Null") {
					return value;
				} else {
					return metadata.label;
				}				
			};
			
			scope.changePoint = function(newValue) {
				pointService.moveMarker(newValue);
				if(newValue) {
					pointService.getInfo(newValue).then(function(data) {
						handleResponse(data);
					});
				}
				pointService.removeLayer();
			};
			
			scope.clearPoint = function() {
				scope.point = false;
				pointService.removeLayer();
				pointService.removeMarker();
			};
			
			scope.toggleShow = function() {
				this.feature.displayed = !this.feature.displayed;
				if(this.feature.displayed) {
					this.feature.feature = pointService.showFeature(this.feature);
				} else {
					pointService.hideFeature(this.feature.feature);
					this.feature.layer = null;
				}
			};			
			
			scope.oneShowing = function() {
				var group = $filter("filterGroupsByLayername")(scope.featuresInfo.results, this.item),
					oneShown = false;
				group.forEach(function(feature) {
					oneShown |= feature.displayed;
				});
				return oneShown;
			};
			
			scope.greaterThanOneItem = function() {
				return $filter("filterGroupsByLayername")(scope.featuresInfo.results, this.item).length > 1;
			};
			
			scope.groupShow = function() {
				var group = $filter("filterGroupsByLayername")(scope.featuresInfo.results, this.item),
					oneShown = false;
				
				group.forEach(function(feature) {
					oneShown |= feature.displayed;
				});
				
				group.forEach(function(feature) {
					if(oneShown) {
						feature.feature = pointService.hideFeature(feature.feature);
						feature.displayed = false;
					} else {
						feature.feature = pointService.showFeature(feature);
						feature.displayed = true;
					}
				});
			};			
			
			scope.allHidden = function() {
				var allHidden = true;
				if(this.featuresInfo && this.featuresInfo.results) {
					this.featuresInfo.results.forEach(function(feature) {
						allHidden &= !feature.displayed;
					});
				}
				return allHidden;
			};
			
			scope.toggleAll = function() {
				var allHidden = scope.allHidden();
				this.featuresInfo.results.forEach(function(feature) {
					if(allHidden) {
						if(!feature.displayed) {
							feature.displayed = true;
							feature.feature = pointService.showFeature(feature);
						}
					} else {
						if(feature.displayed) {
							feature.displayed = false;
							feature.feature = pointService.hideFeature(feature.feature);
						}
					}
				});
			};
			
			scope.elevationPath = function(label) {
				if(!this.feature.feature) {
					this.feature.feature = pointService.createFeature(this.feature);
				}
				pointService.triggerElevationPlot(this.feature.feature[0], label);
			};
			
			function handleResponse(data) {
				scope.featuresInfo = data;
				pointService.createLayer();				
			}
		}
	};
}])

.factory("pointService", ['$http', '$q', 'configService', 'mapService', '$rootScope', function($http, $q, configService, mapService, $rootScope){
	var featuresUnderPointUrl = "service/path/featureInfo",
		layer = null,
		control = null,
		esriGeometryMapping = {
			"esriGeometryPoint"   : {
				createFeatures : function(geometry) {
					var point = [geometry.y, geometry.x];
					return [L.circleMarker(point)];
				},
				type : "x,y"
			},
			"esriGeometryPolyline": {
				createFeatures : function(geometry) {
					var features = [];
					geometry.paths.forEach(function(path) {
						var points = [];
						path.forEach(function(point) {
							points.push([point[1], point[0]]);
						});						
						features.push(L.polyline(points));
					});
					return features;
				},
				type: "paths"
			},
			"esriGeometryPolygon" : {
				createFeatures : function(geometry) {
					var polygonGeometry,
						rings = [];
					
					geometry.rings.forEach(function(ring) {
						var linearRing, polygon, points = [];
						ring.forEach(function(pointArr) {
							points.push([pointArr[1], pointArr[0]]);
						});
					    rings.push(points);
					});
					polygonGeometry = L.multiPolygon(rings);
					return [polygonGeometry];
				},
				type: "rings"
			}
		},
		metaDataUrl = "map/point/pointMetadata.json",
		marker = null,
		clickControl = null,
		clickListeners = [];
	
	return {
		triggerElevationPlot : function(geometry, label) {
			var distance = geometry.getLength();
			$rootScope.$broadcast("elevation.plot.data", {length:distance, geometry:geometry.getLatLngs(), heading:label});
		},
		
		addMapListener : function(callback, bound) {
			var alreadyBound = false;
			clickListeners.forEach(function(obj) {
				if(obj.callback == callback && obj.bound == bound) {
					alreadyBound = true;
				}
			});
			if(!alreadyBound) {
				clickListeners.push({callback : callback, bound : bound});
			}
			
			if(!clickControl) {
				clickControl = true;
				mapService.getMap().then(function(map) {
		            map.on("click", function(e) {
		               clickListeners.forEach(function(listener) {
		            	   var callback = listener.callback,
		            	   		point = {
		            			   x: e.latlng.lng,
		            			   y: e.latlng.lat
		            	   		};
		            	   
		            	   point.lat = point.y;
		            	   point.lng = point.x;
		                   if(listener.bound) {
		                	   callback.bind(listener.bound);
		                   }
		                   callback(point);
		                }); 
		            });
				});
			}
		},
		
		getMetaData : function() {
			return $http.get(metaDataUrl, {cache:true});
		},
		
		moveMarker : function(point) {
			mapService.getMap().then(function(map) {
				var size, offset, icon;
	
				if(marker) {
					map.removeLayer(marker);
				}
				marker = L.marker(point).addTo(map);
			});
			
		},
		
		removeMarker : function() {
			if(marker) {
				mapService.getMap().then(function(map) {
					map.removeLayer(marker);
					marker = null;					
				});
			}			
		},
		
		showPoint : function(point) {
			$rootScope.$broadcast("map.point.changed", point);
		},
		
		removePoint : function() {
			$rootScope.$broadcast("map.point.changed", null);
		},
		
		getBehaviour : function(geometryType) {
			
		},
		
		getInfo : function(point) {
			return mapService.getMap().then(function(map) {
				var bounds = map._container.getBoundingClientRect(),
					ratio = (window.devicePixelRatio)?window.devicePixelRatio : 1,
					extent = map.getBounds();

				return configService.getConfig("clientSessionId").then(function(id) {			
					return $http.post(featuresUnderPointUrl, {
							clientSessionId : id,
							x:point.x, 
							y:point.y, 
							width:bounds.width / ratio, 
							height:bounds.height / ratio,
							extent : {
								left : extent.left,
								right : extent.right,
								top: extent.top,
								bottom: extent.bottom
					}}).then(function(response) {
						return response.data;
					});
				});
			});
		},
		
		overFeatures : function(features) {
			var item;
			if(!features) {
				return;
			}
			if(angular.isArray(features)) {
				item = features[0];
			} else {
				item = features;
			}
			if(item) {
				item.bringToFront().setStyle({color:"red"});
			}
		},
		
		outFeatures : function(features) {
			if(!features) {
				return;
			}
			features.forEach(function(feature) {
				feature.setStyle({color : '#03f'});
			}); 			
		},
		
		createLayer : function() {
			return mapService.getMap().then(function(map) {
				layer = L.layerGroup();
				map.addLayer(layer);
				return layer;
			});	
		},
		
		removeLayer : function() {		
			return mapService.getMap().then(function(map) {
				if(layer) {
					map.removeLayer(layer);
				}
                /* jshint -W093 */
				return layer = null;
			});	
		},
		
		createFeature : function(data) {
			return esriGeometryMapping[data.geometryType].createFeatures(data.geometry);
		},
		
		showFeature : function(data) {
			var features = this.createFeature(data);
			features.forEach(function(feature) {
				layer.addLayer(feature);				
			});
			return features;
		},
		
		hideFeature : function(features) {
			if(features) {
				features.forEach(function(feature) {
					layer.removeLayer(feature);					
				});
			}
		}
	};
}])

.filter("dashNull", [function() {
	return function(value) {
		if(!value || "Null" == value) {
			return "-";
		}
		return value;
	};
}])

.filter("featureGroups", [function() {
	return function(items) {
		var groups = [],
			set = {};
		if(!items) {
			return groups;
		}
		items.forEach(function(item) {
			var layerName = item.layerName;
			if(!set[layerName]) {
				set[layerName] = true;
				groups.push(layerName);
			}
		});
		return groups;
	};
}])

.filter("filterGroupsByLayername", [function() {
	return function(items, layerName) {
		var group = [];
		if(!items) {
			return group;
		}
		items.forEach(function(item) {
			if(layerName == item.layerName) {
				group.push(item);
			}
		});
		return group;
	};
}])


.controller("OverFeatureCtrl", OverFeatureCtrl);

OverFeatureCtrl.$invoke = ['$filter', 'pointService'];
function OverFeatureCtrl($filter, pointService) {
	this.click = function() {
		console.log("Click");
	};

	this.mouseenter = function(feature) {
		console.log("enter");
		pointService.overFeatures(feature.feature);
	};
	
	this.mouseleave = function(feature) {
		console.log("leave");
		pointService.outFeatures(feature.feature);
	};
	
	this.groupEnter = function(results, item) {
		var group = $filter("filterGroupsByLayername")(results, item);
		group.forEach(function(feature){
			pointService.overFeatures(feature.feature);
		});
	};
	
	this.groupLeave = function(results, item) {
		var group = $filter("filterGroupsByLayername")(results, item);
		group.forEach(function(feature){
			pointService.outFeatures(feature.feature);
		});
	};
}

})(angular, L, window);

/*!
 * Copyright 2015 Geoscience Australia (http://www.ga.gov.au/copyright.html)
 */

(function(L) {

'use strict';

L.Control.Features = L.Control.extend({
	_active: false,
	_map: null,
	includes: L.Mixin.Events,
	options: {
	    position: 'topleft',
	    className: 'fa fa-location-arrow fa-rotate-180',
	    modal: false
	},
	
	onAdd: function (map) {
	    this._map = map;
	    this._container = L.DomUtil.create('div', 'leaflet-feature-control leaflet-bar');
	    this._container.title = "Show features under point";
	    var link = L.DomUtil.create('a', this.options.className, this._container);
        link.href = "#";

        L.DomEvent.on(this._container, 'dblclick', L.DomEvent.stop)
	            .on(this._container, 'click', L.DomEvent.stop)
	            .on(this._container, 'click', function(e) {
	        
	        this._active = !this._active;
	       
	        if(this._active) {
	        	map.fireEvent("featuresactivate", e);
	        	L.DomUtil.addClass(this, 'active');
	        } else {
	        	map.fireEvent("featuresdeactivate", e);
	        	L.DomUtil.removeClass(this, 'active');
			}
	    });
        return this._container;
	},
	
	activate: function() {
	    L.DomUtil.addClass(this._container, 'active');
	},
	
	deactivate: function() {
	    L.DomUtil.removeClass(this._container, 'active');
	    this._active = false;
	}
});

L.control.features = function (options) {
	return new L.Control.Features(options);
};
	
})(L);

/*
 * Google layer using Google Maps API
 */

/* global google: true */

L.Google = L.Class.extend({
	includes: L.Mixin.Events,

	options: {
		minZoom: 0,
		maxZoom: 18,
		tileSize: 256,
		subdomains: 'abc',
		errorTileUrl: '',
		attribution: '',
		opacity: 1,
		continuousWorld: false,
		noWrap: false,
		mapOptions: {
			backgroundColor: '#dddddd'
		}
	},

	// Possible types: SATELLITE, ROADMAP, HYBRID, TERRAIN
	initialize: function(type, options) {
		L.Util.setOptions(this, options);

		this._ready = google.maps.Map !== undefined;
		if (!this._ready) L.Google.asyncWait.push(this);

		this._type = type || 'SATELLITE';
	},

	onAdd: function(map, insertAtTheBottom) {
		this._map = map;
		this._insertAtTheBottom = insertAtTheBottom;

		// create a container div for tiles
		this._initContainer();
		this._initMapObject();

		// set up events
		map.on('viewreset', this._resetCallback, this);

		this._limitedUpdate = L.Util.limitExecByInterval(this._update, 150, this);
		map.on('move', this._update, this);

		map.on('zoomanim', this._handleZoomAnim, this);

		//20px instead of 1em to avoid a slight overlap with google's attribution
		map._controlCorners.bottomright.style.marginBottom = '20px';

		this._reset();
		this._update();
	},

	onRemove: function(map) {
		map._container.removeChild(this._container);

		map.off('viewreset', this._resetCallback, this);

		map.off('move', this._update, this);

		map.off('zoomanim', this._handleZoomAnim, this);

		map._controlCorners.bottomright.style.marginBottom = '0em';
	},

	getAttribution: function() {
		return this.options.attribution;
	},

	setOpacity: function(opacity) {
		this.options.opacity = opacity;
		if (opacity < 1) {
			L.DomUtil.setOpacity(this._container, opacity);
		}
	},

	setElementSize: function(e, size) {
		e.style.width = size.x + 'px';
		e.style.height = size.y + 'px';
	},

	_initContainer: function() {
		var tilePane = this._map._container,
			first = tilePane.firstChild;

		if (!this._container) {
			this._container = L.DomUtil.create('div', 'leaflet-google-layer leaflet-top leaflet-left');
			this._container.id = '_GMapContainer_' + L.Util.stamp(this);
			this._container.style.zIndex = 'auto';
		}

		tilePane.insertBefore(this._container, first);

		this.setOpacity(this.options.opacity);
		this.setElementSize(this._container, this._map.getSize());
	},

	_initMapObject: function() {
		if (!this._ready) return;
		this._google_center = new google.maps.LatLng(0, 0);
		var map = new google.maps.Map(this._container, {
			center: this._google_center,
			zoom: 0,
			tilt: 0,
			mapTypeId: google.maps.MapTypeId[this._type],
			disableDefaultUI: true,
			keyboardShortcuts: false,
			draggable: false,
			disableDoubleClickZoom: true,
			scrollwheel: false,
			streetViewControl: false,
			styles: this.options.mapOptions.styles,
			backgroundColor: this.options.mapOptions.backgroundColor
		});

		var _this = this;
		this._reposition = google.maps.event.addListenerOnce(map, 'center_changed',
			function() { _this.onReposition(); });
		this._google = map;

		google.maps.event.addListenerOnce(map, 'idle',
			function() { _this._checkZoomLevels(); });
		//Reporting that map-object was initialized.
		this.fire('MapObjectInitialized', { mapObject: map });
	},

	_checkZoomLevels: function() {
		//setting the zoom level on the Google map may result in a different zoom level than the one requested
		//(it won't go beyond the level for which they have data).
		// verify and make sure the zoom levels on both Leaflet and Google maps are consistent
		if (this._google.getZoom() !== this._map.getZoom()) {
			//zoom levels are out of sync. Set the leaflet zoom level to match the google one
			this._map.setZoom( this._google.getZoom() );
		}
	},

	_resetCallback: function(e) {
		this._reset(e.hard);
	},

	_reset: function(clearOldContainer) {
		this._initContainer();
	},

	_update: function(e) {
		if (!this._google) return;
		this._resize();

		var center = this._map.getCenter();
		var _center = new google.maps.LatLng(center.lat, center.lng);

		this._google.setCenter(_center);
		this._google.setZoom(Math.round(this._map.getZoom()));

		this._checkZoomLevels();
	},

	_resize: function() {
		var size = this._map.getSize();
		if (this._container.style.width === size.x &&
				this._container.style.height === size.y)
			return;
		this.setElementSize(this._container, size);
		this.onReposition();
	},


	_handleZoomAnim: function (e) {
		var center = e.center;
		var _center = new google.maps.LatLng(center.lat, center.lng);

		this._google.setCenter(_center);
		this._google.setZoom(Math.round(e.zoom));
	},


	onReposition: function() {
		if (!this._google) return;
		google.maps.event.trigger(this._google, 'resize');
	}
});

L.Google.asyncWait = [];
L.Google.asyncInitialize = function() {
	var i;
	for (i = 0; i < L.Google.asyncWait.length; i++) {
		var o = L.Google.asyncWait[i];
		o._ready = true;
		if (o._container) {
			o._initMapObject();
			o._update();
		}
	}
	L.Google.asyncWait = [];
};

/*!
 * Copyright 2015 Geoscience Australia (http://www.ga.gov.au/copyright.html)
 */

(function(L) {

'use strict';

L.Control.Legend = L.Control.extend({
	_active: false,
	_map: null,
	includes: L.Mixin.Events,
	options: {
	    position: 'topleft',
		overlayClass: 'leaflet-legend',
	    className: 'fa fa-list',
	    modal: false,
		url: 'resources/img/NationalLegend.png'
	},
	
	onAdd: function (map) {
		var them = this;
	    this._map = map;
	    this._container = L.DomUtil.create('div', 'leaflet-legend-control leaflet-bar');
	    this._container.title = "Show legend";
	    var link = L.DomUtil.create('a', this.options.className, this._container);
        link.href = "#";

        L.DomEvent
	            .on(this._container, 'dblclick', L.DomEvent.stop)
	            .on(this._container, 'click', L.DomEvent.stop)
	            .on(this._container, 'click', function(){
	        this._active = !this._active;
	       
	        if(this._active) {
	        	this._legend = L.control({position: 'topleft'});

	        	this._legend.onAdd = function (map) {
	        		var div = L.DomUtil.create('div', them.options.overlayClass),
						html = '<img src="' + them.options.url + '"></img>';

	        		div.innerHTML = html;
	        		return div;
	        	};
	        	map.addControl(this._legend);
	        } else {
	        	map.removeControl(this._legend);
			}
	    });
        return this._container;
	},
	
	activate: function() {
	    L.DomUtil.addClass(this._container, 'active');
	},
	
	deactivate: function() {
	    L.DomUtil.removeClass(this._container, 'active');
	    this._active = false;
	}
});

L.control.legend = function (options) {
	return new L.Control.Legend(options);
};
	
})(L);

L.Control.MousePosition = L.Control.extend({
  options: {
    position: 'bottomleft',
    separator: ' : ',
    emptyString: 'Unavailable',
    lngFirst: false,
    numDigits: 5,
    lngFormatter: undefined,
    latFormatter: undefined,
    prefix: ""
  },

  onAdd: function (map) {
    this._container = L.DomUtil.create('div', 'leaflet-control-mouseposition');
    L.DomEvent.disableClickPropagation(this._container);
    map.on('mousemove', this._onMouseMove, this);
    this._container.innerHTML=this.options.emptyString;
    return this._container;
  },

  onRemove: function (map) {
    map.off('mousemove', this._onMouseMove);
  },

  _onMouseMove: function (e) {
    var lng = this.options.lngFormatter ? this.options.lngFormatter(e.latlng.lng) : L.Util.formatNum(e.latlng.lng, this.options.numDigits);
    var lat = this.options.latFormatter ? this.options.latFormatter(e.latlng.lat) : L.Util.formatNum(e.latlng.lat, this.options.numDigits);
    var value = this.options.lngFirst ? lng + this.options.separator + lat : lat + this.options.separator + lng;
    var prefixAndValue = this.options.prefix + ' ' + value;
    this._container.innerHTML = prefixAndValue;
  }

});

L.Map.mergeOptions({
    positionControl: false
});

L.Map.addInitHook(function () {
    if (this.options.positionControl) {
        this.positionControl = new L.Control.MousePosition();
        this.addControl(this.positionControl);
    }
});

L.control.mousePosition = function (options) {
    return new L.Control.MousePosition(options);
};
L.Control.ZoomBox = L.Control.extend({
    _active: false,
    _map: null,
    includes: L.Mixin.Events,
    options: {
        position: 'topleft',
        className: 'fa fa-search-plus',
        modal: false
    },
    onAdd: function (map) {
        this._map = map;
        this._container = L.DomUtil.create('div', 'leaflet-zoom-box-control leaflet-bar');
        this._container.title = "Zoom to specific area";
        var link = L.DomUtil.create('a', this.options.className, this._container);
        link.href = "#";

        // Bind to the map's boxZoom handler
        var _origMouseDown = map.boxZoom._onMouseDown;
        map.boxZoom._onMouseDown = function(e){
            _origMouseDown.call(map.boxZoom, {
                clientX: e.clientX,
                clientY: e.clientY,
                which: 1,
                shiftKey: true
            });
        };

        map.on('zoomend', function(){
            if (map.getZoom() == map.getMaxZoom()){
                L.DomUtil.addClass(link, 'leaflet-disabled');
            }
            else {
                L.DomUtil.removeClass(link, 'leaflet-disabled');
            }
        }, this);
        if (!this.options.modal) {
            map.on('boxzoomend', this.deactivate, this);
        }

        L.DomEvent
            .on(this._container, 'dblclick', L.DomEvent.stop)
            .on(this._container, 'click', L.DomEvent.stop)
            .on(this._container, 'click', function(){
                this._active = !this._active;
                if (this._active && map.getZoom() != map.getMaxZoom()){
                    this.activate();
                }
                else {
                    this.deactivate();
                }
            }, this);
        return this._container;
    },
    activate: function() {
        L.DomUtil.addClass(this._container, 'active');
        this._map.dragging.disable();
        this._map.boxZoom.addHooks();
        L.DomUtil.addClass(this._map.getContainer(), 'leaflet-zoom-box-crosshair');
    },
    deactivate: function() {
        L.DomUtil.removeClass(this._container, 'active');
        this._map.dragging.enable();
        this._map.boxZoom.removeHooks();
        L.DomUtil.removeClass(this._map.getContainer(), 'leaflet-zoom-box-crosshair');
        this._active = false;
        this._map.boxZoom._moved = false; //to get past issue w/ Leaflet locking clicks when moved is true (https://github.com/Leaflet/Leaflet/issues/3026).
    }
});

L.control.zoomBox = function (options) {
  return new L.Control.ZoomBox(options);
};
L.Control.Zoommin = L.Control.extend({
    _active: false,
    _map: null,
    includes: L.Mixin.Events,
    options: {
        position: 'topleft',
        className: 'fa fa-home',
        modal: false
    },
    onAdd: function (map) {
        this._map = map;
        this._container = L.DomUtil.create('div', 'leaflet-zoom-box-control leaflet-bar');
        this._container.title = "Zoom to max extent";
        var link = L.DomUtil.create('a', this.options.className, this._container);
        link.href = "#";

        L.DomEvent
            .on(this._container, 'dblclick', L.DomEvent.stop)
            .on(this._container, 'click', L.DomEvent.stop)
            .on(this._container, 'click', function(){
                this._active = !this._active;
             
				map.setView(this.options.center, this.options.zoom);				
            }, this);
        return this._container;
    },
    activate: function() {
        L.DomUtil.addClass(this._container, 'active');
    },
    deactivate: function() {
        L.DomUtil.removeClass(this._container, 'active');
        this._active = false;
    }
});

L.control.zoommin = function (options) {
  return new L.Control.Zoommin(options);
};
L.Control.Zoomout = L.Control.extend({
    _active: false,
    _map: null,
    includes: L.Mixin.Events,
    options: {
        position: 'topleft',
        className: 'fa fa-search-minus',
        modal: false
    },
    onAdd: function (map) {
        this._map = map;
        this._container = L.DomUtil.create('div', 'leaflet-zoom-box-control leaflet-bar');
        this._container.title = "Zoom out";
        var link = L.DomUtil.create('a', this.options.className, this._container);
        link.href = "#";

        map.on('zoomend', function(){
            if (map.getZoom() == map.getMaxZoom()){
                L.DomUtil.addClass(link, 'leaflet-disabled');
            }
            else {
                L.DomUtil.removeClass(link, 'leaflet-disabled');
            }
        }, this);
        map.on('boxzoomend', this.deactivate, this);

        L.DomEvent
            .on(this._container, 'dblclick', L.DomEvent.stop)
            .on(this._container, 'click', L.DomEvent.stop)
            .on(this._container, 'click', function(){
                this._active = !this._active;

				var newZoom, zoom = map.getZoom();
				if(zoom <= map.getMinZoom()) {
					return;
				} 				
				if(zoom < 10) {
					newZoom = zoom - 1;
				} else if(zoom < 13) {
					newZoom = zoom - 2;
				} else {
					newZoom = zoom - 3;
				}
				map.setZoom(newZoom);				
            }, this);
        return this._container;
    },
    activate: function() {
        L.DomUtil.addClass(this._container, 'active');
    },
    deactivate: function() {
        L.DomUtil.removeClass(this._container, 'active');
        this._active = false;
    }
});

L.control.zoomout = function (options) {
  return new L.Control.Zoomout(options);
};
(function(L) {
	L.Polyline.prototype.getLength = function () {
        var total = 0,
        	coordinate = null;
        this._latlngs.forEach(function(latLng, index, latLngs) {
        	coordinate = latLng;
        	if(index) {
        		total += coordinate.distanceTo(latLngs[index - 1]);
        	}	
        });
        return total;
    };
})(L);
(function(angular, L, global) {

'use strict';

angular.module("geo.map", [])

.directive("geoMap", ["mapService", "waiting", function(mapService, waiting) {
	var waiters;
	
	return {
		restrict: "AE",
		scope : {
			configuration : "="
		},
		controller : ["$q", "$scope", function($q, $scope) {
			this.getMap = function() {
				if($scope.map) {
					$q.when($scope.map);
				} else {
					if(!waiters) {
						waiters = waiting.wait();
					}
					return waiters.waiter().promise;
				}
			};
		}],
		
		link : function(scope, element) {
			scope.$watch("configuration" , function(config) {
				if(config) {
					config.element = element[0];
					scope.map = mapService.addMap(config);
					if(waiters) {
						waiters.resolve(scope.map);
					}
				}
			});
			
		}
	};
}])

.factory("mapService", ['$q', 'waiting', function($q, waiting) {
	var START_NAME = "MAP_",
		nameIndex = 0,
		lastMap,
		pseudoBaseLayers = [],
		waiters,
		layerControl,
		groups = {},
		service = {
			maps: {}
		};
	
	service.getMap = function(name) {
		if(!name) {
			name = lastMap;
		}
		
		if(lastMap) {
			return $q.when(service.maps[name]);
		}

		if(!waiters) {
			waiters = waiting.wait();
		}
		return waiters.waiter().promise;	
	};

	service.addToGroup = function(layer, groupName) {
		this.getMap().then(function(map) { 
			var group = groups[groupName];
			if(group) {
				addLayer(layer, group, map);
			}
		});
	};

	service.getGroup = function(groupName) {
		return groups[groupName];
	};
	
	service.clearGroup = function(groupName) {
		var layerGroup = groups[groupName],
			layers = layerGroup.getLayers();
		
		layers.forEach(function(layer) {
			layerGroup.removeLayer(layer);
		});	
	};
	
	service.removeFromGroup = function(data, groupName) {
		var group = groups[groupName];
		if(group) {
			group.removeLayer(data.layer);
			data.layer = null;
		}
	};
	
	service.addMap = function(config) {
		var map,
			zoomControl,
			legendControlOptions = {};
		
		if(!config.name) {
			config.name = START_NAME + (nameIndex++);
		}
		
		lastMap = config.name;
		
		map = service.maps[config.name] = new L.Map(config.element, {center: config.options.center, zoom: config.options.zoom});

		if(config.layers) {
			config.layers.forEach(function(layer) {
				var group;
				if(layer.type == "LayerGroup") {
					if(layer.layers) {
						groups[layer.name] = group = L.layerGroup([]);
						layer.layers.forEach(function(child) {
							addLayer(child, map, group);
						});
						map.addLayer(group);
					}					
				} else {
					addLayer(layer, map, map);
					if(layer.pseudoBaseLayer && layer.legendUrl) {
						legendControlOptions.url = layer.legendUrl;
					}
				}
			});
		}

		L.control.scale({imperial:false}).addTo(map);
		L.control.mousePosition({
				position:"bottomright", 
				emptyString:"",
				seperator : " ",
				latFormatter : function(lat) {
					return "Lat " + L.Util.formatNum(lat, 5) + "°";
				},
				lngFormatter : function(lng) {
					return "Lng " + L.Util.formatNum(lng, 5) + "°";
				}
		}).addTo(map);
		zoomControl = L.control.zoomBox({
		    //modal: true,  // If false (default), it deactivates after each use.  
		                  // If true, zoomBox control stays active until you click on the control to deactivate.
		    // position: "topleft",                  
		    // className: "customClass"  // Class to use to provide icon instead of Font Awesome
		});
		map.addControl(zoomControl);
		
		//L.control.zoomout().addTo(map);
		
		
		global.map = map;
		if(waiters) {
			waiters.resolve(map);
		}
		// This is the pseudo base layers
		map.addControl(L.control.legend(legendControlOptions));
		
		return map;
		
	};
	
	return service;
	
	function addLayer(layer, target, map) {
		var leafLayer = expandLayer(layer);
		leafLayer.pseudoBaseLayer = layer.pseudoBaseLayer;
		
		if(layer.addLayerControl) {
			if(!layerControl) {
				layerControl = {};
			} 
			layerControl[layer.name] = leafLayer;
		}
		if(layer.defaultLayer || layer.pseudoBaseLayer) {
			target.addLayer(leafLayer);
		}
		
		if(layerControl) {
			map.addControl(new L.Control.Layers( layerControl, {}));
		}
		layer.layer = leafLayer;
	}
	
	function expandLayer(data) {
		var Clazz = [];
		if(angular.isArray(data.type)) {
			Clazz = L;
			data.type.forEach(function(type) {
				Clazz = Clazz[type];
			});
		} else {
			Clazz = L[data.type];
		}
		if(data.parameters && data.parameters.length > 0) {
			return new Clazz(data.parameters[0], data.parameters[1], data.parameters[2], data.parameters[3], data.parameters[4]);
		} 
		return new Clazz();
	}
	
}]);

})(angular, L, window);
angular.module("explorer.map.templates", []).run(["$templateCache", function($templateCache) {$templateCache.put("map/baselayer/baseLayerSlider.html","<span style=\"width:30em;\">\r\n	<span id=\"baselayerCtrl\">\r\n 		<input id=\"baselayerSlider\" class=\"temperature\" baselayer-slider title=\"Slide to emphasize either a satellite or topography view.\" />\r\n	</span>\r\n</span>");
$templateCache.put("map/elevation/elevation.html","<div class=\"container-full elevationContainer\" ng-show=\"geometry\" style=\"background-color:white; opacity:0.9;padding:2px\">\r\n	<div class=\"row\">\r\n		<div class=\"col-md-4\">\r\n			<span class=\"graph-brand\">Path Elevation</span>\r\n		</div>	\r\n		<div class=\"col-md-8\">\r\n			<div class=\"btn-toolbar pull-right\" role=\"toolbar\" style=\"margin-right: 3px;\">\r\n				<div class=\"btn-group\" ng-show=\"intersectsWaterTable\">	\r\n					<button type=\"button\" class=\"btn btn-default\" ng-click=\"toggleWaterTable()\" \r\n							title=\"Show groundwater over elevation\">{{paths.length == 1?\'Show\':\'Hide\'}} Water Table</button>\r\n				</div>	\r\n				<div class=\"btn-group\">	\r\n					<button type=\"button\" class=\"btn btn-default\" title=\"Find out information about the data behind these graphs\" \r\n							ng-click=\"showInfo = !showInfo\">\r\n						<i class=\"fa fa-info-circle\" role=\"presentation\" style=\"font-size:16px; color:black\"></i>\r\n					</button>\r\n					<exp-info title=\"Graph Information\" style=\"width:400px;position:absolute;bottom:-80px;right:60px\" show-close=\"true\" is-open=\"showInfo\"><div mars-info-elevation></div></exp-info>				\r\n					<button type=\"button\" class=\"btn btn-default\" title=\"Close graphs\" ng-click=\"close()\">\r\n						<i class=\"fa fa-times-circle\" role=\"presentation\" style=\"font-size:16px; color:black\"></i>\r\n					</button>				\r\n				</div>\r\n			</div>\r\n		</div>	\r\n	</div>\r\n	<div explorer-graph data=\"paths\" config=\"config\" click=\"graphClick(event)\" move=\"graphMove(event)\" leave=\"graphLeave(event)\" enter=\"graphEnter(event)\" show-zero-line=\"true\"></div>\r\n	<div exp-point-features features=\"featuresUnderPoint\" class=\"featuresUnderPoint\"></div>\r\n	<div exp-point point=\"point\" class=\"featuresInfo\" style=\"display:none\"></div>\r\n	<div class=\"elevationHoverPanel\" mars-point-info ng-show=\"position\"\r\n		ng-attr-style=\"top:{{position.pageY - 70}}px;left:{{position.pageX * 0.94 - 10}}px;\">\r\n		<div class=\"ng-binding\"><strong>Elev.:</strong>{{position.point.z|number:0}}m</div>\r\n		<div class=\"ng-binding\"><strong>Dist.:</strong>{{length * position.percentX * 0.01|length : true }}</div>\r\n	</div>\r\n	</div>\r\n</div>");
$templateCache.put("map/elevation/elevationInfo.html","<div>\r\nThe elevation graph is calculated from the 3\" DEM data. \r\nThe data is held in a grid with a cell size of approx. 90 m. \r\nThe data has a &plusmn;5 m error. Full metadata about the data and how to acquire the data can be found \r\n<a target=\"_blank\" href=\"http://www.ga.gov.au/metadata-gateway/metadata/record/gcat_aac46307-fce9-449d-e044-00144fdd4fa6\">here</a>\r\n<br/>\r\nIf the path of the graph intersects areas that we have prepared water table data there will be the ability to plot this data. \r\nThe accuracy is not as high as the elevation data and has &plusmn;50 m error. Smoothing with this error can make the \r\nwater table appear above the elevation of the surface on occasions. \r\nData availability will be indicated by the button labelled \"Show Water Table\". \r\n<a href=\"javascript:;\" ng-click=\"toggleWaterTableShowing()\">Click to {{state.isWaterTableShowing?\'hide\':\'view\'}} the water table extent.</a>\r\n</div>\r\n");
$templateCache.put("map/featuresummary/featuresSummary.html","<div class=\"marsfeatures\" ng-show=\"features\" ng-style=\"featurePanelPosition()\" ng-class=\"features.popupClass\">\r\n	<div id=\"menu_mn_active_tt_active\" data-role=\"popup\" role=\"tooltip\">\r\n		<div class=\"pathContent\">\r\n			<div ng-repeat=\"(key, feature) in features.data\">\r\n				{{mappings[key].title}}  ({{feature}})\r\n			</div>\r\n			<div ng-hide=\"features.count\">No nearby features</div>\r\n		</div>\r\n	</div>\r\n</div>\r\n");
$templateCache.put("map/layerinspector/layerInspector.html","<div class=\"interactionPanel\">\r\n	<div class=\"exp-block\" ng-show=\"active\" style=\"height:100%\">\r\n		<div class=\"exp-header\">\r\n			<div class=\"interactionPanelHeader\" ng-hide=\"hidename\">\r\n				<a href=\"javascript:;\" ng-click=\"click()\" ng-show=\"showClose\" title=\"Name is {{name || active.name}}\">{{name || active.name}}</a>\r\n				<span ng-hide=\"showClose\">{{name || active.name}}</span>\r\n			</div>\r\n			<div style=\"float:right\">\r\n				<a class=\"featureLink\" href=\"javascript:;\" title=\"Show on map\" \r\n						ng-click=\"toggleShow(active)\"><i class=\"fa\" ng-class=\"{\'fa-eye-slash\':(!active.displayed), \'fa-eye\':active.displayed}\"></i></a>\r\n				<a class=\"featureLink\" href=\"javascript:;\" title=\"Collapse extra information\" ng-show=\"showClose\"\r\n						ng-click=\"click()\"><i class=\"fa fa-caret-square-o-up\"></i></a>\r\n			</div>\r\n		</div>\r\n		<div>\r\n			<div class=\"thumbNailContainer\" ng-show=\"active.thumbUrl\">\r\n				<img width=\"100\" ng-src=\"{{active.thumbUrl}}\" class=\"img-thumbnail\" alt=\"{{active.description}}\"></img>\r\n			</div>\r\n			<strong>Opacity</strong><br/>\r\n			<span explorer-layer-slider layer=\"active.layer\" title=\"Change the opacity of the selected layer when shown on the map\" class=\"opacitySlider\"></span>\r\n			<p/>\r\n			{{active.description}}\r\n		</div> \r\n	</div>\r\n</div>");
$templateCache.put("map/point/point.html","<exp-modal class=\"pointInspector ng-cloak\" icon-class=\"fa-map-marker\" is-open=\"point\" on-close=\"clearPoint()\" title=\"Features within approx. 2km\">	\r\n	<div class=\"pointContent\" ng-controller=\"OverFeatureCtrl as over\">\r\n		<div style=\"padding-bottom:7px;\">Elev. {{point.z | length : true}}, Lat. {{point.y | number : 3}}&deg;, Long. {{point.x | number:3}}&deg;</div>\r\n		<div ng-show=\"featuresInfo.results.length > 0\">\r\n			<div>\r\n				<div style=\"float:left; padding-bottom:10px\">{{allHidden() && \"Show\" || \"Hide\"}} all features</div>\r\n				<div style=\"float: right\">				\r\n					<a class=\"featureLink\" href=\"javascript:;\" title=\"Show all features on map\"\r\n						ng-click=\"toggleAll()\"><i class=\"fa\" ng-class=\"{\'fa-eye-slash\':allHidden(), \'fa-eye\':!allHidden()}\"></i></a>\r\n				</div>\r\n			</div>\r\n			<div style=\"clear:both;\"></div>\r\n		</div>\r\n		<div ng-hide=\"featuresInfo.results.length > 0\">No nearby features.</div>\r\n	\r\n		<div ng-repeat=\"item in featuresInfo.results | featureGroups\" ng-class=\"{\'underlined\':!$last}\">\r\n			<div ng-show=\"greaterThanOneItem()\"  ng-mouseover=\"over.groupEnter(featuresInfo.results, item)\" ng-mouseout=\"over.groupLeave(featuresInfo.results, item)\">\r\n				<div style=\"float:left\">\r\n					<button type=\"button\" class=\"undecorated\" ng-click=\"expanded = !expanded\"><i class=\"fa fa-caret-right pad-right\" ng-class=\"{\'fa-caret-down\':expanded,\'fa-caret-right\':(!expanded)}\"></i></button></button><strong>{{metadata[item].heading}}</strong>\r\n				</div>\r\n				<div style=\"float: right\">	\r\n					<a class=\"featureLink\" href=\"javascript:;\" title=\"Show on map\"   \r\n						ng-click=\"groupShow(item)\"><i class=\"fa\" ng-class=\"{\'fa-eye-slash\':(!oneShowing()), \'fa-eye\':oneShowing()}\"></i></a>\r\n				</div>\r\n				<div style=\"clear:both;\"></div>\r\n			</div>\r\n			<div ng-repeat=\"feature in featuresInfo.results | filterGroupsByLayername : item\" ng-show=\"expanded || !greaterThanOneItem()\">\r\n				<div ng-mouseover=\"over.mouseenter(feature)\" ng-mouseout=\"over.mouseleave(feature)\" ng-click=\"over.click()\">\r\n					<div style=\"float: left;\" ng-class=\"{\'pad-left-big\':greaterThanOneItem()}\">\r\n						<button type=\"button\" ng-click=\"feature.expanded = !feature.expanded\" class=\"undecorated\"><i class=\"fa fa-caret-right pad-right\" ng-class=\"{\'fa-caret-down\':feature.expanded,\'fa-caret-right\':(!feature.expanded)}\"></i></button>\r\n						<a href=\"javascript:;\" class=\"featureLink\" title=\"{{metadata[feature.layerName].description}}\"\r\n							ng-click=\"makeFeatureActive()\" ng-class=\"{active:(feature.active)}\">{{createTitle()}}</a>\r\n					</div>\r\n					<div style=\"float: right\">	\r\n						<a class=\"featureLink\" href=\"javascript:;\" title=\"Graph elevation changes for feature\'s path.\"\r\n							ng-click=\"elevationPath(metadata[feature.layerName].label + \' elevation plot\')\"><i class=\"fa fa-align-left fa-rotate-270\" ng-show=\"feature.geometryType == \'esriGeometryPolyline\'\"></i></a>					\r\n						<a class=\"featureLink\" href=\"javascript:;\" title=\"Show on map\"\r\n							ng-click=\"toggleShow(feature)\"><i class=\"fa\" ng-class=\"{\'fa-eye-slash\':(!feature.displayed), \'fa-eye\':feature.displayed}\"></i> </a>\r\n					</div>\r\n				</div>\r\n				<div style=\"clear:both;\" ng-init=\"featureMeta = metadata[feature.layerName]\">\r\n					<div ng-repeat=\"attribute in featureMeta.attributes\" ng-show=\"feature.expanded\">\r\n						<div style=\"width:7em;float:left;font-weight:bold;padding-left:9px\">{{attribute.label}}</div>\r\n						<div style=\"min-width:12em;width:12em;margin-left:7.5em;\" class=\"ellipsis\" title=\"{{feature.attributes[attribute.key]}}\">{{feature.attributes[attribute.key] | dashNull}}</div>\r\n					</div>\r\n					<div style=\"border-bottom:1px solid lightgray\" ng-show=\"feature.expanded && !last\"></div>\r\n				</div>\r\n			</div>	\r\n		</div>\r\n	</div>\r\n</exp-modal>");}]);