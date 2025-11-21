"use client";

import {
  CircleCheckIcon as ISuccess,
  InfoIcon as IInfo,
  Loader2Icon as ILoad,
  OctagonXIcon as IError,
  TriangleAlertIcon as IWarn,
} from "lucide-react";
import { useTheme as useColorMode } from "next-themes";
import {
  Toaster as NotifyProvider,
  type ToasterProps as NotifyProps,
} from "sonner";

const toastTokens = {
  bg: "var(--popover)",
  fg: "var(--popover-foreground)",
  bd: "var(--border)",
  rad: "var(--radius)",
};

const Notifications = ({ ...props }: NotifyProps) => {
  const { theme: currentTheme = "system" } = useColorMode();

  return (
    <NotifyProvider
      theme={currentTheme as NotifyProps["theme"]}
      className={["toaster", "group"].join(" ")}
      icons={{
        success: <ISuccess className="size-4" />,
        info: <IInfo className="size-4" />,
        warning: <IWarn className="size-4" />,
        error: <IError className="size-4" />,
        loading: <ILoad className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": toastTokens.bg,
          "--normal-text": toastTokens.fg,
          "--normal-border": toastTokens.bd,
          "--border-radius": toastTokens.rad,
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Notifications as Toaster };
