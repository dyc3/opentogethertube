const Video = require("../../../common/video.js");

describe.skip('Video spec', () => {
	it('should merge videos without failing', () => {
		let a = new Video({ service: "fake", id: "123", title: "fake title" });
		let b = new Video({ service: "fake", id: "123", title: "fake title", length: 10 });

		expect(Video.merge(a, b)).toEqual(new Video({
			service: "fake",
			id: "123",
			title: "fake title",
			length: 10,
		}));
	});

	it('should fail to merge videos because service does not match', () => {
		let a = new Video({ service: "fake", id: "123", title: "fake title" });
		let b = new Video({ service: "fake2", id: "123", length: 10 });

		expect(() => {
			Video.merge(a, b);
		}).toThrow();
	});

	it('should fail to merge videos because id does not match', () => {
		let a = new Video({ service: "fake", id: "123", title: "fake title" });
		let b = new Video({ service: "fake", id: "456", length: 10 });

		expect(() => {
			Video.merge(a, b);
		}).toThrow();
	});

	it('should favor video B information', () => {
		let a = new Video({ service: "fake", id: "123", length: 10 });
		let b = new Video({ service: "fake", id: "123", length: 14 });

		expect(Video.merge(a, b)).toEqual(new Video({
			service: "fake",
			id: "123",
			length: 14,
		}));
	});

	it('should not override with null values', () => {
		let a = new Video({ service: "fake", id: "123", title: "fake" });
		let b = new Video({ service: "fake", id: "123" });

		expect(Video.merge(a, b)).toEqual(new Video({
			service: "fake",
			id: "123",
			title: "fake",
		}));
	});
});
