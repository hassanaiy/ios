import { AudioPlayer } from './AudioPlayer';

import React, { useEffect, useState, useRef } from 'react';
import { sendMessage, subscribeToRideMessages, uploadFile, sendSupportMessage, subscribeToSupportMessages, subscribeToAppSettings, DEFAULT_SUPPORT_WHATSAPP, formatWhatsAppUrl } from '../services/firebaseBridge';
import { ChatMessage } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { HapticsService } from '../services/haptics';

interface ChatPanelProps {
  rideId: string;
  currentUserId: string;
  otherUserName: string;
  otherUserPhone?: string;
  onClose: () => void;
  isPassenger: boolean;
  passengerId?: string;
  isAdmin?: boolean;
  customCollection?: string;
  isSupportChat?: boolean;
}

const QuickReplies = ({ onSend, isSupportChat, isAdmin }: { onSend: (text: string) => void, isSupportChat?: boolean, isAdmin?: boolean }) => {
    const { t, isRTL } = useLanguage();
    
    let replies: string[] = [];

    if (isSupportChat) {
        if (isAdmin) {
            replies = isRTL ? [
                'مرحباً بك، كيف يمكنني مساعدتك؟',
                'برجاء توضيح المشكلة',
                'تم حل المشكلة'
            ] : [
                'Hello, how can I help?',
                'Please clarify the issue',
                'Issue resolved'
            ];
        } else {
            replies = isRTL ? [
                'لدي مشكلة في الدفع',
                'أريد الاستفسار عن شيء',
                'تم حل المشكلة، شكراً',
                'نعم'
            ] : [
                'I have a payment issue',
                'I have a question',
                'Issue resolved, thanks',
                'Yes'
            ];
        }
    } else {
        replies = [
            t('qr_on_my_way'),
            t('qr_arrived'),
            t('qr_ok_thanks'),
        ];
    }

    return (
        <div className="px-3 pb-3 flex gap-2 overflow-x-auto hide-scrollbar">
            {replies.map(text => (
                <button 
                    key={text}
                    onClick={() => { HapticsService.light(); onSend(text); }}
                    className="bg-gray-100 border border-transparent text-gray-700 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap shadow-sm hover:bg-gray-200 active:scale-95 transition-all"
                >
                    {text}
                </button>
            ))}
        </div>
    );
};

export const ChatPanel: React.FC<ChatPanelProps> = ({ rideId, currentUserId, otherUserName, otherUserPhone, onClose, isPassenger, isAdmin, customCollection, isSupportChat }) => {
  const { t, isRTL } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isSending, setIsSending] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [mimeType, setMimeType] = useState('audio/webm');
  const shouldSendRecordingRef = useRef<boolean>(false);
  const prevMessagesLengthRef = useRef(0);
  const [supportWhatsapp, setSupportWhatsapp] = useState<string>(DEFAULT_SUPPORT_WHATSAPP);

  useEffect(() => {
    if (!isSupportChat) return;
    const unsub = subscribeToAppSettings((settings) => {
      if (settings?.supportWhatsappNumber && settings.supportWhatsappNumber.trim()) {
        setSupportWhatsapp(settings.supportWhatsappNumber.trim());
      } else {
        setSupportWhatsapp(DEFAULT_SUPPORT_WHATSAPP);
      }
    });
    return () => unsub();
  }, [isSupportChat]);

  useEffect(() => {
    // Detect supported mime type
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const types = isIOS ? ['audio/mp4', 'audio/webm', 'audio/ogg', 'audio/wav'] : ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/wav'];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        setMimeType(type);
        break;
      }
    }
    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3");
  }, []);

  useEffect(() => {
    if (!rideId) return;
    const unsubFunction = customCollection === 'supportTickets' ? subscribeToSupportMessages : subscribeToRideMessages;
    
    const unsubscribe = unsubFunction(rideId, (msgs) => {
      if (msgs.length > prevMessagesLengthRef.current && prevMessagesLengthRef.current > 0) {
          const lastMsg = msgs[msgs.length - 1];
          if (lastMsg.senderId !== currentUserId) {
              audioRef.current?.play().catch(() => {});
          }
      }
      prevMessagesLengthRef.current = msgs.length;
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [rideId, currentUserId, customCollection]);

  useEffect(() => {
    if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
      return () => {
          if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      };
  }, []);

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim()) return;
    
    HapticsService.light();
    setInputText(''); 
    setIsSending(true);
    
    try {
        if (customCollection === 'supportTickets') {
            await sendSupportMessage(rideId, text, currentUserId, !!isAdmin);
        } else {
            await sendMessage(rideId, currentUserId, text, false);
        }
    } catch (e) {
        console.error("Send failed", e);
        setInputText(text);
    } finally {
        setIsSending(false);
    }
  };

  const startRecording = async () => {
    if (isSending) return;
    HapticsService.medium();
    
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Microphone API not supported or available");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let mediaRecorder;
      
      try {
          const options = { mimeType };
          mediaRecorder = new MediaRecorder(stream, MediaRecorder.isTypeSupported(mimeType) ? options : undefined);
      } catch (e) {
          console.warn("MediaRecorder with options failed, falling back to default", e);
          mediaRecorder = new MediaRecorder(stream);
      }
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      shouldSendRecordingRef.current = false;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingDuration(0);
      
      recordingTimerRef.current = setInterval(() => {
          setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.warn("Error accessing microphone:", error);
      alert(t ? t('mic_access_denied') : "Microphone access denied or not available.");
    }
  };

  const stopRecordingAndSend = () => {
    if (mediaRecorderRef.current && isRecording) {
      shouldSendRecordingRef.current = true;
      const recorder = mediaRecorderRef.current;
      let onstopFired = false;
      const processRecording = async () => {
          if (onstopFired) return;
          onstopFired = true;
          console.log("processRecording started");
          await new Promise(r => setTimeout(r, 500));
          if (!shouldSendRecordingRef.current) {
              cleanupRecording();
              return;
          }
          
          const actualMimeType = recorder.mimeType || mimeType;
          const baseMimeType = actualMimeType.split(';')[0];
          const extension = baseMimeType.includes('webm') ? 'webm' : 
                           baseMimeType.includes('ogg') ? 'ogg' : 
                           baseMimeType.includes('mp4') ? 'm4a' : 
                           baseMimeType.includes('mpeg') ? 'mp3' : 'wav';
                           
          const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });
          cleanupRecording();
          
          if (audioBlob.size < 10) {
              console.warn("Audio blob too small, likely empty. Skipping send."); alert("Recording too short or failed (size: " + audioBlob.size + ")");
              setIsSending(false);
              return;
          }

          setIsSending(true);
          HapticsService.success();
          try {
              const path = customCollection === 'supportTickets'
                  ? `supportTickets/${rideId}/voice_messages/${Date.now()}.${extension}`
                  : `rides/${rideId}/voice_messages/${Date.now()}.${extension}`;
              const audioUrl = await uploadFile(audioBlob, path);
              
              if (customCollection === 'supportTickets') {
                  await sendSupportMessage(rideId, '', currentUserId, !!isAdmin, audioUrl);
              } else {
                  await sendMessage(rideId, currentUserId, '', false, audioUrl);
              }
          } catch (e) {
              console.error("Failed to send voice message", e); alert(`${t("err_send_failed", "Failed to send", "فشل في الإرسال")} ${e.message}`);
          } finally {
              setIsSending(false);
          }
      };

      recorder.onstop = processRecording;
      
      
      try {
          if (recorder.state !== "inactive") {
              recorder.stop();
              setTimeout(() => {
                  if (!onstopFired) {
                      console.warn("Fallback: onstop did not fire");
                      processRecording();
                  }
              }, 600);
          } else {
              processRecording();
          }
      } catch (e) {}
    }
  };

  const cancelRecording = () => {
      shouldSendRecordingRef.current = false;
      if (mediaRecorderRef.current && isRecording) {
          mediaRecorderRef.current.onstop = null; // Clear any existing onstop
          try {
              if (mediaRecorderRef.current.state !== "inactive") {
                  mediaRecorderRef.current.stop();
              }
          } catch (e) {}
          cleanupRecording();
      }
  };

  const cleanupRecording = () => {
      setIsRecording(false);
      setRecordingDuration(0);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current) {
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
  };

  const formatTime = (timestamp: any) => {
      if (!timestamp) return '';
      try {
          let date;
          if (typeof timestamp.toDate === 'function') {
              date = timestamp.toDate();
          } else if (typeof timestamp === 'number') {
              date = new Date(timestamp);
          } else if (typeof timestamp === 'string') {
              date = new Date(timestamp);
          } else {
              // Handle potential pending FieldValue or other objects
              return '';
          }
          
          if (isNaN(date.getTime())) return '';
          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } catch {
          return '';
      }
  };

  const formatDuration = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-gray-50 animate-slide-up">
      <div className="glass-card shadow-sm shrink-0 z-10 pt-safe rounded-b-3xl border-b border-glass-border" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 overflow-hidden">
                <button onClick={() => { HapticsService.light(); onClose(); }} className="w-10 h-10 hover:bg-black/5 rounded-full transition-colors flex items-center justify-center text-gray-600 active:scale-90">
                  <i className={`fas ${isRTL ? 'fa-arrow-right' : 'fa-arrow-left'}`}></i>
                </button>
                <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-blue-100/50 backdrop-blur-md text-blue-600 flex items-center justify-center font-bold text-lg border-2 border-white/50 shadow-sm">
                        {(otherUserName || 'C').charAt(0).toUpperCase()}
                    </div>
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-[0_0_8px_rgba(34,197,94,0.4)] animate-pulse"></div>
                </div>
                <div className="min-w-0 flex-1">
                    <h2 className="font-bold text-base leading-tight truncate text-gray-900">{otherUserName || 'Chat'}</h2>
                    <span className="text-[10px] text-green-600 font-bold truncate block tracking-wide uppercase">{t('online')}</span>
                </div>
            </div>
            
            <div className="flex items-center gap-2">
                {isSupportChat && !isAdmin && (
                    <a
                      href={formatWhatsAppUrl(supportWhatsapp)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-10 px-3 bg-[#25D366] text-white rounded-full flex items-center justify-center gap-1.5 shadow-sm hover:bg-[#1ebe5d] active:scale-95 transition-all text-xs font-black"
                      title={isRTL ? `تواصل عبر واتساب (${supportWhatsapp})` : `Message on WhatsApp (${supportWhatsapp})`}
                    >
                      <i className="fab fa-whatsapp text-base"></i>
                      <span className="hidden sm:inline">{isRTL ? 'واتساب' : 'WhatsApp'}</span>
                    </a>
                )}
                {otherUserPhone && (
                    <a href={`tel:${otherUserPhone}`} onClick={() => HapticsService.light()} className="w-10 h-10 flex items-center justify-center rounded-full bg-black/5 backdrop-blur-md text-gray-700 hover:bg-black/10 transition-colors active:scale-90">
                        <i className="fas fa-phone"></i>
                    </a>
                )}
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 relative">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#4a5568 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

        {messages.map((msg) => {
          const isSystem = msg.isSystem || msg.senderId === 'system';
          const isMe = msg.senderId === currentUserId;

          if (isSystem) {
              return (
                  <div key={msg.id || Math.random()} className="flex justify-center py-2 animate-fade-in">
                      <div className="bg-gray-900/40 backdrop-blur-sm text-white text-[10px] font-bold px-4 py-1.5 rounded-full shadow-sm max-w-xs text-center whitespace-pre-wrap">
                          {msg.text}
                      </div>
                  </div>
              );
          }

          return (
            <div 
                key={msg.id || Math.random()} 
                className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} animate-fade-in-up`} 
                dir="ltr"
            >
              <div 
                className={`max-w-[85%] sm:max-w-[70%] relative flex flex-col shadow-sm ${
                    isMe 
                      ? 'bg-[#FFC90E] rounded-l-2xl rounded-tr-2xl rounded-br-none text-black' 
                      : 'bg-white rounded-r-2xl rounded-tl-2xl rounded-bl-none text-gray-800'
                }`}
              >
                <div className={`px-3 pt-2 pb-1`}>
                    {msg.audioUrl ? (
                        <AudioPlayer src={msg.audioUrl} isMe={isMe} />
                    ) : (
                        <p className="text-sm leading-snug whitespace-pre-wrap break-words" dir="auto">{(msg.text || '').toString()}</p>
                    )}
                </div>

                <div className={`flex items-center justify-end gap-1 px-2 pb-1 opacity-60`}>
                    <span className="text-[9px] font-medium whitespace-nowrap">{formatTime(msg.timestamp)}</span>
                    {isMe && <i className="fas fa-check-double text-[10px]"></i>}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} className="h-2" />
      </div>

      <div className="glass-panel px-2 py-2 shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-20 rounded-t-3xl" dir={isRTL ? 'rtl' : 'ltr'}>
        {(!isPassenger || isSupportChat || customCollection === 'supportTickets') && !isRecording && <QuickReplies onSend={handleSend} isSupportChat={isSupportChat || customCollection === 'supportTickets'} isAdmin={isAdmin} />}
        
        {isRecording ? (
            <div className="flex items-center justify-between gap-4 bg-red-50 p-3 rounded-full border border-red-100 animate-pulse mx-2 mb-safe">
                <div className="flex items-center gap-3 text-red-600 font-black pl-3">
                    <div className="w-3 h-3 bg-red-600 rounded-full animate-ping shadow-[0_0_8px_rgba(220,38,38,0.5)]"></div>
                    <span>{formatDuration(recordingDuration)}</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => { HapticsService.light(); cancelRecording(); }} className="text-gray-500 font-bold text-xs uppercase px-4 hover:text-gray-800 active:scale-95">{t('cancel')}</button>
                    <button onClick={stopRecordingAndSend} className="bg-gradient-to-br from-red-500 to-red-600 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-[0_4px_15px_rgba(220,38,38,0.4)] active:scale-90 transition-transform">
                        <i className="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        ) : (
            <div className="flex items-end gap-2 pb-safe px-2">
                <div className="flex-1 bg-black/5 backdrop-blur-md rounded-[24px] flex items-center px-4 py-3 min-h-[50px] border border-glass-border focus-within:border-[#FFC90E] transition-all focus-within:shadow-[0_0_15px_rgba(255,201,14,0.1)]">
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder={t('type_message')}
                        className="flex-1 bg-transparent outline-none text-sm w-full placeholder:text-gray-400 text-gray-800"
                        dir="auto"
                    />
                </div>
                
                {inputText.trim() ? (
                    <button 
                        onClick={() => handleSend()}
                        disabled={isSending}
                        className="w-12 h-12 rounded-full flex items-center justify-center bg-[#FFC90E] text-black shadow-md transition-all transform hover:scale-105 active:scale-95"
                    >
                        {isSending ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-paper-plane text-lg"></i>}
                    </button>
                ) : (
                    <button 
                        onClick={startRecording}
                        disabled={isSending}
                        className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-100 text-gray-500 shadow-sm transition-all active:scale-90 active:bg-red-50 hover:bg-gray-200"
                    >
                        {isSending ? <i className="fas fa-spinner fa-spin text-gray-400"></i> : <i className="fas fa-microphone text-lg"></i>}
                    </button>
                )}
            </div>
        )}
      </div>
    </div>
  );
};
