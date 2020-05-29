const utils = require("../common/utils");
const { expandKVListData } = require('../common/file-transform');

var applicationOptions = utils.requireAndMonitor('../../../data/cluster-options.yaml', (updated) => { applicationOptions = updated; });
var agentGroups = utils.requireAndMonitor('../../../data/agent-groups.yaml', (updated) => { agentGroups = updated; });
var agents = utils.requireAndMonitor('../../../data/agents.yaml', (updated) => { agents = updated; });

exports.application = (req, res) => {
	res.send(JSON.stringify({ data: { 
    // Application Data (cluster-options.yaml)
    options: applicationOptions
  } }));
}

exports.agentGroup = (req, res) => {
  const agentId = +req.query['person_dbid:int'];
  const result = [];
  for (const agentGroup of agentGroups) {
    if (
      agentGroup.managerDBIDs.includes(agentId) ||
      agentGroup.agentDBIDs.includes(agentId)
    ) {
      result.push({
        groupInfo: {
          userProperties: expandKVListData(agentGroup.settings)
        }
      });
    }
  }
	res.send(JSON.stringify({ data: {
    // Agent Groups Data (agent-groups.yaml)
    objects: result
  } }));
}

exports.person = (req, res) => {
	res.send(JSON.stringify({ data: { objects: [
    agents[req.query.user_name]
  ] } }));
}
