const axios = require("axios");

module.exports = {
	getVideoLengthYoutube: async (url) => {
		let res = await axios.get(url);
		let regexs = [/length_seconds":"\d+/, /lengthSeconds\\":\\"\d+/];
		for (let r = 0; r < regexs.length; r++) {
			let matches = res.data.match(regexs[r]);
			for (let m = 0; m < matches.length; m++) {
				const match = matches[m];
				let extracted = match.split(":")[1].substring(1);
				console.log("MATCH", match);
				console.log("EXTRACTED", extracted);
				return parseInt(extracted);
			}
		}
		return -1;
	}
}