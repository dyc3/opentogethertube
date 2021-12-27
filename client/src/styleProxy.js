// import styleVars from "@/variables.scss";
// for some dumbass reason, this import stopped working

const styleVars = {
	"toast-height": "48px",
	"toast-height-multiline": "68px",
	"toast-margin": "8px",
	"toast-padding": "0",
};

function stripCssUnit(text) {
	return parseInt(text.replace("px", ""), 10);
}

export default {
	toast: {
		height: stripCssUnit(styleVars["toast-height"]),
		heightMultiline: stripCssUnit(styleVars["toast-height-multiline"]),
		margin: stripCssUnit(styleVars["toast-margin"]),
		padding: stripCssUnit(styleVars["toast-padding"]),
	},
};
