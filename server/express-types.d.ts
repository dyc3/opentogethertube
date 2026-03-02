/// <reference types="express" />
import type { User as UserAccount } from "./models/user";
import type { AuthToken } from "ott-common/models/types.js";
import type { SessionInfo } from "./auth/tokens";

export {};

declare global {
	namespace Express {
		export interface Request {
			token?: AuthToken;
			ottsession?: SessionInfo;
			user?: UserAccount;
		}
	}
}
