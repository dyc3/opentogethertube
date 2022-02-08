<template>
	<v-container>
		<v-dialog v-model="showLoading" persistent max-width="600">
			<v-card>
				<v-card-text>
					{{ $t("quick-room.text") }}
					<v-progress-linear indeterminate />
				</v-card-text>
			</v-card>
		</v-dialog>
	</v-container>
</template>

<script>
import RoomUtilsMixin from "@/mixins/RoomUtils.js";

export default {
	name: "quickroom",
	mixins: [RoomUtilsMixin],
	data() {
		return {
			showLoading: false,
		};
	},
	async mounted() {
		this.$events.on("onRoomCreated", () => this.showLoading = false);
		this.showLoading = true;
		let urlParams = new URLSearchParams(window.location.search);
		// http://localhost:8080/quickroom?service=youtube&id=OC8YSHSIMTw
		if (urlParams.has("service") && urlParams.has("id")) {
			this.$store.commit("QUICKADD_ADD", {
				service: urlParams.get("service"),
				id: urlParams.get("id"),
			});
		}
		else if (urlParams.has("url")) {
			this.$store.commit("QUICKADD_ADD", {
				url: urlParams.get("url"),
			});
		}
		this.createTempRoom();
	},
};
</script>

<style>

</style>
