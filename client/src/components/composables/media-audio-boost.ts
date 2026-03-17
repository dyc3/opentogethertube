import { onBeforeUnmount, onMounted, type Ref, ref, type ShallowRef, shallowRef, watch } from "vue";

const MIN_AUDIO_BOOST = 100;
const MAX_AUDIO_BOOST = 300;

function clampAudioBoost(boost: number): number {
	return Math.min(Math.max(boost, MIN_AUDIO_BOOST), MAX_AUDIO_BOOST);
}

export function useAudioContext(
	mediaElement: Ref<HTMLMediaElement | undefined>,
	createContext: () => AudioContext = () => new AudioContext()
) {
	const context = shallowRef<AudioContext>();
	const source = shallowRef<MediaElementAudioSourceNode>();
	const setupFailed = ref(false);

	function connectSource(): boolean {
		if (source.value) {
			return true;
		}

		if (setupFailed.value) {
			return false;
		}

		const audioContext = context.value;
		const element = mediaElement.value;
		if (!audioContext || !element) {
			return false;
		}

		try {
			source.value = audioContext.createMediaElementSource(element);
			return true;
		} catch (err) {
			setupFailed.value = true;
			console.warn("Failed to initialize media audio boost", err);
			return false;
		}
	}

	function resetFailedSetup(): void {
		if (source.value) {
			return;
		}

		setupFailed.value = false;
	}

	onMounted(() => {
		context.value = createContext();
		connectSource();
	});

	watch(mediaElement, () => {
		connectSource();
	});

	onBeforeUnmount(() => {
		source.value?.disconnect();
		source.value = undefined;
		setupFailed.value = false;

		const audioContext = context.value;
		context.value = undefined;
		if (audioContext && audioContext.state !== "closed") {
			void audioContext.close().catch(err => {
				console.warn("Failed to close media audio context", err);
			});
		}
	});

	return {
		context,
		source,
		connectSource,
		resetFailedSetup,
	};
}

export function useGain(context: ShallowRef<AudioContext | undefined>) {
	const gain = shallowRef<GainNode>();

	function ensureGain(): boolean {
		if (gain.value) {
			return true;
		}

		const audioContext = context.value;
		if (!audioContext) {
			return false;
		}

		const gainNode = audioContext.createGain();
		gainNode.connect(audioContext.destination);
		gain.value = gainNode;
		return true;
	}

	onMounted(() => {
		ensureGain();
	});

	watch(context, () => {
		ensureGain();
	});

	onBeforeUnmount(() => {
		gain.value?.disconnect();
		gain.value = undefined;
	});

	return {
		gain,
		ensureGain,
	};
}

export function useMediaAudioBoost(
	mediaElement: Ref<HTMLMediaElement | undefined>,
	createContext?: () => AudioContext
) {
	const { context, source, connectSource, resetFailedSetup } = useAudioContext(
		mediaElement,
		createContext
	);
	const { gain, ensureGain } = useGain(context);
	const isConnected = ref(false);

	function ensureGraph(): boolean {
		if (!ensureGain() || !connectSource()) {
			return false;
		}

		const sourceNode = source.value;
		const gainNode = gain.value;
		if (!sourceNode || !gainNode) {
			return false;
		}

		if (!isConnected.value) {
			sourceNode.connect(gainNode);
			isConnected.value = true;
		}

		return true;
	}

	function setBoost(boost: number): void {
		const normalizedBoost = clampAudioBoost(boost);
		if (normalizedBoost <= MIN_AUDIO_BOOST && !gain.value) {
			return;
		}

		if (!ensureGraph()) {
			return;
		}

		const gainNode = gain.value;
		const audioContext = context.value;
		if (!gainNode || !audioContext) {
			return;
		}

		gainNode.gain.value = normalizedBoost / 100;

		if (audioContext.state === "suspended") {
			void audioContext.resume().catch(err => {
				console.warn("Failed to resume media audio context", err);
			});
		}
	}

	onBeforeUnmount(() => {
		isConnected.value = false;
	});

	return {
		context,
		gain,
		source,
		setBoost,
		resetFailedSetup,
	};
}
