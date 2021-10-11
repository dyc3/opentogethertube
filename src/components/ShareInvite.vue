<template>
	<div class="share-invite">
		<v-card>
			<v-subheader>
				Share Invite
			</v-subheader>
			<v-card-text>
				Copy this link and share it with your friends!
				<v-text-field
					readonly
					outlined
					ref="inviteLinkText"
					:value="inviteLink"
					append-outer-icon="fa-clipboard"
					:success-messages="copyInviteLinkSuccessText"
					@focus="onFocusHighlightText"
					@click:append-outer="copyInviteLink"
				/>
			</v-card-text>
		</v-card>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';
import Component from 'vue-class-component';

@Component({
	name: "ShareInvite",
})
export default class ShareInvite extends Vue {
	copyInviteLinkSuccessText = ""

	get inviteLink() {
		if (process.env.SHORT_URL) {
			return `https://${process.env.SHORT_URL}/${this.$route.params.roomId}`;
		}
		return window.location.href.split('?')[0].toLowerCase();
	}

	copyInviteLink() {
		// @ts-expect-error $el actually does exist
		let textfield = (this.$refs.inviteLinkText.$el as Element).querySelector('input');
		if (!textfield) {
			console.error("failed to copy link: input not found");
			return;
		}
		textfield.select();
		document.execCommand("copy");
		this.copyInviteLinkSuccessText = "Copied!";
		setTimeout(() => {
			this.copyInviteLinkSuccessText = "";
			textfield?.blur();
		}, 3000);
	}

	onFocusHighlightText(e) {
		e.target.select();
	}
}
</script>

<style lang="scss">

</style>
