/**
* The Agent API Simulator is being released under the standard MIT License.
* Copyright (c) 2020 Genesys. All rights reserved.
*/

const _ = require('underscore');
const conf = require('./conf');
const media = require('./media');
const messaging = require('./messaging');
const utils = require('../common/utils');

let luceneIndexes = utils.requireAndMonitor('../../../data/ucs/lucene-indexes.yaml', (updated) => { luceneIndexes = updated; });
let standardResponsesRoot = utils.requireAndMonitor('../../../data/ucs/standard-responses-root.yaml', updated => { standardResponsesRoot = updated });
let standardResponsesCategoryDetails = utils.requireAndMonitor('../../../data/ucs/standard-responses-category-details.yaml', updated => { standardResponsesCategoryDetails = updated });
let standardResponsesDetails = utils.requireAndMonitor('../../../data/ucs/standard-responses-details.yaml', updated => { standardResponsesDetails = updated });
let contacts = utils.requireAndMonitor('../../../data/ucs/contacts.yaml', updated => { contacts = updated });
let contactInteractions = utils.requireAndMonitor('../../../data/ucs/contact-interactions.yaml', updated => { contactInteractions = updated });
let contactInteractionsDetails = utils.requireAndMonitor('../../../data/ucs/contact-interactions-details.yaml', updated => { contactInteractionsDetails = updated });

exports.handleContactRequest = (req, res) => {
	makeUCSRequest(req, res, req.params.fn);
}

exports.handleContactInteractionRequest = (req, res) => {
	let methodName = req.params.fn;
	if (methodName === 'search') {
		methodName = 'search-interactions';
	}
	makeUCSRequest(req, res, methodName);
}

exports.handleGetInteractionDetails = (req, res) => {
	makeUCSRequest(req, res, 'get-interaction-details');
}

makeUCSRequest = (req, res, methodName) => {
	res.set({ 'Content-type': 'application/json' });
	switch (methodName) {
		case 'search':
			searchContacts(req, res);
			break;
		case 'get-details':
			getContactDetails(req, res);
			break;
		case 'delete':
			deleteContact(req, res);
			break;
		case 'create':
			createContact(req, res);
			break;
		case 'update':
			updateContact(req, res);
			break;
		case 'get-history':
			retrieveContactHistory(req, res);
			break;
		case 'get-lucene-indexes':
			getLuceneIndexes(req, res);
			break;
		case 'get-agent-history':
		case 'search-interactions':
			retrieveInteractionHistory(req, res);
			break;
		case 'identify-contact':
			identifyContact(req, res);
			break;
		case 'find-or-create':
			findOrCreatePhoneCall(req, res);
			break;
		case 'set-call-completed':
			setCallCompleted(req, res);
			break;
		case 'assign-contact':
			assignContact(req,res);
			break;
		case 'get-interaction-details':
			getInteractionDetails(req, res);
			break;
		case 'attachments': case 'remove-attachment':
			media.handleAttachments(req, res);
			break;
		default:
			utils.sendFailureStatus(res, 501);
			break;
	}
}

getInteractionDetails = (req, res) => {
	utils.sendOkStatus(req, res);
	const interactionId = req.params.id;
	var matchingInteraction = _.find(contactInteractionsDetails, (interaction) => {
		return interaction.interactionId === interactionId;
	});
	this.publishUcsEvent(req, 'EventGetInteractionContent', {
		interactionId: interactionId,
		interaction: matchingInteraction ? matchingInteraction.interaction : {}
	});
}

exports.handleInteractionSetComment = (req, res) => {
	utils.sendOkStatus(req, res);
	const interactionId = req.params.id;
	this.publishUcsEvent(req, 'EventUpdateInteraction', {
		interactionId: interactionId
	});
}

getLuceneIndexes = (req, res) => {
	utils.sendOkStatus(req, res);
	this.publishUcsEvent(req, 'EventGetIndexProperties', { indexes: luceneIndexes });
}

searchContacts = (req, res) => {
	const searchedQuery = req.body.data.query;
	let searchedTerm = searchedQuery.substring(searchedQuery.indexOf(':') + 1, searchedQuery.indexOf('*'));
	if (searchedTerm.indexOf('\\') === 0) {
		searchedTerm = searchedTerm.substring(1);
	}
	searchedTerm = searchedTerm.toLowerCase();
	utils.sendOkStatus(req, res);
	let matchingContacts = [];
	_.each(contacts, (contact) => {
		const isMatchingPhoneNumber = contact.phoneNumbers && contact.phoneNumbers.find((phoneNumber) => {
			return phoneNumber.indexOf(searchedTerm) === 0;
		});
		const isMatchingEmailAddress = contact.emailAddresses && contact.emailAddresses.find((emailAddress) => {
			return emailAddress.toLowerCase().indexOf(searchedTerm) === 0;
		});
		const isMatchingFirstName = contact.firstName && contact.firstName.toLowerCase().indexOf(searchedTerm) === 0;
		const isMatchingLastName = contact.lastName && contact.lastName.toLowerCase().indexOf(searchedTerm) === 0;
		const isMatchingCompanyName = contact.CompanyName && contact.CompanyName.toLowerCase().indexOf(searchedTerm) === 0;
		if (isMatchingCompanyName || isMatchingFirstName || isMatchingLastName || isMatchingEmailAddress || isMatchingPhoneNumber) {
			matchingContacts.push({
				id: contact.id,
				firstName: contact.firstName,
				lastName: contact.lastName,
				CompanyName: contact.CompanyName,
				phoneNumbers: contact.phoneNumbers && contact.phoneNumbers.length ? [contact.phoneNumbers[0]] : [],
				emailAddresses: contact.emailAddresses && contact.emailAddresses.length ? [contact.emailAddresses[0]] : [],
			});
		}
	})
	this.publishUcsEvent(req, 'EventSearchContact', { contacts: matchingContacts, totalCount: 0 });
}

getContactDetails = (req, res) => {
	utils.sendOkStatus(req, res);
	const contactId = req.params.id;
	var matchingContact = _.find(contacts, (contact) => {
		return contact.id === contactId;
	});
	if (matchingContact) {
		this.publishUcsEvent(req, 'EventGetContactDetails', {
			contactId: contactId,
			attributes: {
				'Title': [{'value': matchingContact.title}],
				'FirstName': [{'value': matchingContact.firstName}],
				'LastName': [{'value': matchingContact.lastName}],
				'CompanyName': [{'value': matchingContact.CompanyName}],
				'PhoneNumber': matchingContact.phoneNumbers ? matchingContact.phoneNumbers.map((phoneNumber) => { return {'value': phoneNumber}}) : [],
				'EmailAddress': matchingContact.emailAddresses ? matchingContact.emailAddresses.map((emailAddress) => { return {'value': emailAddress}}) : [],
			}
		});
	}
}

deleteContact = (req, res) => {
	utils.sendOkStatus(req, res);
	const contactId = req.params.id;
	contacts = _.filter(contacts, (contact) => {
		return contact.id !== contactId;
	});
	this.publishUcsEvent(req, 'EventContactDeleted', {
		contactId: contactId,
		deleted: 'true'
	});
}

updateContactProperty = (contact, property) => {
	switch(property.name) {
		case 'CompanyName':
			contact.CompanyName = property.values ? property.values[0].value : null;
			break;
		case 'Title':
			contact.title = property.values ? property.values[0].value : null;
			break;
		case 'FirstName':
			contact.firstName = property.values ? property.values[0].value : null;
			break;
		case 'LastName':
			contact.lastName = property.values ? property.values[0].value : null;
			break;
		case 'EmailAddress':
			contact.emailAddresses = property.values ? property.values.map((val) => { return val.value}) : null;
			break;
		case 'PhoneNumber':
			contact.phoneNumbers = property.values ? property.values.map((val) => { return val.value}) : null;
			break;
	}
}

createContact = (req, res) => {
	utils.sendOkStatus(req, res);
	let attributes = {};
	const contactId = conf.s4();
	let contact = {id: contactId};
	req.body.data.properties.forEach((property) => {
		attributes[property.name] = property.values;
		updateContactProperty(contact, property);
	});

	contacts.push(contact)
	this.publishUcsEvent(req, 'EventContactInserted', {
		contactId: contactId,
		attributes: attributes
	});
}

updateContact = (req, res) => {
	utils.sendOkStatus(req, res);
	const contactId = req.params.id;
	const matchingContact = _.find(contacts, (contact) => {
		return contact.id === contactId;
	});
	if (matchingContact) {
		const addedOrChangedProperties = [...req.body.data.addedProperties, ...req.body.data.changedProperties];
		addedOrChangedProperties.forEach((prop) => {
			updateContactProperty(matchingContact, prop);
		});
		req.body.data.deletedProperties.forEach((prop) => {
			updateContactProperty(matchingContact, {name: prop, values: null});
		});
	}
	this.publishUcsEvent(req, 'EventContactUpdated', {
		contactId: contactId
	});
}

retrieveInteractionHistory = (req, res) => {
	utils.sendOkStatus(req, res);
	this.publishUcsEvent(req, 'EventSearchInteractions', {
		interactions: contactInteractions,
		foundInteractions: contactInteractions.length,
		returnedInteractions: contactInteractions.length
	});
}

retrieveContactHistory = (req, res) => {
	utils.sendOkStatus(req, res);
	const contactId = req.params.id;
	const matchingInteractions = contactInteractions.filter((interaction) => {
		return interaction.contactId === contactId;
	});
	this.publishUcsEvent(req, 'EventGetContactHistory', {
		contactId: contactId,
		interactions: matchingInteractions
	});
}

identifyContact = (req, res) => {
	utils.sendOkStatus(req, res);
	const randomContactIndex = Math.floor(Math.random() * contacts.length);
	const contactId = contacts[randomContactIndex].id;
	this.publishUcsEvent(req, 'EventIdentifiedContact', {
		contactId: contactId,
		contactIds: [ contactId ],
		contactCreated: false,
		nbContacts: 1
	});
}

findOrCreatePhoneCall = (req, res) => {
	utils.sendOkStatus(req, res);
	this.publishUcsEvent(req, 'EventFindOrCreatePhoneCall', {
		isCreated: true,
		interactionId: conf.s4()
	});
}

setCallCompleted = (req, res) => {
	utils.sendOkStatus(req, res);
	const interactionId = req.params.id;
	this.publishUcsEvent(req, 'EventUpdateInteraction', {
		interactionId: interactionId
	});
}

assignContact = (req, res) => {
	utils.sendOkStatus(req, res);
	const interactionId = req.params.id;
	this.publishUcsEvent(req, 'EventInteractionAssignedToContact', {
		interactionId: interactionId
	});
}

exports.handleResponsesCategoriesRoot = (req, res) => {
	res.set({ 'Content-type': 'application/json' });
	utils.sendOkStatus(req, res);
	this.publishUcsEvent(req, 'EventGetRootCategories', { categories: standardResponsesRoot });
}

exports.handleResponsesFavorites = (req, res) => {
	res.set({ 'Content-type': 'application/json' });
  utils.sendOkStatus(req, res);
	this.publishUcsEvent(req, 'EventGetFavoriteResponses', { standardResponses: [] });
}

exports.handleResponsesCategoriesDetails = (req, res) => {
  res.set({ 'Content-type': 'application/json' });
  // find the proper category based on categoryId
  const standardResponseCategory = _.find(standardResponsesCategoryDetails, (cat) => {
    return cat.categoryId === req.params.categoryId;
  });

	if (standardResponseCategory) {
		utils.sendOkStatus(req, res);
		this.publishUcsEvent(req, 'EventGetCategory', { category: standardResponseCategory });
	} else {
    	console.error(`No standard responses category found for categoryId: ${req.params.categoryId}`);
		utils.sendFailureStatus(res, 502);
	}
}

exports.handleResponsesDetails = (req, res) => {
	res.set({ 'Content-type': 'application/json' });

  // find the proper response based on standardResponseId
  const standardResponse = _.find(standardResponsesDetails, (cat) => {
    return cat.standardResponseId === req.params.standardResponseId;
  });

	if (standardResponse) {
		utils.sendOkStatus(req, res);
		this.publishUcsEvent(req, 'EventGetStandardResponse', { standardResponse: standardResponse });
	} else {
    console.error(`No standard responses details found for standardResponseId: ${req.params.standardResponseId}`);
		utils.sendFailureStatus(res, 501);
	}
}

exports.handleReportUsageForResponsesId = (req, res) => {
	res.set({ 'Content-type': 'application/json' });
	utils.sendOkStatus(req, res);
	this.publishUcsEvent(req, 'EventReportStandardResponseUsageAck', {});
}

exports.handleRenderFieldCodesForResponsesId = (req, res) => {
	res.set({ 'Content-type': 'application/json' });

  // find the proper response based on standardResponseId
  const standardResponse = _.find(standardResponsesDetails, (cat) => {
    return cat.standardResponseId === req.params.standardResponseId;
  });

  // Override body with structuredBody
  let body = standardResponse.body.replace(/\\r\\n/g, '\r\n');
  if (!req.body.data.usePlainText && standardResponse.structuredBody) {
    body = standardResponse.structuredBody;
  }

  if (standardResponse) {
    utils.sendOkStatus(req, res);
    this.publishUcsEvent(req, 'EventRenderFieldCodes', { body: body });
  } else {
    console.error(`No standard responses details found for standardResponseId: ${req.params.standardResponseId}`);
    utils.sendFailureStatus(res, 501);
  }
}

exports.handleSearchStandardResponses = (req, res) => {
  let query = req.body.data.query ? req.body.data.query : '';
	res.set({ 'Content-type': 'application/json' });

  // Extract the token in string : e.g (TheName:"Hello" OR Body:"Hello" ...)
  const regex = /"(.*?)"/g
  const found = query.match(regex);
  let token = '';
  if (found.length > 0) {
    token = found[0].replace(/"/g, '')
  }

  // find the proper response based on name or body
  const standardResponses = _.filter(standardResponsesDetails, (s) => {
    return s.body.indexOf(token) !== -1 || s.name.indexOf(token) !== -1;
  });

  if (standardResponses) {
    utils.sendOkStatus(req, res);
    this.publishUcsEvent(req, 'EventSearchStandardResponses', { responses: standardResponses });
  } else {
    console.error(`No standard responses details found for standardResponseId: ${req.params.standardResponseId}`);
    utils.sendFailureStatus(res, 501);
  }
}

exports.publishUcsEvent = (req, eventName, opts) => {
	var operationId = req.body.operationId ? req.body.operationId : conf.id();
	var msg = {
		name: eventName,
		operationId: operationId,
		messageType: 'UcsMessage'
	}
	_.each(_.keys(opts), (opt) => {
		msg[opt] = opts[opt];
	});
	messaging.publish(req, '/workspace/v3/contacts', msg);
}