# I18n: How to add a new language/locale

1. Create a new locale file in `client/src/locales`.
2. Add your translated strings
   1. Be sure to match the schema of the `en` locale **exactly**.
   2. **DO NOT** include untranslated strings. It will automatically fall back to using `en` strings.
3. Open `src/App.vue`
4. Add the new locale to the locale selector dropdown
   1. Look in the component's `data()` function for the `locales` array.

Example:
```json
{
	text: "🇩🇪", // must be an appropriate country flag
	value: "de", // must match the locale file name (without file extension)
},
```