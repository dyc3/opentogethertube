<template>
	<div class="share-invite">
		<v-card>
			<v-subheader>
				{{ $t("share-invite.title") }}
			</v-subheader>
			<v-card-text>
				{{ $t("share-invite.text") }}
				<v-text-field
					readonly
					outlined
					ref="inviteLinkText"
					:value="inviteLink"
					append-outer-icon="fa-clipboard"
					:success-messages="copySuccess ? $t('share-invite.copied') : ''"
					@focus="onFocusHighlightText"
					@click:append-outer="copyInviteLink"
				/>
			</v-card-text>
		</v-card>
	</div>
</template>

<script lang="ts">
import Vue from "vue";
import Component from "vue-class-component";

@Component({
	name: "ShareInvite",
})
export default class ShareInvite extends Vue {
	copySuccess = false;

	get inviteLink() {
		if (process.env.SHORT_URL) {
			return `https://${process.env.SHORT_URL}/${this.$route.params.roomId}`;
		}
		return window.location.href.split("?")[0].toLowerCase();
	}

	async copyInviteLink() {
		if (navigator.clipboard) {
			await navigator.clipboard.writeText(this.inviteLink);
		}
 else {
			// @ts-expect-error $el actually does exist
			let textfield = (this.$refs.inviteLinkText.$el as Element).querySelector("input");
			if (!textfield) {
				console.error("failed to copy link: input not found");
				return;
			}
			textfield.select();
			document.execCommand("copy");
			setTimeout(() => {
				this.copySuccess = false;
				textfield?.blur();
			}, 3000);
		}
		this.copySuccess = true;
	}

	onFocusHighlightText(e) {
		e.target.select();
	}
}
</script>

<style lang="scss"></style>
