import { ref, type Ref } from "vue";
import type { ChatMessage } from "ott-common/models/types";

/*
 * Chat can move between in-video and outside-video containers, which remounts the component.
 * Keep message history and the unsent draft outside the component instance so they survive that move.
 */

/**
 * All past chat messages. They are are no longer
 * shown when deactivated.
 */
export const chatMessagePast: Ref<ChatMessage[]> = ref([]);

/**
 * All recent chat messages that are currently shown when deactivated.
 * They will fade away after `MSG_SHOW_TIMEOUT` ms, and moved into `chatMessagePast`.
 */
export const chatMessageRecent: Ref<ChatMessage[]> = ref([]);

/** The unsent message in the chat input, kept here so it survives chat being remounted. */
export const chatDraft: Ref<string> = ref("");
