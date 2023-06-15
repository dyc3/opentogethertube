"use strict";

const { DataTypes } = require("sequelize");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.changeColumn("rooms", "permissions", DataTypes.JSONB);
		await queryInterface.changeColumn("rooms", "role-admin", DataTypes.JSONB);
		await queryInterface.changeColumn("rooms", "role-mod", DataTypes.JSONB);
		await queryInterface.changeColumn("rooms", "role-trusted", DataTypes.JSONB);
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.changeColumn("rooms", "permissions", DataTypes.TEXT);
		await queryInterface.changeColumn("rooms", "role-admin", DataTypes.TEXT);
		await queryInterface.changeColumn("rooms", "role-mod", DataTypes.TEXT);
		await queryInterface.changeColumn("rooms", "role-trusted", DataTypes.TEXT);
	},
};
