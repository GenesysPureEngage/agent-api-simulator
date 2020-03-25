const test = require('ava');
const {testEndpoint} = require('../endpoints');

// authentication
test.serial.before('auth: post /auth/v3/sign-in', t => {
 t.context.username = 'JohnSmith';
 return testEndpoint('/auth/v3/sign-in', 'POST', [200, 302], {username: t.context.username, password: 'JohnSmith', tenant: ''})
   .then((response) =>{
      const match = response.headers.location.match(/start\?code=(.*?)(\&|$)/);
      // if the location url does not contain the login code, fail
      if (!match || match.length <= 1){
        t.fail("Auth failed");
        return;
      }
      // save the code
      t.context.authCode = match[1];
      t.pass();
    })
   .catch((err) => t.fail(err))
})

// get a token from a code
test.serial.before('auth: post /auth/v3/token', t => {
  return testEndpoint('/auth/v3/token', 'POST', [200], {code: t.context.authCode})
    .then((response) =>{
       if (!response || !response.body){
         t.fail("Failed to get the access token");
         return;
       }
       // save the code
       t.context.authToken = response.body.access_token;
       t.pass();
     })
    .catch((err) => t.fail(err))
})

// get the user info
test('auth: get /auth/v3/userinfo', t => {
 return testEndpoint('/auth/v3/userinfo', 'GET', [200], null, t)
   .then(() => t.pass())
   .catch((err) => t.fail(err))
})
