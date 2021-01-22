class UnsupportedServiceException extends Error {
	constructor(url) {
		let msg = "";
		if (/\/*\.([a-z0-9])$/i.exec(url.path.split("?")[0])) {
			msg = `If this is a direct link to a video file, please open a "service support request" issue on github, so we can see if this file format works. Otherwise, the service at "${url.host}" is not yet supported.`;
		}
		else {
			msg = `The service at "${url.host}" is not yet supported.`;
		}
		super(msg);
		this.name = "UnsupportedServiceException";
	}
}

class InvalidAddPreviewInputException extends Error {
	constructor(minLength) {
		super(`Your search query must at least ${minLength} characters, or supply a Youtube video, playlist, or channel link.`);
		this.name = "InvalidAddPreviewInputException";
	}
}

class OutOfQuotaException extends Error {
	constructor(service) {
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

class InvalidVideoIdException extends Error {
	constructor(service, id) {
		super(`"${id} is an invalid ${service} video ID."`);
		this.name = "InvalidVideoIdException";
	}
}

class FeatureDisabledException extends Error {
	constructor(reason) {
		super(`Sorry, this feature is disabled: ${reason}`);
		this.name = "FeatureDisabledException";
	}
}

class UnsupportedMimeTypeException extends Error {
	constructor(mime) {
		if (mime.startsWith("video/")) {
			super(`Files that are ${mime} are not supported. Mp4 videos work the best.`);
		}
		else {
			super(`The requested resource was not actually a video, it was a ${mime}`);
		}
		this.name = "UnsupportedMimeTypeException";
	}
}

class LocalFileException extends Error {
	constructor() {
		super(`The video URL provided references a local file. It is not possible to play videos on your computer, nor files located on the server. Videos must be hosted somewhere all users in the room can access.`);
		this.name = "LocalFileException";
	}
}

class MissingMetadataException extends Error {
	constructor() {
		super(`The video provided is missing metadata required to let playback work correctly (probably length). For best results, reencode the video as an mp4.`);
		this.name = "MissingMetadataException";
	}
}

class IncompleteServiceAdapterException extends Error {
}

class PermissionDeniedException extends Error {
	constructor(permission) {
		super(`Permission denied: ${permission}`);
		this.name = "PermissionDeniedException";
	}
}

class ImpossiblePromotionException extends Error {
	constructor() {
		super(`Can't promote/demote unregistered user`);
		this.name = "ImpossiblePromotionException";
	}
}

module.exports = {
	UnsupportedServiceException,
	InvalidAddPreviewInputException,
	OutOfQuotaException,
	InvalidVideoIdException,
	FeatureDisabledException,
	UnsupportedMimeTypeException,
	LocalFileException,
	MissingMetadataException,
	IncompleteServiceAdapterException,
	PermissionDeniedException,
	ImpossiblePromotionException,
};
