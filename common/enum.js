'use strict';

exports.RouterType = Object.freeze({
    AUTH_BY_TOKEN_ONLY: 'TOKEN', // token-based auth, no csrf
    NO_CSRF: 'API', // token/session auth, no csrf
    WITH_CSRF: 'CSRF', // token/session auth, with csrf
});

exports.DataResponse = Object.freeze([
    { errorCode: '0', message: 'Success' },
    { errorCode: '1', message: 'Invalid Session' },
]);

exports.get_DataResponse = (Code) => {
    return exports.DataResponse.find((x) => x.errorCode === Code);
};