<template>
	<span data-cy="processed-text">
		<span v-for="(item, index) in content" :key="index">
			<span v-if="item.type === 'text'">{{ item.text }}</span>
			<Tooltip v-else-if="item.type === 'link' && showAddQueueTooltip">
				<TooltipTrigger as-child>
					<a
						class="text-primary underline-offset-2 hover:underline"
						:href="item.text"
						@click="e => onLinkClick(e, item.text)"
					>
						{{ item.text }}
					</a>
				</TooltipTrigger>
				<TooltipContent>{{ $t("processed-text.link-hint") }}</TooltipContent>
			</Tooltip>
			<a
				v-else-if="item.type === 'link'"
				class="text-primary underline-offset-2 hover:underline"
				:href="item.text"
				@click="e => onLinkClick(e, item.text)"
			>
				{{ item.text }}
			</a>
		</span>
	</span>
</template>

<script lang="ts" setup>
import { ref, onMounted, watch, type Ref, toRefs } from "vue";

const urlRegex = /(https?:\/\/[^\s]+)/;

interface ContentItem {
	type: "text" | "link";
	text: string;
}

const props = withDefaults(
	defineProps<{
		text: string;
		showAddQueueTooltip: boolean;
	}>(),
	{
		showAddQueueTooltip: true,
	},
);

const emit = defineEmits<{
	"link-click": [link: string];
}>();

const { text } = toRefs(props);
const content: Ref<ContentItem[]> = ref([]);

function onLinkClick(e: Event, link: string) {
	if (props.showAddQueueTooltip) {
		e.preventDefault();
		e.stopPropagation();
		emit("link-click", link);
	}
}

function processText() {
	content.value = [];
	if (!text.value) {
		return;
	}
	let match;
	let index = 0;
	let loop = 0;
	// biome-ignore lint/suspicious/noAssignInExpressions: biome migration
	while ((match = urlRegex.exec(text.value.substring(index))) !== null) {
		// console.log("msg:", this.text, "match", match, "content", this.content);
		if (match.index > index) {
			content.value.push({
				type: "text",
				text: text.value.slice(index, index + match.index),
			});
		}
		content.value.push({ type: "link", text: match[0] });
		index += match.index + match[0].length;
		loop++;
		if (loop > 10) {
			break;
		}
	}
	if (index < text.value.length) {
		content.value.push({ type: "text", text: text.value.substring(index) });
	}
}

onMounted(() => {
	processText();
});

watch(
	() => text,
	() => {
		processText();
	},
);
</script>

