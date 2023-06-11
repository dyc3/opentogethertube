import { Ref, ref, ComputedRef } from "vue";

export function useCopyFromTextbox(
	text: Ref<string> | ComputedRef<string>,
	textboxComponent: Ref<any>
) {
	let copySuccessTimeoutId: ReturnType<typeof setTimeout> | null = null;
	const copySuccess = ref(false);

	async function copy(): Promise<void> {
		if (navigator.clipboard) {
			try {
				await navigator.clipboard.writeText(text.value);
			} catch (err) {
				console.error("Failed to copy invite link", err);
			}
			if (copySuccessTimeoutId) {
				clearTimeout(copySuccessTimeoutId);
			}
			copySuccessTimeoutId = setTimeout(() => {
				copySuccess.value = false;
			}, 3000);
		} else {
			let textfield: HTMLInputElement | HTMLTextAreaElement | null = (
				textboxComponent.value.$el as HTMLInputElement | HTMLTextAreaElement
			).querySelector("input, textarea");
			if (!textfield) {
				console.error("failed to copy link: input not found");
				return;
			}
			textfield.select();
			document.execCommand("copy");
			if (copySuccessTimeoutId) {
				clearTimeout(copySuccessTimeoutId);
			}
			copySuccessTimeoutId = setTimeout(() => {
				copySuccess.value = false;
				textfield?.blur();
			}, 3000);
		}
		copySuccess.value = true;
	}

	return {
		copySuccess,
		copy,
	};
}
