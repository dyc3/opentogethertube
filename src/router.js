import Vue from 'vue';
import Router from 'vue-router';

Vue.use(Router);

export default new Router({
  mode: 'history',
  base: process.env.BASE_URL,
  routes: [
    {
      path: '/',
      name: 'home',
      // route level code-splitting
      // this generates a separate chunk (home.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import(/* webpackChunkName: "home" */ './views/Home.vue'),
    },
    {
      path: '/rooms',
      name: 'room-list',
      component: () => import(/* webpackChunkName: "roomlist" */ './views/RoomList.vue'),
    },
    {
      path: '/room/:roomId',
      name: 'room',
      component: () => import(/* webpackChunkName: "room" */ './views/Room.vue'),
    },
    {
      path: '*',
      name: 'not-found',
      component: () => import(/* webpackChunkName: "not-found" */ './views/NotFound.vue'),
    },
  ],
});
