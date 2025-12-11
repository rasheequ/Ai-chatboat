
import { UploadedDocument, DocumentChunk, AppSettings, Lead } from '../types';

// Using localStorage to persist data across reloads for the user
const DOCS_KEY = 'samastha_docs';
const CHUNKS_KEY = 'samastha_chunks';
const SETTINGS_KEY = 'samastha_settings';
const LEADS_KEY = 'samastha_leads';

const DEFAULT_SYSTEM_INSTRUCTION = `You are an AI assistant for the public information portal of SAMASTHA KERALA JAMIYYATHUL ULAMA.

Your rules:
1. You must answer ONLY questions about Samastha Kerala Jamiyyathul Ulama, its history, leaders, rulings, and institutions.
2. You must use ONLY the text provided in the context (RAG) or Search Grounding.
3. If the user asks unrelated questions, politely refuse.
4. NEVER hallucinate.
5. ALWAYS reply in the same language the user used.
6. Keep answers concise unless asked for details.`;

export const mockDB = {
  getDocuments: (): UploadedDocument[] => {
    const data = localStorage.getItem(DOCS_KEY);
    return data ? JSON.parse(data) : [];
  },

  addDocument: (doc: UploadedDocument) => {
    const docs = mockDB.getDocuments();
    docs.push(doc);
    localStorage.setItem(DOCS_KEY, JSON.stringify(docs));
  },

  deleteDocument: (id: string) => {
    let docs = mockDB.getDocuments();
    docs = docs.filter(d => d.id !== id);
    localStorage.setItem(DOCS_KEY, JSON.stringify(docs));

    // Also delete associated chunks
    let chunks = mockDB.getChunks();
    chunks = chunks.filter(c => c.docId !== id);
    localStorage.setItem(CHUNKS_KEY, JSON.stringify(chunks));
  },

  getChunks: (): DocumentChunk[] => {
    const data = localStorage.getItem(CHUNKS_KEY);
    return data ? JSON.parse(data) : [];
  },

  addChunks: (newChunks: DocumentChunk[]) => {
    const chunks = mockDB.getChunks();
    chunks.push(...newChunks);
    localStorage.setItem(CHUNKS_KEY, JSON.stringify(chunks));
  },

  getSettings: (): AppSettings => {
    const data = localStorage.getItem(SETTINGS_KEY);
    const defaults = { 
        showTextInput: true, 
        useLiveMode: false,
        appName: 'Samastha AI',
        appDescription: 'A multilingual AI assistant for Samastha Kerala Jamiyyathul Ulama.',
        systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
        adminPassword: 'rasheequ.designs'
    };
    
    if (data) {
        // Merge defaults with saved data to ensure new fields exist
        return { ...defaults, ...JSON.parse(data) };
    }
    return defaults;
  },

  saveSettings: (settings: AppSettings) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  },

  getLeads: (): Lead[] => {
    const data = localStorage.getItem(LEADS_KEY);
    return data ? JSON.parse(data) : [];
  },

  addLead: (lead: Lead) => {
    const leads = mockDB.getLeads();
    leads.push(lead);
    localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
  }
};

// Pre-seed some data if empty to make the demo work immediately
if (mockDB.getDocuments().length === 0) {
    const seedId = "seed-1";
    mockDB.addDocument({
        id: seedId,
        title: "Samastha History Overview",
        uploadDate: Date.now(),
        chunkCount: 1,
        size: 1024,
        isProcessed: true
    });
    mockDB.addChunks([{
        id: "chunk-1",
        docId: seedId,
        docTitle: "Samastha History Overview",
        text: "Samastha Kerala Jamiyyathul Ulama is the largest Muslim organization in Kerala, established in 1926. It was formed to propagate the true teachings of Islam and defend against innovations. The organization focuses on religious education, running thousands of madrasas across the state.",
        // Mock embedding - in reality this would be generated
        embedding: new Array(768).fill(0.1) 
    }]);
}
