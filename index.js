const express = require('express');
const cors = require('cors');
const env = require('./env');
const app = express();
const bodyParser = require('body-parser');
const db = require('./services/db');
const compression = require('compression');

app.use(compression());
app.use(cors());
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

require('./routes.js')(app, db);

app.listen(env.app.portnum);

console.log('Application started on port ' + env.app.portnum);

process.on('beforeExit', (code) => {
  // disconnect the PG client;
  console.log('debug :: PG Client disconnect');
  db.disconnect();
});