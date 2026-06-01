<template>
	<div class="flex min-h-[70vh] items-center justify-center px-6 py-16">
		<div class="w-full max-w-md text-center">
			<span class="label-mono text-signal">{{ $t("not-found.eyebrow") }}</span>
			<h1 class="font-display mt-3 text-7xl text-primary text-glow-primary">
				{{ $t("not-found.title") }}
			</h1>
			<div class="mt-10 flex flex-col gap-3">
				<Button variant="default" size="xl" class="w-full" as-child>
					<router-link to="/">{{ $t("not-found.home") }}</router-link>
				</Button>
				<Button variant="marquee" size="xl" class="w-full" as-child>
					<router-link to="/rooms">{{ $t("not-found.browse") }}</router-link>
				</Button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
</script>
