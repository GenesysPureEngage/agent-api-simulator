/**
* The Agent API Simulator is being released under the standard MIT License.
* Copyright (c) 2020 Genesys. All rights reserved.
*/

const express = require('express');
const router = express.Router();
const messaging = require('../controllers/messaging');
const notifications = require('../common/notifications');
const auth = require('../controllers/auth');
const conf = require('../controllers/conf');
const media = require('../controllers/media');
const reporting = require('../controllers/reporting');
const ucs = require('../controllers/ucs');
const workbins = require('../controllers/workbins');

//Start CometD servers
messaging.start();
notifications.start();

router.use('/workspace/v3/notifications', (req, res) => {
  messaging.handle(req, res);
});

router.use('/workspace/v3/notifications/:fn', (req, res) => {
  messaging.handle(req, res);
});

router.use('/workspace/v3/media/:media/interactions/:id/:fn/:id2', (req, res) => {
  ucs.handleContactRequest(req, res);
});

router.use('/workspace/v3/media/:media/interactions/:id/:fn', (req, res) => {
  media.handleInteraction(req, res);
});

router.use('/workspace/v3/media/topics/%3Ctenant-id%3E@%3Cplace%3E/publish', (req, res) => {
  media.handleTopics(req, res);
});

router.use('/workspace/v3/media/:media/interactions/:fn', (req, res) => {
  media.handleInteractionWithoutId(req, res);
});

router.use('/workspace/v3/media/:media/:fn', (req, res) => {
  media.handle(req, res);
});

router.use('/workspace/v3/media/:fn', (req, res) => {
  media.handle(req, res);
});

router.use('/workspace/v3/reporting/:fn/:id', (req, res) => {
  reporting.getStats(req, res);
});

router.use('/workspace/v3/reporting/:fn', (req, res) => {
  reporting.subscribe(req, res);
});

router.use("/workspace/v3/ucs/contacts/:id/:fn", (req, res) => {
  ucs.handleContactRequest(req, res);
});

router.use("/workspace/v3/ucs/contacts/:fn", (req, res) => {
  ucs.handleContactRequest(req, res);
});

router.use('/workspace/v3/ucs/responses/categories/get-root', (req, res) => {
  ucs.handleResponsesCategoriesRoot(req, res);
});

router.use('/workspace/v3/ucs/responses/get-favorites', (req, res) => {
  ucs.handleResponsesFavorites(req, res);
});

router.use('/workspace/v3/ucs/responses/categories/:categoryId/get-details', (req, res) => {
  ucs.handleResponsesCategoriesDetails(req, res);
});

router.use('/workspace/v3/ucs/responses/:standardResponseId/get-details', (req, res) => {
  ucs.handleResponsesDetails(req, res);
});

router.use('/workspace/v3/ucs/responses/:standardResponseId/report-usage', (req, res) => {
  ucs.handleReportUsageForResponsesId(req, res);
});

router.use('/workspace/v3/ucs/responses/:standardResponseId/render-field-codes', (req, res) => {
  ucs.handleRenderFieldCodesForResponsesId(req, res);
});

router.use('/workspace/v3/ucs/responses/search', (req, res) => {
  ucs.handleSearchStandardResponses(req, res);
});

router.use('/workspace/v3/ucs/interactions/:id/get-details', (req, res) => {
  ucs.handleGetInteractionDetails(req, res);
});

router.use('/workspace/v3/ucs/interactions/:id/set-comment', (req, res) => {
  ucs.handleInteractionSetComment(req, res);
});

router.use('/workspace/v3/ucs/interactions/:id/:fn', (req, res) => {
  ucs.handleContactRequest(req, res);
});

router.use('/workspace/v3/ucs/voice/:id/:fn', (req, res) => {
  ucs.handleContactRequest(req, res);
});

router.use('/workspace/v3/ucs/interactions/:fn', (req, res) => {
  ucs.handleContactInteractionRequest(req, res);
});

router.use('/workspace/v3/ucs/:fn', (req, res) => {
  ucs.handleContactRequest(req, res);
});

router.use('/workspace/v3/workbins/interactions/:id/:fn', (req, res) => {
  workbins.handleWorkbinInteraction(req, res);
});

router.use('/workspace/v3/workbins/:id/:fn', (req, res) => {
  workbins.handleWorkbin(req, res);
});

router.use('/workspace/v3/workbins/:fn', (req, res) => {
  workbins.handleWorkbins(req, res);
});

router.use('/workspace/v3/users/:fn1/:fn2/:fn3/:fn4', (req, res) => {
  conf.userUpdate(req, res);
});

router.use('/workspace/v3/users/:fn1/:fn2/:fn3', (req, res) => {
  conf.userUpdate(req, res);
});

router.use('/workspace/v3/users', (req, res) => {
  conf.users(req, res);
});

router.use('/workspace/v3/targets/personal-favorites/:fn/:type/:id', (req, res) => {
  conf.handlePersonalFavorites(req, res);
});

router.use('/workspace/v3/targets/personal-favorites/:fn', (req, res) => {
  conf.handlePersonalFavorites(req, res);
});

router.use('/workspace/v3/targets/personal-favorites', (req, res) => {
  conf.handlePersonalFavorites(req, res);
});

router.use('/workspace/v3/targets', (req, res) => {
  conf.targets(req, res);
});

router.use('/workspace/v3/activate-channels', (req, res) => {
  media.activateChannels(req, res);
});

router.use('/workspace/v3/configuration', (req, res) => {
  conf.configuration(req, res);
});

router.use('/workspace/v3/start', (req, res) => {
  auth.start(req, res);
});

router.use('/workspace/v3/initialize-workspace', (req, res) => {
  conf.initialize(req, res);
});

router.use('/workspace/v3/current-session', (req, res) => {
  messaging.getCurrentSession(req, res);
});

router.use('/workspace/v3/login', (req, res) => {
  auth.login(req, res);
});

router.use('/workspace/v3/version', (req, res) => {
  auth.version(req, res);
});

router.get('/workspace/v3/info', (req, res) => {
  auth.version(req, res);
});

router.use('/workspace/v3/feedback/submit', (req, res) => {
  conf.submitFeedback(req, res);
});

module.exports = router;