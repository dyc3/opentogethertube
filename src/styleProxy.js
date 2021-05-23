import styleVars from "@/variables.scss";

function stripCssUnit(text) {
	return parseInt(text.replace("px", ""));
}

export default {
	toast: {
		height: stripCssUnit(styleVars["toast-height"]),
		heightMultiline: stripCssUnit(styleVars["toast-height-multiline"]),
		margin: stripCssUnit(styleVars["toast-margin"]),
		padding: stripCssUnit(styleVars["toast-padding"]),
	},
};
