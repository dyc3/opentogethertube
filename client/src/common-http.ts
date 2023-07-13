import axios from "axios";

export const API = axios.create({
	baseURL: `${(import.meta.env.OTT_BASE_URL as string | undefined) ?? ""}/api`,
	transformRequest: [
		(data, headers) => {
			let token = window.localStorage.getItem("token");
			if (token) {
				headers["Authorization"] = `Bearer ${token}`;
			}
			return JSON.stringify(data);
		},
	],
	headers: {
		"Content-Type": "application/json",
	},
});
