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
			API.post("/room/generate").then(res => {
				if (!this.cancelledRoomCreation) {
					this.isLoadingCreateRoom = false;
					this.cancelledRoomCreation = false;
					this.$events.fire("onRoomCreated", res.data.room);
				}
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
