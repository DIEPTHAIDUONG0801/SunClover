'use strict';

const express = require('express');
const cmEnum = require('@common/enum');
const _ = require('lodash');
const configuration = require('@root/configuration');

module.exports = (async () => {
    _setupProcessHandlers();
    const app = express();
    app.use(helmet({
        frameguard: false,
    }));

    const web_routers = configuration.get('server.urls.web_routers');

    _setupMiddlewareRouters(app, web_routers.filter((route) => !route.csrf && !route.token), cmEnum.RouterType.NO_CSRF);

    _setupMiddlewareRouters(app, web_routers.filter((route) => route.csrf && !route.token), cmEnum.RouterType.WITH_CSRF);

    _setupApiHandler(app);

    return { app };
})();

function _setupProcessHandlers() {
    process.on('exit', () => log.fatal('=== Fatal Error: Application Closed ==='));

    // these handlers prevent server from closing upon error
    process.on('uncaughtException', (err) => log.error('Unhandled Exception at', err));
    process.on('unhandledRejection', (reason) => {
        if (!(reason instanceof Error) || reason.name !== 'FeatureNotEnabled') {
            log.error('Unhandled Rejection at', reason);
        }
    });
}

function _setupApiHandler(app) {
    app.use(_genericErrorMiddleware);
    swagger.setAppHandler(app);
}

function _setupMiddlewareRouters(app, routes, routeType) {
    if (routes) {
        routes
            .filter((route) => (route.file && route.path))
            .forEach((route) => {
                const routeModule = require(route.file);
                app.use(route.path, loggerMiddlewareRequests);
                app.use(route.path, loggerMiddlewareResponses);
                app.use(route.path, routeModule.setup(routeType));
                log.info(`${route.file} will be public access via ${route.path}`);
                app.use(route.path, _genericSuccessMiddleware);
            });
    }
}

function _genericSuccessMiddleware(req, res, next) {
    let data_response = {};
    let answer = {};
    if (req.status === undefined && req.answer === undefined) {
        res.sendStatus(404);
    };
    if (req.errorCode) {
        const DataResponse = cmEnum.get_DataResponse(req.errorCode);
        if (req.message || DataResponse === undefined) {
            answer = Object.assign({ errorCode: req.errorCode, message: req.message, data: req.answer }, answer);
        } else {
            data_response = Object.assign({ errorCode: DataResponse.errorCode, message: DataResponse.message }, data_response);
            const error = _simplifyError(req, data_response.message);
            answer = Object.assign({ errorCode: req.errorCode, message: error.errors, data: req.answer }, answer);
        }
        res.status(_.get(req, 'status', 200)).json(answer);
    } else {
        answer = Object.assign({ errorCode: '0', message: 'Success', data: req.answer }, answer);
        res.status(_.get(req, 'status', 200)).json(answer);
    }
};

function _genericErrorMiddleware(err, req, res, next) {
    let httpStatus = _.get(err, 'status', 200);
    let response = {};
    let data_response = {};
    if (err.code) {
        const DataResponse = cmEnum.get_DataResponse(err.code);
        data_response = Object.assign({ errorCode: DataResponse.errorCode, message: DataResponse.message }, data_response);
        const error = _simplifyError(req, data_response.message);
        response = data_response;
        response.message = error.errors;
    } else {
        httpStatus = 500;
        if (_.includes(err.name, 'Sequelize')) {
            const error = _simplifyError(req, 'Connection Database Fail');
            response = Object.assign({ message: error.errors }, response);
        } else {
            const error = _simplifyError(req, err);
            response = Object.assign({ message: error.errors }, response);
        }
    }
    return res.status(httpStatus).json(response);
}