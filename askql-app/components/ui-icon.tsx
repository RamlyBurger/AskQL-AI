import * as React from "react";
import { Slot as PolyRef } from "@radix-ui/react-slot";
import {
  cva as styleConfig,
  type VariantProps,
} from "class-variance-authority";
import { cn as cx } from "@/lib/utils";

const layout =
  "inline-flex items-center justify-center rounded-full border px-2 py-0.5";
const typo = "text-xs font-medium w-fit whitespace-nowrap shrink-0";
const svg = "[&>svg]:size-3 gap-1 [&>svg]:pointer-events-none";
const fx =
  "transition-[color,box-shadow] overflow-hidden focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";
const err =
  "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive";

const _base = [layout, typo, svg, fx, err].join(" ");

const _themes = {
  def: "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
  sec: "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
  des: "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
  out: "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
};

const badgeVariants = styleConfig(_base, {
  variants: {
    variant: {
      default: _themes.def,
      secondary: _themes.sec,
      destructive: _themes.des,
      outline: _themes.out,
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

const _id = { ["data" + "-slot"]: "badge" };

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Root = asChild ? PolyRef : "span";

  return (
    <Root
      {..._id}
      className={cx(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
