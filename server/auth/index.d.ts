import { AuthToken, SessionInfo } from "./tokens";

declare global {
	namespace Express {
		export interface Request {
			token?: AuthToken;
			ottsession?: SessionInfo;
		}
	}
}
