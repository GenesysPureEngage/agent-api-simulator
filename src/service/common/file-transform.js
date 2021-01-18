/**
* The Agent API Simulator is being released under the standard MIT License.
* Copyright (c) 2020 Genesys. All rights reserved.
*/

/**
 * Provides functionality to allow for transforming the data files used by the simulator.
 * The format of example data files used is not necesarily a convenient format for simulator users to manipulate.
 * We can transform these source data files to simpler structure and formats for use with the simulator. Transformed
 * files are temporary and not tracked by source control in order to maintain the integrity of the source files. When
 * reading the temporary files we can convert them back to their original format internally so that the simulator remains
 * compatible with the systems it is designed to mock/emulate.
 */
const _ = require('underscore');
const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');
const yaml = require('yaml');

/**
 * Used to specify a series of transformations associated with a particular "source file".
 * Can be used to transform a source file into a different structure and/or format. For example, filtering data etc.
 * "filename" field is the name of the transformed source file. Assumes this file can be required
 * -In this implementation transformed source files are written to a "target" folder, so that original source files are untouched
 * Both write transforms and read transforms can be specified.
 * -Write transforms are applied when converting source file -> filename
 * -Read transforms are applied when requiring filename
 */
class DataFileTransformer {
    /**
     * @param {*} sourceFile Source file to read from before applying transforms
     * @param {*} writeTransforms Transforms to use when transforming the source file
     * @param {*} readTransforms Transforms to use when reading the transformed file
     * @param {*} readSource Function used to read data initially. Default will require source file
     */
    constructor(sourceFile, writeTransforms, readTransforms, readSource = this.readSourceData) {
        this.sourceFilePath = sourceFile;
        this.sourceFile = path.join(__dirname, sourceFile);
        this.writeTransforms = writeTransforms;
        this.readTransforms = readTransforms;
        this.outputFile;
        this.data = readSource(this.sourceFile);
    }

    readSourceData(file) {
        if(fs.existsSync(file)) {
            return require(file);
        }
    }

    get filename() {
        return path.join(__dirname, this.sourceFilePath);
    }

    applyWriteTransforms() {
        _.forEach(this.writeTransforms, (t) => {
            this.data = t(this.data, this);
        });
    }

    applyReadTransforms(data) {
        this.data = data;
        _.forEach(this.readTransforms, (t) => {
            this.data = t(this.data, this);
        });
    }

    writeFile() {
        this.applyWriteTransforms();
        //GAPI-14995: Using fs-extra since this handles platform (Windows/MacOS) specific errors when making directories
        fse.mkdirpSync(path.dirname(this.filename));
        fs.writeFileSync(this.filename, this.data, 'utf8');
    }

    readFile() {
        var rawData = require(this.filename);
        this.applyReadTransforms(rawData);
        return this.data;
    }
}

/**
 * Extends default DataFileTransformer.
 * Renames output files to .yaml extension.
 * Since .yaml files cannot be required, has logic to read file contents manually
 * and add the parsed files to the require cache.
 */
class YamlTransformer extends DataFileTransformer {
    constructor(sourceFile, writeTransforms, readTransforms) {
        super(sourceFile, writeTransforms, readTransforms, (file) => {});
    }

    get filename() {
        //Rename to .yaml extension
        return super.filename.replace(path.extname(super.filename), ".yaml")
    }

    readFile() {
        //Need to update require cache since we can't require a yaml file directly
        require.cache[require.resolve(this.filename)] = { exports: readFromYaml(fs.readFileSync(this.filename, 'utf8')) };
        return super.readFile();
    }
}

/**
 * Some transform methods for manipulating data files
 */

writeToYaml = (objData) => {
    return yaml.stringify(objData);
}

readFromYaml = (rawData) => {
    try {
        return yaml.parse(rawData);
    } catch (err) {
        console.error(err.name + ':' + err.message);
        return {};
    }
}

readRawData = (file) => {
    if(fs.existsSync(file)) {
        return fs.readFileSync(file, null, 'utf-8');
    }
}

prettyPrintJSON = (objData) => {
    return JSON.stringify(objData, 'undefined', 2);
}

flattenKVListData = (settings) => {
    var settingsObjects = {};
    for(var setting of settings) {

        //Base case: a simple "key": "value" pair
        if(setting.type === "str") {
            settingsObjects[setting.key] = setting.value;
        } else if(setting.type === "kvlist") {
            //Otherwise recursively expand kvlist values
            settingsObjects[setting.key] = flattenKVListData(setting.value);
        }
    }
    return settingsObjects;
}

const expandKVListData = (settingsObject) => {
    var settingsArray = [];
    for(var setting of Object.keys(settingsObject)) {
        //Base case: a simple "key": "value" pair
        var settingValue = settingsObject[setting];
        if(typeof settingValue  === "string") {
            settingsArray.push({ "key": setting, "type": "str", "value": settingValue });
        } else if(typeof settingValue === "number") {
            settingsArray.push({ "key": setting, "type": "int", "value": settingValue });
        } else if(typeof settingValue === "object") {
            //Otherwise recursively expand kvlist values
            settingsArray.push({ "key": setting, "type": "kvlist", "value": expandKVListData(settingValue) });
        }
    }
    return settingsArray;
}
exports.expandKVListData = expandKVListData;

simplifyKvlists = (file) => {
  function expendValueArray(element){
    // if the element is invalid
    if (!element || Object.keys(element).length === 0){
      return
    }
    // add new keys
    element.key = Object.keys(element)[0]
    element.type = "str"
    element.value = element[Object.keys(element)[0]]
    // remove the original key
    delete element[Object.keys(element)[0]]
  }
  function handleUserProperties(up) {
    _.each(up, (el) => {
      for (let elkey in el) {
        _.each(el[elkey], (el2) => {
          expendValueArray(el2);
        });
        el.key = elkey;
        el.type = 'kvlist';
        el.value = el[elkey];
        delete el[elkey];
      }
    });
  }
  function getEveryObject(key, obj){
    if (key === 'userProperties' || key === 'userData') {
        handleUserProperties(obj);
        return
    }
    if (Array.isArray(obj)){
      obj.forEach((el) => {
        getEveryObject(null, el)
      })
      return
    }
    for (let key in obj){
      if (typeof(obj[key]) === 'object'){
        getEveryObject(key, obj[key])
      }
    }
  }
  getEveryObject(null, file)
  return (file)
}

simplifyUserData = (file) => {
    if (file && file.userData) {
        file = file.userData;
    }
    return (file);
}

//Register file transformations for particular data files.
var fileTransformers = [
    //Capabilities is a js file, so we need to read its contents directly rather than parsing it to an object
    new YamlTransformer('../../../data/voice/capabilities.yaml', [writeToYaml]),
    new YamlTransformer('../../../data/cluster-options.yaml', [flattenKVListData, writeToYaml], [expandKVListData]),
    new YamlTransformer('../../../data/media/attached-data.yaml', [flattenKVListData, writeToYaml], [simplifyUserData]),
    new YamlTransformer('../../../data/voice/extensions.yaml', [flattenKVListData, writeToYaml], [expandKVListData]),
    new YamlTransformer('../../../data/route-points.yaml', [writeToYaml]),
    new YamlTransformer('../../../data/interaction-queues.yaml', [writeToYaml]),
    new YamlTransformer('../../../data/ucs/contacts.yaml', [writeToYaml]),
    new YamlTransformer('../../../data/ucs/contact-interactions.yaml', [writeToYaml]),
    new YamlTransformer('../../../data/ucs/contact-interactions-details.yaml', [writeToYaml]),
    new YamlTransformer('../../../data/ucs/lucene-indexes.yaml', [writeToYaml]),
    new YamlTransformer('../../../data/action-codes.yaml', [writeToYaml], [simplifyKvlists]),
    new YamlTransformer('../../../data/agent-groups.yaml', [writeToYaml]),
    new YamlTransformer('../../../data/business-attributes.yaml', [writeToYaml], [simplifyKvlists]),
    new YamlTransformer('../../../data/environment.yaml', [writeToYaml]),
    new YamlTransformer('../../../data/statistic-profiles.yaml', [writeToYaml]),
    new YamlTransformer('../../../data/transactions.yaml', [writeToYaml], [simplifyKvlists]),
    new YamlTransformer('../../../data/agents.yaml', [writeToYaml], [simplifyKvlists]),
    new YamlTransformer('../../../data/places.yaml', [writeToYaml], [simplifyKvlists]),
    new YamlTransformer('../../../data/personal-favorites.yaml', [writeToYaml], [simplifyKvlists]),
    new YamlTransformer('../../../data/ucs/standard-responses-root.yaml', [writeToYaml]),
    new YamlTransformer('../../../data/ucs/standard-responses-category-details.yaml', [writeToYaml]),
    new YamlTransformer('../../../data/ucs/standard-responses-details.yaml', [writeToYaml]),
    new YamlTransformer('../../../data/ucs/workbins.yaml', [writeToYaml]),
    new YamlTransformer('../../../data/outbound/campaigns.yaml', [writeToYaml]),
    new YamlTransformer('../../../data/outbound/pull-preview.yaml', [writeToYaml]),
    new YamlTransformer('../../../data/outbound/calling-list.yaml', [writeToYaml]),
    new YamlTransformer('../../../data/open-media/workbins.yaml', [writeToYaml]),
    new YamlTransformer('../../../data/open-media/media-management.yaml', [writeToYaml])
];

exports.getFileTransformer = (file) => {
    var transform = _.find(fileTransformers, (t) => {
        return t.filename === file;
    });
    return transform;
}

exports.getFileTransformerBySourceFile = (sourceFile) => {
    var transform = _.find(fileTransformers, (t) => {
        return t.sourceFile === sourceFile;
    });
    return transform;
}
