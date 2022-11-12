import { it, describe, expect, beforeEach } from "vitest";
import { buildInviteLink } from "@/components/ShareInvite.vue";

describe("ShareInvite component", () => {
	beforeEach(() => {
		delete process.env.SHORT_URL;
	});

	describe("link building", () => {
		it.each(["http://localhost:8080/room/ligma", "http://localhost:8080/room/ligma?foo=bar"])(
			"should just use the current URL if there is no SHORT_URL",
			current => {
				let result = buildInviteLink(current, "ligma", undefined);
				expect(result).toEqual("http://localhost:8080/room/ligma");
			}
		);

		it("should use SHORT_URL if available", () => {
			let result = buildInviteLink("http://localhost:8080/room/ligma", "ligma", "ottr.cc");
			expect(result).toEqual("https://ottr.cc/ligma");
		});
	});
});
