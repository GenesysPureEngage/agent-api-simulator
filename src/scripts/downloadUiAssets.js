/**
* The Agent API Simulator is being released under the standard MIT License.
* Copyright (c) 2020 Genesys. All rights reserved.
*/

const request = require('request');
const cliProgress = require('cli-progress');
const unzipper = require('unzipper');
const path = require('path');
const fs = require('fs-extra');

const requestOptions = {
  agentOptions: {
    rejectUnauthorized: false
  }
};

const isUnitTest = process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'test-light';

const errorMessageVersion = '\n\nIf you can’t upgrade the GWS with a minimum version referenced in the "Compatibility table" \
from https://github.com/GenesysPureEngage/agent-api-simulator, you must use a previous version of the Workspace Agent API \
compatible with your GWS based on the related tag listed here: https://github.com/GenesysPureEngage/agent-api-simulator/tags\n\n';

// create a new progress bar instance and use shades_classic theme
const downloadProgressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

// load the package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), { encoding: 'utf8' }));

function getOutdatedVersionError(component, rawVersion1, rawVersion2) {
  return `Outdated ${component} versions. \n\n+ ${component} '${rawVersion1}' is older than minimum required '${rawVersion2}'. ${errorMessageVersion}`;
}

async function getVersions(baseUrl) {
  try {
    // get incoming wwe version
    const wweVersion = await getVersion(baseUrl + 'ui/wwe/');
    // get incoming auth ui version
    const authVersion = await getVersion(baseUrl + 'ui/auth/');
    // get local Simulator version from package.json
    const simulatorVersion = packageJson.version;

    console.log(' ');
    console.log("Versions: Agent API Simulator", simulatorVersion, ", WWE", wweVersion, ", AuthUi", authVersion);
    return {
      simulator: simulatorVersion,
      wwe: wweVersion,
      authUi: authVersion
    };
  }
  catch (err) {
    console.error("ERROR:", err);
  }
  return (null);
}

async function getVersionsForAzure(wweUrl, authUrl) {
  try {
    // get incoming wwe version
    const wweVersion = await getVersion(wweUrl);
    // get incoming auth ui version
    const authVersion = await getVersion(authUrl);
    // get local Simulator version from package.json
    const simulatorVersion = packageJson.version;
    console.log(' ');
    console.log("Versions: Agent API Simulator", simulatorVersion, ", WWE", wweVersion, ", AuthUi", authVersion);
    return {
      simulator: simulatorVersion,
      wwe: wweVersion,
      authUi: authVersion
    };
  }
  catch (err) {
    console.error("ERROR:", err);
  }
  return (null);
}

function getCompatibilityFile() {
  // load the local compatibilities file
  function loadLocalCompatibilityFile() {
    try {
      const file = JSON.parse(fs.readFileSync(path.join(__dirname, '../../compatibility-versions.json'), { encoding: 'utf8' }));
      return (file);
    }
    catch (err) {
      console.error(err);
      return (null);
    }
  }

  return new Promise((resolve, reject) => {
    // try to get 'compatibility-versions.json' from the master branch of git
    if (!packageJson || !packageJson.repository || !packageJson.repository.url) {
      const file = loadLocalCompatibilityFile();
      if (!file) {
        reject("Failed to load the compatibility file");
        return;
      }
      resolve(file);
      return;
    }
    // add 'raw' at the begining of the url
    const rawGithubUrl = packageJson.repository.url.replace('github.com', 'raw.github.com');
    // get the file
    request.get(rawGithubUrl + '/master/compatibility-versions.json', requestOptions, (err, response, body) => {
      // on failure
      if (err || !body || response.statusCode !== 200) {
        if (!isUnitTest) {
          console.error(`WARNING: Failed to get the latest ${rawGithubUrl + '/master/compatibility-versions.json'}. Unable to check if your Workspace components versions are compatible.`);
        }
        const file = loadLocalCompatibilityFile();
        if (!file) {
          reject("Failed to load the compatibility file");
          return;
        }
        resolve(file);
        return;
      }
      resolve(JSON.parse(body));
    });
  })
}

function versionAsNumber(version) {
  // remove dots
  version = version.split('.').join('');
  // parse to a number
  return (Number(version));
}

// check if dependencies versions are compatible with the simulator
exports.checkCompatibility = function checkCompatibility(versions) {
  return new Promise(async (resolve, reject) => {
    if (!versions || !versions.simulator || !versions.wwe || !versions.authUi) {
      reject("Versions object invalid")
      return;
    }
    // get the compatibility file
    let compatibility = await getCompatibilityFile();
    // convert versions to numbers
    versions.simulator = versionAsNumber(versions.simulator);
    compatibility.forEach(c => {
      c.AgentApiSimulator = versionAsNumber(c.AgentApiSimulator);
    });

    // sort the compatibilities by version of the simulator
    // it should already be the case, but this is an extra security
    compatibility = compatibility.sort((a, b) => {
      if (a.AgentApiSimulator > b.AgentApiSimulator) {
        return 1;
      }
      if (a.AgentApiSimulator < b.AgentApiSimulator) {
        return -1;
      }
      return 0;
    })
    // get the index of the current version of the simulator
    let i = compatibility.findIndex(c => c.AgentApiSimulator === versions.simulator);
    if (i < 0) {
      reject("Simulator version not found in the compatibility table.");
      return;
    }
    // if this versions are older than the minimum required versions
    if (!checkVersion(versions.wwe, compatibility[i].WWE)) {
      reject(getOutdatedVersionError('WWE', versions.wwe, compatibility[i].WWE));
      return;
    }
    if (!checkVersion(versions.authUi, compatibility[i].AuthUi)) {
      reject(getOutdatedVersionError('AuthUI', versions.authUi, compatibility[i].AuthUi));
      return;
    }
    // while the simulator version stays the same
    while (i < compatibility.length && compatibility[i].AgentApiSimulator === versions.simulator) {
      // if this is the last element
      // OR if WWE and AuthUI versions are superior or equal to this element
      //    AND WWE and AuthUI versions are inferio to the next element
      if (i + 1 >= compatibility.length
        || (checkVersion(versions.wwe, compatibility[i].WWE) && checkVersion(versions.authUi, compatibility[i].AuthUi)
          && !checkVersion(versions.wwe, compatibility[i + 1].WWE) && !checkVersion(versions.authUi, compatibility[i + 1].AuthUi))) {
        resolve();
      }
      i++;
    }
    reject("Version not compatible");
  })
}

// get the version of the package and check if its supported
function getVersion(url) {
  return (new Promise((resolve, reject) => {
    console.log("Getting version file from: ", url + 'version.json')
    request.get(url + 'version.json', requestOptions, (err, data, body) => {
      if (err) {
        reject("Version file not found.");
        return;
      }
      if (data.statusCode !== 200) {
        reject("Failed to get the file, response code: " + data.statusCode);
        return;
      }
      let version = JSON.parse(body);
      resolve(version.version);
    })
  }))
}

function checkUrls(baseUrl, path = '') {
  console.log("Getting profile.js file from: ", baseUrl + path);
  return (new Promise((resolve, reject) => {
    request.get(baseUrl + path + 'profile.js', requestOptions, (err, data, body) => {
      if (err) {
        reject("profile.js file not found.");
        return;
      }
      if (data.statusCode !== 200) {
        console.log('Wrong path. Can not get the profile.js');
        resolve('retry');
      }
      const profile = body;
      resolve((profile && profile.includes('window.genesys.wwe.env.GWS_SERVICE_URL')));
    })
  }));
}

function getGwsApiUri(baseUrl) {
  return (new Promise((resolve, reject) => {
    console.log("Getting GWS url from: ", baseUrl)
    return request.get(baseUrl +'profile.js', requestOptions, (err, data, body) => {
      if (err) {
        reject("auth url not found.");
        return;
      }
      if (data.statusCode !== 200) {
        reject("Failed to get the auth url, response code: " + data.statusCode);
        return;
      }
      const profile = body;
      const capturingGroupsRegex = /window.genesys.wwe.env.EXPRESSION_WWE_URL_CAPTURING_GROUPS(_[0-9]+)*='/g;
      const serviceUrlRegex = /window.genesys.wwe.env.GWS_SERVICE_URL(_[0-9]+)*='/g;
      const wweMasks = profile.match(capturingGroupsRegex);
      const authMasks = profile.match(serviceUrlRegex);
      let gwsApiUri;
      for(let i = 0; i < wweMasks.length; i++) {
        const startIndex = profile.indexOf(wweMasks[i]) + wweMasks[i].length;
        const endIndex = profile.indexOf("'", startIndex);
        const wweUriMask = profile.substring(startIndex, endIndex);
        const startIndexAuth = profile.indexOf(authMasks[i]) + authMasks[i].length;
        const endIndexAuth = profile.indexOf("'", startIndexAuth);
        gwsApiUri = profile.substring(startIndexAuth, endIndexAuth);
        const regex2 = new RegExp(wweUriMask);
        const hostData = regex2.exec(baseUrl);
        if (hostData && hostData.length > 2) {
          gwsApiUri = gwsApiUri.replace('$WWE_URL_GROUP_1$', hostData[1]);
          gwsApiUri = gwsApiUri.replace('$WWE_URL_GROUP_2$', hostData[2]);
          break;
        }
      }
      resolve(gwsApiUri);
      
    })
  }))
}
function getAuthURL(gws, url) {
  return (new Promise((resolve, reject) => {
    console.log("Getting auth url from: ", gws);
    return request.get(`${gws}/workspace/v3/login?type=workspace&locale=en-us&include_state=true&redirect_uri=${url}index.html`, requestOptions, (err, data) => {
    const redirects = data.request._redirect.redirects;
    if(!redirects.length) {
      reject('Error: no url from redirect');
    }
    else {
      const authURI = redirects[redirects.length-1].redirectUri.substring(0, redirects[redirects.length-1].redirectUri.indexOf('sign-in.html'));
      resolve(authURI);
    }
  })
  }))
}


function checkVersion(version, compatibilityVersion) {
  const versionsSplitted = version.split('.');
  const compatibilityVersionSplitted = compatibilityVersion.split('.');
  let i = 0;
  while(i < versionsSplitted.length) {
    if (i > compatibilityVersionSplitted.length) {
      return true;
    }
    const versionNumber = +versionsSplitted[i];
    const compatibilityVersionNumber = +compatibilityVersionSplitted[i];
    if (versionNumber > compatibilityVersionNumber) {
      return true;
    }
    if (versionNumber < compatibilityVersionNumber) {
      return false;
    }
    i++;
  }
  if (i < compatibilityVersionSplitted.length) {
    return false;
  }
  return true;
}

function getUserInput() {
  return (new Promise(resolve => {
    process.stdin.once('data', (chunk) => { resolve(chunk.toString().trim()) });
  }))
}

function parseUrl(url) {
  const urlRegex = /^(.*?)\.(.){1,4}(\/|$)/;
  // replace every '\' by '/'
  url.replace('\\', '/');

  const matches = url.match(urlRegex);

  if (matches) {
    url = matches[0];
  }
  // if there is no '/' at the end of the url, add one
  if (url[url.length - 1] !== '/') {
    url += '/';
  }
  return (url);
}

function downloadAndUnzip(url, dest) {
  let totalDownloaded = 0;
  let total_bytes = 0;
  return (new Promise((resolve, reject) => {
    request.get(url, requestOptions)
      // on error
      .on('error', () => {
        resolve(false);
      })
      // on initial response
      .on('response', function (data) {
        // get the incoming size
        total_bytes = parseInt(data.headers['content-length']);
        // init the progress bar
        downloadProgressBar.start(total_bytes, 0);
      })
      // on new chunk of data
      .on('data', (chunk) => {
        // increase the downloaded size
        totalDownloaded += chunk.length;
        // update the progress bar
        downloadProgressBar.update(totalDownloaded);
      })
      // on end
      .on('end', () => {
        // Set 100%
        downloadProgressBar.update(total_bytes);
        downloadProgressBar.stop();
      })
      .pipe(unzipper.Extract({ path: dest }).on(('finish'), () => {
        resolve(true);
      }))
  }))
}

function getArchive(baseUrl, installDir) {
  // remove previously installed files
  fs.removeSync(installDir);
  return new Promise((resolve, reject) => {
    // try to download and extract the archive
    console.log("Getting archive from: ", baseUrl + 'archive.zip');
    downloadAndUnzip(baseUrl + 'archive.zip', installDir).then(() => {
      console.log("\nArchive downloaded and installed to ", installDir);
      resolve();
    }).catch((err) => {
      console.error("\nError: Failed to get the archive.");
      reject(err);
    })
  })
}

function getFile(url, toFile) {
  fs.removeSync(toFile);
  fs.ensureFileSync(toFile);
  let file = fs.createWriteStream(toFile);
  return new Promise((resolve, reject) => {
    console.log('Getting file from: ', url);
    request.get(url, requestOptions)
      .pipe(file)
      .on('finish', () => {
        console.log('File downloaded and installed to ', toFile);
        resolve();
      })
      .on('error', (error) => {
        console.error(`\nError: Failed to get file ${url}.`);
        reject(error);
      })
  })
    .catch(error => {
      console.log(`Something happened: ${error}`);
    });
}

async function main() {
  // get the user's input
  let url;
  let gwsUrl;
  let authUrl;
  let wweUrl;
  // if the url is not specified in the arguments
  // ask it
  if (process.argv.length <= 2) {
    console.log("Enter URL of your Genesys Engage platform:");
    url = await getUserInput();
  }
  else {
    // otherwise, take it from the arguemnts
    url = process.argv[2];
  }

  url = parseUrl(url);
  console.log(' ');
  console.log("Downloading from", url);

  try {
    let isSeparatedUIAndServicePlatform;   
    isSeparatedUIAndServicePlatform = await checkUrls(url);
    if(isSeparatedUIAndServicePlatform === 'retry') {
      isSeparatedUIAndServicePlatform= await checkUrls(url, 'ui/wwe/');
    }
    if (isSeparatedUIAndServicePlatform === true) {
      gwsUrl = await getGwsApiUri(url);
      authUrl = await getAuthURL(gwsUrl, url);
      wweUrl = url;
      await exports.checkCompatibility(await getVersionsForAzure(wweUrl, authUrl), url);
      await getArchive(wweUrl, './ui-assets/wwe');
      await getArchive(authUrl, './ui-assets/auth');
    }
    else {
      // Check versions compatibility
      await exports.checkCompatibility(await getVersions(url), url);
      // Get Workspace Web Edition archive
      await getArchive(url + 'ui/wwe/', './ui-assets/wwe');
      // Get GWS Auth UI archive
      await getArchive(url + 'ui/auth/', './ui-assets/auth');
    }


    // Get SCAPI samples from workspace-development-kit Github repository
    const scapiSampleDir = packageJson['workspace-development-kit']['scapi-samples']['dir'];
    const scapiSampleFiles = packageJson['workspace-development-kit']['scapi-samples']['files'];
    await Promise.all(scapiSampleFiles.map(async (scapiFile) => {
      await getFile(scapiSampleDir + scapiFile, `./ui-assets/samples/scapi/${scapiFile}`);
    }));
    // Get Toolkit samples from workspace-development-kit Github repository
    const toolkitSampleDir = packageJson['workspace-development-kit']['toolkit-samples']['dir'];
    const toolkitSampleFiles = packageJson['workspace-development-kit']['toolkit-samples']['files'];
    await Promise.all(toolkitSampleFiles.map(async (toolkitFile) => {
      await getFile(toolkitSampleDir + toolkitFile, `./ui-assets/samples/toolkit/${toolkitFile}`);
    }));
  } catch (err) {
    console.error("=====\nERROR:", err);
    process.exit(1);
  }
  console.log("\nSuccess !");
  process.exit(0);
}

if (!isUnitTest) {
  main();
}
