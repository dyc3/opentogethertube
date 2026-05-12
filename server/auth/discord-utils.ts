import { conf } from "../ott-config.js";

/**
 * Check if Discord login is properly configured.
 * Returns true if both client ID and secret are set and not "NONE".
 */
export function isDiscordLoginEnabled(): boolean {
	const discordClientId = conf.get("discord.client_id");
	const discordClientSecret = conf.get("discord.client_secret");
	return (
		!!discordClientId &&
		!!discordClientSecret &&
		discordClientId !== "NONE" &&
		discordClientSecret !== "NONE"
	);
}
