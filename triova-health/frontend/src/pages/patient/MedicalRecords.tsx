import { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { FileText, Loader2, Send, Trash2, Download } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function MedicalRecords() {
  const { user } = useAuthStore();
  const [docs, setDocs] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [chatReady, setChatReady] = useState(false);
  const { toast } = useToast();

  const [messages, setMessages] = useState<{role:string; content:string}[]>([
    { role: 'ai', content: 'Hello! I can answer questions based on the medical records you have uploaded. What would you like to know?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchDocs();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchDocs = async () => {
    try {
      const res = await api.get(`/medical-records/patient/${user?.patientId}`);
      setDocs(res.data.data.documents);
      setChatReady(res.data.data.documents.some((d: any) => d.is_processed));
    } catch (err) { }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', e.target.files[0]);
    formData.append('patient_id', user!.patientId!);
    formData.append('document_type', 'lab_report'); // generic default

    try {
      await api.post('/medical-records/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' }});
      toast({ title: 'Upload Started', description: 'Document is being processed by AI (OCR & Vectorization).' });
      fetchDocs();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Upload Failed', description: 'Could not upload file.' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/medical-records/document/${id}`);
      fetchDocs();
    } catch (err) { }
  };

  const handleExport = async () => {
    window.open(`${api.defaults.baseURL}/medical-records/export/${user?.patientId}`, '_blank');
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatting || !chatReady) return;

    const msg = chatInput.trim();
    setChatInput('');
    setMessages((prev: any) => [...prev, { role: 'user', content: msg }]);

    setIsChatting(true);

    try {
      const history = messages.slice(1).map((m: any) => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content }));

      const res = await api.post('/medical-records/chat', {
        patient_id: user?.patientId,
        query: msg,
        conversation_history: history
      });
      setMessages((prev: any) => [...prev, { role: 'ai', content: res.data.data.answer }]);

    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.response?.data?.error || 'Chat failed' });
      setMessages((prev: any) => prev.slice(0, -1));

    } finally {
      setIsChatting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Health Records & AI Chat</h1>
          <p className="text-slate-500">Manage documents and ask questions about your health history.</p>
        </div>
        <Button onClick={handleExport} variant="outline" className="gap-2">
          <Download size={16} /> Export PDF
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[600px]">
        {/* Left: Document List */}
        <Card className="col-span-1 flex flex-col shadow-sm">
          <CardHeader>
            <CardTitle>My Documents</CardTitle>
            <CardDescription>Upload PDFs or Images for AI analysis.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden flex flex-col space-y-4">
             <label className="border-2 border-dashed border-slate-300 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors">
               <input type="file" className="hidden" accept=".pdf,image/*" onChange={handleUpload} disabled={isUploading} />
               {isUploading ? <Loader2 className="animate-spin text-slate-400" /> : <FileText className="text-indigo-500 mb-2" size={32} />}
               <span className="text-sm font-medium text-slate-700">{isUploading ? 'Uploading...' : 'Click to Upload Document'}</span>
             </label>

             <ScrollArea className="flex-1">
               <div className="space-y-3">
                 {docs.map((doc: any) => (

                   <div key={doc.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-md border">
                     <div className="flex items-center gap-3 overflow-hidden">
                       <FileText size={20} className="text-slate-400 flex-shrink-0" />
                       <div className="truncate text-sm">
                         <div className="font-medium truncate">{doc.file_name}</div>
                         <div className="text-xs text-slate-500">Status: {doc.is_processed ? 'Analyzed' : doc.processing_error ? 'Error' : 'Processing'}</div>
                       </div>
                     </div>
                     <Button variant="ghost" size="icon" onClick={() => handleDelete(doc.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                       <Trash2 size={16} />
                     </Button>
                   </div>
                 ))}
               </div>
             </ScrollArea>
          </CardContent>
        </Card>

        {/* Right: RAG Chat */}
        <Card className="col-span-2 flex flex-col shadow-sm">
           <CardHeader className="border-b bg-slate-50/50">
            <CardTitle className="flex items-center gap-2 text-indigo-700">
               Medical Records AI 
               {!chatReady && <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-normal">Waiting for processed documents</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
             {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-4 rounded-xl ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-100 text-slate-800 rounded-bl-none'}`}>
                  {m.content}
                </div>
              </div>
             ))}
             {isChatting && (
               <div className="flex justify-start">
                  <div className="bg-slate-100 text-slate-500 p-4 rounded-xl rounded-bl-none flex items-center gap-2">
                    <Loader2 className="animate-spin h-4 w-4" /> Searching your records...
                  </div>
               </div>
             )}
             <div ref={scrollRef} />
          </CardContent>
          <div className="p-4 border-t bg-white">
            <form onSubmit={handleChat} className="flex gap-2">
              <Input 
                disabled={!chatReady || isChatting}
                value={chatInput}
                onChange={(e: any) => setChatInput(e.target.value)}
                placeholder={chatReady ? "Ask me about your test results, allergies, etc." : "Upload and wait for a document to be analyzed first."}
                className="flex-1"
              />
              <Button type="submit" disabled={!chatReady || isChatting || !chatInput.trim()} className="bg-indigo-600">
                <Send size={18} />
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
}
