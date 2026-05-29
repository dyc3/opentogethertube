<template>
	<TooltipProvider :delay-duration="200">
		<div
			id="app"
			class="ott-grain ott-scanlines relative flex min-h-screen flex-col bg-background text-foreground"
		>
		<!-- ░░ MARQUEE HEADER ░░ -->
		<header
			v-show="!fullscreen"
			class="sticky top-0 z-40 border-b border-line-strong bg-background/85 backdrop-blur-md"
		>
			<div class="flex h-16 items-center gap-3 px-4 md:px-6">
				<!-- mobile menu -->
				<Button
					variant="ghost"
					size="icon"
					class="lg:hidden"
					aria-label="nav menu"
					@click="drawer = true"
				>
					<Icon :icon="mdiMenu" class="size-6" />
				</Button>

				<router-link to="/" class="group flex items-center gap-3">
					<img :src="logoUrl" alt="" class="size-8 drop-shadow-[0_0_8px_var(--primary)]" />
					<span
						class="font-display text-2xl leading-none tracking-wide text-primary text-glow-primary marquee-flicker md:text-3xl"
					>
						OpenTogetherTube
					</span>
				</router-link>

				<nav v-if="display.lgAndUp.value" class="ml-6 flex items-center gap-1">
					<Button variant="ghost" size="sm" as-child>
						<router-link to="/rooms">{{ $t("nav.browse") }}</router-link>
					</Button>
					<Button v-if="store.state.user" variant="ghost" size="sm" as-child>
						<router-link to="/my-rooms">{{ $t("nav.my-rooms") }}</router-link>
					</Button>
					<Button variant="ghost" size="sm" as-child>
						<a
							href="https://github.com/dyc3/opentogethertube/discussions/830"
							target="_blank"
							>{{ $t("nav.faq") }}</a
						>
					</Button>
					<Button variant="ghost" size="sm" as-child>
						<a
							href="https://github.com/dyc3/opentogethertube/issues/new/choose"
							target="_blank"
						>
							<Icon :icon="mdiBug" />
							{{ $t("nav.bug") }}
						</a>
					</Button>
					<Button variant="ghost" size="sm" as-child>
						<a href="https://github.com/sponsors/dyc3" target="_blank">
							<Icon :icon="mdiHeart" class="text-primary" />
							{{ $t("nav.support") }}
						</a>
					</Button>
				</nav>

				<div class="flex-1" />

				<div v-if="display.mdAndUp.value" class="flex items-center gap-2">
					<DropdownMenu>
						<DropdownMenuTrigger as-child>
							<Button variant="marquee" size="sm">
								<Icon :icon="mdiPlusBox" />
								{{ $t("nav.create.title") }}
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" class="w-72">
							<NavCreateRoom
								@createtemp="createTempRoom"
								@createperm="showCreateRoomForm = true"
							/>
						</DropdownMenuContent>
					</DropdownMenu>
					<NavUser @login="showLogin = true" @logout="logout" />
					<LocaleSelector />
				</div>
			</div>
		</header>

		<!-- ░░ MOBILE DRAWER ░░ -->
		<Sheet v-model:open="drawer">
			<SheetContent side="left" class="w-72 border-line-strong bg-background">
				<SheetHeader>
					<SheetTitle class="font-display text-2xl text-primary text-glow-primary">
						Menu
					</SheetTitle>
				</SheetHeader>
				<nav class="flex flex-col gap-1 px-2">
					<router-link class="ott-drawer-link" to="/" @click="drawer = false">
						{{ $t("nav.home") }}
					</router-link>
					<router-link class="ott-drawer-link" to="/rooms" @click="drawer = false">
						{{ $t("nav.browse") }}
					</router-link>
					<router-link
						v-if="store.state.user"
						class="ott-drawer-link"
						to="/my-rooms"
						@click="drawer = false"
					>
						{{ $t("nav.my-rooms") }}
					</router-link>
					<a
						class="ott-drawer-link"
						href="https://github.com/dyc3/opentogethertube/discussions/830"
						target="_blank"
						>{{ $t("nav.faq") }}</a
					>
					<a
						class="ott-drawer-link"
						href="https://github.com/dyc3/opentogethertube/issues/new/choose"
						target="_blank"
					>
						<Icon :icon="mdiBug" class="size-4" /> {{ $t("nav.bug") }}
					</a>
					<a class="ott-drawer-link" href="https://github.com/sponsors/dyc3" target="_blank">
						<Icon :icon="mdiHeart" class="size-4 text-primary" /> {{ $t("nav.support") }}
					</a>
					<Separator class="my-2" />
					<NavCreateRoom
						@createtemp="
							drawer = false;
							createTempRoom();
						"
						@createperm="
							drawer = false;
							showCreateRoomForm = true;
						"
					/>
				</nav>
				<SheetFooter class="mt-auto flex-row items-center gap-2">
					<NavUser @login="showLogin = true" @logout="logout" />
					<LocaleSelector />
				</SheetFooter>
			</SheetContent>
		</Sheet>

		<!-- ░░ MAIN ░░ -->
		<main class="relative flex-1">
			<router-view />
		</main>

		<!-- create room dialog -->
		<Dialog v-model:open="showCreateRoomForm">
			<DialogContent class="max-w-xl gap-0 p-0 sm:max-w-xl">
				<DialogTitle class="sr-only">{{ $t("create-room-form.card-title") }}</DialogTitle>
				<CreateRoomForm
					@roomCreated="showCreateRoomForm = false"
					@cancel="showCreateRoomForm = false"
				/>
			</DialogContent>
		</Dialog>

		<!-- login dialog -->
		<Dialog v-model:open="showLogin">
			<DialogContent class="max-w-xl gap-0 p-0 sm:max-w-xl">
				<DialogTitle class="sr-only">{{ $t("login-form.login") }}</DialogTitle>
				<LogInForm @shouldClose="showLogin = false" />
			</DialogContent>
		</Dialog>

		<!-- room creation loading overlay -->
		<Transition name="ott-overlay">
			<div
				v-if="store.state.misc.isLoadingCreateRoom"
				class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background/90 backdrop-blur-sm"
			>
				<Spinner class="size-12 text-primary" />
				<p class="label-mono text-muted">{{ $t("nav.create.title") }}…</p>
				<Button variant="outline" size="lg" @click="cancelRoom">
					{{ $t("common.cancel") }}
				</Button>
			</div>
		</Transition>

			<Notifier />
		</div>
	</TooltipProvider>
</template>

<script lang="ts">
import { mdiBug, mdiHeart, mdiPlusBox, mdiMenu } from "@mdi/js";
import { defineComponent, onMounted, ref, computed } from "vue";
import { API } from "@/common-http";
import CreateRoomForm from "@/components/CreateRoomForm.vue";
import LogInForm from "@/components/LogInForm.vue";
import NavUser from "@/components/navbar/NavUser.vue";
import NavCreateRoom from "@/components/navbar/NavCreateRoom.vue";
import Notifier from "@/components/Notifier.vue";
import { loadLanguageAsync } from "@/i18n";
import { createRoomHelper } from "@/util/roomcreator";
import { useRouter } from "vue-router";
import logoUrl from "@/assets/logo.svg";
import { useStore } from "@/store";
import LocaleSelector from "@/components/navbar/LocaleSelector.vue";
import { useDisplay } from "@/components/ui/useDisplay";

// biome-ignore lint/nursery/noVueOptionsApi: TODO: convert to setup
const App = defineComponent({
	name: "app",
	components: {
		CreateRoomForm,
		LogInForm,
		NavUser,
		NavCreateRoom,
		Notifier,
		LocaleSelector,
	},
	setup() {
		const store = useStore();
		const display = useDisplay();

		const showCreateRoomForm = ref(false);
		const showLogin = ref(false);
		const drawer = ref(false);

		const logout = async () => {
			const res = await API.post("/user/logout");
			if (res.data.success) {
				store.commit("LOGOUT");
			}
		};

		const setLocale = async (locale: string) => {
			await loadLanguageAsync(locale);
			store.commit("settings/UPDATE", { locale });
		};

		const cancelRoom = () => {
			store.commit("misc/CANCELLED_ROOM_CREATION");
		};

		const createTempRoom = async () => {
			await createRoomHelper(store);
		};

		onMounted(async () => {
			const router = useRouter();

			store.subscribe(mutation => {
				if (mutation.type === "misc/ROOM_CREATED") {
					try {
						router.push(`/room/${mutation.payload.name}`);
					} catch (e) {
						if (e.name !== "NavigationDuplicated") {
							throw e;
						}
					}
				}
			});

			document.addEventListener("fullscreenchange", () => {
				if (document.fullscreenElement) {
					store.commit("SET_FULLSCREEN", true);
					document.querySelector("html")?.classList.add("scrollbarBeGone");
				} else {
					store.commit("SET_FULLSCREEN", false);
					document.querySelector("html")?.classList.remove("scrollbarBeGone");
				}
			});

			await store.dispatch("settings/load");
			await store.dispatch("users/getNewToken");
			await setLocale(store.state.settings.locale);

			// ask the server if we are logged in or not, and update the client to reflect that status.
			const resp = await API.get("/user");
			if (resp.data.loggedIn) {
				const user = resp.data;
				delete user.loggedIn;
				store.commit("LOGIN", user);
			}
		});

		const fullscreen = computed(() => store.state.fullscreen);

		return {
			showCreateRoomForm,
			showLogin,
			drawer,
			fullscreen,
			display,
			logout,
			setLocale,
			cancelRoom,
			createTempRoom,
			logoUrl,
			store,
			mdiBug,
			mdiHeart,
			mdiPlusBox,
			mdiMenu,
		};
	},
});

// biome-ignore lint/nursery/noVueOptionsApi: TODO: convert to setup
export default App;
</script>

<style>
.ott-drawer-link {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	border-radius: var(--radius);
	padding: 0.55rem 0.65rem;
	font-family: var(--font-mono);
	font-size: 0.8rem;
	text-transform: uppercase;
	letter-spacing: 0.08em;
	color: var(--muted-foreground);
	transition: all 0.15s ease;
}
.ott-drawer-link:hover {
	background: var(--surface-2);
	color: var(--primary);
}
.ott-drawer-link.router-link-exact-active {
	color: var(--primary);
}

.ott-overlay-enter-active,
.ott-overlay-leave-active {
	transition: opacity 0.25s ease;
}
.ott-overlay-enter-from,
.ott-overlay-leave-to {
	opacity: 0;
}

.link {
	text-decoration: underline;
	cursor: pointer;
}
.link-invis {
	text-decoration: none;
	color: inherit;
}
.text-muted {
	color: var(--muted-foreground);
}
</style>
