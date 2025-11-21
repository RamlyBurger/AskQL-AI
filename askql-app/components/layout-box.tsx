import * as R from "react";
import { cn as mix } from "@/lib/utils";

const s = (...parts: string[]) => parts.join(" ");
const ds = (v: string) => ({ "data-slot": v });

const C = ({ className, ...p }: R.ComponentProps<"div">) => (
  <div
    {...ds("card")}
    className={mix(
      s("bg-card", "text-card-foreground"),
      s("flex", "flex-col", "gap-6"),
      s("rounded-xl", "border", "py-6", "shadow-sm"),
      className
    )}
    {...p}
  />
);

const H = ({ className, ...p }: R.ComponentProps<"div">) => (
  <div
    {...ds("card-header")}
    className={mix(
      s("@container/card-header", "grid", "auto-rows-min"),
      "grid-rows-[auto_auto] items-start gap-2 px-6",
      "has-[data-slot=card-action]:grid-cols-[1fr_auto]",
      "[.border-b]:pb-6",
      className
    )}
    {...p}
  />
);

const T = ({ className, ...p }: R.ComponentProps<"div">) => (
  <div
    {...ds("card-title")}
    className={mix("leading-none font-semibold", className)}
    {...p}
  />
);

const D = ({ className, ...p }: R.ComponentProps<"div">) => (
  <div
    {...ds("card-description")}
    className={mix("text-muted-foreground text-sm", className)}
    {...p}
  />
);

const A = ({ className, ...p }: R.ComponentProps<"div">) => (
  <div
    {...ds("card-action")}
    className={mix(
      "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
      className
    )}
    {...p}
  />
);

const B = ({ className, ...p }: R.ComponentProps<"div">) => (
  <div {...ds("card-content")} className={mix("px-6", className)} {...p} />
);

const F = ({ className, ...p }: R.ComponentProps<"div">) => (
  <div
    {...ds("card-footer")}
    className={mix("flex items-center px-6 [.border-t]:pt-6", className)}
    {...p}
  />
);

export {
  C as Card,
  H as CardHeader,
  F as CardFooter,
  T as CardTitle,
  A as CardAction,
  D as CardDescription,
  B as CardContent,
};
