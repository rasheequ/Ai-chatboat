import React, { useState, useEffect, useRef } from 'react';
import { Message, AppSettings } from '../types';
import { getEmbeddings, findBestMatches, generateRAGResponse, transcribeAudio, generateSpeech, connectLiveSession } from '../services/geminiService';
import { mockDB } from '../services/mockFirebase';
import VoiceInput from './VoiceInput';
import { Send, Volume2, Globe, Sparkles, User, MoreHorizontal, ArrowUp, BookOpen, Share2, Copy, Check, Phone, BrainCircuit } from 'lucide-react';
import { useLiquid } from './LiquidBackground';
import Markdown from 'react-markdown';

// Audio Encoding Helpers
function base64ToUint8Array(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, _) => {
      const reader = new FileReader();
      reader.onloadend = () => {
          const base64String = (reader.result as string).split(',')[1];
          resolve(base64String);
      };
      reader.readAsDataURL(blob);
    });
};

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({
      showTextInput: true,
      useLiveMode: false,
      appName: 'Samastha AI',
      appDescription: ''
  });
  const [isPlayingTTS, setIsPlayingTTS] = useState(false);
  const [waitingForNumber, setWaitingForNumber] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const { addRipple, triggerFlash } = useLiquid();
  
  // Live API Refs
  const liveSessionRef = useRef<any>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Load Settings & Poll for changes (Dynamic Update)
  useEffect(() => {
    const loadAndSync = () => {
        const current = mockDB.getSettings();
        
        // Update state only if changed to avoid unnecessary re-renders
        setSettings(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(current)) {
                return current;
            }
            return prev;
        });

        // Initial Welcome Message Logic (only triggers once if empty)
        // We use the 'current' variable here to ensure we have the latest data immediately
        setMessages(prevMsgs => {
            if (prevMsgs.length === 0) {
                 const appName = current.appName || 'Samastha AI';
                 const description = current.appDescription && current.appDescription.trim().length > 0
                    ? current.appDescription
                    : "the AI assistant for **Samastha Kerala Jamiyyathul Ulama**. How can I help you today?";

                 return [{
                    id: 'welcome',
                    role: 'model',
                    content: `**Assalamu Alaikum.**\n\nI am ${appName}, ${description}`,
                    timestamp: Date.now()
                  }];
            }
            return prevMsgs;
        });
    };

    loadAndSync();
    
    // Poll every 1 second to catch changes from Admin Panel in other tabs
    const interval = setInterval(loadAndSync, 1000);
    return () => clearInterval(interval);
  }, []);

  const playTextToSpeech = async (text: string) => {
      if (isPlayingTTS) return;
      setIsPlayingTTS(true);
      addRipple(0, 0, 0.4);
      const audioData = await generateSpeech(text);
      if (audioData) {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const buffer = await audioCtx.decodeAudioData(base64ToUint8Array(audioData).buffer);
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        source.onended = () => {
            setIsPlayingTTS(false);
            audioCtx.close();
        };
        source.start();
      } else {
          setIsPlayingTTS(false);
      }
  };

  const handleCopy = (text: string, id: string) => {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
  };

  const handleShare = async (text: string) => {
      if (navigator.share) {
          try {
              await navigator.share({
                  title: `${settings.appName} Report`,
                  text: text,
              });
          } catch (error) {
              console.log('Error sharing:', error);
          }
      } else {
          // Fallback to copy if Web Share API not supported
          navigator.clipboard.writeText(text);
          alert("Copied to clipboard!");
      }
  };

  const processQuery = async (queryText: string, isVoice: boolean = false) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: queryText,
      timestamp: Date.now(),
      isAudio: isVoice
    };
    
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    addRipple(0, 0, 1.0);

    try {
      const queryEmbedding = await getEmbeddings([queryText]);
      const allChunks = mockDB.getChunks();
      const relevantChunks = queryEmbedding.length > 0 && queryEmbedding[0].length > 0
        ? findBestMatches(queryEmbedding[0], allChunks, 5) 
        : [];

      const response = await generateRAGResponse(queryText, relevantChunks);

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: response.text,
        timestamp: Date.now(),
        language: response.language,
        citations: [...(relevantChunks.map(c => c.docTitle)), ...(response.citations || [])]
      };

      setMessages(prev => [...prev, botMsg]);
      addRipple(0, 0, 0.6); // Ripple on response
      triggerFlash(0.4); // Subtle flash on response

    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: "I apologize, but I encountered an error. Please try again.",
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const text = input;
    setInput('');
    triggerFlash(0.6); // Strong flash on send

    // --- Lead Capture & Report Flow ---
    if (waitingForNumber) {
        // Validation: Strip non-digits and check length
        const digitsOnly = text.replace(/[^0-9]/g, '');
        
        if (digitsOnly.length < 10 || digitsOnly.length > 15) {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'model',
                content: "Please enter a valid phone number (e.g., +91 95265 69313).",
                timestamp: Date.now()
            }]);
            return;
        }

        setWaitingForNumber(false);
        
        // Add user message
        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'user',
            content: text,
            timestamp: Date.now()
        }]);

        // Save Lead to Mock DB
        const lastContext = messages.filter(m => m.role === 'model').slice(-1)[0]?.content || "User asked for details";
        mockDB.addLead({
            id: Date.now().toString(),
            phoneNumber: text,
            queryContext: lastContext.substring(0, 100) + "...",
            timestamp: Date.now()
        });

        setIsLoading(true);

        try {
             // 1. Identify Topic
             const lastUserMsg = messages.slice().reverse().find(m => m.role === 'user' && m.content !== text);
             const topicQuery = lastUserMsg ? lastUserMsg.content : "Samastha Kerala Jamiyyathul Ulama";

             // 2. Perform Deep RAG
             const queryEmbedding = await getEmbeddings([topicQuery]);
             const allChunks = mockDB.getChunks();
             const relevantChunks = queryEmbedding.length > 0 && queryEmbedding[0].length > 0
                ? findBestMatches(queryEmbedding[0], allChunks, 8) 
                : [];
             
             // 3. Generate Detailed Report
             const detailedPrompt = `
                The user has requested a detailed report on: "${topicQuery}".
                Provide a comprehensive explanation using the context provided.
                Structure it clearly with a Title, Introduction, Key Points (bulleted), and Conclusion.
             `;
             
             const response = await generateRAGResponse(detailedPrompt, relevantChunks);

             // 4. Formatting for Share
             let cleanText = response.text.replace(/\*\*/g, ''); // Remove Markdown bold for plain text clipboard
             const footer = `\n\nGenerated by ${settings.appName}`;
             const shareableText = `${cleanText}${footer}`;

             // 5. Deliver Report Immediately
             setMessages(prev => [...prev, {
                id: 'report-'+Date.now(),
                role: 'model',
                content: `✅ **Lead Verified.**\n\nHere is your detailed report on **"${topicQuery}"**:\n\n---\n\n${response.text}`,
                timestamp: Date.now(),
                shareContent: shareableText
            }]);
             triggerFlash(0.8);

        } catch (e) {
            console.error(e);
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', content: "Error generating detailed report.", timestamp: Date.now() }]);
        } finally {
            setIsLoading(false);
        }
        
        return;
    }

    processQuery(text);
  };

  const handleKnowMore = () => {
      setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'model',
          content: "To generate a **Detailed Report** for you, please verify your **Mobile Number**.",
          timestamp: Date.now()
      }]);
      setWaitingForNumber(true);
  };

  const handleAudioCaptured = async (audioBlob: Blob) => {
    setIsLoading(true);
    triggerFlash(0.5);
    try {
      const base64Audio = await blobToBase64(audioBlob);
      const transcription = await transcribeAudio(base64Audio, 'audio/webm');
      if (!transcription) throw new Error("Could not understand audio");
      
      // If waiting for number via voice
      if (waitingForNumber) {
           setInput(transcription);
           setIsLoading(false);
           return;
      }

      processQuery(transcription, true);
    } catch (error) {
      console.error(error);
      setIsLoading(false);
    }
  };

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        // Ignore typing
        const tagName = (e.target as HTMLElement).tagName;
        if (tagName === 'INPUT' || tagName === 'TEXTAREA') return;

        const key = e.key.toLowerCase();

        // "k" for Know More
        if (key === 'k') {
            const lastIndex = messages.length - 1;
            if (lastIndex >= 0) {
                const msg = messages[lastIndex];
                // Check same conditions as the button render
                const isActionable = 
                    msg.role === 'model' && 
                    !isLoading && 
                    !waitingForNumber && 
                    !msg.content.includes("Mobile Number") && 
                    !msg.shareContent;
                
                if (isActionable) {
                    e.preventDefault();
                    handleKnowMore();
                }
            }
        }

        // "t" for Type Text
        if (key === 't') {
            e.preventDefault();
            if (settings.showTextInput && !settings.useLiveMode) {
                textInputRef.current?.focus();
            }
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [messages, isLoading, waitingForNumber, settings]);

  // --- Live API Handlers ---
  const startLiveSession = async () => {
    addRipple(0, 0, 1.5);
    triggerFlash(0.7);
    const InputCtx = window.AudioContext || (window as any).webkitAudioContext;
    const OutputCtx = window.AudioContext || (window as any).webkitAudioContext;
    
    inputAudioContextRef.current = new InputCtx({ sampleRate: 16000 });
    outputAudioContextRef.current = new OutputCtx({ sampleRate: 24000 });
    nextStartTimeRef.current = 0;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = inputAudioContextRef.current.createMediaStreamSource(stream);
    const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
    
    const sessionPromise = connectLiveSession({
        onAudioData: async (base64) => {
            if (!outputAudioContextRef.current) return;
            const ctx = outputAudioContextRef.current;
            const rawBytes = base64ToUint8Array(base64);
            const dataInt16 = new Int16Array(rawBytes.buffer);
            const audioBuffer = ctx.createBuffer(1, dataInt16.length, 24000);
            const channelData = audioBuffer.getChannelData(0);
            for(let i=0; i<dataInt16.length; i++) {
                channelData[i] = dataInt16[i] / 32768.0;
            }

            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
            const src = ctx.createBufferSource();
            src.buffer = audioBuffer;
            src.connect(ctx.destination);
            src.start(nextStartTimeRef.current);
            nextStartTimeRef.current += audioBuffer.duration;
            addRipple(0, 0, 0.3);
            triggerFlash(0.2); // Pulse on speech
        },
        onTextData: (text) => {},
        onClose: () => {}
    });

    liveSessionRef.current = sessionPromise;

    processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const l = inputData.length;
        const int16 = new Int16Array(l);
        for (let i = 0; i < l; i++) {
            int16[i] = inputData[i] * 32768;
        }
        let binary = '';
        const len = int16.byteLength;
        const bytes = new Uint8Array(int16.buffer);
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const b64Data = btoa(binary);

        sessionPromise.then(session => {
            session.sendRealtimeInput({
                media: {
                    mimeType: 'audio/pcm;rate=16000',
                    data: b64Data
                }
            });
        });
    };

    source.connect(processor);
    processor.connect(inputAudioContextRef.current.destination);
  };

  const stopLiveSession = async () => {
      if (liveSessionRef.current) {
          liveSessionRef.current.then((s: any) => s.close());
          liveSessionRef.current = null;
      }
      inputAudioContextRef.current?.close();
      outputAudioContextRef.current?.close();
  };

  const handleLiveToggle = (isActive: boolean) => {
      if (isActive) {
          startLiveSession();
      } else {
          stopLiveSession();
      }
  };

  return (
    <div className="flex flex-col h-full relative font-sans">
      
      {/* Floating Header Capsule */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-4 animate-slide-up duration-700 w-full max-w-2xl pointer-events-none">
        
        {/* The Logo Pill */}
        <div className="pointer-events-auto flex items-center gap-3 px-2 py-2 pr-5 rounded-full bg-black/40 backdrop-blur-2xl border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.15)] group hover:border-emerald-400/50 transition-colors">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center shadow-inner border border-white/10 relative overflow-hidden group-hover:scale-105 transition-transform duration-500">
                 {settings.logoBase64 ? (
                    <img src={settings.logoBase64} alt="Logo" className="w-full h-full object-cover" />
                 ) : (
                    <>
                        <div className="absolute inset-0 bg-emerald-400/20 animate-pulse opacity-50"></div>
                        <span className="font-serif font-bold text-white relative z-10 text-sm">SK</span>
                    </>
                 )}
            </div>
            
            <div className="flex flex-col justify-center">
                <h1 className="text-sm font-semibold text-white tracking-wide leading-tight group-hover:text-emerald-300 transition-colors">{settings.appName}</h1>
                <div className="flex items-center gap-1.5">
                     <span className={`block w-1.5 h-1.5 rounded-full ${settings.useLiveMode ? 'bg-red-500 animate-pulse' : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'}`}></span>
                     <span className="text-[10px] font-medium text-white/60 tracking-wider uppercase">
                        {settings.useLiveMode ? 'Live Mode' : 'Online'}
                     </span>
                </div>
            </div>
        </div>
      </div>

      {/* Chat Area */}
      <div 
        className="flex-1 overflow-y-auto w-full max-w-4xl mx-auto px-4 pt-48 pb-44 no-scrollbar z-10"
        style={{
            maskImage: 'linear-gradient(to bottom, transparent 0px, transparent 20px, black 120px, black 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0px, transparent 20px, black 120px, black 100%)'
        }}
        onClick={(e) => addRipple((e.clientX/window.innerWidth)*2-1, -(e.clientY/window.innerHeight)*2+1, 0.4)}
      >
        
        {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-[50vh] animate-pulse">
                <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6 border border-emerald-500/20 shadow-[0_0_40px_rgba(16,185,129,0.1)] relative">
                    <div className="absolute inset-0 rounded-full border border-emerald-500/30 animate-[spin_4s_linear_infinite]"></div>
                    <div className="absolute inset-2 rounded-full border border-teal-500/20 animate-[spin_3s_linear_infinite_reverse]"></div>
                    <BrainCircuit className="text-emerald-300 relative z-10" size={32} />
                </div>
                <p className="text-emerald-100/60 font-light tracking-[0.2em] text-xs uppercase animate-pulse">System Ready</p>
            </div>
        )}

        <div className="space-y-8">
            {messages.map((msg, index) => (
            <div
                key={msg.id}
                className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
                {/* --- BOT MESSAGE --- */}
                {msg.role === 'model' && (
                    <div className="flex flex-col items-start max-w-[85%] lg:max-w-[75%] animate-slide-up" style={{ animationDelay: `${index * 0.1}s` }}>
                        <div className="vision-glass rounded-[28px] rounded-tl-sm px-8 py-6 relative text-slate-100 border-l-4 border-l-emerald-500/50">
                             {/* AI Icon Floating */}
                             <div className="absolute -left-3 -top-3 w-8 h-8 rounded-full bg-black/60 border border-emerald-500/30 flex items-center justify-center shadow-lg">
                                <Sparkles size={14} className="text-emerald-400" />
                             </div>

                             {/* Markdown Content */}
                             <div className={`markdown-content text-[15px] leading-relaxed font-light tracking-wide ${msg.language === 'Arabic' ? 'font-serif text-right text-lg' : ''}`}>
                                <Markdown>{msg.content}</Markdown>
                             </div>

                             {/* Share / Copy Actions for Report */}
                             {msg.shareContent && (
                                <div className="mt-6 flex gap-2 animate-fade-in-up">
                                    <button 
                                        onClick={() => handleShare(msg.shareContent!)}
                                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-100 rounded-xl transition-all shadow-lg border border-emerald-500/20 font-medium group"
                                    >
                                        <Share2 size={16} className="group-hover:scale-110 transition-transform" />
                                        <span>Share Report</span>
                                    </button>
                                    <button 
                                        onClick={() => handleCopy(msg.shareContent!, msg.id)}
                                        className="w-12 flex items-center justify-center bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all border border-white/10"
                                        title="Copy Text"
                                    >
                                        {copiedId === msg.id ? <Check size={18} className="text-emerald-400"/> : <Copy size={18} className="opacity-70"/>}
                                    </button>
                                </div>
                             )}

                             {/* Citations */}
                             {msg.citations && msg.citations.length > 0 && (
                                <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap gap-2">
                                    {msg.citations.map((cite, idx) => (
                                        <span key={idx} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-500/20 text-[11px] text-emerald-200/80 transition-colors cursor-default backdrop-blur-md">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                                            <span className="truncate max-w-[150px]">{cite}</span>
                                        </span>
                                    ))}
                                </div>
                             )}

                             {/* Bot Metadata (Timestamp + TTS) */}
                             <div className="absolute bottom-2 right-4 flex items-center gap-3">
                                <span className="text-[10px] text-emerald-100/30 font-mono">
                                    {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                             </div>
                             
                             {/* Floating TTS Action */}
                             <button 
                                onClick={() => playTextToSpeech(msg.content)} 
                                className="absolute -bottom-10 left-2 p-2 rounded-full text-white/30 hover:text-emerald-400 transition-all opacity-0 group-hover:opacity-100"
                                title="Read Aloud"
                             >
                                <Volume2 size={18} />
                             </button>
                        </div>
                        
                        {/* "Know More" Button - Only for the LAST message */}
                        {index === messages.length - 1 && !isLoading && !waitingForNumber && !msg.content.includes("Mobile Number") && !msg.shareContent && (
                            <button 
                                onClick={handleKnowMore}
                                title="Press 'k' for Know More"
                                className="mt-4 ml-4 flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 backdrop-blur-md transition-all text-xs font-semibold text-emerald-300 animate-pop-in group shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                            >
                                <BookOpen size={14} className="text-emerald-300 group-hover:scale-110 transition-transform" />
                                Know More
                                <span className="ml-1 opacity-50 font-mono text-[10px] border border-emerald-500/30 rounded px-1.5 hidden sm:inline-block">K</span>
                            </button>
                        )}
                    </div>
                )}

                {/* --- USER MESSAGE --- */}
                {msg.role === 'user' && (
                    <div className="flex flex-col items-end max-w-[80%] lg:max-w-[60%] animate-pop-in">
                        <div className="relative bg-gradient-to-br from-emerald-600 to-teal-700 shadow-[0_4px_20px_rgba(4,120,87,0.4)] rounded-[26px] rounded-br-sm px-6 py-4 text-white border border-emerald-400/20">
                            <p className="text-[15px] font-medium leading-relaxed tracking-wide">
                                {msg.content}
                            </p>
                            <div className="flex items-center justify-end gap-1.5 mt-1.5">
                                <span className="text-[10px] text-emerald-100/60 font-medium">
                                    {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            ))}

            {/* Holographic Thinking Indicator */}
            {isLoading && (
                <div className="flex justify-start animate-slide-up w-full pl-2">
                     <div className="flex items-center gap-3 px-5 py-3 rounded-full bg-black/20 border border-emerald-500/20 backdrop-blur-md shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                        <div className="relative w-4 h-4 flex items-center justify-center">
                            <div className="absolute inset-0 border border-emerald-400 rounded-full animate-ping opacity-75"></div>
                            <div className="w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_10px_rgba(52,211,153,1)]"></div>
                        </div>
                        <span className="text-xs text-emerald-300 font-mono tracking-widest animate-pulse">PROCESSING</span>
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Floating Input Capsule */}
      <div className="fixed bottom-8 left-0 right-0 z-50 px-4 flex justify-center animate-slide-up duration-1000">
        <div className="w-full max-w-[500px] relative group">
            
            {/* Morphing Container */}
            <div className={`
                relative w-full bg-black/40 backdrop-blur-3xl border border-white/10 
                shadow-[0_8px_40px_rgba(0,0,0,0.6)] transition-all duration-500 ease-out
                flex items-center p-2 gap-2
                group-hover:border-emerald-500/30 group-hover:shadow-[0_8px_50px_rgba(16,185,129,0.15)]
                ${settings.useLiveMode ? 'rounded-[3rem] border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.2)]' : 'rounded-[3rem]'}
            `}>
                
                {/* Voice Button Area */}
                <div className="relative z-20">
                    <VoiceInput 
                        onAudioCaptured={handleAudioCaptured} 
                        onLiveToggle={handleLiveToggle}
                        isLiveMode={settings.useLiveMode}
                        disabled={isLoading} 
                        isProcessing={isLoading}
                        size="md" // Smaller compact size
                    />
                </div>

                {/* Text Input Area */}
                <div className={`flex-1 transition-all duration-300 ${settings.useLiveMode ? 'opacity-30 pointer-events-none grayscale' : 'opacity-100'}`}>
                    <input
                        ref={textInputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if(e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder={
                            settings.useLiveMode ? "Live conversation active..." : 
                            waitingForNumber ? "Enter your Mobile Number..." : 
                            `Ask ${settings.appName}...`
                        }
                        disabled={isLoading || settings.useLiveMode || !settings.showTextInput}
                        className={`w-full bg-transparent border-none outline-none text-white placeholder-white/30 text-[15px] font-medium px-2 ${!settings.showTextInput && 'hidden'}`}
                        title="Press 't' to focus"
                    />
                    {!settings.showTextInput && !settings.useLiveMode && (
                        <p className="text-white/40 text-sm px-2 italic">Type input disabled</p>
                    )}
                </div>

                {/* Send Button */}
                <div className={`transition-all duration-300 ${!input.trim() || settings.useLiveMode ? 'scale-75 opacity-0 w-0 overflow-hidden' : 'scale-100 opacity-100 w-10'}`}>
                    <button
                        onClick={handleSend}
                        className="w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-transform active:scale-95"
                    >
                        <ArrowUp size={20} strokeWidth={2.5} />
                    </button>
                </div>

                {/* Fallback space for Send button animation */}
                {(!input.trim() || settings.useLiveMode) && <div className="w-2" />}

            </div>
        </div>
      </div>

    </div>
  );
};

export default ChatInterface;