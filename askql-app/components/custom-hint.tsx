"use client";

import * as React from "react";
import * as Rt from "@radix-ui/react-tooltip";
import { cn as mx } from "@/lib/utils";

const TRANSITIONS = [
  "animate-in fade-in-0 zoom-in-95",
  "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
  "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
  "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
].join(" ");

const BASE_STYLES = [
  "z-50 w-fit rounded-md px-3 py-1.5 text-xs",
  "bg-foreground text-background text-balance",
  "origin-(--radix-tooltip-content-transform-origin)",
].join(" ");

const Context = ({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof Rt.Provider>) => (
  <Rt.Provider delayDuration={delayDuration} {...props} />
);

const Root = ({ ...props }: React.ComponentProps<typeof Rt.Root>) => (
  <Context>
    <Rt.Root {...props} />
  </Context>
);

const Anchor = React.forwardRef<
  React.ElementRef<typeof Rt.Trigger>,
  React.ComponentPropsWithoutRef<typeof Rt.Trigger>
>((props, ref) => <Rt.Trigger ref={ref} {...props} />);
Anchor.displayName = "TooltipTrigger";

const Overlay = React.forwardRef<
  React.ElementRef<typeof Rt.Content>,
  React.ComponentPropsWithoutRef<typeof Rt.Content>
>(({ className, sideOffset = 0, children, ...props }, ref) => (
  <Rt.Portal>
    <Rt.Content
      ref={ref}
      sideOffset={sideOffset}
      className={mx(BASE_STYLES, TRANSITIONS, className)}
      {...props}
    >
      {children}
      <Rt.Arrow className="fill-foreground z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]" />
    </Rt.Content>
  </Rt.Portal>
));
Overlay.displayName = "TooltipContent";

export {
  Root as Tooltip,
  Anchor as TooltipTrigger,
  Overlay as TooltipContent,
  Context as TooltipProvider,
};
