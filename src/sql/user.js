
module.exports = (sequelize, DataTypes) => {
    const role = sequelize.define('user',
        {
            id: {
                primaryKey: true,
                autoIncrement: true,
                type: DataTypes.INTEGER,
                unique: true,
            },
            user_name: {
                type: DataTypes.STRING(255),
                allowNull: false,
            },
            avatar: {
                type: DataTypes.TEXT('long'),
            },
            state: {
                type: DataTypes.TINYINT(1),
                defaultValue: '0',
                allowNull: false,
            },
            birth: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            start_day: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            role: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            phone: {
                type: DataTypes.STRING(45),
            },
            address: {
                type: DataTypes.STRING(255),
            },
            email: {
                type: DataTypes.STRING(255),
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
        role.belongsTo(Models.user, {
            foreignKey: 'role_code',
            sourceKey: 'role',
        });
    };

    return role;
};

