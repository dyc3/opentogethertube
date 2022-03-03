<template>
	<v-container fluid>
		{{ $t("permissions-editor.title") }}<br />
		{{ $t("permissions-editor.text1") }}<br />
		{{ $t("permissions-editor.text2") }}<br />
		{{ $t("permissions-editor.viewing-as") }}:
		{{ $store.state.permsMeta.roles ? $store.state.permsMeta.roles[currentRole].display : ""
		}}<br />
		<v-simple-table dense :key="dirty" v-if="$store.state.permsMeta.loaded">
			<thead>
				<tr>
					<th class="text-left" scope="col">{{ $t("permissions-editor.permission") }}</th>
					<th class="text-left" scope="col" v-for="i in 5" :key="i">
						{{
							$store.state.permsMeta.roles[i - 1]
								? $store.state.permsMeta.roles[i - 1].display
								: 0
						}}
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
						/>
						<v-checkbox v-else v-model="item[r - 1]" :disabled="true" />
					</td>
				</tr>
			</tbody>
		</v-simple-table>
		<v-row v-else justify="center">
			<v-progress-circular indeterminate />
		</v-row>
	</v-container>
</template>

<script>
import _ from "lodash";
import PermissionsMixin from "@/mixins/permissions";

export default {
	name: "permissions-editor",
	props: {
		value: { type: [Object, Array], required: true },
		currentRole: { type: Number, default: 4 },
	},
	mixins: [PermissionsMixin],
	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	data() {
		return {
			permissions: [],
			dirty: false,
			shouldAcceptExternalUpdate: true,
			isLoading: false,
		};
	},
	async created() {
		this.isLoading = true;
		await this.$store.dispatch("updatePermissionsMetadata");
		this.isLoading = false;
		this.permissions = this.extractFromGrants(this.value);
	},
	computed: {
		rolePerms() {
			return {
				3: "configure-room.set-permissions.for-moderator",
				2: "configure-room.set-permissions.for-trusted-users",
				1: "configure-room.set-permissions.for-all-registered-users",
				0: "configure-room.set-permissions.for-all-unregistered-users",
			};
		},
	},
	methods: {
		/**
		 * Gets the id of the lowest role with this permission granted.
		 */
		getLowestGranted(permission) {
			let value = _.min(_.keys(_.pickBy(permission, v => v === true)));
			if (value !== undefined) {
				return parseInt(value);
			} else {
				return 4;
			}
		},
		/**
		 * Gets the id of the highest role with this permission denied.
		 */
		getHighestDenied(permission) {
			let value = _.max(_.keys(_.pickBy(permission, v => v === false)));
			if (value !== undefined) {
				value = parseInt(value);
				if (value === 4) {
					value = 3;
				}
				return value;
			} else {
				return null;
			}
		},
		extractFromGrants(grants) {
			let extracted = [];
			for (let i = 0; i < this.$store.state.permsMeta.permissions.length; i++) {
				let perm = this.$store.state.permsMeta.permissions[i];
				for (let role = 4; role >= 0; role--) {
					let fullmask = grants[role];
					for (let r = role - 1; r >= 0; r--) {
						fullmask |= grants[r];
					}
					this.$set(perm, role, (fullmask & perm.mask) > 0);
				}
				extracted.push(perm);
			}
			return extracted;
		},
		rebuildMasks() {
			let grants = {};
			for (let role = 4; role >= 0; role--) {
				grants[role] = 0;
			}
			for (let i in this.permissions) {
				let lowest = this.getLowestGranted(this.permissions[i]);
				grants[lowest] |= this.$store.state.permsMeta.permissions[i].mask;
			}
			return grants;
		},
	},
	watch: {
		async value() {
			await this.waitForMetadata();
			if (this.shouldAcceptExternalUpdate) {
				this.dirty = false;
				// HACK: coerce to OldRoleGrants format
				let grants = this.value;
				if (Array.isArray(grants)) {
					grants = _.fromPairs(grants);
				}
				this.permissions = this.extractFromGrants(grants);
			} else {
				this.shouldAcceptExternalUpdate = true;
			}
		},
		permissions: {
			deep: true,
			handler() {
				if (!this.dirty) {
					this.dirty = true;
					this.shouldAcceptExternalUpdate = false;
					this.permissions = this.extractFromGrants(this.rebuildMasks());
				}
			},
		},
		dirty(val) {
			if (val) {
				this.$emit("input", this.rebuildMasks());
				this.dirty = false;
			}
		},
	},
};
</script>
