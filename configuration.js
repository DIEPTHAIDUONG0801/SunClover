/*
 * Copyright (C) 2020
 *
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Proprietary and confidential
 */
'use strict';

/**
 * @fileoverview Full list of system settings/configurations.
 * Do not modify @private settings unless you know what you are doing.
 * Unit for time is ALWAYS in seconds */

const _ = require('lodash');
const log4js = require('log4js');
const log = log4js.getLogger('Configuration');
log.level = 'info';

const DEFAULTS = Object.freeze({
    timezone: '+08:00',
    timeZoneString: 'Asia/Singapore',
    tempFolder: 'tmp', // folder to store scratch files
    server: {
        name: 'Ezy2Ship-Kiosk-Api',
        isSandbox: true,
        isHttps: _.includes(process.argv, 'https'),
        domain: '',
        frontendUrl: '',
        http: {
            port: 8090,
        },
        https: {
            // https://nodejs.org/api/https.html#https_https_createserver_options_requestlistener
            port: 443,
            ssl: {
                cert: '', // .crt file extension
                key: '', // .key file extension
                intermediates: [], // .crt file extension
            },
        },
        limition: {
            json: '50mb',
            urlencoded: '50mb',
            text: '50mb',
        },
        cors: {
            // https://github.com/expressjs/cors#configuration-options
            credentials: true,
            methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
            exposedHeaders: ['Content-Disposition'],
            origin: [''],
        },
        urls: {
            default: '/', // "/" will be redirected to this path
            static: [],
            web_routers: [
                { csrf: false, path: '/role', file: './src/data/role/role-router' }, // csrf service
            ],
        },
    },
    provider: {},
    sms: {
        nexmo: {},
        sinch: {},
        wavecell: {},
    },
    database: {
        sql: {
            // http://docs.sequelizejs.com/class/lib/sequelize.js~Sequelize.html#instance-constructor-constructor
            username: '',
            password: '',
            host: '',
            port: '',
            dialect: '',
            database: '',
            expiration: 24 * 60 * 60,
            clearExpired: false,
            get timezone() {
                // @private
                return DEFAULTS.timezone;
            },
            pool: {
                max: 100, // maximum number of connection in pool
                min: 0, // minimum number of connection in pool
                acquire: 30000, // maximum time, in milliseconds, that pool will try to get connection before throwing error
                idle: 10000, //  maximum time, in milliseconds, that a connection can be idle before being released
            },
        },
    },
    auth: {
        login: {
            maxFailAttempts: 5,
            waitingTimeAfterLocked: 60,
        },
        otp: {
            digits: true,
            alphabets: false,
            specialchars: false,
            uppercase: false,
            expiretime: {
                default: 60,
                forgotpin: 60,
                changeemail: 300,
            },
        },
        password: {
            complex: true, // force new passwords to be complex
            length: 8,
            default: false, // set false to randomise password and send password via email
        },
        token: {
            key: 'x-access-token',
            valid: {
                all: 24 * 60 * 60,
            },
        },
        session: {
            valid: {
                all: 15 * 60,
            },
        },
    },
    mail: {
        content: {
            // application-specific
            subjectPrefix: '[dbo]',
            reply: '', // if empty = computer-generated message at bottom of the email
            cc: [], // forward all sent email to this list of email addresses
        },
        emailfrom: '',
        config: {},
    },
    features: {
        file_offline: {
            file_temp: '',
            file_csv: '',
        },
    },
    log: {
    // https://github.com/log4js-node/log4js-node/tree/master/docs
        appenders: {
            console: { type: 'console' }, // log to console (windows)
            stdout: { type: 'stdout' }, // log to console (linux)
            singleLogFile: {
                type: 'file',
                filename: './log/index.out',
                maxLogSize: 10000000,
                backups: 10,
            }, // log to file, maxsize = 10MB, 10 backups
            dailyLogFile: {
                type: 'dateFile',
                filename: './log/index.out',
                daysToKeep: 30,
            }, // log to file, 1 day 1 file
            dailyErrorFile: {
                type: 'dateFile',
                filename: './log/index.err',
                daysToKeep: 30,
            }, // log to file, 1 day 1 file
            errors: {
                type: 'logLevelFilter',
                appender: 'dailyErrorFile',
                level: 'error',
            },
        },
        categories: {
            default: { appenders: ['console'], level: 'info' },
        },
    },
});

let configuration = DEFAULTS;

let userSettingsFile = global.settings || 'setting.js';
process.argv.forEach((args) => {
    if (args.startsWith('--setting=') || args.startsWith('--settings=')) {
        userSettingsFile = args.split('=')[1];
    }
});
log.info(`Settings file: ${userSettingsFile}`);
_setConfiguration(require(`./${userSettingsFile}`));

/**
 * Returns system configuration
 * @param {String} [key]  Retrieve configuration value for a property. Dot-notation object key is supported.
 * @param {Object} [defaultValue]  If configuration value does not exists, use this value instead.
 * @returns {Object|String}  Full system configuration list, OR a specific value based on `key`
 */
exports.get = function _getConfiguration(key, defaultValue) {
    const value = _.get(configuration, key, defaultValue);
    if (value === undefined) {
        log.warn(`<Config> Key ${key} does not exist.`);
    }
    return key ? value : configuration;
};

/**
 * Set system configuration, inclusive of user-specific settings file. This file is to ensure
 * that the settings/configuration always have default values for the system files to use.
 * @param {Object} userSettings  Subset of configurations
 * @returns {void}
 */
function _setConfiguration(userSettings) {
    configuration = Object.freeze(_.merge({}, DEFAULTS, userSettings));

    // standardise log layout
    _.each(configuration.log.appenders, (appender) => {
        appender.layout = {
            type: 'pattern',
            pattern: '%[[%d] [%p] {%x{lineNo}} %]\n<%c> %m',
            tokens: {
                lineNo: () => new Error().stack.split('\n')[16],
            },
        };
    });

    log4js.configure(configuration.log);
    return this;
}
