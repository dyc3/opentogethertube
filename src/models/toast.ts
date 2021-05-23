
/**
 * A toast notification.
 */
export interface Toast {
	id: symbol
	content: string
	duration?: number
	style: ToastStyle
}

export enum ToastStyle {
	Neutral,
	Success,
	Error,
}
