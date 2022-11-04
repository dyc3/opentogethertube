import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
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
		path: "/quickroom",
		name: "quickroom",
		component: () => import("./views/QuickRoom.vue"),
	},
	{
		path: "/faq",
		name: "faq",
		component: () => import("./views/Faq.vue"),
	},
	{
		path: "/privacypolicy",
		name: "privacypolicy",
		component: () => import("./views/Privacy.vue"),
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
		path: "/:catchAll(.*)",
		name: "not-found",
		component: () => import("./views/NotFound.vue"),
	},
];

export const router = createRouter({
	history: createWebHistory(import.meta.env.BASE_URL),
	routes,
});
