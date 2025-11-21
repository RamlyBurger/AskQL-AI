"use client";

import { Button } from "@/components/form-btn";
import {
  AlertDialog,
  AlertMsgAction,
  AlertMsgCancel,
  AlertMsgContent,
  AlertMsgDescription,
  AlertMsgFooter,
  AlertMsgHeader,
  AlertMsgTitle,
} from "@/components/alert-message";
import { FileJson, FileText, FileType } from "lucide-react";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  model?: string;
}

interface ExportChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: Message[];
  conversationId: number | null;
}

export function ExportChatDialog({
  open,
  onOpenChange,
  messages,
  conversationId,
}: ExportChatDialogProps) {
  const handleExportChat = async (format: "json" | "text" | "pdf") => {
    if (messages.length === 0) {
      return;
    }

    if (format === "json") {
      // Create chat export data
      const chatData = {
        exported_at: new Date().toISOString(),
        conversation_id: conversationId,
        message_count: messages.length,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          model: msg.model,
        })),
      };

      // Create downloadable JSON file
      const blob = new Blob([JSON.stringify(chatData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chat-export-${conversationId || "new"}-${
        new Date().toISOString().split("T")[0]
      }.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Chat exported as JSON successfully!");
    } else if (format === "text") {
      // Create text file content
      let textContent = `AskQL Chat Export\n`;
      textContent += `Exported: ${new Date().toLocaleString()}\n`;
      textContent += `Conversation ID: ${conversationId || "New Chat"}\n`;
      textContent += `Messages: ${messages.length}\n`;
      textContent += `${"=".repeat(80)}\n\n`;

      messages.forEach((msg, index) => {
        textContent += `[${msg.timestamp}] ${msg.role.toUpperCase()}${
          msg.model ? ` (${msg.model})` : ""
        }\n`;
        textContent += `${"-".repeat(80)}\n`;
        textContent += `${msg.content}\n\n`;
      });

      // Create downloadable text file
      const blob = new Blob([textContent], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chat-export-${conversationId || "new"}-${
        new Date().toISOString().split("T")[0]
      }.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Chat exported as text file successfully!");
    } else if (format === "pdf") {
      // Export chat as PDF via backend API
      onOpenChange(false);
      toast.loading("Generating PDF...", { id: "pdf-export" });

      try {
        const response = await fetch("/api/export-pdf", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: messages,
            conversationId: conversationId || "new",
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to generate PDF");
        }

        // Get the PDF blob
        const blob = await response.blob();

        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `chat-export-${conversationId || "new"}-${
          new Date().toISOString().split("T")[0]
        }.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success("PDF downloaded successfully!", { id: "pdf-export" });
      } catch (error) {
        console.error("PDF export error:", error);
        toast.error("Failed to generate PDF. Please try another format.", {
          id: "pdf-export",
        });
      }

      return;
    }

    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertMsgContent>
        <AlertMsgHeader>
          <AlertMsgTitle>Export Chat</AlertMsgTitle>
          <AlertMsgDescription>
            Choose the format you want to export your chat conversation.
          </AlertMsgDescription>
        </AlertMsgHeader>
        <div className="grid grid-cols-3 gap-3 py-4">
          <Button
            variant="outline"
            className="h-24 flex flex-col gap-2 hover:bg-blue-50 dark:hover:bg-blue-950"
            onClick={() => handleExportChat("json")}
          >
            <FileJson className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <div className="text-center">
              <p className="font-semibold text-sm">JSON</p>
              <p className="text-xs text-zinc-500">Data format</p>
            </div>
          </Button>
          <Button
            variant="outline"
            className="h-24 flex flex-col gap-2 hover:bg-green-50 dark:hover:bg-green-950"
            onClick={() => handleExportChat("text")}
          >
            <FileText className="h-8 w-8 text-green-600 dark:text-green-400" />
            <div className="text-center">
              <p className="font-semibold text-sm">Text</p>
              <p className="text-xs text-zinc-500">Plain text</p>
            </div>
          </Button>
          <Button
            variant="outline"
            className="h-24 flex flex-col gap-2 hover:bg-red-50 dark:hover:bg-red-950"
            onClick={() => handleExportChat("pdf")}
          >
            <FileType className="h-8 w-8 text-red-600 dark:text-red-400" />
            <div className="text-center">
              <p className="font-semibold text-sm">PDF</p>
              <p className="text-xs text-zinc-500">Visual export</p>
            </div>
          </Button>
        </div>
        <AlertMsgFooter>
          <AlertMsgCancel>Cancel</AlertMsgCancel>
        </AlertMsgFooter>
      </AlertMsgContent>
    </AlertDialog>
  );
}
