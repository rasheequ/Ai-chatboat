
import { UploadedDocument, DocumentChunk, AppSettings, Lead, ScholarReview, AuditLog, UserRole } from '../types';

// Using localStorage to persist data across reloads
const DOCS_KEY = 'samastha_docs';
const CHUNKS_KEY = 'samastha_chunks';
const SETTINGS_KEY = 'samastha_settings';
const LEADS_KEY = 'samastha_leads';
const REVIEWS_KEY = 'samastha_reviews';
const LOGS_KEY = 'samastha_logs';

const DEFAULT_SYSTEM_INSTRUCTION = `You are an AI assistant for the public information portal of SAMASTHA KERALA JAMIYYATHUL ULAMA.

Your rules:
1. You must answer ONLY questions about Samastha Kerala Jamiyyathul Ulama, its history, leaders, rulings, and institutions.
2. You must use ONLY the text provided in the context (RAG) or Search Grounding.
3. If the user asks unrelated questions, politely refuse.
4. NEVER hallucinate.
5. ALWAYS reply in the same language the user used.
6. Keep answers concise unless asked for details.`;

export const mockDB = {
  // --- Documents ---
  getDocuments: (): UploadedDocument[] => {
    const data = localStorage.getItem(DOCS_KEY);
    return data ? JSON.parse(data) : [];
  },

  addDocument: (doc: UploadedDocument) => {
    const docs = mockDB.getDocuments();
    docs.push(doc);
    localStorage.setItem(DOCS_KEY, JSON.stringify(docs));
    mockDB.logAction('Upload', 'Admin', `Uploaded document: ${doc.title}`);
  },

  updateDocument: (doc: UploadedDocument) => {
    let docs = mockDB.getDocuments();
    docs = docs.map(d => d.id === doc.id ? doc : d);
    localStorage.setItem(DOCS_KEY, JSON.stringify(docs));
  },

  deleteDocument: (id: string) => {
    let docs = mockDB.getDocuments();
    const doc = docs.find(d => d.id === id);
    docs = docs.filter(d => d.id !== id);
    localStorage.setItem(DOCS_KEY, JSON.stringify(docs));

    // Also delete associated chunks
    let chunks = mockDB.getChunks();
    chunks = chunks.filter(c => c.docId !== id);
    localStorage.setItem(CHUNKS_KEY, JSON.stringify(chunks));
    
    if(doc) mockDB.logAction('Delete', 'Admin', `Deleted document: ${doc.title}`, 'Warning');
  },

  // --- Chunks ---
  getChunks: (): DocumentChunk[] => {
    const data = localStorage.getItem(CHUNKS_KEY);
    return data ? JSON.parse(data) : [];
  },

  addChunks: (newChunks: DocumentChunk[]) => {
    const chunks = mockDB.getChunks();
    chunks.push(...newChunks);
    localStorage.setItem(CHUNKS_KEY, JSON.stringify(chunks));
  },
  
  updateChunk: (updatedChunk: DocumentChunk) => {
      const chunks = mockDB.getChunks();
      const index = chunks.findIndex(c => c.id === updatedChunk.id);
      if (index !== -1) {
          chunks[index] = updatedChunk;
          localStorage.setItem(CHUNKS_KEY, JSON.stringify(chunks));
      }
  },

  // --- Settings ---
  getSettings: (): AppSettings => {
    const data = localStorage.getItem(SETTINGS_KEY);
    const defaults: AppSettings = { 
        showTextInput: true, 
        appName: 'Samastha AI',
        appDescription: 'A multilingual AI assistant for Samastha Kerala Jamiyyathul Ulama.',
        systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
        adminPassword: 'rasheequ.designs',
        modelSelection: 'gemini-2.5-flash',
        safetyThreshold: 'Medium',
        enableVoiceInput: true,
        maintenanceMode: false
    };
    
    if (data) {
        return { ...defaults, ...JSON.parse(data) };
    }
    return defaults;
  },

  saveSettings: (settings: AppSettings) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    mockDB.logAction('Config', 'Super Admin', 'Updated system settings');
  },

  // --- Leads ---
  getLeads: (): Lead[] => {
    const data = localStorage.getItem(LEADS_KEY);
    return data ? JSON.parse(data) : [];
  },

  addLead: (lead: Lead) => {
    const leads = mockDB.getLeads();
    leads.push(lead);
    localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
  },

  // --- Scholar Reviews (New) ---
  getReviews: (): ScholarReview[] => {
      const data = localStorage.getItem(REVIEWS_KEY);
      if (data) return JSON.parse(data);
      
      // Seed Data
      return [
          {
              id: 'rev-1',
              query: 'What is the stance on moon sighting?',
              aiAnswer: 'Samastha follows the traditional method of naked-eye moon sighting for determining the beginning of Islamic months.',
              status: 'Pending',
              timestamp: Date.now() - 100000
          },
          {
               id: 'rev-2',
               query: 'Who founded Samastha?',
               aiAnswer: 'Samastha Kerala Jamiyyathul Ulama was founded in 1926. Key founding figures include Pangil Ahmed Kutty Musliyar and Varakkal Mullakoya Thangal.',
               status: 'Verified',
               reviewedBy: 'Scholar A',
               timestamp: Date.now() - 500000
          }
      ];
  },

  updateReview: (review: ScholarReview) => {
      let reviews = mockDB.getReviews();
      const index = reviews.findIndex(r => r.id === review.id);
      if (index >= 0) {
          reviews[index] = review;
      } else {
          reviews.push(review);
      }
      localStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews));
      mockDB.logAction('Review', 'Scholar', `Review status updated to ${review.status} for ID: ${review.id}`);
  },

  // --- Audit Logs (New) ---
  getLogs: (): AuditLog[] => {
      const data = localStorage.getItem(LOGS_KEY);
      if (data) return JSON.parse(data);
      
      return [
          { id: 'log-1', action: 'Login', user: 'rasheequ.designs@gmail.com', details: 'Successful login', timestamp: Date.now() - 1000, severity: 'Info' }
      ];
  },

  logAction: (action: string, user: string, details: string, severity: 'Info' | 'Warning' | 'Critical' = 'Info') => {
      const logs = mockDB.getLogs();
      const newLog: AuditLog = {
          id: `log-${Date.now()}`,
          action,
          user,
          details,
          timestamp: Date.now(),
          severity
      };
      // Keep last 100 logs
      if (logs.length > 100) logs.pop();
      logs.unshift(newLog);
      localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
  }
};

// Pre-seed some data if empty
if (mockDB.getDocuments().length === 0) {
    const seedId = "seed-1";
    mockDB.addDocument({
        id: seedId,
        title: "Samastha Constitution",
        uploadDate: Date.now(),
        chunkCount: 1,
        size: 1024,
        isProcessed: true,
        category: 'Constitution',
        isTrusted: true
    });
    mockDB.addChunks([{
        id: "chunk-1",
        docId: seedId,
        docTitle: "Samastha Constitution",
        text: "Samastha Kerala Jamiyyathul Ulama is the largest Muslim organization in Kerala, established in 1926. It was formed to propagate the true teachings of Islam and defend against innovations.",
        embedding: new Array(768).fill(0.1) 
    }]);
}