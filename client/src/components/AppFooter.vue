<template>
	<footer class="border-t pt-8 text-center">
		<p class="label-mono text-muted-foreground">
			{{ new Date().getFullYear() }} —
			<a href="https://carsonmcmanus.com/">Carson McManus</a> — {{ $t("footer.made-in") }} —
			{{ $t("footer.thanks-to") }} <a href="https://softe.club">SEC</a> @ Stevens
		</p>
		<p class="mt-3 flex justify-center gap-4 label-mono">
			<router-link v-if="isOfficialSite()" to="/privacypolicy">{{
				$t("footer.privacy-policy")
			}}</router-link>
			<router-link to="/attribution">{{ $t("footer.attribution") }}</router-link>
		</p>
		<p class="mt-3 font-mono text-xs text-dim">{{ gitCommit }}</p>
	</footer>
</template>

<script lang="ts" setup>
import { isOfficialSite } from "@/util/misc";

const gitCommit = __COMMIT_HASH__;
</script>
