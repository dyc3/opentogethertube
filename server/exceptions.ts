import { URL } from "url";
import { OttException } from "../common/exceptions";

// export type OttException = UnsupportedServiceException | InvalidAddPreviewInputException | OutOfQuotaException | InvalidVideoIdException | FeatureDisabledException | UnsupportedMimeTypeException | LocalFileException | MissingMetadataException | IncompleteServiceAdapterException | PermissionDeniedException | ImpossiblePromotionException | InvalidRoleException | RoomNotFoundException | RoomAlreadyLoadedException | RoomNameTakenException | VideoAlreadyQueuedException | VideoNotFoundException | BadApiArgumentException

export class UnsupportedServiceException extends OttException {
	constructor(url: string) {
		let msg = "";
		let parsed = new URL(url);
		if (parsed.pathname && /\/*\.([a-z0-9])$/i.exec(parsed.pathname.split("?")[0])) {
			msg = `If this is a direct link to a video file, please open a "service support request" issue on github, so we can see if this file format works. Otherwise, "${url}" is not a valid URL for any suppported service.`;
		} else {
			msg = `"${url}" is not a valid URL for any suppported service.`;
		}
		super(msg);
		this.name = "UnsupportedServiceException";
	}
}

export class InvalidAddPreviewInputException extends OttException {
	name = "InvalidAddPreviewInputException";

	constructor(minLength: number) {
		super(
			`Your search query must at least ${minLength} characters, or supply a Youtube video, playlist, or channel link.`
		);
	}
}

export class OutOfQuotaException extends OttException {
	constructor(service: string) {
		if (service === "youtube") {
			super(
				`We don't have enough Youtube API quota to complete the request. We currently have a limit of 50,000 quota per day.`
			);
		} else if (service === "googledrive") {
			super(`We don't have enough Google Drive API quota to complete the request.`);
		} else {
			super(`We don't have enough API quota to complete the request. Try again later.`);
		}
		this.name = "OutOfQuotaException";
	}
}

export class InvalidVideoIdException extends OttException {
	name = "InvalidVideoIdException";

	constructor(service: string, id: string) {
		super(`"${id} is an invalid ${service} video ID."`);
	}
}

export class ServiceLinkParseException extends OttException {
	name = "ServiceLinkParseException";

	constructor(service: string, url: string) {
		super(`${service}: failed to parse url: ${url}`);
	}
}

export class FeatureDisabledException extends OttException {
	name = "FeatureDisabledException";

	constructor(reason: string) {
		super(`Sorry, this feature is disabled: ${reason}`);
	}
}

export class UnsupportedMimeTypeException extends OttException {
	constructor(mime: string) {
		if (mime.startsWith("video/")) {
			super(`Files that are ${mime} are not supported. Mp4 videos work the best.`);
		} else {
			super(`The requested resource was not actually a video, it was a ${mime}`);
		}
		this.name = "UnsupportedMimeTypeException";
	}
}

export class LocalFileException extends OttException {
	name = "LocalFileException";

	constructor() {
		super(
			`The video URL provided references a local file. It is not possible to play videos on your computer, nor files located on the server. Videos must be hosted somewhere all users in the room can access.`
		);
	}
}

export class MissingMetadataException extends OttException {
	name = "MissingMetadataException";

	constructor() {
		super(
			`The video provided is missing metadata required to let playback work correctly (probably length). For best results, reencode the video as an mp4.`
		);
	}
}

export class IncompleteServiceAdapterException extends OttException {}

export class ImpossiblePromotionException extends OttException {
	name = "ImpossiblePromotionException";

	constructor() {
		super(`Can't promote/demote unregistered user`);
	}
}

export class RoomNotFoundException extends OttException {
	name = "RoomNotFoundException";

	constructor(roomName: string) {
		super(`The room "${roomName}" could not be found.`);
	}
}

export class RoomAlreadyLoadedException extends OttException {
	name = "RoomAlreadyLoadedException";

	constructor(roomName: string) {
		super(`The room "${roomName}" is already loaded.`);
	}
}

export class RoomNameTakenException extends OttException {
	name = "RoomNameTakenException";

	constructor(roomName: string) {
		super(`The room "${roomName}" is taken.`);
	}
}

export class VideoAlreadyQueuedException extends OttException {
	name = "VideoAlreadyQueuedException";

	constructor() {
		super(`Video(s) are already in the queue`);
	}
}

export class VideoNotFoundException extends OttException {
	name = "VideoNotFoundException";

	constructor() {
		super(`Video not found.`);
	}
}

export class BadApiArgumentException extends OttException {
	name = "BadApiArgumentException";
	arg: string;
	reason: string;

	constructor(arg: string, reason: string) {
		super(`Bad argument: ${arg}: ${reason}`);
		this.arg = arg;
		this.reason = reason;
	}
}

export class UnsupportedVideoType extends OttException {
	name = "UnsupportedVideoType";

	constructor(type: string) {
		super(`Unsupported video type: ${type}`);
	}
}

export class ClientNotFoundInRoomException extends OttException {
	name = "ClientNotFoundInRoomException";

	constructor(roomName: string) {
		super(
			`The server was unable to find a client in the room "${roomName}" associated with the session. This might mean that your browser isn't saving cookies, try refreshing. If you aren't connected to the room, reconnect to the room and try again. This could also mean that the room does not exist at all.`
		);
	}
}

/**
 * Used to indicate that something is too short or too long.
 */
export class LengthOutOfRangeException extends OttException {
	name = "LengthOutOfRangeException";

	constructor(thing: string, range: Partial<{ min: number; max: number }>) {
		super("LengthOutOfRangeException");
		if ("min" in range && "max" in range) {
			this.message = `${thing} must be between ${range.min} and ${range.max}.`;
		} else if ("max" in range) {
			this.message = `${thing} must be less than or equal to ${range.max}.`;
		} else if ("min" in range) {
			this.message = `${thing} must be greater than or equal to ${range.min}.`;
		}
	}
}

export class MissingToken extends OttException {
	constructor() {
		super("Missing token");
		this.name = "MissingToken";
	}
}

export class NoEmail extends OttException {
	constructor() {
		super("The account does not have an email address.");
		this.name = "NoEmail";
	}
}

export class InvalidVerifyKey extends OttException {
	constructor() {
		super("Invalid verify key");
		this.name = "InvalidVerifyKey";
	}
}

export class UserNotFound extends OttException {
	constructor() {
		super("User not found");
		this.name = "UserNotFound";
	}
}
