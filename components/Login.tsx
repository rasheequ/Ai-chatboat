
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Lock } from 'lucide-react';
import { useLiquid } from './LiquidBackground';
import { mockDB } from '../services/mockFirebase';
import { AppSettings } from '../types';

interface LoginProps {
  onLoginSuccess: () => void;
  onBack: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess, onBack }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [settings, setSettings] = useState<AppSettings>({ appName: '', appDescription: '', showTextInput: true });
  const { addRipple } = useLiquid();

  useEffect(() => {
    // Initial load
    setSettings(mockDB.getSettings());

    // Poll for dynamic updates from Admin Panel
    const interval = setInterval(() => {
        const current = mockDB.getSettings();
        setSettings(prev => {
             if (JSON.stringify(prev) !== JSON.stringify(current)) {
                 return current;
             }
             return prev;
        });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    addRipple(0, 0, 1.0);
    
    // Dynamic password check
    const validPassword = settings.adminPassword || 'rasheequ.designs';
    
    if (email === 'rasheequ.designs@gmail.com' && password === validPassword) {
      onLoginSuccess();
    } else {
      setError('Invalid credentials');
    }
  };

  return (
    <div className="h-full flex items-center justify-center p-4" onClick={(e) => addRipple((e.clientX/window.innerWidth)*2-1, -(e.clientY/window.innerHeight)*2+1, 0.4)}>
      <div className="w-full max-w-md glass-card rounded-3xl p-10 border border-white/20 shadow-2xl relative overflow-hidden bg-white/10 backdrop-blur-xl">
        
        <button 
            onClick={onBack}
            className="absolute top-6 left-6 text-white/50 hover:text-white transition-colors"
        >
            <ArrowLeft size={20}/>
        </button>

        <div className="text-center mb-10 mt-4">
            <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-samastha-green rounded-[2rem] mx-auto flex items-center justify-center text-white text-3xl font-serif shadow-xl shadow-emerald-500/30 mb-6 animate-liquid-morph border border-white/20 overflow-hidden">
                {settings.logoBase64 ? (
                    <img src={settings.logoBase64} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                    "SK"
                )}
            </div>
            <h2 className="text-2xl font-bold text-white">Admin Portal</h2>
            <p className="text-emerald-100 font-medium text-lg mt-2">{settings.appName || 'Samastha AI'}</p>
            {settings.appDescription && (
                <p className="text-emerald-100/50 text-xs mt-2 px-4 leading-relaxed line-clamp-3 whitespace-pre-wrap">
                    {settings.appDescription}
                </p>
            )}
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1">
                <label className="text-xs font-semibold text-emerald-200/70 ml-3 uppercase tracking-wider">Email</label>
                <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-4 rounded-2xl bg-black/20 border border-white/10 focus:bg-black/30 focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder-white/20 text-white"
                    placeholder="admin@example.com"
                    required
                />
            </div>
            <div className="space-y-1">
                <label className="text-xs font-semibold text-emerald-200/70 ml-3 uppercase tracking-wider">Password</label>
                <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-4 rounded-2xl bg-black/20 border border-white/10 focus:bg-black/30 focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder-white/20 text-white"
                    placeholder="••••••••"
                    required
                />
            </div>
            
            {error && (
                <div className="bg-red-500/20 text-red-200 text-sm py-2 px-4 rounded-xl text-center border border-red-500/30 animate-pop-in">
                    {error}
                </div>
            )}

            <button 
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-4 rounded-2xl shadow-lg hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 border border-white/10"
            >
                <Lock size={18} /> Secure Login
            </button>
        </form>
      </div>
    </div>
  );
};

export default Login;