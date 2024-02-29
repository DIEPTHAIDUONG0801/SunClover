'use strict';

const express = require('express');
const cmEnum = require('../../../common/enum');
const role = require('./role-function');
const router = express.Router(); // not protected from csrf
const csrfRouter = express.Router(); // protected from csrf
const tokenRouter = express.Router(); // protected from csrf

exports.setup = (routerType) => {
    if (routerType === cmEnum.RouterType.AUTH_BY_TOKEN_ONLY) {
        return tokenRouter;
    } else if (routerType === cmEnum.RouterType.NO_CSRF) {
        return router;
    } else if (routerType === cmEnum.RouterType.WITH_CSRF) {
        return csrfRouter;
    }
};

router.get('/all', role.getListRoles);
router.post('/update/:roleId', role.updateRole);