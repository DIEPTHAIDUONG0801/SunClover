'use strict';

exports.DataResponse = Object.freeze([
    { errorCode: '0', message: 'Success' },
    { errorCode: '1', message: 'Invalid Session' },
]);

exports.get_DataResponse = (Code) => {
    return exports.DataResponse.find((x) => x.errorCode === Code);
};