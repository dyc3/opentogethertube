<template>
	<v-container fluid>
		{{ $t("permissions-editor.title") }}<br />
		{{ $t("permissions-editor.text1") }}<br />
		{{ $t("permissions-editor.text2") }}<br />
		{{ $t("permissions-editor.viewing-as") }}: {{ ROLE_DISPLAY_NAMES[currentRole] }}<br />
		<v-table density="compact" :key="updateEpoch">
			<thead>
				<tr>
					<th class="text-left" scope="col">{{ $t("permissions-editor.permission") }}</th>
					<th class="text-left" scope="col" v-for="i in 5" :key="i">
						{{ ROLE_NAMES[i - 1] ? ROLE_DISPLAY_NAMES[i - 1] : 0 }}
					</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="item in permissions" :key="item.name">
					<th scope="row">{{ item.name }}</th>
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
	ROLE_DISPLAY_NAMES,
	Permission,
	RoleGrants,
	OldRoleGrants,
} from "common/permissions";
import { Role } from "common/models/types";

export const PermissionsEditor = defineComponent({
	name: "PermissionsEditor",
	props: {
		modelValue: {
			type: [Object, Array] as PropType<RoleGrants | OldRoleGrants>,
			required: true,
		},
		currentRole: { type: Number, default: 4 },
	},
	emits: ["update:modelValue"],
	setup(props, { emit }) {
		let permissions: Ref<Permission[]> = ref([]);
		let dirty = ref(false);
		let shouldAcceptExternalUpdate = ref(true);
		let isLoading = ref(false);
		let updateEpoch = ref(0);

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
		function getLowestGranted(permission) {
			let value = _.min(_.keys(_.pickBy(permission, v => v === true)));
			if (value !== undefined) {
				return parseInt(value);
			} else {
				return 4;
			}
		}

		/**
		 * Gets the id of the highest role with this permission denied.
		 */
		function getHighestDenied(permission) {
			let value = _.max(_.keys(_.pickBy(permission, v => v === false)));
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

		function extractFromGrants(grants): Permission[] {
			let extracted: Permission[] = [];
			for (let i = 0; i < PERMISSIONS.length; i++) {
				let perm = PERMISSIONS[i];
				for (let role = 4; role >= 0; role--) {
					let fullmask = grants[role];
					for (let r = role - 1; r >= 0; r--) {
						fullmask |= grants[r];
					}
					perm[role] = (fullmask & perm.mask) > 0;
				}
				extracted.push(perm);
			}
			return extracted;
		}

		function rebuildMasks() {
			let grants = {};
			for (let role = 4; role >= 0; role--) {
				grants[role] = 0;
			}
			for (let i = 0; i < PERMISSIONS.length; i++) {
				let lowest = getLowestGranted(permissions.value[i]);
				grants[lowest] |= PERMISSIONS[i].mask;
			}
			return grants;
		}

		watch(props, () => {
			if (shouldAcceptExternalUpdate.value) {
				dirty.value = false;
				updateEpoch.value++;
				// HACK: coerce to OldRoleGrants format
				let grants = props.modelValue;
				if (Array.isArray(grants)) {
					grants = _.fromPairs(grants);
				}
				permissions.value = extractFromGrants(grants);
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
			ROLE_DISPLAY_NAMES,
			getLowestGranted,
			getHighestDenied,
			rolePerms,
		};
	},
});

export default PermissionsEditor;
</script>
