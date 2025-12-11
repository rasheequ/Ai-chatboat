
import { GoogleGenAI, FunctionDeclaration, Type, Modality } from "@google/genai";
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

export const transcribeAudio = async (audioBase64: string, mimeType: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
            role: 'user',
            parts: [
                { inlineData: { mimeType, data: audioBase64 } },
                { text: "Transcribe this audio exactly as spoken. Do not translate. Output only the transcription." }
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

export const generateSpeech = async (text: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (error) {
    console.error("TTS error:", error);
    return null;
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

// --- Live API Implementation ---

const searchTool: FunctionDeclaration = {
    name: "search_knowledge_base",
    description: "Search the knowledge base for relevant information.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            query: {
                type: Type.STRING,
                description: "The search query."
            }
        },
        required: ["query"]
    }
};

export const connectLiveSession = async (
    callbacks: {
        onAudioData: (base64: string) => void,
        onTextData: (text: string) => void,
        onClose: () => void
    }
) => {
    
    const settings = mockDB.getSettings();
    const liveSystemInstruction = settings.systemInstruction || "You are a helpful assistant.";

    const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: `${liveSystemInstruction} You MUST use the 'search_knowledge_base' tool to answer questions before answering from general knowledge if the question is specific.`,
            tools: [{ functionDeclarations: [searchTool] }],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
            },
        },
        callbacks: {
            onopen: () => {
                console.log("Live Session Connected");
            },
            onmessage: async (message) => {
                // Handle Audio Output
                const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                if (audioData) {
                    callbacks.onAudioData(audioData);
                }

                // Handle Tool Calls
                if (message.toolCall) {
                    for (const fc of message.toolCall.functionCalls) {
                        if (fc.name === 'search_knowledge_base') {
                            const query = (fc.args as any).query;
                            console.log("Tool Call: Searching for", query);
                            
                            // Execute RAG Search
                            try {
                                const embeddings = await getEmbeddings([query]);
                                const chunks = mockDB.getChunks();
                                const matches = findBestMatches(embeddings[0], chunks, 3);
                                const resultText = matches.map(m => m.text).join('\n\n') || "No relevant documents found.";

                                // Send Response back to model
                                sessionPromise.then(session => {
                                    session.sendToolResponse({
                                        functionResponses: {
                                            id: fc.id,
                                            name: fc.name,
                                            response: { result: resultText }
                                        }
                                    });
                                });
                            } catch (e) {
                                console.error("Tool execution failed", e);
                            }
                        }
                    }
                }
            },
            onclose: () => {
                console.log("Live Session Closed");
                callbacks.onClose();
            },
            onerror: (e) => {
                console.error("Live Session Error", e);
                callbacks.onClose();
            }
        }
    });

    return sessionPromise;
};
