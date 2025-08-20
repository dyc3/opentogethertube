<template>
	<div style="display: inline-flex">
		<div v-if="editing">
			<v-text-field
				variant="solo"
				hide-details
				density="compact"
				single-line
				class="editor"
				ref="editor"
				v-model="valueDirty"
				@keyup.enter="apply"
				@keyup.esc="abort"
				@blur="abort"
			/>
		</div>
		<div v-else @click="activate" class="editable" ref="display">
			{{ typeof modelValue === "number" ? valueFormatter(modelValue) : modelValue }}
		</div>
	</div>
</template>

<script lang="ts" setup generic="T extends string | number">
/**
 * Provides a value display that can be clicked to edit.
 */
import { nextTick, Ref, ref } from "vue";

const props = withDefaults(
	defineProps<{
		valueFormatter?: (value: number) => string;
		valueParser?: (value: string) => number;
	}>(),
	{
		valueFormatter: (value: number): string => value.toString(),
		valueParser: (value: string): number => parseInt(value, 10),
	}
);

const model = defineModel<T>();

const emit = defineEmits<{
	change: [value: T];
}>();

const editor = ref<HTMLInputElement | undefined>();
const valueFormatter = ref(props.valueFormatter) as Ref<(value: number) => string>;
const valueParser = ref(props.valueParser) as Ref<(value: string) => number>;

const editing = ref(false);
const valueDirty = ref("");
const display: Ref<HTMLDivElement | undefined> = ref();
const editorWidth = ref(120);

async function activate() {
	if (display.value) {
		editorWidth.value = display.value.offsetWidth + 24;
	}
	if (typeof model.value === "number") {
		valueDirty.value = valueFormatter.value(model.value);
	} else {
		valueDirty.value = model.value ?? "";
	}
	editing.value = true;
	await nextTick();
	editor.value?.focus();
}

function apply() {
	let outValue: T;
	if (typeof model.value === "number") {
		outValue = valueParser.value(valueDirty.value) as T;
	} else {
		outValue = valueDirty.value as T;
	}
	editing.value = false;
	model.value = outValue;
	emit("change", outValue);
}

function abort() {
	editing.value = false;
}
</script>

<style lang="scss">
.editor {
	width: 10ch;
}

.editable {
	cursor: pointer;
	user-select: none;
}
</style>
