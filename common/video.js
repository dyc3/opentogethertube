import _ from "lodash";

/**
 * Represents a video on any video providing service.
 */
export default class Video {
	constructor(args=undefined) {
		this.service = null;
		this.id = null;
		this.title = null;
		this.description = null;
		this.thumbnail = null;
		this.length = null;
		this.mime = null;
		if (args) {
			Object.assign(this, args);
		}

		// eslint-disable-next-line array-bracket-newline
		if (["youtube", "vimeo", "dailymotion"].includes(this.service)) {
			delete this.mime;
		}
		// eslint-disable-next-line array-bracket-newline
		else if (["googledrive"].includes(this.service)) {
			delete this.description;
		}
	}

	get url() {
		return this.id;
	}

	set url(value) {
		this.id = value;
	}

	/**
	 * Merges together 2 video's metadata, favoring video B's info if there is a conflict. Service and ID must match.
	 * @param {Video} a A video object
	 * @param {Video} b Another video object
	 * @returns A new video object
	 */
	static merge(a, b) {
		if (a.service !== b.service || a.id !== b.id) {
			throw new Error("Both video's service and id must match in order to merge");
		}

		return Object.assign(_.cloneDeep(a), _.pickBy(b, x => x));
	}
}
