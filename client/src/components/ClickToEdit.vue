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

<script lang="ts">
import { defineComponent, ref, nextTick, Ref } from "vue";

function valueFormatterDefault(value: number): string {
	return value.toString();
}

function valueParserDefault(value: string): number {
	return parseInt(value, 10);
}

/**
 * Provides a value display that can be clicked to edit.
 */
const ClickToEdit = defineComponent({
	name: "ClickToEdit",
	emits: ["change", "update:modelValue"],
	props: {
		modelValue: {
			type: [String, Number],
			required: true,
		},
		valueFormatter: {
			type: Function,
			default: valueFormatterDefault,
		},
		valueParser: {
			type: Function,
			default: valueParserDefault,
		},
	},
	setup(props, { emit }) {
		const editor = ref<HTMLInputElement | undefined>();
		const valueFormatter = ref(props.valueFormatter) as Ref<(value: number) => string>;
		const valueParser = ref(props.valueParser) as Ref<(value: string) => number>;

		const editing = ref(false);
		const valueDirty = ref();
		const display: Ref<HTMLDivElement | undefined> = ref();
		const editorWidth = ref(120);

		async function activate() {
			if (display.value) {
				editorWidth.value = display.value.offsetWidth + 24;
			}
			console.info("modelValue", props.modelValue);
			if (typeof props.modelValue === "number") {
				valueDirty.value = valueFormatter.value(props.modelValue);
			} else {
				valueDirty.value = props.modelValue;
			}
			editing.value = true;
			await nextTick();
			editor.value?.focus();
		}

		function apply() {
			let outValue: string | number;
			if (typeof props.modelValue === "number") {
				outValue = valueParser.value(valueDirty.value);
			} else {
				outValue = valueDirty.value;
			}
			editing.value = false;
			emit("change", outValue);
			emit("update:modelValue", outValue);
		}

		function abort() {
			editing.value = false;
		}

		return {
			editor,
			display,
			editing,
			valueDirty,
			editorWidth,

			activate,
			apply,
			abort,
		};
	},
});

export default ClickToEdit;
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
