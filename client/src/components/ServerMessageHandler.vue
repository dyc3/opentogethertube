<script lang="ts">
import { defineComponent } from "vue";
import { useConnection } from "@/plugins/connection";
import { useStore } from "@/store";

const ServerMessageHandler = defineComponent({
	name: "ServerMessageHandler",
	setup() {
		const store = useStore();
		const connection = useConnection();

		connection.addMessageHandler("sync", msg => {
			store.dispatch("sync", msg);
		});
		connection.addMessageHandler("chat", msg => {
			store.dispatch("chat", msg);
		});
		connection.addMessageHandler("announcement", msg => {
			store.dispatch("announcement", msg);
		});
		connection.addMessageHandler("error", msg => {
			store.dispatch("error", msg);
		});
		connection.addMessageHandler("user", msg => {
			store.dispatch("user", msg);
		});
		connection.addMessageHandler("event", msg => {
			store.dispatch("event", msg);
		});
		connection.addMessageHandler("eventcustom", msg => {
			store.dispatch("eventcustom", msg);
		});

		return {};
	},
});

export default ServerMessageHandler;
</script>
