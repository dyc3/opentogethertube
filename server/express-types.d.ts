import { User as UserAccount } from "./models/user";
import { AuthToken } from "ott-common/models/types";
import { SessionInfo } from "./auth/tokens";
import * as core from "express-serve-static-core";

declare global {
	namespace Express {
		export interface Request {
			token?: AuthToken;
			ottsession?: SessionInfo;
			user?: UserAccount;
		}

		// export interface RequestHandler<
		// 	P = ParamsDictionary,
		// 	ResBody = OttResponseBody | OttStaticDataResponseBody,
		// 	ReqBody = any,
		// 	ReqQuery = qs.ParsedQs,
		// 	Locals extends Record<string, any> = Record<string, any>
		// > {
		// 	(
		// 		req: Request<P, ResBody, ReqBody, ReqQuery, Locals>,
		// 		res: Response<ResBody, Locals>,
		// 		next: NextFunction,
		// 	): void | Promise<void>;
		// }
	}
}
