import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";
import { isOfficialSite } from "./util/misc";

export const routes: RouteRecordRaw[] = [
	{
		path: "/",
		name: "home",
		component: () => import("@/views/Home.vue"),
	},
	{
		path: "/rooms",
		name: "room-list",
		component: () => import("./views/RoomList.vue"),
	},
	{
		path: "/room/:roomId",
		name: "room",
		component: () => import("./views/Room.vue"),
	},
	{
		path: "/attribution",
		name: "attribution",
		component: () => import("./views/Attribution.vue"),
	},
	{
		path: "/r/:roomId",
		redirect: "/room/:roomId",
	},
	{
		path: "/rooms/:roomId",
		redirect: "/room/:roomId",
	},
	{
		path: "/passwordreset",
		component: () => import("./views/PasswordReset.vue"),
	},
	{
		path: "/:catchAll(.*)",
		name: "not-found",
		component: () => import("./views/NotFound.vue"),
	},
];

// FIXME: only render on official site
if (import.meta.env.DEV || isOfficialSite()) {
	routes.push({
		path: "/privacypolicy",
		name: "privacypolicy",
		component: () => import("./views/Privacy.vue"),
	});
}

if (import.meta.env.DEV) {
	routes.push({
		path: "/playground",
		name: "playground",
		component: () => import("./views/dev/Playground.vue"),
	});
	routes.push({
		path: "/themes",
		name: "themes",
		component: () => import("./views/dev/ThemeTester.vue"),
	});
}

export const router = createRouter({
	history: createWebHistory(import.meta.env.BASE_URL),
	routes,
});

router.beforeEach((to, from) => {
	console.log("Navigation: ", { to, from });
});
