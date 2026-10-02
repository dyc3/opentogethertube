const SENSITIVE_PARAM_REGEX =
	/([?&#](?:api_key|apiKey|apikey|token|secret|password|pass)=)[^&#\s]+/gi;

/**
 * Redacts sensitive credentials (such as API keys, tokens, and passwords) from user input or URLs
 * before writing them to server logs.
 */
export function sanitizeLogInput(input: string): string {
	if (!input) {
		return "";
	}
	let sanitized = input;
	try {
		const parsed = new URL(input);
		if (parsed.password) {
			parsed.password = "REDACTED";
			sanitized = parsed.toString();
		}
	} catch {
		// Not a standard URL, continue with regex replacement
	}
	return sanitized.replace(SENSITIVE_PARAM_REGEX, "$1[REDACTED]");
}
