<template>
  <div class="d-flex flex-column">
    <h4 class="chat-header">Chat</h4>
    <div
      ref="messages"
      @scroll="onScroll"
      class="messages d-flex flex-column flex-grow-1 mt-2"
    >
      <v-card
        class="message d-flex mr-2 mb-2"
        v-for="(msg, index) in $store.state.room.chatMessages"
        :key="index"
      >
        <div class="from">{{ msg.from }}</div>
        <div class="text"><ProcessedText :text="msg.text" /></div>
      </v-card>
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

<script>
import ProcessedText from "@/components/ProcessedText.vue";

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
      const div = this.$refs.messages;
      div.scrollTop = div.scrollHeight;
    }
  },
  methods: {
    onInputKeyDown(e) {
      if (e.keyCode === 13 && this.inputValue.trim() !== "") {
        this.$socket.sendObj({ action: "chat", text: this.inputValue });
        this.inputValue = "";
        this.stickToBottom = true;
      }
    },
    onScroll() {
      const div = this.$refs.messages;
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
}

.message {
  background-color: #444;

  &:first-child {
    margin-top: auto;
  }

  .from,
  .text {
    margin: 3px 5px;
    word-wrap: break-word;
  }

  .from {
    font-weight: bold;
    max-width: 20%;
  }

  .text {
    min-width: 80%;
  }
}
</style>
