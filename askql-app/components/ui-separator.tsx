"use client";

import * as React from "react";
import { Root as BaseLine } from "@radix-ui/react-separator";

import { cn as cx } from "@/lib/utils";

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<typeof BaseLine>) {
  const isVert = orientation === "vertical";

  return (
    <BaseLine
      decorative={decorative}
      orientation={orientation}
      className={cx(
        "shrink-0",
        "bg-[#e4e4e7] dark:bg-[#27272a]",
        isVert ? "h-full w-[1px]" : "h-[1px] w-full",
        className
      )}
      {...props}
    />
  );
}

export { Separator };
