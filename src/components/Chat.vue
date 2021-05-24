<template>
  <div class="d-flex flex-column">
    <h4 class="chat-header">Chat</h4>
    <div
      ref="messages"
      @scroll="onScroll"
      class="messages d-flex flex-column flex-grow-1 mt-2"
    >
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
        placeholder="Type your message here..."
        @keydown="onInputKeyDown"
        v-model="inputValue"
        autocomplete="off"
      />
    </div>
  </div>
</template>

<script>
import Vue from "vue";
import ProcessedText from "@/components/ProcessedText.vue";
import connection from "@/util/connection";

export default Vue.extend({
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
      const div = this.$refs["messages"];
      div.scrollTop = div.scrollHeight;
    }
  },
  methods: {
    onInputKeyDown(e) {
      if (e.key === "Enter" && this.inputValue.trim() !== "") {
        connection.send({ action: "chat", text: this.inputValue });
        this.inputValue = "";
        this.stickToBottom = true;
      }
    },
    onScroll() {
      const div = this.$refs["messages"];
      const distToBottom = div.scrollHeight - div.clientHeight - div.scrollTop;
      this.stickToBottom = distToBottom === 0;
    },
  },
});
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
