"use client";

import { Button } from "@/components/form-btn";
import { useRouter } from "next/navigation";
import { LayoutDashboard, FileText, Code, Bot } from "lucide-react";

interface TopNavigationProps {
  onNavigate: (targetPage: string) => void;
}

export function TopNavigation({ onNavigate }: TopNavigationProps) {
  const router = useRouter();

  return (
    <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 flex items-center justify-center gap-2 h-16">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onNavigate("dashboard")}
        className="gap-2"
      >
        <LayoutDashboard className="h-4 w-4" />
        Dashboard
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onNavigate("docs")}
        className="gap-2"
      >
        <FileText className="h-4 w-4" />
        Docs
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onNavigate("developer")}
        className="gap-2"
      >
        <Code className="h-4 w-4" />
        Developer
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/tester")}
        className="gap-2"
      >
        <Bot className="h-4 w-4" />
        Tester
      </Button>
    </div>
  );
}
