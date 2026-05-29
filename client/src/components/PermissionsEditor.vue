<template>
	<div class="flex flex-col gap-4">
		<div class="flex flex-col gap-1 text-sm text-muted-foreground">
			<h3 class="font-display text-2xl tracking-wide text-foreground">
				{{ $t("permissions-editor.title") }}
			</h3>
			<p>{{ $t("permissions-editor.text1") }}</p>
			<p>{{ $t("permissions-editor.text2") }}</p>
			<p class="label-mono text-primary">
				{{ $t("permissions-editor.viewing-as") }}: {{ $t(`roles.${currentRole}`) }}
			</p>
		</div>
		<div class="overflow-x-auto rounded-lg border border-line">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead scope="col">{{ $t("permissions-editor.permission") }}</TableHead>
						<TableHead scope="col">{{ $t(`roles.${Role.UnregisteredUser}`) }}</TableHead>
						<TableHead scope="col">{{ $t(`roles.${Role.RegisteredUser}`) }}</TableHead>
						<TableHead scope="col">{{ $t(`roles.${Role.TrustedUser}`) }}</TableHead>
						<TableHead scope="col">{{ $t(`roles.${Role.Moderator}`) }}</TableHead>
						<TableHead scope="col">{{ $t(`roles.${Role.Administrator}`) }}</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					<TableRow v-for="item in permissions" :key="item.name">
						<TableHead scope="row" class="font-mono text-xs whitespace-nowrap">
							{{ item.name }}
						</TableHead>
						<TableCell v-for="r in 5" :key="r">
							<Checkbox
								v-if="
									r - 1 >= item.minRole &&
									(currentRole > r - 1 || currentRole < 0) &&
									r - 1 < 4 &&
									granted(rolePerms[r - 1])
								"
								v-model="item[r - 1]"
								:disabled="getLowestGranted(item) < r - 1"
								:data-cy="`perm-chk-${item.name}-${r - 1}`"
								@update:model-value="onCheckboxModified"
							/>
							<Checkbox
								v-else
								v-model="item[r - 1]"
								:disabled="true"
								:data-cy="`perm-chk-${item.name}-${r - 1}`"
							/>
						</TableCell>
					</TableRow>
				</TableBody>
			</Table>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { ref, type Ref, toRefs, watch } from "vue";
import _ from "lodash";
import { PERMISSIONS, type Permission, Grants } from "ott-common/permissions";
import { Role } from "ott-common/models/types";
import { useGrants } from "./composables/grants";

const model = defineModel<Grants>({ required: true, validator: val => val instanceof Grants });
const props = withDefaults(
	defineProps<{
		modelValue: Grants;
		currentRole: number;
	}>(),
	{
		currentRole: 4,
	},
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
