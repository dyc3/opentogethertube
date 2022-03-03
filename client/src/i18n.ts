import Vue from "vue";
import VueI18n, { LocaleMessages } from "vue-i18n";
import messages from "@/locales/en";
import axios from "axios";

Vue.use(VueI18n);

export const i18n = new VueI18n({
	locale: process.env.VUE_APP_I18N_LOCALE || "en",
	fallbackLocale: process.env.VUE_APP_I18N_FALLBACK_LOCALE || "en",
});
i18n.setLocaleMessage("en", messages);

const loadedLanguages = ["en"]; // our default language that is preloaded

function setI18nLanguage(lang: string) {
	i18n.locale = lang;
	axios.defaults.headers.common["Accept-Language"] = lang;
	document.querySelector("html")?.setAttribute("lang", lang);
	return lang;
}

export async function loadLanguageAsync(lang: string): Promise<string> {
	// If the same language
	if (i18n.locale === lang) {
		return setI18nLanguage(lang);
	}

	// If the language was already loaded
	if (loadedLanguages.includes(lang)) {
		return setI18nLanguage(lang);
	}

	// If the language hasn't been loaded yet
	const messages = await import(/* webpackChunkName: "lang-[request]" */ `@/locales/${lang}.ts`);
	i18n.setLocaleMessage(lang, messages.default);
	loadedLanguages.push(lang);
	return setI18nLanguage(lang);
}
