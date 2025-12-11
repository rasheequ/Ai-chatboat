import React, { useState, useEffect, useRef } from 'react';
import { UploadedDocument, AppSettings, Lead, DocumentChunk } from '../types';
import { mockDB } from '../services/mockFirebase';
import { extractTextFromPdf, chunkText } from '../services/pdfService';
import { getEmbeddings } from '../services/geminiService';
import { Upload, Trash2, FileText, Database, LogOut, Settings, ToggleLeft, ToggleRight, Activity, Image as ImageIcon, Save, Edit3, MessageCircle, Users, Search, Download, Eye, X, Shield, Cpu, Lock, Phone, Copy } from 'lucide-react';
import { useLiquid } from './LiquidBackground';

interface AdminPanelProps {
  onLogout: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onLogout }) => {
  const [docs, setDocs] = useState<UploadedDocument[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [settings, setSettings] = useState<AppSettings>({ 
    showTextInput: true, 
    useLiveMode: false,
    appName: '',
    appDescription: '',
    systemInstruction: '',
    adminPassword: ''
  });
  
  // Branding Form State
  const [appName, setAppName] = useState('');
  const [appDescription, setAppDescription] = useState('');
  const [systemInstruction, setSystemInstruction] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Inspect Modal State
  const [inspectDocId, setInspectDocId] = useState<string | null>(null);
  const [inspectChunks, setInspectChunks] = useState<DocumentChunk[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addRipple } = useLiquid();

  useEffect(() => {
    loadDocs();
    loadLeads();
    loadSettings();
  }, []);

  // Filter leads with debouncing
  useEffect(() => {
    const handler = setTimeout(() => {
        if (!searchTerm.trim()) {
            setFilteredLeads(leads);
        } else {
            const lowerTerm = searchTerm.toLowerCase();
            const results = leads.filter(lead => 
                lead.phoneNumber.toLowerCase().includes(lowerTerm) || 
                lead.queryContext.toLowerCase().includes(lowerTerm)
            );
            setFilteredLeads(results);
        }
    }, 300);

    return () => clearTimeout(handler);
  }, [searchTerm, leads]);

  const loadDocs = () => {
    setDocs(mockDB.getDocuments());
  };

  const loadLeads = () => {
    const sortedLeads = mockDB.getLeads().sort((a,b) => b.timestamp - a.timestamp);
    setLeads(sortedLeads);
  }

  const loadSettings = () => {
    const current = mockDB.getSettings();
    setSettings(current);
    setAppName(current.appName);
    setAppDescription(current.appDescription);
    setSystemInstruction(current.systemInstruction || '');
    setAdminPassword(current.adminPassword || 'rasheequ.designs');
    setLogoPreview(current.logoBase64 || null);
  };

  const saveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    mockDB.saveSettings(newSettings);
    addRipple(0, 0, 0.5);
    
    // Update local state mirrors
    setAppName(newSettings.appName);
    setAppDescription(newSettings.appDescription);
    setSystemInstruction(newSettings.systemInstruction || '');
    setAdminPassword(newSettings.adminPassword || '');
    setLogoPreview(newSettings.logoBase64 || null);
    
    // Update document title immediately for feedback
    document.title = newSettings.appName;
  };

  const handleGeneralSave = () => {
    const updated: AppSettings = {
        ...settings,
        appName,
        appDescription,
        logoBase64: logoPreview || undefined,
        systemInstruction,
        adminPassword
    };
    saveSettings(updated);
    alert("System configuration saved successfully!");
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            setLogoPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    }
  };

  const toggleTextInput = () => saveSettings({ ...settings, showTextInput: !settings.showTextInput });
  const toggleLiveMode = () => saveSettings({ ...settings, useLiveMode: !settings.useLiveMode });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert("Please upload a valid PDF file.");
      return;
    }

    setIsUploading(true);
    setUploadStatus('Extracting text...');
    addRipple(0, 0, 1.0);

    try {
      const { text, pageCount } = await extractTextFromPdf(file);
      setUploadStatus(`Chunking ${pageCount} pages...`);
      const textChunks = chunkText(text);
      setUploadStatus(`Embedding ${textChunks.length} chunks...`);
      const embeddings = await getEmbeddings(textChunks);
      const docId = `doc-${Date.now()}`;
      const newDoc: UploadedDocument = {
        id: docId,
        title: file.name,
        uploadDate: Date.now(),
        chunkCount: textChunks.length,
        size: file.size,
        isProcessed: true
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
      setUploadStatus('Done!');
      loadDocs();
      setTimeout(() => {
        setUploadStatus('');
        setIsUploading(false);
      }, 2000);
    } catch (error) {
      console.error(error);
      setUploadStatus('Failed');
      setIsUploading(false);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this document and all its knowledge?")) {
      mockDB.deleteDocument(id);
      loadDocs();
      addRipple(0, 0, 0.8);
    }
  };

  const handleExportCSV = () => {
    if (leads.length === 0) return;
    const headers = "Phone Number,Date,Query Context\n";
    const rows = leads.map(l => {
        const date = new Date(l.timestamp).toLocaleString().replace(',', '');
        const context = l.queryContext.replace(/"/g, '""'); // Escape quotes
        return `${l.phoneNumber},"${date}","${context}"`;
    }).join("\n");
    
    const csvContent = "data:text/csv;charset=utf-8," + headers + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `samastha_leads_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleInspect = (docId: string) => {
      const allChunks = mockDB.getChunks();
      const docChunks = allChunks.filter(c => c.docId === docId);
      setInspectChunks(docChunks);
      setInspectDocId(docId);
  };

  const closeInspect = () => {
      setInspectDocId(null);
      setInspectChunks([]);
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      alert(`Copied: ${text}`);
  };

  return (
    <div className="min-h-screen p-6 overflow-y-auto" onClick={(e) => addRipple((e.clientX/window.innerWidth)*2-1, -(e.clientY/window.innerHeight)*2+1, 0.3)}>
      <nav className="glass-card rounded-2xl px-6 py-4 flex justify-between items-center mb-8 sticky top-4 z-20 bg-white/10 border-white/20">
        <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-samastha-green to-emerald-400 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-emerald-500/20 overflow-hidden">
                {settings.logoBase64 ? (
                    <img src={settings.logoBase64} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                    "A"
                )}
            </div>
            <div>
                <h1 className="text-lg font-bold text-white leading-none">Admin Panel</h1>
                <p className="text-xs text-emerald-200/80">System Configuration</p>
            </div>
        </div>
        <button 
            onClick={onLogout}
            className="flex items-center text-red-200 hover:text-red-100 text-sm font-medium bg-red-500/20 hover:bg-red-500/30 px-4 py-2 rounded-full transition-colors border border-red-500/20"
        >
            <LogOut className="w-4 h-4 mr-2"/> Logout
        </button>
      </nav>

      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="glass-card p-6 rounded-3xl flex items-center justify-between group hover:-translate-y-1 transition-transform duration-300 bg-white/5 border-white/10">
                <div>
                    <h3 className="text-sm font-medium text-emerald-200/60 mb-1">Documents</h3>
                    <p className="text-4xl font-bold text-white">{docs.length}</p>
                </div>
                <div className="w-12 h-12 bg-white/10 text-emerald-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FileText />
                </div>
            </div>
            <div className="glass-card p-6 rounded-3xl flex items-center justify-between group hover:-translate-y-1 transition-transform duration-300 bg-white/5 border-white/10">
                <div>
                    <h3 className="text-sm font-medium text-emerald-200/60 mb-1">Knowledge Chunks</h3>
                    <p className="text-4xl font-bold text-white">
                        {docs.reduce((acc, curr) => acc + curr.chunkCount, 0)}
                    </p>
                </div>
                <div className="w-12 h-12 bg-white/10 text-amber-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Database />
                </div>
            </div>
             <div className="glass-card p-6 rounded-3xl flex items-center justify-between group hover:-translate-y-1 transition-transform duration-300 bg-white/5 border-white/10">
                <div>
                    <h3 className="text-sm font-medium text-emerald-200/60 mb-1">Total Leads</h3>
                    <p className="text-4xl font-bold text-white">{leads.length}</p>
                </div>
                <div className="w-12 h-12 bg-white/10 text-blue-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Users />
                </div>
            </div>
             <div className="glass-card p-6 rounded-3xl flex items-center justify-between group hover:-translate-y-1 transition-transform duration-300 bg-white/5 border-white/10">
                <div>
                    <h3 className="text-sm font-medium text-emerald-200/60 mb-1">System Status</h3>
                    <p className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse"></span>
                        Operational
                    </p>
                </div>
                <div className="w-12 h-12 bg-white/10 text-emerald-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Activity />
                </div>
            </div>
        </div>

        {/* Leads Table */}
        <div className="glass-card rounded-3xl overflow-hidden border border-white/10 bg-white/5">
             <div className="px-8 py-6 border-b border-white/10 bg-white/5 backdrop-blur-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex flex-col">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Users size={20} className="text-green-400"/> Captured Leads
                    </h2>
                    <span className="text-xs text-white/40 mt-1">Users requesting reports</span>
                </div>
                
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    {/* Search Bar */}
                    <div className="relative flex-1 sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
                        <input 
                            type="text" 
                            placeholder="Search..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-black/20 border border-white/10 rounded-full pl-10 pr-4 py-2 text-sm text-white placeholder-white/30 focus:border-emerald-400 focus:bg-black/30 outline-none w-full transition-all"
                        />
                    </div>
                    {/* Export Button */}
                     <button 
                        onClick={handleExportCSV}
                        title="Export to CSV"
                        className="bg-white/10 hover:bg-emerald-500/20 text-white p-2 rounded-full border border-white/10 transition-colors"
                    >
                        <Download size={18} />
                    </button>
                </div>
            </div>
            <table className="w-full text-left text-sm text-emerald-100/80">
                <thead className="bg-white/5 text-emerald-200/60 font-medium">
                    <tr>
                        <th className="px-8 py-4">Phone Number</th>
                        <th className="px-8 py-4">Date</th>
                        <th className="px-8 py-4">Context / Query</th>
                        <th className="px-8 py-4 text-right">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {filteredLeads.length === 0 ? (
                        <tr>
                            <td colSpan={4} className="px-8 py-12 text-center text-white/30">
                                {leads.length === 0 ? "No leads captured yet." : "No leads found matching your search."}
                            </td>
                        </tr>
                    ) : (
                        filteredLeads.map((lead) => (
                            <tr key={lead.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-8 py-4 font-bold text-white font-mono">
                                    {lead.phoneNumber}
                                </td>
                                <td className="px-8 py-4 text-xs">
                                    {new Date(lead.timestamp).toLocaleString()}
                                </td>
                                <td className="px-8 py-4 text-xs max-w-md truncate">
                                    {lead.queryContext}
                                </td>
                                <td className="px-8 py-4 text-right flex justify-end gap-2">
                                    <button
                                        onClick={() => copyToClipboard(lead.phoneNumber)}
                                        className="inline-flex items-center gap-1 bg-white/5 hover:bg-white/10 text-white px-3 py-1.5 rounded-full text-xs font-medium transition-colors border border-white/10"
                                        title="Copy Number"
                                    >
                                        <Copy size={12}/> 
                                    </button>
                                    <a 
                                        href={`tel:${lead.phoneNumber}`}
                                        className="inline-flex items-center gap-1 bg-green-500/20 hover:bg-green-500/30 text-green-300 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border border-green-500/20"
                                        title="Call"
                                    >
                                        <Phone size={12}/> Call
                                    </a>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>

        {/* Customization Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Branding & Appearance */}
            <div className="glass-card rounded-3xl p-8 bg-white/5 border-white/10">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-white/10 rounded-lg"><Edit3 className="w-5 h-5 text-emerald-200"/></div>
                    <h2 className="text-xl font-bold text-white">Settings</h2>
                </div>
                
                <div className="space-y-6">
                    {/* Logo Upload */}
                    <div className="flex items-center gap-4">
                        <div 
                            className="w-20 h-20 rounded-2xl bg-black/20 border border-white/10 flex items-center justify-center overflow-hidden cursor-pointer hover:border-emerald-400 transition-colors relative group"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {logoPreview ? (
                                <img src={logoPreview} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                                <ImageIcon className="text-white/30" />
                            )}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <span className="text-xs text-white">Change</span>
                            </div>
                        </div>
                        <div className="flex-1">
                            <label className="text-xs text-emerald-200/60 uppercase font-semibold">App Logo</label>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept="image/*"
                                onChange={handleLogoUpload}
                            />
                             <p className="text-[10px] text-white/30 mt-1">Recommended: Square PNG, max 1MB</p>
                        </div>
                    </div>

                    {/* App Name */}
                    <div className="space-y-2">
                        <label className="text-xs text-emerald-200/60 uppercase font-semibold">Application Name</label>
                        <input 
                            type="text" 
                            value={appName}
                            onChange={(e) => setAppName(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-400 outline-none transition-colors"
                            placeholder="e.g. Samastha AI"
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <label className="text-xs text-emerald-200/60 uppercase font-semibold">Description</label>
                        <textarea 
                            value={appDescription}
                            onChange={(e) => setAppDescription(e.target.value)}
                            rows={2}
                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-400 outline-none transition-colors resize-none"
                            placeholder="e.g. AI Assistant for..."
                        />
                    </div>

                    <div className="w-full h-px bg-white/10 my-4"></div>

                    {/* System Instruction */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-1">
                            <Cpu size={14} className="text-emerald-400"/>
                            <label className="text-xs text-emerald-200/60 uppercase font-semibold">AI System Instruction</label>
                        </div>
                        <textarea 
                            value={systemInstruction}
                            onChange={(e) => setSystemInstruction(e.target.value)}
                            rows={4}
                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-mono focus:border-emerald-400 outline-none transition-colors resize-none"
                            placeholder="Define the AI's behavior, rules, and personality..."
                        />
                        <p className="text-[10px] text-white/30">Controls the AI's behavior in RAG and Live modes.</p>
                    </div>

                    <div className="w-full h-px bg-white/10 my-4"></div>

                    {/* Admin Security */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-1">
                            <Shield size={14} className="text-red-400"/>
                            <label className="text-xs text-emerald-200/60 uppercase font-semibold">Admin Password</label>
                        </div>
                        <div className="relative">
                            <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                            <input 
                                type="text" 
                                value={adminPassword}
                                onChange={(e) => setAdminPassword(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:border-red-400 outline-none transition-colors"
                                placeholder="Set new password"
                            />
                        </div>
                    </div>

                    <button 
                        onClick={handleGeneralSave}
                        className="w-full bg-emerald-600/80 hover:bg-emerald-500 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-colors mt-4"
                    >
                        <Save size={16} /> Save All Changes
                    </button>
                </div>
            </div>

            {/* Feature Toggles & Upload */}
            <div className="space-y-8">
                 <div className="glass-card rounded-3xl p-8 bg-white/5 border-white/10">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-white/10 rounded-lg"><Settings className="w-5 h-5 text-emerald-200"/></div>
                        <h2 className="text-xl font-bold text-white">Features</h2>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
                            <div>
                                <h3 className="font-semibold text-white">Keyboard Input</h3>
                                <p className="text-xs text-emerald-200/60">Show text field in chat</p>
                            </div>
                            <button onClick={toggleTextInput} className={`transition-colors text-2xl ${settings.showTextInput ? 'text-emerald-400' : 'text-white/20'}`}>
                                {settings.showTextInput ? <ToggleRight size={40} className="drop-shadow-sm"/> : <ToggleLeft size={40}/>}
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
                            <div>
                                <h3 className="font-semibold text-white flex items-center gap-2">
                                    Gemini Live
                                </h3>
                                <p className="text-xs text-emerald-200/60">Real-time voice conversation</p>
                            </div>
                            <button onClick={toggleLiveMode} className={`transition-colors text-2xl ${settings.useLiveMode ? 'text-red-400' : 'text-white/20'}`}>
                                {settings.useLiveMode ? <ToggleRight size={40} className="drop-shadow-sm"/> : <ToggleLeft size={40}/>}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Upload */}
                <div className="glass-card rounded-3xl p-8 relative overflow-hidden group bg-white/5 border-white/10">
                    <h2 className="text-xl font-bold text-white mb-6">Upload Knowledge</h2>
                    <div className="border-2 border-dashed border-white/20 hover:border-emerald-400/50 rounded-2xl h-32 flex flex-col items-center justify-center text-center transition-all bg-white/5 hover:bg-white/10 relative">
                        <input 
                            type="file" 
                            accept="application/pdf"
                            onChange={handleFileUpload}
                            disabled={isUploading}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="bg-white/20 p-3 rounded-full shadow-md mb-2 group-hover:scale-110 transition-transform">
                            <Upload className={`w-5 h-5 ${isUploading ? 'text-emerald-400 animate-bounce' : 'text-emerald-100'}`} />
                        </div>
                        {isUploading ? (
                            <div>
                                <p className="font-semibold text-emerald-400 text-sm">{uploadStatus}</p>
                            </div>
                        ) : (
                            <div>
                                <p className="font-semibold text-emerald-100 text-sm">Drop PDF here</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>

        {/* Documents Table */}
        <div className="glass-card rounded-3xl overflow-hidden border border-white/10 bg-white/5">
            <div className="px-8 py-6 border-b border-white/10 bg-white/5 backdrop-blur-sm">
                <h2 className="text-lg font-bold text-white">Knowledge Base</h2>
            </div>
            <table className="w-full text-left text-sm text-emerald-100/80">
                <thead className="bg-white/5 text-emerald-200/60 font-medium">
                    <tr>
                        <th className="px-8 py-4">Document</th>
                        <th className="px-8 py-4">Uploaded</th>
                        <th className="px-8 py-4">Size</th>
                        <th className="px-8 py-4 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {docs.length === 0 ? (
                        <tr>
                            <td colSpan={4} className="px-8 py-12 text-center text-white/30">
                                No documents found.
                            </td>
                        </tr>
                    ) : (
                        docs.map((doc) => (
                            <tr key={doc.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-8 py-4 font-medium text-white flex items-center">
                                    <div className="w-8 h-8 rounded bg-white/10 text-emerald-400 flex items-center justify-center mr-3">
                                        <FileText size={16}/>
                                    </div>
                                    {doc.title}
                                </td>
                                <td className="px-8 py-4">
                                    {new Date(doc.uploadDate).toLocaleDateString()}
                                </td>
                                <td className="px-8 py-4">
                                    <span className="bg-white/10 text-emerald-200 text-xs px-2 py-1 rounded-full border border-white/10">
                                        {(doc.size / 1024).toFixed(0)} KB
                                    </span>
                                </td>
                                <td className="px-8 py-4 text-right flex items-center justify-end gap-2">
                                    <button 
                                        onClick={() => handleInspect(doc.id)}
                                        title="Inspect Text"
                                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-emerald-500/20 text-white/50 hover:text-emerald-400 flex items-center justify-center transition-all shadow-sm border border-white/10"
                                    >
                                        <Eye size={14} />
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(doc.id)}
                                        title="Delete"
                                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-red-500/20 text-white/50 hover:text-red-400 flex items-center justify-center transition-all shadow-sm border border-white/10"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
      </div>

      {/* Inspect Modal */}
      {inspectDocId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in-up">
              <div className="bg-[#022c22] border border-white/20 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
                  <div className="flex items-center justify-between p-4 border-b border-white/10">
                      <h3 className="text-white font-bold">Document Content Inspection</h3>
                      <button onClick={closeInspect} className="text-white/50 hover:text-white"><X size={20}/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {inspectChunks.length === 0 ? (
                          <p className="text-white/40 italic">No text chunks found for this document.</p>
                      ) : (
                          inspectChunks.map((chunk, idx) => (
                              <div key={idx} className="bg-white/5 border border-white/10 rounded-lg p-3">
                                  <div className="flex justify-between mb-2">
                                      <span className="text-xs font-mono text-emerald-400">Chunk #{idx + 1}</span>
                                      <span className="text-[10px] text-white/30">ID: {chunk.id}</span>
                                  </div>
                                  <p className="text-xs text-emerald-100/80 leading-relaxed whitespace-pre-wrap font-mono">
                                      {chunk.text}
                                  </p>
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default AdminPanel;