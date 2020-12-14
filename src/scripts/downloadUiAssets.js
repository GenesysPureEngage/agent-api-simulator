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
exports.checkCompatibility = function checkCompatibility(versions, url) {
  return new Promise(async (resolve, reject) => {
    if (!versions || !versions.simulator || !versions.wwe || !versions.authUi) {
      reject("Versions object invalid")
      return;
    }
    // get the compatibility file
    let compatibility = await getCompatibilityFile();

    // convert versions to numbers
    versions.simulator = versionAsNumber(versions.simulator);
    versions.wweRaw = versions.wwe;
    versions.authUiRaw = versions.authUi;
    versions.wwe = versionAsNumber(versions.wwe);
    versions.authUi = versionAsNumber(versions.authUi);
    compatibility.map((c) => {
      for (let key in c) {
        c[`${key}Raw`] = c[key];
        c[key] = versionAsNumber(c[key]);
      }
    })

    // sort the compatibilities by version of the simulator
    // it should already be the case, but this is an extra security
    compatibility = compatibility.sort((a, b) => {
      if (a.AgentApiSimulator > b.AgentApiSimulator) {
        return (1);
      }
      else if (a.AgentApiSimulator < b.AgentApiSimulator) {
        return (-1);
      }
      else {
        return (0);
      }
    })
    // get the index of the current version of the simulator
    let i = compatibility.findIndex((c) => c.AgentApiSimulator === versions.simulator);
    if (i < 0) {
      reject("Simulator version not found in the compatibility table.");
      return;
    }
    // if this versions are older than the minimum required versions
    if (versions.wwe < compatibility[i].WWE) {
      reject(getOutdatedVersionError('WWE', versions.wweRaw, compatibility[i].WWERaw));
      return;
    }
    if (versions.authUi < compatibility[i].AuthUi) {
      reject(getOutdatedVersionError('AuthUI', versions.authUiRaw, compatibility[i].AuthUiRaw));
      return;
    }
    // while the simulator version stays the same
    while (i < compatibility.length && compatibility[i].AgentApiSimulator === versions.simulator) {
      // if this is the last element
      // OR if WWE and AuthUI versions are superior or equal to this element
      //    AND WWE and AuthUI versions are inferio to the next element
      if (i + 1 >= compatibility.length
        || (versions.wwe >= compatibility[i].WWE && versions.authUi >= compatibility[i].AuthUi
          && versions.wwe < compatibility[i + 1].WWE && versions.authUi < compatibility[i + 1].AuthUi)) {
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

function getUserInput() {
  return (new Promise((resolve, reject) => {
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
    // Check versions compatibility
    await exports.checkCompatibility(await getVersions(url), url);
    // Get Workspace Web Edition archive
    await getArchive(url + 'ui/wwe/', './ui-assets/wwe');
    // Get GWS Auth UI archive
    await getArchive(url + 'ui/auth/', './ui-assets/auth');
    // Get SCAPI samples from workspace-development-kit Github repository
    const scapiSampleDir = packageJson['workspace-development-kit']['scapi-samples']['dir'];
    const scapiSampleFiles = packageJson['workspace-development-kit']['scapi-samples']['files'];
    await Promise.all(scapiSampleFiles.map(async (scapiFile) => {
      await getFile(scapiSampleDir + scapiFile, `./ui-assets/samples/scapi/${scapiFile}`);
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
