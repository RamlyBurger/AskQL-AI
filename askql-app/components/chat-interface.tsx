"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { ScrollArea } from "@/components/field-scrollable";
import { Avatar, AvatarFallback } from "@/components/profile-icon";
import { Badge } from "@/components/ui-icon";
import { Button } from "@/components/form-btn";
import {
  Bot,
  User,
  Copy,
  Check,
  ArrowUp,
  ArrowDown,
  FileAudio,
  FileText,
  File as FileIcon,
  Image as ImageIconLucide,
  RefreshCw,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/custom-hint";
import { MarkdownRenderer } from "@/components/markdown-renderer";

interface Attachment {
  url: string;
  filename: string;
  file_type: string;
  size: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  model?: string;
  attachments?: Attachment[];
}

interface ChatInterfaceProps {
  messages: Message[];
  isLoading?: boolean;
  isLoadingChat?: boolean;
  currentStatus?: string;
  onSuggestionClick?: (suggestion: string) => void;
  mode?: "ask" | "agent";
  onConfirmAction?: (
    action: "execute" | "cancel",
    operation: string,
    sql: string,
    explanation: string,
    model: string
  ) => void;
  availableTables?: string[];
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

  // Fallback for unknown models
  return {
    label: modelValue,
    provider: "Unknown",
    logo: "/askql_logo_square.png",
  };
};

export function ChatInterface({
  messages,
  isLoading,
  isLoadingChat,
  currentStatus,
  onSuggestionClick,
  mode = "ask",
  onConfirmAction,
  availableTables = [],
}: ChatInterfaceProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollButtons, setShowScrollButtons] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Get the last user message for extracting @data tags
  const lastUserMessage =
    messages.filter((m) => m.role === "user").slice(-1)[0]?.content || "";

  // Helper function to get a random dataset
  const getRandomDataset = (): string => {
    if (availableTables.length === 0) return "@general";
    const randomIndex = Math.floor(Math.random() * availableTables.length);
    return `@${availableTables[randomIndex]}`;
  };

  // Helper function to append random dataset to suggestion
  const appendRandomDataset = (suggestion: string): string => {
    const randomDataset = getRandomDataset();

    // Check if suggestion already ends with @ tag
    const endsWithTag = /@\w+\s*$/.test(suggestion.trim());

    // If it already has a tag at the end, replace it with random one
    if (endsWithTag) {
      return suggestion.replace(/@\w+\s*$/, randomDataset);
    }

    // Otherwise append the random dataset
    return `${suggestion.trim()} ${randomDataset}`;
  };

  // Check if user is at bottom of scroll
  const checkIfAtBottom = () => {
    const scrollElement = scrollAreaRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]"
    );
    if (!scrollElement) return true;

    const threshold = 100; // pixels from bottom
    const isBottom =
      scrollElement.scrollHeight -
        scrollElement.scrollTop -
        scrollElement.clientHeight <
      threshold;
    setIsAtBottom(isBottom);

    // Show scroll buttons if not at top or bottom
    const isAtTop = scrollElement.scrollTop < 100;
    setShowScrollButtons(!isAtTop || !isBottom);

    return isBottom;
  };

  // Auto-scroll to bottom ONLY if user is already at bottom
  useEffect(() => {
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, currentStatus, isAtBottom]);

  const handleCopy = async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const scrollToTop = () => {
    const scrollElement = scrollAreaRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]"
    );
    if (scrollElement) {
      scrollElement.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setIsAtBottom(true);
  };

  // Attach scroll listener
  useEffect(() => {
    const scrollElement = scrollAreaRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]"
    );
    if (scrollElement) {
      scrollElement.addEventListener("scroll", checkIfAtBottom);
      return () => scrollElement.removeEventListener("scroll", checkIfAtBottom);
    }
  }, []);

  // Get provider logo based on model name
  const getProviderLogo = (model?: string): string => {
    if (!model) return "/askql_logo_square.png";

    if (model.startsWith("gpt")) return "/provider-chatgpt.png";
    if (model.startsWith("claude")) return "/provider-claude.png";
    if (model.startsWith("deepseek")) return "/provider-deepseek.png";
    if (model.startsWith("gemini")) return "/provider-gemini.png";

    return "/askql_logo_square.png";
  };
  return (
    <div className="chat-interface-container flex-1 overflow-hidden bg-zinc-50 dark:bg-zinc-950 relative">
      {/* Loading overlay for chat history */}
      {isLoadingChat && (
        <div className="absolute inset-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Loading conversation...
            </p>
          </div>
        </div>
      )}

      <ScrollArea ref={scrollAreaRef} className="h-full px-4">
        <div className="mx-auto max-w-3xl py-8 mt-4">
          {messages.length === 0 ? (
            <div className="flex h-[60vh] flex-col items-center justify-center text-center">
              <div className="rounded-lg bg-zinc-100 p-6 dark:bg-zinc-800">
                <Image
                  src="/askql_logo_square.png"
                  alt="AskQL"
                  width={48}
                  height={48}
                  className="opacity-60"
                />
              </div>
              <h2 className="mt-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                How can I help you today?
              </h2>
              <p className="mt-2 text-zinc-500 dark:text-zinc-400">
                Ask me anything or start a new conversation
              </p>

              {/* Suggestion buttons */}
              <div className="mt-8 flex flex-col gap-3 w-full max-w-2xl px-4">
                {mode === "ask" ? (
                  // Ask Mode suggestions - data analysis
                  <>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left h-auto py-4 px-5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      onClick={() =>
                        onSuggestionClick?.(
                          appendRandomDataset(
                            "Show me the top 5 of something interesting"
                          )
                        )
                      }
                    >
                      <div className="flex flex-col items-start gap-1">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          📊 Show me the top 5 of something interesting
                        </span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          Discover insights from your data
                        </span>
                      </div>
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full justify-start text-left h-auto py-4 px-5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      onClick={() =>
                        onSuggestionClick?.(
                          appendRandomDataset(
                            "What patterns or trends can you find in my data?"
                          )
                        )
                      }
                    >
                      <div className="flex flex-col items-start gap-1">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          📈 What patterns or trends can you find in my data?
                        </span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          Analyze trends and patterns
                        </span>
                      </div>
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full justify-start text-left h-auto py-4 px-5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      onClick={() =>
                        onSuggestionClick?.(
                          appendRandomDataset(
                            "Find records that might need attention"
                          )
                        )
                      }
                    >
                      <div className="flex flex-col items-start gap-1">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          🔍 Find records that might need attention
                        </span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          Identify potential issues
                        </span>
                      </div>
                    </Button>
                  </>
                ) : (
                  // Agent Mode suggestions - CRUD operations
                  <>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left h-auto py-4 px-5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      onClick={() =>
                        onSuggestionClick?.(
                          appendRandomDataset(
                            "Predict future record in the dataset with the provided details."
                          )
                        )
                      }
                    >
                      <div className="flex flex-col items-start gap-1">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          📈 Predict future record in the dataset with the
                          provided details.
                        </span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          Add or insert new data
                        </span>
                      </div>
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full justify-start text-left h-auto py-4 px-5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      onClick={() =>
                        onSuggestionClick?.(
                          appendRandomDataset(
                            "Continuously scan data for duplicate data, then remove them to keep the dataset clean."
                          )
                        )
                      }
                    >
                      <div className="flex flex-col items-start gap-1">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          🧹 Continuously scan data for duplicate data, then
                          remove them to keep the dataset clean.
                        </span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          Read and explore existing data
                        </span>
                      </div>
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full justify-start text-left h-auto py-4 px-5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      onClick={() =>
                        onSuggestionClick?.(
                          appendRandomDataset(
                            "Find and remove existing data that are not longer needed."
                          )
                        )
                      }
                    >
                      <div className="flex flex-col items-start gap-1">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          🔍 Find and remove existing data that are not longer
                          needed.
                        </span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          Modify or clean up data
                        </span>
                      </div>
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <>
              {messages.map((message, index) => (
                <div
                  key={message.id}
                  className={`group flex gap-4 mb-4 ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="h-12 w-12 shrink-0 rounded-full overflow-hidden bg-white flex items-center justify-center border border-zinc-300 dark:border-zinc-600">
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
                    <div className="flex max-w-[80%] flex-col gap-2 rounded-3xl rounded-tr-none bg-white px-5 py-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
                      <p className="text-[15px] leading-7 text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">
                        {message.content}
                      </p>
                      {/* Display attachments if any */}
                      {message.attachments &&
                        message.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-zinc-300 dark:border-zinc-600">
                            {message.attachments.map((attachment, idx) => (
                              <div key={idx}>
                                {attachment.file_type.startsWith("image/") ? (
                                  <div className="relative group">
                                    <div className="w-20 h-20 rounded-lg overflow-hidden border-2 border-zinc-300 dark:border-zinc-600 hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
                                      <img
                                        src={`${
                                          process.env.NEXT_PUBLIC_API_URL ||
                                          "http://localhost:8000"
                                        }${attachment.url}`}
                                        alt={attachment.filename}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1 py-0.5 truncate rounded-b-lg">
                                      {attachment.filename}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-xs">
                                    {attachment.file_type.startsWith(
                                      "audio/"
                                    ) ? (
                                      <>
                                        <FileAudio className="h-4 w-4 text-purple-500" />
                                        <span className="max-w-[120px] truncate">
                                          {attachment.filename}
                                        </span>
                                      </>
                                    ) : attachment.file_type ===
                                      "application/pdf" ? (
                                      <>
                                        <FileText className="h-4 w-4 text-red-500" />
                                        <span className="max-w-[120px] truncate">
                                          {attachment.filename}
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <FileIcon className="h-4 w-4 text-zinc-500" />
                                        <span className="max-w-[120px] truncate">
                                          {attachment.filename}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                  ) : (
                    <div className="flex flex-1 min-w-0 flex-col gap-2 py-2">
                      <div className="text-sm leading-relaxed text-zinc-900 dark:text-zinc-100 overflow-hidden">
                        <MarkdownRenderer
                          content={message.content}
                          onConfirmAction={onConfirmAction}
                          onSuggestionClick={onSuggestionClick}
                          lastUserMessage={lastUserMessage}
                        />
                      </div>
                      {/* Only show provider badge and copy button when message is complete (not the last message while loading) */}
                      {!(isLoading && index === messages.length - 1) && (
                        <div className="flex items-center gap-2">
                          {message.model &&
                            (() => {
                              const modelInfo = getModelLabel(message.model);
                              return (
                                <Badge
                                  variant="outline"
                                  className="text-xs h-6 px-2 py-0.5 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 flex items-center gap-1.5"
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
                          <TooltipProvider>
                            <div className="flex gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() =>
                                      handleCopy(message.content, message.id)
                                    }
                                  >
                                    {copiedId === message.id ? (
                                      <Check className="h-3 w-3 text-green-600" />
                                    ) : (
                                      <Copy className="h-3 w-3" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>
                                    {copiedId === message.id
                                      ? "Copied!"
                                      : "Copy"}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => window.location.reload()}
                                  >
                                    <RefreshCw className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Refresh</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TooltipProvider>
                        </div>
                      )}
                    </div>
                  )}
                  {message.role === "user" && (
                    <div className="h-12 w-12 shrink-0 rounded-full overflow-hidden bg-white flex items-center justify-center border border-zinc-300">
                      <Image
                        src="/user.avif"
                        alt="User"
                        width={48}
                        height={48}
                      />
                    </div>
                  )}
                </div>
              ))}

              {/* Truck loading animation - only show when generating new message, not when loading chat */}
              {isLoading && !isLoadingChat && currentStatus && (
                <div
                  className="flex justify-start"
                  style={{ marginLeft: "64px" }}
                >
                  <div className="flex flex-col gap-3">
                    <div className="text-sm text-zinc-700 dark:text-zinc-300 font-medium flex items-center gap-2">
                      <svg
                        version="1.1"
                        xmlns="http://www.w3.org/2000/svg"
                        xmlnsXlink="http://www.w3.org/1999/xlink"
                        x="0px"
                        y="0px"
                        width="16px"
                        height="16px"
                        viewBox="0 0 50 50"
                        style={
                          {
                            enableBackground: "new 0 0 50 50",
                          } as React.CSSProperties
                        }
                        xmlSpace="preserve"
                      >
                        <path
                          fill="currentColor"
                          d="M43.935,25.145c0-10.318-8.364-18.683-18.683-18.683c-10.318,0-18.683,8.365-18.683,18.683h4.068c0-8.071,6.543-14.615,14.615-14.615c8.072,0,14.615,6.543,14.615,14.615H43.935z"
                        >
                          <animateTransform
                            attributeType="xml"
                            attributeName="transform"
                            type="rotate"
                            from="0 25 25"
                            to="360 25 25"
                            dur="0.6s"
                            repeatCount="indefinite"
                          />
                        </path>
                      </svg>
                      {currentStatus}
                    </div>
                    <div
                      style={{
                        width: "fit-content",
                        height: "fit-content",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <div
                        style={{
                          width: "200px",
                          height: "100px",
                          display: "flex",
                          flexDirection: "column",
                          position: "relative",
                          alignItems: "center",
                          justifyContent: "flex-end",
                          overflowX: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: "130px",
                            height: "fit-content",
                            marginBottom: "6px",
                            animation: "truckMotion 1s linear infinite",
                          }}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 198 93"
                            style={{ width: "100%", height: "auto" }}
                          >
                            <path
                              strokeWidth="3"
                              stroke="#282828"
                              fill="#F83D3D"
                              d="M135 22.5H177.264C178.295 22.5 179.22 23.133 179.594 24.0939L192.33 56.8443C192.442 57.1332 192.5 57.4404 192.5 57.7504V89C192.5 90.3807 191.381 91.5 190 91.5H135C133.619 91.5 132.5 90.3807 132.5 89V25C132.5 23.6193 133.619 22.5 135 22.5Z"
                            ></path>
                            <path
                              strokeWidth="3"
                              stroke="#282828"
                              fill="#7D7C7C"
                              d="M146 33.5H181.741C182.779 33.5 183.709 34.1415 184.078 35.112L190.538 52.112C191.16 53.748 189.951 55.5 188.201 55.5H146C144.619 55.5 143.5 54.3807 143.5 53V36C143.5 34.6193 144.619 33.5 146 33.5Z"
                            ></path>
                            <path
                              strokeWidth="2"
                              stroke="#282828"
                              fill="#282828"
                              d="M150 65C150 65.39 149.763 65.8656 149.127 66.2893C148.499 66.7083 147.573 67 146.5 67C145.427 67 144.501 66.7083 143.873 66.2893C143.237 65.8656 143 65.39 143 65C143 64.61 143.237 64.1344 143.873 63.7107C144.501 63.2917 145.427 63 146.5 63C147.573 63 148.499 63.2917 149.127 63.7107C149.763 64.1344 150 64.61 150 65Z"
                            ></path>
                            <rect
                              strokeWidth="2"
                              stroke="#282828"
                              fill="#FFFCAB"
                              rx="1"
                              height="7"
                              width="5"
                              y="63"
                              x="187"
                            ></rect>
                            <rect
                              strokeWidth="2"
                              stroke="#282828"
                              fill="#282828"
                              rx="1"
                              height="11"
                              width="4"
                              y="81"
                              x="193"
                            ></rect>
                            <rect
                              strokeWidth="3"
                              stroke="#282828"
                              fill="#DFDFDF"
                              rx="2.5"
                              height="90"
                              width="121"
                              y="1.5"
                              x="6.5"
                            ></rect>
                            <rect
                              strokeWidth="2"
                              stroke="#282828"
                              fill="#DFDFDF"
                              rx="2"
                              height="4"
                              width="6"
                              y="84"
                              x="1"
                            ></rect>
                          </svg>
                        </div>
                        <div
                          style={{
                            width: "130px",
                            height: "fit-content",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "0px 10px 0px 15px",
                            position: "absolute",
                            bottom: 0,
                          }}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 30 30"
                            style={{ width: "24px" }}
                          >
                            <circle
                              strokeWidth="3"
                              stroke="#282828"
                              fill="#282828"
                              r="13.5"
                              cy="15"
                              cx="15"
                            ></circle>
                            <circle
                              fill="#DFDFDF"
                              r="7"
                              cy="15"
                              cx="15"
                            ></circle>
                          </svg>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 30 30"
                            style={{ width: "24px" }}
                          >
                            <circle
                              strokeWidth="3"
                              stroke="#282828"
                              fill="#282828"
                              r="13.5"
                              cy="15"
                              cx="15"
                            ></circle>
                            <circle
                              fill="#DFDFDF"
                              r="7"
                              cy="15"
                              cx="15"
                            ></circle>
                          </svg>
                        </div>
                        <div
                          style={{
                            width: "100%",
                            height: "1.5px",
                            backgroundColor: "#282828",
                            position: "relative",
                            bottom: 0,
                            alignSelf: "flex-end",
                            borderRadius: "3px",
                          }}
                        >
                          <div
                            style={{
                              content: '""',
                              position: "absolute",
                              width: "20px",
                              height: "100%",
                              backgroundColor: "#282828",
                              right: "-50%",
                              borderRadius: "3px",
                              animation: "roadAnimation 1.4s linear infinite",
                              borderLeft: "10px solid white",
                            }}
                          ></div>
                          <div
                            style={{
                              content: '""',
                              position: "absolute",
                              width: "10px",
                              height: "100%",
                              backgroundColor: "#282828",
                              right: "-65%",
                              borderRadius: "3px",
                              animation: "roadAnimation 1.4s linear infinite",
                              borderLeft: "4px solid white",
                            }}
                          ></div>
                        </div>
                        <svg
                          xmlSpace="preserve"
                          viewBox="0 0 453.459 453.459"
                          xmlns="http://www.w3.org/2000/svg"
                          version="1.1"
                          fill="#000000"
                          style={{
                            position: "absolute",
                            bottom: 0,
                            right: "-90%",
                            height: "90px",
                            animation: "roadAnimation 1.4s linear infinite",
                          }}
                        >
                          <path d="M252.882,0c-37.781,0-68.686,29.953-70.245,67.358h-6.917v8.954c-26.109,2.163-45.463,10.011-45.463,19.366h9.993 c-1.65,5.146-2.507,10.54-2.507,16.017c0,28.956,23.558,52.514,52.514,52.514c28.956,0,52.514-23.558,52.514-52.514 c0-5.478-0.856-10.872-2.506-16.017h9.992c0-9.354-19.352-17.204-45.463-19.366v-8.954h-6.149C200.189,38.779,223.924,16,252.882,16 c29.952,0,54.32,24.368,54.32,54.32c0,28.774-11.078,37.009-25.105,47.437c-17.444,12.968-37.216,27.667-37.216,78.884v113.914 h-0.797c-5.068,0-9.174,4.108-9.174,9.177c0,2.844,1.293,5.383,3.321,7.066c-3.432,27.933-26.851,95.744-8.226,115.459v11.202h45.75 v-11.202c18.625-19.715-4.794-87.527-8.227-115.459c2.029-1.683,3.322-4.223,3.322-7.066c0-5.068-4.107-9.177-9.176-9.177h-0.795 V196.641c0-43.174,14.942-54.283,30.762-66.043c14.793-10.997,31.559-23.461,31.559-60.277C323.202,31.545,291.656,0,252.882,0z M232.77,111.694c0,23.442-19.071,42.514-42.514,42.514c-23.442,0-42.514-19.072-42.514-42.514c0-5.531,1.078-10.957,3.141-16.017 h78.747C231.693,100.736,232.77,106.162,232.77,111.694z"></path>
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Invisible div for auto-scrolling */}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Floating scroll buttons */}
      {showScrollButtons && (
        <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-40">
          {/* Scroll to top button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-10 w-10 rounded-full shadow-lg bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  onClick={scrollToTop}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Scroll to top</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Scroll to bottom button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-10 w-10 rounded-full shadow-lg bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  onClick={scrollToBottom}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Scroll to bottom</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}
