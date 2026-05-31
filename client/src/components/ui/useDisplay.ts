import { onMounted, onUnmounted, ref, computed } from "vue";

/**
 * Lightweight replacement for Vuetify's `$vuetify.display`.
 * Tracks the viewport width and exposes the breakpoint helpers we actually use.
 */
const BREAKPOINTS = {
	xs: 0,
	sm: 600,
	md: 960,
	lg: 1264,
	xl: 1920,
};

const width = ref(typeof window !== "undefined" ? window.innerWidth : 1280);
let listeners = 0;
let onResize: (() => void) | null = null;

export function useDisplay() {
	onMounted(() => {
		if (listeners === 0) {
			onResize = () => {
				width.value = window.innerWidth;
			};
			window.addEventListener("resize", onResize, { passive: true });
		}
		listeners++;
		width.value = window.innerWidth;
	});

	onUnmounted(() => {
		listeners--;
		if (listeners === 0 && onResize) {
			window.removeEventListener("resize", onResize);
			onResize = null;
		}
	});

	const smAndUp = computed(() => width.value >= BREAKPOINTS.sm);
	const mdAndUp = computed(() => width.value >= BREAKPOINTS.md);
	const lgAndUp = computed(() => width.value >= BREAKPOINTS.lg);
	const xlAndUp = computed(() => width.value >= BREAKPOINTS.xl);
	const smAndDown = computed(() => width.value < BREAKPOINTS.md);
	const mdAndDown = computed(() => width.value < BREAKPOINTS.lg);
	const mobile = computed(() => width.value < BREAKPOINTS.md);

	const name = computed(() => {
		const w = width.value;
		if (w >= BREAKPOINTS.xl) {
			return "xl";
		}
		if (w >= BREAKPOINTS.lg) {
			return "lg";
		}
		if (w >= BREAKPOINTS.md) {
			return "md";
		}
		if (w >= BREAKPOINTS.sm) {
			return "sm";
		}
		return "xs";
	});

	return { width, name, smAndUp, mdAndUp, lgAndUp, xlAndUp, smAndDown, mdAndDown, mobile };
}
