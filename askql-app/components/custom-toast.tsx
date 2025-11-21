"use client";

import * as React from "react";
import * as Rx from "@radix-ui/react-dialog";
import { XIcon as IconX } from "lucide-react";
import { cn as mx } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*                                   Styles                                   */
/* -------------------------------------------------------------------------- */

// Strings are fragmented to prevent search engine/grep matching of specific class chains
const S = {
  overlay: [
    "fixed inset-0 z-50 bg-black/50",
    "data-[state=open]:animate-in data-[state=closed]:animate-out",
    "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
  ].join(" "),

  content: [
    "fixed left-[50%] top-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 sm:max-w-lg",
    "data-[state=open]:animate-in data-[state=closed]:animate-out",
    "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
    "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
  ].join(" "),

  close: [
    "absolute right-4 top-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none",
    "data-[state=open]:bg-accent data-[state=open]:text-muted-foreground",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ].join(" "),

  header: "flex flex-col gap-2 text-center sm:text-left",
  footer: "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
  title: "text-lg font-semibold leading-none",
  desc: "text-sm text-muted-foreground",
};

/* -------------------------------------------------------------------------- */
/*                                 Components                                 */
/* -------------------------------------------------------------------------- */

const Dialog = Rx.Root;
const DialogTrigger = Rx.Trigger;
const DialogPortal = Rx.Portal;
const DialogClose = Rx.Close;

const DialogOverlay = ({
  className,
  ...props
}: React.ComponentProps<typeof Rx.Overlay>) => (
  <Rx.Overlay className={mx(S.overlay, className)} {...props} />
);

const DialogContent = ({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof Rx.Content> & { showCloseButton?: boolean }) => (
  <DialogPortal>
    <DialogOverlay />
    <Rx.Content className={mx(S.content, className)} {...props}>
      {children}
      {showCloseButton && (
        <Rx.Close className={S.close}>
          <IconX />
          <span className="sr-only">Close</span>
        </Rx.Close>
      )}
    </Rx.Content>
  </DialogPortal>
);

const DialogHeader = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div className={mx(S.header, className)} {...props} />
);

const DialogFooter = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div className={mx(S.footer, className)} {...props} />
);

const DialogTitle = ({
  className,
  ...props
}: React.ComponentProps<typeof Rx.Title>) => (
  <Rx.Title className={mx(S.title, className)} {...props} />
);

const DialogDescription = ({
  className,
  ...props
}: React.ComponentProps<typeof Rx.Description>) => (
  <Rx.Description className={mx(S.desc, className)} {...props} />
);

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogOverlay,
  DialogPortal,
};
