<template>
	<v-container fluid>
		{{ $t("permissions-editor.title") }}<br />
		{{ $t("permissions-editor.text1") }}<br />
		{{ $t("permissions-editor.text2") }}<br />
		{{ $t("permissions-editor.viewing-as") }}: {{ $t(`roles.${currentRole}`) }}<br />
		<v-table density="compact">
			<thead>
				<tr>
					<th class="text-left" scope="col">{{ $t("permissions-editor.permission") }}</th>
					<th class="text-left" scope="col">
						{{ $t(`roles.${Role.UnregisteredUser}`) }}
					</th>
					<th class="text-left" scope="col">{{ $t(`roles.${Role.RegisteredUser}`) }}</th>
					<th class="text-left" scope="col">{{ $t(`roles.${Role.TrustedUser}`) }}</th>
					<th class="text-left" scope="col">{{ $t(`roles.${Role.Moderator}`) }}</th>
					<th class="text-left" scope="col">{{ $t(`roles.${Role.Administrator}`) }}</th>
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
							@update:model-value="onCheckboxModified"
							:data-cy="`perm-chk-${item.name}-${r - 1}`"
						/>
						<v-checkbox
							v-else
							v-model="item[r - 1]"
							:disabled="true"
							:data-cy="`perm-chk-${item.name}-${r - 1}`"
						/>
					</td>
				</tr>
			</tbody>
		</v-table>
	</v-container>
</template>

<script lang="ts" setup>
import _ from "lodash";
import { Role } from "ott-common/models/types";
import { Grants, PERMISSIONS, Permission } from "ott-common/permissions";
import { Ref, ref, toRefs, watch } from "vue";
import { useGrants } from "./composables/grants";

const model = defineModel<Grants>({ required: true, validator: val => val instanceof Grants });
const props = withDefaults(
	defineProps<{
		modelValue: Grants;
		currentRole: number;
	}>(),
	{
		currentRole: 4,
	}
);
const { currentRole } = toRefs(props);

const permissions: Ref<Permission[]> = ref(extractFromGrants(props.modelValue));
const granted = useGrants();

const rolePerms = {
	[Role.Moderator]: "configure-room.set-permissions.for-moderator",
	[Role.TrustedUser]: "configure-room.set-permissions.for-trusted-users",
	[Role.RegisteredUser]: "configure-room.set-permissions.for-all-registered-users",
	[Role.UnregisteredUser]: "configure-room.set-permissions.for-all-unregistered-users",
};

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

watch(model, value => {
	console.log("model changed", value);
	permissions.value = extractFromGrants(value);
});

function onCheckboxModified() {
	const masks = rebuildMasks();
	permissions.value = extractFromGrants(masks);
	model.value = masks;
}
</script>
