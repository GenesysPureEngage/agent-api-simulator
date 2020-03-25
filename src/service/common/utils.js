/**
* The Agent API Simulator is being released under the standard MIT License.
* Copyright (c) 2020 Genesys. All rights reserved.
*/

const _ = require('underscore');
const fs = require('fs');
const path = require('path');

const log = require('./log');
const fileTransforms = require('./file-transform');

var filesListeners = {};

/**
 * Monitors the given file for changes (fileModulePath).
 * When updated will update the require cache and execute the provided onUpdate function
 * so the caller can update references or perform any other necessary updates.
 * 
 * Can also apply handle file transformations. For example, some files are more easily used in yaml format.
 * This method will automatically generate these converted/transformed files if they don't already exist. It
 * will also handle reading these transformed contents and converting them back to their expected formats.
 * @see fileTransforms
 */
exports.requireAndMonitor = (fileModulePath, onUpdate, modulePath = __dirname) => {
    var file = path.resolve(modulePath, fileModulePath);

    //debounce update handler - a single update can trigger multiple events
    var update = _.debounce(function(filename, watchedFile) { 
        log.info(`file ${filename} changed`);
        if(require.resolve(watchedFile)) {
            try {
                delete require.cache[require.resolve(watchedFile)];
                //Invoke all file change listeners
                for(var listener of filesListeners[file]) {
                    listener(requireFile(watchedFile));                   
                }
              } catch(error) {
                log.error(`Error loading changes in ${filename}: ${error}`);
              }
        }
    },300);

    // check if the requested file exist
    if(!fs.existsSync(file)) {
        log.error(`File ${file} not found.`);
    }

    if(!filesListeners[file]) {
        filesListeners[file] = [];
        fs.watch(file, (event, filename) => {
            if (filename) {
                update(filename, file);
            }
        });
    }
    //Add update handler/callback
    filesListeners[file].push(onUpdate);

    return requireFile(file);
}

/**
 * Handles require(ing) files. Some files may need special read transformations to be
 * applied.
 */
requireFile = (file) => {
    var transform = fileTransforms.getFileTransformer(file);
    if(transform) {
        return transform.readFile();
    } else {
        return require(file);
    }
}

/**
 * For KV lists.
 * Add a new item to the specified array, or update the existing
 * KV pair if the key matches an existing entry.
 */
exports.createOrUpdate = (array, obj) => {
    var index = array.findIndex((e) => e.key === obj.key);

    if (index === -1) {
        array.push(obj);
    } else {
        array[index] = obj;
    }
}

exports.s4 = () => {
  return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
};
exports.id = () => {
  return (
    exports.s4() +
    exports.s4() +
    exports.s4() +
    exports.s4()
  ).toLowerCase();
};

exports.sendOkStatus = (req, res, id) => {
  res.send(JSON.stringify({
    status: {
      code: 1
    },
    operationId: req.body && req.body.operationId ? req.body.operationId : exports.id()
  }));
}

exports.sendFailureStatus = (res, status) => {
  res.sendStatus(status);
}
