"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import {
  sendAskQuery,
  sendAskQueryStream,
  sendAgentQueryStream,
  getConversation,
  type UploadedFile,
} from "@/lib/api";
import { formatMessageTimestamp } from "@/lib/utils/date-utils";
import type { AIModel } from "@/components/chat-input";

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

interface PendingOperation {
  operation: string;
  sql: string;
  explanation: string;
  model: string;
}

export function useMessageHandler(page: string) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string>("");
  const [pendingOperation, setPendingOperation] =
    useState<PendingOperation | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const loadedChatIdRef = useRef<number | null>(null);

  const handleSendMessage = useCallback(
    async (
      content: string,
      mode: "ask" | "agent",
      model: AIModel,
      selectedTables?: string[],
      attachments?: UploadedFile[]
    ) => {
      // Log attachments for debugging
      if (attachments && attachments.length > 0) {
        console.log("Sending message with attachments:", attachments);
      }

      const newMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content,
        timestamp: formatMessageTimestamp(new Date().toISOString()),
        attachments: attachments,
      };

      setMessages((prev) => [...prev, newMessage]);
      setIsLoading(true);
      setCurrentStatus("AI is planning..."); // Set initial status immediately

      // Create new AbortController for this request
      abortControllerRef.current = new AbortController();

      try {
        if (mode === "ask") {
          // Use streaming if tables are selected
          if (selectedTables && selectedTables.length > 0) {
            let aiResponse = "";
            let accumulatedContent = ""; // Build content sequentially as events arrive
            let finalAnswer = "";
            const streamingMessageId = (Date.now() + 1).toString();

            // Check if it's general mode
            const isGeneralMode = selectedTables.some(
              (t) => t.toLowerCase() === "general"
            );

            const buildContent = () => {
              let content = accumulatedContent;

              if (finalAnswer) {
                // Add AI's final answer AFTER all accumulated content
                // Skip conclusion formatting for general mode, no @ symbol, OR if no SQL was executed
                const hasSqlExecution = accumulatedContent.includes(
                  "**Executed SQL Query:**"
                );
                const hasAtSymbol = content.includes("@");

                if (isGeneralMode || !hasSqlExecution || !hasAtSymbol) {
                  // No formatting for general mode, no @ symbol, or explanation-only responses
                  // Only add newlines if there's existing content
                  if (content.trim()) {
                    content += `\n\n${finalAnswer}`;
                  } else {
                    content = finalAnswer;
                  }
                } else {
                  // Add conclusion formatting only for SQL execution results with @ symbol
                  content += `\n\n---\n\n**💡 Conclusion:**\n${finalAnswer}`;
                }
              }

              return content;
            };

            await sendAskQueryStream(
              content,
              token,
              conversationId || undefined,
              model,
              selectedTables,
              (data) => {
                if (data.type === "ai_response") {
                  // Store AI's initial response (with SQL query)
                  aiResponse = data.content;
                  const aiMessage: Message = {
                    id: streamingMessageId,
                    role: "assistant",
                    content: buildContent(),
                    timestamp: formatMessageTimestamp(new Date().toISOString()),
                    model: model,
                  };
                  setMessages((prev) => [...prev, aiMessage]);
                } else if (data.type === "sql_query") {
                  // Append SQL query to accumulated content
                  const timestamp = new Date().toISOString();
                  // Don't set status here - query_executor already sends loading status
                  accumulatedContent += `\n\n**Executed SQL Query:**\n\`\`\`sql\n${data.content}\n\`\`\`\n`;
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastMsg = updated[updated.length - 1];
                    if (lastMsg && lastMsg.id === streamingMessageId) {
                      lastMsg.content = buildContent();
                    }
                    return updated;
                  });
                } else if (data.type === "step_indicator") {
                  // Append step indicator to accumulated content
                  accumulatedContent += `\n\n---\n\n### ${data.content}\n`;
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastMsg = updated[updated.length - 1];
                    if (lastMsg && lastMsg.id === streamingMessageId) {
                      lastMsg.content = buildContent();
                    }
                    return updated;
                  });
                } else if (data.type === "brief_reasoning") {
                  // Show brief reasoning between steps
                  accumulatedContent += `\n\n---\n\n💭 **Next Step:** ${data.content}\n\n`;
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastMsg = updated[updated.length - 1];
                    if (lastMsg && lastMsg.id === streamingMessageId) {
                      lastMsg.content = buildContent();
                    }
                    return updated;
                  });
                } else if (data.type === "loading") {
                  const timestamp = new Date().toISOString();
                  setCurrentStatus(data.content || "Processing...");
                } else if (data.type === "sql_result") {
                  // Append query result to accumulated content
                  const result = data.content;
                  if (result && result.success) {
                    accumulatedContent += `\n**📋 Query Result:** (${
                      result.row_count
                    } row${result.row_count !== 1 ? "s" : ""} returned)\n\n`;
                    accumulatedContent += `<details open>\n<summary>Results</summary>\n\n\`\`\`json\n${JSON.stringify(
                      result.data,
                      null,
                      2
                    )}\n\`\`\`\n</details>\n`;
                  }
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastMsg = updated[updated.length - 1];
                    if (lastMsg && lastMsg.id === streamingMessageId) {
                      lastMsg.content = buildContent();
                    }
                    return updated;
                  });
                } else if (data.type === "analyzing") {
                  // Show analyzing indicator
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastMsg = updated[updated.length - 1];
                    if (lastMsg && lastMsg.id === streamingMessageId) {
                      lastMsg.content =
                        buildContent() + `\n\n> 🧠 ${data.content}`;
                    }
                    return updated;
                  });
                } else if (data.type === "final_answer_chunk") {
                  // Append streaming chunk to final answer
                  setCurrentStatus("AI is generating conclusion...");
                  finalAnswer += data.content;
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastMsg = updated[updated.length - 1];
                    if (lastMsg && lastMsg.id === streamingMessageId) {
                      lastMsg.content = buildContent();
                    }
                    return updated;
                  });
                } else if (data.type === "final_answer_complete") {
                  // Final answer streaming complete
                  finalAnswer = data.content;
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastMsg = updated[updated.length - 1];
                    if (lastMsg && lastMsg.id === streamingMessageId) {
                      lastMsg.content = buildContent();
                    }
                    return updated;
                  });
                } else if (data.type === "final_answer") {
                  // Store AI's final answer (fallback for non-streaming)
                  finalAnswer = data.content;
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastMsg = updated[updated.length - 1];
                    if (lastMsg && lastMsg.id === streamingMessageId) {
                      // Update existing message
                      lastMsg.content = buildContent();
                    } else {
                      // No message exists yet (explanation-only response) - create it
                      const aiMessage: Message = {
                        id: streamingMessageId,
                        role: "assistant",
                        content: buildContent(),
                        timestamp: formatMessageTimestamp(
                          new Date().toISOString()
                        ),
                        model: model,
                      };
                      updated.push(aiMessage);
                    }
                    return updated;
                  });
                } else if (data.type === "checking_graph") {
                  // Show checking graph indicator
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastMsg = updated[updated.length - 1];
                    if (lastMsg && lastMsg.id === streamingMessageId) {
                      lastMsg.content =
                        buildContent() + `\n\n> 📊 ${data.content}`;
                    }
                    return updated;
                  });
                } else if (data.type === "chart_config") {
                  // Append chart configuration to accumulated content
                  setCurrentStatus("AI is generating visualization...");
                  accumulatedContent += `\n\n**📊 Visualization:**\n\`\`\`chart\n${JSON.stringify(
                    data.content,
                    null,
                    2
                  )}\n\`\`\`\n`;
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastMsg = updated[updated.length - 1];
                    if (lastMsg && lastMsg.id === streamingMessageId) {
                      lastMsg.content = buildContent();
                    }
                    return updated;
                  });
                } else if (data.type === "graph_decision") {
                  // Graph decision received (chart already added if applicable)
                  // No need to append anything here
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastMsg = updated[updated.length - 1];
                    if (lastMsg && lastMsg.id === streamingMessageId) {
                      lastMsg.content = buildContent();
                    }
                    return updated;
                  });
                } else if (data.type === "done") {
                  setCurrentStatus("");
                  if (!conversationId) {
                    setConversationId(data.conversation_id);
                  }
                }
              },
              abortControllerRef.current.signal,
              attachments
            );
          } else {
            // Non-streaming for queries without tables
            const response = await sendAskQuery(
              content,
              token,
              conversationId || undefined,
              model,
              abortControllerRef.current.signal,
              selectedTables,
              attachments
            );

            // Check if request was aborted after receiving response
            if (abortControllerRef.current === null) {
              // Request was cancelled, don't process the response
              return;
            }

            // Update conversation ID if it's a new conversation
            if (!conversationId) {
              setConversationId(response.conversation_id);
            }

            // Add AI response to messages
            const aiResponse: Message = {
              id: response.assistant_message.id.toString(),
              role: "assistant",
              content: response.assistant_message.content,
              timestamp: formatMessageTimestamp(
                response.assistant_message.created_at
              ),
              model: model,
            };
            setMessages((prev) => [...prev, aiResponse]);
          }
        } else {
          // Agent mode - now works like Ask mode with streaming
          let aiResponse = "";
          let accumulatedContent = ""; // Build content sequentially as events arrive
          let finalAnswer = "";
          const streamingMessageId = (Date.now() + 1).toString();

          const buildContent = () => {
            let content = accumulatedContent;

            if (finalAnswer) {
              // For @general mode or no @ symbol, don't add Summary header since it's a complete response
              const isGeneralMode = selectedTables?.some(
                (t) => t.toLowerCase() === "general"
              );
              const hasAtSymbol = content.includes("@");

              if (isGeneralMode || !hasAtSymbol) {
                // @general responses or no @ symbol - just add them directly
                if (content.trim()) {
                  content += `\n\n${finalAnswer}`;
                } else {
                  content = finalAnswer;
                }
              } else {
                // Add Summary header for normal Agent Mode operations with @ symbol
                content += `\n\n---\n\n**💡 Summary:**\n${finalAnswer}`;
              }
            }

            return content;
          };

          await sendAgentQueryStream(
            content,
            token,
            conversationId || undefined,
            model,
            selectedTables,
            (data) => {
              if (data.type === "ai_response") {
                // Store AI's initial response
                aiResponse = data.content;
                const aiMessage: Message = {
                  id: streamingMessageId,
                  role: "assistant",
                  content: buildContent(),
                  timestamp: formatMessageTimestamp(new Date().toISOString()),
                  model: model,
                };
                setMessages((prev) => [...prev, aiMessage]);
              } else if (data.type === "sql_query") {
                // Append SQL query to accumulated content
                const timestamp = new Date().toISOString();
                // Don't set status here - query_executor already sends loading status
                accumulatedContent += `\n\n**Executed SQL:**\n\`\`\`sql\n${data.content}\n\`\`\`\n`;
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg && lastMsg.id === streamingMessageId) {
                    lastMsg.content = buildContent();
                  }
                  return updated;
                });
              } else if (data.type === "sql_result") {
                // Append query result to accumulated content
                const result = data.content;
                if (result && result.success) {
                  if (result.data && result.data.length > 0) {
                    accumulatedContent += `\n**📋 Query Result:** (${
                      result.row_count
                    } row${result.row_count !== 1 ? "s" : ""} returned)\n\n`;
                    accumulatedContent += `<details open>\n<summary>Results</summary>\n\n\`\`\`json\n${JSON.stringify(
                      result.data,
                      null,
                      2
                    )}\n\`\`\`\n</details>\n`;
                  } else {
                    accumulatedContent += `\n**✅ Result:** ${
                      result.message || `${result.row_count} row(s) affected`
                    }`;
                  }
                }
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg && lastMsg.id === streamingMessageId) {
                    lastMsg.content = buildContent();
                  }
                  return updated;
                });
              } else if (data.type === "step_indicator") {
                // Append step indicator to accumulated content
                accumulatedContent += `\n\n---\n\n### ${data.content}\n`;
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg && lastMsg.id === streamingMessageId) {
                    lastMsg.content = buildContent();
                  }
                  return updated;
                });
              } else if (data.type === "brief_reasoning") {
                // Show brief reasoning between steps (like ask mode)
                const timestamp = new Date().toISOString();
                accumulatedContent += `\n\n---\n\n💭 **Next Step:** ${data.content}\n\n`;
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg && lastMsg.id === streamingMessageId) {
                    lastMsg.content = buildContent();
                  }
                  return updated;
                });
              } else if (data.type === "chart_config") {
                // Append chart configuration to accumulated content
                setCurrentStatus("AI is generating visualization...");
                accumulatedContent += `\n\n**📊 Visualization:**\n\`\`\`chart\n${JSON.stringify(
                  data.content,
                  null,
                  2
                )}\n\`\`\`\n`;
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg && lastMsg.id === streamingMessageId) {
                    lastMsg.content = buildContent();
                  }
                  return updated;
                });
              } else if (data.type === "final_answer_chunk") {
                // Append streaming chunk to final answer
                setCurrentStatus("AI is generating conclusion...");
                finalAnswer += data.content;
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg && lastMsg.id === streamingMessageId) {
                    lastMsg.content = buildContent();
                  }
                  return updated;
                });
              } else if (data.type === "final_answer_complete") {
                // Final answer streaming complete
                finalAnswer = data.content;
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg && lastMsg.id === streamingMessageId) {
                    lastMsg.content = buildContent();
                  }
                  return updated;
                });
              } else if (data.type === "final_answer") {
                // Store AI's final answer (fallback for non-streaming)
                finalAnswer = data.content;
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg && lastMsg.id === streamingMessageId) {
                    // Update existing message
                    lastMsg.content = buildContent();
                  } else {
                    // No message exists yet - create it
                    const aiMessage: Message = {
                      id: streamingMessageId,
                      role: "assistant",
                      content: buildContent(),
                      timestamp: formatMessageTimestamp(
                        new Date().toISOString()
                      ),
                      model: model,
                    };
                    updated.push(aiMessage);
                  }
                  return updated;
                });
              } else if (data.type === "confirmation_required") {
                // Store the pending operation for the Execute/Cancel buttons
                setPendingOperation({
                  operation: data.content.operation,
                  sql: data.content.sql,
                  explanation: data.content.message,
                  model: model,
                });

                // Build the confirmation message with buttons
                const confirmationContent = `${
                  data.content.message
                }\n\n**SQL to Execute:**\n\`\`\`sql\n${
                  data.content.sql
                }\n\`\`\`\n\n**⚠️ This operation will modify your data. Please confirm:**\n\n<confirmation operation="${
                  data.content.operation
                }" sql="${btoa(data.content.sql)}" message="${btoa(
                  data.content.message
                )}" model="${model}" />`;

                // Update the current message with confirmation
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg && lastMsg.id === streamingMessageId) {
                    lastMsg.content =
                      buildContent() + "\n\n" + confirmationContent;
                  } else {
                    // If message doesn't exist yet, create it
                    updated.push({
                      id: streamingMessageId,
                      role: "assistant",
                      content: confirmationContent,
                      timestamp: formatMessageTimestamp(
                        new Date().toISOString()
                      ),
                      model: model,
                    });
                  }
                  return updated;
                });
              } else if (data.type === "cancelled") {
                // Operation was cancelled - remove buttons from the message
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg && lastMsg.role === "assistant") {
                    // Remove the confirmation tag and warning text
                    lastMsg.content = lastMsg.content
                      .replace(/\n\n<confirmation[^>]+\/>/g, "")
                      .replace(
                        /\*\*⚠️ This operation will modify your data\. Please confirm:\*\*\n*/g,
                        ""
                      )
                      .trim();
                  }
                  return updated;
                });
              } else if (data.type === "loading") {
                // Update loading status
                setCurrentStatus(data.content);
              } else if (data.type === "done") {
                setCurrentStatus("");
                if (!conversationId) {
                  setConversationId(data.conversation_id);
                }
              }
            },
            abortControllerRef.current.signal,
            attachments
          );
        }
      } catch (error) {
        // Check if error is due to abort
        if (error instanceof Error && error.name === "AbortError") {
          // Don't add any message - just remove the user message that was optimistically added
          // Actually, keep the user message but don't add assistant response
          // User can see their message was sent but response was cancelled
        } else {
          console.error("Error sending message:", error);
          const errorMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: `Error: ${
              error instanceof Error ? error.message : "Failed to get response"
            }. Please make sure the backend server is running.`,
            timestamp: formatMessageTimestamp(new Date().toISOString()),
          };
          setMessages((prev) => [...prev, errorMessage]);
        }
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [token, conversationId]
  );

  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      // Set to null immediately to prevent processing any response that might arrive
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, []);

  const loadConversation = useCallback(
    async (chatId: number) => {
      if (!token) return;

      try {
        setIsLoadingChat(true);
        setMessages([]);

        const conversation = await getConversation(chatId, token);
        const formattedMessages: Message[] = conversation.messages.map(
          (msg) => ({
            id: msg.id.toString(),
            role: msg.role,
            content: msg.content,
            timestamp: formatMessageTimestamp(msg.created_at),
            model: msg.model,
            attachments: msg.attachments,
          })
        );

        setMessages(formattedMessages);
        setConversationId(chatId);
      } catch (error) {
        console.error("Failed to load conversation:", error);
      } finally {
        setIsLoadingChat(false);
      }
    },
    [token]
  );

  const resetChat = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    loadedChatIdRef.current = null;
  }, []);

  return {
    messages,
    setMessages,
    conversationId,
    setConversationId,
    isLoading,
    isLoadingChat,
    currentStatus,
    pendingOperation,
    setPendingOperation,
    handleSendMessage,
    handleStopGeneration,
    loadConversation,
    resetChat,
    loadedChatIdRef,
  };
}
