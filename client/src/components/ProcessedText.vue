<template>
	<span>
		<span v-for="(item, index) in content" :key="index">
			<span v-if="item.type === 'text'">{{ item.text }}</span>
			<a
				v-else-if="item.type === 'link'"
				class="link"
				:href="item.text"
				@click="e => onLinkClick(e, item.text)"
			>
				<v-tooltip top>
					<template v-slot:activator="{ props }">
						<span v-bind="props">{{ item.text }}</span>
					</template>
					<span>{{ $t("processed-text.link-hint") }}</span>
				</v-tooltip>
			</a>
		</span>
	</span>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, watch, Ref } from "vue";

const urlRegex = /(https?:\/\/[^\s]+)/;

interface ContentItem {
	type: "text" | "link";
	text: string;
}

const ProcessedText = defineComponent({
	name: "ProcessedText",
	props: {
		text: { type: String, required: true },
	},
	emits: ["link-click"],
	setup({ text }, { emit }) {
		let content: Ref<ContentItem[]> = ref([]);

		function onLinkClick(e: Event, link: string) {
			e.preventDefault();
			e.stopPropagation();
			emit("link-click", link);
		}

		function processText() {
			content.value = [];
			if (!text) {
				return;
			}
			let match;
			let index = 0;
			let loop = 0;
			while ((match = urlRegex.exec(text.substring(index))) !== null) {
				// console.log("msg:", this.text, "match", match, "content", this.content);
				if (match.index > index) {
					content.value.push({
						type: "text",
						text: text.slice(index, index + match.index),
					});
				}
				content.value.push({ type: "link", text: match[0] });
				index += match.index + match[0].length;
				loop++;
				if (loop > 10) {
					break;
				}
			}
			if (index < text.length) {
				content.value.push({ type: "text", text: text.substring(index) });
			}
		}

		onMounted(() => {
			processText();
		});

		watch(
			() => text,
			() => {
				processText();
			}
		);

		return {
			content,

			onLinkClick,
			processText,
		};
	},
});

export default ProcessedText;
</script>

<style lang="scss" scoped>
@import "../variables.scss";

.link {
	color: $brand-color;
	text-decoration: underline;
}
</style>
