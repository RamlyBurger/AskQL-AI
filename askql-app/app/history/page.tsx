"use client";

import { useState, useEffect } from "react";
import { MainLayout } from "@/components/main-layout";
import { ScrollArea } from "@/components/field-scrollable";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/layout-box";
import { Button } from "@/components/form-btn";
import { Badge } from "@/components/ui-icon";
import { MessageSquare, Trash2, Calendar, Clock } from "lucide-react";
import { getConversations, deleteConversation } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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

interface ChatHistory {
  id: number;
  title: string;
  created_at: string;
  updated_at?: string;
  mode: string;
}

export default function HistoryPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadChatHistory();
  }, [token]);

  const loadChatHistory = async () => {
    try {
      setIsLoading(true);
      const conversations = await getConversations(token);
      // Reverse to show newest first
      setChatHistory(conversations.reverse());
    } catch (error) {
      console.error("Failed to load chat history:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteChat = async (chatId: number) => {
    try {
      await deleteConversation(chatId, token);
      setChatHistory(chatHistory.filter((chat) => chat.id !== chatId));
      toast.success("Conversation deleted successfully");
    } catch (error) {
      console.error("Failed to delete conversation:", error);
      toast.error("Failed to delete conversation");
    }
  };

  const handleSelectChat = (chatId: number) => {
    router.push(`/?chat=${chatId}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const groupChatsByDate = () => {
    const groups: { [key: string]: ChatHistory[] } = {};

    chatHistory.forEach((chat) => {
      const dateKey = formatDate(chat.created_at);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(chat);
    });

    return groups;
  };

  const groupedChats = groupChatsByDate();

  return (
    <MainLayout page="history">
      <div className="flex h-full overflow-auto bg-zinc-50 dark:bg-zinc-950">
        <div className="mx-auto w-full max-w-5xl p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              Chat History
            </h1>
            <p className="mt-2 text-zinc-500 dark:text-zinc-400">
              View and manage all your conversations
            </p>
          </div>

          <div>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-zinc-500">Loading chat history...</div>
              </div>
            ) : chatHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="h-16 w-16 text-zinc-300 dark:text-zinc-700" />
                <h3 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  No conversations yet
                </h3>
                <p className="mt-2 text-zinc-500 dark:text-zinc-400">
                  Start a new chat to see it here
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {Object.entries(groupedChats).map(([date, chats]) => (
                  <div key={date}>
                    <div className="mb-4 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-zinc-500" />
                      <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                        {date}
                      </h2>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {chats.map((chat) => (
                        <Card
                          key={chat.id}
                          className="group cursor-pointer transition-all hover:shadow-md"
                          onClick={() => handleSelectChat(chat.id)}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <MessageSquare className="h-4 w-4 text-zinc-500" />
                                <Badge variant="secondary" className="text-xs">
                                  {chat.mode}
                                </Badge>
                              </div>
                              <AlertDialog>
                                <AlertMsgTrigger
                                  asChild
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 opacity-100 transition-opacity"
                                  >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </AlertMsgTrigger>
                                <AlertMsgContent
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <AlertMsgHeader>
                                    <AlertMsgTitle>
                                      Delete Conversation
                                    </AlertMsgTitle>
                                    <AlertMsgDescription>
                                      Are you sure you want to delete this
                                      conversation? This action cannot be
                                      undone.
                                    </AlertMsgDescription>
                                  </AlertMsgHeader>
                                  <AlertMsgFooter>
                                    <AlertMsgCancel
                                      onClick={(e) => e.stopPropagation()}
                                    >
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
                            <CardTitle className="mt-2 line-clamp-2 text-base">
                              {chat.title}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="flex items-center gap-1 text-xs text-zinc-500">
                              <Clock className="h-3 w-3" />
                              {formatTime(chat.created_at)}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
