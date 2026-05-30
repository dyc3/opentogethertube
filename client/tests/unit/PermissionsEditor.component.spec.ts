import { describe, expect, it } from "vitest";
import { Role } from "ott-common";
import { Grants } from "ott-common/permissions";
import PermissionsEditor from "@/components/PermissionsEditor.vue";
import { mountComponent } from "./component-test-utils";

function permissionCheckbox(permission: string, role: Role) {
	return `[data-cy="perm-chk-${permission}-${role}"] input`;
}

describe("PermissionsEditor component", () => {
	it("renders grants correctly", async () => {
		const grants = new Grants();
		grants.setRoleGrants(Role.UnregisteredUser, (1 << 0) | (1 << 1));
		const { wrapper } = mountComponent(PermissionsEditor, {
			props: { modelValue: grants, currentRole: 4 },
		});

		expect(
			(
				wrapper.get(permissionCheckbox("playback.play-pause", Role.UnregisteredUser))
					.element as HTMLInputElement
			).checked,
		).toBe(true);
		expect(
			(
				wrapper.get(permissionCheckbox("playback.skip", Role.UnregisteredUser))
					.element as HTMLInputElement
			).checked,
		).toBe(true);
		expect(
			(
				wrapper.get(permissionCheckbox("playback.play-pause", Role.RegisteredUser))
					.element as HTMLInputElement
			).checked,
		).toBe(true);
		expect(
			(
				wrapper.get(permissionCheckbox("playback.skip", Role.RegisteredUser))
					.element as HTMLInputElement
			).checked,
		).toBe(true);
		expect(
			(
				wrapper.get(permissionCheckbox("playback.seek", Role.RegisteredUser))
					.element as HTMLInputElement
			).checked,
		).toBe(true);

		grants.setRoleGrants(Role.UnregisteredUser, 1 << 0);
		grants.setRoleGrants(Role.RegisteredUser, 1 << 1);
		await wrapper.setProps({ modelValue: grants });

		expect(
			(
				wrapper.get(permissionCheckbox("playback.play-pause", Role.UnregisteredUser))
					.element as HTMLInputElement
			).checked,
		).toBe(true);
		expect(
			(
				wrapper.get(permissionCheckbox("playback.skip", Role.UnregisteredUser))
					.element as HTMLInputElement
			).checked,
		).toBe(true);
		expect(
			(
				wrapper.get(permissionCheckbox("playback.play-pause", Role.RegisteredUser))
					.element as HTMLInputElement
			).checked,
		).toBe(true);
		expect(
			(
				wrapper.get(permissionCheckbox("playback.skip", Role.RegisteredUser))
					.element as HTMLInputElement
			).checked,
		).toBe(true);
		expect(
			(
				wrapper.get(permissionCheckbox("playback.seek", Role.RegisteredUser))
					.element as HTMLInputElement
			).checked,
		).toBe(true);
	});

	it("handles clicking checkboxes", async () => {
		const grants = new Grants();
		grants.setRoleGrants(Role.UnregisteredUser, (1 << 0) | (1 << 1));
		const { wrapper } = mountComponent(PermissionsEditor, {
			props: { modelValue: grants, currentRole: 4 },
		});

		await wrapper
			.get(permissionCheckbox("playback.play-pause", Role.UnregisteredUser))
			.trigger("click");
		expect(
			(
				wrapper.get(permissionCheckbox("playback.play-pause", Role.UnregisteredUser))
					.element as HTMLInputElement
			).checked,
		).toBe(false);
		expect(
			(
				wrapper.get(permissionCheckbox("playback.play-pause", Role.RegisteredUser))
					.element as HTMLInputElement
			).checked,
		).toBe(true);

		await wrapper
			.get(permissionCheckbox("playback.skip", Role.UnregisteredUser))
			.trigger("click");
		expect(
			(
				wrapper.get(permissionCheckbox("playback.skip", Role.UnregisteredUser))
					.element as HTMLInputElement
			).checked,
		).toBe(false);
		expect(
			(
				wrapper.get(permissionCheckbox("playback.skip", Role.RegisteredUser))
					.element as HTMLInputElement
			).checked,
		).toBe(true);
	});
});
