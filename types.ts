
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
  pageNumber?: number;
}

export interface UploadedDocument {
  id: string;
  title: string;
  uploadDate: number;
  chunkCount: number;
  size: number;
  isProcessed: boolean;
  // New Fields
  category?: 'Fatwa' | 'History' | 'Constitution' | 'General';
  isTrusted?: boolean; // High priority source
  version?: number;
  uploadedBy?: string;
}

export interface Lead {
  id: string;
  phoneNumber: string;
  queryContext: string;
  timestamp: number;
  status?: 'Pending' | 'Contacted' | 'Resolved';
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  detectedLanguage: string | null;
}

export interface AppSettings {
  showTextInput: boolean;
  appName: string;
  appDescription: string;
  logoBase64?: string;
  systemInstruction?: string;
  adminPassword?: string;
  // Advanced Config
  modelSelection?: 'gemini-2.5-flash' | 'gemini-1.5-pro';
  safetyThreshold?: 'Low' | 'Medium' | 'High';
  enableVoiceInput?: boolean;
  maintenanceMode?: boolean;
}

// --- Enterprise Types ---

export enum UserRole {
  SUPER_ADMIN = 'Super Admin',
  DOC_ADMIN = 'Document Admin',
  SCHOLAR = 'Scholar Reviewer',
  MODERATOR = 'Moderator',
  ANALYST = 'Analytics Viewer'
}

export interface AdminUser {
  id: string;
  email: string;
  role: UserRole;
  lastLogin: number;
}

export interface ScholarReview {
  id: string;
  query: string;
  aiAnswer: string;
  status: 'Pending' | 'Verified' | 'Rejected' | 'Edited';
  reviewedBy?: string;
  timestamp: number;
  category?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  user: string;
  details: string;
  timestamp: number;
  severity: 'Info' | 'Warning' | 'Critical';
}

export enum View {
  CHAT = 'CHAT',
  ADMIN_LOGIN = 'ADMIN_LOGIN',
  ADMIN_DASHBOARD = 'ADMIN_DASHBOARD',
}