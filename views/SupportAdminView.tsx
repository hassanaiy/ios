import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { SupportTicket, User, Driver, UserRole } from '../types';
import {
  subscribeToAllSupportTickets,
  subscribeToAllAdminChats,
  subscribeToAllUsers,
  subscribeToSupportMessages,
  subscribeToRideMessages,
  sendSupportMessage,
  sendMessage,
  markSupportConversationRead,
  updateSupportConversationStatus,
  uploadFile,
  subscribeToAppSettings,
  updateSupportWhatsappNumber,
  DEFAULT_SUPPORT_WHATSAPP,
  formatWhatsAppUrl
} from '../services/firebaseBridge';
import { AudioPlayer } from '../components/AudioPlayer';

interface UnifiedConversation {
  key: string;
  id: string;
  type: 'ticket' | 'chat';
  userId: string;
  userName: string;
  userPhone: string;
  userEmail?: string;
  userAvatar?: string;
  userRole: UserRole | 'UNKNOWN';
  vehicleInfo?: string;
  pendingFees?: number;
  walletBalance?: number;
  subject: string;
  lastMessage: string;
  lastTimestampMs: number;
  status: 'open' | 'pending' | 'resolved' | 'closed';
  isUnread: boolean;
  unreadCount: number;
  lastSenderId?: string;
}

const parseTimestampMs = (ts: any): number => {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (typeof ts?.toMillis === 'function') return ts.toMillis();
  if (typeof ts?.toDate === 'function') return ts.toDate().getTime();
  if (typeof ts?.seconds === 'number') return ts.seconds * 1000;
  const parsed = new Date(ts).getTime();
  return isNaN(parsed) ? 0 : parsed;
};

export const SupportAdminView: React.FC = () => {
  const { isRTL } = useLanguage();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, User | Driver>>({});

  // Filtering & Sorting State
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'pending' | 'resolved'>('all');
  const [channelFilter, setChannelFilter] = useState<'all' | 'chat' | 'ticket'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Conversation State
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
  const prevUnreadTotalRef = useRef<number>(0);

  // Global Support WhatsApp Number State
  const [supportWhatsapp, setSupportWhatsapp] = useState<string>(DEFAULT_SUPPORT_WHATSAPP);
  const [whatsappInput, setWhatsappInput] = useState<string>(DEFAULT_SUPPORT_WHATSAPP);
  const [isSavingWhatsapp, setIsSavingWhatsapp] = useState(false);
  const [whatsappSavedFeedback, setWhatsappSavedFeedback] = useState(false);
  const isEditingWhatsappRef = useRef(false);

  useEffect(() => {
    notificationAudioRef.current = new Audio(
      'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3'
    );
  }, []);

  useEffect(() => {
    const unsubSettings = subscribeToAppSettings((settings) => {
      const liveNum =
        settings?.supportWhatsappNumber && settings.supportWhatsappNumber.trim()
          ? settings.supportWhatsappNumber.trim()
          : DEFAULT_SUPPORT_WHATSAPP;
      setSupportWhatsapp(liveNum);
      if (!isEditingWhatsappRef.current) {
        setWhatsappInput(liveNum);
      }
    });
    return () => unsubSettings();
  }, []);

  const handleSaveSupportWhatsapp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = whatsappInput.trim() || DEFAULT_SUPPORT_WHATSAPP;
    setIsSavingWhatsapp(true);
    try {
      await updateSupportWhatsappNumber(trimmed);
      setSupportWhatsapp(trimmed);
      setWhatsappInput(trimmed);
      isEditingWhatsappRef.current = false;
      setWhatsappSavedFeedback(true);
      setTimeout(() => setWhatsappSavedFeedback(false), 3500);
    } catch (err) {
      console.error('Failed to update support WhatsApp number:', err);
    } finally {
      setIsSavingWhatsapp(false);
    }
  };

  // Subscribe to Users, Tickets, and Direct Admin Chats
  useEffect(() => {
    const unsubUsers = subscribeToAllUsers((allUsers) => {
      const map: Record<string, User | Driver> = {};
      allUsers.forEach((u) => {
        if (u.id) map[u.id] = u;
      });
      setUsersMap(map);
    });

    const unsubTickets = subscribeToAllSupportTickets((allTickets) => {
      setTickets(allTickets);
    });

    const unsubChats = subscribeToAllAdminChats((allChats) => {
      setChats(allChats);
    });

    return () => {
      unsubUsers();
      unsubTickets();
      unsubChats();
    };
  }, []);

  // Build unified, user-enriched conversation list
  const conversations: UnifiedConversation[] = useMemo(() => {
    const list: UnifiedConversation[] = [];

    // 1. Direct Chats (rides/admin_chat_{userId})
    chats.forEach((chat) => {
      const extractedUserId = chat.userId || chat.passengerId || String(chat.id || '').replace('admin_chat_', '');
      const userObj = usersMap[extractedUserId] as Driver | undefined;

      const rawStatus = chat.status || 'open';
      const normalizedStatus: 'open' | 'pending' | 'resolved' | 'closed' =
        rawStatus === 'resolved' || rawStatus === 'closed'
          ? rawStatus
          : rawStatus === 'pending'
          ? 'pending'
          : 'open';

      const isResolved = normalizedStatus === 'resolved' || normalizedStatus === 'closed';
      const lastFromCustomer =
        Boolean(chat.lastSenderId) &&
        chat.lastSenderId !== 'SYSTEM_ADMIN' &&
        chat.lastSenderId !== 'admin';

      const isUnread =
        !isResolved &&
        (chat.unreadByAdmin === true ||
          (typeof chat.adminUnreadCount === 'number' && chat.adminUnreadCount > 0) ||
          (chat.unreadByAdmin === undefined && lastFromCustomer));

      const unreadCount =
        typeof chat.adminUnreadCount === 'number' && chat.adminUnreadCount > 0
          ? chat.adminUnreadCount
          : isUnread
          ? 1
          : 0;

      const userName =
        userObj?.name ||
        chat.userName ||
        chat.passengerName ||
        (isRTL ? `عميل (${extractedUserId.slice(0, 6)})` : `Customer (${extractedUserId.slice(0, 6)})`);

      const userPhone = userObj?.phone || chat.userPhone || chat.phone || '---';
      const userRole = userObj?.role || (userObj?.vehiclePlate ? UserRole.DRIVER : 'UNKNOWN');
      const vehicleInfo =
        userObj?.vehicleBrand || userObj?.vehicleModel || userObj?.vehiclePlate
          ? `${userObj.vehicleBrand || ''} ${userObj.vehicleModel || ''} ${
              userObj.vehiclePlate ? `(${userObj.vehiclePlate})` : ''
            }`.trim()
          : undefined;

      list.push({
        key: `chat:${chat.id}`,
        id: chat.id,
        type: 'chat',
        userId: extractedUserId,
        userName,
        userPhone,
        userEmail: userObj?.email,
        userAvatar: userObj?.avatar || userObj?.personalPhotoUrl,
        userRole,
        vehicleInfo,
        pendingFees: userObj?.pendingFees,
        walletBalance: userObj?.walletBalance,
        subject: isRTL ? 'محادثة خدمة العملاء المباشرة' : 'Direct Customer Support Chat',
        lastMessage: chat.lastMessage || (isRTL ? 'محادثة جديدة' : 'New conversation'),
        lastTimestampMs: parseTimestampMs(chat.lastMessageAt || chat.createdAt || chat.timestamp),
        status: normalizedStatus,
        isUnread,
        unreadCount,
        lastSenderId: chat.lastSenderId
      });
    });

    // 2. Support Tickets (supportTickets/{ticketId})
    tickets.forEach((ticket: any) => {
      const uid = ticket.userId || '';
      const userObj = usersMap[uid] as Driver | undefined;

      const rawStatus = ticket.status || 'open';
      const normalizedStatus: 'open' | 'pending' | 'resolved' | 'closed' =
        rawStatus === 'resolved' || rawStatus === 'closed'
          ? rawStatus
          : rawStatus === 'pending'
          ? 'pending'
          : 'open';

      const isResolved = normalizedStatus === 'resolved' || normalizedStatus === 'closed';
      const lastFromCustomer =
        Boolean(ticket.lastSenderId) &&
        ticket.lastSenderId !== 'SYSTEM_ADMIN' &&
        ticket.lastSenderId !== 'admin' &&
        ticket.lastSenderId !== 'support_bot' &&
        ticket.lastSenderId !== 'ai';

      const isUnread =
        !isResolved &&
        (ticket.unreadByAdmin === true ||
          (typeof ticket.adminUnreadCount === 'number' && ticket.adminUnreadCount > 0) ||
          (ticket.unreadByAdmin === undefined && lastFromCustomer));

      const unreadCount =
        typeof ticket.adminUnreadCount === 'number' && ticket.adminUnreadCount > 0
          ? ticket.adminUnreadCount
          : isUnread
          ? 1
          : 0;

      const userName =
        userObj?.name ||
        ticket.userName ||
        (isRTL ? `مستخدم (${uid.slice(0, 6)})` : `User (${uid.slice(0, 6)})`);

      const userPhone = userObj?.phone || ticket.userPhone || '---';
      const userRole =
        userObj?.role ||
        (ticket.subject === 'Driver Fees Payment' || userObj?.vehiclePlate ? UserRole.DRIVER : 'UNKNOWN');

      const vehicleInfo =
        userObj?.vehicleBrand || userObj?.vehicleModel || userObj?.vehiclePlate
          ? `${userObj.vehicleBrand || ''} ${userObj.vehicleModel || ''} ${
              userObj.vehiclePlate ? `(${userObj.vehiclePlate})` : ''
            }`.trim()
          : undefined;

      const localizedSubject =
        ticket.subject === 'Driver Fees Payment'
          ? isRTL
            ? 'تسوية رسوم الكابتن (Driver Fees)'
            : 'Driver Fees Payment'
          : ticket.subject === 'AI Support Chat'
          ? isRTL
            ? 'محادثة المساعد الذكي والدعم'
            : 'AI & Customer Support Ticket'
          : ticket.subject || (isRTL ? 'تذكرة دعم فني' : 'Support Ticket');

      list.push({
        key: `ticket:${ticket.id}`,
        id: ticket.id,
        type: 'ticket',
        userId: uid,
        userName,
        userPhone,
        userEmail: userObj?.email,
        userAvatar: userObj?.avatar || userObj?.personalPhotoUrl,
        userRole,
        vehicleInfo,
        pendingFees: userObj?.pendingFees,
        walletBalance: userObj?.walletBalance,
        subject: localizedSubject,
        lastMessage: ticket.lastMessage || localizedSubject,
        lastTimestampMs: parseTimestampMs(ticket.lastMessageAt || ticket.createdAt),
        status: normalizedStatus,
        isUnread,
        unreadCount,
        lastSenderId: ticket.lastSenderId
      });
    });

    // Sort: Unread first -> Open/Pending next -> Resolved last, then by timestamp descending
    list.sort((a, b) => {
      if (a.isUnread !== b.isUnread) return a.isUnread ? -1 : 1;
      const aResolved = a.status === 'resolved' || a.status === 'closed';
      const bResolved = b.status === 'resolved' || b.status === 'closed';
      if (aResolved !== bResolved) return aResolved ? 1 : -1;
      return b.lastTimestampMs - a.lastTimestampMs;
    });

    return list;
  }, [chats, tickets, usersMap, isRTL]);

  // Play notification sound when total unread count increases
  const stats = useMemo(() => {
    const total = conversations.length;
    const unread = conversations.filter((c) => c.isUnread).length;
    const pending = conversations.filter((c) => c.status !== 'resolved' && c.status !== 'closed').length;
    const resolved = conversations.filter((c) => c.status === 'resolved' || c.status === 'closed').length;
    return { total, unread, pending, resolved };
  }, [conversations]);

  useEffect(() => {
    if (stats.unread > prevUnreadTotalRef.current && prevUnreadTotalRef.current > 0) {
      notificationAudioRef.current?.play().catch(() => {});
    }
    prevUnreadTotalRef.current = stats.unread;
  }, [stats.unread]);

  // Filtered conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      if (channelFilter !== 'all' && c.type !== channelFilter) return false;
      if (statusFilter === 'unread' && !c.isUnread) return false;
      if (statusFilter === 'pending' && (c.status === 'resolved' || c.status === 'closed')) return false;
      if (statusFilter === 'resolved' && c.status !== 'resolved' && c.status !== 'closed') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = c.userName.toLowerCase().includes(q);
        const matchPhone = c.userPhone.toLowerCase().includes(q);
        const matchSubject = c.subject.toLowerCase().includes(q);
        const matchMsg = c.lastMessage.toLowerCase().includes(q);
        const matchId = c.userId.toLowerCase().includes(q) || c.id.toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchSubject && !matchMsg && !matchId) return false;
      }
      return true;
    });
  }, [conversations, channelFilter, statusFilter, searchQuery]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.key === selectedKey) || null,
    [conversations, selectedKey]
  );

  // Auto-select first conversation on desktop if none selected
  useEffect(() => {
    if (!selectedKey && filteredConversations.length > 0) {
      setSelectedKey(filteredConversations[0].key);
    }
  }, [filteredConversations, selectedKey]);

  // Subscribe to messages for the active conversation & mark as read
  useEffect(() => {
    if (!activeConversation) {
      setMessages([]);
      return;
    }

    setLoadingMessages(true);
    markSupportConversationRead(activeConversation.type, activeConversation.id);

    const unsub =
      activeConversation.type === 'ticket'
        ? subscribeToSupportMessages(activeConversation.id, (msgs) => {
            setMessages(msgs);
            setLoadingMessages(false);
          })
        : subscribeToRideMessages(activeConversation.id, (msgs) => {
            setMessages(msgs);
            setLoadingMessages(false);
          });

    return () => unsub();
  }, [activeConversation?.id, activeConversation?.type]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelectConversation = (conv: UnifiedConversation) => {
    setSelectedKey(conv.key);
    if (conv.isUnread) {
      markSupportConversationRead(conv.type, conv.id);
    }
  };

  const handleSendReply = async (customText?: string) => {
    if (!activeConversation) return;
    const text = (customText ?? replyText).trim();
    if (!text || isSending) return;

    if (!customText) setReplyText('');
    setIsSending(true);
    try {
      if (activeConversation.type === 'ticket') {
        await sendSupportMessage(activeConversation.id, text, 'SYSTEM_ADMIN', true);
      } else {
        await sendMessage(activeConversation.id, 'SYSTEM_ADMIN', text, false);
      }
      await markSupportConversationRead(activeConversation.type, activeConversation.id);
    } catch (err) {
      console.error('Failed to send admin reply:', err);
      if (!customText) setReplyText(text);
    } finally {
      setIsSending(false);
    }
  };

  const handleToggleStatus = async (
    conv: UnifiedConversation,
    nextStatus: 'open' | 'pending' | 'resolved'
  ) => {
    setUpdatingStatusId(conv.key);
    try {
      await updateSupportConversationStatus(conv.type, conv.id, nextStatus);
    } catch (err) {
      console.error('Failed to update conversation status:', err);
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleCopyPhone = (phone: string) => {
    if (!phone || phone === '---') return;
    navigator.clipboard?.writeText(phone);
    setCopiedPhone(phone);
    setTimeout(() => setCopiedPhone(null), 1800);
  };

  // Voice Note Recording for Admin
  const startVoiceRecording = async () => {
    if (!activeConversation || isSending) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.start(1000);
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      // Microphone not available
    }
  };

  const stopAndSendVoiceRecording = () => {
    if (!mediaRecorderRef.current || !isRecording || !activeConversation) return;
    const recorder = mediaRecorderRef.current;
    const conv = activeConversation;

    recorder.onstop = async () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      setIsRecording(false);
      setRecordingSeconds(0);
      recorder.stream.getTracks().forEach((t) => t.stop());

      const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      if (blob.size < 20) return;

      setIsSending(true);
      try {
        const ext = (recorder.mimeType || '').includes('mp4') ? 'm4a' : 'webm';
        const storagePath =
          conv.type === 'ticket'
            ? `supportTickets/${conv.id}/voice_messages/${Date.now()}.${ext}`
            : `rides/${conv.id}/voice_messages/${Date.now()}.${ext}`;
        const audioUrl = await uploadFile(blob, storagePath);
        if (conv.type === 'ticket') {
          await sendSupportMessage(conv.id, '', 'SYSTEM_ADMIN', true, audioUrl);
        } else {
          await sendMessage(conv.id, 'SYSTEM_ADMIN', '', false, audioUrl);
        }
      } catch (err) {
        console.error('Voice message upload failed:', err);
      } finally {
        setIsSending(false);
      }
    };

    recorder.stop();
  };

  const cancelVoiceRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null;
      try {
        mediaRecorderRef.current.stop();
      } catch {}
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const formatDateTime = (ms: number) => {
    if (!ms) return isRTL ? 'الآن' : 'Just now';
    const d = new Date(ms);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} • ${d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })}`;
  };

  const quickReplies = isRTL
    ? [
        'مرحباً بك في خدمة عملاء مواصلة، كيف يمكنني مساعدتك؟',
        'تم مراجعة طلبك وحل المشكلة بنجاح ✓',
        'تم تأكيد الدفع وتفعيل حسابك، شكراً لك!',
        'برجاء إرسال تفاصيل أكثر أو صورة الإيصال للمراجعة',
        'تم تحويل طلبك للقسم المختص وجاري المتابعة فوراً'
      ]
    : [
        'Welcome to Mowasla Support! How can I help you today?',
        'Your request has been reviewed and resolved ✓',
        'Payment confirmed and your account is now active!',
        'Please share more details or a screenshot of the receipt',
        'We are actively looking into this for you right now'
      ];

  return (
    <div className="space-y-6 animate-fade-in" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Official Support WhatsApp Number Control Bar */}
      <form
        onSubmit={handleSaveSupportWhatsapp}
        className="bg-white rounded-3xl border border-emerald-100 shadow-xs p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
      >
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#25D366] text-white flex items-center justify-center text-2xl shadow-md shadow-emerald-500/20 shrink-0">
            <i className="fab fa-whatsapp"></i>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-black text-gray-900">
                {isRTL
                  ? 'رقم واتساب خدمة العملاء الرسمي'
                  : 'Official Customer Support WhatsApp Number'}
              </h3>
              <span className="text-xs font-bold text-emerald-700" dir="ltr">
                · {supportWhatsapp}
              </span>
            </div>
            <p className="text-xs font-bold text-gray-500 mt-0.5">
              {isRTL
                ? 'يظهر هذا الرقم فوراً لجميع الركاب والكباتن عند الضغط على "تحدث معنا" في التطبيق.'
                : 'Appears immediately for all passengers and captains when pressing "Support" in the app.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
          <div className="relative flex-1 sm:w-64">
            <i className="fab fa-whatsapp absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-600 text-sm"></i>
            <input
              type="tel"
              dir="ltr"
              value={whatsappInput}
              onFocus={() => {
                isEditingWhatsappRef.current = true;
              }}
              onBlur={() => {
                isEditingWhatsappRef.current = false;
              }}
              onChange={(e) => setWhatsappInput(e.target.value)}
              placeholder="+201024419931"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 focus:bg-white focus:border-emerald-500 outline-none font-mono font-black text-sm text-gray-900 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={isSavingWhatsapp || !whatsappInput.trim()}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs shadow-sm transition-all flex items-center gap-2 active:scale-95 shrink-0 cursor-pointer"
          >
            {isSavingWhatsapp ? (
              <i className="fas fa-spinner fa-spin"></i>
            ) : (
              <i className="fas fa-save"></i>
            )}
            <span>
              {isRTL ? 'حفظ وتحديث فوري' : 'Save & Update Immediately'}
            </span>
          </button>

          <a
            href={formatWhatsAppUrl(supportWhatsapp)}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs transition-colors flex items-center gap-1.5 shrink-0"
            title={isRTL ? 'تجربة فتح المحادثة على واتساب' : 'Test WhatsApp link'}
          >
            <i className="fas fa-external-link-alt text-[11px]"></i>
            <span>{isRTL ? 'تجربة' : 'Test'}</span>
          </a>

          {whatsappSavedFeedback && (
            <span className="text-xs font-black text-emerald-600 flex items-center gap-1 animate-fade-in">
              <i className="fas fa-check-circle"></i>
              {isRTL ? 'تم الحفظ والتعميم فوراً!' : 'Saved & live for all users!'}
            </span>
          )}
        </div>
      </form>

      {/* Top Status Summary & Filter Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => setStatusFilter('all')}
          className={`p-5 rounded-3xl border text-start transition-all flex items-center justify-between ${
            statusFilter === 'all'
              ? 'bg-gray-900 text-white border-gray-900 shadow-lg'
              : 'bg-white text-gray-900 border-gray-100 hover:border-gray-300 shadow-sm'
          }`}
        >
          <div>
            <p className={`text-xs font-bold ${statusFilter === 'all' ? 'text-gray-400' : 'text-gray-500'}`}>
              {isRTL ? 'إجمالي المحادثات' : 'All Conversations'}
            </p>
            <p className="text-3xl font-black mt-1">{stats.total}</p>
          </div>
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg ${
              statusFilter === 'all' ? 'bg-white/10 text-[#FFC90E]' : 'bg-gray-100 text-gray-700'
            }`}
          >
            <i className="fas fa-comments"></i>
          </div>
        </button>

        <button
          onClick={() => setStatusFilter('unread')}
          className={`p-5 rounded-3xl border text-start transition-all flex items-center justify-between ${
            statusFilter === 'unread'
              ? 'bg-red-600 text-white border-red-600 shadow-lg shadow-red-600/20'
              : 'bg-white text-gray-900 border-gray-100 hover:border-red-200 shadow-sm'
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <p className={`text-xs font-bold ${statusFilter === 'unread' ? 'text-red-100' : 'text-gray-500'}`}>
                {isRTL ? 'غير مقروءة (جديد)' : 'Unread Messages'}
              </p>
              {stats.unread > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
              )}
            </div>
            <p className="text-3xl font-black mt-1">{stats.unread}</p>
          </div>
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg ${
              statusFilter === 'unread' ? 'bg-white/20 text-white' : 'bg-red-50 text-red-600'
            }`}
          >
            <i className="fas fa-envelope-open-text"></i>
          </div>
        </button>

        <button
          onClick={() => setStatusFilter('pending')}
          className={`p-5 rounded-3xl border text-start transition-all flex items-center justify-between ${
            statusFilter === 'pending'
              ? 'bg-amber-500 text-gray-950 border-amber-500 shadow-lg shadow-amber-500/20'
              : 'bg-white text-gray-900 border-gray-100 hover:border-amber-300 shadow-sm'
          }`}
        >
          <div>
            <p className={`text-xs font-bold ${statusFilter === 'pending' ? 'text-gray-900/70' : 'text-gray-500'}`}>
              {isRTL ? 'قيد الانتظار / مفتوحة' : 'Pending / Open'}
            </p>
            <p className="text-3xl font-black mt-1">{stats.pending}</p>
          </div>
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg ${
              statusFilter === 'pending' ? 'bg-black/10 text-gray-950' : 'bg-amber-50 text-amber-600'
            }`}
          >
            <i className="fas fa-clock"></i>
          </div>
        </button>

        <button
          onClick={() => setStatusFilter('resolved')}
          className={`p-5 rounded-3xl border text-start transition-all flex items-center justify-between ${
            statusFilter === 'resolved'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-600/20'
              : 'bg-white text-gray-900 border-gray-100 hover:border-emerald-200 shadow-sm'
          }`}
        >
          <div>
            <p className={`text-xs font-bold ${statusFilter === 'resolved' ? 'text-emerald-100' : 'text-gray-500'}`}>
              {isRTL ? 'تم الحل / مكتملة' : 'Resolved / Done'}
            </p>
            <p className="text-3xl font-black mt-1">{stats.resolved}</p>
          </div>
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg ${
              statusFilter === 'resolved' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-600'
            }`}
          >
            <i className="fas fa-check-double"></i>
          </div>
        </button>
      </div>

      {/* Main Split-View Customer Service Center */}
      <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[680px]">
        {/* Left Column: Filterable & Enriched Conversation List */}
        <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-e border-gray-100 flex flex-col h-[680px]">
          {/* Search & Channel Filter Bar */}
          <div className="p-4 border-b border-gray-100 space-y-3 bg-gray-50/50">
            <div className="relative">
              <i className="fas fa-search absolute start-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  isRTL
                    ? 'بحث باسم العميل، رقم الهاتف، الموضوع، أو الرسالة...'
                    : 'Search by customer name, phone, subject, message...'
                }
                className="w-full bg-white border border-gray-200 rounded-2xl ps-9 pe-4 py-2.5 text-xs font-bold text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                >
                  <i className="fas fa-times"></i>
                </button>
              )}
            </div>

            <div className="flex items-center justify-between gap-1 bg-gray-200/70 p-1 rounded-xl">
              {[
                { id: 'all', label: isRTL ? 'الكل' : 'All' },
                { id: 'chat', label: isRTL ? 'محادثات مباشرة' : 'Direct Chats' },
                { id: 'ticket', label: isRTL ? 'تذاكر الدعم والرسوم' : 'Tickets & Fees' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setChannelFilter(tab.id as any)}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-black transition-all ${
                    channelFilter === tab.id
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation Items */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {filteredConversations.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-gray-400">
                <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center text-2xl mb-3 text-gray-300">
                  <i className="fas fa-inbox"></i>
                </div>
                <p className="font-black text-sm text-gray-600">
                  {isRTL ? 'لا توجد محادثات مطابقة للبحث' : 'No matching conversations'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {isRTL
                    ? 'جرب تغيير الفلتر أو البحث باسم أو رقم هاتف آخر'
                    : 'Try switching filters or searching a different name or phone'}
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = conv.key === selectedKey;
                const isResolved = conv.status === 'resolved' || conv.status === 'closed';
                const isDriver = conv.userRole === UserRole.DRIVER;

                return (
                  <div
                    key={conv.key}
                    onClick={() => handleSelectConversation(conv)}
                    className={`p-4 cursor-pointer transition-all relative ${
                      isSelected
                        ? 'bg-blue-50/80 border-s-4 border-s-blue-600'
                        : conv.isUnread
                        ? 'bg-amber-50/40 hover:bg-amber-50/70'
                        : 'bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar with Unread Counter */}
                      <div className="relative shrink-0">
                        <img
                          src={
                            conv.userAvatar ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(
                              conv.userName
                            )}&background=${isDriver ? '1D4ED8' : 'FFC90E'}&color=${
                              isDriver ? 'fff' : '000'
                            }`
                          }
                          alt={conv.userName}
                          className="w-12 h-12 rounded-2xl object-cover border border-gray-200 shadow-sm"
                        />
                        {conv.isUnread && (
                          <span className="absolute -top-1.5 -end-1.5 min-w-[20px] h-5 px-1 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center shadow-md animate-bounce">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>

                      {/* Main Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <h4
                              className={`text-sm truncate ${
                                conv.isUnread ? 'font-black text-gray-950' : 'font-bold text-gray-900'
                              }`}
                            >
                              {conv.userName}
                            </h4>
                            <span
                              className={`text-[10px] font-bold shrink-0 ${
                                isDriver ? 'text-blue-600' : 'text-amber-600'
                              }`}
                            >
                              • {isDriver ? (isRTL ? 'كابتن' : 'Driver') : isRTL ? 'راكب' : 'Passenger'}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-gray-400 shrink-0">
                            {formatDateTime(conv.lastTimestampMs)}
                          </span>
                        </div>

                        {/* Phone Number & Channel */}
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <span className="text-xs font-mono font-bold text-gray-600" dir="ltr">
                            <i className="fas fa-phone-alt text-[10px] text-gray-400 me-1"></i>
                            {conv.userPhone}
                          </span>
                          <span className="text-[10px] font-bold text-gray-400 truncate max-w-[140px]">
                            {conv.type === 'chat'
                              ? isRTL
                                ? 'محادثة مباشرة'
                                : 'Direct Chat'
                              : conv.subject}
                          </span>
                        </div>

                        {/* Last Message Preview & Status */}
                        <div className="flex items-center justify-between gap-2 mt-2">
                          <p
                            className={`text-xs truncate flex-1 ${
                              conv.isUnread ? 'font-black text-gray-900' : 'font-medium text-gray-500'
                            }`}
                          >
                            {conv.lastSenderId === 'SYSTEM_ADMIN' || conv.lastSenderId === 'admin'
                              ? isRTL
                                ? 'أنت: '
                                : 'You: '
                              : ''}
                            {conv.lastMessage}
                          </p>

                          {/* Clear Pending vs Resolved Indicator */}
                          <span
                            className={`text-[10px] font-black shrink-0 flex items-center gap-1 ${
                              conv.isUnread
                                ? 'text-red-600'
                                : isResolved
                                ? 'text-emerald-600'
                                : 'text-amber-600'
                            }`}
                          >
                            <i
                              className={`fas ${
                                conv.isUnread
                                  ? 'fa-circle text-[7px] animate-ping'
                                  : isResolved
                                  ? 'fa-check-circle'
                                  : 'fa-hourglass-half'
                              }`}
                            ></i>
                            {conv.isUnread
                              ? isRTL
                                ? 'غير مقروء'
                                : 'Unread'
                              : isResolved
                              ? isRTL
                                ? 'تم الحل'
                                : 'Done'
                              : isRTL
                              ? 'قيد الانتظار'
                              : 'Pending'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Conversation & Customer Info Desk */}
        <div className="lg:col-span-7 flex flex-col h-[680px] bg-[#F8FAFC]">
          {!activeConversation ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8 text-center">
              <div className="w-20 h-20 rounded-3xl bg-white shadow-sm border border-gray-100 flex items-center justify-center text-3xl text-blue-500 mb-4">
                <i className="fas fa-headset"></i>
              </div>
              <h3 className="text-base font-black text-gray-800">
                {isRTL ? 'مركز خدمة العملاء والمحادثات الفورية' : 'Customer Service & Live Support Desk'}
              </h3>
              <p className="text-xs text-gray-400 max-w-sm mt-1">
                {isRTL
                  ? 'اختر أي محادثة من القائمة الجانبية لعرض بيانات العميل الكاملة والرد المباشر أو تغيير حالة الطلب.'
                  : 'Select any conversation from the list to view full customer details, reply live, or mark as resolved.'}
              </p>
            </div>
          ) : (
            <>
              {/* Customer Details Header */}
              <div className="bg-white p-4 sm:p-5 border-b border-gray-100 shadow-xs shrink-0 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <img
                      src={
                        activeConversation.userAvatar ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          activeConversation.userName
                        )}&background=FFC90E&color=000`
                      }
                      alt={activeConversation.userName}
                      className="w-13 h-13 rounded-2xl object-cover border border-gray-200 shadow-xs shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-black text-gray-900 truncate">
                          {activeConversation.userName}
                        </h3>
                        <span className="text-xs font-bold text-blue-600">
                          •{' '}
                          {activeConversation.userRole === UserRole.DRIVER
                            ? isRTL
                              ? 'كابتن (Driver)'
                              : 'Driver'
                            : isRTL
                            ? 'راكب (Passenger)'
                            : 'Passenger'}
                        </span>
                      </div>

                      {/* Phone, Email & Vehicle Info */}
                      <div className="flex items-center gap-3 flex-wrap mt-1 text-xs text-gray-600">
                        <span className="font-mono font-black text-gray-800" dir="ltr">
                          <i className="fas fa-phone-alt text-blue-500 me-1"></i>
                          {activeConversation.userPhone}
                        </span>
                        {activeConversation.userPhone !== '---' && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleCopyPhone(activeConversation.userPhone)}
                              className="px-2 py-0.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-bold transition-colors"
                              title={isRTL ? 'نسخ الرقم' : 'Copy Phone'}
                            >
                              <i className="fas fa-copy me-1"></i>
                              {copiedPhone === activeConversation.userPhone
                                ? isRTL
                                  ? 'تم النسخ!'
                                  : 'Copied!'
                                : isRTL
                                ? 'نسخ'
                                : 'Copy'}
                            </button>
                            <a
                              href={`tel:${activeConversation.userPhone}`}
                              className="px-2 py-0.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold transition-colors"
                            >
                              <i className="fas fa-phone me-1"></i>
                              {isRTL ? 'اتصال' : 'Call'}
                            </a>
                            <a
                              href={`https://wa.me/${activeConversation.userPhone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2 py-0.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 text-[10px] font-bold transition-colors"
                            >
                              <i className="fab fa-whatsapp me-1"></i>
                              WhatsApp
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons: Mark Resolved / Reopen */}
                  <div className="flex items-center gap-2 shrink-0">
                    {activeConversation.status === 'resolved' ||
                    activeConversation.status === 'closed' ? (
                      <button
                        onClick={() => handleToggleStatus(activeConversation, 'open')}
                        disabled={updatingStatusId === activeConversation.key}
                        className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-gray-950 text-xs font-black transition-all flex items-center gap-2 shadow-sm"
                      >
                        <i className="fas fa-redo"></i>
                        {isRTL ? 'إعادة فتح (قيد المتابعة)' : 'Reopen (Mark Pending)'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleStatus(activeConversation, 'resolved')}
                        disabled={updatingStatusId === activeConversation.key}
                        className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all flex items-center gap-2 shadow-md shadow-emerald-600/20"
                      >
                        <i className="fas fa-check-circle"></i>
                        {isRTL ? 'تم حل المشكلة (مكتمل)' : 'Mark as Resolved ✓'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Secondary Metadata Bar: Subject, Vehicle, Wallet/Fees, User ID */}
                <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between gap-3 flex-wrap text-[11px] text-gray-500">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span>
                      <strong className="text-gray-700">{isRTL ? 'الموضوع:' : 'Subject:'}</strong>{' '}
                      {activeConversation.subject}
                    </span>
                    {activeConversation.vehicleInfo && (
                      <span>
                        • <i className="fas fa-car text-blue-500 me-1"></i>
                        {activeConversation.vehicleInfo}
                      </span>
                    )}
                    {typeof activeConversation.pendingFees === 'number' &&
                      activeConversation.pendingFees > 0 && (
                        <span className="text-red-600 font-bold">
                          • {isRTL ? 'مديونية الكابتن:' : 'Pending Fees:'}{' '}
                          {activeConversation.pendingFees} EGP
                        </span>
                      )}
                  </div>
                  <span className="font-mono text-[10px] text-gray-400">
                    ID: {activeConversation.userId.slice(0, 12)}
                  </span>
                </div>
              </div>

              {/* Messages Thread */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-[#EFEAE2]/60">
                {loadingMessages ? (
                  <div className="h-full flex items-center justify-center text-gray-400 gap-2">
                    <i className="fas fa-circle-notch animate-spin text-xl text-blue-600"></i>
                    <span className="text-xs font-bold">
                      {isRTL ? 'جاري تحميل الرسائل...' : 'Loading conversation...'}
                    </span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                    <i className="fas fa-comment-dots text-2xl opacity-40"></i>
                    <span className="text-xs font-bold">
                      {isRTL ? 'لا توجد رسائل داخل هذه المحادثة بعد' : 'No messages in this thread yet'}
                    </span>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isAdminMsg =
                      msg.isAdmin === true ||
                      msg.senderId === 'SYSTEM_ADMIN' ||
                      msg.senderId === 'admin';
                    const isBotMsg = msg.senderId === 'support_bot' || msg.senderId === 'ai';
                    const isSystem = msg.isSystem === true || msg.senderId === 'system';
                    const msgTimeMs = parseTimestampMs(msg.timestamp);

                    if (isSystem) {
                      return (
                        <div key={msg.id || idx} className="flex justify-center py-1">
                          <span className="bg-gray-900/60 text-white text-[10px] font-bold px-3 py-1 rounded-full">
                            {msg.text}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.id || idx}
                        className={`flex w-full ${
                          isAdminMsg ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2.5 shadow-xs ${
                            isAdminMsg
                              ? isBotMsg
                                ? 'bg-blue-50 border border-blue-100 text-gray-800 rounded-ee-none'
                                : 'bg-[#FFC90E] text-gray-950 font-bold rounded-ee-none'
                              : 'bg-white border border-gray-100 text-gray-900 rounded-es-none'
                          }`}
                        >
                          <div className="text-[10px] font-black mb-1 opacity-70 flex items-center gap-1.5">
                            <i
                              className={`fas ${
                                isBotMsg
                                  ? 'fa-robot text-blue-600'
                                  : isAdminMsg
                                  ? 'fa-user-shield text-gray-900'
                                  : 'fa-user text-amber-600'
                              }`}
                            ></i>
                            <span>
                              {isBotMsg
                                ? isRTL
                                  ? 'المساعد الذكي (AI Bot)'
                                  : 'AI Support Bot'
                                : isAdminMsg
                                ? isRTL
                                  ? 'خدمة العملاء (Admin)'
                                  : 'Admin Support'
                                : `${activeConversation.userName} (${activeConversation.userPhone})`}
                            </span>
                          </div>

                          {msg.audioUrl ? (
                            <AudioPlayer src={msg.audioUrl} isMe={isAdminMsg} />
                          ) : (
                            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed" dir="auto">
                              {msg.text}
                            </p>
                          )}

                          <div className="text-[9px] font-bold opacity-60 mt-1 text-end">
                            {msgTimeMs ? formatDateTime(msgTimeMs) : ''}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Replies & Reply Composer */}
              <div className="bg-white border-t border-gray-100 p-3 space-y-2.5 shrink-0">
                {/* Quick Replies */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                  {quickReplies.map((qr) => (
                    <button
                      key={qr}
                      onClick={() => handleSendReply(qr)}
                      disabled={isSending}
                      className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-amber-50 hover:text-amber-900 text-gray-700 text-[11px] font-bold whitespace-nowrap transition-colors shrink-0"
                    >
                      {qr}
                    </button>
                  ))}
                </div>

                {/* Input Bar */}
                {isRecording ? (
                  <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-2xl px-4 py-2.5">
                    <div className="flex items-center gap-2.5 text-red-600 font-black text-xs">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping"></span>
                      <span>
                        {isRTL ? 'جاري تسجيل رسالة صوتية...' : 'Recording voice note...'} (
                        {Math.floor(recordingSeconds / 60)}:
                        {String(recordingSeconds % 60).padStart(2, '0')})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={cancelVoiceRecording}
                        className="px-3 py-1.5 rounded-xl bg-white text-gray-600 text-xs font-bold border border-gray-200"
                      >
                        {isRTL ? 'إلغاء' : 'Cancel'}
                      </button>
                      <button
                        onClick={stopAndSendVoiceRecording}
                        className="px-4 py-1.5 rounded-xl bg-red-600 text-white text-xs font-black flex items-center gap-1.5"
                      >
                        <i className="fas fa-paper-plane"></i>
                        {isRTL ? 'إرسال التسجيل' : 'Send Audio'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
                      placeholder={
                        isRTL
                          ? `اكتب ردك إلى ${activeConversation.userName}...`
                          : `Reply to ${activeConversation.userName}...`
                      }
                      className="flex-1 bg-gray-100 focus:bg-white border border-transparent focus:border-[#FFC90E] rounded-2xl px-4 py-3 text-xs font-bold text-gray-900 outline-none transition-all"
                    />
                    <button
                      onClick={startVoiceRecording}
                      disabled={isSending}
                      className="w-11 h-11 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors shrink-0"
                      title={isRTL ? 'تسجيل رسالة صوتية' : 'Record Voice Note'}
                    >
                      <i className="fas fa-microphone"></i>
                    </button>
                    <button
                      onClick={() => handleSendReply()}
                      disabled={!replyText.trim() || isSending}
                      className="px-5 h-11 rounded-2xl bg-[#FFC90E] hover:bg-amber-400 disabled:opacity-40 text-gray-950 font-black text-xs flex items-center gap-2 transition-all shadow-sm shrink-0"
                    >
                      {isSending ? (
                        <i className="fas fa-spinner fa-spin"></i>
                      ) : (
                        <>
                          <i className="fas fa-paper-plane"></i>
                          <span>{isRTL ? 'إرسال' : 'Send'}</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
