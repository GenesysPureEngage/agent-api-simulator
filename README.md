# Agent API Simulator

>**Important:** _The Agent API Simulator is sample code you can use as a development tool and is not supported by Genesys._

Agent API Simulator is a tool you can use in your local environment to develop and experiment with Workspace Web Edition (WWE).

This tool simulates Genesys Web Services locally so you don't have to run all the real services used by WWE. The simulator can initiate interactions and event within WWE with minimal resources.

To run the Agent API Simulator, you must have access to a version of WWE with the Workspace Web Edition UI and the Genesys Authentication UI.

>**Note:** _Not all Workspace Web Edition functionality is available when using the simulator._

The following WWE functionality is currently supported:

- Logging in to a new workspace as an example agent(s)
- Sending an inbound/internal voice call to an agent
- Sending an email interaction to an agent
- Making voice calls to other agents and phone numbers
- Attaching and modifying/updating interaction data
- Sending individual/group voicemail notifications
- Sending service state change notifications

The simulator also includes a management page you can use to:

- View current agent sessions
- View and edit current interactions and their attached data

## Quick start

### Dependencies

- NodeJS

    NodeJS 10+ is required to install the project's dependencies and run the Agent API Simulator.

    You can install it from here: [https://nodejs.org/](https://nodejs.org/)

- mkcert (required for HTTPS)

    MkCert is required to run Genesys Web Services in a secure environment (HTTPS).

    You can install it from here: [https://github.com/FiloSottile/mkcert#installation](https://github.com/FiloSottile/mkcert#installation)

### Usage

To start the project in production mode, run the commands below.

Install dependencies:

```shell
npm install
```

Build the front end:

```shell
npm run build
```

Generate TLS certificates (optional but **recommended**, see [TLS connection](#TLS-connection)):

  >**Note:** _Run as administrator._

```shell
npm run gen-certs
```

Download the UI assets for the Workspace and Authentication UIs:

  ```shell
  npm run import-ui-assets [{GWS url}]
  ```

  Run the simulator:

  ```shell
  npm start
  ```

Clean the ui-assets and build files:

  ```shell
  npm run clean
  ```

### Accessing Workspace Web Edition, Agent API Simulator

Once the respective components are started, you can access them as follows:

- The Agent API Simulator management page is served under [https://localhost:7777](https://localhost:7777) or [http://localhost:7777](http://localhost:7777)
- The Workspace UI is served under [https://localhost:7777/ui/wwe/index.html](https://localhost:7777/ui/wwe/index.html) or [http://localhost:7777/ui/wwe/index.html](http://localhost:7777/ui/wwe/index.html)


You can use these credentials to login to the Workspace UI:

- Username: **JohnSmith**
- Password: **JohnSmith**

## Configuration

See `src/service/config/agent-api-simulator.json` for general settings.

See the `data` directory for the configuration, settings, agents, agent groups, and so on, that are used when running the simulator.

### Configuration files description

| File  | Description |
| ------------- | ------------- |
| action-codes.yaml  | Reason codes  |
| agent-groups.yaml  | Agent groups with their agents, and group mailbox  |
| agents.yaml | Agents and their default settings  |
| business-attributes.yaml  | Media types, service types, customer segments, interaction types, disposition codes and other business attributes |
| route-points.yaml  | Route points |
| contacts.yaml | Contacts |
| settings.yaml  | WWE settings |
| statistic-profiles.yaml  | Statistics randomization/simulation settings |
| transactions.yaml | Transaction settings  |
| media/attached-data.yaml | Default attached data  |
| voice/capabilities.yaml | Capabilities per state of voice calls |
| voice/extensions.yaml | Extensions part of voice calls |

These files can be changed while the simulator is running.

>**Note:** _Some changes, like changing a username, may require logging out first, and other changes, like modifying settings.yaml, may require reloading the Workspace Web Edition UI._

## TLS connection

Genesys recommends you access the website via HTTPs in order to use all the functionality available in Workspace through the simulator. The website also works with HTTP, but some features might not be accessible.

## Development Environment

### Web application

To start the web application in development mode:

  ```shell
  npm run serve:webapp
  ```

You can access the web application from [http://localhost:8080](http://localhost:8080)

>**Note:** _Don't forget to also start the simulator service._

### Service changes

The service restarts automatically when a change is detected, but you might need to refresh the webapp to ensure all changes are applied.

### External web-content security

The Agent API Simulator exposes WWE on HTTP port 7777, and is configured to display external web contents exposed by a second HTTP server on port 8080 (like SCAPI webpage).

To improve security, you may want to activate those two options :

- X-Frame-Options (for IE11)

  _The X-Frame-Options HTTP response header can be used to indicate whether or not a browser should be allowed to render a page in an `<iframe>`. Sites can use this to avoid clickjacking attacks, by ensuring that their content is not embedded into other sites._

- Content Security Policy (For Chrome, Firefox, Edge)

  _Content Security Policy (CSP) is an added layer of security that helps to detect and mitigate certain types of attacks, including Cross Site Scripting (XSS) and data injection attacks._

If necessary, you can setup X-Frame-Option and CSP headers for this server, by uncommenting the lines bellow `CSP - X-Frame-Options` in file .`/src/samples/server.js`

### Testing

To run unit tests, do the following:

  ```shell
  npm run test
  ```

This runs every .js files in the `__tests__` folder.

## Compatibility table

|AgentApiSimulator version|WWE version|AuthUi version|
|---|---|---|
|1.0.1|9.0.000.65.7169|9.0.000.28.174|
|1.0.2|9.0.000.70.7976|9.0.000.30.186|
|1.0.3|9.0.000.69.7930|9.0.000.30.186|

This table is updated automatically from the `compatibility-versions.json` file.

## GitHub actions status

![Node.js CI](https://github.com/GenesysPureEngage/agent-api-simulator/workflows/Node.js%20CI/badge.svg)

![Compatibility - Update README](https://github.com/GenesysPureEngage/agent-api-simulator/workflows/Compatibility%20-%20Update%20README/badge.svg)

![Compatibility - Merge pull request](https://github.com/GenesysPureEngage/agent-api-simulator/workflows/Compatibility%20-%20Merge%20pull%20request/badge.svg)

## Questions

For questions and support please use [Genesys DevFoundry](https://developer.genesys.com/) with the tag [agent-api-simulator](https://developer.genesys.com/q2a/tag/agent-api-simulator).

## License

- **[MIT license](http://opensource.org/licenses/mit-license.php)**
- Copyright 2020 © [Genesys](https://www.genesys.com/).
