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
		this.$store.subscribe((mutation, state) => {
			if (mutation.type === "ROOM_CREATED") {
				this.showLoading = false;
			}
		});
		this.showLoading = true;
		// http://localhost:8080/quickroom
		this.createTempRoom();
	},
};
</script>

<style></style>
