/**
* The Agent API Simulator is being released under the standard MIT License.
* Copyright (c) 2020 Genesys. All rights reserved.
*/

const express = require('express');
const path = require('path');
const router = express.Router();

// host workspace
router.use('/ui/wwe', express.static(path.join(__dirname, '../../../ui-assets/wwe')));
// host auth-ui
router.use('/auth', express.static(path.join(__dirname, '../../../ui-assets/auth')));
// host auth-ui with a different path for compatibility
router.use('/ui/auth', express.static(path.join(__dirname, '../../../ui-assets/auth')));

// host the webapp
router.use('/', express.static(path.join(__dirname, '../../../target/webapp')));

module.exports = router;