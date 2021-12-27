'use strict';

const ROLES = {
	ADMINISTRATOR: 4,
	MODERATOR: 3,
	TRUSTED_USER: 2,
	REGISTERED_USER: 1,
	UNREGISTERED_USER: 0,
};

const ROLE_NAMES = {
	[ROLES.ADMINISTRATOR]: "admin",
	[ROLES.MODERATOR]: "mod",
	[ROLES.TRUSTED_USER]: "trusted",
	[ROLES.REGISTERED_USER]: "registered",
	[ROLES.UNREGISTERED_USER]: "unregistered",
};

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn('Rooms', 'permissions', {
			type: Sequelize.TEXT,
		});
		for (const role of Object.values(ROLES)) {
			if (role < ROLES.TRUSTED_USER) {
				continue;
			}
			await queryInterface.addColumn('Rooms', `role-${ROLE_NAMES[role]}`, {
				type: Sequelize.TEXT,
			});
		}
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.removeColumn('Rooms', 'permissions');
		for (const role of Object.values(ROLES)) {
			if (role < ROLES.TRUSTED_USER) {
				continue;
			}
			await queryInterface.removeColumn('Rooms', `role-${ROLE_NAMES[role]}`);
		}
	},
};
