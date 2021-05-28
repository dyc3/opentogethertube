import { API } from "@/common-http.js";
import { ToastStyle } from "@/models/toast";

export default {
	data() {
		return {
			isLoadingCreateRoom: false,
			cancelledRoomCreation: false,
		};
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
					this.goToRoom(res.data.room);
				}
			}).catch(err => {
				console.error(err);
				this.$toast.add({
					style: ToastStyle.Error,
					content: `Failed to create a new temporary room`,
					duration: 6000,
				});
				throw err;
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
					this.goToRoom(options.name);
				}
			}).catch(err => {
				this.isLoadingCreateRoom = false;
				console.error(err);
				this.$toast.add({
					style: ToastStyle.Error,
					content: `Failed to create a new room`,
					duration: 6000,
				});
				throw err;
			});
		},
		cancelRoom() {
			this.cancelledRoomCreation = true;
			this.isLoadingCreateRoom = false;
		},
		goToRoom(roomName) {
			try {
				this.$router.push(`/room/${roomName}`);
			}
			catch (e) {
				if (e.name !== "NavigationDuplicated") {
					throw e;
				}
			}
		},
	},
};
