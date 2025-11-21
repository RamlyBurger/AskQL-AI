"use client";

import * as React from "react";
import * as Rx from "@radix-ui/react-scroll-area";
import { cn as clsx } from "@/lib/utils";

const AreaRoot = Rx.Root;
const AreaViewport = Rx.Viewport;
const AreaScrollbar = Rx.ScrollAreaScrollbar;
const AreaThumb = Rx.ScrollAreaThumb;
const AreaCorner = Rx.Corner;

function ScrollArea({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AreaRoot>) {
  return (
    <AreaRoot
      className={clsx("relative overflow-hidden", className)}
      {...props}
    >
      <AreaViewport
        className={clsx(
          "w-full h-full rounded-[inherit] outline-none transition-[color,box-shadow]",
          "focus-visible:outline-1 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        )}
      >
        {children}
      </AreaViewport>
      <ScrollBar />
      <AreaCorner />
    </AreaRoot>
  );
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof AreaScrollbar>) {
  const axisStyles = {
    vertical: "h-full w-2.5 border-l border-l-transparent",
    horizontal: "h-2.5 flex-col border-t border-t-transparent",
  };

  return (
    <AreaScrollbar
      orientation={orientation}
      forceMount
      className={clsx(
        "flex touch-none select-none p-px transition-colors",
        axisStyles[orientation as keyof typeof axisStyles],
        className
      )}
      {...props}
    >
      <AreaThumb
        className={clsx(
          "relative flex-1 rounded-full transition-colors",
          "bg-gray-500 hover:bg-gray-600",
          "dark:bg-gray-500 dark:hover:bg-gray-600"
        )}
      />
    </AreaScrollbar>
  );
}

export { ScrollArea, ScrollBar };
