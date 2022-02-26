<template>
	<div
		:class="{
			'd-flex': true,
			'flex-column': true,
			'activated': activated,
		}"
	>
		<div
			class="chat-header d-flex flex-row"
			v-if="activated"
		>
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
			<transition-group name="message" style="width: 100%">
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
		<Transition
			v-if="activated"
			name="input"
		>
			<div
				class="input-box"
			>
				<v-text-field
					:placeholder="$t('chat.type-here')"
					@keydown="onInputKeyDown"
					v-model="inputValue"
					autocomplete="off"
					ref="chatInput"
					@blur="setActivated(false)"
				/>
			</div>
		</Transition>
	</div>
</template>

<script lang="ts">
import ProcessedText from "@/components/ProcessedText.vue";
import api from "@/util/api";
import { defineComponent, onUpdated, ref, Ref, nextTick } from "@vue/composition-api";

const MSG_SHOW_TIMEOUT = 6000;

let inputValue = ref("");
let stickToBottom = ref(true);
/**
 * When chat is activated, all messages are shown. and the
 * user can scroll through message history, type in chat, etc.
 * When chat is NOT activated, when messages are received,
 * they appear and fade away after a set amount of time.
 */
let activated = ref(false);
let messages = ref();
let chatInput: Ref<HTMLInputElement | undefined> = ref();

function focusChatInput() {
	chatInput.value?.focus();
}

function isActivated(): boolean {
	return activated.value;
}

async function setActivated(value: boolean): Promise<void> {
	activated.value = value;
	if (value) {
		await nextTick();
		focusChatInput();
	}
	else {
		chatInput.value?.blur();
	}
}

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
			else if (e.key === "Escape") {
				setActivated(false);
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
			activated,

			onInputKeyDown,
			onScroll,
			focusChatInput,
			isActivated,
			setActivated,

			messages,
			chatInput,
		};
	},
});

export default Chat;
</script>

<style lang="scss" scoped>
@import "../variables.scss";

.chat-header {
	border-bottom: 1px solid #666;
}

.input-box {
	display: flex;
	justify-self: end;
	flex-shrink: 1;
}

.messages {
	overflow-y: auto;
	overflow-x: hidden;

	flex-basis: 0;
	align-items: baseline;
}

.message {
	margin: 4px;
	margin-left: 0;
	padding: 3px;
	padding-left: 0;

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
		margin-left: 0;
	}

	@media screen and (max-width: $md-max) {
		font-size: 0.8em;
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

.input-enter-active, .input-leave-active {
	transition: all 0.2s ease;
}
.input-enter, .input-leave-to {
	opacity: 0;
	transform: scaleY(0);
}
</style>
