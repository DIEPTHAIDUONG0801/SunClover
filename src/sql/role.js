
module.exports = (sequelize, DataTypes) => {
    const role = sequelize.define('role',
        {
            id: {
                primaryKey: true,
                autoIncrement: true,
                type: DataTypes.INTEGER,
                unique: true,
            },
            role_code: {
                type: DataTypes.INTEGER,
                allowNull: false,
                unique: true,
            },
            role_name: {
                type: DataTypes.STRING(255),
                allowNull: false,
            },
        },
        {
            scopes: {
                primaryKey: (id) => {
                    return {
                        where: {
                            id: id,
                        },
                    };
                },
            },
            tableName: 'role',
        },
    );

    role.associate = (Models) => {
        role.hasMany(Models.user, {
            foreignKey: 'role',
            sourceKey: 'role_code',
        });
    };

    return role;
};

