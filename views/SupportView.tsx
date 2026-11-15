
import React, { useState, useEffect, useRef } from 'react';
import { User, SupportTicket, SupportMessage } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { createSupportTicket, subscribeToUserTickets, subscribeToSupportMessages, sendSupportMessage } from '../services/firebaseBridge';
import { getAIChatResponse } from '../services/geminiService';
// import { Button } from '../components/ui/Button';

interface SupportViewProps {
  user: User;
  onBack: () => void;
  rideId?: string | null;
}

export default function SupportView({ user, onBack, rideId }: SupportViewProps) {
  const { isRTL } = useLanguage();
  const [viewState, setViewState] = useState<'CHAT' | 'HISTORY'>('CHAT');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // For the AI Chat Assistant (Local session or tied to a generic 'AI Assistant' ticket)
  useEffect(() => {
    const unsub = subscribeToUserTickets(user.id, (data) => {
        setTickets(data);
        // If there's an existing 'AI Assistant' ticket, we can load it.
        // For simplicity, we'll let the user start a new conversation easily.
    });
    return () => unsub();
  }, [user.id]);

  useEffect(() => {
      if (activeTicket) {
          const unsub = subscribeToSupportMessages(activeTicket.id, (msgs) => {
              setMessages(msgs);
          });
          return () => unsub();
      } else if (viewState === 'CHAT') {
          // If no active ticket but in CHAT mode, check if we should auto-create one or show intro
          setMessages([{
              id: 'intro',
              text: isRTL 
                ? "أهلاً بك في مساعد مواصلة الذكي! 👋 أنا هنا لمساعدتك في أي استفسار حول التطبيق، الرحلات، أو المحفظة. كيف يمكنني مساعدتك اليوم؟" 
                : "Welcome to Mowasla AI Assistant! 👋 I'm here to help you with any questions about the app, rides, or your wallet. How can I help you today?",
              senderId: 'ai',
              timestamp: new Date(),
              isAdmin: true
          }]);
      }
  }, [activeTicket, viewState, isRTL]);

  useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleStartAIChat = async (text: string) => {
      setIsSending(true);
      try {
          // Create a generic AI ticket if none active
          const ticketId = await createSupportTicket(user.id, "AI Support Chat", text, rideId || undefined);
          const newTicket: SupportTicket = { id: ticketId, subject: "AI Support Chat", status: 'open', userId: user.id, createdAt: new Date() as any, lastMessageAt: new Date() as any };
          setActiveTicket(newTicket);
          
          // Get AI Response
          const aiReply = await getAIChatResponse(text, `User ${user.name} is using the in-app AI assistant. Help them with general app questions.`);
          await sendSupportMessage(ticketId, aiReply, 'support_bot', true);
      } catch (e) {
          console.error("AI Chat start failed", e);
      } finally {
          setIsSending(false);
      }
  };

  const handleSendMessage = async () => {
      if (!newMessageText.trim()) return;
      const text = newMessageText;
      setNewMessageText('');

      if (!activeTicket) {
          await handleStartAIChat(text);
          return;
      }

      setIsSending(true);
      try {
          await sendSupportMessage(activeTicket.id, text, user.id, false);
          const context = `User: ${user.name}. Previous chat length: ${messages.length}. Current question: ${text}`;
          const aiReply = await getAIChatResponse(text, context);
          await sendSupportMessage(activeTicket.id, aiReply, 'support_bot', true);
      } catch (e) {
          console.error("Send message failed", e);
          setNewMessageText(text);
      } finally {
          setIsSending(false);
      }
  };

  const formatTime = (timestamp: SupportMessage['timestamp']) => {
      if (!timestamp) return '';
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-full w-full bg-[#f8f9fa] flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-white p-4 pt-safe shadow-sm z-10 shrink-0 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-4">
            <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                <i className={`fas ${isRTL ? 'fa-arrow-right' : 'fa-arrow-left'} text-lg text-gray-700`}></i>
            </button>
            <div>
                <h1 className="text-lg font-black text-gray-900 leading-tight">
                    {isRTL ? "مساعد مواصلة" : "Mowasla AI Assistant"}
                </h1>
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">AI Online</span>
                </div>
            </div>
        </div>
        <button 
            onClick={() => {
                if (viewState === 'CHAT') setViewState('HISTORY');
                else setViewState('CHAT');
            }}
            className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
        >
            <i className={`fas ${viewState === 'CHAT' ? 'fa-history' : 'fa-comment-dots'}`}></i>
        </button>
      </div>

      <div className="flex-1 overflow-hidden relative flex flex-col">
          {viewState === 'HISTORY' ? (
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] px-2 mb-4">
                      {isRTL ? "المحادثات السابقة" : "Recent Conversations"}
                  </h2>
                  {tickets.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-64 text-gray-300">
                          <i className="fas fa-comment-slash text-4xl mb-4 opacity-20"></i>
                          <p className="font-bold">{isRTL ? "لا توجد سجلات" : "No history found"}</p>
                      </div>
                  ) : (
                      tickets.map(ticket => (
                          <div 
                            key={ticket.id} 
                            onClick={() => { setActiveTicket(ticket); setViewState('CHAT'); }} 
                            className="bg-white p-4 rounded-[24px] shadow-sm border border-gray-100 cursor-pointer hover:border-[#FFC90E] transition-all active:scale-[0.98]"
                          >
                              <div className="flex justify-between items-start">
                                  <h3 className="font-bold text-gray-900 truncate pr-4">{ticket.subject}</h3>
                                  <span className="text-[9px] font-black text-gray-400 bg-gray-50 px-2 py-1 rounded-md uppercase">
                                      {new Date(ticket.lastMessageAt?.toDate?.() || ticket.lastMessageAt).toLocaleDateString()}
                                  </span>
                              </div>
                              <div className="mt-3 flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center text-[10px] text-blue-500">
                                      <i className="fas fa-robot"></i>
                                  </div>
                                  <span className="text-xs text-gray-400 font-medium">Mowasla Support Bot</span>
                              </div>
                          </div>
                      ))
                  )}
              </div>
          ) : (
              <div className="flex-1 flex flex-col overflow-hidden bg-[#EFEAE2]">
                  {/* Pattern Background */}
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#4a5568 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 relative z-10">
                      {messages.map((msg) => {
                          const isAI = msg.isAdmin || msg.senderId === 'support_bot' || msg.senderId === 'ai';
                          return (
                              <div key={msg.id} className={`flex w-full ${!isAI ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                                  <div className={`max-w-[85%] flex flex-col ${!isAI ? 'items-end' : 'items-start'}`}>
                                      <div 
                                        className={`px-4 py-3 rounded-2xl text-sm shadow-sm transition-all ${
                                            !isAI 
                                                ? 'bg-[#FFC90E] text-black rounded-br-none font-bold' 
                                                : 'bg-white text-gray-800 rounded-bl-none font-medium border border-gray-100'
                                        }`}
                                      >
                                          {msg.audioUrl ? (
                                              <audio controls src={msg.audioUrl} className="h-8 w-40" />
                                          ) : (
                                              msg.text
                                          )}
                                      </div>
                                      <span className="text-[9px] text-gray-400 mt-1 font-bold uppercase tracking-tighter">
                                          {msg.timestamp ? formatTime(msg.timestamp) : '...'}
                                      </span>
                                  </div>
                              </div>
                          );
                      })}
                      {isSending && (
                          <div className="flex justify-start animate-pulse">
                              <div className="bg-white/80 backdrop-blur-sm px-4 py-2 rounded-2xl rounded-bl-none text-xs text-gray-400 font-bold border border-gray-100 italic">
                                 AI is thinking...
                              </div>
                          </div>
                      )}
                      <div ref={messagesEndRef} className="h-4" />
                  </div>

                  {/* Chat Input */}
                  <div className="p-3 bg-white border-t border-gray-100 pb-safe relative z-20 shadow-xl">
                      <div className="flex items-center gap-2 bg-gray-100 rounded-[28px] px-2 py-1.5 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#FFC90E]/30 transition-all">
                          <input 
                            value={newMessageText} 
                            onChange={e => setNewMessageText(e.target.value)} 
                            onKeyDown={e => e.key === 'Enter' && handleSendMessage()} 
                            placeholder={isRTL ? "اسألني أي شيء عن مواصلة..." : "Ask me anything about Mowasla..."} 
                            className="flex-1 bg-transparent outline-none text-sm px-3 py-2 font-bold text-gray-800 placeholder:text-gray-400" 
                          />
                          <button 
                            onClick={handleSendMessage} 
                            disabled={!newMessageText.trim() || isSending} 
                            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-md active:scale-90 ${
                                newMessageText.trim() ? 'bg-[#FFC90E] text-black' : 'bg-gray-200 text-gray-400'
                            }`}
                          >
                              {isSending ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-paper-plane"></i>}
                          </button>
                      </div>
                  </div>
              </div>
          )}
      </div>
    </div>
  );
}
