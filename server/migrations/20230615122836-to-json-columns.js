"use strict";

const { DataTypes } = require("sequelize");

const COLUMNS = ["permissions", "role-admin", "role-mod", "role-trusted"];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	// biome-ignore lint/correctness/noUnusedFunctionParameters: biome migration
	async up(queryInterface, Sequelize) {
		const dialect = queryInterface.sequelize.getDialect();
		for (const column of COLUMNS) {
			if (dialect === "sqlite") {
				await queryInterface.changeColumn("Rooms", column, DataTypes.JSONB);
			} else if (dialect === "postgres") {
				await queryInterface.sequelize.query(
					`ALTER TABLE "Rooms" ALTER "${column}" TYPE JSONB USING "${column}"::JSONB`
				);
			} else {
				throw new Error(`Unsupported dialect: ${dialect}`);
			}
		}
	},

	// biome-ignore lint/correctness/noUnusedFunctionParameters: biome migration
	async down(queryInterface, Sequelize) {
		const dialect = queryInterface.sequelize.getDialect();
		for (const column of COLUMNS) {
			if (dialect === "sqlite") {
				await queryInterface.changeColumn("Rooms", column, DataTypes.TEXT);
			} else if (dialect === "postgres") {
				await queryInterface.sequelize.query(
					`ALTER TABLE "Rooms" ALTER "${column}" TYPE TEXT USING "${column}"::TEXT`
				);
			} else {
				throw new Error(`Unsupported dialect: ${dialect}`);
			}
		}
	},
};
