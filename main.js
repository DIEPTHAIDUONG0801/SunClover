'use strict';

const log = require('log4js').getLogger('Main');
require('module-alias/register');

const _ = require('lodash');
const http = require('http');
const https = require('https');
const cmUtils = require('./common/utils');
const mainApp = require('./app');
const configuration = require('./configuration');

require('dotenv').config();

(async () => {
    try {
        // ============= initialize web server
        const { app } = await mainApp;
        await _createServer(app);
    } catch (err) {
        log.fatal(err);
        process.exit();
    }
})();

async function _createServer(app) {
    const timeout = 24 * 3600 * 1000; // set timeout for waiting response = 1 day
    // const timeout = 60; // set timeout for waiting response = 1 minute

    try {
        let server;
        let protocol;

        if (!configuration.get('server.isHttps')) {
            protocol = 'http';
            server = http.createServer(app);

        } else {
            // read all ssl certs at the same time
            const sslKeyPromise = cmUtils.readFile(configuration.get('server.https.ssl.key'), false);
            const sslCertPromise = cmUtils.readFile(configuration.get('server.https.ssl.cert'), false);
            const sslCaPromises = _.map(configuration.get('server.https.ssl.intermediates'), (file) => cmUtils.readFile(file));

            const httpsOptions = {
                key: await sslKeyPromise,
                cert: await sslCertPromise,
                ca: await Promise.all(sslCaPromises),
            };

            protocol = 'https';
            server = https.createServer(httpsOptions, app);
        }

        return new Promise((resolve) => {
            const port = configuration.get(`server.${protocol}.port`);
            server
                .setTimeout(timeout)
                .listen(port, function listen() {
                    global.serverAddress = `${protocol}://localhost:${port}`;
                    resolve(this);
                });
        });
    } catch (err) {
        throw err;
    }
}
