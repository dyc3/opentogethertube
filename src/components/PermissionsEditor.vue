<template>
	<v-container fluid>
		Permissions Editor<br>
		All permissions granted to less privileged users are automatically granted to more privileged users.<br>
		Administrators are granted everything. Room owner is automatically Administrator, and can't be demoted.<br>
		Viewing as: {{ $store.state.permsMeta.roles ? $store.state.permsMeta.roles[currentRole].display : "" }}<br>
		<v-simple-table dense :key="dirty" v-if="$store.state.permsMeta.loaded">
			<thead>
				<tr>
					<th class="text-left">Permission</th>
					<th class="text-left" v-for="i in 5" :key="i">{{ $store.state.permsMeta.roles[i-1] ? $store.state.permsMeta.roles[i-1].display : 0 }}</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="item in permissions" :key="item.name">
					<td>{{ item.name }}</td>
					<td v-for="r in 5" :key="r">
						<v-checkbox v-if="r-1 >= item.minRole && currentRole > r-1" v-model="item[r-1]" :disabled="getLowestGranted(item) < r-1" />
						<v-checkbox v-else v-model="item[r-1]" :disabled="true" />
					</td>
				</tr>
			</tbody>
		</v-simple-table>
		<v-row v-else justify="center">
			<v-progress-circular indeterminate/>
		</v-row>
	</v-container>
</template>

<script>
import _ from "lodash";
import PermissionsMixin from "@/mixins/permissions.js";

export default {
	name: "permissions-editor",
	props: {
		value: { type: Object, required: true, default: () => {} },
		currentRole: { type: Number, default: 4 },
	},
	mixins: [PermissionsMixin],
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
	methods: {
		/**
		 * Gets the id of the lowest role with this permission granted.
		 */
		getLowestGranted(permission) {
			let value = _.min(_.keys(_.pickBy(permission, v => v === true)));
			if (value !== undefined) {
				return parseInt(value);
			}
			else {
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
			}
			else {
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
				this.permissions = this.extractFromGrants(this.value);
			}
			else {
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

<style>

</style>
