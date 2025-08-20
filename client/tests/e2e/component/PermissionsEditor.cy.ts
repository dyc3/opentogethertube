import { Role } from "ott-common";
import { Grants } from "ott-common/permissions";
import PermissionsEditor from "../../../src/components/PermissionsEditor.vue";

// biome-ignore lint/correctness/noUnusedVariables: biome migration
function getPermissionCheckbox(permission: string, role: Role) {
	return cy.get(`[data-cy="perm-chk-${permission}-${role}"] input`);
}

describe("<PermissionsEditor />", () => {
	it("should render grants correctly", () => {
		const grants = new Grants();
		grants.setRoleGrants(Role.UnregisteredUser, (1 << 0) | (1 << 1));

		cy.mount(PermissionsEditor, {
			props: {
				modelValue: grants,
				currentRole: 4,
			},
		}).as("wrapper");
		cy.getPermissionCheckbox("playback.play-pause", Role.UnregisteredUser).should("be.checked");
		cy.getPermissionCheckbox("playback.skip", Role.UnregisteredUser).should("not.be.checked");
		cy.getPermissionCheckbox("playback.play-pause", Role.RegisteredUser).should("be.checked");
		cy.getPermissionCheckbox("playback.skip", Role.RegisteredUser).should("be.checked");
		cy.getPermissionCheckbox("playback.seek", Role.RegisteredUser).should("not.be.checked");

		grants.setRoleGrants(Role.UnregisteredUser, 1 << 0);
		grants.setRoleGrants(Role.RegisteredUser, 1 << 1);
		cy.setProps({ modelValue: grants });

		cy.getPermissionCheckbox("playback.play-pause", Role.UnregisteredUser).should("be.checked");
		cy.getPermissionCheckbox("playback.skip", Role.UnregisteredUser).should("not.be.checked");
		cy.getPermissionCheckbox("playback.play-pause", Role.RegisteredUser).should("be.checked");
		cy.getPermissionCheckbox("playback.skip", Role.RegisteredUser).should("be.checked");
		cy.getPermissionCheckbox("playback.seek", Role.RegisteredUser).should("not.be.checked");
	});

	it("should handle clicking checkboxes", () => {
		const grants = new Grants();
		grants.setRoleGrants(Role.UnregisteredUser, (1 << 0) | (1 << 1));

		cy.mount(PermissionsEditor, {
			props: {
				modelValue: grants,
				currentRole: 4,
			},
		}).as("wrapper");

		cy.getPermissionCheckbox("playback.play-pause", Role.UnregisteredUser).click();
		cy.getPermissionCheckbox("playback.play-pause", Role.UnregisteredUser).should(
			"not.be.checked"
		);
		cy.getPermissionCheckbox("playback.play-pause", Role.RegisteredUser).should("be.checked");

		cy.getPermissionCheckbox("playback.skip", Role.UnregisteredUser).click();
		cy.getPermissionCheckbox("playback.skip", Role.UnregisteredUser).should("not.be.checked");
		cy.getPermissionCheckbox("playback.skip", Role.RegisteredUser).should("be.checked");
	});
});
