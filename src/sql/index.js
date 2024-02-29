/*
* Copyright (C) 2023
*
* Unauthorized copying of this file, via any medium is strictly prohibited
* Proprietary and confidential
*/
'use strict';
const log = require('log4js').getLogger('Sql');
const _ = require('lodash');
const Sequelize = require('sequelize');
const path = require('path');
const cmUtils = require('../../common/utils');
const Configuration = require('../../configuration');
const databaseName = Configuration.get('database.sql.database');
const databaseHost = Configuration.get('database.sql.host');
const basename = path.basename(__filename);

const db = {};

const sequelizeSettings = _.omit(Configuration.get('database.sql'), 'custom');

// establish connection to mssql database
const sequelize = new Sequelize(Object.assign({}, sequelizeSettings, {
    benchmark: true,
    logging: (msg) => {
        log.info(`${msg}`);
    },
    operatorsAliases: false,
    define: { // Options for all tables
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        freezeTableName: true,
    },
    hooks: {
        // bulkCreate by default does not validate fields
        beforeBulkCreate: (instances, options) => {
            options.validate = true;
        },
    },
}));

db.sequelize = sequelize;
db.Sequelize = Sequelize;
module.exports = db;


(async () => {
    try {
        await sequelize.authenticate();
        log.info(`Connection database:${databaseName} in host:${databaseHost} has been established successfully.`);
    } catch (error) {
        log.info(`Unable to connect to the database:${databaseName} in host:${databaseHost} :`, error);
    }

    // intercept sequelize `set()` to set column as null if the provided value is empty string ''
    const originalSetFn = Sequelize.Model.prototype.set;
    Sequelize.Model.prototype.set = function attributeSetter() {
        if (_.isString(arguments[1]) && _.isEmpty(_.trim(arguments[1]))) {
            arguments[1] = null;
        }
        return originalSetFn.apply(this, arguments);
    };

    // import all models file
    const files = await cmUtils.readFolder(__dirname);

    files
        .filter((file) => {
            return (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js');
        })
        .forEach((file) => {
            db[file.replace('.js', '')] = require('./' + file)(sequelize, Sequelize);
        });

    Object.keys(db).forEach((modelName) => {
        if (db[modelName].associate) {
            db[modelName].associate(db);
        }
    });
})();
