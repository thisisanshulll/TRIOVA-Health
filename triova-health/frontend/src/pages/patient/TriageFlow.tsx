import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { AlertCircle, Camera, Loader2, Send } from 'lucide-react';

interface Message {
  role: 'system' | 'ai' | 'user';
  content: string;
}

export default function TriageFlow() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', content: "Hello, I'm TRIOVA's AI Triage Assistant. To help direct you to the right care, please describe what you're experiencing today." }
  ]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages((prev: any) => [...prev, { role: 'user', content: userMsg }]);

    setIsLoading(true);

    try {
      if (!sessionId) {
        // First message starts the session
        const res = await api.post('/triage/start', { chief_complaint: userMsg });
        setSessionId(res.data.data.session_id);
        
        // Let emergency detector check
        if (res.data.data.emergency_level === 'emergency') {
          setIsEmergency(true);
          setMessages((prev: any) => [...prev, { role: 'system', content: 'EMERGENCY DETECTED. Please call 911 or go to the nearest emergency room immediately.' }]);

          return;
        }

        setMessages((prev: any) => [...prev, { role: 'ai', content: res.data.data.next_question }]);

      } else {
        // Subsequent answers
        const res = await api.post('/triage/answer', { session_id: sessionId, answer: userMsg });
        
        if (res.data.data.status === 'completed') {
           setSummary(res.data.data);
           setMessages((prev: any) => [...prev, { role: 'system', content: 'Triage assessment complete. Generating summary and options...' }]);

        } else {
           setMessages((prev: any) => [...prev, { role: 'ai', content: res.data.data.next_question }]);

        }
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.response?.data?.error || 'Failed to communicate with AI' });
      setMessages((prev: any) => prev.slice(0, -1)); // revert

    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !sessionId) return;
    setIsLoading(true);
    const formData = new FormData();
    formData.append('image', e.target.files[0]);
    formData.append('session_id', sessionId);

    try {
       setMessages((prev: any) => [...prev, { role: 'user', content: '[Image Uploaded for AI Vision Analysis]' }]);

       const res = await api.post('/triage/upload-image', formData, { headers: { 'Content-Type': 'multipart/form-data' }});
       setMessages((prev: any) => [...prev, { role: 'ai', content: `I've analyzed the image. ${res.data.data.status === 'completed' ? 'Assessment complete.' : res.data.data.next_question}` }]);

       if (res.data.data.status === 'completed') setSummary(res.data.data);
    } catch (err) {
       toast({ variant: 'destructive', title: 'Upload Failed', description: 'Failed to process image' });
    } finally {
       setIsLoading(false);
    }
  };

  if (isEmergency) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-red-500 shadow-xl">
          <CardHeader className="bg-red-600 text-white rounded-t-lg">
            <CardTitle className="flex items-center gap-2 text-2xl">
              <AlertCircle size={32} /> EMERGENCY DETECTED
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 text-center space-y-4 text-red-900 font-medium text-lg">
            <p>Based on your symptoms, this may be a life-threatening medical emergency.</p>
            <p className="font-bold text-2xl">Please call 911 immediately or go to the nearest emergency department.</p>
          </CardContent>
          <CardFooter className="justify-center">
            <Button onClick={() => navigate('/dashboard')} variant="outline">Back to Dashboard</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (summary) {
    return (
      <div className="max-w-2xl mx-auto p-4 md:p-8">
        <Card>
          <CardHeader>
            <CardTitle>Triage Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className={`p-4 rounded-lg flex items-center gap-3 font-bold uppercase text-lg ${summary.urgency_level === 'high' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>
              <AlertCircle /> Urgency Level: {summary.urgency_level}
            </div>
            
            <div className="bg-slate-50 p-6 rounded-lg border">
              <h3 className="font-semibold text-lg border-b pb-2 mb-4">Doctor's Clinical Summary</h3>
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{summary.ai_summary}</p>
            </div>

            <div className="flex gap-4 pt-4">
              <Button onClick={() => navigate('/appointments', { state: { triageId: sessionId, urgency: summary.urgency_level }})} className="flex-1 text-lg py-6">
                 Book Consultation Now
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto h-[calc(100vh-4rem)] flex flex-col p-4">
      <Card className="flex-1 flex flex-col overflow-hidden border-slate-200 shadow-lg">
        <CardHeader className="bg-indigo-600 text-white rounded-t-xl py-4">
          <CardTitle className="flex items-center gap-2">
            AI Triage Assistant <span className="text-xs bg-indigo-500 px-2 py-1 rounded-full">Beta</span>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-4 rounded-2xl ${
                msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 
                msg.role === 'system' ? 'bg-red-100 text-red-800 border border-red-200' :
                'bg-white border text-slate-800 rounded-bl-none shadow-sm'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border p-4 rounded-2xl rounded-bl-none flex items-center gap-2 text-slate-500">
                <Loader2 className="animate-spin h-4 w-4" /> TRIOVA is thinking...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </CardContent>

        <div className="p-4 bg-white border-t">
          <form onSubmit={handleSend} className="flex gap-2 items-center">
            {sessionId && (
              <label className="cursor-pointer p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isLoading} />
                <Camera size={24} />
              </label>
            )}
            <Input 
              value={input} 
              onChange={(e: any) => setInput(e.target.value)} 
              placeholder={sessionId ? "Answer the question..." : "E.g., I have a sharp pain in my lower right abdomen..."}
              className="flex-1"
              disabled={isLoading}
            />
            <Button type="submit" disabled={!input.trim() || isLoading} className="bg-indigo-600 hover:bg-indigo-700">
              <Send size={18} />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
