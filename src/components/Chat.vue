<template>
  <div class="d-flex flex-column">
    <h4 class="chat-header">Chat</h4>
    <div
      ref="messages"
      @scroll="onScroll"
      class="messages d-flex flex-column flex-grow-1 mt-2"
    >
      <v-sheet
        class="message"
        v-for="(msg, index) in $store.state.room.chatMessages"
        :key="index"
      >
        <div class="from">{{ msg.from.name }}</div>
        <div class="text"><ProcessedText :text="msg.text" /></div>
      </v-sheet>
    </div>
    <div class="d-flex justify-end">
      <v-text-field
        placeholder="Type your message here..."
        @keydown="onInputKeyDown"
        v-model="inputValue"
        autocomplete="off"
      />
    </div>
  </div>
</template>

<script lang="ts">
import ProcessedText from "@/components/ProcessedText.vue";
import connection from "@/util/connection";

export default {
  name: "chat",
  components: {
    ProcessedText,
  },
  data: () => ({
    inputValue: "",
    stickToBottom: true,
  }),
  updated() {
    if (this.stickToBottom) {
      const div = this.$refs.messages as Element;
      div.scrollTop = div.scrollHeight;
    }
  },
  methods: {
    onInputKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter" && this.inputValue.trim() !== "") {
        connection.send({ action: "chat", text: this.inputValue });
        this.inputValue = "";
        this.stickToBottom = true;
      }
    },
    onScroll() {
      const div = this.$refs.messages as Element;
      const distToBottom = div.scrollHeight - div.clientHeight - div.scrollTop;
      this.stickToBottom = distToBottom === 0;
    },
  },
};
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
  background-color: #444;
  width: 100%;
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
</style>
