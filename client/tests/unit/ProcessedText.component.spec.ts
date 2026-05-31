import { describe, expect, it } from "vitest";
import ProcessedText from "@/components/ProcessedText.vue";
import { flush, mountComponent } from "./component-test-utils";

describe("ProcessedText component", () => {
	it("renders text as is", async () => {
		const { wrapper } = mountComponent(ProcessedText, { props: { text: "foo" } });
		await flush();

		expect(wrapper.get('[data-cy="processed-text"]').text()).toBe("foo");
	});

	it("renders just the link", async () => {
		const { wrapper } = mountComponent(ProcessedText, {
			props: { text: "https://example.com/" },
		});
		await flush();

		expect(wrapper.get("a").text()).toContain("https://example.com/");
	});

	it("renders text and link", async () => {
		const { wrapper } = mountComponent(ProcessedText, {
			props: { text: "peter https://example.com/ griffin" },
		});
		await flush();

		const children = wrapper.get('[data-cy="processed-text"]').element.children;
		expect(children).toHaveLength(3);
		expect(children[0].textContent).toBe("peter ");
		expect(children[1].textContent).toContain("https://example.com/");
		expect(children[2].textContent).toBe(" griffin");
	});

	it("fires event when link is clicked", async () => {
		const { wrapper } = mountComponent(ProcessedText, {
			props: { text: "https://youtu.be/1q2w3e4r5t6" },
		});
		await flush();

		await wrapper.get("a").trigger("click");

		expect(wrapper.emitted("link-click")).toHaveLength(1);
	});
});
