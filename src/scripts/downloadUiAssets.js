/**
* The Agent API Simulator is being released under the standard MIT License.
* Copyright (c) 2020 Genesys. All rights reserved.
*/

const request = require('request');
const cliProgress = require('cli-progress');
const unzipper = require('unzipper');
const rimraf = require('rimraf');
const path = require('path');
const fs = require('fs');

// create a new progress bar instance and use shades_classic theme
const downloadProgressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

// load the package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), { encoding: 'utf8' }));

function isUnitTest() {
  // check if this is called from 'ava' or from the package.json
  return (process.argv[1] && process.argv[1].includes('\\ava\\'));
}

async function getVersions(baseUrl) {
  try {
    // get incoming wwe version
    const wweVersion = await getVersion(baseUrl + 'ui/wwe/');
    // get incoming auth ui version
    const authVersion = await getVersion(baseUrl + 'ui/auth/');
    // get local Simulator version from package.json
    const simulatorVersion = packageJson.version;
    console.log("Versions: Simulator", simulatorVersion, ", WWE", wweVersion, ", AuthUi", authVersion);
    return {
      simulator: simulatorVersion,
      wwe: wweVersion,
      authUi: authVersion
    }
  }
  catch (err) {
    console.error("Error catched: ", err);
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
        return
      }
      resolve(file);
    }
    // add 'raw' at the begining of the url
    const rawGithubUrl = packageJson.repository.url.replace('github.com', 'raw.github.com');
    // get the file
    request.get(rawGithubUrl + '/blob/master/compatibility-versions.json', (err, response, body) => {
      // on failure
      if (err || !body || response.statusCode !== 200) {
        if (!isUnitTest()) {
          console.error("WARNING: Failed to get the latest 'compatibility-versions.json'. Unable to check if your Workspace components versions are compatible.")
        }
        const file = loadLocalCompatibilityFile();
        if (!file) {
          reject("Failed to load the compatibility file");
          return
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
    versions.wwe = versionAsNumber(versions.wwe);
    versions.authUi = versionAsNumber(versions.authUi);
    compatibility.map((c) => {
      for (let key in c) {
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
    if (versions.wwe < compatibility[i].WWE || versions.authUi < compatibility[i].AuthUi) {
      reject("Outdated versions");
      return
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
    request.get(url + 'version.json', (err, data, body) => {
      if (err) {
        reject("Version file not found.");
        return
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
    process.stdin.once('data', (chunk) => { resolve(chunk.toString().trim()) })
  }))
}

function parseUrl(url) {
  const urlRegex = /^(.*?)\.(.){1,4}(\/|$)/
  // replace every '\' by '/'
  url.replace('\\', '/');

  const matches = url.match(urlRegex);

  if (matches) {
    url = matches[0]
  }
  // if there is no '/' at the end of the url, add one
  if (url[url.length - 1] !== '/') {
    url += '/'
  }
  return (url);
}

function downloadAndUnzip(url, dest) {
  let totalDownloaded = 0
  let total_bytes = 0
  return (new Promise((resolve, reject) => {
    request.get(url)
      // on error
      .on('error', () => {
        resolve(false)
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
        totalDownloaded += chunk.length
        // update the progress bar
        downloadProgressBar.update(totalDownloaded)
      })
      // on end
      .on('end', () => {
        // Set 100%
        downloadProgressBar.update(total_bytes)
        downloadProgressBar.stop();
      })
      .pipe(unzipper.Extract({ path: dest }).on(('finish'), () => {
        resolve(true);
      }))
  }))
}

function getArchive(baseUrl, installDir) {
  // remove previously installed files
  rimraf.sync(installDir)
  return new Promise((resolve, reject) => {
    // try to download and extract the archive
    console.log("Getting archive from: ", baseUrl + 'archive.zip')
    downloadAndUnzip(baseUrl + 'archive.zip', installDir).then(() => {
      console.log("\nArchive downloaded and installed to ", installDir)
      resolve();
    }).catch((err) => {
      console.error("\nError: Failed to get the archive.")
      reject(err)
    })
  })
}

async function main() {
  // get the user's input
  let url;
  // if the url is not specified in the arguments
  // ask it
  if (process.argv.length <= 2){
    console.log("Enter url of your Workspace platform :")
    url = await getUserInput()
  }
  else{
    // otherwise, take it from the arguemnts
    url = process.argv[2];
  }

  url = parseUrl(url);
  console.log("Downloading from", url)

  try {
    // check versions compatibility
    await exports.checkCompatibility(await getVersions(url));
    // get workspace
    await getArchive(url + 'ui/wwe/', './ui-assets/wwe');
    // get auth ui
    await getArchive(url + 'ui/auth/', './ui-assets/auth');
  }
  catch (err) {
    console.error("Error catched: ", err);
    process.exit(1);
  }
  console.log("\nSuccess !")
  process.exit(0)
}

if (!isUnitTest()) {
  main();
}
