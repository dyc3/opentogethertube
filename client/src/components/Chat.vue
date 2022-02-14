<template>
	<div class="d-flex flex-column">
		<div class="chat-header d-flex flex-row">
			<v-btn
				icon
				x-small
				@click="$emit('close')"
			>
				<v-icon>fas fa-chevron-right</v-icon>
			</v-btn>
			<h4>{{ $t("chat.title") }}</h4>
		</div>
		<div
			ref="messages"
			@scroll="onScroll"
			class="messages d-flex flex-column flex-grow-1 mt-2"
		>
			<div class="d-flex flex-grow-1"><!-- Spacer --></div>
			<transition-group name="message">
				<div
					class="message"
					v-for="(msg, index) in $store.state.room.chatMessages"
					:key="index"
				>
					<div class="from">{{ msg.from.name }}</div>
					<div class="text"><ProcessedText :text="msg.text" /></div>
				</div>
			</transition-group>
		</div>
		<div class="d-flex justify-end">
			<v-text-field
				:placeholder="$t('chat.type-here')"
				@keydown="onInputKeyDown"
				v-model="inputValue"
				autocomplete="off"
			/>
		</div>
	</div>
</template>

<script lang="ts">
import ProcessedText from "@/components/ProcessedText.vue";
import api from "@/util/api";
import { defineComponent, onUpdated, ref } from "@vue/composition-api";

let inputValue = ref("");
let stickToBottom = ref(true);
let messages = ref();

const Chat = defineComponent({
	name: "Chat",
	components: {
		ProcessedText,
	},
	emits: ["close"],
	setup() {
		function onInputKeyDown(e: KeyboardEvent): void {
			if (e.key === "Enter" && inputValue.value.trim() !== "") {
				api.chat(inputValue.value);
				inputValue.value = "";
				stickToBottom.value = true;
			}
		}

		function onScroll() {
			const div = messages.value as HTMLDivElement;
			const distToBottom = div.scrollHeight - div.clientHeight - div.scrollTop;
			stickToBottom.value = distToBottom === 0;
		}

		onUpdated(() => {
			const div = messages.value as HTMLDivElement;
			if (stickToBottom.value) {
				div.scrollTop = div.scrollHeight;
			}
		});

		return {
			inputValue,
			stickToBottom,

			onInputKeyDown,
			onScroll,

			messages,
		};
	},
});

export default Chat;
</script>

<style lang="scss" scoped>
.chat-header {
	border-bottom: 1px solid #666;
}

.messages {
	overflow-y: auto;
	overflow-x: hidden;

	flex-basis: 0;
	align-items: baseline;
}

.message {
	margin: 4px;
	padding: 3px;

	&:first-child {
		margin-top: auto;
	}

	.from,
	.text {
		display: inline;
		margin: 3px 5px;
		word-wrap: break-word;
	}

	.from {
		font-weight: bold;
	}
}

// Transition animation
.message-enter-active, .message-leave-active {
	transition: all 0.2s;
}
.message-enter, .message.leave-to {
	opacity: 0;
	transform: translateX(-30px) scaleY(0);
}
.message-move {
	transition: transform 0.2s;
}
</style>
