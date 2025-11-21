import * as React from "react";
import { cn as __cl } from "@/lib/utils";

const _s = [
  "file:text-foreground placeholder:text-muted-foreground",
  "selection:bg-primary selection:text-primary-foreground",
  "dark:bg-input/30 border-input h-9 w-full min-w-0",
  "rounded-md border bg-transparent px-3 py-1",
  "text-base shadow-xs transition-[color,box-shadow] outline-none",
  "file:inline-flex file:h-7 file:border-0 file:bg-transparent",
  "file:text-sm file:font-medium",
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
  "md:text-sm",
];

const _x = [
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
  "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
];

const _M = { k: "data-slot", v: "input" };

function _I({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      {...{ [_M.k]: _M.v }}
      className={__cl(_s.join(" "), _x.join(" "), className)}
      {...props}
    />
  );
}

export { _I as Input };
