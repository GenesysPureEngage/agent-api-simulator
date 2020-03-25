/**
* The Agent API Simulator is being released under the standard MIT License.
* Copyright (c) 2020 Genesys. All rights reserved.
*/

exports.info = (msg) => {
	console.log(new Date(), msg);
}

exports.error = (msg) => {
	console.error(new Date(), msg);
}