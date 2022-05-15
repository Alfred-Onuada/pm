// global variables
const _accessToken = "pk.eyJ1IjoiYWxmcmVkb251YWRhIiwiYSI6ImNsMzNwYXAyOTA5bjIzY3BvbWFlM2t0dXAifQ.DFUlTV72_GSX7ClaonIIRw";
const _apiUrl = "http://145.239.253.100:4500/api/";

const _defaults = {
  center: [-1.8594463589181272, 53.318170599741286],
  zoom: 5.5,
  radiusToZoom: {
    5: 10.5,
    10: 9.5,
    15: 9,
    20: 8.5,
    25: 8.2,
    30: 8,
    35: 7.5,
    40: 7,
  },
  layers: {
    brma: {
      hex: "#58b4f5",
      mz: 7,
      label: { mz: 7 },
      parent: false,
      source: "brma-src",
      sourceLayer: "brma",
    },
    county: {
      hex: "#FF0000",
      mz: 5.5,
      label: { mz: 5.5 },
      parent: false,
      source: "counties-src",
      sourceLayer: "county",
    },
    postalarea: {
      hex: "#05d71c",
      mz: 9,
      label: { mz: 9 },
      parent: false,
      source: "postalarea-src",
      sourceLayer: "postalarea",
    },
    postaldistrict: {
      hex: "#d800e3",
      mz: 9,
      label: { mz: 9 },
      parent: false,
      source: "postaldistrict-src",
      sourceLayer: "postaldistrict",
    },
    postalsector: {
      hex: "#007013",
      mz: 9,
      label: { mz: 9 },
      parent: false,
      source: "postalsector-src",
      sourceLayer: "postalsector",
    },
    borough: {
      hex: "#dbaa00",
      mz: 9,
      label: { mz: 9 },
      parent: false,
      source: "borough-src",
      sourceLayer: "borough",
    },
  },
  hovered: null,
  tooltip: new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false,
    className: "ps-map-tooltip",
    offset: new mapboxgl.Point(0, -15),
  })
}

// map object
let _map = null;

// search logic variables
let exactSearchText = "";
let searchResultCenter = [];

// manages state in the map quite useful
let _state = null;
let _currentlyProcessing = null;

function init() {

  // create map object
  mapboxgl.accessToken = _accessToken;
  _map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/streets-v11",
    center: _defaults.center,
    zoom: _defaults.zoom,
  });

  _map.addControl(
    new mapboxgl.NavigationControl(),
    "bottom-right"
  )

  let searchBar = new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    mapboxgl: mapboxgl,
    countries: 'gb',
    filter: function (e) {
      // add filters to keep results as relevant as possible
      return e.place_type[0] != 'poi';
    }
  });

  _map.addControl(
    searchBar,
    "top-left"
  );

  // add neccesary layers
  _map.on("load", function () {
    registerLayers(_map);

    // activate various functions
    activateSearch(searchBar, _map);

    // add custom controls
    activateCustomControls(_map);

    // function exists in a different file the id's it relies on are not available in the DOM when the page is loaded
    // relies on the activateCustomControls function to be called first
    enableMainControls();

    // set a default parent layer
    document.getElementById('county-control').click();
    document.getElementById('main-control').click();
  });

  // add and remove preloader, idle is better than render because render fires a lot of times
  _map.on("idle", () => {
    document.getElementById("loading").classList.add('hide');
  })

  _map.on('data', () => {
    document.getElementById("loading").classList.remove('hide');
  })

}

function layerMouseout(params, map) {
  return function (e) {
    if (params.layerConfigObj == true) {
      map.getCanvas().style.cursor = "initial";
      _defaults.tooltip.remove();

      for (var i in _defaults.layers) {
        map.setFeatureState(
          {
            source: _defaults.layers[i].source,
            sourceLayer: _defaults.layers[i].sourceLayer,
            id: _defaults.hovered,
          },
          {
            hover: false,
          }
        );
      }

      _defaults.hovered = null;
    }
  };
}

function layerMousemove(params, map) {
  return function (e) {
    if (params.layerConfigObj == true) {
      e.originalEvent.preventDefault();

      map.getCanvas().style.cursor = "pointer";

      if (e.features.length > 0) {
        _defaults.tooltip
          .setLngLat(e.lngLat)
          .setHTML(`${e.features[0].properties.NAME}`)
          .addTo(map);

        if (
          _defaults.hovered != null &&
          _defaults.hovered != e.features[0].id
        ) {
          for (var i in _defaults.layers) {
            map.setFeatureState(
              {
                source: _defaults.layers[i].source,
                sourceLayer: _defaults.layers[i].sourceLayer,
                id: _defaults.hovered,
              },
              {
                hover: false,
              }
            );
          }

          _defaults.hovered = e.features[0].id;

          map.setFeatureState(
            {
              source: params.source,
              sourceLayer: params.sourceLayer,
              id: _defaults.hovered,
            },
            {
              hover: true,
            }
          );
        } else {
          _defaults.hovered = e.features[0].id;

          map.setFeatureState(
            {
              source: params.source,
              sourceLayer: params.sourceLayer,
              id: _defaults.hovered,
            },
            {
              hover: true,
            }
          );
        }
      }
    }
  };
}

function setParentLayer(layerName, map) {
  for (var i in _defaults.layers) {
    map.off(
      "mouseout",
      i,
      layerMouseout({
        layerConfigObj: _defaults.layers[i].parent,
        source: _defaults.layers[i].source,
        sourceLayer: _defaults.layers[i].sourceLayer,
      }, map)
    );

    map.off(
      "mousemove",
      i,
      layerMousemove({
        layerConfigObj: _defaults.layers[i].parent,
        source: _defaults.layers[i].source,
        sourceLayer: _defaults.layers[i].sourceLayer,
      }, map)
    );

    if (i.toLowerCase() == layerName.toLowerCase()) {
      _defaults.layers[i].parent = true;
      map.on(
        "mouseout",
        i,
        layerMouseout({
          layerConfigObj: _defaults.layers[i].parent,
          source: _defaults.layers[i].source,
          sourceLayer: _defaults.layers[i].sourceLayer,
        }, map)
      );

      map.on(
        "mousemove",
        i,
        layerMousemove({
          layerConfigObj: _defaults.layers[i].parent,
          source: _defaults.layers[i].source,
          sourceLayer: _defaults.layers[i].sourceLayer,
        }, map)
      );
    } else {
      _defaults.layers[i].parent = false;
    }
  }
}

function registerLayers(map) {
  // add source and layer for circle
  map.addSource("circle-source", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [],
    }
  });

  map.addLayer({
    id: "circle-layer",
    type: "fill",
    source: "circle-source",
    paint: {
      "fill-color": "#06a9f7",
      "fill-opacity": .5,
    },
  });

  function addVectorSources(map) {
    // add source and layers for each layer(vector)
    map.addSource("postalarea-src", {
      type: "vector",
      tiles: [`${_apiUrl}mvt/postal_areas/{z}/{x}/{y}.pbf`],
      maxzoom: 10,
    });

    map.addSource("labels-src", {
      type: "vector",
      tiles: [`${_apiUrl}mvt/labels/{z}/{x}/{y}.pbf`],
      maxzoom: 10,
    });

    map.addSource("postaldistrict-src", {
      type: "vector",
      tiles: [
        `${_apiUrl}mvt/postal_districts/{z}/{x}/{y}.pbf`,
      ],
      maxzoom: 10,
    });

    map.addSource("postalsector-src", {
      type: "vector",
      tiles: [`${_apiUrl}mvt/postal_sectors/{z}/{x}/{y}.pbf`],
      maxzoom: 10,
    });

    map.addSource("counties-src", {
      type: "vector",
      tiles: [`${_apiUrl}mvt/counties/{z}/{x}/{y}.pbf`],
      maxzoom: 10,
    });

    map.addSource("brma-src", {
      type: "vector",
      tiles: [`${_apiUrl}mvt/brma/{z}/{x}/{y}.pbf`],
      maxzoom: 10,
    });

    map.addSource("borough-src", {
      type: "vector",
      tiles: [`${_apiUrl}mvt/boroughs/{z}/{x}/{y}.pbf`],
      maxzoom: 20,
    });
  }

  function addVectorLayers(map) {
    /* Postal Sectors Layer's stroke */
    map.addLayer({
      id: "postalsector-lyr-stroke",
      type: "line",
      source: "postalsector-src",
      "source-layer": "postalsector",
      paint: {
        "line-width": 1.25,
        "line-color": _defaults.layers["postalsector"].hex,
      },
      layout: {
        visibility: "none",
      },
      maxzoom: 22,
      minzoom: _defaults.layers["postalsector"].mz,
    });

    map.addLayer({
      id: "postalsector",
      type: "fill",
      source: "postalsector-src",
      "source-layer": "postalsector",
      paint: {
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          0.3,
          ["boolean", ["feature-state", "hover"], false],
          0.3,
          0,
        ],
        "fill-color": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          _defaults.layers.postalsector.hex,
          ["boolean", ["feature-state", "hover"], true],
          _defaults.layers.postalsector.hex,
          "rgba(0,0,0,0.5)",
        ],
      },
      layout: {
        visibility: "none",
      },
      minzoom: _defaults.layers["postalsector"].mz,
      maxzoom: 20,
    });

    // Postal Districts Layer's stroke
    map.addLayer({
      id: "postaldistrict-lyr-stroke",
      type: "line",
      source: "postaldistrict-src",
      "source-layer": "postaldistrict",
      paint: {
        "line-width": 3,
        "line-color": _defaults.layers["postaldistrict"].hex,
      },
      layout: {
        visibility: "none",
      },
      maxzoom: 20,
      minzoom: _defaults.layers["postaldistrict"].mz,
    });

    map.addLayer({
      id: "postaldistrict",
      type: "fill",
      source: "postaldistrict-src",
      "source-layer": "postaldistrict",
      paint: {
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          0.3,
          ["boolean", ["feature-state", "hover"], false],
          0.3,
          0,
        ],
        "fill-color": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          _defaults.layers.postaldistrict.hex,
          ["boolean", ["feature-state", "hover"], true],
          _defaults.layers.postaldistrict.hex,
          "rgba(0,0,0,0.5)",
        ],
      },
      layout: {
        visibility: "none",
      },
      minzoom: _defaults.layers["postaldistrict"].mz,
      maxzoom: 20,
    });

    // Postal Areas Layer's stroke
    map.addLayer({
      id: "postalarea-lyr-stroke",
      type: "line",
      source: "postalarea-src",
      "source-layer": "postalarea",
      paint: {
        "line-width": 1.75,
        "line-color": _defaults.layers["postalarea"].hex,
      },
      layout: {
        visibility: "none",
      },
      maxzoom: 22,
      minzoom: _defaults.layers["postalarea"].mz,
    });

    map.addLayer({
      id: "postalarea",
      type: "fill",
      source: "postalarea-src",
      "source-layer": "postalarea",
      paint: {
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          0.3,
          ["boolean", ["feature-state", "hover"], false],
          0.3,
          0,
        ],
        "fill-color": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          _defaults.layers.postalarea.hex,
          ["boolean", ["feature-state", "hover"], true],
          _defaults.layers.postalarea.hex,
          "rgba(0,0,0,0.5)",
        ],
      },
      layout: {
        visibility: "none",
      },
      minzoom: _defaults.layers["postalarea"].mz,
      maxzoom: 20,
    });

    /* Borough Layer's stroke */
    map.addLayer({
      id: "borough-lyr-stroke",
      type: "line",
      source: "borough-src",
      "source-layer": "borough",
      paint: {
        "line-width": 2,
        "line-color": _defaults.layers["borough"].hex,
      },
      layout: {
        visibility: "none",
      },
      minzoom: _defaults.layers["borough"].mz,
    });

    map.addLayer({
      id: "borough",
      type: "fill",
      source: "borough-src",
      "source-layer": "borough",
      paint: {
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          0.3,
          ["boolean", ["feature-state", "hover"], false],
          0.3,
          0,
        ],
        "fill-color": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          _defaults.layers.borough.hex,
          ["boolean", ["feature-state", "hover"], true],
          _defaults.layers.borough.hex,
          "rgba(0,0,0,0.5)",
        ],
      },
      layout: {
        visibility: "none",
      },
      minzoom: _defaults.layers["borough"].mz,
      maxzoom: 20,
    });

    /* BRMA Layer's stroke */
    map.addLayer({
      id: "brma-lyr-stroke",
      type: "line",
      source: "brma-src",
      "source-layer": "brma",
      paint: {
        "line-width": 2.5,
        "line-color": _defaults.layers["brma"].hex,
      },
      layout: {
        visibility: "none",
      },
      minzoom: _defaults.layers["brma"].mz,
      maxzoom: 20,
    });

    map.addLayer({
      id: "brma",
      type: "fill",
      source: "brma-src",
      "source-layer": "brma",
      paint: {
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          0.3,
          ["boolean", ["feature-state", "hover"], false],
          0.3,
          0,
        ],
        "fill-color": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          _defaults.layers.brma.hex,
          ["boolean", ["feature-state", "hover"], true],
          _defaults.layers.brma.hex,
          "rgba(0,0,0,0.5)",
        ],
      },
      layout: {
        visibility: "none",
      },
      minzoom: _defaults.layers["brma"].mz,
      maxzoom: 20,
    });

    /* Counties Layer's stroke */
    map.addLayer({
      id: "county-lyr-stroke",
      type: "line",
      source: "counties-src",
      "source-layer": "county",
      paint: {
        "line-width": 3,
        "line-color": _defaults.layers["county"].hex,
      },
      layout: {
        visibility: "visible",
      },
      minzoom: _defaults.layers["county"].mz,
    });

    map.addLayer({
      id: "county",
      type: "fill",
      source: "counties-src",
      "source-layer": "county",
      paint: {
        //"fill-opacity": 0
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          0.3,
          ["boolean", ["feature-state", "hover"], false],
          0.3,
          0,
        ],
        "fill-color": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          _defaults.layers.county.hex,
          ["boolean", ["feature-state", "hover"], true],
          _defaults.layers.county.hex,
          "rgba(0,0,0,0)",
        ],
      },
      layout: {
        visibility: "visible",
      },
      minzoom: _defaults.layers["county"].mz,
      maxzoom: 20,
    });

    //LABELS
    map.addLayer({
      id: "county-lbl",
      type: "symbol",
      source: "labels-src",
      "source-layer": "lbl",
      filter: ["==", ["get", "type"], "county"],
      paint: {
        "text-color": _defaults.layers["county"].hex,
        "text-halo-color": "#000",
        "text-halo-width": 1,
      },
      layout: {
        "icon-allow-overlap": false,
        "text-allow-overlap": false,
        "icon-ignore-placement": false,
        "text-ignore-placement": false,
        visibility: "visible",
        "symbol-placement": "point",
        "text-field": ["get", "NAME"],
        "text-size": 18,
        "text-letter-spacing": 0.05,
      },
      maxzoom: 20,
      minzoom: _defaults.layers["county"].label.mz,
    });

    map.addLayer({
      id: "borough-lbl",
      type: "symbol",
      source: "labels-src",
      "source-layer": "lbl",
      filter: ["==", ["get", "type"], "borough"],
      paint: {
        "text-color": _defaults.layers["borough"].hex,
        "text-halo-color": "#000",
        "text-halo-width": 1,
      },
      layout: {
        "icon-allow-overlap": true,
        "text-allow-overlap": true,
        "icon-ignore-placement": false,
        "text-ignore-placement": false,
        visibility: "visible",
        "symbol-placement": "point",
        "text-field": ["get", "NAME"],
        "text-size": 18,
        "text-letter-spacing": 0.05,
        visibility: "none",
      },
      maxzoom: 22,
      minzoom: _defaults.layers["borough"].mz,
    });

    map.addLayer({
      id: "brma-lbl",
      type: "symbol",
      source: "labels-src",
      "source-layer": "lbl",
      filter: ["==", ["get", "type"], "brma"],
      paint: {
        "text-color": _defaults.layers["brma"].hex,
        "text-halo-color": "#000",
        "text-halo-width": 1,
      },
      layout: {
        "icon-allow-overlap": true,
        "text-allow-overlap": true,
        "icon-ignore-placement": false,
        "text-ignore-placement": false,
        visibility: "visible",
        "symbol-placement": "point",
        "text-field": ["get", "NAME"],
        "text-size": 18,
        "text-letter-spacing": 0.05,
        visibility: "none",
      },
      maxzoom: 22,
      minzoom: _defaults.layers["brma"].mz,
    });

    map.addLayer({
      id: "postalarea-lbl",
      type: "symbol",
      source: "labels-src",
      "source-layer": "lbl",
      filter: ["==", ["get", "type"], "postalarea"],
      paint: {
        "text-color": _defaults.layers["postalarea"].hex,
        "text-halo-color": "#000",
        "text-halo-width": 1,
      },
      layout: {
        "icon-allow-overlap": false,
        "text-allow-overlap": false,
        "icon-ignore-placement": false,
        "text-ignore-placement": false,
        visibility: "visible",
        "symbol-placement": "point",
        "text-field": ["string", ["get", "NAME"]],
        "text-size": 18,
        "text-letter-spacing": 0.05,
        visibility: "none",
      },
      maxzoom: 22,
      minzoom: _defaults.layers["postalarea"].mz,
    });

    map.addLayer({
      id: "postaldistrict-lbl",
      type: "symbol",
      source: "labels-src",
      "source-layer": "lbl",
      filter: ["==", ["get", "type"], "postaldistrict"],
      paint: {
        "text-color": _defaults.layers["postaldistrict"].hex,
        "text-halo-color": "#000",
        "text-halo-width": 1,
      },
      layout: {
        "icon-allow-overlap": false,
        "text-allow-overlap": false,
        "icon-ignore-placement": false,
        "text-ignore-placement": false,
        visibility: "visible",
        "symbol-placement": "point",
        "text-field": [
          "case",
          ["==", ["get", "NAME"], "0.0000000000 3"],
          "E1 3",
          ["get", "NAME"],
        ],
        "text-size": 18,
        "text-letter-spacing": 0.05,
        visibility: "none",
      },
      maxzoom: 22,
      minzoom: _defaults.layers["postaldistrict"].mz,
    });

    map.addLayer({
      id: "postalsector-lbl",
      type: "symbol",
      source: "labels-src",
      "source-layer": "lbl",
      filter: ["==", ["get", "type"], "postalsector"],
      paint: {
        "text-color": _defaults.layers["postalsector"].hex,
        "text-halo-color": "#eee",
        "text-halo-width": 1,
      },
      layout: {
        "icon-allow-overlap": false,
        "text-allow-overlap": false,
        "icon-ignore-placement": false,
        "text-ignore-placement": false,
        visibility: "visible",
        "symbol-placement": "point",
        "text-field": ["to-string", ["get", "NAME"]],
        "text-size": 18,
        "text-letter-spacing": 0.05,
        visibility: "none",
      },
      maxzoom: 22,
      minzoom: _defaults.layers["postalsector"].mz,
    });
  }

  function zoomToClickedLayer(e, features, propertyToCompare, typeName, map) {
    let clickedFeature = features.filter(function (feature) {
      return (
        feature.properties[propertyToCompare] ==
        e.features[0].properties[propertyToCompare]
      );
    });

    let firstFeature = null;

    for (var i = 0; i < clickedFeature.length; i++) {
      switch (true) {
        case clickedFeature[i].geometry.type == "MultiPolygon":
          for (
            var j = 0;
            j < clickedFeature[i].geometry.coordinates.length;
            j++
          ) {
            if (firstFeature == null) {
              firstFeature = turf.polygon(
                clickedFeature[i].geometry.coordinates[j]
              );
            } else {
              firstFeature = turf.union(
                firstFeature,
                turf.polygon(clickedFeature[i].geometry.coordinates[j])
              );
            }
          }
          break;
        case clickedFeature[i].geometry.type == "Polygon":
          if (firstFeature == null) {
            firstFeature = turf.polygon(
              clickedFeature[i].geometry.coordinates
            );
          } else {
            firstFeature = turf.union(
              firstFeature,
              turf.polygon(clickedFeature[i].geometry.coordinates)
            );
          }
          break;
      }
    }

    let latlngbnds = turf.bbox(firstFeature);

    map.fitBounds(
      mapboxgl.LngLatBounds.convert([
        [latlngbnds[0], latlngbnds[1]],
        [latlngbnds[2], latlngbnds[3]],
      ])
    );
  }

  function addVectorLayersEvents(map) {
    // layer state
    _state = {
      selected: []
    }

    map.on("click", "county", function (e) {
      if (!e.originalEvent.defaultPrevented) {
        if (_defaults.layers.county.parent == true) {
          e.originalEvent.preventDefault();

          let existingItems = _state.selected.filter(function (item) {
            return item.source == "counties-src";
          });

          if (existingItems.length > 0) {
            for (var i in existingItems) {
              map.removeFeatureState(existingItems[i], 'selected');
              _state.selected.splice(i, 1);
            }
          }

          map.setFeatureState(
            {
              source: "counties-src",
              sourceLayer: "county",
              id: e.features[0].id,
            },
            {
              selected: true,
            }
          );

          _state.selected.push({
            source: "counties-src",
            sourceLayer: "county",
            id: e.features[0].id,
            layer: "county",
          });

          let features = map.querySourceFeatures("counties-src", {
            sourceLayer: "county",
          });
          zoomToClickedLayer(e, features, "NAME", "county", map);
        } else {
          //alert("You clicked a county while the parent is not set to counties");
        }
      } else {
        //alert("Default prevented");
      }
    });

    map.on("click", "brma", function (e) {
      if (!e.originalEvent.defaultPrevented) {
        if (_defaults.layers.brma.parent == true) {
          e.originalEvent.preventDefault();

          let existingItems = _state.selected.filter(function (item) {
            return item.source == "brma-src";
          });

          if (existingItems.length > 0) {
            for (var i in existingItems) {
              map.removeFeatureState(existingItems[i], 'selected');
              _state.selected.splice(i, 1);
            }
          }

          map.setFeatureState(
            {
              source: "brma-src",
              sourceLayer: "brma",
              id: e.features[0].id,
            },
            {
              selected: true,
            }
          );

          _state.selected.push({
            source: "brma-src",
            sourceLayer: "brma",
            id: e.features[0].id,
            layer: "brma",
          });

          let features = map.querySourceFeatures("brma-src", {
            sourceLayer: "brma",
          });
          zoomToClickedLayer(e, features, "NAME", "brma", map);
        } else {
          //alert("You clicked a BRMA while the parent is not set to BRMAs");
        }
      }
    });

    map.on("click", "borough", function (e) {
      if (!e.originalEvent.defaultPrevented) {
        if (_defaults.layers.borough.parent == true) {
          e.originalEvent.preventDefault();

          let existingItems = _state.selected.filter(function (item) {
            return item.source == "borough-src";
          });

          if (existingItems.length > 0) {
            for (var i in existingItems) {
              map.removeFeatureState(existingItems[i], 'selected');
              _state.selected.splice(i, 1);
            }
          }

          map.setFeatureState(
            {
              source: "borough-src",
              sourceLayer: "borough",
              id: e.features[0].id,
            },
            {
              selected: true,
            }
          );

          _state.selected.push({
            source: "borough-src",
            sourceLayer: "borough",
            id: e.features[0].id,
            layer: "borough",
          });

          let features = map.querySourceFeatures("borough-src", {
            sourceLayer: "borough",
          });
          zoomToClickedLayer(e, features, "NAME", "borough", map);
        }
      }
    });

    map.on("click", "postalarea", function (e) {
      if (!e.originalEvent.defaultPrevented) {
        if (_defaults.layers.postalarea.parent == true) {
          e.originalEvent.preventDefault();

          let existingItems = _state.selected.filter(function (item) {
            return item.source == "postalarea-src";
          });

          if (existingItems.length > 0) {
            for (var i in existingItems) {
              map.removeFeatureState(existingItems[i], 'selected');
              _state.selected.splice(i, 1);
            }
          }

          map.setFeatureState(
            {
              source: "postalarea-src",
              sourceLayer: "postalarea",
              id: e.features[0].id,
            },
            {
              selected: true,
            }
          );

          _state.selected.push({
            source: "postalarea-src",
            sourceLayer: "postalarea",
            id: e.features[0].id,
            layer: "postalarea",
          });

          let features = map.querySourceFeatures(
            "postalarea-src",
            { sourceLayer: "postalarea" }
          );
          zoomToClickedLayer(e, features, "NAME", "postalarea",map);
        }
      }
    });

    map.on("click", "postaldistrict", function (e) {
      if (!e.originalEvent.defaultPrevented) {
        if (_defaults.layers.postaldistrict.parent == true) {
          e.originalEvent.preventDefault();

          let existingItems = _state.selected.filter(function (item) {
            return item.source == "postaldistrict-src";
          });

          if (existingItems.length > 0) {
            for (var i in existingItems) {
              map.removeFeatureState(existingItems[i], 'selected');
              _state.selected.splice(i, 1);
            }
          }

          map.setFeatureState(
            {
              source: "postaldistrict-src",
              sourceLayer: "postaldistrict",
              id: e.features[0].id,
            },
            {
              selected: true,
            }
          );

          _state.selected.push({
            source: "postaldistrict-src",
            sourceLayer: "postaldistrict",
            id: e.features[0].id,
            layer: "postaldistrict",
          });

          let features = map.querySourceFeatures(
            "postaldistrict-src",
            { sourceLayer: "postaldistrict" }
          );
          zoomToClickedLayer(e, features, "NAME", "postaldistrict", map);
        }
      }
    });

    map.on("click", "postalsector", function (e) {
      if (!e.originalEvent.defaultPrevented) {
        if (_defaults.layers.postalsector.parent == true) {
          e.originalEvent.preventDefault();

          let existingItems = _state.selected.filter(function (item) {
            return item.source == "postalsector-src";
          });

          if (existingItems.length > 0) {
            for (var i in existingItems) {
              map.removeFeatureState(existingItems[i], 'selected');
              _state.selected.splice(i, 1);
            }
          }

          map.setFeatureState(
            {
              source: "postalsector-src",
              sourceLayer: "postalsector",
              id: e.features[0].id,
            },
            {
              selected: true,
            }
          );

          _state.selected.push({
            source: "postalsector-src",
            sourceLayer: "postalsector",
            id: e.features[0].id,
            layer: "postalsector",
          });

          let features = map.querySourceFeatures(
            "postalsector-src",
            { sourceLayer: "postalsector" }
          );
          zoomToClickedLayer(e, features, "NAME", "postalsector",map);
        }
      }
    });
  }
  
  function registerVectors(map) {
    addVectorSources(map);
    addVectorLayers(map);
    addVectorLayersEvents(map);
  }

  // registers layers that are from vector maps, i.e brma, county etc.
  registerVectors(map);
  
}

function activateCustomControls(map) {
  // add custom controls, zoom control
  class customRadiusZoomControl {
    onAdd(map) {
      this._map = map;
      this._container = document.getElementById("zoom_level");
      return this._container;
    }
    onRemove(map) {
      this._container.parentNode.removeChild(this._container);
      this._map = undefined;
    }
  }
  
  map.addControl(
    new customRadiusZoomControl(), 
    "top-left"
  );

  // add custom controls, layer control
  class customLayerControl {
    onAdd(map) {
      this._map = map;
      this._container = document.getElementById("layer_control");
      let parentLayerName = '';

      // register listeners for layer controls
      const subControls = document.getElementsByClassName("tagify-elem");
      [].forEach.call(subControls, (elem) => {
        elem.addEventListener("click", (e) => {
          if (elem.classList.contains('active-tag') && elem.getAttribute('data-val').toLowerCase() == parentLayerName.toLocaleLowerCase()) {
            // don't toggle layer off since it's the parent
            return;
          }

          e.stopPropagation();

          if (elem.classList.contains("active-tag")) {
            elem.classList.remove('active-tag');
            map.setLayoutProperty(
              elem.getAttribute('data-val'),
              "visibility",
              "none"
            );
            map.setLayoutProperty(
              `${elem.getAttribute('data-val')}-lyr-stroke`,
              "visibility",
              "none"
            );
            map.setLayoutProperty(
              `${elem.getAttribute('data-val')}-lbl`,
              "visibility",
              "none"
            );
          } else {
            elem.classList.add('active-tag');
            map.setLayoutProperty(
              elem.getAttribute('data-val'),
              "visibility",
              "visible"
            );
            map.setLayoutProperty(
              `${elem.getAttribute('data-val')}-lyr-stroke`,
              "visibility",
              "visible"
            );
            map.setLayoutProperty(
              `${elem.getAttribute('data-val')}-lbl`,
              "visibility",
              "visible"
            );
          }
        });

        let optionList = document.getElementsByClassName('option-text');

        [].forEach.call(optionList, (elem) => {
          elem.addEventListener('click', () => {
            let child = elem;
            parentLayerName = elem.getAttribute('data-value');
            setParentLayer(parentLayerName, map);

            //Delete highlight state on all other layers other than the selected
            for (var i = 0; i < _state.selected.length; i++) {
              if (
                _state.selected[i].layer !=
                elem.getAttribute("data-name")
              ) {
                map.removeFeatureState(_state.selected[i]);
                _state.selected.splice(i, 1);
              }
            }

            //Hide all layers but the currently selected
            let layerNames = Object.keys(_defaults.layers);

            for (var i = 0; i < layerNames.length; i++) {
              if (
                layerNames[i] != elem.getAttribute('data-value')
              ) {
                map.setLayoutProperty(
                  layerNames[i],
                  "visibility",
                  "none"
                );
                map.setLayoutProperty(
                  `${layerNames[i]}-lyr-stroke`,
                  "visibility",
                  "none"
                );
                map.setLayoutProperty(
                  `${layerNames[i]}-lbl`,
                  "visibility",
                  "none"
                );
              } else {
                map.setLayoutProperty(
                  layerNames[i],
                  "visibility",
                  "visible"
                );
                map.setLayoutProperty(
                  `${layerNames[i]}-lyr-stroke`,
                  "visibility",
                  "visible"
                );
                map.setLayoutProperty(
                  `${layerNames[i]}-lbl`,
                  "visibility",
                  "visible"
                );
              }
            }

            // activate the matching tagify element when the parent changes
            [].forEach.call(subControls, (elem) => {
              // remove all active tagify layers
              if (elem.classList.contains('active-tag')) {
                elem.click();

                // remove the previous master-option
                if (elem.classList.contains('master-option')) {
                  elem.classList.remove('master-option');
                }
              }

              // if the child matches the parent, add the master-option class to it
              if (elem.getAttribute('data-val').toLowerCase() === parentLayerName.toLowerCase()) {
                elem.classList.add('master-option');
              }
  
              if (elem.getAttribute('data-val').toLowerCase() === child.getAttribute('data-value').toLowerCase()) {
                elem.click();
              }
            });

            // Jump to the default minimum zoom level defined for the selected parent layer
            // or stick to the current zoom if an area has already been clicked in previous layer
            if (_currentlyProcessing && _defaults.layers[child.getAttribute('data-value')].mz < map.getZoom()) {
              map.flyTo({
                zoom: map.getZoom(),
                center: map.getCenter(), // center of the map
                bearing: 0,
                speed: 0.7,
                essential: true
              })
            } else {
              map.flyTo({
                zoom: _defaults.layers[child.getAttribute('data-value')].mz,
                center: _currentlyProcessing ? map.getCenter() : [-1.8594463589181272, 53.318170599741286], // center of the map
                bearing: 0,
                speed: 0.7,
                essential: true
              })
            }

          })
        });
      
      })
      
      return this._container;
    }
    onRemove(map) {
      this._container.parentNode.removelem(this._container);
      this._map = undefined;
    }
  }

  map.addControl(
    new customLayerControl(),
    "top-right"
  );
  

  // adds reset button and criteria
  class customResetAndCriteriaControl {
    onAdd(map) {
      this._map = map;
      this._container = document.getElementById("criteria-box");

      // add listener for map reset
      const resetButton = document.getElementById("reset-button");
      resetButton.addEventListener('click', () => {
        // resets the map variables
        _currentlyProcessing = null;
        _state = null;
        exactSearchText = "";
        searchResultCenter = [];
        document.getElementById('map').innerHTML = "";
        _map = null;

        const parser = new DOMParser();
        const htmlDoc = parser.parseFromString(document.getElementById("cloning-factory").textContent, 'text/html');
        document.getElementById('controls').appendChild(htmlDoc.getElementById('zoom_level'));
        document.getElementById('controls').appendChild(htmlDoc.getElementById('layer_control'));
        document.getElementById('controls').appendChild(htmlDoc.getElementById('criteria-box'));

        init();
      })

      return this._container;
    }
    onRemove(map) {
      this._container.parentNode.removelem(this._container);
      this._map = undefined;
    }
  }

  map.addControl(
    new customResetAndCriteriaControl(),
    "bottom-right"
  )
  
}

function activateSearch(searchBar, map) {
  // listen for search results
  searchBar.on('results', () => {    
    exactSearchText = document.getElementsByClassName('mapboxgl-ctrl-geocoder--input')[0].value;
  })

  // when the search bar is cleared
  searchBar.on('clear', () => {
    exactSearchText = "";
    removeAnyPreviousSearchCircle(map);
  });

  const getMatchingLayer = async ({ result }) => {

    searchResultCenter = result.center;

    console.log(result);

    try {
      // let temp = await fetch(`${_apiUrl}search?q=${exactSearchText}`)
      let temp = await fetch("http://145.239.253.100:4500/api/search/entities?qry=" + exactSearchText);
      temp = await temp.json();
      let matchingLayer = temp.data.length ? temp.data[0] : null;

      // if there are no matching layers then just use a marker and allow the user to update the radius on search
      if (matchingLayer == null) {
        activateSearchByArea(map);
      } else {

      }
    } catch (error) {
      // handle error with a popup
      console.log(error);
    }
  }

  // when the user clicks a suggestion
  searchBar.on('result', getMatchingLayer);
} 

function removeAnyPreviousSearchCircle(map) {
  // set the data to empty for the circle source
  map.getSource('circle-source').setData({
    type: "FeatureCollection",
    features: [],
  });

}

function activateSearchByArea(map) {

  removeAnyPreviousSearchCircle(map);

  let circleRadius = 5; // default radius of search area in miles
  let circleOptions = {steps: 100, units: 'miles', properties: {}};
  let circle = turf.circle(searchResultCenter, circleRadius, circleOptions);
  let proportionateZoom = _defaults.radiusToZoom[circleRadius];

  // set zoom a little closer
  map.flyTo({
    center: searchResultCenter,
    zoom: proportionateZoom,
  });

  map.getSource('circle-source').setData(circle);

  // add a radius change event
  const changeSearchRadius = (e) => {
    circleRadius = e.target.value;
    circleOptions = {steps: 100, units: 'miles', properties: {}};
    circle = turf.circle(searchResultCenter, circleRadius, circleOptions);
    proportionateZoom = _defaults.radiusToZoom[circleRadius];

    map.flyTo({
      center: searchResultCenter,
      zoom: proportionateZoom,
    });

    map.getSource('circle-source').setData(circle);
  }

  document.getElementById('zoom_level').addEventListener('change', changeSearchRadius);
}

init();
