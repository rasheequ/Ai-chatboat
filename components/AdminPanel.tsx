
import React, { useState, useEffect, useRef } from 'react';
import { UploadedDocument, AppSettings, Lead, DocumentChunk, ScholarReview, AuditLog, UserRole } from '../types';
import { mockDB } from '../services/mockFirebase';
import { extractTextFromPdf, chunkText } from '../services/pdfService';
import { getEmbeddings } from '../services/geminiService';
import { 
    Upload, Trash2, Database, LogOut, Settings, ToggleLeft, ToggleRight, 
    Activity, Save, Edit3, MessageCircle, Users, 
    Shield, CheckCircle, X, 
    Clock, LayoutDashboard, Book, GraduationCap, Gavel, FileClock, Menu, RefreshCw, BarChart3, AlertOctagon, Mic
} from 'lucide-react';
import { useLiquid } from './LiquidBackground';

interface AdminPanelProps {
  onLogout: () => void;
}

type AdminView = 'DASHBOARD' | 'KNOWLEDGE' | 'REVIEWS' | 'ANALYTICS' | 'MODERATION' | 'SETTINGS' | 'LOGS';

const AdminPanel: React.FC<AdminPanelProps> = ({ onLogout }) => {
  const [activeView, setActiveView] = useState<AdminView>('DASHBOARD');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Data States
  const [docs, setDocs] = useState<UploadedDocument[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [reviews, setReviews] = useState<ScholarReview[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<AppSettings>(mockDB.getSettings());
  
  // UI States
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  
  // Modals
  const [inspectDoc, setInspectDoc] = useState<string | null>(null);
  const [inspectChunks, setInspectChunks] = useState<DocumentChunk[]>([]);

  const { addRipple } = useLiquid();

  useEffect(() => {
    refreshData();
    // Simulate real-time monitoring
    const interval = setInterval(refreshData, 5000);
    return () => clearInterval(interval);
  }, []);

  const refreshData = () => {
      setDocs(mockDB.getDocuments());
      setLeads(mockDB.getLeads().sort((a,b) => b.timestamp - a.timestamp));
      setReviews(mockDB.getReviews().sort((a,b) => b.timestamp - a.timestamp));
      setLogs(mockDB.getLogs());
      setSettings(mockDB.getSettings());
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert("Please upload a valid PDF file.");
      return;
    }

    setIsUploading(true);
    setUploadStatus('Processing PDF...');
    
    try {
      const { text, pageCount } = await extractTextFromPdf(file);
      setUploadStatus(`Chunking ${pageCount} pages...`);
      const textChunks = chunkText(text);
      setUploadStatus(`Generating Embeddings...`);
      const embeddings = await getEmbeddings(textChunks);
      
      const docId = `doc-${Date.now()}`;
      const newDoc: UploadedDocument = {
        id: docId,
        title: file.name,
        uploadDate: Date.now(),
        chunkCount: textChunks.length,
        size: file.size,
        isProcessed: true,
        category: 'General', // Default
        isTrusted: false
      };
      
      const chunksWithEmbeddings = textChunks.map((t, i) => ({
        id: `${docId}-chunk-${i}`,
        docId: docId,
        docTitle: file.name,
        text: t,
        embedding: embeddings[i] || []
      }));

      mockDB.addDocument(newDoc);
      mockDB.addChunks(chunksWithEmbeddings);
      setUploadStatus('Done');
      setTimeout(() => { setIsUploading(false); setUploadStatus(''); }, 1000);
      refreshData();
    } catch (err) {
      console.error(err);
      setUploadStatus('Error');
      setIsUploading(false);
    }
  };

  const handleReviewAction = (review: ScholarReview, action: 'Verified' | 'Rejected') => {
      const updated = { ...review, status: action, reviewedBy: 'Current Admin' }; // In real app, use logged in user
      mockDB.updateReview(updated);
      refreshData();
      addRipple(0, 0, 0.5);
  };

  const saveConfig = (newSettings: AppSettings) => {
      mockDB.saveSettings(newSettings);
      setSettings(newSettings);
      addRipple(0, 0, 0.5);
  };

  // --- Sub-Components (Inline for single file preference) ---

  const SidebarItem = ({ view, icon: Icon, label, alertCount }: { view: AdminView, icon: any, label: string, alertCount?: number }) => (
      <button 
        onClick={() => setActiveView(view)}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeView === view ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
      >
          <Icon size={18} />
          {isSidebarOpen && <span className="text-sm font-medium">{label}</span>}
          {alertCount && alertCount > 0 && isSidebarOpen && (
              <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{alertCount}</span>
          )}
      </button>
  );

  const StatCard = ({ title, value, icon: Icon, color }: any) => (
      <div className="glass-card p-6 rounded-2xl border-white/5 bg-white/5 flex items-center justify-between">
          <div>
              <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-1">{title}</p>
              <h3 className="text-2xl font-bold text-white">{value}</h3>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-${color}-500/20 text-${color}-400`}>
              <Icon size={20} />
          </div>
      </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#00080f]">
        {/* Sidebar */}
        <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-black/40 backdrop-blur-xl border-r border-white/10 flex flex-col transition-all duration-300 z-20`}>
            <div className="p-6 flex items-center gap-3 border-b border-white/5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center shrink-0">
                    <span className="font-serif font-bold text-white text-xs">SK</span>
                </div>
                {isSidebarOpen && (
                    <div>
                        <h1 className="text-sm font-bold text-white leading-tight">Admin Console</h1>
                        <p className="text-[10px] text-white/40">Enterprise Edition</p>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                <p className={`px-4 text-[10px] font-bold text-white/20 uppercase mb-2 ${!isSidebarOpen && 'text-center'}`}>{isSidebarOpen ? 'Main Menu' : 'Menu'}</p>
                <SidebarItem view="DASHBOARD" icon={LayoutDashboard} label="Dashboard" />
                <SidebarItem view="KNOWLEDGE" icon={Database} label="Knowledge Base" />
                <SidebarItem view="REVIEWS" icon={GraduationCap} label="Scholar Review" alertCount={reviews.filter(r=>r.status === 'Pending').length} />
                <SidebarItem view="ANALYTICS" icon={BarChart3} label="Analytics" />
                
                <p className={`px-4 text-[10px] font-bold text-white/20 uppercase mb-2 mt-6 ${!isSidebarOpen && 'text-center'}`}>{isSidebarOpen ? 'System' : 'Sys'}</p>
                <SidebarItem view="MODERATION" icon={Gavel} label="Moderation" />
                <SidebarItem view="LOGS" icon={FileClock} label="Audit Logs" />
                <SidebarItem view="SETTINGS" icon={Settings} label="Settings" />
            </div>

            <div className="p-4 border-t border-white/5">
                <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 text-red-400/80 hover:text-red-400 hover:bg-red-500/10 p-3 rounded-xl transition-colors">
                    <LogOut size={18} />
                    {isSidebarOpen && <span className="text-sm font-medium">Sign Out</span>}
                </button>
            </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto relative no-scrollbar" onClick={(e) => addRipple((e.clientX/window.innerWidth)*2-1, -(e.clientY/window.innerHeight)*2+1, 0.2)}>
             {/* Header */}
            <header className="sticky top-0 z-10 bg-[#00080f]/80 backdrop-blur-md border-b border-white/5 px-8 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-white/50 hover:text-white transition-colors">
                        <Menu size={20} />
                    </button>
                    <h2 className="text-lg font-semibold text-white">
                        {activeView === 'DASHBOARD' && 'System Overview'}
                        {activeView === 'KNOWLEDGE' && 'Knowledge Management'}
                        {activeView === 'REVIEWS' && 'Scholar Verification Queue'}
                        {activeView === 'ANALYTICS' && 'Performance Analytics'}
                        {activeView === 'MODERATION' && 'Safety & Moderation'}
                        {activeView === 'SETTINGS' && 'System Configuration'}
                        {activeView === 'LOGS' && 'Security Audit Logs'}
                    </h2>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span className="text-xs font-medium text-emerald-400">System Operational</span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/80 border border-white/10">
                        <Shield size={14} />
                    </div>
                </div>
            </header>

            <div className="p-8 max-w-7xl mx-auto space-y-8">
                
                {/* --- DASHBOARD VIEW --- */}
                {activeView === 'DASHBOARD' && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatCard title="Active Users" value={Math.floor(Math.random() * 50) + 12} icon={Users} color="blue" />
                            <StatCard title="Total Documents" value={docs.length} icon={Book} color="emerald" />
                            <StatCard title="Pending Reviews" value={reviews.filter(r=>r.status === 'Pending').length} icon={Clock} color="amber" />
                            <StatCard title="Threats Blocked" value="0" icon={Shield} color="red" />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Live Query Feed */}
                            <div className="lg:col-span-2 glass-card rounded-2xl p-6 border-white/10">
                                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                                    <Activity size={16} className="text-emerald-400"/> Live Query Feed
                                </h3>
                                <div className="space-y-3">
                                    {leads.slice(0, 5).map(lead => (
                                        <div key={lead.id} className="flex items-start gap-4 p-3 rounded-xl bg-white/5 border border-white/5">
                                            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                                                <MessageCircle size={14}/>
                                            </div>
                                            <div>
                                                <p className="text-sm text-white/90 font-medium line-clamp-1">"{lead.queryContext}"</p>
                                                <p className="text-xs text-white/40 mt-1 flex items-center gap-2">
                                                    <span>{new Date(lead.timestamp).toLocaleTimeString()}</span>
                                                    <span>•</span>
                                                    <span>{lead.phoneNumber}</span>
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                    {leads.length === 0 && <p className="text-white/30 text-sm italic">Waiting for live traffic...</p>}
                                </div>
                            </div>
                            
                            {/* System Health */}
                            <div className="glass-card rounded-2xl p-6 border-white/10">
                                <h3 className="text-white font-semibold mb-4">System Health</h3>
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs text-white/60">
                                            <span>RAG Latency</span>
                                            <span className="text-emerald-400">124ms</span>
                                        </div>
                                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-500 w-[20%]"></div>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs text-white/60">
                                            <span>Vector DB Usage</span>
                                            <span className="text-blue-400">12%</span>
                                        </div>
                                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-500 w-[12%]"></div>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs text-white/60">
                                            <span>API Rate Limit</span>
                                            <span className="text-amber-400">45%</span>
                                        </div>
                                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                            <div className="h-full bg-amber-500 w-[45%]"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* --- KNOWLEDGE BASE --- */}
                {activeView === 'KNOWLEDGE' && (
                    <div className="space-y-6">
                        <div className="glass-card p-6 rounded-2xl border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
                             <div>
                                 <h3 className="text-white font-bold text-lg">Document Repository</h3>
                                 <p className="text-white/50 text-xs">Manage trusted PDFs, Fatwas, and Historical Records</p>
                             </div>
                             <div className="flex items-center gap-3 w-full md:w-auto">
                                 <div className="relative cursor-pointer hover:scale-105 transition-transform">
                                    <input 
                                        type="file" 
                                        accept="application/pdf"
                                        onChange={handleFileUpload}
                                        disabled={isUploading}
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                    />
                                    <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 shadow-lg shadow-emerald-500/20">
                                        {isUploading ? <RefreshCw size={16} className="animate-spin"/> : <Upload size={16} />}
                                        {isUploading ? uploadStatus : 'Upload PDF'}
                                    </button>
                                 </div>
                             </div>
                        </div>

                        <div className="glass-card rounded-2xl overflow-hidden border border-white/10">
                            <table className="w-full text-left text-sm text-white/80">
                                <thead className="bg-white/5 text-white/40 font-semibold uppercase text-xs">
                                    <tr>
                                        <th className="px-6 py-4">Title</th>
                                        <th className="px-6 py-4">Category</th>
                                        <th className="px-6 py-4">Trust Level</th>
                                        <th className="px-6 py-4">Chunks</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {docs.map(doc => (
                                        <tr key={doc.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 font-medium text-white">{doc.title}</td>
                                            <td className="px-6 py-4">
                                                <span className="bg-white/10 px-2 py-1 rounded text-xs">{doc.category || 'General'}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {doc.isTrusted ? 
                                                    <span className="text-emerald-400 flex items-center gap-1 text-xs font-bold"><CheckCircle size={12}/> Verified Source</span> : 
                                                    <span className="text-white/40 text-xs">Standard</span>
                                                }
                                            </td>
                                            <td className="px-6 py-4 text-xs font-mono">{doc.chunkCount}</td>
                                            <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                <button 
                                                    onClick={() => {
                                                        setInspectDoc(doc.id);
                                                        setInspectChunks(mockDB.getChunks().filter(c => c.docId === doc.id));
                                                    }}
                                                    className="p-2 hover:bg-white/10 rounded-lg text-white/60 hover:text-emerald-400 transition-colors"
                                                    title="Inspect & Edit Passages"
                                                >
                                                    <Edit3 size={16}/>
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        if(confirm('Delete document?')) mockDB.deleteDocument(doc.id);
                                                        refreshData();
                                                    }}
                                                    className="p-2 hover:bg-white/10 rounded-lg text-white/60 hover:text-red-400 transition-colors"
                                                >
                                                    <Trash2 size={16}/>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                             {docs.length === 0 && <div className="p-8 text-center text-white/30 italic">No documents in the knowledge base.</div>}
                        </div>
                    </div>
                )}

                {/* --- SCHOLAR REVIEW --- */}
                {activeView === 'REVIEWS' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-white font-bold text-lg">Scholar Verification Queue</h3>
                            <div className="flex gap-2">
                                <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold border border-amber-500/20">
                                    {reviews.filter(r=>r.status === 'Pending').length} Pending
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {reviews.map(review => (
                                <div key={review.id} className="glass-card p-6 rounded-2xl border-white/10 relative overflow-hidden group">
                                    <div className={`absolute top-0 left-0 w-1 h-full ${
                                        review.status === 'Verified' ? 'bg-emerald-500' : 
                                        review.status === 'Rejected' ? 'bg-red-500' : 'bg-amber-500'
                                    }`}></div>
                                    
                                    <div className="ml-4">
                                        <div className="flex justify-between items-start mb-3">
                                            <h4 className="text-white font-medium text-lg">"{review.query}"</h4>
                                            <span className={`text-xs px-2 py-1 rounded border ${
                                                 review.status === 'Verified' ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 
                                                 review.status === 'Rejected' ? 'border-red-500/30 text-red-400 bg-red-500/10' : 'border-amber-500/30 text-amber-400 bg-amber-500/10'
                                            }`}>
                                                {review.status}
                                            </span>
                                        </div>

                                        <div className="bg-black/30 p-4 rounded-xl border border-white/5 mb-4">
                                            <p className="text-sm text-white/80 leading-relaxed font-light">{review.aiAnswer}</p>
                                        </div>

                                        {review.status === 'Pending' && (
                                            <div className="flex gap-3 mt-4">
                                                <button 
                                                    onClick={() => handleReviewAction(review, 'Verified')}
                                                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-emerald-900/20"
                                                >
                                                    <CheckCircle size={14}/> Verify Answer
                                                </button>
                                                <button 
                                                    onClick={() => handleReviewAction(review, 'Rejected')}
                                                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-sm font-medium rounded-lg transition-colors border border-white/10"
                                                >
                                                    <X size={14}/> Reject / Hallucination
                                                </button>
                                            </div>
                                        )}
                                        {review.status === 'Verified' && (
                                            <p className="text-xs text-emerald-500/60 mt-2 flex items-center gap-1">
                                                <CheckCircle size={10}/> Verified by Scholar on {new Date(review.timestamp).toLocaleDateString()}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* --- SETTINGS --- */}
                {activeView === 'SETTINGS' && (
                    <div className="glass-card p-8 rounded-2xl border-white/10 max-w-3xl mx-auto">
                        <h3 className="text-white font-bold text-xl mb-6 flex items-center gap-2">
                            <Settings size={20} className="text-emerald-400"/> Configuration Center
                        </h3>

                        {/* Branding */}
                        <div className="space-y-6">
                            <div>
                                <h4 className="text-sm font-bold text-white/60 uppercase mb-4">Branding & Identity</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs text-white/40">App Name</label>
                                        <input 
                                            type="text" 
                                            value={settings.appName}
                                            onChange={(e) => setSettings({...settings, appName: e.target.value})}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-emerald-500 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs text-white/40">Admin Password</label>
                                        <input 
                                            type="text" 
                                            value={settings.adminPassword}
                                            onChange={(e) => setSettings({...settings, adminPassword: e.target.value})}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-emerald-500 outline-none"
                                        />
                                    </div>
                                    <div className="col-span-full space-y-2">
                                        <label className="text-xs text-white/40">Description</label>
                                        <textarea 
                                            value={settings.appDescription}
                                            onChange={(e) => setSettings({...settings, appDescription: e.target.value})}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-emerald-500 outline-none"
                                            rows={2}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="w-full h-px bg-white/5"></div>

                            {/* AI Behavior */}
                            <div>
                                <h4 className="text-sm font-bold text-white/60 uppercase mb-4">AI Behavior & Safety</h4>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-xs text-white/40">System Prompt (The "Brain")</label>
                                        <textarea 
                                            value={settings.systemInstruction}
                                            onChange={(e) => setSettings({...settings, systemInstruction: e.target.value})}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-xs font-mono text-emerald-100/80 focus:border-emerald-500 outline-none"
                                            rows={6}
                                        />
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                            <label className="text-xs text-white/40 block mb-2">Model Selection</label>
                                            <select 
                                                value={settings.modelSelection}
                                                onChange={(e) => setSettings({...settings, modelSelection: e.target.value as any})}
                                                className="w-full bg-black/40 text-white p-2 rounded-lg border border-white/10"
                                            >
                                                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Fast)</option>
                                                <option value="gemini-1.5-pro">Gemini 1.5 Pro (Reasoning)</option>
                                            </select>
                                        </div>
                                        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                            <label className="text-xs text-white/40 block mb-2">Safety Threshold</label>
                                            <select 
                                                value={settings.safetyThreshold}
                                                onChange={(e) => setSettings({...settings, safetyThreshold: e.target.value as any})}
                                                className="w-full bg-black/40 text-white p-2 rounded-lg border border-white/10"
                                            >
                                                <option value="Low">Low (Permissive)</option>
                                                <option value="Medium">Medium (Balanced)</option>
                                                <option value="High">High (Strict)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="w-full h-px bg-white/5"></div>

                            {/* Voice Settings */}
                            <div>
                                <h4 className="text-sm font-bold text-white/60 uppercase mb-4">Voice Interaction Controls</h4>
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                                        <div className="flex items-center gap-3">
                                            <Mic size={18} className="text-emerald-400" />
                                            <span className="text-sm text-white">Enable Voice Input (Mic)</span>
                                        </div>
                                        <button onClick={() => setSettings({...settings, enableVoiceInput: !settings.enableVoiceInput})} className={`${settings.enableVoiceInput ? 'text-emerald-400' : 'text-white/20'}`}>
                                            {settings.enableVoiceInput ? <ToggleRight size={32}/> : <ToggleLeft size={32}/>}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="w-full h-px bg-white/5"></div>

                            {/* Feature Toggles */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                                    <span className="text-sm text-white">Maintenance Mode</span>
                                    <button onClick={() => setSettings({...settings, maintenanceMode: !settings.maintenanceMode})} className={`${settings.maintenanceMode ? 'text-red-400' : 'text-white/20'}`}>
                                        {settings.maintenanceMode ? <ToggleRight size={32}/> : <ToggleLeft size={32}/>}
                                    </button>
                                </div>
                            </div>

                            <button onClick={() => saveConfig(settings)} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-bold text-lg shadow-xl shadow-emerald-900/20 transition-all flex items-center justify-center gap-2">
                                <Save size={20}/> Save Configuration
                            </button>
                        </div>
                    </div>
                )}

                {/* --- LOGS --- */}
                {activeView === 'LOGS' && (
                    <div className="glass-card rounded-2xl overflow-hidden border border-white/10">
                        <div className="p-6 border-b border-white/10">
                            <h3 className="text-white font-bold text-lg">System Audit Logs</h3>
                            <p className="text-xs text-white/40">Compliance tracking for all administrative actions</p>
                        </div>
                        <table className="w-full text-left text-sm text-white/80">
                            <thead className="bg-white/5 text-white/40 font-semibold uppercase text-xs">
                                <tr>
                                    <th className="px-6 py-4">Timestamp</th>
                                    <th className="px-6 py-4">User</th>
                                    <th className="px-6 py-4">Action</th>
                                    <th className="px-6 py-4">Details</th>
                                    <th className="px-6 py-4">Severity</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {logs.map(log => (
                                    <tr key={log.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 font-mono text-xs text-white/50">{new Date(log.timestamp).toLocaleString()}</td>
                                        <td className="px-6 py-4">{log.user}</td>
                                        <td className="px-6 py-4 font-medium text-white">{log.action}</td>
                                        <td className="px-6 py-4 text-xs text-white/70">{log.details}</td>
                                        <td className="px-6 py-4">
                                            <span className={`text-[10px] px-2 py-1 rounded border ${
                                                log.severity === 'Critical' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                                                log.severity === 'Warning' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                                                'bg-blue-500/20 text-blue-400 border-blue-500/30'
                                            }`}>
                                                {log.severity}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* --- ANALYTICS & MODERATION (Placeholders for scope) --- */}
                {(activeView === 'ANALYTICS' || activeView === 'MODERATION') && (
                    <div className="flex flex-col items-center justify-center h-[50vh] text-white/30">
                        <AlertOctagon size={48} className="mb-4 opacity-50"/>
                        <p>This enterprise module is initialized but requires more data to populate visualizations.</p>
                        <p className="text-xs mt-2">Check back after 24 hours of user activity.</p>
                    </div>
                )}
            </div>
        </main>

        {/* --- Inspect / Edit Modal --- */}
        {inspectDoc && (
             <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
                 <div className="bg-[#022c22] border border-white/20 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                     <div className="flex items-center justify-between p-6 border-b border-white/10 bg-black/20">
                         <div>
                            <h3 className="text-white font-bold text-xl">Passage Editor</h3>
                            <p className="text-xs text-emerald-400 font-mono mt-1">DOC ID: {inspectDoc}</p>
                         </div>
                         <button onClick={() => { setInspectDoc(null); setInspectChunks([]); }} className="p-2 hover:bg-white/10 rounded-full text-white">
                             <X size={24}/>
                         </button>
                     </div>
                     <div className="flex-1 overflow-y-auto p-6 space-y-4">
                         {inspectChunks.map((chunk, idx) => (
                             <div key={chunk.id} className="bg-black/20 border border-white/5 rounded-xl p-4 hover:border-emerald-500/30 transition-colors group">
                                 <div className="flex justify-between mb-2">
                                     <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Chunk #{idx + 1}</span>
                                     <button 
                                        onClick={() => {
                                            const newText = prompt("Edit Passage Text:", chunk.text);
                                            if (newText) {
                                                mockDB.updateChunk({ ...chunk, text: newText });
                                                setInspectChunks(mockDB.getChunks().filter(c => c.docId === inspectDoc)); // Refresh local
                                            }
                                        }}
                                        className="text-xs text-white/40 hover:text-emerald-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                     >
                                         <Edit3 size={12}/> Edit Text
                                     </button>
                                 </div>
                                 <p className="text-sm text-white/80 leading-relaxed font-light">{chunk.text}</p>
                             </div>
                         ))}
                     </div>
                 </div>
             </div>
        )}
    </div>
  );
};

export default AdminPanel;