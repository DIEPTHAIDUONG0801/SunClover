const SQL = require('../../sql');
const _ = require('lodash');
const log = require('log4js').getLogger('App');

exports.getListRoles = async (req, res, next) => {
    try {
        const roles = await SQL.role.findAll({});
        req.answer = roles;
        next();
    } catch (err) {
        next(err);
    };
};

exports.updateRole = async (req, res, next) => {
    const error = new Error();
    try {
        console.log(req)
        const { roleId } = req.params;
        const { roleName } = req.body;

        log.info(roleId, roleName);

        const data = await SQL.role.findOne({
            where: {
                id: roleId,
            },
        });

        if (_.isNil(data)) {
            error.code = '001001';
            throw error;
        };

        if (_.isEmpty(roleName)) {
            error.code = '001002';
            throw error;
        };

        await SQL.role.update(
            {
                role_name: roleName,
            },
            {
                where: {
                    id: roleId,
                },
            },
        );

        const newData = await SQL.role.findOne({
            where: {
                id: roleId,
            },
        });

        req.answer = newData;
        next();

    } catch (err) {
        next(err);
    };
}