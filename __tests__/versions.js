/**
* The Agent API Simulator is being released under the standard MIT License.
* Copyright (c) 2020 Genesys. All rights reserved.
*/

const test = require('ava');
const script = require('../src/scripts/downloadUiAssets');

// test an exact version
test('exact_version', t => {
  return script.checkCompatibility({
    wwe: '9.0.000.65.7169',
    authUi: '9.0.000.28.174',
    simulator: '1.0.1'
  }).then(() => {
    t.pass();
  }).catch((err) => {
    t.fail(err);
  })
})

// test an intermediate version
test('intermediate_version', t => {
  return script.checkCompatibility({
    wwe: '9.0.000.65.7170',
    authUi: '9.0.000.28.174',
    simulator: '1.0.1'
  }).then(() => {
    t.pass();
  }).catch((err) => {
    t.fail(err);
  })
})

// outdated tests //

// try an outdated version of authUi
test('authUi_outdated_version', t => {
  return script.checkCompatibility({
    wwe: '9.0.000.65.7099',
    authUi: '9.0.000.17.173',
    simulator: '1.0.1'
  }).then(() => {
    t.fail("Should not have succeded");
  }).catch((err) => {
    t.pass();
  })
})

// try an outdated version of wwe
test('wwe_outdated_version', t => {
  return script.checkCompatibility({
    wwe: '9.0.000.64.7099',
    authUi: '9.0.000.27.173',
    simulator: '1.0.1'
  }).then(() => {
    t.fail("Should not have succeded");
  }).catch((err) => {
    t.pass();
  })
})

// try an outdated version of wwe and authui
test('wwe_authUi_outdated_version', t => {
  return script.checkCompatibility({
    wwe: '9.0.000.60.7099',
    authUi: '9.0.000.17.173',
    simulator: '1.0.1'
  }).then(() => {
    t.fail("Should not have succeded");
  }).catch((err) => {
    t.pass();
  })
})

// try an outdated version of the simulator
test('simulator_outdated_version', t => {
  return script.checkCompatibility({
    wwe: '9.0.000.64.7099',
    authUi: '9.0.000.27.173',
    simulator: '0.0.9'
  }).then(() => {
    t.fail("Should not have succeded");
  }).catch((err) => {
    t.pass();
  })
})

// Tests future unsupported versions //

// try a future unsupported version of the simulator
test('simulator_future_unsupported_version', t => {
  return script.checkCompatibility({
    wwe: '9.0.000.64.7099',
    authUi: '9.0.000.27.173',
    simulator: '10.0.9'
  }).then(() => {
    t.fail("Should not have succeded");
  }).catch((err) => {
    t.pass();
  })
})
