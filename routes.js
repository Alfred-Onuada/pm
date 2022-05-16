const router = require('express').Router();
const cache = require('memory-cache')
const tilelive = require('@mapbox/tilelive');
const turf = require('@turf/turf');
require('@mapbox/mbtiles').registerProtocols(tilelive);
const axios = require('axios').default;

module.exports = function(app, db) {
  // search endpoint
  router.get("/search", (req, res) => {
    const queryString = req.query.q;

    let query = `SELECT * FROM (SELECT * FROM (SELECT name, type, id, 'BRMA'::text AS lbl, ST_AsGeoJson(ST_Envelope(geom)) AS geom FROM brma WHERE NAME LIKE '%${queryString}%') a
    UNION
    SELECT * FROM (SELECT name, type, id, 'Borough'::text AS lbl, ST_AsGeoJson(ST_Envelope(geom)) AS geom FROM borough WHERE NAME LIKE '%${queryString}%') b
    UNION
    SELECT * FROM (SELECT name, type, id, 'County'::text AS lbl, ST_AsGeoJson(ST_Envelope(geom)) AS geom FROM county WHERE NAME LIKE '%${queryString}%') c
    UNION
    SELECT * FROM (SELECT name, type, id, 'Postal Area'::text AS lbl, ST_AsGeoJson(ST_Envelope(geom)) AS geom FROM postalarea WHERE NAME LIKE '%${queryString}%') d
    UNION
    SELECT * FROM (SELECT name, type, id, 'Postal District'::text AS lbl, ST_AsGeoJson(ST_Envelope(geom)) AS geom FROM postaldistrict WHERE NAME LIKE '%${queryString}%') e
    UNION
    SELECT * FROM (SELECT name, type, id, 'Postal Sector'::text AS lbl, ST_AsGeoJson(ST_Envelope(geom)) AS geom FROM postalsector WHERE NAME LIKE '%${queryString}%') f) sq 
    ORDER BY 
      CASE 
        WHEN NAME LIKE '${queryString}' THEN 1
        WHEN NAME LIKE '${queryString}%' THEN 2
        WHEN NAME LIKE '%${queryString}%' THEN 3
        ELSE 4
      END`;

    db.query(query, [], function(error, result) {
      if (error) {
        console.log(error.message);
        return res.status(400).json({ info: error.message });
      }

      // results is undefined or empty
      if (!result) {
        // before returing cross check against the array of known locations to see if the person used a postcode
        return res.status(404).json({ info: "Not Found" });
      }

      return res.status(200).json({
        data: result.rows
      });
    });		
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
		
		async function getProperties(pageNo) {

			try {
				const response = await axios.get(`http://145.239.253.100/api/search/${bounds}/coords/page/${pageNo}`);
				
				if (response.data.properties.length > 0) {
					maxPageNo = maxPageNo ? maxPageNo : (response.data.property_count / 100);
					retrievedData.push(...response.data.properties);
				}

				// checks the offset to prevent just making useless queries
				if (pageNo < pageOffset + 3 && (maxPageNo === null || pageNo < maxPageNo)) {
					pageNo += 1;
					await getProperties(pageNo);
				}

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
				// "identifier":"R88316524","Longitude":"-2.608815","Latitude":"51.456560","ShortPostcode":"BS8","Price":"230000","Bedrooms":"1","HouseType":"Flats\/Apartments","HouseType_OLD":"flat"
				let feature = {
					"type": "Feature",
					"geometry": {
						"type": "Point",
    				"coordinates": [property.Longitude, property.Latitude]
					},
					"properties": {
						"identifier": property.identifier,
						"ShortPostCode": property.ShortPostCode,
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
			return res.status(200).json(geoJsonRepOfProperties);
		} else {
			return res.status(404).send("No properties to return");
		}

	})

  app.use('/api', router);
}