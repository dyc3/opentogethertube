<template>
	<div
		:class="{
			chat: true,
			activated: activated,
		}"
	>
		<div class="chat-header" v-if="activated">
			<Button
				variant="ghost"
				size="icon-sm"
				@click="setActivated(false)"
				data-cy="chat-deactivate"
				aria-label="close chat"
			>
				<Icon :icon="mdiChevronDown" class="size-4" />
			</Button>
			<h4 class="label-mono text-primary">{{ $t("chat.title") }}</h4>
		</div>
		<div ref="messages" @scroll="onScroll" class="messages grow">
			<div class="grow"><!-- Spacer --></div>
			<transition-group name="message">
				<ChatMsg
					:msg="msg"
					v-for="(msg, index) in chatMessagePast"
					:key="index"
					@link-click="emit('link-click', $event)"
				/>
				<ChatMsg
					:msg="msg"
					recent
					v-for="(msg, index) in chatMessageRecent"
					:key="chatMessagePast.length + index"
					@link-click="emit('link-click', $event)"
				/>
			</transition-group>
		</div>
		<div v-if="!stickToBottom" class="to-bottom">
			<Button variant="signal" size="icon-sm" @click="forceToBottom" aria-label="scroll to bottom">
				<Icon :icon="mdiChevronDoubleDown" class="size-4" />
			</Button>
		</div>
		<Transition name="input" @after-enter="enforceStickToBottom">
			<div class="input-box" v-if="activated">
				<Input
					class="w-full font-mono"
					:placeholder="$t('chat.type-here')"
					@keydown="onInputKeyDown"
					v-model="inputValue"
					autocomplete="off"
					ref="chatInput"
					@blur="deactivateOnBlur && setActivated(false)"
					data-cy="chat-input"
				/>
			</div>
		</Transition>
		<div class="manual-activate" v-if="!activated">
			<Button
				variant="ghost"
				size="icon"
				@click="setActivated(true, true)"
				data-cy="chat-activate"
				aria-label="open chat"
			>
				<Icon :icon="mdiCommentOutline" class="size-5" />
			</Button>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { mdiChevronDown, mdiChevronDoubleDown, mdiCommentOutline } from "@mdi/js";
import { onUpdated, ref, type Ref, nextTick, onMounted, onUnmounted } from "vue";
import type { ChatMessage } from "ott-common/models/types";
import { useConnection } from "@/plugins/connection";
import { useRoomApi } from "@/util/roomapi";
import type { ServerMessageChat } from "ott-common/models/messages";
import { useRoomKeyboardShortcuts } from "@/util/keyboard-shortcuts";
import { useSfx } from "@/plugins/sfx";
import ChatMsg from "./ChatMsg.vue";

const MSG_SHOW_TIMEOUT = 20000;

const emit = defineEmits(["link-click"]);

const connection = useConnection();
const roomapi = useRoomApi(connection);

const inputValue = ref("");
const stickToBottom = ref(true);
/**
 * When chat is activated, all messages are shown. and the
 * user can scroll through message history, type in chat, etc.
 * When chat is NOT activated, when messages are received,
 * they appear and fade away after `MSG_SHOW_TIMEOUT` ms.
 */
const activated = ref(false);
const deactivateOnBlur = ref(false);
/**
 * All past chat messages. They are are no longer
 * shown when deactivated.
 */
const chatMessagePast: Ref<ChatMessage[]> = ref([]);
/**
 * All recent chat messages that are currently shown when deactivated.
 * They will fade away after `MSG_SHOW_TIMEOUT` ms, and moved into `chatMessagePast`.
 */
const chatMessageRecent: Ref<ChatMessage[]> = ref([]);
const messages = ref();
const chatInput: Ref<{ $el?: HTMLInputElement } | HTMLInputElement | undefined> = ref();

/** Resolve the underlying <input> element whether chatInput holds a component instance or the DOM node. */
function getChatInputEl(): HTMLInputElement | undefined {
	const c = chatInput.value as { $el?: HTMLInputElement } | HTMLInputElement | undefined;
	if (!c) {
		return undefined;
	}
	if (c instanceof HTMLElement) {
		return c as HTMLInputElement;
	}
	return c.$el;
}

const shortcuts = useRoomKeyboardShortcuts();
onMounted(() => {
	connection.addMessageHandler("chat", onChatReceived);
	if (shortcuts) {
		shortcuts.bind({ code: "KeyT" }, () => setActivated(true, false));
	} else {
		console.warn("No keyboard shortcuts available");
	}
});

onUnmounted(() => {
	connection.removeMessageHandler("chat", onChatReceived);
});

function focusChatInput() {
	getChatInputEl()?.focus();
}

async function setActivated(value: boolean, manual = false): Promise<void> {
	activated.value = value;
	if (value) {
		if (manual) {
			deactivateOnBlur.value = false;
		} else {
			deactivateOnBlur.value = true;
		}
		await nextTick();
		focusChatInput();
	} else {
		getChatInputEl()?.blur();
		forceToBottom();
	}
}

const sfx = useSfx();
function onChatReceived(msg: ServerMessageChat): void {
	chatMessageRecent.value.push(msg);
	setTimeout(expireChatMessage, MSG_SHOW_TIMEOUT);
	nextTick(enforceStickToBottom);
	sfx.play("pop");
}

function expireChatMessage() {
	chatMessagePast.value.push(chatMessageRecent.value.splice(0, 1)[0]);
}

/**
 * Performs the necessary actions to enact the stickToBottom behavior.
 */
function enforceStickToBottom() {
	const div = messages.value as HTMLDivElement;
	if (!div) {
		return;
	}
	if (stickToBottom.value) {
		div.scrollTop = div.scrollHeight;
	}
}

function onInputKeyDown(e: KeyboardEvent): void {
	if (e.key === "Enter") {
		e.preventDefault();
		if (inputValue.value.trim() !== "") {
			roomapi.chat(inputValue.value);
		}
		inputValue.value = "";
		stickToBottom.value = true;
		setActivated(false);
	} else if (e.key === "Escape") {
		e.preventDefault();
		setActivated(false);
	}
}

function onScroll() {
	const div = messages.value as HTMLDivElement;
	if (!div) {
		return;
	}
	const distToBottom = div.scrollHeight - div.clientHeight - div.scrollTop;
	stickToBottom.value = distToBottom === 0;
}

function forceToBottom() {
	stickToBottom.value = true;
	enforceStickToBottom();
}

onUpdated(enforceStickToBottom);
</script>

<style lang="scss" scoped>
.chat {
	display: flex;
	flex-direction: column;
	margin: 4px;
	padding: 3px;
	transition: all 0.2 ease;
	pointer-events: none;
	height: 100%;

	&.activated {
		background: color-mix(in srgb, var(--background) 82%, transparent);
		backdrop-filter: blur(6px);
		border: 1px solid var(--line-strong);
		border-radius: 4px;
		pointer-events: auto;
	}
}

.activated {
	.message {
		opacity: 1;

		&.recent {
			background: transparent;
			transition-duration: 0.2s;
		}
	}

	.messages {
		overflow-y: auto;
		pointer-events: auto;
	}
}

.chat-header {
	display: flex;
	flex-direction: row;
	align-items: center;
	gap: 6px;
	padding-bottom: 4px;
	border-bottom: 1px solid var(--line-strong);

	h4 {
		margin: 0;
	}
}

.input-box {
	display: flex;
	justify-self: end;
	flex-shrink: 1;
	height: 40px;
}

.grow {
	display: flex;
	flex-grow: 1;
}

.messages {
	display: flex;
	flex-direction: column;
	flex-basis: 0;

	margin-top: 8px;

	overflow: hidden;
	pointer-events: none;

	align-items: baseline;
}

.manual-activate {
	display: flex;
	align-self: flex-end;
	justify-self: end;
	pointer-events: auto;
}

.to-bottom {
	display: flex;
	justify-content: start;
	width: 100%;
	pointer-events: auto;
	margin: 6px 0;
	position: absolute;
	bottom: 42px;
	z-index: 100;
}

// Transition animation
.message-enter-active,
.message-leave-active {
	transition: all 0.2s;
}
.message-enter,
.message.leave-to {
	opacity: 0;
	transform: translateX(-30px) scaleY(0);
}
.message-move {
	transition: transform 0.2s;
}

.input-enter-active,
.input-leave-active {
	transition: all 0.2s ease;
}
.input-enter,
.input-leave-to {
	opacity: 0;
	transform: translateY(-30px) scaleY(0);
	height: 0;
}
</style>
