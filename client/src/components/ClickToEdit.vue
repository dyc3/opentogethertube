<template>
	<div style="display: inline-flex">
		<div v-if="editing">
			<v-text-field
				solo hide-details dense single-line
				class="editor"
				ref="editor"
				v-model="valueDirty"
				@keyup.enter="apply"
				@keyup.esc="abort"
				@blur="abort"
			/>
		</div>
		<div
			v-else
			@click="activate"
			class="editable"
			ref="display"
		>
			{{ typeof value === 'number' ? valueFormatter(value) : value }}
		</div>
	</div>
</template>

<script lang="ts">
import { defineComponent, ref, toRefs, nextTick, Ref } from '@vue/composition-api';

const editor = ref<HTMLInputElement | undefined>();
const editing = ref(false);
const valueDirty = ref();
const display: Ref<HTMLDivElement | undefined> = ref();
const editorWidth = ref(120);

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
	name: 'ClickToEdit',
	emits: ['change', 'input'],
	props: {
		value: {
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
		const { value } = toRefs(props);
		const valueFormatter = ref(props.valueFormatter) as Ref<(value: number) => string>;
		const valueParser = ref(props.valueParser) as Ref<(value: string) => number>;

		async function activate() {
			if (display.value) {
				editorWidth.value = display.value.offsetWidth + 24;
			}
			if (typeof value.value === 'number') {
				valueDirty.value = valueFormatter.value(value.value);
			}
			else {
				valueDirty.value = value.value;
			}
			editing.value = true;
			await nextTick();
			editor.value?.focus();
		}

		function apply() {
			if (typeof value.value === 'number') {
				value.value = valueParser.value(valueDirty.value);
			}
			else {
				value.value = valueDirty.value;
			}
			editing.value = false;
			emit("change", value.value);
			emit("input", value.value);
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
