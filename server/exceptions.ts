import { Url } from "url";

// export type OttException = UnsupportedServiceException | InvalidAddPreviewInputException | OutOfQuotaException | InvalidVideoIdException | FeatureDisabledException | UnsupportedMimeTypeException | LocalFileException | MissingMetadataException | IncompleteServiceAdapterException | PermissionDeniedException | ImpossiblePromotionException | InvalidRoleException | RoomNotFoundException | RoomAlreadyLoadedException | RoomNameTakenException | VideoAlreadyQueuedException | VideoNotFoundException | BadApiArgumentException

export class OttException extends Error {}

export class UnsupportedServiceException extends OttException {
	constructor(url: Url) {
		let msg = "";
		if (/\/*\.([a-z0-9])$/i.exec(url.path!.split("?")[0])) {
			msg = `If this is a direct link to a video file, please open a "service support request" issue on github, so we can see if this file format works. Otherwise, the service at "${url.host}" is not yet supported.`;
		}
		else {
			msg = `The service at "${url.host}" is not yet supported.`;
		}
		super(msg);
		this.name = "UnsupportedServiceException";
	}
}

export class InvalidAddPreviewInputException extends OttException {
	name = "InvalidAddPreviewInputException";

	constructor(minLength: number) {
		super(`Your search query must at least ${minLength} characters, or supply a Youtube video, playlist, or channel link.`);
	}
}

export class OutOfQuotaException extends OttException {
	constructor(service: string) {
		if (service === "youtube") {
			super(`We don't have enough Youtube API quota to complete the request. We currently have a limit of 50,000 quota per day.`);
		}
		else if (service === "googledrive") {
			super(`We don't have enough Google Drive API quota to complete the request.`);
		}
		else {
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
		}
		else {
			super(`The requested resource was not actually a video, it was a ${mime}`);
		}
		this.name = "UnsupportedMimeTypeException";
	}
}

export class LocalFileException extends OttException {
	name = "LocalFileException";

	constructor() {
		super(`The video URL provided references a local file. It is not possible to play videos on your computer, nor files located on the server. Videos must be hosted somewhere all users in the room can access.`);
	}
}

export class MissingMetadataException extends OttException {
	name = "MissingMetadataException";

	constructor() {
		super(`The video provided is missing metadata required to let playback work correctly (probably length). For best results, reencode the video as an mp4.`);
	}
}

export class IncompleteServiceAdapterException extends OttException {
}

export class PermissionDeniedException extends OttException {
	name = "PermissionDeniedException";

	constructor(permission: string) {
		super(`Permission denied: ${permission}`);
	}
}

export class ImpossiblePromotionException extends OttException {
	name = "ImpossiblePromotionException";

	constructor() {
		super(`Can't promote/demote unregistered user`);
	}
}

export class InvalidRoleException extends OttException {
	name = "InvalidRoleException";

	constructor(role: any) {
		super(`Role ${role} (type: ${typeof role}) is not valid.`);
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

	constructor(title: string) {
		super(`The video "${title}" is already in the queue`);
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
	arg: string
	reason: string

	constructor(arg: string, reason: string) {
		super(`Bad argument: ${arg}: ${reason}`);
		this.arg = arg;
		this.reason = reason;
	}
}
