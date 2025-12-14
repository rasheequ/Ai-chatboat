
import { GoogleGenAI } from "@google/genai";
import { DocumentChunk } from '../types';
import { mockDB } from './mockFirebase';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getEmbeddings = async (texts: string[]): Promise<number[][]> => {
  const embeddings: number[][] = [];
  const model = "text-embedding-004";

  for (const text of texts) {
    if (!text || !text.trim()) {
        embeddings.push([]);
        continue;
    }
    try {
      // Use 'contents' (plural) to match the SDK signature correctly
      const result = await ai.models.embedContent({
        model,
        contents: [{ parts: [{ text }] }]
      });
      if (result.embedding?.values) {
        embeddings.push(result.embedding.values);
      } else {
        embeddings.push([]); 
      }
    } catch (e) {
      console.error("Embedding error for text chunk:", text.substring(0, 20) + "...", e);
      embeddings.push([]);
    }
  }
  return embeddings;
};

const cosineSimilarity = (vecA: number[], vecB: number[]) => {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magnitudeA * magnitudeB);
};

export const findBestMatches = (queryEmbedding: number[], chunks: DocumentChunk[], topK: number = 3): DocumentChunk[] => {
  const scored = chunks.map(chunk => ({
    chunk,
    score: chunk.embedding ? cosineSimilarity(queryEmbedding, chunk.embedding) : -1
  }));
  
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map(s => s.chunk);
};

// STT: Transcribe Audio using Gemini Multimodal
export const transcribeAudio = async (audioBase64: string, mimeType: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', // Using Flash for low latency STT
      contents: [
        {
            role: 'user',
            parts: [
                { inlineData: { mimeType, data: audioBase64 } },
                { text: "Transcribe this audio exactly as spoken. Do not translate. Output only the transcription text, nothing else." }
            ]
        }
      ]
    });
    return response.text?.trim() || "";
  } catch (error) {
    console.error("Transcription error:", error);
    throw new Error("Failed to transcribe audio.");
  }
};

export const generateRAGResponse = async (query: string, contextChunks: DocumentChunk[]): Promise<{ text: string, language: string, citations?: string[] }> => {
  
  const contextText = contextChunks.map(c => `[Source: ${c.docTitle}]: ${c.text}`).join('\n\n');
  const settings = mockDB.getSettings();
  
  // Use custom system instruction if available
  const baseInstruction = settings.systemInstruction || "You are an AI assistant.";
  const systemInstruction = `${baseInstruction}\n\nYour name is ${settings.appName || 'Samastha AI'}.`;

  const prompt = `
Context Information:
${contextText}

User Query:
${query}
  `;

  try {
    // Use Flash for 2-3 second latency requirement
    const model = 'gemini-2.5-flash'; 
    
    const response = await ai.models.generateContent({
      model: model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: systemInstruction,
        // Removed thinkingConfig to minimize latency for short answers
        tools: [
            { googleSearch: {} } // Search Grounding
        ]
      }
    });

    let text = response.text || "No response generated.";
    
    // Extract grounding chunks if available
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const webCitations: string[] = [];
    if (groundingChunks) {
        groundingChunks.forEach((c: any) => {
            if (c.web?.uri) webCitations.push(c.web.title || c.web.uri);
        });
    }

    return { 
      text: text,
      language: "Detected",
      citations: webCitations.length > 0 ? webCitations : undefined
    };
  } catch (error) {
    console.error("Generation error:", error);
    return { text: "Error generating response. Please try again.", language: "Error" };
  }
};