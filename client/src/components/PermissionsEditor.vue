<template>
	<v-container fluid>
		{{ $t("permissions-editor.title") }}<br />
		{{ $t("permissions-editor.text1") }}<br />
		{{ $t("permissions-editor.text2") }}<br />
		{{ $t("permissions-editor.viewing-as") }}: 
		{{ $t(
			(currentRole === -1) ? "permissions-editor.roles.owner" :
			(currentRole === 0) ? "permissions-editor.roles.unregisteredUser" :
			(currentRole === 1) ? "permissions-editor.roles.registeredUser" :
			(currentRole === 2) ? "permissions-editor.roles.trustedUser" :
			(currentRole === 3) ? "permissions-editor.roles.moderator" :
									"permissions-editor.roles.administrator") }}<br />
		<v-table density="compact" :key="updateEpoch">
			<thead>
				<tr>
					<th class="text-left" scope="col">{{ $t("permissions-editor.permission") }}</th>
					<th class="text-left" scope="col">{{ $t("permissions-editor.roles.unregisteredUser") }}</th>
					<th class="text-left" scope="col">{{ $t("permissions-editor.roles.registeredUser") }}</th>
					<th class="text-left" scope="col">{{ $t("permissions-editor.roles.trustedUser") }}</th>
					<th class="text-left" scope="col">{{ $t("permissions-editor.roles.moderator") }}</th>
					<th class="text-left" scope="col">{{ $t("permissions-editor.roles.administrator") }}</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="item in permissions" :key="item.name">
					<th scope="row">{{item.name}}</th>
					<td v-for="r in 5" :key="r">
						<v-checkbox
							v-if="
								r - 1 >= item.minRole &&
								(currentRole > r - 1 || currentRole < 0) &&
								r - 1 < 4 &&
								granted(rolePerms[r - 1])
							"
							v-model="item[r - 1]"
							:disabled="getLowestGranted(item) < r - 1"
							color="primary"
						/>
						<v-checkbox v-else v-model="item[r - 1]" :disabled="true" />
					</td>
				</tr>
			</tbody>
		</v-table>
	</v-container>
</template>

<script lang="ts">
import { defineComponent, ref, Ref, watch, PropType } from "vue";
import _ from "lodash";
import { granted } from "@/util/grants";
import {
	PERMISSIONS,
	ROLE_NAMES,
	Permission,
	Grants,
} from "ott-common/permissions";
import { Role } from "ott-common/models/types";

export const PermissionsEditor = defineComponent({
	name: "PermissionsEditor",
	props: {
		modelValue: {
			type: Object as PropType<Grants>,
			required: true,
			validator: val => {
				return val instanceof Grants;
			},
		},
		currentRole: { type: Number, default: 4 },
	},
	emits: ["update:modelValue"],
	setup(props, { emit }) {
		const permissions: Ref<Permission[]> = ref([]);
		const dirty = ref(false);
		const shouldAcceptExternalUpdate = ref(true);
		const isLoading = ref(false);
		const updateEpoch = ref(0);

		const rolePerms = {
			[Role.Moderator]: "configure-room.set-permissions.for-moderator",
			[Role.TrustedUser]: "configure-room.set-permissions.for-trusted-users",
			[Role.RegisteredUser]: "configure-room.set-permissions.for-all-registered-users",
			[Role.UnregisteredUser]: "configure-room.set-permissions.for-all-unregistered-users",
		};

		permissions.value = extractFromGrants(props.modelValue);

		/**
		 * Gets the id of the lowest role with this permission granted.
		 */
		function getLowestGranted(permission): Role {
			const value = _.min(_.keys(_.pickBy(permission, v => v === true)));
			if (value !== undefined) {
				return parseInt(value);
			} else {
				return 4;
			}
		}

		/**
		 * Gets the id of the highest role with this permission denied.
		 */
		function getHighestDenied(permission): Role | null {
			const value = _.max(_.keys(_.pickBy(permission, v => v === false)));
			if (value !== undefined) {
				let v = parseInt(value);
				if (v === 4) {
					v = 3;
				}
				return v;
			} else {
				return null;
			}
		}

		function extractFromGrants(grants: Grants): Permission[] {
			const extracted: Permission[] = [];
			for (const perm of PERMISSIONS) {
				for (let role = 4; role >= 0; role--) {
					let fullmask = grants.getMask(role);
					for (let r = role - 1; r >= 0; r--) {
						fullmask |= grants[r];
					}
					perm[role] = (fullmask & perm.mask) > 0;
				}
				extracted.push(perm);
			}
			return extracted;
		}

		function rebuildMasks(): Grants {
			const grants = {};
			for (let role = 4; role >= 0; role--) {
				grants[role] = 0;
			}
			for (let i = 0; i < PERMISSIONS.length; i++) {
				const lowest = getLowestGranted(permissions.value[i]);
				grants[lowest] |= PERMISSIONS[i].mask;
			}
			return new Grants(grants);
		}

		watch(props, () => {
			if (shouldAcceptExternalUpdate.value) {
				dirty.value = false;
				updateEpoch.value++;
				permissions.value = extractFromGrants(props.modelValue);
			} else {
				shouldAcceptExternalUpdate.value = true;
			}
		});

		watch(
			permissions,
			() => {
				if (!dirty.value) {
					dirty.value = true;
					shouldAcceptExternalUpdate.value = false;
					permissions.value = extractFromGrants(rebuildMasks());
				}
			},
			{ deep: true }
		);

		watch(dirty, val => {
			if (val) {
				emit("update:modelValue", rebuildMasks());
				dirty.value = false;
			}
		});

		return {
			permissions,
			dirty,
			shouldAcceptExternalUpdate,
			isLoading,
			updateEpoch,
			granted,
			ROLE_NAMES,
			getLowestGranted,
			getHighestDenied,
			rolePerms,
		};
	},
});

export default PermissionsEditor;
</script>
