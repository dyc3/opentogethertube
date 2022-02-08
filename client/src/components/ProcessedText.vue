<template>
	<span>
		<span v-for="(item, index) in content" :key="index">
			<span v-if="item.type === 'text'">{{ item.text }}</span>
			<a v-else-if="item.type === 'link'" class="link" :href="item.text" @click="e => onLinkClick(e, item.text)">
				<v-tooltip top>
					<template v-slot:activator="{ on, attrs }">
						<span v-bind="attrs" v-on="on">{{ item.text }}</span>
					</template>
					<span>{{ $t("processed-text.text") }}</span>
				</v-tooltip>
			</a>
		</span>
	</span>
</template>

<script>
const urlRegex = /(https?:\/\/[^\s]+)/;

export default {
	name: "ProcessedText",
	props: {
		text: { type: String, required: true },
	},
	data() {
		return {
			content: [],
			updateCount: 0,
		};
	},
	methods: {
		processText() {
			this.content = [];
			if (!this.text) {
				return;
			}
			let match;
			let index = 0;
			let loop = 0;
			while ((match = urlRegex.exec(this.text.substring(index))) !== null) {
				// console.log("msg:", this.text, "match", match, "content", this.content);
				if (match.index > index) {
					this.content.push({ type: "text", text: this.text.slice(index, index + match.index) });
				}
				this.content.push({ type: "link", text: match[0] });
				index += match.index + match[0].length;
				loop++;
				if (loop > 10) {
					break;
				}
			}
			if (index < this.text.length) {
				this.content.push({ type: "text", text: this.text.substring(index) });
			}

			this.updateCount++;
		},
		onLinkClick(e, link) {
			e.preventDefault();
			this.$events.fire("onChatLinkClick", link);
		},
	},
	mounted() {
		this.processText();
	},
	watch: {
		text() {
			this.processText();
		},
	},
};
</script>

<style lang="scss" scoped>
@import "../variables.scss";

.link {
	color: $brand-color;
	text-decoration: underline;
}
</style>
