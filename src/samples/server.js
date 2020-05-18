const https = require('https')
const http = require('http')
const fs = require('fs');
const path = require('path');
const express = require('express');

// check if the arguments are present
if (process.argv.length != 4) {
  // if not, display the usage and exit
  console.log('Usage: node server.js {PORT} {FOLDER_TO_SERVE}');
  process.exit(1);
}

// get the port
const port = process.argv[2];
// get the folder
const folder = process.argv[3];
// instantiate express
const app = express();
// Default to WWE UI origins
const corsOrigins = ['http://localhost:7777', 'https://localhost:7777'];

// header middleware
app.use((req, res, next) => {
  if (req.get('origin') && !corsOrigins.includes(req.get('origin'))) {
    corsOrigins.push(req.get('origin'));
  }
  // CORS
  res.header('Access-Control-Allow-Origin', corsOrigins.join(', '));
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Authorization, Origin, Content-Type, Accept');

  // CSP - X-Frame-Options
  // For IE (at least v.11)
  res.header('X-Frame-Options', 'ALLOW-FROM https://localhost:7777, https://localhost:7777');
  // For modern browsers (Chrome / Firefox / EdgeChromium / Safari ...)
  res.header('Content-Security-Policy', "frame-ancestors 'self' https://localhost:7777 http://localhost:7777");
  next();
});

// host the desired folder to '/'
app.use('/', express.static(folder));

// function called at the server start
const listenCallback = (tls) => {
  // display the server URL
  console.log('Serving folder ' + folder + ' on ' + (tls ? 'https' : 'http') + '://localhost:' + port);
}

try {
    // load the certificates (will throw if not found)
    const certs = {
      key: fs.readFileSync(path.join(__dirname, '../../data/certificates/localhost.key.pem')),
      cert: fs.readFileSync(path.join(__dirname, '../../data/certificates/localhost.cert.pem'))
    };
    // create the HTTPS server
    https.createServer(certs, app).listen(port, () => listenCallback(true));
  }
  catch(e) {
    // if the certificates were not found, start the HTTP server
    console.log('Failed to start the HTTPS server, starting with HTTP. \n' + e);

    http.createServer(app).listen(port, () => listenCallback(false));
  }
