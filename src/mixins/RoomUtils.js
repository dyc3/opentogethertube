import { API } from "@/common-http.js";

export default {
	data() {
		return {
			isLoadingCreateRoom: false,
			cancelledRoomCreation: false,
		};
	},
	created() {
		this.$events.on("onRoomCreated", this.onRoomCreated);
	},
	methods: {
		createTempRoom() {
			this.isLoadingCreateRoom = true;
			this.cancelledRoomCreation = false;
			return API.post("/room/generate").then(res => {
				if (!this.cancelledRoomCreation) {
					this.isLoadingCreateRoom = false;
					this.cancelledRoomCreation = false;
					this.$events.fire("onRoomCreated", res.data.room);
				}
			});
		},
		createPermRoom(options) {
			this.isLoadingCreateRoom = true;
			this.cancelledRoomCreation = false;
			return API.post(`/room/create`, {
				...options,
				temporary: false,
			}).then(() => {
				if (!this.cancelledRoomCreation) {
					this.isLoadingCreateRoom = false;
					this.cancelledRoomCreation = false;
					this.$events.fire("onRoomCreated", options.name);
				}
			}).catch(err => {
				this.isLoadingCreateRoom = false;
				throw err;
			});
		},
		cancelRoom() {
			this.cancelledRoomCreation = true;
			this.isLoadingCreateRoom = false;
		},
		onRoomCreated(roomName) {
			this.$router.push(`/room/${roomName}`);
		},
	},
};
