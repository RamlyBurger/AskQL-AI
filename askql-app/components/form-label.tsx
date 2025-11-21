"use client";

import * as React from "react";
import * as _Base from "@radix-ui/react-label";
import { cn as _join } from "@/lib/utils";

const _s = [
  "flex items-center gap-2",
  "text-sm leading-none font-medium select-none",
  "group-data-[disabled=true]:pointer-events-none",
  "group-data-[disabled=true]:opacity-50",
  "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
];

const _tag = { k: "data-slot", v: "label" };

function _L({ className, ...props }: React.ComponentProps<typeof _Base.Root>) {
  return (
    <_Base.Root
      {...{ [_tag.k]: _tag.v }}
      className={_join(_s.join(" "), className)}
      {...props}
    />
  );
}

export { _L as Label };
