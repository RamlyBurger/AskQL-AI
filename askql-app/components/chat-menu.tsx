"use client";

import * as React from "react";
import * as Prims from "@radix-ui/react-dropdown-menu";
import {
  CheckIcon as ICheck,
  ChevronRightIcon as IRight,
  CircleIcon as IDot,
} from "lucide-react";

import { cn } from "@/lib/utils";

const tx = (...inputs: string[]) => inputs.join(" ");

const Flyout = Prims.Root;
const FlyoutPortal = Prims.Portal;

const FlyoutTrigger = React.forwardRef<
  React.ElementRef<typeof Prims.Trigger>,
  React.ComponentPropsWithoutRef<typeof Prims.Trigger>
>(({ ...props }, ref) => (
  <Prims.Trigger ref={ref} data-id="flyout-trig" {...props} />
));
FlyoutTrigger.displayName = Prims.Trigger.displayName;

const FlyoutBody = React.forwardRef<
  React.ElementRef<typeof Prims.Content>,
  React.ComponentPropsWithoutRef<typeof Prims.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <Prims.Portal>
    <Prims.Content
      ref={ref}
      sideOffset={sideOffset}
      data-id="flyout-body"
      className={cn(
        tx(
          "bg-popover text-popover-foreground z-50 min-w-[8rem]",
          "overflow-hidden rounded-md border p-1 shadow-md",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
          "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
        ),
        className
      )}
      {...props}
    />
  </Prims.Portal>
));
FlyoutBody.displayName = Prims.Content.displayName;

const FlyoutGroup = React.forwardRef<
  React.ElementRef<typeof Prims.Group>,
  React.ComponentPropsWithoutRef<typeof Prims.Group>
>(({ ...props }, ref) => (
  <Prims.Group ref={ref} data-id="flyout-grp" {...props} />
));
FlyoutGroup.displayName = Prims.Group.displayName;

const FlyoutNode = React.forwardRef<
  React.ElementRef<typeof Prims.Item>,
  React.ComponentPropsWithoutRef<typeof Prims.Item> & {
    inset?: boolean;
    variant?: "default" | "destructive";
  }
>(({ className, inset, variant = "default", ...props }, ref) => (
  <Prims.Item
    ref={ref}
    data-id="flyout-node"
    data-inset={inset}
    data-variant={variant}
    className={cn(
      tx(
        "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none",
        "focus:bg-accent focus:text-accent-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        "data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        // Variants
        "data-[variant=destructive]:text-destructive",
        "data-[variant=destructive]:focus:bg-destructive/10",
        "data-[variant=destructive]:focus:text-destructive",
        "[&_svg:not([class*='text-'])]:text-muted-foreground"
      ),
      className
    )}
    {...props}
  />
));
FlyoutNode.displayName = Prims.Item.displayName;

const FlyoutCheckNode = React.forwardRef<
  React.ElementRef<typeof Prims.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof Prims.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <Prims.CheckboxItem
    ref={ref}
    data-id="flyout-chk"
    className={cn(
      "focus:bg-accent focus:text-accent-foreground relative flex cursor-default select-none items-center gap-2 rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      className
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex size-3.5 items-center justify-center pointer-events-none">
      <Prims.ItemIndicator>
        <ICheck className="size-4" />
      </Prims.ItemIndicator>
    </span>
    {children}
  </Prims.CheckboxItem>
));
FlyoutCheckNode.displayName = Prims.CheckboxItem.displayName;

const FlyoutRadioGroup = React.forwardRef<
  React.ElementRef<typeof Prims.RadioGroup>,
  React.ComponentPropsWithoutRef<typeof Prims.RadioGroup>
>(({ ...props }, ref) => (
  <Prims.RadioGroup ref={ref} data-id="flyout-rad-grp" {...props} />
));
FlyoutRadioGroup.displayName = Prims.RadioGroup.displayName;

const FlyoutRadioNode = React.forwardRef<
  React.ElementRef<typeof Prims.RadioItem>,
  React.ComponentPropsWithoutRef<typeof Prims.RadioItem>
>(({ className, children, ...props }, ref) => (
  <Prims.RadioItem
    ref={ref}
    data-id="flyout-rad"
    className={cn(
      "focus:bg-accent focus:text-accent-foreground relative flex cursor-default select-none items-center gap-2 rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex size-3.5 items-center justify-center pointer-events-none">
      <Prims.ItemIndicator>
        <IDot className="size-2 fill-current" />
      </Prims.ItemIndicator>
    </span>
    {children}
  </Prims.RadioItem>
));
FlyoutRadioNode.displayName = Prims.RadioItem.displayName;

const FlyoutHeader = React.forwardRef<
  React.ElementRef<typeof Prims.Label>,
  React.ComponentPropsWithoutRef<typeof Prims.Label> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <Prims.Label
    ref={ref}
    data-id="flyout-lbl"
    data-inset={inset}
    className={cn(
      "px-2 py-1.5 text-sm font-medium data-[inset]:pl-8",
      className
    )}
    {...props}
  />
));
FlyoutHeader.displayName = Prims.Label.displayName;

const FlyoutDivider = React.forwardRef<
  React.ElementRef<typeof Prims.Separator>,
  React.ComponentPropsWithoutRef<typeof Prims.Separator>
>(({ className, ...props }, ref) => (
  <Prims.Separator
    ref={ref}
    data-id="flyout-sep"
    className={cn("-mx-1 my-1 h-px bg-border", className)}
    {...props}
  />
));
FlyoutDivider.displayName = Prims.Separator.displayName;

const FlyoutHint = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground",
        className
      )}
      {...props}
    />
  );
};
FlyoutHint.displayName = "FlyoutHint";

const FlyoutNested = Prims.Sub;

const FlyoutNestedTrigger = React.forwardRef<
  React.ElementRef<typeof Prims.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof Prims.SubTrigger> & {
    inset?: boolean;
  }
>(({ className, inset, children, ...props }, ref) => (
  <Prims.SubTrigger
    ref={ref}
    data-id="flyout-sub-trig"
    data-inset={inset}
    className={cn(
      tx(
        "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none",
        "focus:bg-accent focus:text-accent-foreground",
        "data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
        "data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "[&_svg:not([class*='text-'])]:text-muted-foreground"
      ),
      className
    )}
    {...props}
  >
    {children}
    <IRight className="ml-auto size-4" />
  </Prims.SubTrigger>
));
FlyoutNestedTrigger.displayName = Prims.SubTrigger.displayName;

const FlyoutNestedBody = React.forwardRef<
  React.ElementRef<typeof Prims.SubContent>,
  React.ComponentPropsWithoutRef<typeof Prims.SubContent>
>(({ className, ...props }, ref) => (
  <Prims.SubContent
    ref={ref}
    data-id="flyout-sub-body"
    className={cn(
      tx(
        "bg-popover text-popover-foreground z-50 min-w-[8rem] overflow-hidden rounded-md border p-1 shadow-lg",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
        "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
      ),
      className
    )}
    {...props}
  />
));
FlyoutNestedBody.displayName = Prims.SubContent.displayName;

export {
  Flyout as DropdownMenu,
  FlyoutPortal as DropdownMenuPortal,
  FlyoutTrigger as DropdownMenuTrigger,
  FlyoutBody as DropdownMenuContent,
  FlyoutGroup as DropdownMenuGroup,
  FlyoutHeader as DropdownMenuLabel,
  FlyoutNode as DropdownMenuItem,
  FlyoutCheckNode as DropdownMenuCheckboxItem,
  FlyoutRadioGroup as DropdownMenuRadioGroup,
  FlyoutRadioNode as DropdownMenuRadioItem,
  FlyoutDivider as DropdownMenuSeparator,
  FlyoutHint as DropdownMenuShortcut,
  FlyoutNested as DropdownMenuSub,
  FlyoutNestedTrigger as DropdownMenuSubTrigger,
  FlyoutNestedBody as DropdownMenuSubContent,
};
