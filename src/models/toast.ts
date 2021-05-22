
/**
 * A toast notification.
 */
export interface Toast {
	id: any // FIXME: type is actually`symbol`
	content: string
	duration: number
}