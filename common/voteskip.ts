export function voteSkipThreshold(users: number): number {
	return Math.ceil(users * 0.5);
}
