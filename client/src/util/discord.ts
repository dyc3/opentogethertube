export function getDiscordLink() {
	const query = new URLSearchParams();
	query.set("redirect", window.location.pathname);
	return `/api/auth/discord?${query.toString()}`;
}

export function goLoginDiscord() {
	const url = getDiscordLink();
	console.info("Redirecting to", url);
	window.location.href = url;
}
