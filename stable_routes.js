const router = require('express').Router();
const cache = require('memory-cache')
const tilelive = require('@mapbox/tilelive');
const turf = require('@turf/turf');
require('@mapbox/mbtiles').registerProtocols(tilelive);
const axios = require('axios').default;

// load postcode titles into memory
const postalArea = require('./utils/postal_area.json');
const postalDistrict = require('./utils/postal_district.json');
const postalSector = require('./utils/postal_sector.json');

module.exports = function(app, db) {
  // search endpoint
  router.get("/search", (req, res) => {
		
		if (!req.query.q) return res.status(400).json({ error: 'Missing query' });

    const queryString = req.query.q.toLowerCase();

		try {
			let query = `SELECT * FROM (SELECT * FROM (SELECT name, type, id, 'BRMA'::text AS lbl, ST_AsGeoJson(ST_Envelope(geom)) AS geom FROM brma WHERE LOWER(name) LIKE CONCAT( CAST($1 AS text), '%') LIMIT 10) a
			UNION
			SELECT * FROM (SELECT name, type, id, 'Borough'::text AS lbl, ST_AsGeoJson(ST_Envelope(geom)) AS geom FROM borough WHERE LOWER(name) LIKE CONCAT( CAST($1 AS text), '%') LIMIT 10) b
			UNION
			SELECT * FROM (SELECT name, type, id, 'County'::text AS lbl, ST_AsGeoJson(ST_Envelope(geom)) AS geom FROM county WHERE LOWER(name) LIKE CONCAT( CAST($1 AS text), '%') LIMIT 10) c
			UNION
			SELECT * FROM (SELECT name, type, id, 'Postal Area'::text AS lbl, ST_AsGeoJson(ST_Envelope(geom)) AS geom FROM postalarea WHERE LOWER(name) LIKE CONCAT( CAST($1 AS text), '%') LIMIT 10) d
			UNION
			SELECT * FROM (SELECT name, type, id, 'Postal District'::text AS lbl, ST_AsGeoJson(ST_Envelope(geom)) AS geom FROM postaldistrict WHERE LOWER(name) LIKE CONCAT( CAST($1 AS text), '%') LIMIT 10) e
			UNION
			SELECT * FROM (SELECT name, type, id, 'Postal Sector'::text AS lbl, ST_AsGeoJson(ST_Envelope(geom)) AS geom FROM postalsector WHERE LOWER(name) LIKE CONCAT( CAST($1 AS text), '%') LIMIT 10) f) sq ORDER BY name ASC`;

			db.query(query, [queryString], async function(error, result) {
				if (error) {
					return res.status(500).json({ info: "An error occured on the server - db relation error", message: error.message });
				}
				
				let matches = [];

				// if the search is like a 2 letter word or under skip here, else it will take a shit load of time to complete
				if (queryString.length >= 3) {

					// look for keys in the postal_area.json that are similar to the queryString 
					for (let key of Object.keys(postalArea)) {
						if (key.slice(0, queryString.length).toLowerCase() === queryString) {
							matches.push({ 
								key: key,
								value: postalArea[key].toLowerCase(),
								type: 'Postal Area'
							});
						}
					}
			
					// look for keys in the postal_district.json that are similar to the queryString
					for (let key of Object.keys(postalDistrict)) {
						if (key.slice(0, queryString.length).toLowerCase() === queryString) {
							matches.push({ 
								key: key,
								value: postalDistrict[key].toLowerCase(),
								type: 'Postal District'
							});
						}
					}
			
					// look for keys in the postal_sector.json that are similar to the queryString
					for (let key of Object.keys(postalSector)) {
						if (key.slice(0, queryString.length).toLowerCase() === queryString) {
							matches.push({ 
								key: key,
								value: postalSector[key].toLowerCase(),
								type: 'Postal Sector'
							});
						}
					}
	
					// info required - name, id, type, geom, lbl, subtitle
					let finalResults = [];
	
					function subQueries(queryString, params) {
						return new Promise((resolve, reject) => {
							db.query(queryString, [...params], function(error, result) {
								if (error) {
									return reject({ info: "An error occured on the server - db relation error", message: error.message });
								}
	
								if (result.rows.length > 0) {
									return resolve(result.rows);
								}

								return resolve([]);
							});	
						})
					}

					// this reduces the number to a resonable amount of queries
					matches = matches.splice(0, 30);
	
					// loop through matches and add to finalResults
					for (let match of matches) {
	
						let subQuery = '';
	
						if (match.type == 'Postal Area') {
							subQuery = `SELECT name, id, type, ST_AsGeoJson(ST_Envelope(geom)) AS geom, $1::text AS subtitle, $2::text As lbl FROM postalarea WHERE LOWER(name) = CAST($3 AS text)`;
						} else if (match.type == 'Postal District') {
							subQuery = `SELECT name, id, type, ST_AsGeoJson(ST_Envelope(geom)) AS geom, $1::text AS subtitle, $2::text As lbl FROM postaldistrict WHERE LOWER(name) = CAST($3 AS text)`;
						} else if (match.type == 'Postal Sector') {
							subQuery = `SELECT name, id, type, ST_AsGeoJson(ST_Envelope(geom)) AS geom, $1::text AS subtitle, $2::text As lbl FROM postalsector WHERE LOWER(name) = CAST($3 AS text)`;
						}
	
						if (subQuery.length) {

							try {
								let result = await subQueries(subQuery, [match.key.split("#")[0], match.type, match.value]);

								if (result.length) {
									finalResults.push(...result);
								}
							} catch (error) {
								return res.status(500).json({ info: "An error occured on the server - db relation error", message: error.message });
							}

						}
	
					}
	
					if (finalResults.length > 0) {
						if (typeof result != 'undefined') {
							result.rows.push(...finalResults)
						} else {
							result.rows = finalResults;
						}
					}
				}

				// results is undefined or empty
				if (typeof result == 'undefined' || result.rows.length == 0) {
					return res.status(404).json({ info: "not found" });
				} else {
					return res.status(200).json({ data: result.rows });
				}
			
			});	
		} catch (error) {
			console.log(error);
			return res.status(500).json({ info: "An error occured on the server - db error", message: error.message });
		}

  })

  tilelive.load('mbtiles://./mbtiles/lbl.mbtiles', function(err, source) {

		source.getInfo(function(err, info) {
		  	console.log(info.vector_layers[0]); // info
		});

		router.get('/mvt/labels/:z/:x/:y.pbf', function(req, res){		 

			source.getTile(req.params.z, req.params.x, req.params.y, function(err, tile, headers) {
			    if (err) {
			        res.status(404);
			        res.send(err.message);
			        console.log(err.message);
			    } else {
			        res.set(headers);
			        res.send(tile);
			    }
			});
		});
	});

	tilelive.load('mbtiles://./mbtiles/postalarea.mbtiles', function(err, source) {

		router.get('/mvt/postal_areas/:z/:x/:y.pbf', function(req, res){
 
	        source.getTile(req.params.z, req.params.x, req.params.y, function(err, tile, headers) {
	            if (err) {
	                res.status(404);
	                res.send(err.message);
	                console.log(err.message);
	            } else {
	              res.set(headers);
	              res.send(tile);
	            }
	        });

		});
	});

	tilelive.load('mbtiles://./mbtiles/postaldistrict.mbtiles', function(err, source) {

		router.get('/mvt/postal_districts/:z/:x/:y.pbf', function(req, res){
 
	        source.getTile(req.params.z, req.params.x, req.params.y, function(err, tile, headers) {
	            if (err) {
	                res.status(404);
	                res.send(err.message);
	                console.log(err.message);
	            } else {
	              res.set(headers);
	              res.send(tile);
	            }
	        });

		});
	});

	tilelive.load('mbtiles://./mbtiles/postalsector.mbtiles', function(err, source) {

		router.get('/mvt/postal_sectors/:z/:x/:y.pbf', function(req, res){
 
	        source.getTile(req.params.z, req.params.x, req.params.y, function(err, tile, headers) {
	            if (err) {
	                res.status(404);
	                res.send(err.message);
	                console.log(err.message);
	            } else {
	              res.set(headers);
	              res.send(tile);
	            }
	        });

		});
	});

	tilelive.load('mbtiles://./mbtiles/county.mbtiles', function(err, source) {

		router.get('/mvt/counties/:z/:x/:y.pbf', function(req, res){
 
	        source.getTile(req.params.z, req.params.x, req.params.y, function(err, tile, headers) {
	            if (err) {
	                res.status(404);
	                res.send(err.message);
	                console.log(err.message);
	            } else {
	              res.set(headers);
	              res.send(tile);
	            }
	        });

		});
	});

	tilelive.load('mbtiles://./mbtiles/brma.mbtiles', function(err, source) {

		source.getInfo(function(err, info) {
		  	console.log(info); // info
		});

		router.get('/mvt/brma/:z/:x/:y.pbf', function(req, res){
 
	        source.getTile(req.params.z, req.params.x, req.params.y, function(err, tile, headers) {
	            if (err) {
	                res.status(404);
	                res.send(err.message);
	                console.log(err.message);
	            } else {
	              res.set(headers);
	              res.send(tile);
	            }
	        });

		});
	});	

	tilelive.load('mbtiles://./mbtiles/borough.mbtiles', function(err, source) {

		router.get('/mvt/boroughs/:z/:x/:y.pbf', function(req, res){
 
	        source.getTile(req.params.z, req.params.x, req.params.y, function(err, tile, headers) {
	            if (err) {
	                res.status(404);
	                res.send(err.message);
	                console.log(err.message);
	            } else {
	              res.set(headers);
	              res.send(tile);
	            }
	        });

		});
	});

	router.get('/properties', async (req, res) => {
		
		const { bounds, pageOffset } = req.query;
		let currentPage = +(pageOffset);
		let maxPageNo = null;
		let retrievedData = [];
		let totalProperties = 0;
		
		async function getProperties(pageNo) {

			try {
				const response = await axios.get(`http://145.239.253.100/api/search/${bounds}/coords/page/${pageNo}`);
				
				if (response.data.properties && response.data.properties.length > 0) {
					retrievedData.push(...response.data.properties);
				}

				maxPageNo = maxPageNo ? maxPageNo : Math.round(response.data.property_count / 2000);
				totalProperties = totalProperties ? totalProperties : response.data.property_count;

			} catch (error) {
				console.log(error);
				return res.status(500).send()
			}

		}

		await getProperties(currentPage);

		function convertToGeoJson(properties) {
			let info = [];
			
			for (let index = 0; index < properties.length; index++) {
				const property = properties[index];
				let feature = {
					"type": "Feature",
					"geometry": {
						"type": "Point",
    				"coordinates": [property.Longitude, property.Latitude]
					},
					"properties": {
						"identifier": property.identifier,
					}
				}

				info.push(feature);
			}

			let geojson = {
				"type": "FeatureCollection",
				"features": info
			};

			return geojson;
		}

		if (retrievedData.length > 0) {
			let geoJsonRepOfProperties = convertToGeoJson(retrievedData);
			return res.status(200).json({
				data: geoJsonRepOfProperties,
				totalProperties
			});
		} else {
			return res.status(200).json({ info: "No properties to return" });
		}

	});

	router.get('/criteria', async (req, res) => {
		const { ids, pageOffset } = req.query;
		const screenBounds = req.query.screenBounds.split(',');
		let currentPage = +(pageOffset);
		let maxPageNo = null;
		let retrievedData = [];
		let mapNeedsToAdjustView = true;
		let pointsToGetCenter = [];
		let centerBounds = null;
		let totalProperties = 0;

		async function getProperties(pageNo) {

			try {
				const response = await axios.get(`http://145.239.253.100/api/search/${ids}/criteria/page/${pageNo}`);
				
				// for some reason jis put the array inside another array and each criteria has a new array
				if (response.data.properties && response.data.properties[0].length > 0) {
					retrievedData.push(...[].concat(...response.data.properties));
				}

				maxPageNo = maxPageNo ? maxPageNo : Math.round(response.data.property_count / 2000);
				totalProperties = totalProperties ? totalProperties : response.data.property_count;

			} catch (error) {
				console.log(error);
				return res.status(500).send()
			}

		}

		await getProperties(currentPage);

		function convertToGeoJson(properties) {
			let info = [];
			
			for (let index = 0; index < properties.length; index++) {
				const property = properties[index];
				let feature = {
					"type": "Feature",
					"geometry": {
						"type": "Point",
    				"coordinates": [property.Longitude, property.Latitude]
					},
					"properties": {
						"identifier": property.identifier,
					}
				}

				// checks if any point falls within the current view, just one time it needs it
				if (mapNeedsToAdjustView) {
					let point = turf.point([property.Longitude, property.Latitude]);
					let polygon = turf.polygon([[
						[+screenBounds[0], +screenBounds[1]],
						[+screenBounds[2], +screenBounds[1]],
						[+screenBounds[2], +screenBounds[3]],
						[+screenBounds[0], +screenBounds[3]],
						[+screenBounds[0], +screenBounds[1]]
					]]);
					let withInView = turf.booleanPointInPolygon(point, polygon);

					if (withInView) {
						mapNeedsToAdjustView = false;
					}
				}
				
				pointsToGetCenter.push([+property.Longitude, +property.Latitude]);
				info.push(feature);
			}

			let geojson = {
				"type": "FeatureCollection",
				"features": info
			};

			return geojson;
		}

		if (retrievedData.length > 0) {
			let geoJsonRepOfProperties = convertToGeoJson(retrievedData);

			// calculate the center point
			if (pointsToGetCenter.length) {
				centerBounds = turf.center(turf.points(pointsToGetCenter));
			}

			// centerbounds is sent either way because map may be zoom too out and will need to return to center
			return res.status(200).json({ 
				data: geoJsonRepOfProperties,
				mapNeedsToAdjustView,
				centerBounds: centerBounds.geometry.coordinates,
				totalProperties
			});
		} else {
			return res.status(200).send({ info: "No properties to return" });
		}

	});

  app.use('/api', router);
}