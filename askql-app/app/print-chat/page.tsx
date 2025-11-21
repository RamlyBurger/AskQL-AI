"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Avatar, AvatarFallback } from "@/components/profile-icon";
import { Badge } from "@/components/ui-icon";
import { Bot, User } from "lucide-react";
import { MarkdownRenderer } from "@/components/markdown-renderer";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  model?: string;
}

interface ExportData {
  conversationId: string;
  messages: Message[];
  timestamp: string;
}

const modelOptions: { value: string; label: string; provider: string }[] = [
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "Google" },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash", provider: "Google" },
  { value: "gpt-4o", label: "GPT-4o", provider: "OpenAI" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini", provider: "OpenAI" },
  {
    value: "claude-3.5-sonnet",
    label: "Claude 3.5 Sonnet",
    provider: "Anthropic",
  },
  { value: "deepseek-chat", label: "DeepSeek Chat", provider: "DeepSeek" },
  {
    value: "deepseek-reasoner",
    label: "DeepSeek Reasoner",
    provider: "DeepSeek",
  },
];

const getProviderLogoByProvider = (provider: string) => {
  const logos: Record<string, string> = {
    Google: "/provider-gemini.png",
    OpenAI: "/provider-chatgpt.png",
    Anthropic: "/provider-claude.png",
    DeepSeek: "/provider-deepseek.png",
  };
  return logos[provider] || "/provider-gemini.png";
};

const getModelLabel = (
  modelValue?: string
): { label: string; provider: string; logo: string } => {
  if (!modelValue)
    return {
      label: "Unknown",
      provider: "Unknown",
      logo: "/askql_logo_square.png",
    };

  const modelOption = modelOptions.find((m) => m.value === modelValue);
  if (modelOption) {
    return {
      label: modelOption.label,
      provider: modelOption.provider,
      logo: getProviderLogoByProvider(modelOption.provider),
    };
  }

  return {
    label: modelValue,
    provider: "Unknown",
    logo: "/askql_logo_square.png",
  };
};

const getProviderLogo = (model?: string): string => {
  if (!model) return "/askql_logo_square.png";

  if (model.startsWith("gpt")) return "/provider-chatgpt.png";
  if (model.startsWith("claude")) return "/provider-claude.png";
  if (model.startsWith("deepseek")) return "/provider-deepseek.png";
  if (model.startsWith("gemini")) return "/provider-gemini.png";

  return "/askql_logo_square.png";
};

export default function PrintChatPage() {
  const searchParams = useSearchParams();
  const [exportData, setExportData] = useState<ExportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const exportId = searchParams?.get("id");
    if (exportId) {
      // Fetch data from API
      fetch(`/api/get-export-data?id=${exportId}`)
        .then((res) => res.json())
        .then((data) => {
          setExportData(data);
          setLoading(false);
        })
        .catch((error) => {
          console.error("Failed to load export data:", error);
          setLoading(false);
        });
    }
  }, [searchParams]);

  if (loading || !exportData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-900 mx-auto mb-4" />
          <p className="text-zinc-600">Loading chat data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 print:bg-white">
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>

      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 rounded-lg bg-white p-6 border border-zinc-200">
          <div className="flex items-center gap-3 mb-4">
            <Image
              src="/askql_logo_square.png"
              alt="AskQL"
              width={48}
              height={48}
              className="rounded-lg"
            />
            <div>
              <h1 className="text-xl font-semibold text-zinc-900">
                AskQL Chat Export
              </h1>
              <p className="text-sm text-zinc-500">
                Conversation ID: {exportData.conversationId}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm pt-4 border-t border-zinc-200">
            <div>
              <span className="text-zinc-500">Exported:</span>
              <span className="ml-2 text-zinc-900 font-medium">
                {new Date(exportData.timestamp).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-zinc-500">Messages:</span>
              <span className="ml-2 text-zinc-900 font-medium">
                {exportData.messages.length}
              </span>
            </div>
          </div>
        </div>

        {/* Messages - Matching chat-interface.tsx exactly */}
        <div className="space-y-6">
          {exportData.messages.map((message) => (
            <div
              key={message.id}
              className={`group flex gap-4 ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {message.role === "assistant" && (
                <div className="h-12 w-12 shrink-0 rounded-full overflow-hidden bg-white flex items-center justify-center border border-zinc-300">
                  <Image
                    src={getProviderLogo(message.model)}
                    alt="AI Provider"
                    width={48}
                    height={48}
                    className="object-contain p-1"
                  />
                </div>
              )}
              {message.role === "user" ? (
                <div className="flex max-w-[80%] flex-col gap-2 rounded-2xl border border-black px-4 py-3 bg-zinc-100 text-zinc-900">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {message.content}
                  </p>
                </div>
              ) : (
                <div className="flex flex-1 min-w-0 flex-col gap-2 py-2">
                  <div className="text-sm leading-relaxed text-zinc-900 overflow-hidden">
                    <MarkdownRenderer
                      content={message.content}
                      expandAll={true}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    {message.model &&
                      (() => {
                        const modelInfo = getModelLabel(message.model);
                        return (
                          <Badge
                            variant="outline"
                            className="text-xs h-6 px-2 py-0.5 bg-white border-zinc-300 flex items-center gap-1.5"
                          >
                            <Image
                              src={modelInfo.logo}
                              alt={modelInfo.provider}
                              width={14}
                              height={14}
                              className="rounded"
                            />
                            <span>{modelInfo.label}</span>
                          </Badge>
                        );
                      })()}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-zinc-200 text-center text-sm text-zinc-500">
          <p>Generated by AskQL - {new Date().getFullYear()}</p>
        </div>
      </div>
    </div>
  );
}
