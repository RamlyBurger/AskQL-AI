import * as React from "react";
import { Slot as __El } from "@radix-ui/react-slot";
import { cva as __def, type VariantProps } from "class-variance-authority";
import { cn as __merge } from "@/lib/utils";

const _base = [
  "inline-flex items-center justify-center gap-2 whitespace-nowrap",
  "rounded-md text-sm font-medium transition-all",
  "disabled:pointer-events-none disabled:opacity-50",
  "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
  "shrink-0 [&_svg]:shrink-0 outline-none",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
  "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
  "aria-invalid:border-destructive cursor-pointer",
].join(" ");

const _styles = {
  v: {
    d: "bg-primary text-primary-foreground hover:bg-primary/90",
    x: "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
    o: "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
    s: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    g: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
    l: "text-primary underline-offset-4 hover:underline",
  },
  s: {
    d: "h-9 px-4 py-2 has-[>svg]:px-3",
    s: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
    l: "h-10 rounded-md px-6 has-[>svg]:px-4",
    i: "size-9",
    ism: "size-8",
    ilg: "size-10",
  },
};

const _gen = __def(_base, {
  variants: {
    variant: {
      default: _styles.v.d,
      destructive: _styles.v.x,
      outline: _styles.v.o,
      secondary: _styles.v.s,
      ghost: _styles.v.g,
      link: _styles.v.l,
    },
    size: {
      default: _styles.s.d,
      sm: _styles.s.s,
      lg: _styles.s.l,
      icon: _styles.s.i,
      "icon-sm": _styles.s.ism,
      "icon-lg": _styles.s.ilg,
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

const _META_SLOT = "button";

function _Impl({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof _gen> & {
    asChild?: boolean;
  }) {
  const Root = asChild ? __El : "button";

  return (
    <Root
      data-slot={_META_SLOT}
      className={__merge(_gen({ variant, size, className }))}
      {...props}
    />
  );
}

export { _Impl as Button, _gen as buttonVariants };
