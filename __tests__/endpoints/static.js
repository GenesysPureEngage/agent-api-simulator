const test = require('ava');
const {testEndpoint} = require('../endpoints');

const isUnitTest = process.env.NODE_ENV === 'test';

// get the simulator webapp
test('Static: get /', t => {
  return testEndpoint('/', 'GET', [200])
    .then(() => t.pass())
    .catch((err) => t.fail(err))
});

/*
 * Test for internal only. Requires importing ui assets.
 */
if (isUnitTest) {
  // get workspace
  test('Static: get /ui/wwe', t => {
    return testEndpoint('/ui/wwe', 'GET', [200])
      .then(() => t.pass())
      .catch((err) => t.fail(err))
  })

  // get auth-ui
  test('Static: get /auth/sign-in.html', t => {
    return testEndpoint('/auth/sign-in.html', 'GET', [200])
      .then(() => t.pass())
      .catch((err) => t.fail(err))
  })

  // get the second auth-ui route
  test('Static: get /ui/auth/sign-in.html', t => {
    return testEndpoint('/ui/auth/sign-in.html', 'GET', [200])
      .then(() => t.pass())
      .catch((err) => t.fail(err))
  })
}
