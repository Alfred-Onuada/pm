/* eslint-disable no-console */
const { Pool } = require('pg');
const env = require('../env');
const fs = require('fs');
const copyFrom = require('pg-copy-streams').from;

class DatabaseConnection {
  constructor(config) {
    this.config = config;
    this.pool = new Pool(this.config);

    this.pool.on('error', (err, client) => {
      console.error(err);
      console.error('Error on connection Pool');
    });
  }

  async getConnection() {
    if (!this.pool || (this.pool && this.pool.ended)) {
      this.pool = new Pool(this.config);
    }
    let connection;

    try {
      connection = await this.pool.connect();
    } catch (error) {
      console.error(error);
      console.error('===== Failed to create connection from pool =====');
      console.log('===== Trying Connection Again =====');
      connection = await this.pool.connect();
    }

    return connection;
  }

  async query(queryString, paramsOrCallback, done) {
    let cnx;

    try {
      cnx = await this.getConnection();

      if (typeof paramsOrCallback === 'function') {
        return cnx.query(queryString, (err, resp) => {
          if (err) {
            console.error(err);
          }
          cnx.release(err);
          paramsOrCallback.call(undefined, err, resp);
        });
      } else {
        return cnx.query(queryString, paramsOrCallback, (err, resp) => {
          if (err) {
            console.error(err);
          }
          cnx.release(err);
          done.call(undefined, err, resp);
        });
      }
    } catch (error) {
      console.log(error);
      console.error('===== Error in getting connection from pool =====');

      if (typeof paramsOrCallback === 'function') {
        paramsOrCallback.call(undefined, error);
      } else {
        done.call(undefined, error);
      }
    }
  }

  async copyRemote(queryString, fileName, done) {
    let cnx, fileStream;

    try {
      try {
        cnx = await this.getConnection();
      } catch (error) {
        console.error('===== Error in getting connection from pool =====');
        done(error);
        return;
      }

      const stream = await cnx.query(copyFrom(queryString));

      stream.on('error', (error) => {
        cnx.release();
        done(error);
      });

      stream.on('finish', () => {
        console.log("File copied");
        cnx.release();
        done(undefined, "Success");
      });

      try {
        fileStream = await fs.createReadStream(fileName);
      } catch (error) {
        console.error(error);
        done(error);
      }

      fileStream.pipe(stream);
    } catch (error) {
      console.log(error);
      done(error);
    }
  }

  async disconnect() {
    console.log('Ending Pool');
    this.pool.end();
  }
}

const instance = new DatabaseConnection(env.db);

module.exports = instance;
