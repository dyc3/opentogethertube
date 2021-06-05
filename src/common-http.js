import axios from "axios";

export const API = axios.create({
	baseURL: "/api",
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
		'Content-Type': 'application/json',
	},
});
