import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square } from 'lucide-react';
import { useLiquid } from './LiquidBackground';

interface VoiceInputProps {
  onAudioCaptured: (audioBlob: Blob) => void;
  onLiveToggle: (active: boolean) => void;
  isLiveMode: boolean;
  disabled: boolean;
  isProcessing?: boolean;
  size?: 'sm' | 'md' | 'lg'; // Added size prop
}

const VoiceInput: React.FC<VoiceInputProps> = ({ onAudioCaptured, onLiveToggle, isLiveMode, disabled, isProcessing, size = 'lg' }) => {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const { setAudioAmp, addRipple } = useLiquid();
  
  // Audio Analysis
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>(0);

  // Clean up audio context
  useEffect(() => {
    return () => {
      if (audioContextRef.current) audioContextRef.current.close();
      cancelAnimationFrame(animationFrameRef.current);
      setAudioAmp(0);
    };
  }, []);

  const analyzeAudio = (stream: MediaStream) => {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = ctx;
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    analyserRef.current = analyser;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const update = () => {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const avg = sum / bufferLength;
      const normalized = Math.min(1.0, avg / 128.0); // 0.0 to 1.0 approx
      setAudioAmp(normalized);
      
      if (normalized > 0.6 && Math.random() > 0.8) {
          addRipple(0, 0, normalized * 0.5);
      }

      animationFrameRef.current = requestAnimationFrame(update);
    };
    update();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      analyzeAudio(stream);

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Use the actual mimeType from the recorder if available, otherwise fallback
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        onAudioCaptured(blob);
        stream.getTracks().forEach(track => track.stop());
        cancelAnimationFrame(animationFrameRef.current);
        setAudioAmp(0);
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      addRipple(0, 0, 1.5);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleClick = () => {
    if (isLiveMode) {
        const newState = !isRecording;
        setIsRecording(newState);
        onLiveToggle(newState);
        if (newState) addRipple(0, 0, 2.0);
    } else {
        if (isRecording) stopRecording();
        else startRecording();
    }
  };

  useEffect(() => {
    if (!isLiveMode && disabled && isRecording) {
        setIsRecording(false);
    }
  }, [disabled, isLiveMode]);

  // Keyboard Shortcut: "m" for Mic
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        // Do not trigger if user is typing in an input
        const tagName = (e.target as HTMLElement).tagName;
        if (tagName === 'INPUT' || tagName === 'TEXTAREA') return;

        if (e.key.toLowerCase() === 'm') {
            e.preventDefault();
            // Prevent starting if disabled, unless we are recording (to stop it)
            if (disabled && !isRecording) return;
            handleClick();
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecording, isLiveMode, disabled, handleClick]); // Re-bind when state changes to ensure correct closure

  // Determine Dimensions based on Size prop
  const btnSize = size === 'sm' ? 'w-10 h-10' : size === 'md' ? 'w-12 h-12' : 'w-20 h-20';
  const iconSize = size === 'sm' ? 18 : size === 'md' ? 22 : 32;

  return (
    <div className="relative flex items-center justify-center">
        {/* Active Glow/Ripple Layer */}
        {isRecording && (
           <div className="absolute inset-0 pointer-events-none">
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full rounded-full animate-ping opacity-30 ${isLiveMode ? 'bg-red-500' : 'bg-cyan-400'}`}></div>
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] rounded-full animate-ping opacity-10 animation-delay-300 ${isLiveMode ? 'bg-red-500' : 'bg-cyan-400'}`} style={{animationDelay: '0.3s'}}></div>
           </div>
        )}

        {/* Floating Siri Waveform (Positioned above button) */}
        {isRecording && (
            <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 w-32 h-10 flex items-center justify-center space-x-1 pointer-events-none">
                <div className={`w-1 rounded-full animate-wave ${isLiveMode ? 'bg-red-400' : 'bg-cyan-300'}`} style={{ animationDuration: '0.5s', height: '40%' }}></div>
                <div className={`w-1 rounded-full animate-wave ${isLiveMode ? 'bg-orange-400' : 'bg-emerald-300'}`} style={{ animationDuration: '0.7s', height: '70%' }}></div>
                <div className={`w-1 rounded-full animate-wave ${isLiveMode ? 'bg-red-500' : 'bg-white'}`} style={{ animationDuration: '0.4s', height: '100%' }}></div>
                <div className={`w-1 rounded-full animate-wave ${isLiveMode ? 'bg-orange-400' : 'bg-emerald-300'}`} style={{ animationDuration: '0.6s', height: '70%' }}></div>
                <div className={`w-1 rounded-full animate-wave ${isLiveMode ? 'bg-red-400' : 'bg-cyan-300'}`} style={{ animationDuration: '0.8s', height: '40%' }}></div>
            </div>
        )}
        
        {/* Morphing Liquid Orb Button */}
        <button
            onClick={handleClick}
            disabled={disabled && !isRecording}
            title="Press 'm' to toggle mic"
            className={`
                ${btnSize}
                relative z-10 flex items-center justify-center transition-all duration-500
                backdrop-blur-md shadow-lg border border-white/30
                ${isRecording 
                    ? (isLiveMode ? 'bg-gradient-to-tr from-red-500 to-orange-500 animate-liquid-morph scale-110' : 'bg-gradient-to-tr from-cyan-500 to-blue-600 animate-liquid-morph scale-110')
                    : 'bg-white/10 hover:bg-white/20 hover:scale-105 rounded-full'
                }
                ${(disabled && !isRecording) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                ${isRecording ? 'rounded-[30%_70%_70%_30%_/_30%_30%_70%_70%]' : ''} 
            `}
        >
            {isProcessing ? (
                <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
            ) : isRecording ? (
                <Square size={iconSize * 0.6} className="text-white fill-current" />
            ) : (
                <Mic size={iconSize} className={`${isLiveMode ? 'text-red-400' : 'text-white'}`} />
            )}
        </button>
    </div>
  );
};

export default VoiceInput;