import type { StringOrNumber } from "reka-ui";
import type { InjectionKey, Ref } from "vue";

export const TabsContentAnimatedOrderKey: InjectionKey<Ref<readonly StringOrNumber[]>> = Symbol(
	"TabsContentAnimatedOrder",
);
