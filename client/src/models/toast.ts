/* eslint-disable no-unused-vars */

import { ServerMessageEvent } from "ott-common/models/messages";

/**
 * A toast notification.
 */
export interface Toast {
	id: symbol;
	content: string;
	duration?: number;
	style: ToastStyle;
	event?: ServerMessageEvent;
}

export enum ToastStyle {
	Neutral,
	Success,
	Error,
	Important,
}
