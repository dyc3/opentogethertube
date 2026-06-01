<template>
	<div class="mx-auto max-w-3xl px-6 py-16">
		<span class="label-mono text-signal">{{ $t("attribution.eyebrow") }}</span>
		<h1 class="font-display mt-2 text-4xl tracking-wide">{{ $t("footer.attribution") }}</h1>
		<Separator class="my-6" />
		<p class="text-muted-foreground">
			{{ $t("attribution.sponsorblock-text") }}
			<a href="https://sponsor.ajay.app" class="text-signal hover:text-primary"
				>https://sponsor.ajay.app</a
			>
		</p>
	</div>
</template>

<script setup lang="ts">
import { Separator } from "@/components/ui/separator";
</script>
