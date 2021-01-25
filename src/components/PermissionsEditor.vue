<template>
	<v-container fluid>
		Permissions Editor<br>
		All permissions granted to less privileged users are automatically granted to more privileged users.<br>
		Administrators are granted everything. Room owner is automatically Administrator, and can't be demoted.<br>
		Viewing as: {{ roleNames[currentRole] }}<br>
		<v-simple-table dense :key="dirty" v-if="!isLoading && hasMetadata">
			<thead>
				<tr v-if="hasMetadata && !!roleNames">
					<th class="text-left">Permission</th>
					<th class="text-left" v-for="(role, index) in roleNames" :key="index">{{ role }}</th>
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
import { API } from "@/common-http.js";

export default {
	name: "permissions-editor",
	props: {
		value: { type: Object, required: true, default: () => {} },
		currentRole: { type: Number, default: 4 },
	},
	data() {
		return {
			roleNames: {},
			permissionMeta: [],
			permissions: [],
			dirty: false,
			shouldAcceptExternalUpdate: true,
			isLoading: false,
			hasMetadata: false,
		};
	},
	async created() {
		if (!this.hasMetadata) {
			await this.fetchMetadata();
		}
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
			for (let i = 0; i < this.permissionMeta.length; i++) {
				let perm = {
					name: this.permissionMeta[i].name,
					minRole: this.permissionMeta[i].minRole,
				};
				for (let role = 4; role >= 0; role--) {
					let fullmask = grants[role];
					for (let r = role - 1; r >= 0; r--) {
						fullmask |= grants[r];
					}
					this.$set(perm, role, (fullmask & 1<<i) > 0);
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
				grants[lowest] |= 1<<i;
			}
			return grants;
		},
		async fetchMetadata() {
			console.log("fetching permissions metadata");
			this.isLoading = true;
			let resp = await API.get("/data/permissions");
			let meta = resp.data;
			this.permissionMeta = meta.permissions;
			for (let i = 0; i < meta.roles.length; i++) {
				const role = meta.roles[i];
				if (role.id < 0) {
					continue;
				}
				this.roleNames[role.id] = role.display;
			}
			console.log("permissions metadata fetched");
			this.isLoading = false;
			this.hasMetadata = true;
		},
		waitForMetadata() {
			let _this = this;
			return new Promise(resolve => {
				(function wait() {
					if (_this.hasMetadata) {
						return resolve();
					}
					setTimeout(wait, 30);
				})();
			});
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
