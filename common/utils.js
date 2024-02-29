/*
 * Copyright (C) 2020
 *
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Proprietary and confidential
 */
'use strict';

const log = require('log4js').getLogger('cmUtils');

const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const moment = require('moment');
const RSAXML = require('rsa-xml');
const cmEnum = require('./enum');
const sqlError = require('optional-require')(require)('../sql/error');
const configuration = require('../configuration');
const TIMEZONE = configuration.get('timezone');
const algorithm = 'aes-256-cbc';
const COOKIE_SECRETKEY = configuration.get('server.cookie.secretKey');
const md5File = require('md5-file');
const Promise = require('bluebird');
/**
 * Function to simulate stopwatch function
 * @returns {StopWatch}  Stopwatch functions
 */
exports.StopWatch = function StopWatch() {
    const _getNow = () => moment();

    let startTime = _getNow();

    /**
     * Start stopwatch
     * @returns {void}
     */
    this.start = () => {
        startTime = _getNow();
    };

    /**
     * Get the time when stop watch was started
     * @returns {Date}  Start time
     */
    this.getStartTime = () => startTime.toDate();

    /**
     * Get stop watch duration
     * @returns {String}  Duration in HH:mm:ss format
     */
    this.getDuration = () => {
        const endTime = _getNow();
        return moment.utc(moment.duration(endTime.diff(startTime)).asMilliseconds()).format('HH:mm:ss');
    };

    /**
     * Get stop watch duration in seconds
     * @returns {Number}  Duration in seconds
     */
    this.getDurationAsSeconds = () => {
        const endTime = _getNow();
        return moment.duration(endTime.diff(startTime)).asSeconds();
    };
};

/**
 * Compare two string text values to see if they are the same (case-insensitive).
 * @param {String} text1  Text value to compare
 * @param {String} text2  Text value to compare
 * @returns {Boolean}  `true` if both texts are the same
 */
exports.isSameText = (text1, text2) => (_normalizeText(text1) === _normalizeText(text2));

/**
 * Forms an array
 * @param {...any} val  Values to push into an array
 * @example
 *      toArray('123') // ['123]
 *      toArray([1], [2]) // [1, 2]
 *      toArray([null]) // []
 * @returns {any[]}  Array without falsy values (i.e. null, false, 0, undefined are purged)
 */
exports.toArray = (...val) => {
    return _.compact(_.concat(...val));
};

/**
 * Convert plain string text to boolean value if possible.
 * @param {String} text  Any string text to convert to boolean
 * @param {Object} defaultValue  Default value if text is neither true nor false
 * @returns {Boolean}  Returns boolean value if `text` is a valid boolean. Otherwise, return `defaultValue` if specified or `null`.
 */
exports.toBoolean = (text, defaultValue) => {
    if (_normalizeText(text) === 'true') {
        return true;
    } else if (_normalizeText(text) === 'false') {
        return false;
    } else {
        return _.isNil(defaultValue) ? null : defaultValue;
    }
};

/**
 * Convert base64 string into buffer content.
 * @param {String} base64  Base64 string
 * @returns {Buffer}  Buffer content equivalent of `base64`. Returns `null` if `base64` is falsy.
 */
exports.base64ToBuffer = (base64) => {
    if (_.isNil(base64)) {
        return null;
    } else if (!_.isString(base64)) {
        throw new Error(`Base64 ${base64} must be in string`);
    } else {
        return Buffer.from(base64, 'base64');
    }
};

/**
 * Convert buffer content into base64 string.
 * @param {String|Buffer} buffer  Buffer content
 * @returns {String}  Base64 equivalent of `buffer`. Returns `buffer` if `base64` is falsy.
 */
exports.bufferToBase64 = (buffer) => {
    if (_.isNil(buffer)) {
        return null;
    } else if (!Buffer.isBuffer(buffer)) {
        throw new Error('Input is not a buffer type');
    } else {
        return Buffer.from(buffer, 'binary').toString('base64');
    }
};

/**
 * Convert string content into base64 string.
 * @param {String}  dataString content
 * @returns {String}  Base64 equivalent of `buffer`. Returns `buffer` if `base64` is falsy.
 */
exports.decodeBase64Image = (dataString) => {
    const matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    const response = {};

    if (matches.length !== 3) {
        return dataString;
    }
    response.type = matches[1];
    response.data = new Buffer(matches[2], 'base64');
    return response;
};

/**
 * Test if a regex pattern exists in a string.
 * @param {String} regex  Regex pattern
 * @param {String} text  String to test regex pattern on
 * @returns {Boolean}  `true` if `text` fits the regex pattern
 */
exports.matchesRegex = (regex, text) => (new RegExp(regex)).test(text);

/**
 * Parse plain string text into JSON object and parse falsy values into null values. Nested
 * values are also parsed.
 * @param {any} text  Text to unserialize
 * @returns {String|any}
 *      Serialized text. If `text` is already an Object, function will return as is.
 *      If `text` is not a valid JSON, an error will be thrown.
 */
exports.unserialize = (text) => {
    // return object, null and undefined values as it is
    if (_.isNil(text) || _.isObjectLike(text)) {
        return text;
    } else if (text === '') {
        return null;
    }

    try {
        // convert string into JSON object
        const jsonObj = JSON.parse(text);
        return parse(jsonObj);
    } catch (err) {
        if (!_.isPlainObject(text)) {
            throw new Error('Invalid JSON object');
        }
        return text;
    }

    // do nested parsing to ensure nested values are also parsed
    function parse(obj) {
        _.each(obj, (value, key) => {
            if (value === 'null' || value === '') {
                obj[key] = null;
            } else if (value === 'undefined') {
                obj[key] = undefined;
            } else if (_.isString(value)) {
                obj[key] = value;
            } else {
                obj[key] = parse(value);
            }
        });
        return obj;
    }
};

/**
 * Generate a file name for consistency purposes.
 * @param {String} [purpose='untitled']  Purpose of file
 * @param {String} [fileExt='txt']  File extension of file
 * @returns {String}  Filename
 */
exports.getFileName = (purpose = 'untitled', fileExt = 'txt') => {
    const buffer = crypto.pseudoRandomBytes(5);
    return `${purpose}_${buffer.toString('hex')}.${fileExt}`;
};

/**
 * Wrapper function to ensure the main function is only called once
 * @param {Object} thisContext  `fn` `this` context
 * @param {Function} fn  Main function to call
 * @returns {Function}  Wrapper function
 */
exports.setupOnce = function setupOnce(thisContext, fn) {
    return (function closure() {
        let called = false;
        return function wrapper() {
            if (called) { return; } // stop execution

            called = true;
            fn.apply(thisContext, arguments);
        };
    })();
};

/**
 * Wrapper function to silent any errors
 * @param {Function} fn  Function to silence any errors that happen
 * @returns {any}  Any result from `fn`
 */
exports.silenceError = (fn) => {
    return function wrapper() {
        try {
            return fn.apply(this, arguments);
        } catch (err) {
            log.warn('<Utils> Silent error', err);
        }
    };
};

/**
 * Convert error messages into a text that is safe to return to client. For example,
 * instead of returning errors from SQL queries directly, generate a text that is
 * generic to prevent any security breach.
 * @param {Error|String|Error[]|string[]} err  Error message
 * @param {Boolean} [withCode=true]  Indicates whether to print error message with error code
 * @returns {String|string[]}  Returns new error message. If `err` was an array, an array will be returned.
 */
exports.parseError = (err, withCode = true) => {
    const errorCode = withCode ? crypto.randomBytes(4).toString('hex') : null;

    if (err instanceof Promise.AggregateError) {
        // don't print stacks for aggregate errors
        log.error(`<Error> ${errorCode}`, err.map((message) => message.toString()));
    } else if (!(err instanceof Error) || err.name !== 'FeatureNotEnabled') {
        log.error(`<Error> ${errorCode}`, (_.get(err, 'parent') ? _.omit(err, 'parent') : err));
    }

    let errors;
    if (Array.isArray(err)) {
        errors = _.reduce(err, (list, message) => {
            list.push(parseMessage(errorCode, message));
            return list;
        }, []);
    } else if (err instanceof Promise.AggregateError) {
        errors = err.map((message) => parseMessage(errorCode, message));
    } else {
        errors = parseMessage(errorCode, err);
    }
    return { code: errorCode, errors: errors };

    /**
     * Parse error messages according to its type. If the error was from Sequelize,
     * it will return a safe string. Otherwise, a string of the error stack will be returned.
     * @param {String} errorCode  Error code identifier
     * @param {String|Error} message   Error message
     * @returns {String}  Safe string
     */
    function parseMessage(errorCode, message) {
        let msgString = '';
        if (sqlError && message instanceof sqlError.TYPE) {
            msgString = sqlError.getText(message);
        } else {
            msgString = _.isFunction(message.toString) ? message.toString() : message;
        }
        // append fullstop
        msgString = (_.endsWith(msgString, '.') || _.endsWith(msgString, '?')) ? msgString : `${msgString}.`;
        // determine whether to return with or without error code
        msgString = _.isNil(errorCode) ? msgString : `Error #${errorCode}: ${msgString}`;
        // prepend error header
        msgString = _.startsWith(msgString, 'Error') ? msgString : `Error: ${msgString}`;
        return msgString;
    }
};

/**
 * Checks if a folder exists.
 * @async
 * @param {String} dir  Folder path
 * @returns {Promise<any>}  Resolves if folder exist. Rejects if folder does not exist
 */
exports.isFolderExist = (dir) => {
    return new Promise((resolve, reject) => {
        fs.access(dir, fs.constants.F_OK, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
};

/**
 * Get the contents of a folder
 * @async
 * @param {String} dir  Folder path
 * @returns {Promise<any>}  Resolves with list of files. Rejects if folder does not exist
 */
exports.readFolder = (dir) => {
    return new Promise((resolve, reject) => {
        fs.readdir(dir, (err, files) => {
            if (err) {
                reject(err);
            } else {
                resolve(files);
            }
        });
    });
};

/**
 * Get the contents of a folder
 * @async
 * @param {String} dir  Folder path
 * @returns {Promise<any>}  Resolves with list of files. Rejects if folder does not exist
 */
exports.createFolder = async (dir, { sep = path.sep } = {}) => {
    const initDir = path.isAbsolute(dir) ? sep : '';
    const baseDir = '.';

    let parentDir = initDir;
    for (const childDir of _.split(dir, sep)) {
        const curDir = path.resolve(baseDir, parentDir, childDir);

        await new Promise((resolve, reject) => {
            fs.mkdir(curDir, { recursive: true }, (err) => {
                if (err && err.code !== 'EEXIST') {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });

        parentDir = curDir;
    }
};

/**
 * Get the contents of a folder
 * @async
 * @param {String} dir  Folder path
 * @returns {Promise<any>}  Resolves with list of files. Rejects if folder does not exist
 */
exports.deleteFolder = async (dir, { sep = path.sep } = {}) => {
    fs.rm(dir, { recursive: true }, () => console.log('done'));
};

/**
 * Get the contents of a folder
 * @async
 * @param {String} data  File contents
 * @param {String} fileNameWithPath  File location to save file in
 * @returns {Promise<any>}  Resolves if file is saved successfully. Rejects if file is not saved.
 */
exports.saveFile = async (data, fileNameWithPath) => {
    await this.createFolder(path.dirname(fileNameWithPath)); // create directory if not exist

    return new Promise((resolve, reject) => {
        fs.writeFile(fileNameWithPath, data, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
};

/**
 * Delete a file
 * @async
 * @param {String} fileNameWithPath  File to delete (full file path)
 * @returns {Promise<any>}  Resolves if file is deleted successfully. Rejects if file is not deleted.
 */
exports.deleteFile = (fileNameWithPath) => {
    return new Promise((resolve, reject) => {
        fs.unlink(fileNameWithPath, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
};

/**
 * Read the contents of a file
 * @async
 * @param {String} fileNameWithPath  File to delete (full file path)
 * @param {Boolean} [isTextFile=false]  Set `true` if is text file (i.e. utf8 encoding)
 * @returns {Promise<any>}  Resolves with file contents. Rejects if fail to read file contents.
 */
exports.readFile = (fileNameWithPath, isTextFile = false) => {
    const encoding = (isTextFile) ? 'utf8' : null;
    return new Promise((resolve, reject) => {
        fs.readFile(fileNameWithPath, encoding, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
};

// YYYY-MM-DDTHH:mm:ssZ
exports.convertDateTimetoUTCstring = (datetime) => {
    return moment(datetime).utcOffset(TIMEZONE).format(cmEnum.DateFormat.ENGINE).toString();
};

exports.convertStringtoDate = (datetime) => {
    return moment(datetime).utcOffset(TIMEZONE).format(cmEnum.DateFormat.DATE).toString();
};

/**
 * Convert Timestamp to Date String with format input
 *
 * @param {Number} datetime  Timestamp
 * @param {String} format  String Date Time
 * @returns {String} Date format
 */
exports.convertStringtoDateWithFormat = (datetime, format) => {
    /** Check date is seconds  */
    if (datetime.toString().length < 11) {
        datetime = datetime * 1000;
    }
    return moment(datetime).utcOffset(TIMEZONE).format(format).toString();
};

/**
 * Convert Date String to Timestamp
 *
 * @param {String} datetime  String Date Time
 * @returns {Number} Timestamp
 */
exports.convertStringtoTimestamp = (datetime) => {
    return Math.round(new Date(datetime).getTime() / 1000);
};

exports.parseWithContentTemplate = (ContentTemplate, Keys, ValueKeys) => {
    log.info('parseWithContentTemplate ', JSON.stringify(ContentTemplate));
    for (const key of Keys) {
        if (!_.isNil(key) && key !== '') {
            ContentTemplate = ContentTemplate.replace('$' + key, ValueKeys[key]);
        }
    }
    log.info('parseWithContentTemplate ', JSON.stringify(ContentTemplate));
    return ContentTemplate;
};

exports.calTotalPage = (TotalItem, PageSize) => {
    const num = TotalItem % PageSize;
    let TotalPage = Math.round(TotalItem / PageSize);
    if (num > 0 && num < 5) {
        TotalPage += 1;
    }
    return Number(TotalPage);
};

exports.encryptWithPublicKey = (value, pathPublicKey, output_type) => {
    const signWith = {
        key: fs.readFileSync(pathPublicKey, 'utf8'),
    };
    let pemKey = signWith.key;
    if (pemKey.includes('RSAKeyValue')) {
        pemKey = new RSAXML().exportPemKey(signWith.key);
    }
    const encryptedData = crypto.publicEncrypt({ key: pemKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(value));
    return encryptedData.toString(output_type);
};

exports.decryptWithPrivateKey = (encrypted_value, pathPrivateKey, input_type) => {
    const signWith = {
        key: fs.readFileSync(pathPrivateKey, 'utf8'),
    };
    let pemKey = signWith.key;
    if (pemKey.includes('RSAKeyValue')) {
        pemKey = new RSAXML().exportPemKey(signWith.key);
    }
    const decryptedData = crypto.privateDecrypt({ key: pemKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(encrypted_value, input_type));
    return decryptedData.toString();
};

exports.encrypt = (text) => {
    const cipher = crypto.createCipher(algorithm, COOKIE_SECRETKEY);
    let crypted = cipher.update(text, 'utf8', 'hex');
    crypted += cipher.final('hex');
    return crypted;
};

exports.decrypt = (text) => {
    const decipher = crypto.createDecipher(algorithm, COOKIE_SECRETKEY);
    let dec = decipher.update(text, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
};

exports.encryptIV = (text, pass, iv) => {
    const cipher = crypto.createCipheriv(algorithm, pass, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
};

exports.decryptIV = (text, pass, iv) => {
    const decipher = crypto.createDecipheriv(algorithm, pass, iv);
    let decrypted = decipher.update(text, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
};

/**
 * Normalises text for comparison
 * @param {String} text  Any string value
 * @returns {String}  Normalised text
 */
function _normalizeText(text) {
    return _.toLower(_.trim(text));
}

/**
 * Random String
 *
 * @param {Integer} length Lenght string random
 * @returns {String} String random
 */
exports.randomString = (length) => {
    const chars = '0123456789';
    let count = 0;
    const list = [];
    while (count < length) {
        const Key = Math.floor(Math.random() * chars.length);
        list.push(chars[Key]);
        count = list.length;
    }
    return list.join('');
};

/**
 * Generate folder follow date format Y/mm
 *
 * @returns {String} Folder format Y/mm
 */
exports.generateFolderByDate = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    return year + '/' + month.toString().padStart(2, '0');
};

/**
 * Save image
 *
 * @param {String} imagebase64 Base64
 * @param {String} folder Folder save image
 * @returns {Object} File Name and File Path
 */
exports.saveImage = async (imagebase64, folder) => {
    log.info('saveImage ', imagebase64, folder);
    try {
        const buffer = exports.base64ToBuffer(imagebase64);
        const filename = exports.getImageName('jpg');
        const filePath = `${folder}/${filename}`;
        await exports.saveFile(buffer, filePath);
        return { filename: filename, path: filePath };
    } catch (err) {
        log.info('saveImage err', JSON.stringify(err));
        throw err;
    }
};

/**
 * Generate String with format YYYYMMDDHHmmssXXXXXX
 *
 * @returns {String} string generate
 */
exports.generateString = () => {
    const randomNumber = Math.floor(Math.random() * (999999 - 100000) + 100000);
    const date = exports.convertStringtoDateWithFormat(new Date(), 'YYYYMMDDHHmmss');
    const result = date + randomNumber.toString();
    return result;
};

/**
 * Get page parameter from request
 *
 * @param {*} Query Query from request
 * @returns {*} Object page info
 */
exports.getPageInfo = (Query) => {
    const Page = Number(Query.Page) || 1;
    const PerPage = Number(Query.PerPage) || 10;
    const Offset = Page === 1 ? 0 : (Page - 1) * PerPage;
    return { PerPage, Offset };
};

/**
 * Get last Online from data
 *
 * @param {*} timeData time to get last
 * @returns {String} last online format
 */
exports.getLastOnline = (timeData) => {
    const currentTime = Math.floor(Date.now() / 1000);
    if (!_.isNumber(timeData)) {
        timeData = (exports.convertStringtoTimestamp(timeData));
    }
    const duration = Math.abs(currentTime - timeData);
    const tmins = duration / 60;
    // Get hours
    const asHours = Math.floor(tmins / 60);

    // Get Minutes
    const asMins = Math.floor(tmins % 60);
    let result = '';
    if (asHours > 0) {
        result = result + asHours + ' hours';
    }
    if (asMins > 0) {
        result = result + ' ' + asMins + ' minutes';
    } else {
        result = result + '0 minute';
    }
    log.info('utils_getLastOnline ', result);
    return result;
};

/**
 * MD5 File from file path
 *
 * @param {String} file path
 *
 * @returns {String} MD5file string hash
 */
exports.encryptMD5File = (file) => {
    try {
        log.info('utils_encryptMD5File file ', file);
        file = path.resolve(file);
        const hash = md5File.sync(file);
        log.info('utils_encryptMD5File hash ', hash);
        return hash;
    } catch (error) {
        log.info('utils_encryptMD5File err ', JSON.stringify(error));
    }
};


/**
 * Get list quarter Year to filter data
 *
 * @returns {*} Object data
 */
exports.prepareListQuaterYear = () => {
    const result = [];
    result.push({
        key: 'Q3-2017',
        value: '==Q3 2017==',
    });
    result.push({
        key: 'Q4-2017',
        value: '==Q4 2017==',
    });
    const currentTime = new Date();
    const currentYear = currentTime.getFullYear();
    const quarterCurrent = Math.floor(currentTime.getMonth() / 3 + 1);
    const selected = {
        key: `Q${quarterCurrent}-${currentYear}`,
        value: `==Q${quarterCurrent} ${currentYear}==`,
    };
    // nearly 3 years
    let i = 2;
    while (i >= 0) {
        const year = currentYear - i;
        for (let j = 1; j < 5; j++) {
            const quarterYear = {
                key: `Q${j}-${year}`,
                value: `==Q${j} ${year}==`,
            };
            result.push(quarterYear);
        }
        i = i - 1;
    }
    return {
        listQuarter: result,
        selectedQuarter: selected,
    };
};

/**
 * Get list month of quarter and year from filter
 *
 * @param {*} quarterYearFilter quarter and year from filter
 * @returns {*} Object list month of quater and year
 */
exports.getMonthAndYearFromQuarter = (quarterYearFilter) => {
    const listQuarter = exports.prepareListQuaterYear();
    const selectedQuarter = listQuarter.listQuarter.find((e) => e.key === quarterYearFilter);
    const error = new Error();
    let result = {};
    // Validate list filter is correct
    if (_.isNil(selectedQuarter)) {
        error.code = '01301';
        throw error;
    }
    const quarterArray = selectedQuarter.key.split('-');
    if (_.isNil(quarterArray) || quarterArray.length !== 2) {
        error.code = '01301';
        throw error;
    }
    const month = [];
    switch (quarterArray[0]) {
        case 'Q1':
            month.push('01', '02', '03');
            break;
        case 'Q2':
            month.push('04', '05', '06');
            break;
        case 'Q3':
            month.push('07', '08', '09');
            break;
        case 'Q4':
            month.push(10, 11, 12);
            break;
    }
    result = {
        month: month,
        year: quarterArray[1],
    };
    return result;
};
/**
 * Get Month and Month Tile by Date Time
 *
 * @param {String} dateTime date time data
 * @returns {Object} month and monthTile
 */
exports.getMonthTitleByDateTime = (dateTime) => {
    const date = new Date(dateTime);
    const month = date.getMonth() + 1;
    const monthTitle = date.toLocaleString('default', { month: 'long' });
    return { month, monthTitle };
};

/**
 * Generate a image name
 *
 * @param {String} [fileExt='jpg']  Image extension of file
 * @param {String} [prefix='']  prefix of image
 * @returns {String}  Image name
 */
exports.getImageName = (fileExt = 'jpg', prefix = '') => {
    const buffer = crypto.pseudoRandomBytes(6);
    if (_.isEmpty(prefix)) {
        return `${buffer.toString('hex')}.${fileExt}`;
    }
    return `${prefix}_${buffer.toString('hex')}.${fileExt}`;
};

/**
 * Generate E-Receipt Number: last 3 digit of UGID + yymmdd + hhmmss + jjj
 *
 * @param {String} ugid
 * @param {Date | Number | String} datetime  Date format
 * @returns {String}
 */
exports.generateEReceiptNo = (txnUGID, datetime) => {
    let result = '';
    if (txnUGID && txnUGID.length > 0) {
        result += txnUGID.substring(txnUGID.length - 3, txnUGID.length);
    }

    const date = exports.convertStringtoDateWithFormat(datetime, 'YYMMDDHHmmss');
    const jjj = moment(datetime).utcOffset(TIMEZONE).milliseconds();
    result = result + date + jjj;
    return result;
};

/**
 * Generate Transaction Number: SAM + UGID + JDAY + CTSN. CTSN is incrementing, Starts from 6001
 *
 * @param {String} ugid
 * @param {Date | Number | String} datetime  Date format
 * @returns {String}
 */
exports.generateTransactionNo = (ugid, datetime) => {
    let result = 'SAM';
    if (ugid && ugid.length > 0) {
        result += ugid;
    }
    const jDay = exports.convertStringtoDateWithFormat(datetime, cmEnum.DateFormat.JULIAN_DATE);
    const ctsn = Math.floor(Math.random() * (9999 - 6001) + 6001);
    result = result + jDay + ctsn;
    return result;
};

/**
 * get GST
 *
 * @param {Number} amount
 * @param {Number} quantity
 * @returns {Number}
 */
exports.getGST = (valGST, amount, quantity) => {
    const gst = (amount - (amount / (1 + valGST))) * quantity;
    const multiplier = Math.pow(10, 2);
    return Math.round(parseFloat(gst) * multiplier) / multiplier;
};

/**
 * parse JWT
 *
 * @param {String} token
 * @returns {Object}
 */
exports.parseJWT = (token) => {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
};