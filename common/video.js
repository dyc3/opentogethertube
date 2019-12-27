/**
 * Represents a video on any video providing service.
 */
class Video {
	constructor(args=undefined) {
		this.service = null;
		this.id = null;
		this.title = null;
		this.description = null;
		this.thumbnail = null;
		this.length = null;
		if (args) {
			Object.assign(this, args);
		}
	}
}

module.exports = Video;
