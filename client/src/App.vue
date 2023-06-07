<template>
	<v-app id="app">
		<v-app-bar
			app
			:density="$vuetify.display.mdAndUp ? 'default' : 'compact'"
			:scroll-behavior="fullscreen ? 'inverted hide' : ' '"
		>
			<!-- TODO: replace the ' ' here with '' when this bug is fixed: https://github.com/vuetifyjs/vuetify/issues/17554 -->
			<v-app-bar-nav-icon @click="drawer = true" role="menu" aria-label="nav menu" />
			<v-img
				:src="logoUrl"
				max-width="32"
				max-height="32"
				contain
				style="margin-right: 8px"
			/>
			<v-app-bar-title class="app-bar-title">
				<router-link class="link-invis" to="/">OpenTogetherTube</router-link>
			</v-app-bar-title>
			<v-toolbar-items v-if="$vuetify.display.lgAndUp">
				<v-btn variant="text" to="/rooms">{{ $t("nav.browse") }}</v-btn>
				<v-btn
					variant="text"
					href="https://github.com/dyc3/opentogethertube/discussions/830"
					target="_blank"
				>
					{{ $t("nav.faq") }}
				</v-btn>
				<v-btn
					variant="text"
					href="https://github.com/dyc3/opentogethertube/issues/new/choose"
					target="_blank"
				>
					<v-icon class="side-pad">fa:fas fa-bug</v-icon>
					{{ $t("nav.bug") }}
				</v-btn>
				<v-btn variant="text" href="https://github.com/sponsors/dyc3" target="_blank">
					<v-icon class="side-pad">fa:fas fa-heart</v-icon>
					{{ $t("nav.support") }}
				</v-btn>
			</v-toolbar-items>
			<v-spacer />
			<v-toolbar-items v-if="$vuetify.display.mdAndUp">
				<v-menu offset-y>
					<template v-slot:activator="{ props }">
						<v-btn variant="text" v-bind="props">
							<v-icon class="side-pad">fa:fas fa-plus-square</v-icon>
							{{ $t("nav.create.title") }}
						</v-btn>
					</template>
					<v-list two-line max-width="400">
						<NavCreateRoom
							@createtemp="createTempRoom"
							@createperm="showCreateRoomForm = true"
						/>
					</v-list>
				</v-menu>
				<NavUser @login="showLogin = true" @logout="logout" />
				<LocaleSelector style="margin-top: 5px; width: 100px" />
			</v-toolbar-items>
		</v-app-bar>
		<v-navigation-drawer v-model="drawer" temporary>
			<v-list nav dense>
				<v-list-item to="/">
					{{ $t("nav.home") }}
				</v-list-item>
				<v-list-item to="/rooms">
					{{ $t("nav.browse") }}
				</v-list-item>
				<v-list-item
					href="https://github.com/dyc3/opentogethertube/discussions/830"
					target="_blank"
				>
					{{ $t("nav.faq") }}
				</v-list-item>
				<v-list-item
					href="https://github.com/dyc3/opentogethertube/issues/new/choose"
					target="_blank"
				>
					<template #prepend>
						<v-icon>fa:fas fa-bug</v-icon>
					</template>
					{{ $t("nav.bug") }}
				</v-list-item>
				<v-list-item href="https://github.com/sponsors/dyc3" target="_blank">
					<template #prepend>
						<v-icon>fa:fas fa-heart</v-icon>
					</template>
					{{ $t("nav.support") }}
				</v-list-item>
				<NavCreateRoom
					@createtemp="createTempRoom"
					@createperm="showCreateRoomForm = true"
				/>
				<LocaleSelector />
			</v-list>
			<template v-slot:append>
				<div class="pa-2">
					<NavUser @login="showLogin = true" @logout="logout" />
				</div>
			</template>
		</v-navigation-drawer>
		<v-main>
			<router-view />
		</v-main>
		<v-container>
			<v-dialog v-model="showCreateRoomForm" persistent max-width="600">
				<CreateRoomForm
					@roomCreated="showCreateRoomForm = false"
					@cancel="showCreateRoomForm = false"
				/>
			</v-dialog>
		</v-container>
		<v-container>
			<v-dialog v-model="showLogin" max-width="600">
				<LogInForm @shouldClose="showLogin = false" />
			</v-dialog>
		</v-container>
		<v-overlay
			class="overlay-loading-create-room"
			:model-value="store.state.misc.isLoadingCreateRoom"
		>
			<v-container class="overlay-loading-create-room">
				<v-progress-circular indeterminate />
				<v-btn elevation="12" size="x-large" @click="cancelRoom" style="margin-top: 24px">
					{{ $t("common.cancel") }}
				</v-btn>
			</v-container>
		</v-overlay>
		<Notifier />
	</v-app>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref, computed } from "vue";
import { API } from "@/common-http.js";
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

export const App = defineComponent({
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

		const showCreateRoomForm = ref(false);
		const showLogin = ref(false);
		const drawer = ref(false);

		const logout = async () => {
			let res = await API.post("/user/logout");
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
			await store.dispatch("getNewToken");
			await setLocale(store.state.settings.locale);

			// ask the server if we are logged in or not, and update the client to reflect that status.
			let resp = await API.get("/user");
			if (resp.data.loggedIn) {
				let user = resp.data;
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
			logout,
			setLocale,
			cancelRoom,
			createTempRoom,
			logoUrl,
			store,
		};
	},
});

export default App;
</script>

<style lang="scss">
@import "variables.scss";

.link-invis {
	text-decoration: none;
	color: inherit !important;
}

.side-pad {
	margin: 0 4px;
}

.text-muted {
	opacity: 0.7;
}

.app-bar-title {
	margin-right: 10px;

	// HACK: vuetify 3 was forcing the other buttons to center themselves.
	flex-grow: 0;
	flex-shrink: 0;
	flex-basis: auto;
}

.scrollbarBeGone {
	-ms-overflow-style: none; // I think this is an old way to do this? Probably not ideal
	scrollbar-width: none;
	&::-webkit-scrollbar {
		display: none;
	}
}

.overlay-loading-create-room {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	width: 100%;
	height: 100%;
}
</style>
