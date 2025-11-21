"use client";

import { useState, useEffect } from "react";

interface UseSidebarResizeProps {
  initialWidth: number;
  minWidth: number;
  maxWidth: number;
  isRight?: boolean;
}

export function useSidebarResize({
  initialWidth,
  minWidth,
  maxWidth,
  isRight = false,
}: UseSidebarResizeProps) {
  const [width, setWidth] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      let newWidth: number;
      
      if (isRight) {
        newWidth = Math.min(
          Math.max(minWidth, window.innerWidth - e.clientX),
          maxWidth
        );
      } else {
        newWidth = Math.min(Math.max(minWidth, e.clientX), maxWidth);
      }
      
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, minWidth, maxWidth, isRight]);

  const startResize = () => setIsResizing(true);

  return { width, isResizing, startResize };
}
