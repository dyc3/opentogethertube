import { Toast } from '@/models/toast';
import iVue from 'vue';

declare module 'vue/types/vue' {
  interface Vue extends iVue {
    prototype: any,
    $toast: {
      // eslint-disable-next-line no-unused-vars
      add: (toast: Omit<Toast, "id">) => void
    },
  }
}

declare module "*.vue" {
  export default Vue;
}
