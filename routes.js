const router = require('express').Router();
const http = require('http');
const cache = require('memory-cache')
const tilelive = require('@mapbox/tilelive');
const turf = require('@turf/turf');
require('@mapbox/mbtiles').registerProtocols(tilelive);

module.exports = function(app, db) {
  // search endpoint
  router.get("/search", (req, res) => {
    const queryString = req.query.q;

    let query = `SELECT * FROM (SELECT * FROM (SELECT name, type, id, 'BRMA'::text AS lbl, ST_AsGeoJson(ST_Envelope(geom)) AS geom FROM brma WHERE NAME LIKE '${queryString}%') a
    UNION
    SELECT * FROM (SELECT name, type, id, 'Borough'::text AS lbl, ST_AsGeoJson(ST_Envelope(geom)) AS geom FROM borough WHERE NAME LIKE '${queryString}%') b
    UNION
    SELECT * FROM (SELECT name, type, id, 'County'::text AS lbl, ST_AsGeoJson(ST_Envelope(geom)) AS geom FROM county WHERE NAME LIKE '${queryString}%') c
    UNION
    SELECT * FROM (SELECT name, type, id, 'Postal Area'::text AS lbl, ST_AsGeoJson(ST_Envelope(geom)) AS geom FROM postalarea WHERE NAME LIKE '${queryString}%') d
    UNION
    SELECT * FROM (SELECT name, type, id, 'Postal District'::text AS lbl, ST_AsGeoJson(ST_Envelope(geom)) AS geom FROM postaldistrict WHERE NAME LIKE '${queryString}%') e
    UNION
    SELECT * FROM (SELECT name, type, id, 'Postal Sector'::text AS lbl, ST_AsGeoJson(ST_Envelope(geom)) AS geom FROM postalsector WHERE NAME LIKE '${queryString}%') f) sq 
    ORDER BY 
      CASE 
        WHEN NAME LIKE '${queryString}' THEN 1
        WHEN NAME LIKE '${queryString}%' THEN 2
        WHEN NAME LIKE '%${queryString}%' THEN 3
        ELSE 4
      END'`;

    db.query(query, [], function(error, result) {
      if (error) {
        return res.status(400).send(error.message);
      }

      // results is undefined or empty
      if (!result) {
        // before returing cross check against the array of known locations to see if the person used a postcode
        return res.status(404).send("Not Found");
      }

      return res.status(200).json({
        data: result.rows
      });
    });		
  })


  app.use('/api', router);
}