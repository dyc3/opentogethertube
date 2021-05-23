/* eslint-disable no-unused-vars */
import { Toast } from '@/models/toast';
import iVue from 'vue';

declare module 'vue/types/vue' {
  interface Vue extends iVue {
    prototype: any,
    $toast: {
      add: (toast: Omit<Toast, "id">) => void
      remove: (id: symbol) => void
    },
  }
}

declare module "*.vue" {
  export default Vue;
}
