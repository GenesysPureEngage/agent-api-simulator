/**
* The Agent API Simulator is being released under the standard MIT License.
* Copyright (c) 2020 Genesys. All rights reserved.
*/

const express = require('express');
const router = express.Router();

// dummy routes for compatibility that return an empty document with code 200
router.get('/ui/wwe/profile.js', (req, res) => res.status(200).json({}))
router.get('/auth/profile.js', (req,res) => res.status(200).json({}))
router.get('/auth/telemetry.js', (req,res) => res.status(200).json({}))
router.get('/auth/host-mapping', (req,res) => res.status(200).json({}))

module.exports = router;