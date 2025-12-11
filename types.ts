
export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  language?: string;
  citations?: string[]; // Titles of documents used
  isAudio?: boolean;
  shareContent?: string; // Content formatted for sharing/copying
}

export interface DocumentChunk {
  id: string;
  docId: string;
  docTitle: string;
  text: string;
  embedding?: number[];
}

export interface UploadedDocument {
  id: string;
  title: string;
  uploadDate: number;
  chunkCount: number;
  size: number;
  isProcessed: boolean;
}

export interface Lead {
  id: string;
  phoneNumber: string;
  queryContext: string;
  timestamp: number;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  detectedLanguage: string | null;
}

export interface AppSettings {
  showTextInput: boolean;
  useLiveMode: boolean; // Toggle for Experimental Live API
  appName: string;
  appDescription: string;
  logoBase64?: string; // Base64 encoded image string
  systemInstruction?: string; // Custom AI system prompt
  adminPassword?: string; // Configurable admin password
}

export enum View {
  CHAT = 'CHAT',
  ADMIN_LOGIN = 'ADMIN_LOGIN',
  ADMIN_DASHBOARD = 'ADMIN_DASHBOARD',
}
