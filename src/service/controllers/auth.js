/**
* The Agent API Simulator is being released under the standard MIT License.
* Copyright (c) 2020 Genesys. All rights reserved.
*/

const conf = require('./conf');
const reporting = require('./reporting');
const messaging = require('./messaging');
const notifications = require('../common/notifications');
const utils = require('../common/utils');
const config = require("../config/agent-api-simulator.json");
const fs = require("fs");
const path = require("path");
const jwt = require('jsonwebtoken');

var users = utils.requireAndMonitor('../../../data/agents.yaml', (updated) => {
	conf.handleUserUpdate(users, updated);
});

var port = config.port;
var sessions = {}; // code -> user name
var tokens = {}; // token -> user name

const userByCode = function (req, code) {
	if (code) {
		return sessions[code];
	} else {
		code = req.cookies && req.cookies.WWE_CODE ? req.cookies.WWE_CODE : null;
		return sessions[code];
	}
};

exports.login = (req, res) => {
	var redirectUrl = req.protocol + '://' + req.hostname + ':' + port + '/auth/v3/oauth/authorize?type=workspace&redirect_uri=' + req.query.redirect_uri;
	res.status(302);
	res.set('Location', redirectUrl);
	res.end();
}

exports.authorize = (req, res) => {
	var redirectUrl = req.protocol + '://' + req.hostname + ':' + port + '/auth/sign-in.html?type=workspace';
	var userName = userByCode(req);
	if (userName) {
		var uri = req.cookies.WWE_URI ? req.cookies.WWE_URI : req.body.wweURI;
		redirectUrl = uri + '?code=' + req.cookies.WWE_CODE;
	}
	res.status(302);
	res.set('Location', redirectUrl);
	res.cookie('WWE_URI', req.query.redirect_uri, {
    httpOnly: true,
    secure: req.protocol === 'https',
    sameSite: (req.protocol === 'https') ? 'none' : 'lax'
  });
	res.end();
}

exports.token = (req, res) => {
	var userName = userByCode(req, req.body.code);
	if (userName) {
		const access_token = conf.id();
		tokens[access_token] = userName;
		res.set({ 'Content-type': 'application/json' });
		var data = {
			access_token: access_token
		};
		res.send(JSON.stringify(data));
	} else {
		res.status(403);
		res.end();
	}
}


exports.pcToken = (req, res) => {
	const access_token = conf.id();
	res.set({ 'Content-type': 'application/json' });
	var data = {
		status: {
			code: 0
		},
		data: {
			access_token,
			expires_in: 1800
		}
	};
	res.send(JSON.stringify(data));
}

exports.jwToken = (req, res) => {
	const token = jwt.sign({ username: userByCode(req) }, 'secret');
	res.set({ 'Content-type': 'application/json' });
	var data = {
		status: {
			code: 0
		},
		data: {
			access_token: token,
			expires_in: 1800
		}
	};
	res.send(JSON.stringify(data));
}

exports.validateToken = (req, res) => {
	const access_token = conf.id();
	if (req.body.grant_type === 'urn:ietf:params:oauth:grant-type:jwt-bearer') {
		const decoded = jwt.verify(req.body.assertion, 'secret');
		tokens[access_token] = decoded.username;
		res.set({ 'Content-type': 'application/json' });
		var data = {
			access_token,
			expires_in: 1800,
			user: {
				cmeUserName: decoded.username
			}
		};
		res.send(JSON.stringify(data));
	} else if (req.body.grant_type === 'password') {
		tokens[access_token] = req.body.username;
		res.set({ 'Content-type': 'application/json' });
		var data = {
			access_token,
			expires_in: 1800,
			user: {
				cmeUserName: req.body.username
			}
		};
		res.send(JSON.stringify(data));
	}
}
exports.userinfo = (req, res) => {
	const bearer = req.headers.authorization.split(' ')[1];
	const userName = tokens[bearer];
	if (userName) {
		var user = conf.userByName(userName);
		user.cmeUserName = userName;
		user.properties = {
			tenantDBID: user.tenantDBID,
			firstName: user.firstName,
			lastName: user.lastName
		};
		user.loginName = userName;
		res.set({ 'Content-type': 'application/json' });
		res.send(JSON.stringify(user));
	} else {
		res.status(403).end();
	}
}

exports.authenticate = (req, res) => {
	res.set({ 'Content-type': 'application/json' });
	var data = {
		status: {
			code: 0
		},
		data: {
			scheme: 'basic'
		}
	};
	res.send(JSON.stringify(data));
}

exports.signin = (req, res) => {
	var redirectUrl = req.protocol + '://' + req.hostname + ':' + port + '/auth/sign-in.html?error&type=workspace';
	var username = (req.body.username || '').split('\\');
	if (username.length === 1) {
		username = [req.body.tenant, req.body.username];
	}
	var tenant = username.length ? username[0] : null;
	username = username.length ? username[1] : null;
	if (users[username]) {
		var user = users[username];
		if (user && user.tenant === tenant && user.password === req.body.password) {
			var code = conf.s4();
			sessions[code] = username;
			notifications.notifySessions(sessions);
			var uri = req.cookies.WWE_URI ? req.cookies.WWE_URI : req.body.wweURI;
			redirectUrl = req.protocol + '://' + req.hostname + ':' + port + '/workspace/v3/start?code=' + code + '&redirect_uri=' + uri;
		}
	}
	res.status(302);
	res.set('Location', redirectUrl);
	res.end();
}

exports.start = (req, res) => {
	var redirectUrl = req.query.redirect_uri;
	redirectUrl += '?code=' + req.query.code
	res.status(302);
	res.set('Location', redirectUrl);
	res.cookie('WWE_CODE', req.query.code, {
    httpOnly: true,
    secure: req.protocol === 'https',
    sameSite: (req.protocol === 'https') ? 'none' : 'lax'
  });
	res.end();
}

exports.userByCode = userByCode;

exports.logout = (req, res) => {
	var code = req.cookies && req.cookies.WWE_CODE ? req.cookies.WWE_CODE : null;
	if (code) {
		reporting.unsubscribe(sessions[code]);
		messaging.removeSession(code);
		delete sessions[code];
		notifications.notifySessions(sessions);
	}
	var redirectUrl = req.query.redirect_uri;
	res.status(302);
	res.set('Location', redirectUrl);
	res.end();
}

exports.version = (req, res) => {
	var userName = userByCode(req, req.body.code);
	if (userName) {
		// fetch workspace version from the ui-assets
		fs.readFile(path.join(__dirname, "../../../ui-assets/wwe/version.json"), { encoding: 'utf8' }, (err, data) => {
			if (err) {
				res.status(500).json({ message: 'Unknown version' });
			} else {
				res.status(200).json(JSON.parse(data));
			}
		})
	}
	else {
		res.status(403);
		res.send(JSON.stringify({
			status: {
				code: 603,
				message: 'Unauthorized'
			}
		}));
	}
};
