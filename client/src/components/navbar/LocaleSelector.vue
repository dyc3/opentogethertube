<template>
	<v-select
		variant="solo"
		style="margin-top: 5px; width: 100px"
		item-title="text"
		:items="locales"
		v-model="locale"
	/>
</template>

<script lang="ts">
import { defineComponent, ref, watch } from "vue";
import { loadLanguageAsync } from "@/i18n";
import { useStore } from "@/store";

const locales = [
	{
		text: "🇺🇸",
		value: "en",
	},
	{
		text: "🇩🇪",
		value: "de",
	},
	{
		text: "🇫🇷",
		value: "fr",
	},
	{
		text: "🇷🇺",
		value: "ru",
	},
];

export const LocaleSelector = defineComponent({
	name: "LocaleSelector",
	setup() {
		const store = useStore();
		const locale = ref(store.state.settings.locale);

		const setLocale = async (locale: string) => {
			await loadLanguageAsync(locale);
			store.commit("settings/UPDATE", { locale });
		};

		watch(locale, (newLocale: string) => {
			setLocale(newLocale);
		});

		// HACK: because for some reason, the locale ref is not updated when the store is updated
		store.subscribe(mutation => {
			if (mutation.type === "settings/UPDATE") {
				locale.value = store.state.settings.locale;
			}
		});

		return {
			store,
			locale,
			locales,
			setLocale,
		};
	},
});

export default LocaleSelector;
</script>
