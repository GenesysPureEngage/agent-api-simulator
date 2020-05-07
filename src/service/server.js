/**
* The Agent API Simulator is being released under the standard MIT License.
* Copyright (c) 2020 Genesys. All rights reserved.
*/

const https = require('https')
const http = require('http')
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const request = require('request');
const log = require('./common/log');
const fs = require('fs');
const path = require('path');
const config = require('./config/agent-api-simulator.json');
const app = express();

// set middlewares
app.use(require('morgan')('dev'))
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(bodyParser.json({ limit: '50mb' }));

// header middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.get('origin'));
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header(
    'Access-Control-Allow-Headers',
    'Authorization, Origin, X-Requested-With, Content-Type, Accept, x-b3-spanid, x-b3-traceid, x-api-key, x-gws-unstable'
  );
  next();
});

// add routes
app.use(require('./routes/simulator'));
app.use(require('./routes/compatibility'));
app.use(require('./routes/static'));
app.use(require('./routes/workspace'));
app.use(require('./routes/auth'));
app.use(require('./routes/voice'));

// function called once the server is listening
function listenCallback(tls) {
  // display the url of the simulator
  log.info('Agent Api Simulator: ' + (tls ? 'https' : 'http') + `://localhost:${config.port}`);
  // display the url of workspace
  log.info('Workspace: ' + (tls ? 'https' : 'http') + `://localhost:${config.port}/ui/wwe/index.html`);
}

// try to host the server in https
try {
  // load the certificates
  const certs = {
    key: fs.readFileSync(path.join(__dirname, '../../data/certificates/localhost.key.pem')),
    cert: fs.readFileSync(path.join(__dirname, '../../data/certificates/localhost.cert.pem'))
  };
  // listen
  https.createServer(certs, app).listen(config.port, () => listenCallback(true));
}
catch (e) {
  // if the certificates were not found, start in http
  log.info('Failed to start the HTTPS server, starting with HTTP. \n' + e);

  // listen
  http.createServer(app).listen(config.port, () => listenCallback(false));
}