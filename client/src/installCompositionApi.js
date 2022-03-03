// HACK: see https://stackoverflow.com/questions/61885716/uncaught-error-vue-composition-api-must-call-vue-useplugin-before-using-any
import Vue from "vue";
import VueCompositionAPI from "@vue/composition-api";
Vue.use(VueCompositionAPI);
