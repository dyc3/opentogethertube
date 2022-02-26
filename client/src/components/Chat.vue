<template>
	<div
		:class="{
			'chat': true,
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
					v-for="(msg, index) in chatMessagePast"
					:key="index"
				>
					<div class="from">{{ msg.from.name }}</div>
					<div class="text"><ProcessedText :text="msg.text" /></div>
				</div>
				<div
					class="message recent"
					v-for="(msg, index) in chatMessageRecent"
					:key="chatMessagePast.length + index"
				>
					<div class="from">{{ msg.from.name }}</div>
					<div class="text"><ProcessedText :text="msg.text" /></div>
				</div>
			</transition-group>
		</div>
		<Transition
			name="input"
		>
			<div
				class="input-box"
				v-if="activated"
			>
				<v-text-field
					solo
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
import type { ChatMessage } from "common/models/types";

const MSG_SHOW_TIMEOUT = 6000;

let inputValue = ref("");
let stickToBottom = ref(true);
/**
 * When chat is activated, all messages are shown. and the
 * user can scroll through message history, type in chat, etc.
 * When chat is NOT activated, when messages are received,
 * they appear and fade away after `MSG_SHOW_TIMEOUT` ms.
 */
let activated = ref(false);
/**
 * All past chat messages. They are are no longer
 * shown when deactivated.
 */
let chatMessagePast: Ref<ChatMessage[]> = ref([]);
/**
 * All recent chat messages that are currently shown when deactivated.
 * They will fade away after `MSG_SHOW_TIMEOUT` ms, and moved into `chatMessagePast`.
 */
let chatMessageRecent: Ref<ChatMessage[]> = ref([]);
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

function onChatReceived(msg: ChatMessage): void {
	chatMessageRecent.value.push(msg);
	setTimeout(expireChatMessage, MSG_SHOW_TIMEOUT);
}

function expireChatMessage() {
	chatMessagePast.value.push(chatMessageRecent.value.splice(0, 1)[0]);
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
				setActivated(false);
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
			chatMessagePast,
			chatMessageRecent,

			onInputKeyDown,
			onScroll,
			focusChatInput,
			isActivated,
			setActivated,
			onChatReceived,

			messages,
			chatInput,
		};
	},
});

export default Chat;
</script>

<style lang="scss" scoped>
@import "../variables.scss";

.chat {
	display: flex;
	flex-direction: column;
	margin: 4px;
	padding: 3px;
	transition: all 0.2 ease;

	&.activated {
		background: rgba($color: #000000, $alpha: 0.8);
	}
}

.chat-header {
	border-bottom: 1px solid #666;
}

.input-box {
	display: flex;
	justify-self: end;
	flex-shrink: 1;
	height: 50px;
}

.messages {
	overflow-y: auto;
	overflow-x: hidden;

	flex-basis: 0;
	align-items: baseline;
}

.message {
	margin: 2px 0;
	padding: 2px 0;

	&:first-child {
		margin-top: auto;
	}

	&.recent {
		opacity: 0.5;
		transition: opacity 0.2s ease;
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
	transform: translateY(-30px) scaleY(0);
	height: 0;
}
</style>
