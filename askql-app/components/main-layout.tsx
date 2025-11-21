"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sidebar } from "@/components/left-sidebar";
import { DatasetSidebar } from "@/components/dataset-sidebar";
import { ChatInterface } from "@/components/chat-interface";
import { ChatInput } from "@/components/chat-input";
import { SidebarToggles } from "@/components/sidebar-toggles";
import { TopNavigation } from "@/components/top-navigation";
import { ExportChatDialog } from "@/components/export-chat-dialog";
import { AgentConfirmationDialog } from "@/components/agent-confirmation-dialog";
import {
  sendAgentQueryStream,
  confirmAgentOperationStream,
  getDatasets,
  type Dataset,
  type UploadedFile,
} from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { useMessageHandler } from "@/hooks/use-message-handler";
import { useSidebarResize } from "@/hooks/use-sidebar-resize";
import { useLocalStorageState } from "@/hooks/use-local-storage-state";
import { formatMessageTimestamp } from "@/lib/utils/date-utils";
import type { AIModel } from "@/components/chat-input";

interface MainLayoutProps {
  children?: React.ReactNode;
  page?: string;
}

export function MainLayout({ children, page = "chat" }: MainLayoutProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token } = useAuth();
  
  // Use custom hooks for state management
  const {
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
  } = useMessageHandler(page);
  
  const [isSidebarCollapsed, setIsSidebarCollapsed, mounted] = useLocalStorageState("sidebarCollapsed", false);
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useLocalStorageState("rightSidebarCollapsed", true);
  const [mode, setMode] = useLocalStorageState<"ask" | "agent">("chatMode", "ask");
  
  const [availableTables, setAvailableTables] = useState<string[]>([]);
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);
  const [suggestionMessage, setSuggestionMessage] = useState<string | undefined>(undefined);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [localStatus, setLocalStatus] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [processedEvents, setProcessedEvents] = useState<Set<string>>(new Set());
  
  // Use custom hooks for sidebar resizing
  const leftSidebar = useSidebarResize({
    initialWidth: 256,
    minWidth: 200,
    maxWidth: 400,
  });
  
  const rightSidebar = useSidebarResize({
    initialWidth: 320,
    minWidth: 280,
    maxWidth: 500,
    isRight: true,
  });

  // Fetch available datasets/tables
  useEffect(() => {
    const fetchDatasets = async () => {
      if (token) {
        try {
          const datasets = await getDatasets(token);
          const tableNames = datasets.map((dataset) => dataset.table_name);
          setAvailableTables(tableNames);
        } catch (error) {
          console.error("Failed to fetch datasets:", error);
        }
      }
    };
    fetchDatasets();
  }, [token]);

  // Update URL when conversationId changes (for new chats only)
  useEffect(() => {
    if (conversationId && page === "chat") {
      const currentChatId = searchParams?.get("chat");
      
      // Only update URL if there's no chat ID in URL (new chat)
      if (!currentChatId && conversationId) {
        router.push(`/?chat=${conversationId}`, { scroll: false });
      }
    }
  }, [conversationId, page, searchParams, router]);

  // Load conversation from URL parameter if present
  useEffect(() => {
    const chatId = searchParams?.get("chat");
    if (chatId && page === "chat" && token) {
      const chatIdNum = parseInt(chatId, 10);
      if (!isNaN(chatIdNum) && loadedChatIdRef.current !== chatIdNum) {
        loadedChatIdRef.current = chatIdNum;
        loadConversation(chatIdNum);
      }
    } else if (!chatId && loadedChatIdRef.current !== null) {
      // No chat parameter in URL, reset to new chat state
      loadedChatIdRef.current = null;
      resetChat();
    }
  }, [searchParams, page, token, loadConversation, resetChat, loadedChatIdRef]);

  const handleSendMessageWrapper = async (
    content: string,
    mode: "ask" | "agent",
    model: AIModel,
    selectedTables?: string[],
    attachments?: UploadedFile[]
  ) => {
    await handleSendMessage(content, mode, model, selectedTables, attachments);
    setSidebarRefreshTrigger((prev) => prev + 1);
  };

  const handleNavigate = useCallback(
    (targetPage: string) => {
      if (targetPage === "chat") {
        router.push("/");
      } else {
        router.push(`/${targetPage}`);
      }
    },
    [router]
  );

  const handleNewChat = useCallback(() => {
    resetChat();
    // Clear the chat parameter from URL to prevent reloading old chat
    router.push("/", { scroll: false });
  }, [router, resetChat]);

  const handleSelectChat = (chatId: number) => {
    router.push(`/?chat=${chatId}`);
  };

  // Handle agent operation confirmation (legacy - not used anymore)
  const handleConfirmOperation = async (confirmed: boolean) => {
    setShowConfirmDialog(false);
    setPendingOperation(null);
    // This function is kept for compatibility but not used
    // Confirmation is now handled inline with streaming
  };

  const handleToggleLeftSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const handleToggleRightSidebar = () => {
    setIsRightSidebarCollapsed(!isRightSidebarCollapsed);
  };

  const handleExportChat = () => {
    setShowExportDialog(true);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-zinc-950">
      <div
        className="relative transition-all duration-300 ease-in-out"
        style={{ width: isSidebarCollapsed ? "64px" : `${leftSidebar.width}px` }}
      >
        <Sidebar
          onNavigate={handleNavigate}
          currentPage={page}
          onNewChat={handleNewChat}
          onSelectChat={handleSelectChat}
          currentChatId={conversationId}
          isCollapsed={isSidebarCollapsed}
          refreshTrigger={sidebarRefreshTrigger}
        />
        {!isSidebarCollapsed && (
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500 transition-colors group"
            onMouseDown={leftSidebar.startResize}
          >
            <div className="absolute inset-y-0 -left-1 -right-1" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col overflow-hidden relative">
        {/* Sidebar toggles and export button */}
        <SidebarToggles
          mounted={mounted}
          page={page}
          isSidebarCollapsed={isSidebarCollapsed}
          isRightSidebarCollapsed={isRightSidebarCollapsed}
          messagesLength={messages.length}
          onToggleLeftSidebar={handleToggleLeftSidebar}
          onToggleRightSidebar={handleToggleRightSidebar}
          onExportChat={handleExportChat}
        />

        {/* Top Navigation Bar - visible on all pages */}
        <TopNavigation onNavigate={handleNavigate} />

        {page === "chat" ? (
          <>
            <ChatInterface
              messages={messages}
              isLoading={isLoading || isStreaming}
              isLoadingChat={isLoadingChat}
              currentStatus={localStatus || currentStatus}
              onSuggestionClick={(suggestion) => {
                setSuggestionMessage(suggestion);
                setTimeout(() => setSuggestionMessage(undefined), 100);
              }}
              mode={mode}
              availableTables={availableTables}
              onConfirmAction={async (
                action,
                operation,
                sql,
                explanation,
                model
              ) => {
                // Send a new user message with the action
                const userMessage = action === "execute" ? "Execute" : "Cancel";

                // Clear pending operation
                setPendingOperation(null);

                if (action === "cancel") {
                  // For Cancel, send directly without adding to UI (backend will delete it anyway)
                  try {
                    // Send the request without using handleSendMessage to avoid adding user message to UI
                    const response = await fetch(
                      `${process.env.NEXT_PUBLIC_API_URL}/api/agent`,
                      {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({
                          query: userMessage,
                          conversation_id: conversationId,
                          model: model,
                          selected_tables: availableTables,
                        }),
                      }
                    );

                    if (response.ok) {
                      // Remove buttons from the confirmation message immediately
                      setMessages((prev) => {
                        const updated = [...prev];
                        const lastMsg = updated[updated.length - 1];
                        if (lastMsg && lastMsg.role === "assistant") {
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
                    }
                  } catch (error) {
                    console.error("Error:", error);
                  }
                } else {
                  // For Execute, use the streaming confirmation API
                  try {
                    setIsStreaming(true);
                    setLocalStatus("Executing operation...");
                    setProcessedEvents(new Set()); // Clear processed events for new operation
                    setMessages((prev) => {
                      const updated = [...prev];
                      const lastMsg = updated[updated.length - 1];
                      if (lastMsg && lastMsg.role === "assistant") {
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

                    // Use the streaming confirmation API to continue processing
                    await confirmAgentOperationStream(
                      conversationId || 0,
                      operation,
                      sql,
                      explanation,
                      true, // confirmed = true
                      token,
                      model,
                      (data) => {
                        // Handle streaming events from confirmation
                        if (data.type === "sql_result") {
                          const result = data.content;
                          
                          // Check if this is a confirmation result (has operation context) or query result
                          // Confirmation results have row_count for modifications, query results have data array
                          if (operation && result && typeof result.success === 'boolean' && 
                              typeof result.row_count === 'number' && !result.data) {
                            // This is a confirmation result (CREATE/UPDATE/DELETE operation)
                            setLocalStatus("Operation completed, analyzing next steps...");
                            
                            if (result.success) {
                              setMessages((prev) => {
                                const updated = [...prev];
                                const lastMsg = updated[updated.length - 1];
                                
                                if (lastMsg && lastMsg.role === "assistant") {
                                  
                                  // Check if result is already in the message to prevent duplicates
                                  const row_count = result.row_count || 0;
                                  let operationText = operation.toLowerCase();
                                  if (operationText.endsWith('e')) {
                                    operationText = operationText.slice(0, -1) + 'ed';
                                  } else {
                                    operationText += 'ed';
                                  }
                                  const resultText = `**✅ Result:** Successfully ${operationText} ${row_count} record(s).`;
                                  
                                  // Check if this result is already in the message
                                  if (lastMsg.content.includes(resultText)) {
                                    return prev; // Return unchanged state
                                  }
                                  
                                  lastMsg.content += `\n\n${resultText}`;
                                }
                                return updated;
                              });
                            } else {
                              // Handle error case
                              console.log('❌ [SQL RESULT ERROR] Adding error to message');
                              setMessages((prev) => {
                                const updated = [...prev];
                                const lastMsg = updated[updated.length - 1];
                                
                                if (lastMsg && lastMsg.role === "assistant") {
                                  const errorText = `**❌ Error:** ${result.error || 'Operation failed'}`;
                                  
                                  // Check if this error is already in the message
                                  if (lastMsg.content.includes(errorText)) {
                                    console.log('⚠️ [DUPLICATE ERROR] Skipping duplicate error');
                                    return prev;
                                  }
                                  
                                  console.log('➕ [ADDING ERROR]', errorText);
                                  lastMsg.content += `\n\n${errorText}`;
                                }
                                return updated;
                              });
                            }
                          } else {
                            // This is a query result (SELECT operation) - add the data to message
                            setMessages((prev) => {
                              const updated = [...prev];
                              const lastMsg = updated[updated.length - 1];
                              if (lastMsg && lastMsg.role === "assistant" && result && result.success) {
                                const row_count = result.row_count || 0;
                                const resultContent = `\n\n**📋 Query Result:** (${row_count} row${row_count !== 1 ? 's' : ''} returned)\n\n\`\`\`table\n${JSON.stringify(result.data || [], null, 2)}\n\`\`\``;
                                
                                // Check if this exact query result content is already in the message
                                if (!lastMsg.content.includes(resultContent)) {
                                  lastMsg.content += resultContent;
                                } else {
                                  console.log('⚠️ [DUPLICATE QUERY RESULT] Skipping duplicate result');
                                }
                              }
                              return updated;
                            });
                          }
                        } else if (data.type === "brief_reasoning") {
                          // Add next step reasoning with separator (for immediate feedback)
                          setMessages((prev) => {
                            const updated = [...prev];
                            const lastMsg = updated[updated.length - 1];
                            if (lastMsg && lastMsg.role === "assistant") {
                              // Check if this reasoning is already in the message to prevent duplicates
                              const reasoningText = `💭 **Next Step:** ${data.content}`;
                              if (lastMsg.content.includes(reasoningText)) {
                                console.log('⚠️ [DUPLICATE REASONING] Skipping duplicate reasoning');
                                return prev; // Return unchanged state
                              }
                              
                              // Add separator and next step message
                              lastMsg.content += `\n\n---\n\n💭 **Next Step:** ${data.content}\n\n`;
                            }
                            return updated;
                          });
                        } else if (data.type === "loading") {
                          setLocalStatus(data.content);
                        } else if (data.type === "confirmation_required") {
                          // Another confirmation needed - backend already appended it to the message
                          // Clear loading status and update pending operation state
                          setLocalStatus("");
                          setIsStreaming(false);
                          setPendingOperation({
                            operation: data.content.operation,
                            sql: data.content.sql,
                            explanation: data.content.message,
                            model: model,
                          });
                          
                          // Backend already appended the confirmation to the database
                          // Reload conversation to show the confirmation buttons
                          if (conversationId) {
                            loadConversation(conversationId);
                          }
                        } else if (data.type === "final_answer_chunk") {
                          // Handle streaming final answer chunks - append each word/chunk to message
                          setMessages((prev) => {
                            const updated = [...prev];
                            const lastMsg = updated[updated.length - 1];
                            if (lastMsg && lastMsg.role === "assistant") {
                              // Check if this is the first chunk of the final answer
                              if (!lastMsg.content.includes('\n\n**💡 Summary:**')) {
                                // Add the summary header before the first chunk
                                lastMsg.content += '\n\n**💡 Summary:**\n';
                              }
                              
                              // Check if this chunk is already at the end of the content to prevent duplicates
                              const summaryIndex = lastMsg.content.lastIndexOf('\n\n**💡 Summary:**\n');
                              if (summaryIndex !== -1) {
                                const currentSummary = lastMsg.content.substring(summaryIndex + '\n\n**💡 Summary:**\n'.length);
                                if (currentSummary.endsWith(data.content)) {
                                  console.log('⚠️ [DUPLICATE CHUNK] Skipping duplicate chunk:', `"${data.content}"`);
                                  return prev; // Skip this duplicate chunk
                                }
                              }
                              
                              // Append the chunk content
                              lastMsg.content += data.content;
                            }
                            return updated;
                          });
                        } else if (data.type === "final_answer_complete") {
                          // Final answer streaming is complete - no need to reload since we built it chunk by chunk
                        } else if (data.type === "sql_query") {
                          // SQL query event - add to message for display
                          setMessages((prev) => {
                            const updated = [...prev];
                            const lastMsg = updated[updated.length - 1];
                            if (lastMsg && lastMsg.role === "assistant") {
                              const queryContent = `\n\n**Executed SQL Query:**\n\`\`\`sql\n${data.content}\n\`\`\``;
                              // Check if this query is already in the message
                              if (!lastMsg.content.includes(data.content)) {
                                lastMsg.content += queryContent;
                              }
                            }
                            return updated;
                          });
                        } else if (data.type === "chart_config") {
                          // Chart config event - add chart visualization to message
                          setMessages((prev) => {
                            const updated = [...prev];
                            const lastMsg = updated[updated.length - 1];
                            if (lastMsg && lastMsg.role === "assistant") {
                              // Add chart as a code block - the markdown renderer expects ```chart format
                              const chartContent = `\n\n\`\`\`chart\n${JSON.stringify(data.content, null, 2)}\n\`\`\``;
                              
                              // More robust duplicate detection - check if the exact chart block already exists
                              if (!lastMsg.content.includes(chartContent)) {
                                lastMsg.content += chartContent;
                              }
                            }
                            return updated;
                          });
                        } else if (data.type === "done") {
                          setLocalStatus("");
                          setIsStreaming(false);
                          if (!conversationId) {
                            setConversationId(data.conversation_id);
                          }
                        } else {
                          console.log('[FRONTEND DEBUG] Unknown event type:', data.type, data);
                        }
                      }
                    );
                  } catch (error) {
                    console.error("Error executing confirmation:", error);
                    // Show error in the message
                    setMessages((prev) => {
                      const updated = [...prev];
                      const lastMsg = updated[updated.length - 1];
                      if (lastMsg && lastMsg.role === "assistant") {
                        lastMsg.content += `\n\n**❌ Error:** ${error instanceof Error ? error.message : 'Failed to execute operation'}`;
                      }
                      return updated;
                    });
                  }
                }
              }}
            />
            <ChatInput
              onSendMessage={handleSendMessageWrapper}
              isLoading={isLoading}
              onStopGeneration={handleStopGeneration}
              availableTables={availableTables}
              initialMessage={suggestionMessage}
              mode={mode}
              onModeChange={setMode}
            />
          </>
        ) : (
          <div className="flex-1 overflow-auto">{children}</div>
        )}
      </div>

      {/* Right sidebar for datasets */}
      {(page === "chat" || page === "dataset" || page === "history") && (
        <div
          className="relative transition-all duration-300 ease-in-out overflow-hidden"
          style={{
            width: isRightSidebarCollapsed ? "0px" : `${rightSidebar.width}px`,
          }}
        >
          {!isRightSidebarCollapsed && (
            <div
              className="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-blue-500 transition-colors group z-50"
              onMouseDown={rightSidebar.startResize}
            >
              <div className="absolute inset-y-0 -left-1 -right-1" />
            </div>
          )}
          <DatasetSidebar
            isCollapsed={isRightSidebarCollapsed}
            onDatasetsChange={() => {
              // Refresh available tables when datasets change
              const fetchDatasets = async () => {
                if (token) {
                  try {
                    const datasets = await getDatasets(token);
                    const tableNames = datasets.map(
                      (dataset) => dataset.table_name
                    );
                    setAvailableTables(tableNames);
                  } catch (error) {
                    console.error("Failed to fetch datasets:", error);
                  }
                }
              };
              fetchDatasets();
            }}
          />
        </div>
      )}

      {/* Export Chat Dialog */}
      <ExportChatDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        messages={messages}
        conversationId={conversationId}
      />

      {/* Agent Operation Confirmation Dialog */}
      <AgentConfirmationDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        pendingOperation={pendingOperation}
        onConfirm={handleConfirmOperation}
      />
    </div>
  );
}
