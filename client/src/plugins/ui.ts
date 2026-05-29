import type { App, Component } from "vue";

import * as alert from "@/components/ui/alert";
import * as avatar from "@/components/ui/avatar";
import * as badge from "@/components/ui/badge";
import * as button from "@/components/ui/button";
import * as card from "@/components/ui/card";
import * as checkbox from "@/components/ui/checkbox";
import * as dialog from "@/components/ui/dialog";
import * as dropdownMenu from "@/components/ui/dropdown-menu";
import * as field from "@/components/ui/field";
import * as icon from "@/components/ui/icon";
import * as input from "@/components/ui/input";
import * as label from "@/components/ui/label";
import * as popover from "@/components/ui/popover";
import * as progress from "@/components/ui/progress";
import * as scrollArea from "@/components/ui/scroll-area";
import * as select from "@/components/ui/select";
import * as separator from "@/components/ui/separator";
import * as sheet from "@/components/ui/sheet";
import * as skeleton from "@/components/ui/skeleton";
import * as slider from "@/components/ui/slider";
import * as sonner from "@/components/ui/sonner";
import * as spinner from "@/components/ui/spinner";
import * as switchToggle from "@/components/ui/switch";
import * as table from "@/components/ui/table";
import * as tabs from "@/components/ui/tabs";
import * as textarea from "@/components/ui/textarea";
import * as toggle from "@/components/ui/toggle";
import * as toggleGroup from "@/components/ui/toggle-group";
import * as tooltip from "@/components/ui/tooltip";

const modules = [
	alert,
	avatar,
	badge,
	button,
	card,
	checkbox,
	dialog,
	dropdownMenu,
	field,
	icon,
	input,
	label,
	popover,
	progress,
	scrollArea,
	select,
	separator,
	sheet,
	skeleton,
	slider,
	sonner,
	spinner,
	switchToggle,
	table,
	tabs,
	textarea,
	toggle,
	toggleGroup,
	tooltip,
];

/**
 * Registers every shadcn-vue primitive (and our Icon/Spinner) as a global
 * component, so templates can use <Button>, <Card>, <DialogContent>, etc.
 * without per-file imports — the role Vuetify's autoImport used to play.
 */
export const OttUiPlugin = {
	install(app: App) {
		for (const mod of modules) {
			for (const [name, exported] of Object.entries(mod)) {
				// only register component exports (PascalCase), skip cva/variants/types
				if (/^[A-Z]/.test(name) && exported) {
					app.component(name, exported as Component);
				}
			}
		}
	},
};
