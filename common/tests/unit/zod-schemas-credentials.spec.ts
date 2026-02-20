import { describe, it, expect } from "vitest";
import { OttApiRequestAddToQueueSchema } from "../../models/zod-schemas.js";

describe("OttApiRequestAddToQueueSchema credentials", () => {
	it("should accept a video with credentials", () => {
		const result = OttApiRequestAddToQueueSchema.parse({
			service: "youtube",
			id: "BTZ5KVRUy1Q",
			credentials: { youtube_access_token: "test-token" },
		});
		expect(result).toHaveProperty("credentials");
		expect(result.credentials).toEqual({ youtube_access_token: "test-token" });
	});

	it("should accept a URL with credentials", () => {
		const result = OttApiRequestAddToQueueSchema.parse({
			url: "https://youtube.com/watch?v=BTZ5KVRUy1Q",
			credentials: { youtube_access_token: "test-token" },
		});
		expect(result).toHaveProperty("credentials");
		expect(result.credentials).toEqual({ youtube_access_token: "test-token" });
	});

	it("should accept videos array with credentials", () => {
		const result = OttApiRequestAddToQueueSchema.parse({
			videos: [{ service: "youtube", id: "BTZ5KVRUy1Q" }],
			credentials: { youtube_access_token: "test-token" },
		});
		expect(result).toHaveProperty("credentials");
	});

	it("should accept requests without credentials (backwards compatible)", () => {
		const result = OttApiRequestAddToQueueSchema.parse({
			service: "youtube",
			id: "BTZ5KVRUy1Q",
		});
		expect(result).not.toHaveProperty("credentials");
	});

	it("should accept credentials with no token (empty object)", () => {
		const result = OttApiRequestAddToQueueSchema.parse({
			url: "https://youtube.com/watch?v=BTZ5KVRUy1Q",
			credentials: {},
		});
		expect(result).toHaveProperty("credentials");
	});
});
