/**
* The Agent API Simulator is being released under the standard MIT License.
* Copyright (c) 2020 Genesys. All rights reserved.
*/

const test = require('ava');
const request = require('request');
const {spawn} = require("child_process");
const fs = require('fs');
const path = require('path');

// base url of the server
BASE_URL = null;

// start the server
test.before(t => {
  let port;
  // try to load the server port from the config file
  try {
    port = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/service/config/agent-api-simulator.json'))).port;
  }
  catch(err){
    t.fail(err);
    return;
  }

  // check if the certificates exist
  try{
    fs.readFileSync(path.join(__dirname, '../data/certificates/localhost.cert.pem'));
    // if so, use https
    BASE_URL = 'https://localhost:' + port;
    // allow insecure certificates
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;
  }
  catch(err) {
    // otherwise, use http
    BASE_URL = 'http://localhost:' + port;
  }
  return new Promise((resolve, reject) => {
    t.context.serverProcess = spawn('node', ['./src/service/server.js']);
    // wait 6 seconds to be sure the server is ready to accept requests
    setTimeout(() => {
      resolve();
    }, 6000);
  })
  .then(() => t.pass())
  .catch((err) => t.fail(err))
});

// ENDPOINTS //

exports.testEndpoint = function(endpoint, method, successCodes, requestBody, testObj){
	return new Promise((resolve, reject) => {
    let params = {
      uri: BASE_URL + endpoint,
      method: method
    };
    if (requestBody) {
      params["json"] = requestBody;
    }
    if (testObj){
      if (testObj.context.authCode){
        request.cookie('WWE_CODE=' + testObj.context.authCode)
      }
      if (testObj.context.authToken){
        params["headers"] = {authorization: "token " + testObj.context.authToken}
      }
    }
    request(params, (err, response) => {
        // on error
        if (err){
          reject(JSON.stringify(err));
          return;
        }
        // on wrong exit code
        if (!response || !successCodes.includes(response.statusCode)){
          if (testObj){
            testObj.log(response.body);
          }
          reject("Invalid exit code:" + (response ? response.statusCode: 'unknown'));
          return;
        }
        resolve(response);
    });
  })
}

// authentication
require('./endpoints/auth');

// test the simulator routes
require('./endpoints/simulator');

// test the static routes
require('./endpoints/static');

// cleanup the server
test.after.always("Server cleanup", t => {
  if (!t.context.serverProcess){
    t.pass();
    return;
  }
  return new Promise((resolve, reject) => {
    // kill the process
    t.context.serverProcess.kill();
    // wait a bit to let the process exit
    setTimeout(() => {
      resolve();
    }, 2000)
  })
  .then(() => t.pass())
  .catch((err) => t.fail(err))
})
