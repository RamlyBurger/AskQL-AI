"use client";

import { Button } from "@/components/form-btn";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/custom-hint";
import {
  PanelLeft,
  PanelLeftClose,
  PanelRight,
  PanelRightClose,
  Download,
} from "lucide-react";

interface SidebarTogglesProps {
  mounted: boolean;
  page: string;
  isSidebarCollapsed: boolean;
  isRightSidebarCollapsed: boolean;
  messagesLength: number;
  onToggleLeftSidebar: () => void;
  onToggleRightSidebar: () => void;
  onExportChat: () => void;
}

export function SidebarToggles({
  mounted,
  page,
  isSidebarCollapsed,
  isRightSidebarCollapsed,
  messagesLength,
  onToggleLeftSidebar,
  onToggleRightSidebar,
  onExportChat,
}: SidebarTogglesProps) {
  if (!mounted) return null;

  return (
    <>
      {/* Floating left sidebar toggle button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 left-4 z-50 bg-white dark:bg-zinc-900 border shadow-sm hover:shadow-md"
        onClick={onToggleLeftSidebar}
      >
        {isSidebarCollapsed ? (
          <PanelLeft className="h-5 w-5" />
        ) : (
          <PanelLeftClose className="h-5 w-5" />
        )}
      </Button>

      {/* Floating right sidebar toggle button */}
      {(page === "chat" || page === "dataset" || page === "history") && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 z-50 bg-white dark:bg-zinc-900 border shadow-sm hover:shadow-md"
          onClick={onToggleRightSidebar}
        >
          {isRightSidebarCollapsed ? (
            <PanelRight className="h-5 w-5" />
          ) : (
            <PanelRightClose className="h-5 w-5" />
          )}
        </Button>
      )}

      {/* Export Chat button - only visible on chat page */}
      {page === "chat" && messagesLength > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-20 right-4 z-50 bg-white dark:bg-zinc-900 border shadow-sm hover:shadow-md"
                onClick={onExportChat}
              >
                <Download className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={8}>
              <p>Export chat</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </>
  );
}
