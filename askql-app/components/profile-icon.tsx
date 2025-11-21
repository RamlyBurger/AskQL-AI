"use client";

import * as React from "react";
import * as P from "@radix-ui/react-avatar";
import { cn as U } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*                                   CONFIG                                   */
/* -------------------------------------------------------------------------- */

const K = ["data", "slot"].join("-");
const V = {
  base: "avatar",
  img: "avatar-image",
  fb: "avatar-fallback",
};

const S = {
  root: [
    "relative flex",
    "size-8 shrink-0",
    "overflow-hidden",
    "rounded-full",
    "border border-black",
  ],
  img: ["aspect-square", "size-full"],
  fb: [
    "bg-muted",
    "flex size-full",
    "items-center justify-center",
    "rounded-full",
  ],
};

/* -------------------------------------------------------------------------- */
/*                                 COMPONENTS                                 */
/* -------------------------------------------------------------------------- */

const Avatar = ({
  className,
  ...props
}: React.ComponentProps<typeof P.Root>) => (
  <P.Root
    {...{ [K]: V.base }}
    className={U(S.root.join(" "), className)}
    {...props}
  />
);

const AvatarImage = ({
  className,
  ...props
}: React.ComponentProps<typeof P.Image>) => (
  <P.Image
    {...{ [K]: V.img }}
    className={U(S.img.join(" "), className)}
    {...props}
  />
);

const AvatarFallback = ({
  className,
  ...props
}: React.ComponentProps<typeof P.Fallback>) => (
  <P.Fallback
    {...{ [K]: V.fb }}
    className={U(S.fb.join(" "), className)}
    {...props}
  />
);

export { Avatar, AvatarImage, AvatarFallback };
