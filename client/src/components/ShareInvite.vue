<template>
	<div class="share-invite">
		<Card class="border-line-strong">
			<CardHeader>
				<CardTitle class="text-2xl tracking-wide">
					{{ $t("share-invite.title") }}
				</CardTitle>
			</CardHeader>
			<CardContent class="flex flex-col gap-3">
				<p class="text-sm text-muted-foreground">{{ $t("share-invite.text") }}</p>
				<Field>
					<div class="flex items-center gap-2">
						<Input
							ref="inviteLinkText"
							readonly
							:model-value="inviteLink"
							:class="copySuccess ? 'text-success' : ''"
							class="font-mono"
							data-cy="share-invite-link"
							@focus="onFocusHighlightText"
						/>
						<Button
							variant="signal"
							size="icon"
							type="button"
							:aria-label="$t('share-invite.title')"
							@click="copyInviteLink"
						>
							<Icon :icon="mdiClipboardOutline" class="size-5" />
						</Button>
					</div>
					<FieldDescription v-if="copySuccess" class="text-success">
						{{ $t("share-invite.copied") }}
					</FieldDescription>
				</Field>
			</CardContent>
		</Card>
	</div>
</template>

<script lang="ts" setup>
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { mdiClipboardOutline } from "@mdi/js";
import { ref, computed } from "vue";
import { useStore } from "@/store";
import { useCopyFromTextbox } from "./composables";

function buildInviteLink(
	currentLocation: string,
	roomName: string,
	shortUrl: string | undefined,
): string {
	if (shortUrl !== undefined) {
		return `https://${shortUrl}/${roomName}`;
	}
	return currentLocation.split("?")[0].toLowerCase();
}

const store = useStore();

const inviteLinkText = ref();

function getInviteLink() {
	return buildInviteLink(window.location.href, store.state.room.name, store.state.shortUrl);
}
const inviteLink = computed(getInviteLink);

function onFocusHighlightText(e) {
	e.target.select();
}

const { copy: copyInviteLink, copySuccess } = useCopyFromTextbox(inviteLink, inviteLinkText);
</script>
