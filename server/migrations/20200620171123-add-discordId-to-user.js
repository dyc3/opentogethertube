"use strict";

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn("Users", "discordId", {
			type: Sequelize.STRING,
			defaultValue: null,
			allowNull: true,
		});
		await queryInterface.changeColumn("Users", "email", {
			type: Sequelize.STRING,
			allowNull: true,
		});
		await queryInterface.changeColumn("Users", "hash", {
			type: Sequelize.BLOB,
			allowNull: true,
		});
		await queryInterface.changeColumn("Users", "salt", {
			type: Sequelize.BLOB,
			allowNull: true,
		});
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.removeColumn("Users", "discordId");
		await queryInterface.changeColumn("Users", "email", {
			type: Sequelize.STRING,
			allowNull: false,
		});
		await queryInterface.changeColumn("Users", "hash", {
			type: Sequelize.BLOB,
			allowNull: false,
		});
		await queryInterface.changeColumn("Users", "salt", {
			type: Sequelize.BLOB,
			allowNull: false,
		});
	},
};
