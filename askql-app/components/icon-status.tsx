"use client";

import * as React from "react";
import * as RxProgress from "@radix-ui/react-progress";

import { cn as cx } from "@/lib/utils";

const Progress = ({
  className,
  value,
  ...props
}: React.ComponentProps<typeof RxProgress.Root>) => {
  const percent = value || 0;

  return (
    <RxProgress.Root
      {...{ "data-slot": "progress" }}
      className={cx(
        "relative h-2 w-full overflow-hidden rounded-full",
        "bg-primary/20",
        className
      )}
      {...props}
    >
      <RxProgress.Indicator
        {...{ "data-slot": "progress-indicator" }}
        className="h-full w-full flex-1 bg-primary transition-all"
        style={{ transform: `translateX(-${100 - percent}%)` }}
      />
    </RxProgress.Root>
  );
};

export { Progress };
