export default {
	methods: {
		granted(permission) {
			// TODO: find some way to reuse server code
			// TODO: get permissions masks from data api
			const masks = {
				"playback.play-pause": 1<<0,
				"playback.skip": 1<<1,
				"playback.seek": 1<<2,
				"manage-queue.add": 1<<3,
				"manage-queue.remove": 1<<4,
				"manage-queue.order": 1<<5,
				"manage-queue.vote": 1<<6,
				"chat": 1<<7,
				"configure-room.set-title": 1<<8,
				"configure-room.set-description": 1<<9,
				"configure-room.set-visibility": 1<<10,
				"configure-room.set-queue-mode": 1<<11,
				"configure-room.set-permissions.for-moderator": 1<<12,
				"configure-room.set-permissions.for-trusted-users": 1<<13,
				"configure-room.set-permissions.for-all-registered-users": 1<<14,
				"configure-room.set-permissions.for-all-unregistered-users": 1<<15,
				"manage-users.promote-admin": 1<<16,
				"manage-users.demote-admin": 1<<17,
				"manage-users.promote-moderator": 1<<18,
				"manage-users.demote-moderator": 1<<19,
				"manage-users.promote-trusted-user": 1<<20,
				"manage-users.demote-trusted-user": 1<<21,
			};
			return (this.$store.state.room.grants & masks[permission]) > 0;
		},
		waitForMetadata() {
			// eslint-disable-next-line @typescript-eslint/no-this-alias
			let _this = this;
			return new Promise(resolve => {
				(function wait() {
					if (_this.$store.state.permsMeta.loaded) {
						return resolve();
					}
					setTimeout(wait, 30);
				})();
			});
		},
	},
};
