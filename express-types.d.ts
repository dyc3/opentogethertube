import { User } from "./models/user";
import { AuthToken } from "./common/models/types";
import { SessionInfo } from './server/auth/tokens';
import express from "express";

declare module "express" {
	export interface ParamsDictionary {
		[key: string]: string;
	}

	interface Request<
		P = ParamsDictionary,
		ResBody = OttResponseBody | OttStaticDataResponseBody,
		ReqBody = any,
		ReqQuery = core.Query,
		Locals extends Record<string, any> = Record<string, any>
    > extends core.Request<P, ResBody, ReqBody, ReqQuery, Locals> {
		token?: AuthToken;
		ottsession?: SessionInfo;
		user?: User
	}

	export interface RequestHandler<
		P = ParamsDictionary,
		ResBody = OttResponseBody | OttStaticDataResponseBody,
		ReqBody = any,
		ReqQuery = qs.ParsedQs,
		Locals extends Record<string, any> = Record<string, any>
	> {
		(
			req: Request<P, ResBody, ReqBody, ReqQuery, Locals>,
			res: Response<ResBody, Locals>,
			next: NextFunction,
		): void | Promise<void>;
	}
}

export default express;
