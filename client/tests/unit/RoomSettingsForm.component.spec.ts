import { beforeEach, describe, expect, it, vi } from "vitest";
import { Grants, parseIntoGrantMask } from "ott-common/permissions";
import { PlayerStatus, Role } from "ott-common/models/types";
import RoomSettingsForm from "@/components/RoomSettingsForm.vue";
import { flush, mountComponent } from "./component-test-utils";

const { API } = vi.hoisted(() => ({
	API: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("@/common-http", () => ({ API }));

const roomResponse = {
	name: "foo",
	title: "Foo",
	description: "Bar",
	isTemporary: false,
	visibility: "public",
	queueMode: "dj",
	queue: [],
	users: [],
	grants: [
		[0, 2182],
		[1, 2223],
		[2, 2223],
		[3, 2223],
		[4, 4095],
		[-1, 8388607],
	],
	autoSkipSegmentCategories: [],
	restoreQueueBehavior: "prompt",
	enableVoteSkip: false,
	hasOwner: true,
};

function mountRoomSettings(canConfigure = true) {
	API.get.mockResolvedValue({ data: roomResponse });
	const result = mountComponent(RoomSettingsForm);
	result.store.state.room.name = "foo";
	result.store.state.user = { username: "bar", loggedIn: true, discordLinked: false };
	result.store.state.users.users = new Map([
		[
			"1",
			{
				id: "1",
				name: "bar",
				isLoggedIn: true,
				role: canConfigure ? Role.Owner : Role.UnregisteredUser,
				isYou: true,
				status: PlayerStatus.ready,
			},
		],
	]);
	result.store.state.users.you = { id: "1" };
	if (!canConfigure) {
		result.store.state.room.grants = new Grants();
		result.store.state.room.grants.setRoleGrants(
			Role.UnregisteredUser,
			parseIntoGrantMask(["*"]) ^ parseIntoGrantMask(["configure-room"]),
		);
	}
	return result;
}

describe("RoomSettingsForm component", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		API.patch.mockResolvedValue({ data: { success: true } });
	});

	it("renders the submit container", async () => {
		const { wrapper } = mountRoomSettings();
		await flush();
		await flush();

		expect(wrapper.find(".submit").exists()).toBe(true);
	});

	it("fills the form with data from the API", async () => {
		const { wrapper } = mountRoomSettings();
		await flush();
		await flush();

		expect((wrapper.get('[data-cy="input-title"]').element as HTMLInputElement).value).toBe(
			"Foo",
		);
		expect(
			(wrapper.get('[data-cy="input-description"]').element as HTMLInputElement).value,
		).toBe("Bar");
		expect(wrapper.get('[data-cy="select-visibility"]').text()).toContain("Public");
		expect(wrapper.get('[data-cy="select-queueMode"]').text()).toContain("DJ");
	});

	it("submits modified values", async () => {
		API.patch.mockResolvedValue({ data: { success: true } });
		const { wrapper } = mountRoomSettings();
		await flush();

		await wrapper.get('[data-cy="input-title"]').setValue("Baz");
		await wrapper.get('[data-cy="save"]').trigger("click");
		await flush();

		expect(API.patch).toHaveBeenCalled();
	});

	it("disables inputs without permission", async () => {
		const { wrapper } = mountRoomSettings(false);
		await flush();

		expect((wrapper.get('[data-cy="input-title"]').element as HTMLInputElement).disabled).toBe(
			true,
		);
		expect(
			(wrapper.get('[data-cy="input-description"]').element as HTMLInputElement).disabled,
		).toBe(true);
		expect(
			(wrapper.get('[data-cy="select-visibility"]').element as HTMLButtonElement).disabled,
		).toBe(true);
		expect(
			(wrapper.get('[data-cy="select-queueMode"]').element as HTMLButtonElement).disabled,
		).toBe(true);
		expect(
			wrapper.get('[data-cy="input-auto-skip"] [role="checkbox"]').attributes("disabled"),
		).toBe("");
	});
});
