const test = require('ava');
const { testEndpoint } = require('../endpoints');

const isUnitTest = process.env.NODE_ENV === 'test';

/*
 * Test for internal only. Requires importing ui assets.
 */
if (isUnitTest) {
  // get the workspace redirection
  test('Simulator: get /sim/workspace-ui', t => {
    return testEndpoint('/sim/workspace-ui', 'GET', [200])
      .then(() => t.pass())
      .catch((err) => t.fail(err))
  })
}

test('Simulator: get /sim/is-toolkit-sample', t => {
  return testEndpoint('/sim/is-toolkit-sample', 'GET', [200])
    .then(() => t.pass())
    .catch((err) => t.fail(err))
})

test('Simulator: post /sim/manage/voice/create-voice-mail', t => {
  return testEndpoint('/sim/manage/voice/create-voice-mail', 'POST', [200], {
    agent: t.context.username,
    newmessages: 1,
    oldmessages: 2,
    groupName: null
  })
    .then(() => t.pass())
    .catch((err) => t.fail(err))
})

test('Simulator: post /sim/manage/email/create-email', t => {
  return testEndpoint('/sim/manage/email/create-email', 'POST', [200], {
    agent: t.context.username,
    from: 'ava@mail.dom',
    to: 'emailserver@mail.dom',
    subject: 'unit-test',
    content: 'hello test'
  })
    .then(() => t.pass())
    .catch((err) => t.fail(err))
})

test('Simulator: post /sim/manage/voice/create-call', t => {
  return testEndpoint('/sim/manage/voice/create-call', 'POST', [200], {
    agent: 'JohnSmith',
    callType: 'Internal',
    orig: '+332980255555',
    defaultAttachedData: []
  })
    .then(() => t.pass())
    .catch((err) => t.fail(err))
})

test('Simulator: post /sim/manage/workitem/create-workitem', t => {
  return testEndpoint('/sim/manage/workitem/create-workitem', 'POST', [200], {
    agent: 'JohnSmith',
    fn: 'FN',
    ln: 'LN',
    email: 'genesys@mail.dom',
    subject: 'Hello test'
  })
    .then(() => t.pass())
    .catch((err) => t.fail(err))
})

test('Simulator: get /sim/monitor/get-sessions', t => {
  return testEndpoint('/sim/monitor/get-sessions', 'GET', [200])
    .then(() => t.pass())
    .catch((err) => t.fail(err))
})

test('Simulator: get /sim/monitor/get-interactions', t => {
 return testEndpoint('/sim/monitor/get-interactions?agent=JohnSmith', 'GET', [200, 400])
   .then(() => t.pass())
   .catch((err) => t.fail(err))
})

test('Simulator: get /sim/monitor/get-ixn-user-data', t => {
 return testEndpoint('/sim/monitor/get-ixn-user-data?id=444444444', 'GET', [400])
   .then(() => t.pass())
   .catch((err) => t.fail(err))
})