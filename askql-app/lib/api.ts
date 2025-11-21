/**
 * API client for AskQL backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  conversation_id: number;
  created_at: string;
  model?: string;
  attachments?: Array<{
    url: string;
    filename: string;
    file_type: string;
    size: number;
  }>;
}

export interface Conversation {
  id: number;
  title: string;
  mode: "ask" | "agent";
  created_at: string;
  updated_at?: string;
  messages: Message[];
}

export interface AskRequest {
  query: string;
  conversation_id?: number;
  model?: string;
  selected_tables?: string[];
}

export interface AskResponse {
  conversation_id: number;
  user_message: Message;
  assistant_message: Message;
}

/**
 * Send a query in Ask mode to the backend (streaming version)
 */
export async function sendAskQueryStream(
  query: string,
  token: string | null,
  conversationId?: number,
  model?: string,
  selectedTables?: string[],
  onChunk?: (data: any) => void,
  signal?: AbortSignal,
  attachments?: UploadedFile[]
): Promise<void> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/api/ask/stream`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query,
      conversation_id: conversationId,
      model: model || "gemini-2.5-flash",
      selected_tables: selectedTables,
      attachments: attachments || [],
    }),
    signal,
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || "Failed to send query");
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) {
    throw new Error("No response body");
  }

  try {
    while (true) {
      // Check if aborted before reading
      if (signal?.aborted) {
        reader.cancel();
        break;
      }

      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = JSON.parse(line.slice(6));
          onChunk?.(data);
        }
      }
    }
  } catch (error) {
    // If aborted, cancel the reader and don't throw
    if (signal?.aborted) {
      reader.cancel();
      return;
    }
    throw error;
  }
}

/**
 * Send a query in Ask mode to the backend (non-streaming version)
 */
export async function sendAskQuery(
  query: string,
  token: string | null,
  conversationId?: number,
  model?: string,
  signal?: AbortSignal,
  selectedTables?: string[],
  attachments?: UploadedFile[]
): Promise<AskResponse> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/api/ask`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query,
      conversation_id: conversationId,
      model: model || "gemini-2.5-flash",
      selected_tables: selectedTables,
      attachments: attachments || [],
    }),
    signal,
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || "Failed to send query");
  }

  return response.json();
}

/**
 * Send a query in Agent mode to the backend (streaming version)
 */
export async function sendAgentQueryStream(
  query: string,
  token: string | null,
  conversationId?: number,
  model?: string,
  selectedTables?: string[],
  onChunk?: (data: any) => void,
  signal?: AbortSignal,
  attachments?: UploadedFile[]
): Promise<void> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/api/agent`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query,
      conversation_id: conversationId,
      model: model || "gemini-2.5-flash",
      selected_tables: selectedTables,
      attachments: attachments || [],
    }),
    signal,
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || "Failed to send agent query");
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) {
    throw new Error("No response body");
  }

  try {
    while (true) {
      // Check if aborted before reading
      if (signal?.aborted) {
        reader.cancel();
        break;
      }

      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = JSON.parse(line.slice(6));
          if (onChunk) {
            onChunk(data);
          }
        }
      }
    }
  } catch (error) {
    // If aborted, cancel the reader and don't throw
    if (signal?.aborted) {
      reader.cancel();
      return;
    }
    throw error;
  }
}

/**
 * Confirm and execute an agent operation (CREATE, UPDATE, DELETE) with streaming
 */
export async function confirmAgentOperationStream(
  conversationId: number,
  operation: string,
  sqlQuery: string,
  explanation: string,
  confirmed: boolean,
  token: string | null,
  model: string,
  onEvent: (data: any) => void,
  signal?: AbortSignal
): Promise<void> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/api/agent/confirm`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      conversation_id: conversationId,
      operation,
      sql_query: sqlQuery,
      explanation,
      confirmed,
      model: model || "gemini-2.5-flash",
    }),
    signal,
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || "Failed to confirm operation");
  }

  // Handle streaming response
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) {
    throw new Error("Response body is not readable");
  }

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = JSON.parse(line.slice(6));
          onEvent(data);
        }
      }
    }
  } catch (error) {
    if (signal?.aborted) {
      reader.cancel();
      return;
    }
    throw error;
  }
}

/**
 * Get all conversations
 */
export async function getConversations(
  token: string | null
): Promise<Conversation[]> {
  const headers: HeadersInit = {};

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/api/conversations`, {
    headers,
  });

  if (!response.ok) {
    throw new Error("Failed to fetch conversations");
  }

  return response.json();
}

/**
 * Get a specific conversation with messages
 */
export async function getConversation(
  conversationId: number,
  token: string | null
): Promise<Conversation> {
  const headers: HeadersInit = {};

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(
    `${API_BASE_URL}/api/conversations/${conversationId}`,
    {
      headers,
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch conversation");
  }

  const data = await response.json();
  return data;
}

/**
 * Delete a conversation
 */
export async function deleteConversation(
  conversationId: number,
  token: string | null
): Promise<void> {
  const headers: HeadersInit = {};

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(
    `${API_BASE_URL}/api/conversations/${conversationId}`,
    {
      method: "DELETE",
      headers,
    }
  );

  if (!response.ok) {
    throw new Error("Failed to delete conversation");
  }
}

/**
 * Delete all conversations
 */
export async function deleteAllConversations(
  token: string | null
): Promise<{ message: string }> {
  const headers: HeadersInit = {};

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/api/conversations`, {
    method: "DELETE",
    headers,
  });

  if (!response.ok) {
    throw new Error("Failed to delete all conversations");
  }

  return response.json();
}

/**
 * Get messages for a conversation
 */
export async function getConversationMessages(
  conversationId: number,
  token: string | null
): Promise<Message[]> {
  const headers: HeadersInit = {};

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(
    `${API_BASE_URL}/api/conversations/${conversationId}/messages`,
    {
      headers,
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch messages");
  }

  return response.json();
}

/**
 * Authentication API
 */

export interface SignupRequest {
  email: string;
  full_name: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface UserInfo {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
}

/**
 * Register a new user
 */
export async function signup(data: SignupRequest): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Registration failed" }));
    throw new Error(error.detail || "Registration failed");
  }

  return response.json();
}

/**
 * Login user
 */
export async function login(data: LoginRequest): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Login failed" }));
    throw new Error(error.detail || "Login failed");
  }

  return response.json();
}

/**
 * Get current user information
 */
export async function getCurrentUser(token: string): Promise<UserInfo> {
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch user info");
  }

  return response.json();
}

/**
 * Login or create tester account
 */
export async function loginTesterUser(): Promise<AuthResponse> {
  const testerEmail = "tester@askql.com";
  const testerPassword = "tester123";

  // Try to login first
  try {
    return await login({ email: testerEmail, password: testerPassword });
  } catch (loginError) {
    // If login fails, try to signup
    try {
      return await signup({
        email: testerEmail,
        password: testerPassword,
        full_name: "Tester Account",
      });
    } catch (signupError) {
      // If signup also fails (user exists but wrong password), try login again
      return await login({ email: testerEmail, password: testerPassword });
    }
  }
}

/**
 * API Keys Management
 */

export interface APIKeys {
  google: string | null;
  openai: string | null;
  anthropic: string | null;
  deepseek: string | null;
}

/**
 * Get user's API keys
 */
export async function getAPIKeys(token: string): Promise<APIKeys> {
  const response = await fetch(`${API_BASE_URL}/api/user/api-keys`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch API keys");
  }

  return response.json();
}

/**
 * Update user's API keys
 */
export async function updateAPIKeys(
  token: string,
  apiKeys: Partial<APIKeys>
): Promise<APIKeys> {
  const response = await fetch(`${API_BASE_URL}/api/user/api-keys`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(apiKeys),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Failed to update API keys" }));
    throw new Error(error.detail || "Failed to update API keys");
  }

  return response.json();
}

/**
 * Dataset Management
 */

export interface Dataset {
  id: number;
  user_id: number;
  name: string;
  file_type: string;
  table_name: string;
  row_count: number;
  column_count: number;
  columns: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface DatasetData {
  dataset: Dataset;
  data: Record<string, any>[];
  total_rows: number;
}

/**
 * Upload dataset files
 */
export async function uploadDatasets(
  token: string,
  files: File[]
): Promise<Dataset[]> {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  const response = await fetch(`${API_BASE_URL}/api/datasets/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Failed to upload datasets" }));
    throw new Error(error.detail || "Failed to upload datasets");
  }

  return response.json();
}

/**
 * Get all datasets for current user
 */
export async function getDatasets(token: string): Promise<Dataset[]> {
  const response = await fetch(`${API_BASE_URL}/api/datasets`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch datasets");
  }

  return response.json();
}

/**
 * Get dataset with data
 */
export async function getDatasetData(
  token: string,
  datasetId: number,
  limit: number = 100,
  offset: number = 0
): Promise<DatasetData> {
  const response = await fetch(
    `${API_BASE_URL}/api/datasets/${datasetId}?limit=${limit}&offset=${offset}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch dataset data");
  }

  return response.json();
}

/**
 * Delete a dataset
 */
export async function deleteDataset(
  token: string,
  datasetId: number
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/datasets/${datasetId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to delete dataset");
  }
}

/**
 * Enhance a user's prompt using AI
 */
export async function enhancePrompt(
  token: string,
  prompt: string,
  model: string
): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/enhance-prompt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ prompt, model }),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Failed to enhance prompt" }));
    throw new Error(error.detail || "Failed to enhance prompt");
  }

  const data = await response.json();
  return data.enhanced_prompt;
}

/**
 * Autocomplete a user's prompt using AI
 */
export async function autocompletePrompt(
  token: string,
  prompt: string,
  model: string
): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/autocomplete-prompt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ prompt, model }),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Failed to autocomplete prompt" }));
    throw new Error(error.detail || "Failed to autocomplete prompt");
  }

  const data = await response.json();
  return data.autocompleted_prompt;
}

/**
 * Upload chat attachment (image/file) with progress tracking
 */
export interface UploadedFile {
  url: string;
  filename: string;
  file_type: string;
  size: number;
}

export async function uploadChatAttachment(
  token: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<UploadedFile> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);

    // Track upload progress
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(progress);
      }
    });

    // Handle completion
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch (error) {
          reject(new Error("Invalid response from server"));
        }
      } else {
        try {
          const error = JSON.parse(xhr.responseText);
          reject(new Error(error.detail || "Upload failed"));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    });

    // Handle errors
    xhr.addEventListener("error", () => {
      reject(new Error("Network error during upload"));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload cancelled"));
    });

    // Send request
    xhr.open("POST", `${API_BASE_URL}/api/chat/upload`);
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }
    xhr.send(formData);
  });
}
