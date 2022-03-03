module.exports = {
	"arrowParens": "avoid",
	"bracketSpacing": true,
	"embeddedLanguageFormatting": "auto",
	"htmlWhitespaceSensitivity": "css",
	"insertPragma": false,
	"bracketSameLine": false,
	"jsxSingleQuote": false,
	"printWidth": 100,
	"proseWrap": "preserve",
	"quoteProps": "consistent",
	"requirePragma": false,
	"semi": true,
	"singleQuote": false,
	"tabWidth": 4,
	"trailingComma": "es5",
	"useTabs": true,
	"vueIndentScriptAndStyle": false,
	overrides: [
		{
			files: ["*.yaml", "*.yml"],
			options: {
				useTabs: false,
				tabWidth: 2,
			},
		},
	],
};
