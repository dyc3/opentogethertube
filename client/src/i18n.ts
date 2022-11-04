import { nextTick } from "vue";
import messages from "@/locales/en";
import axios from "axios";
import { createI18n, LocaleMessages } from "vue-i18n";

export const i18n = createI18n({
	allowComposition: true,
	locale: process.env.VUE_APP_I18N_LOCALE || "en",
	fallbackLocale: process.env.VUE_APP_I18N_FALLBACK_LOCALE || "en",
});
i18n.global.setLocaleMessage("en", messages);

const loadedLanguages = ["en"]; // our default language that is preloaded

function setI18nLanguage(lang: string) {
	if (i18n.mode === "legacy") {
		i18n.global.locale = lang;
	} else {
		// @ts-expect-error
		i18n.global.locale.value = lang;
	}
	axios.defaults.headers.common["Accept-Language"] = lang;
	document.querySelector("html")?.setAttribute("lang", lang);
	return lang;
}

export async function loadLanguageAsync(lang: string): Promise<string> {
	// If the same language
	if (i18n.global.locale === lang) {
		return setI18nLanguage(lang);
	}

	// If the language was already loaded
	if (loadedLanguages.includes(lang)) {
		return setI18nLanguage(lang);
	}

	// If the language hasn't been loaded yet
	const messages = await import(`@/locales/${lang}.ts`);
	i18n.global.setLocaleMessage(lang, messages.default);
	loadedLanguages.push(lang);
	setI18nLanguage(lang);
	await nextTick();
	return lang;
}
