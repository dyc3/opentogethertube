<template>
	<div class="home">
		<!-- HERO -->
		<section class="hero ott-vignette">
			<HeroShader aria-hidden="true" />
			<div
				class="relative z-10 mx-auto flex min-h-[88vh] max-w-5xl flex-col justify-center px-6 py-24"
			>
				<span class="label-mono mb-6 flex items-center gap-3 text-primary">
					<span
						class="inline-block size-2 animate-pulse rounded-full bg-primary shadow-[0_0_10px_var(--primary)]"
					></span>
					Now showing · No sign-up required
				</span>
				<h1 class="hero-title marquee-flicker">
					{{ $t("landing.hero.title") }}
				</h1>
				<p class="mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
					{{ $t("landing.hero.description") }}
				</p>
				<div class="mt-10 flex flex-col gap-4 sm:flex-row">
					<Button variant="default" size="xl" @click="createTempRoom">
						<Icon :icon="mdiPlay" class="size-5" />
						{{ $t("landing.hero.btns.create") }}
					</Button>
					<Button variant="marquee" size="xl" as-child>
						<router-link to="/rooms">{{ $t("landing.hero.btns.browse") }}</router-link>
					</Button>
					<Button variant="ghost" size="xl" as-child>
						<a href="https://github.com/dyc3/opentogethertube">
							<Icon :icon="mdiGithub" class="size-5" />
							{{ $t("landing.hero.btns.source") }}
						</a>
					</Button>
				</div>
			</div>
			<div class="hero-filmstrip" aria-hidden="true"></div>
		</section>

		<!-- CONTENT -->
		<div class="mx-auto max-w-6xl px-6 py-20">
			<!-- intro -->
			<section class="mb-24 max-w-3xl">
				<h2 class="section-title">{{ $t("landing.intro.title") }}</h2>
				<div class="mt-6 flex flex-col gap-4 text-muted-foreground">
					<p>
						<strong class="text-foreground">{{ $t("landing.intro.name") }}</strong>
						{{ $t("landing.intro.text1") }}
					</p>
					<p>{{ $t("landing.intro.text2") }}</p>
					<p>
						{{ $t("landing.intro.text3") }}
						<a
							href="https://github.com/dyc3/opentogethertube/labels/service%20support%20request"
							>{{ $t("landing.intro.link") }}</a
						>.
					</p>
				</div>
			</section>

			<!-- features -->
			<section class="mb-24">
				<h2 class="section-title mb-10">{{ $t("landing.features.title") }}</h2>
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<article
						v-for="(feat, i) in features"
						:key="feat.key"
						class="feature-card"
						:style="{ animationDelay: `${i * 70}ms` }"
					>
						<Icon :icon="feat.icon" class="size-7 text-primary" />
						<h3 class="mt-4 text-2xl tracking-wide">
							{{ $t(`landing.features.${feat.key}.title`) }}
						</h3>
						<p class="mt-2 text-sm leading-relaxed text-muted-foreground">
							{{ $t(`landing.features.${feat.key}.text`) }}
						</p>
						<span class="feature-index label-mono">{{
							String(i + 1).padStart(2, "0")
						}}</span>
					</article>
				</div>
			</section>

			<!-- support -->
			<section class="mb-20 grid gap-10 md:grid-cols-2 md:items-center">
				<div>
					<h2 class="section-title">{{ $t("landing.support.title") }}</h2>
					<p class="mt-6 text-muted-foreground">
						<strong class="text-foreground">{{
							$t("landing.support.description1")
						}}</strong>
						{{ $t("landing.support.description2") }}
					</p>
				</div>
				<div class="flex flex-col gap-3">
					<h3 class="text-xl tracking-wide text-muted-foreground">
						{{ $t("landing.support.how") }}
					</h3>
					<Button variant="default" size="lg" class="w-full" as-child>
						<a href="https://github.com/sponsors/dyc3" target="_blank">
							<Icon :icon="mdiHeart" class="size-5" />
							{{ $t("landing.support.sponsor") }}
						</a>
					</Button>
					<Button variant="signal" size="lg" class="w-full" as-child>
						<a href="https://github.com/dyc3/opentogethertube" target="_blank">
							<Icon :icon="mdiXml" class="size-5" />
							{{ $t("landing.support.contribute") }}
						</a>
					</Button>
				</div>
			</section>

			<p class="mb-10 text-sm italic text-dim">{{ $t("footer.disclaimer") }}</p>

			<!-- footer -->
			<footer class="border-t border-line pt-8 text-center">
				<p class="label-mono text-muted-foreground">
					{{ new Date().getFullYear() }} —
					<a href="https://carsonmcmanus.com/">Carson McManus</a> —
					{{ $t("footer.made-in") }} — {{ $t("footer.thanks-to") }}
					<a href="https://softe.club">SEC</a> @ Stevens
				</p>
				<p class="mt-3 flex justify-center gap-4 label-mono">
					<router-link v-if="isOfficialSite()" to="/privacypolicy">{{
						$t("footer.privacy-policy")
					}}</router-link>
					<router-link to="/attribution">{{ $t("footer.attribution") }}</router-link>
				</p>
				<p class="mt-3 text-xs text-dim font-mono">{{ gitCommit }}</p>
			</footer>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
	mdiHeart,
	mdiXml,
	mdiPlay,
	mdiGithub,
	mdiSync,
	mdiPin,
	mdiWeatherNight,
	mdiShieldLock,
	mdiVote,
	mdiContentCopy,
} from "@mdi/js";
import { defineAsyncComponent } from "vue";
import { createRoomHelper } from "@/util/roomcreator";
import { useStore } from "@/store";
import { isOfficialSite } from "@/util/misc";

// Lazy-loaded: pulls in the shaders/three.js bundle as its own chunk so it
// doesn't bloat the landing page's initial JS. The .hero CSS gradient shows
// as a fallback until the shader chunk loads and the canvas mounts.
const HeroShader = defineAsyncComponent(() => import("@/components/HeroShader.vue"));

const store = useStore();

const gitCommit = __COMMIT_HASH__;

const features = [
	{ key: "synchronized-playback", icon: mdiSync },
	{ key: "permanent-rooms", icon: mdiPin },
	{ key: "dark-theme", icon: mdiWeatherNight },
	{ key: "room-permissions", icon: mdiShieldLock },
	{ key: "voting-system", icon: mdiVote },
	{ key: "playlist-copying", icon: mdiContentCopy },
];

async function createTempRoom() {
	await createRoomHelper(store);
}
</script>

<style scoped>
.home {
	width: 100%;
}

/* ── hero ── */
.hero {
	position: relative;
	overflow: hidden;
	background: radial-gradient(
			60% 50% at 50% 0%,
			color-mix(in srgb, var(--primary) 10%, transparent),
			transparent 70%
		),
		var(--ink);
	border-bottom: 1px solid var(--line-strong);
}
.hero-filmstrip {
	position: absolute;
	bottom: 0;
	left: 0;
	right: 0;
	height: 18px;
	background: repeating-linear-gradient(to right, var(--primary) 0 14px, transparent 14px 34px);
	opacity: 0.5;
	mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
}
.hero-title {
	font-family: var(--font-display);
	font-size: clamp(3.5rem, 11vw, 8rem);
	line-height: 0.88;
	letter-spacing: 0.01em;
	color: var(--primary);
	text-shadow: 0 0 24px color-mix(in srgb, var(--primary) 45%, transparent),
		0 0 2px var(--primary);
}

/* ── sections ── */
.section-title {
	font-family: var(--font-display);
	font-size: clamp(2rem, 5vw, 3rem);
	letter-spacing: 0.02em;
	position: relative;
	padding-left: 1rem;
}
.section-title::before {
	content: "";
	position: absolute;
	left: 0;
	top: 0.1em;
	bottom: 0.1em;
	width: 4px;
	background: var(--primary);
	box-shadow: 0 0 12px var(--primary);
}

/* ── feature cards ── */
.feature-card {
	position: relative;
	overflow: hidden;
	border: 1px solid var(--line);
	border-radius: var(--radius-lg);
	background: linear-gradient(160deg, var(--card), var(--background));
	padding: 1.75rem;
	box-shadow: var(--shadow-panel);
	transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
	animation: ott-fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.feature-card:hover {
	border-color: color-mix(in srgb, var(--primary) 55%, transparent);
	transform: translateY(-4px);
	box-shadow: var(--shadow-panel), var(--glow-primary);
}
.feature-card h3 {
	font-family: var(--font-display);
	color: var(--foreground);
}
.feature-index {
	position: absolute;
	top: 1rem;
	right: 1.1rem;
	color: var(--text-dim, var(--muted-foreground));
	opacity: 0.5;
}
</style>
