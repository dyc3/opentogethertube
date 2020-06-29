<template>
	<v-container fluid>
		Permissions Editor<br>
		All permissions granted to less privaledged users are automatically granted to more privaledged users.<br>
		Administrators are granted everything. Room owner is automatically Administrator, and can't be demoted.<br>
		Viewing as: {{ roleNames[currentRole] }}<br>
		<v-simple-table dense :key="dirty">
			<thead>
				<tr>
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
	</v-container>
</template>

<script>
import _ from "lodash";

export default {
	name: "permissions-editor",
	props: {
		value: { type: Object, required: true, default: () => {} },
		currentRole: { type: Number, default: 4 },
	},
	data() {
		return {
			// HACK: roles should be grabbed from room API
			roleNames: {
				4: "Administrator",
				3: "Moderator",
				2: "Trusted User",
				1: "Registered User",
				0: "Unregistered User",
			},
			// HACK: available permissions should be grabbed from data/permissions API
			permissionMeta: [
				{ name: "playback.play-pause", minRole: 0 },
				{ name: "playback.skip", minRole: 0 },
				{ name: "playback.seek", minRole: 0 },
				{ name: "manage-queue.add", minRole: 0 },
				{ name: "manage-queue.remove", minRole: 0 },
				{ name: "manage-queue.order", minRole: 0 },
				{ name: "manage-queue.vote", minRole: 0 },
				{ name: "chat", minRole: 0 },
				{ name: "configure-room.set-title", minRole: 0 },
				{ name: "configure-room.set-description", minRole: 0 },
				{ name: "configure-room.set-visibility", minRole: 0 },
				{ name: "configure-room.set-queue-mode", minRole: 0 },
				{ name: "configure-room.set-permissions.for-moderator", minRole: 4 },
				{ name: "configure-room.set-permissions.for-trusted-users", minRole: 3 },
				{ name: "configure-room.set-permissions.for-all-registered-users", minRole: 2 },
				{ name: "configure-room.set-permissions.for-all-unregistered-users", minRole: 1 },
				{ name: "manage-users.promote-admin", minRole: 4 },
				{ name: "manage-users.demote-admin", minRole: 4 },
				{ name: "manage-users.promote-moderator", minRole: 3 },
				{ name: "manage-users.demote-moderator", minRole: 3 },
				{ name: "manage-users.promote-trusted-user", minRole: 2 },
				{ name: "manage-users.demote-trusted-user", minRole: 2 },
			],
			permissions: [],
			dirty: false,
			shouldAcceptExternalUpdate: true,
		};
	},
	created() {
		this.permissions = this.extractFromGrants(this.value);
	},
	methods: {
		/**
		 * Gets the id of the lowest role with this permission granted.
		 */
		getLowestGranted(permission) {
			return _.min(_.keys(_.pickBy(permission, v => v === true))) || "4";
		},
		/**
		 * Gets the id of the highest role with this permission denied.
		 */
		getHighestDenied(permission) {
			return _.min([_.max(_.keys(_.pickBy(permission, v => v === false))) || "3", "3"]);
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
	},
	watch: {
		value() {
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
