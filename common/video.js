/**
 * Represents a video on any video providing service.
 */
class Video {
	constructor(args=undefined) {
		this.service = "";
		this.id = "";
		this.title = "";
		this.description = "";
		this.thumbnail = "";
		this.length = 0;
		if (args) {
			Object.assign(this, args);
		}
	}
}
