import React, { useState, useEffect } from 'react';
import { View } from './types';
import ChatInterface from './components/ChatInterface';
import AdminPanel from './components/AdminPanel';
import Login from './components/Login';
import { LiquidBackground } from './components/LiquidBackground';
import { Settings } from 'lucide-react';
import { mockDB } from './services/mockFirebase';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.CHAT);

  // Sync Global Settings (Title, Icon)
  useEffect(() => {
    const syncSettings = () => {
        const settings = mockDB.getSettings();
        if (settings.appName) {
            document.title = settings.appName;
        }
        if (settings.logoBase64) {
            // Update Favicon
            let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
            if (!link) {
                link = document.createElement('link');
                link.rel = 'icon';
                document.head.appendChild(link);
            }
            link.href = settings.logoBase64;
        }
    };
    
    syncSettings();
    
    // Simple polling to keep basic metadata in sync if changed in another tab or view
    const interval = setInterval(syncSettings, 2000);
    return () => clearInterval(interval);
  }, []);

  const renderView = () => {
    switch (currentView) {
      case View.CHAT:
        return <ChatInterface />;
      case View.ADMIN_LOGIN:
        return <Login onLoginSuccess={() => setCurrentView(View.ADMIN_DASHBOARD)} onBack={() => setCurrentView(View.CHAT)} />;
      case View.ADMIN_DASHBOARD:
        return <AdminPanel onLogout={() => setCurrentView(View.CHAT)} />;
      default:
        return <ChatInterface />;
    }
  };

  return (
    <LiquidBackground>
      <div className="h-screen w-full relative overflow-hidden">
        {/* Main Content Layer */}
        <div className="relative z-10 h-full w-full">
          {renderView()}
        </div>

        {/* Admin Toggle - Floating Glass Button */}
        {currentView === View.CHAT && (
          <button 
            onClick={() => setCurrentView(View.ADMIN_LOGIN)}
            className="fixed bottom-6 right-6 z-50 glass rounded-full p-3 shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 group bg-white/10"
            title="Settings"
          >
            <Settings size={20} className="text-white/70 group-hover:text-emerald-400 transition-colors" />
          </button>
        )}
      </div>
    </LiquidBackground>
  );
};

export default App;