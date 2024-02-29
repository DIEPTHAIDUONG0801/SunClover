const SQL = require('../../../src/sql');

exports.getListRoles = async (req, res, next) => {
    try {

        const roles = await SQL.role.findAll({

        })

        req.answer = roles;
        next();

    } catch (err) {
        next(err);
    }
}