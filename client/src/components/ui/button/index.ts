import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";

export { default as Button } from "./Button.vue";

/*
 * MIDNIGHT DRIVE-IN button — marquee ticket.
 * Uppercase mono labels, tracked wide, sharp corners, amber glow on the
 * primary "marquee" action. Variant + size names kept shadcn-compatible.
 */
export const buttonVariants = cva(
	[
		"group/button relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap",
		"font-mono font-bold uppercase tracking-[0.12em] text-[0.8rem]",
		"rounded-sm border bg-clip-padding select-none transition-all duration-150 outline-none",
		"focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
		"disabled:pointer-events-none disabled:opacity-40",
		"active:translate-y-px",
		"[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4",
	].join(" "),
	{
		variants: {
			variant: {
				default:
					"border-primary/60 bg-primary text-primary-foreground hover:bg-primary-bright hover:shadow-glow-primary",
				marquee:
					"border-primary/70 bg-transparent text-primary hover:bg-primary hover:text-primary-foreground hover:shadow-glow-primary text-shadow-glow-primary light:text-shadow-none",
				signal: "border-signal/60 bg-transparent text-signal hover:bg-signal hover:text-background hover:shadow-glow-signal",
				outline:
					"bg-surface-2/40 text-foreground hover:border-primary/60 hover:text-primary hover:bg-surface-2",
				secondary:
					"border-transparent bg-secondary text-secondary-foreground hover:bg-surface-3",
				ghost: "border-transparent bg-transparent text-muted-foreground hover:text-foreground hover:bg-surface-2/60",
				destructive:
					"border-destructive/50 bg-transparent text-destructive hover:bg-destructive hover:text-destructive-foreground",
				link: "border-transparent text-signal tracking-normal normal-case font-body underline-offset-4 hover:underline hover:text-primary-bright",
			},
			size: {
				default: "h-9 px-4 py-2",
				sm: "h-8 px-3 text-[0.7rem]",
				lg: "h-11 px-6 text-[0.85rem]",
				xl: "h-14 px-8 text-base tracking-[0.16em]",
				icon: "size-9",
				"icon-sm": "size-8",
				"icon-lg": "size-11",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);
export type ButtonVariants = VariantProps<typeof buttonVariants>;
