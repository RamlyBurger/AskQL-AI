"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/form-btn";
import { ScrollArea } from "@/components/field-scrollable";
import { Separator } from "@/components/ui-separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/profile-icon";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/custom-hint";
import { toast } from "sonner";
import {
  MessageSquarePlus,
  Database,
  Settings,
  User,
  MessageSquare,
  Trash2,
  LogOut,
  RefreshCw,
} from "lucide-react";
import {
  AlertDialog,
  AlertMsgAction,
  AlertMsgCancel,
  AlertMsgContent,
  AlertMsgDescription,
  AlertMsgFooter,
  AlertMsgHeader,
  AlertMsgTitle,
  AlertMsgTrigger,
} from "@/components/alert-message";
import {
  getConversations,
  deleteConversation,
  deleteAllConversations,
} from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";

interface ChatHistory {
  id: number;
  title: string;
  created_at: string;
  updated_at?: string;
  mode: string;
}

interface SidebarProps {
  onNavigate: (page: string) => void;
  currentPage: string;
  onNewChat: () => void;
  onSelectChat: (chatId: number) => void;
  currentChatId: number | null;
  isCollapsed?: boolean;
  refreshTrigger?: number;
}

export function Sidebar({
  onNavigate,
  currentPage,
  onNewChat,
  onSelectChat,
  currentChatId,
  isCollapsed = false,
  refreshTrigger,
}: SidebarProps) {
  const { user, token, logout } = useAuth();
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load chat history from backend
  useEffect(() => {
    loadChatHistory();
  }, [token, user]);

  // Reload chat history when currentChatId changes (new chat created)
  useEffect(() => {
    if (currentChatId) {
      loadChatHistory();
    }
  }, [currentChatId]);

  // Reload chat history when refreshTrigger changes (message sent to existing chat)
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      loadChatHistory();
    }
  }, [refreshTrigger]);

  const loadChatHistory = async () => {
    // Only load chat history if user is logged in
    if (!token || !user) {
      setChatHistory([]);
      return;
    }

    try {
      const conversations = await getConversations(token);
      // Backend already returns sorted by updated_at desc (newest first)
      setChatHistory(conversations.slice(0, 10));
    } catch (error) {
      console.error("Failed to load chat history:", error);
      setChatHistory([]);
    }
  };

  const handleDeleteChat = async (chatId: number) => {
    if (!token || !user) {
      toast.error("Please log in to delete conversations");
      return;
    }

    try {
      await deleteConversation(chatId, token);
      setChatHistory(chatHistory.filter((chat) => chat.id !== chatId));
      toast.success("Conversation deleted successfully");

      // If deleted chat was active, start new chat
      if (currentChatId === chatId) {
        onNewChat();
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
      toast.error("Failed to delete conversation");
    }
  };

  const handleDeleteAllChats = async () => {
    if (!token || !user) {
      toast.error("Please log in to delete conversations");
      return;
    }

    try {
      const result = await deleteAllConversations(token);
      setChatHistory([]);
      toast.success(result.message);

      // Always start new chat to clear messages
      onNewChat();
    } catch (error) {
      console.error("Failed to delete all conversations:", error);
      toast.error("Failed to delete all conversations");
    }
  };

  const formatTimestamp = (dateString: string) => {
    // Parse the date string properly (backend returns UTC timestamps)
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24)
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  // Collapsed sidebar view
  if (isCollapsed) {
    return (
      <TooltipProvider>
        <div
          className="flex h-screen w-full flex-col border-r items-center py-4 gap-2 transition-all duration-300 ease-in-out"
          style={{ backgroundColor: "rgb(253, 253, 253)" }}
        >
          {/* Logo */}
          <div className="mb-2">
            <Image
              src="/askql_logo_square.png"
              alt="AskQL Logo"
              width={40}
              height={40}
              className="rounded-md"
            />
          </div>

          {/* New Chat Icon */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                onClick={onNewChat}
                className="group relative overflow-hidden"
              >
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:translate-x-full transition-transform duration-700 ease-out" />
                <MessageSquarePlus className="h-5 w-5 relative z-10" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={8}>
              New Chat
            </TooltipContent>
          </Tooltip>

          {/* Navigation Icons */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onNavigate("history")}
                className={
                  currentPage === "history" || currentPage === "chat"
                    ? "animate-gradient"
                    : ""
                }
              >
                <MessageSquare className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={8}>
              Chat History
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onNavigate("dataset")}
                className={currentPage === "dataset" ? "animate-gradient" : ""}
              >
                <Database className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={8}>
              Dataset
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onNavigate("settings")}
                className={currentPage === "settings" ? "animate-gradient" : ""}
              >
                <Settings className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={8}>
              Settings
            </TooltipContent>
          </Tooltip>

          <div className="flex-1" />

          {/* Profile and Logout Icons */}
          <div className="flex flex-col gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onNavigate("profile")}
                  className={
                    currentPage === "profile" ? "animate-gradient" : ""
                  }
                >
                  <User className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={8}>
                Profile
              </TooltipContent>
            </Tooltip>
            <AlertDialog>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertMsgTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 transition-none"
                    >
                      <LogOut className="h-5 w-5" />
                    </Button>
                  </AlertMsgTrigger>
                </TooltipTrigger>
                <TooltipContent side="left" sideOffset={8}>
                  Logout
                </TooltipContent>
              </Tooltip>
              <AlertMsgContent>
                <AlertMsgHeader>
                  <AlertMsgTitle>
                    Are you sure you want to logout?
                  </AlertMsgTitle>
                  <AlertMsgDescription>
                    You will be logged out of your account and redirected to the
                    login page.
                  </AlertMsgDescription>
                </AlertMsgHeader>
                <AlertMsgFooter>
                  <AlertMsgCancel>Cancel</AlertMsgCancel>
                  <AlertMsgAction
                    onClick={logout}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    Logout
                  </AlertMsgAction>
                </AlertMsgFooter>
              </AlertMsgContent>
            </AlertDialog>
          </div>
        </div>
      </TooltipProvider>
    );
  }

  // Expanded sidebar view
  return (
    <TooltipProvider>
      <div
        className="flex h-screen w-full flex-col border-r transition-all duration-300 ease-in-out"
        style={{ backgroundColor: "rgb(253, 253, 253)" }}
      >
        {/* Logo */}
        <div className="w-full px-0 pt-4 pb-2">
          <Image
            src="/askql_logo.gif"
            alt="AskQL Logo"
            width={256}
            height={128}
            className="w-full h-auto"
            unoptimized
          />
        </div>

        {/* Header with New Chat button */}
        <div className="flex items-center justify-between px-4 pb-4">
          <Button
            className="flex-1 justify-start gap-2 cursor-pointer group relative overflow-hidden"
            onClick={onNewChat}
          >
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:translate-x-full transition-transform duration-700 ease-out" />
            <MessageSquarePlus className="h-4 w-4 relative z-10" />
            <span className="relative z-10">New Chat</span>
          </Button>
        </div>

        {/* Navigation */}
        <div className="space-y-1 px-4 pb-4">
          <Button
            variant="ghost"
            className={`w-full justify-start gap-2 cursor-pointer ${
              currentPage === "history" || currentPage === "chat"
                ? "animate-gradient"
                : ""
            }`}
            onClick={() => onNavigate("history")}
          >
            <MessageSquare className="h-4 w-4" />
            Chat History
          </Button>
          <Button
            variant="ghost"
            className={`w-full justify-start gap-2 cursor-pointer ${
              currentPage === "dataset" ? "animate-gradient" : ""
            }`}
            onClick={() => onNavigate("dataset")}
          >
            <Database className="h-4 w-4" />
            Dataset
          </Button>
          <Button
            variant="ghost"
            className={`w-full justify-start gap-2 cursor-pointer ${
              currentPage === "settings" ? "animate-gradient" : ""
            }`}
            onClick={() => onNavigate("settings")}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </div>

        <Separator />

        {/* Chat History - Only show when logged in */}
        {user && token ? (
          <ScrollArea className="flex-1 px-3 overflow-hidden">
            <div className="space-y-1 py-4 w-full">
              <div className="flex items-center justify-between px-3 mb-2 min-w-0">
                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 truncate">
                  Recent Chats
                </p>
                <div className="flex items-center gap-1 shrink-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={loadChatHistory}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>Refresh</p>
                    </TooltipContent>
                  </Tooltip>
                  <AlertDialog>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertMsgTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertMsgTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>Delete All</p>
                      </TooltipContent>
                    </Tooltip>
                    <AlertMsgContent>
                      <AlertMsgHeader>
                        <AlertMsgTitle>Delete All Conversations</AlertMsgTitle>
                        <AlertMsgDescription>
                          Are you sure you want to delete all conversations?
                          This action cannot be undone and will permanently
                          delete all your chat history.
                        </AlertMsgDescription>
                      </AlertMsgHeader>
                      <AlertMsgFooter>
                        <AlertMsgCancel>Cancel</AlertMsgCancel>
                        <AlertMsgAction
                          onClick={handleDeleteAllChats}
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          Delete All
                        </AlertMsgAction>
                      </AlertMsgFooter>
                    </AlertMsgContent>
                  </AlertDialog>
                </div>
              </div>
              {chatHistory.map((chat) => (
                <div
                  key={chat.id}
                  className="group relative flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-100 cursor-pointer"
                  style={
                    currentChatId === chat.id
                      ? { backgroundColor: "rgba(0, 0, 0, 1)", color: "white" }
                      : {}
                  }
                  onClick={() => onSelectChat(chat.id)}
                >
                  <MessageSquare
                    className={`h-4 w-4 shrink-0 flex-none ${
                      currentChatId === chat.id ? "text-white" : "text-zinc-500"
                    }`}
                  />
                  <div
                    className="flex-1 min-w-0 overflow-hidden"
                    style={{ maxWidth: "calc(100% - 60px)" }}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p
                          className={`truncate font-medium text-sm leading-tight ${
                            currentChatId === chat.id
                              ? "text-white"
                              : "text-zinc-900 dark:text-zinc-100"
                          }`}
                        >
                          {chat.title.length > 25
                            ? chat.title.substring(0, 25) + "..."
                            : chat.title}
                        </p>
                      </TooltipTrigger>
                      {chat.title.length > 25 && (
                        <TooltipContent side="right">
                          <p>{chat.title}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                    <p
                      className={`truncate text-xs leading-tight ${
                        currentChatId === chat.id
                          ? "text-white/80"
                          : "text-zinc-500 dark:text-zinc-400"
                      }`}
                    >
                      {formatTimestamp(chat.updated_at || chat.created_at)}
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertMsgTrigger
                      asChild
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className={`absolute right-2 opacity-0 group-hover:opacity-100 shrink-0 flex-none ${
                          currentChatId === chat.id
                            ? "text-white/70 hover:text-white"
                            : "text-zinc-500 hover:text-red-500"
                        }`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </AlertMsgTrigger>
                    <AlertMsgContent onClick={(e) => e.stopPropagation()}>
                      <AlertMsgHeader>
                        <AlertMsgTitle>Delete Conversation</AlertMsgTitle>
                        <AlertMsgDescription>
                          Are you sure you want to delete this conversation?
                          This action cannot be undone.
                        </AlertMsgDescription>
                      </AlertMsgHeader>
                      <AlertMsgFooter>
                        <AlertMsgCancel onClick={(e) => e.stopPropagation()}>
                          Cancel
                        </AlertMsgCancel>
                        <AlertMsgAction
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteChat(chat.id);
                          }}
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          Delete
                        </AlertMsgAction>
                      </AlertMsgFooter>
                    </AlertMsgContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex-1 flex items-center justify-center px-4 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Please log in to view your chat history
            </p>
          </div>
        )}

        <Separator />

        {/* User Profile with Logout */}
        <div className="p-3">
          <div
            className={`flex items-center gap-2 p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
              currentPage === "profile" ? "animate-gradient" : ""
            }`}
          >
            <button
              className="flex flex-1 items-center gap-3 rounded-lg p-2 transition-colors cursor-pointer"
              onClick={() => onNavigate("profile")}
              style={
                currentPage === "profile"
                  ? { backgroundColor: "transparent" }
                  : {}
              }
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src="" alt={user?.full_name || "User"} />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs font-semibold">
                  {user?.full_name ? (
                    user.full_name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left overflow-hidden">
                <p className="text-sm font-medium truncate text-zinc-900 dark:text-zinc-100">
                  {user?.full_name || "Guest User"}
                </p>
                <p className="text-xs truncate text-zinc-500 dark:text-zinc-400">
                  {user?.email || "Not logged in"}
                </p>
              </div>
            </button>

            <AlertDialog>
              <AlertMsgTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 transition-none text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              </AlertMsgTrigger>
              <AlertMsgContent>
                <AlertMsgHeader>
                  <AlertMsgTitle>
                    Are you sure you want to logout?
                  </AlertMsgTitle>
                  <AlertMsgDescription>
                    You will be logged out of your account and redirected to the
                    login page.
                  </AlertMsgDescription>
                </AlertMsgHeader>
                <AlertMsgFooter>
                  <AlertMsgCancel>Cancel</AlertMsgCancel>
                  <AlertMsgAction
                    onClick={logout}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    Logout
                  </AlertMsgAction>
                </AlertMsgFooter>
              </AlertMsgContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
