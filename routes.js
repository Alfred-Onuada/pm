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
    const queryString = req.query.q;

		try {
			let query = `SELECT * FROM (SELECT * FROM (SELECT name, type, id, 'BRMA'::text AS lbl, ST_AsGeoJson(ST_Envelope(geom)) AS geom FROM brma WHERE SIMILARITY(NAME, '${queryString}') > 0.3 LIMIT 10) a
			UNION
			SELECT * FROM (SELECT name, type, id, 'Borough'::text AS lbl, ST_AsGeoJson(ST_Envelope(geom)) AS geom FROM borough WHERE SIMILARITY(NAME, '${queryString}') > 0.3 LIMIT 10) b
			UNION
			SELECT * FROM (SELECT name, type, id, 'County'::text AS lbl, ST_AsGeoJson(ST_Envelope(geom)) AS geom FROM county WHERE SIMILARITY(NAME, '${queryString}') > 0.3 LIMIT 10) c
			UNION
			SELECT * FROM (SELECT name, type, id, 'Postal Area'::text AS lbl, ST_AsGeoJson(ST_Envelope(geom)) AS geom FROM postalarea WHERE SIMILARITY(NAME, '${queryString}') > 0.3 LIMIT 10) d
			UNION
			SELECT * FROM (SELECT name, type, id, 'Postal District'::text AS lbl, ST_AsGeoJson(ST_Envelope(geom)) AS geom FROM postaldistrict WHERE SIMILARITY(NAME, '${queryString}') > 0.3 LIMIT 10) e
			UNION
			SELECT * FROM (SELECT name, type, id, 'Postal Sector'::text AS lbl, ST_AsGeoJson(ST_Envelope(geom)) AS geom FROM postalsector WHERE SIMILARITY(NAME, '${queryString}') > 0.3 LIMIT 10) f) sq ORDER BY name ASC`;

			db.query(query, [], async function(error, result) {
				if (error) {
					return res.status(500).json({ info: "An error occured on the server - db relation error", message: error.message });
				}

				// results is undefined or empty
				if (typeof result == 'undefined' || result.rows.length == 0) {
					let matches = [];
					let finalResults = [];
			
					// look for keys in the postal_area.json that are similar to the queryString 
					for (let key of Object.keys(postalArea)) {
						if (key.toLowerCase().includes(queryString.toLowerCase())) {
							matches.push({ 
								key: key,
								value: postalArea[key],
								type: 'Postal Area'
							});
						}
					}
			
					// look for keys in the postal_district.json that are similar to the queryString
					for (let key of Object.keys(postalDistrict)) {
						if (key.toLowerCase().includes(queryString.toLowerCase())) {
							matches.push({ 
								key: key,
								value: postalDistrict[key],
								type: 'Postal District'
							});
						}
					}
			
					// look for keys in the postal_sector.json that are similar to the queryString
					for (let key of Object.keys(postalSector)) {
						if (key.toLowerCase().includes(queryString.toLowerCase())) {
							matches.push({ 
								key: key,
								value: postalSector[key],
								type: 'Postal Sector'
							});
						}
					}
			
					// strip matches to only 10 records
					matches = matches.slice(0, 10);
						
					for (let match of matches) {
						let subQuery = '';

						switch (match.type) {
							case 'Postal Area':
								
								subQuery = `SELECT * FROM (SELECT name, type, id, 'Postal Area'::text AS lbl, '${match.key}'::text AS subtitle, ST_AsGeoJson(ST_Envelope(geom)) AS geom FROM postalarea WHERE NAME LIKE '%${match.value}%' LIMIT 10)`;

								db.query(subQuery, [], function(error, result) {
									if (error) {
										return res.status(500).json({ info: "An error occured on the server - db relation error", message: error.message });
									}

									finalResults.push(...result.rows);
								});

								break;

							case 'Postal District':

								subQuery = `SELECT * FROM (SELECT name, type, id, 'Postal District'::text AS lbl, '${match.key}'::text AS subtitle, ST_AsGeoJson(ST_Envelope(geom)) AS geom FROM postaldistrict WHERE NAME LIKE '%${match.value}%' LIMIT 10)`;

								db.query(subQuery, [], function(error, result) {
									if (error) {
										return res.status(500).json({ info: "An error occured on the server - db relation error", message: error.message });
									}

									finalResults.push(...result.rows);
								});

								break;

							case 'Postal Sector':

								subQuery = `SELECT * FROM (SELECT name, type, id, 'Postal Sector'::text AS lbl, '${match.key}'::text AS subtitle, ST_AsGeoJson(ST_Envelope(geom)) AS geom FROM postalsector WHERE NAME LIKE '%${match.value}%' LIMIT 10)`;

								db.query(subQuery, [], function(error, result) {
									if (error) {
										return res.status(500).json({ info: "An error occured on the server - db relation error", message: error.message });
									}

									finalResults.push(...result.rows);
								});

								break;
						}

					}
			
					if (finalResults.length > 0) {
						return res.status(200).json({ data: finalResults });
					} else {
						return res.status(404).json({ info: "Not Found", finalResults });
					}
				} else {
					return res.status(200).json({
						data: result.rows
					});
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

				maxPageNo = maxPageNo ? maxPageNo : Math.round(response.data.property_count / 500);
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
						"ShortPostcode": property.ShortPostcode,
						"Price": property.Price,
						"Bedrooms": property.Bedrooms,
						"HouseType": property.HouseType,
						"HouseType_OLD": property.HouseType_OLD
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

				maxPageNo = maxPageNo ? maxPageNo : Math.round(response.data.property_count / 500);
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
						"ShortPostcode": property.ShortPostcode,
						"Price": property.Price,
						"Bedrooms": property.Bedrooms,
						"HouseType": property.HouseType,
						"HouseType_OLD": property.HouseType_OLD
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