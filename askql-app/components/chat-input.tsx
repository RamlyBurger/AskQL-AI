"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { Button } from "@/components/form-btn";
import { Textarea } from "@/components/form-textfield";
import { Badge } from "@/components/ui-icon";
import { useAuth } from "@/contexts/auth-context";
import {
  enhancePrompt,
  autocompletePrompt,
  uploadChatAttachment,
  UploadedFile,
} from "@/lib/api";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/chat-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/custom-hint";
import {
  Send,
  Paperclip,
  Mic,
  Sparkles,
  Bot,
  MessageSquare,
  ChevronDown,
  Square,
  Database,
  Check,
  Image as ImageIcon,
  X,
  File,
  FileAudio,
  FileText,
} from "lucide-react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

export type AIModel =
  | "gemini-2.0-flash"
  | "gemini-2.0-pro"
  | "gemini-2.5-flash"
  | "gemini-2.5-pro"
  | "gpt-4o-mini"
  | "gpt-4o"
  | "gpt-4.1"
  | "gpt-5-mini"
  | "gpt-5"
  | "claude-haiku-4.5"
  | "claude-3.5-sonnet"
  | "claude-3.7-sonnet"
  | "claude-4.0-sonnet"
  | "claude-4.5-sonnet"
  | "deepseek-chat"
  | "deepseek-reasoner";

interface ChatInputProps {
  onSendMessage: (
    message: string,
    mode: "ask" | "agent",
    model: AIModel,
    selectedTables?: string[],
    attachments?: UploadedFile[]
  ) => void;
  isLoading?: boolean;
  onStopGeneration?: () => void;
  availableTables?: string[];
  initialMessage?: string;
  mode?: "ask" | "agent";
  onModeChange?: (mode: "ask" | "agent") => void;
}

const modelOptions: { value: AIModel; label: string; provider: string }[] = [
  // Google models (low to high)
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash", provider: "Google" },
  { value: "gemini-2.0-pro", label: "Gemini 2.0 Pro", provider: "Google" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "Google" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "Google" },

  // OpenAI models (low to high)
  { value: "gpt-4o-mini", label: "GPT-4o Mini", provider: "OpenAI" },
  { value: "gpt-4o", label: "GPT-4o", provider: "OpenAI" },
  { value: "gpt-4.1", label: "GPT-4.1", provider: "OpenAI" },
  { value: "gpt-5-mini", label: "GPT-5 Mini", provider: "OpenAI" },
  { value: "gpt-5", label: "GPT-5", provider: "OpenAI" },

  // Anthropic models (low to high)
  {
    value: "claude-haiku-4.5",
    label: "Claude Haiku 4.5",
    provider: "Anthropic",
  },
  {
    value: "claude-3.5-sonnet",
    label: "Claude Sonnet 3.5",
    provider: "Anthropic",
  },
  {
    value: "claude-3.7-sonnet",
    label: "Claude Sonnet 3.7",
    provider: "Anthropic",
  },
  {
    value: "claude-4.0-sonnet",
    label: "Claude Sonnet 4.0",
    provider: "Anthropic",
  },
  {
    value: "claude-4.5-sonnet",
    label: "Claude Sonnet 4.5",
    provider: "Anthropic",
  },

  // DeepSeek models (low to high)
  { value: "deepseek-chat", label: "DeepSeek Chat", provider: "DeepSeek" },
  {
    value: "deepseek-reasoner",
    label: "DeepSeek Reasoner",
    provider: "DeepSeek",
  },
];

const getProviderLogo = (provider: string) => {
  const logos: Record<string, string> = {
    Google: "/provider-gemini.png",
    OpenAI: "/provider-chatgpt.png",
    Anthropic: "/provider-claude.png",
    DeepSeek: "/provider-deepseek.png",
  };
  return logos[provider] || "/provider-gemini.png";
};

export function ChatInput({
  onSendMessage,
  isLoading,
  onStopGeneration,
  availableTables = [],
  initialMessage,
  mode: externalMode,
  onModeChange,
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [mounted, setMounted] = useState(false);
  const [internalMode, setInternalMode] = useState<"agent" | "ask">("ask");
  const mode = externalMode !== undefined ? externalMode : internalMode;
  const [selectedModel, setSelectedModel] =
    useState<AIModel>("gemini-2.5-flash");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isAutocompleting, setIsAutocompleting] = useState(false);
  const [autocompleteSuggestion, setAutocompleteSuggestion] = useState("");
  const [recognition, setRecognition] = useState<any>(null);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const autocompleteTimerRef = useRef<NodeJS.Timeout | null>(null);
  const skipAutocompleteRef = useRef(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionPosition, setMentionPosition] = useState(0);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isMac, setIsMac] = useState(false);
  const [messageHistory, setMessageHistory] = useState<string[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<Record<number, number>>(
    {}
  );
  const [uploadedFiles, setUploadedFiles] = useState<
    Record<number, UploadedFile>
  >({});

  const { token } = useAuth();

  // Load from localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
    const savedMode = localStorage.getItem("chatMode");
    const savedModel = localStorage.getItem("selectedModel");
    if (savedMode && externalMode === undefined) {
      setInternalMode(savedMode as "agent" | "ask");
    }
    if (savedModel) {
      setSelectedModel(savedModel as AIModel);
    }

    // Detect OS
    const userAgent = window.navigator.userAgent;
    const isMacOS = /Mac|iPhone|iPad|iPod/.test(userAgent);
    setIsMac(isMacOS);
  }, []);

  // Set initial message when provided
  useEffect(() => {
    if (initialMessage) {
      setMessage(initialMessage);
    }
  }, [initialMessage]);

  // Autocomplete effect - trigger after user stops typing
  useEffect(() => {
    // Skip if we just accepted an autocomplete suggestion
    if (skipAutocompleteRef.current) {
      skipAutocompleteRef.current = false;
      return;
    }

    // Clear any existing timer
    if (autocompleteTimerRef.current) {
      clearTimeout(autocompleteTimerRef.current);
    }

    // Clear suggestion if message is empty or too short
    if (!message.trim() || message.length < 5) {
      setAutocompleteSuggestion("");
      return;
    }

    // Don't autocomplete if already loading or enhancing
    if (isLoading || isEnhancing) {
      return;
    }

    // Set a timer to autocomplete after user stops typing (800ms debounce)
    autocompleteTimerRef.current = setTimeout(async () => {
      if (!token) return;

      try {
        setIsAutocompleting(true);
        const completion = await autocompletePrompt(
          token,
          message,
          selectedModel
        );

        // Only show suggestion if it's different and longer than current message
        if (
          completion &&
          completion.length > message.length &&
          completion.startsWith(message)
        ) {
          // Extract just the completion part (not the original text)
          const suggestionPart = completion.slice(message.length);
          setAutocompleteSuggestion(suggestionPart);
        } else {
          setAutocompleteSuggestion("");
        }
      } catch (error) {
        // Silently fail - don't show error for autocomplete
        console.log("Autocomplete failed:", error);
        setAutocompleteSuggestion("");
      } finally {
        setIsAutocompleting(false);
      }
    }, 800);

    // Cleanup timer on unmount or when message changes
    return () => {
      if (autocompleteTimerRef.current) {
        clearTimeout(autocompleteTimerRef.current);
      }
    };
  }, [message, token, selectedModel, isLoading, isEnhancing]);

  // Persist mode to localStorage (only after mounted)
  useEffect(() => {
    if (mounted) {
      localStorage.setItem("chatMode", mode);
    }
  }, [mode, mounted]);

  // Persist selected model to localStorage (only after mounted)
  useEffect(() => {
    if (mounted) {
      localStorage.setItem("selectedModel", selectedModel);
    }
  }, [selectedModel, mounted]);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognitionInstance = new SpeechRecognition();
        recognitionInstance.continuous = true; // Keep listening continuously
        recognitionInstance.interimResults = true; // Show results as you speak
        recognitionInstance.lang = "en-US";

        recognitionInstance.onresult = (event: any) => {
          console.log(
            "[Voice Debug] onresult triggered, resultIndex:",
            event.resultIndex,
            "results.length:",
            event.results.length
          );

          // Rebuild transcript from ALL results (not just new ones)
          let finalText = "";
          let interimText = "";

          // Process all results from the beginning
          for (let i = 0; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;

            if (event.results[i].isFinal) {
              // Final result - add to final text
              finalText += transcript + " ";
              console.log(
                "[Voice Debug] Final result [" + i + "]:",
                transcript
              );
            } else {
              // Interim result - add to interim text
              interimText += transcript;
              console.log(
                "[Voice Debug] Interim result [" + i + "]:",
                transcript
              );
            }
          }

          // Update message with the complete transcript
          const newMessage = (finalText + interimText).trim();
          console.log(
            "[Voice Debug] Complete message - final:",
            finalText,
            "interim:",
            interimText
          );
          console.log("[Voice Debug] New message:", newMessage);
          setMessage(newMessage);
        };

        recognitionInstance.onend = () => {
          console.log("[Voice Debug] Recognition ended");
          setIsRecording(false);
        };

        recognitionInstance.onerror = (event: any) => {
          // Ignore "no-speech" error as it's expected when user doesn't speak
          if (event.error !== "no-speech") {
            console.error(
              "[Voice Debug] Speech recognition error:",
              event.error
            );
          }
          setIsRecording(false);
        };

        recognitionInstance.onstart = () => {
          console.log("[Voice Debug] Recognition started");
        };

        setRecognition(recognitionInstance);
      }
    }
  }, []);

  const handleSend = () => {
    if (message.trim()) {
      // Extract tables mentioned with @ in the current message
      const mentionedTables: string[] = [];
      const mentionPattern = /@(\w+)/g;
      let match;

      while ((match = mentionPattern.exec(message)) !== null) {
        const tableName = match[1];
        // Include if it's 'general' or a valid table, and not already in the list
        if (
          (tableName === "general" || availableTables.includes(tableName)) &&
          !mentionedTables.includes(tableName)
        ) {
          mentionedTables.push(tableName);
        }
      }

      // Collect uploaded file URLs
      const attachmentsList = Object.values(uploadedFiles);

      // Send only the tables mentioned in this specific message
      onSendMessage(
        message,
        mode,
        selectedModel,
        mentionedTables.length > 0 ? mentionedTables : undefined,
        attachmentsList.length > 0 ? attachmentsList : undefined
      );

      // Clear message and attachments after sending
      setMessage("");
      setAutocompleteSuggestion("");
      setAttachedFiles([]);
      setUploadedFiles({});
      setUploadProgress({});
    }
  };

  const currentModelOption = modelOptions.find(
    (m) => m.value === selectedModel
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle Tab key for autocomplete
    if (e.key === "Tab" && autocompleteSuggestion) {
      e.preventDefault();
      // Clear any pending autocomplete timer
      if (autocompleteTimerRef.current) {
        clearTimeout(autocompleteTimerRef.current);
        autocompleteTimerRef.current = null;
      }
      // Set flag to skip next autocomplete trigger
      skipAutocompleteRef.current = true;
      setMessage(message + autocompleteSuggestion);
      setAutocompleteSuggestion("");
      return;
    }

    // Handle mention dropdown navigation
    if (showMentionDropdown) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedMentionIndex((prev) =>
          prev < filteredMentions.length - 1 ? prev + 1 : prev
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedMentionIndex((prev) => (prev > 0 ? prev - 1 : 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (filteredMentions.length > 0) {
          insertMention(filteredMentions[selectedMentionIndex]);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowMentionDropdown(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleTableSelection = (table: string) => {
    // Disabled - table selection now happens via @ mentions
    return;
  };

  const toggleMode = () => {
    const newMode = mode === "ask" ? "agent" : "ask";
    if (onModeChange) {
      onModeChange(newMode);
    } else {
      setInternalMode(newMode);
    }
  };

  // Handle @ mention detection
  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;

    setMessage(newValue);
    // Clear autocomplete suggestion when user types
    setAutocompleteSuggestion("");

    // Check for @ symbol before cursor
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);

    if (atMatch) {
      setMentionSearch(atMatch[1]);
      setMentionPosition(atMatch.index || 0);
      setShowMentionDropdown(true);
      setSelectedMentionIndex(0);
    } else {
      setShowMentionDropdown(false);
    }
  };

  // Filter available tables based on search, and always include @general
  const allAvailableOptions = ["general", ...availableTables];
  const filteredMentions = allAvailableOptions.filter((table) =>
    table.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  // Insert selected mention
  const insertMention = (table: string) => {
    const beforeMention = message.slice(0, mentionPosition);
    const afterMention = message.slice(
      mentionPosition + mentionSearch.length + 1
    );
    const newMessage = beforeMention + "@" + table + " " + afterMention;

    setMessage(newMessage);
    setShowMentionDropdown(false);

    // Focus back on textarea
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = mentionPosition + table.length + 2;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleFileAttachment = async (
    e: React.ChangeEvent<HTMLInputElement>,
    fileType: "general" | "image"
  ) => {
    const files = e.target.files;
    if (!files) return;

    // Check file count limits
    const maxFiles = 3; // Maximum 3 files for both images and other files
    const currentFileCount = attachedFiles.length;
    const newFileCount = files.length;

    if (currentFileCount + newFileCount > maxFiles) {
      toast.error(
        `Maximum ${maxFiles} files allowed. You currently have ${currentFileCount} file(s) attached.`
      );
      e.target.value = "";
      return;
    }

    const allowedFormats =
      fileType === "image"
        ? ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]
        : ["audio/mpeg", "audio/wav", "audio/mp3", "application/pdf"];

    const validFiles: File[] = [];
    const invalidFiles: string[] = [];

    Array.from(files).forEach((file) => {
      if (allowedFormats.includes(file.type)) {
        validFiles.push(file);
      } else {
        invalidFiles.push(file.name);
      }
    });

    if (invalidFiles.length > 0) {
      toast.error(
        `Unsupported files: ${invalidFiles.join(", ")}\n\nSupported: ${
          fileType === "image"
            ? "Images (JPEG, PNG, GIF, WebP)"
            : "Audio (MP3, WAV), PDF files"
        }`
      );
    }

    if (validFiles.length > 0) {
      const startIndex = attachedFiles.length;
      setAttachedFiles((prev) => [...prev, ...validFiles]);

      // Upload each file to backend with progress tracking
      validFiles.forEach(async (file, idx) => {
        const fileIndex = startIndex + idx;
        await uploadFileToBackend(file, fileIndex);
      });
    }

    // Reset input
    e.target.value = "";
  };

  const uploadFileToBackend = async (file: File, fileIndex: number) => {
    // Allow upload without token for development/testing
    const uploadToken = token || "";

    try {
      const uploadedFile = await uploadChatAttachment(
        uploadToken,
        file,
        (progress) => {
          setUploadProgress((prev) => ({ ...prev, [fileIndex]: progress }));
        }
      );

      // Store uploaded file info
      setUploadedFiles((prev) => ({ ...prev, [fileIndex]: uploadedFile }));

      // Remove progress after completion
      setTimeout(() => {
        setUploadProgress((prev) => {
          const newProgress = { ...prev };
          delete newProgress[fileIndex];
          return newProgress;
        });
      }, 500);

      toast.success(`${file.name} uploaded successfully`);
    } catch (error: any) {
      console.error("Upload failed:", error);

      // Provide more specific error messages
      let errorMessage = error.message;
      if (errorMessage.includes("Could not validate credentials")) {
        errorMessage = "Authentication failed. Please log in and try again.";
      } else if (errorMessage.includes("Network error")) {
        errorMessage = "Network error. Please check your connection.";
      }

      toast.error(`Failed to upload ${file.name}: ${errorMessage}`);
      // Remove failed file
      removeFile(fileIndex);
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
    setUploadProgress((prev) => {
      const newProgress = { ...prev };
      delete newProgress[index];
      return newProgress;
    });
    setUploadedFiles((prev) => {
      const newUploadedFiles = { ...prev };
      delete newUploadedFiles[index];
      return newUploadedFiles;
    });
  };

  const toggleVoiceRecording = () => {
    if (!recognition) {
      alert(
        "Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari."
      );
      return;
    }

    if (isRecording) {
      console.log("[Voice Debug] Stopping recording...");
      try {
        recognition.stop();
      } catch (error) {
        console.error("[Voice Debug] Error stopping recognition:", error);
      }
      setIsRecording(false);
    } else {
      console.log("[Voice Debug] Starting recording...");
      try {
        recognition.start();
        setIsRecording(true);
      } catch (error: any) {
        // If already started, just update the state
        if (error.message?.includes("already started")) {
          console.log(
            "[Voice Debug] Recognition already started, updating state"
          );
          setIsRecording(true);
        } else {
          console.error("[Voice Debug] Error starting recognition:", error);
          alert("Failed to start voice recognition. Please try again.");
        }
      }
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("audio/")) {
      return <FileAudio className="h-5 w-5 text-purple-500" />;
    }
    if (fileType === "application/pdf") {
      return <FileText className="h-5 w-5 text-red-500" />;
    }
    return <File className="h-5 w-5 text-zinc-500" />;
  };

  const handleUndo = useCallback(() => {
    if (currentHistoryIndex >= 0 && messageHistory.length > 0) {
      setMessage(messageHistory[currentHistoryIndex]);
      setCurrentHistoryIndex((prev) => prev - 1);
      toast.success("Undone");
    }
  }, [currentHistoryIndex, messageHistory]);

  // Global keyboard shortcut handler
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Handle Ctrl+1 / Cmd+1 for Agent Mode
      if ((e.ctrlKey || e.metaKey) && e.key === "1") {
        e.preventDefault();
        if (onModeChange) {
          onModeChange("agent");
        } else {
          setInternalMode("agent");
        }
        return;
      }

      // Handle Ctrl+2 / Cmd+2 for Ask Mode
      if ((e.ctrlKey || e.metaKey) && e.key === "2") {
        e.preventDefault();
        if (onModeChange) {
          onModeChange("ask");
        } else {
          setInternalMode("ask");
        }
        return;
      }

      // Handle Alt+Z for Undo enhanced prompt (only when textarea is focused)
      if (
        e.altKey &&
        e.key === "z" &&
        document.activeElement === textareaRef.current
      ) {
        if (currentHistoryIndex >= 0 && messageHistory.length > 0) {
          e.preventDefault();
          handleUndo();
        }
        return;
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [currentHistoryIndex, messageHistory, handleUndo]);

  const handleEnhancePrompt = async () => {
    if (!message.trim()) {
      toast.error("Please enter a prompt first");
      return;
    }

    if (!token) {
      toast.error("Please log in to use this feature");
      return;
    }

    // Clear autocomplete suggestion immediately
    setAutocompleteSuggestion("");
    // Clear any pending autocomplete timer
    if (autocompleteTimerRef.current) {
      clearTimeout(autocompleteTimerRef.current);
      autocompleteTimerRef.current = null;
    }

    setIsEnhancing(true);
    try {
      // Save current message to history before enhancing
      const newHistory = [
        ...messageHistory.slice(0, currentHistoryIndex + 1),
        message,
      ];
      setMessageHistory(newHistory);
      setCurrentHistoryIndex(newHistory.length - 1);

      const enhanced = await enhancePrompt(token, message, selectedModel);
      // Remove quotes if AI added them
      const cleanedEnhanced = enhanced.replace(/^["']|["']$/g, "").trim();
      // Set flag to skip next autocomplete trigger
      skipAutocompleteRef.current = true;
      setMessage(cleanedEnhanced);
      toast.success("Prompt Enhanced! (Press Alt+Z to undo)");
    } catch (error: any) {
      console.error("Failed to enhance prompt:", error);
      toast.error(error.message || "Failed to enhance prompt");
    } finally {
      setIsEnhancing(false);
    }
  };

  // Get image files for lightbox
  const imageFiles = attachedFiles.filter((file) =>
    file.type.startsWith("image/")
  );
  const lightboxSlides = imageFiles.map((file) => ({
    src: URL.createObjectURL(file),
  }));

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  return (
    <div className="bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl p-4">
        {/* Attached Files Display - Above Model Selector */}
        {attachedFiles.length > 0 && (
          <div className="mb-3">
            <div className="flex flex-wrap gap-2">
              {attachedFiles.map((file, index) => (
                <div key={index} className="relative group">
                  {file.type.startsWith("image/") ? (
                    <div className="relative">
                      <div
                        className="w-16 h-16 rounded-lg overflow-hidden border-2 border-zinc-200 dark:border-zinc-700 cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
                        onClick={() => {
                          const imageIndex = imageFiles.findIndex(
                            (img) => img === file
                          );
                          openLightbox(imageIndex);
                        }}
                      >
                        <img
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                        {/* Upload Progress Overlay */}
                        {uploadProgress[index] !== undefined &&
                          uploadProgress[index] < 100 && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <div className="w-full px-2">
                                <div className="w-full bg-zinc-700 rounded-full h-1.5">
                                  <div
                                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                                    style={{
                                      width: `${uploadProgress[index]}%`,
                                    }}
                                  />
                                </div>
                                <div className="text-white text-xs text-center mt-1">
                                  {uploadProgress[index]}%
                                </div>
                              </div>
                            </div>
                          )}
                      </div>
                      <button
                        onClick={() => removeFile(index)}
                        className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-lg transition-colors z-10"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1 py-0.5 truncate">
                        {file.name}
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="flex items-center gap-3 bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-3 min-w-[200px] hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
                        {getFileIcon(file.type)}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {file.name}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {formatFileSize(file.size)}
                          </div>
                        </div>
                        <button
                          onClick={() => removeFile(index)}
                          className="text-zinc-400 hover:text-red-500 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      {/* Upload Progress Overlay */}
                      {uploadProgress[index] !== undefined &&
                        uploadProgress[index] < 100 && (
                          <div className="absolute inset-0 bg-white/90 dark:bg-zinc-800/90 rounded-lg flex items-center justify-center backdrop-blur-sm">
                            <div className="w-full px-4">
                              <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
                                <div
                                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${uploadProgress[index]}%` }}
                                />
                              </div>
                              <div className="text-zinc-700 dark:text-zinc-300 text-xs text-center mt-2 font-medium">
                                Uploading... {uploadProgress[index]}%
                              </div>
                            </div>
                          </div>
                        )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Model Selector */}
        <div className="mb-3 flex items-center justify-end">
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  {currentModelOption && (
                    <Image
                      src={getProviderLogo(currentModelOption.provider)}
                      alt={currentModelOption.provider}
                      width={16}
                      height={16}
                      className="rounded"
                    />
                  )}
                  {currentModelOption?.label}
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Select AI Model</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {modelOptions.map((model) => (
                  <DropdownMenuItem
                    key={model.value}
                    onClick={() => setSelectedModel(model.value)}
                    className="flex items-center gap-3 py-2 cursor-pointer"
                  >
                    <Image
                      src={getProviderLogo(model.provider)}
                      alt={model.provider}
                      width={20}
                      height={20}
                      className="rounded flex-shrink-0"
                    />
                    <div className="flex-1 flex items-center justify-between min-w-0">
                      <span className="truncate mr-2">{model.label}</span>
                      <Badge
                        variant="secondary"
                        className="text-xs flex-shrink-0"
                      >
                        {model.provider}
                      </Badge>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Input Area */}
        <div className="rounded-2xl border bg-white shadow-sm dark:bg-zinc-900 flex flex-col">
          {/* Text Input Area */}
          <div className="relative">
            {/* Ghost text for autocomplete suggestion */}
            {autocompleteSuggestion && (
              <div
                className="absolute inset-0 px-4 py-3 pointer-events-none overflow-y-auto min-h-[80px] max-h-[200px] whitespace-pre-wrap break-words"
                style={{
                  lineHeight: "1.5rem",
                  fontSize: "0.875rem",
                  fontFamily: "inherit",
                  letterSpacing: "inherit",
                  wordSpacing: "inherit",
                }}
              >
                <span className="opacity-0 select-none">{message}</span>
                <span className="text-zinc-400 dark:text-zinc-600">
                  {autocompleteSuggestion}
                </span>
              </div>
            )}
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={handleMessageChange}
              onKeyDown={handleKeyDown}
              placeholder={
                mode === "agent"
                  ? "Ask the AI agent anything... (Type @ to mention datasets)"
                  : "Type your query here... (Type @ to mention datasets)"
              }
              className="min-h-[80px] max-h-[200px] resize-none border-0 bg-transparent px-4 py-3 focus-visible:ring-0 overflow-y-auto relative z-10 text-sm"
              style={{ background: "transparent", lineHeight: "1.5rem" }}
            />

            {/* Mention Autocomplete Dropdown */}
            {showMentionDropdown && filteredMentions.length > 0 && (
              <div className="absolute bottom-full left-4 mb-2 min-w-[16rem] max-w-[24rem] bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg max-h-48 overflow-y-auto z-50">
                <div className="p-2 text-xs text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">
                  Select dataset
                </div>
                {filteredMentions.map((table, index) => (
                  <div
                    key={table}
                    onClick={() => insertMention(table)}
                    className={`px-3 py-2 cursor-pointer flex items-center gap-2 ${
                      index === selectedMentionIndex
                        ? "bg-zinc-100 dark:bg-zinc-700"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-750"
                    }`}
                  >
                    <Database className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
                    <span className="text-sm truncate">@{table}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons Area */}
          <div className="flex justify-between items-center gap-2 px-4 pb-3 pt-2">
            {/* Left side - Mode Selector Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 min-w-[140px]"
                  disabled={isLoading}
                >
                  {mode === "agent" ? (
                    <>
                      <Bot className="h-3.5 w-3.5" />
                      <span>Agent Mode</span>
                    </>
                  ) : (
                    <>
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>Ask Mode</span>
                    </>
                  )}
                  <ChevronDown className="h-3.5 w-3.5 ml-auto opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel>Select Mode</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    onModeChange
                      ? onModeChange("agent")
                      : setInternalMode("agent")
                  }
                  className="flex items-center justify-between py-2.5 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4" />
                    <div className="flex flex-col">
                      <span className="font-medium">Agent Mode</span>
                      <span className="text-xs text-muted-foreground">
                        Interactive operations
                      </span>
                    </div>
                  </div>
                  <kbd className="bg-white pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                    {isMac ? (
                      <>
                        <span className="text-xs">⌘</span>1
                      </>
                    ) : (
                      "Ctrl+1"
                    )}
                  </kbd>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    onModeChange ? onModeChange("ask") : setInternalMode("ask")
                  }
                  className="flex items-center justify-between py-2.5 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    <div className="flex flex-col">
                      <span className="font-medium">Ask Mode</span>
                      <span className="text-xs text-muted-foreground">
                        Ask your data
                      </span>
                    </div>
                  </div>
                  <kbd className="bg-white pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                    {isMac ? (
                      <>
                        <span className="text-xs">⌘</span>2
                      </>
                    ) : (
                      "Ctrl+2"
                    )}
                  </kbd>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Right side - Action Buttons */}
            <div className="flex items-center gap-1">
              <TooltipProvider>
                {/* Enhance Prompt */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleEnhancePrompt}
                      disabled={isEnhancing || isLoading || !message.trim()}
                    >
                      <Sparkles
                        className={`h-4 w-4 ${
                          isEnhancing ? "gradient-icon" : ""
                        }`}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isEnhancing ? "Enhancing..." : "Enhance Prompt"}</p>
                  </TooltipContent>
                </Tooltip>

                {/* Image Attachment */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        document.getElementById("image-upload")?.click()
                      }
                    >
                      <ImageIcon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Upload Images (Max 3)</p>
                  </TooltipContent>
                </Tooltip>
                <input
                  id="image-upload"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFileAttachment(e, "image")}
                />

                {/* General File Attachment */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        document.getElementById("file-upload")?.click()
                      }
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Attach Files (PDF, Audio - Max 3)</p>
                  </TooltipContent>
                </Tooltip>
                <input
                  id="file-upload"
                  type="file"
                  accept="audio/mpeg,audio/wav,audio/mp3,.pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFileAttachment(e, "general")}
                />

                {/* Voice to Text */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 ${
                        isRecording ? "text-red-500 animate-pulse" : ""
                      }`}
                      onClick={toggleVoiceRecording}
                    >
                      <Mic className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isRecording ? "Stop Recording" : "Voice to Text"}</p>
                  </TooltipContent>
                </Tooltip>

                {/* Send/Stop Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    {isLoading ? (
                      <Button
                        size="icon"
                        className="h-8 w-8 bg-red-600 hover:bg-red-700"
                        onClick={onStopGeneration}
                      >
                        <Square className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleSend}
                        disabled={!message.trim()}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    )}
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {isLoading ? "Stop Generation" : "Send Message (Enter)"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>

        {/* Helper Text */}
        <p className="mt-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
          Press Enter to send, Shift + Enter for new line
          {autocompleteSuggestion && ", Tab to accept suggestion"}
        </p>
      </div>

      {/* Lightbox for Image Zoom */}
      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        index={lightboxIndex}
        slides={lightboxSlides}
      />
    </div>
  );
}
