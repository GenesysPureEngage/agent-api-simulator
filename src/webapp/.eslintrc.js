module.exports = {
  root: true,
  env: {
    // this section will be used to determine which APIs are available to us
    // (i.e are we running in a browser environment or a node.js env)
    node: true,
    browser: true
  },
  parserOptions: {
    parser: "babel-eslint",
    // specifying a module sourcetype prevent eslint from marking import statements as errors
    sourceType: "module"
  },
  extends: [
    // use the recommended rule set for both plain javascript and vue
    "plugin:vue/recommended"
  ],
  rules: {
      "no-console": "off",
      "vue/component-name-in-template-casing": "off"
  }
}