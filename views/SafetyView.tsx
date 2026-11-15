import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  ArrowLeft,
  ArrowRight,
  MessageSquareText,
  Users,
  PhoneCall,
  Plus,
  Trash2,
  X,
  ShieldCheck,
  UserCheck,
  Lock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { User, Driver, SafetyContact } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { addSafetyContact, removeSafetyContact } from '../services/firebase';
import { SupportOptionsModal } from '../components/SupportOptionsModal';

interface SafetyViewProps {
  user: User | Driver;
  onBack: () => void;
  onOpenMenu?: () => void;
  onNavigate: (view: string) => void;
}

interface SafetyTopic {
  id: string;
  titleAr: string;
  titleEn: string;
  summaryAr: string;
  summaryEn: string;
  pointsAr: string[];
  pointsEn: string[];
}

const SAFETY_TOPICS: SafetyTopic[] = [
  {
    id: 'proactive',
    titleAr: 'دعم السلامة الاستباقي',
    titleEn: 'Proactive safety support',
    summaryAr:
      'فريق السلامة لدينا يراقب الرحلات النشطة على مدار الساعة ويتدخل فورياً عند اكتشاف أي توقف غير متوقع أو تنبيه طوارئ.',
    summaryEn:
      'Our safety system monitors active rides 24/7 and steps in immediately if an unexpected stop or SOS alert occurs.',
    pointsAr: [
      'متابعة مسار الرحلة في الوقت الفعلي من لحظة الانطلاق حتى الوصول.',
      'تنبيهات فورية لفريق الدعم عند الضغط على زر الطوارئ أو وجود تأخير غير معتاد.',
      'تواصل سريع مع فريق خدمة العملاء والدعم المباشر في أي وقت.',
    ],
    pointsEn: [
      'Real-time route monitoring from pickup through dropoff.',
      'Instant escalation to support on emergency alerts or unusual stops.',
      'Fast direct connection to live customer safety support at any hour.',
    ],
  },
  {
    id: 'verification',
    titleAr: 'التحقق من السائقين',
    titleEn: 'Driver verification',
    summaryAr:
      'يخضع جميع الكباتن لمراجعة دقيقة للوثائق الشخصية ورخصة القيادة وفحص المركبة قبل تفعيل حساباتهم.',
    summaryEn:
      'Every captain completes identity, driver license, and vehicle inspection checks before receiving trip requests.',
    pointsAr: [
      'مراجعة البطاقة الشخصية ورخصة القيادة ورخصة السيارة سارية المفعول.',
      'مطابقة صورة الكابتن ورقم اللوحة المعدنية في تفاصيل الرحلة قبل الركوب.',
      'تقييمات مستمرة من الركاب ومراقبة التزام الكابتن بمعايير القيادة الآمنة.',
    ],
    pointsEn: [
      'Verification of national ID, valid driver license, and vehicle registration.',
      'Driver photo and plate number visible in-app so you confirm before boarding.',
      'Continuous rider ratings and safety quality monitoring.',
    ],
  },
  {
    id: 'privacy',
    titleAr: 'حماية خصوصيتك',
    titleEn: 'Protecting your privacy',
    summaryAr:
      'بياناتك الشخصية ومحادثاتك وموقعك الجغرافي محمية بالكامل ولا تُشارك إلا بالقدر اللازم لإتمام رحلتك بأمان.',
    summaryEn:
      'Your personal info, messages, and trip location are protected and shared only as needed to complete your ride safely.',
    pointsAr: [
      'بيانات التواصل محمية داخل التطبيق ومرتبطة فقط بالرحلة الحالية.',
      'إخفاء موقعك الجغرافي فور انتهاء الرحلة.',
      'حفظ سجل المحادثات داخل التطبيق للمراجعة وحفظ حقوق الجميع.',
    ],
    pointsEn: [
      'Contact details remain protected inside the active trip session.',
      'Location sharing stops automatically once your ride ends.',
      'In-app chat history is safely archived for accountability.',
    ],
  },
  {
    id: 'staying_safe',
    titleAr: 'البقاء آمنًا في كل رحلة',
    titleEn: 'Staying safe on every ride',
    summaryAr:
      'اتبع خطوات السلامة البسيطة هذه قبل وأثناء كل رحلة لضمان تجربة مريحة وآمنة لك ولعائلتك.',
    summaryEn:
      'Follow these essential habits before and during every trip to keep yourself and loved ones safe.',
    pointsAr: [
      'تحقق من تطابق رقم لوحة السيارة ونوع المركبة وصورة الكابتن قبل الصعود.',
      'اربط حزام الأمان طوال مدة الرحلة في المقاعد الأمامية والخلفية.',
      'شارك رابط تتبع الرحلة المباشر مع جهات اتصال الطوارئ الخاصة بك.',
    ],
    pointsEn: [
      'Confirm vehicle plate number, model, and captain profile before entering.',
      'Fasten your seatbelt throughout the entire trip.',
      'Share your live trip status with trusted emergency contacts.',
    ],
  },
  {
    id: 'accidents',
    titleAr: 'الحوادث: خطوات يجب اتخاذها',
    titleEn: 'Accidents: steps to take',
    summaryAr:
      'في حال وقوع أي طارئ أو حادث مروري لا قدر الله، سلامتك هي الأولوية القصوى دائماً.',
    summaryEn:
      'If an accident or urgent incident happens during a trip, your physical safety comes first.',
    pointsAr: [
      'تأكد من سلامتك وسلامة الموجودين وانتقل إلى مكان آمن بعيداً عن حركة المرور.',
      'اتصل فوراً على رقم الطوارئ 122 أو الإسعاف 123 عند الحاجة الطبية أو الأمنية.',
      'تواصل مع فريق الدعم عبر صفحة الدعم لتوثيق الواقعة ومتابعة الإجراءات.',
    ],
    pointsEn: [
      'Check for injuries and move to a safe location away from traffic if possible.',
      'Call emergency services on 122 immediately for urgent police or rescue help.',
      'Notify support through the Support tab so our team can assist right away.',
    ],
  },
];

const renderTopicIllustration = (id: string) => {
  switch (id) {
    case 'proactive':
      return (
        <svg viewBox="0 0 88 76" className="w-20 h-16 shrink-0" aria-hidden="true">
          <path
            d="M14 26 L56 12 L78 24 L68 62 L24 70 L8 46 Z"
            fill="#B4F000"
          />
          <path
            d="M44 14 C35 19 27 20 22 20 L22 39 C22 52 33 61 44 65 C55 61 66 52 66 39 L66 20 C61 20 53 19 44 14 Z"
            fill="#2563EB"
            stroke="#111827"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path
            d="M35 39 L41.5 45.5 L54 33"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'verification':
      return (
        <svg viewBox="0 0 92 76" className="w-22 h-16 shrink-0" aria-hidden="true">
          <path
            d="M12 20 L66 10 L84 36 L68 66 L20 68 L8 42 Z"
            fill="#B4F000"
          />
          <g transform="rotate(-11 46 38)">
            <rect
              x="14"
              y="18"
              width="60"
              height="38"
              rx="6"
              fill="#FFFFFF"
              stroke="#111827"
              strokeWidth="2.6"
            />
            <circle cx="29" cy="37" r="7.5" fill="none" stroke="#111827" strokeWidth="2.4" />
            <circle cx="29" cy="34.5" r="2.6" fill="#111827" />
            <path
              d="M24 42 C25.5 39.5 32.5 39.5 34 42"
              fill="none"
              stroke="#111827"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <line x1="43" y1="30" x2="64" y2="30" stroke="#111827" strokeWidth="3" strokeLinecap="round" />
            <line x1="43" y1="38" x2="60" y2="38" stroke="#111827" strokeWidth="3" strokeLinecap="round" />
            <line x1="43" y1="46" x2="54" y2="46" stroke="#111827" strokeWidth="3" strokeLinecap="round" />
          </g>
          <circle cx="58" cy="54" r="9.5" fill="#111827" />
          <path
            d="M54 54 L57 57 L63 51"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'privacy':
      return (
        <svg viewBox="0 0 88 76" className="w-20 h-16 shrink-0" aria-hidden="true">
          <path
            d="M18 14 L70 18 L80 48 L58 70 L18 64 L10 38 Z"
            fill="#B4F000"
          />
          <circle cx="46" cy="40" r="21" fill="#FFFFFF" stroke="#111827" strokeWidth="2.6" />
          <path
            d="M38 30 C36 32 36 37 40 42 C44 47 49 48 52 46 L55 43 C56 42 56 40 54.5 39 L51 37 C49.5 36.5 48.5 37.5 47.5 39 C46 38.5 43.5 36 43 34.5 C44.5 33.5 45.5 32.5 45 31 L43 27.5 C42 26 40 26 39 27 Z"
            fill="#111827"
          />
          <line x1="51" y1="23" x2="53" y2="19" stroke="#111827" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="57" y1="26" x2="61" y2="23" stroke="#111827" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="60" y1="32" x2="65" y2="31" stroke="#111827" strokeWidth="2.2" strokeLinecap="round" />
          <path
            d="M30 43 C27 45 24 45.5 22 45.5 L22 53 C22 58 26 61.5 30 63 C34 61.5 38 58 38 53 L38 45.5 C36 45.5 33 45 30 43 Z"
            fill="#111827"
            stroke="#FFFFFF"
            strokeWidth="1.6"
          />
          <path
            d="M27 53 L29.2 55.2 L33.5 50.8"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'staying_safe':
      return (
        <svg viewBox="0 0 92 76" className="w-22 h-16 shrink-0" aria-hidden="true">
          <path
            d="M10 38 L52 10 L82 28 L66 68 L18 64 Z"
            fill="#B4F000"
          />
          <g transform="rotate(-38 46 39)">
            <rect x="8" y="31" width="22" height="16" rx="2" fill="#FFFFFF" stroke="#111827" strokeWidth="2.4" />
            <rect x="30" y="27" width="24" height="24" rx="4" fill="#111827" />
            <rect x="36" y="33" width="12" height="12" rx="2" fill="#FFFFFF" />
            <rect x="54" y="32" width="12" height="14" rx="2" fill="#FBBF24" stroke="#111827" strokeWidth="2.2" />
            <rect x="66" y="31" width="20" height="16" rx="2" fill="#FFFFFF" stroke="#111827" strokeWidth="2.4" />
          </g>
          <line x1="28" y1="22" x2="25" y2="17" stroke="#111827" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="35" y1="20" x2="35" y2="14" stroke="#111827" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="42" y1="22" x2="45" y2="17" stroke="#111827" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    case 'accidents':
    default:
      return (
        <svg viewBox="0 0 88 76" className="w-20 h-16 shrink-0" aria-hidden="true">
          <path
            d="M18 18 L66 14 L80 48 L52 70 L12 58 Z"
            fill="#B4F000"
          />
          <path
            d="M44 15 L71 61 H17 Z"
            fill="none"
            stroke="#111827"
            strokeWidth="3.2"
            strokeLinejoin="round"
          />
          <rect x="41.8" y="31" width="4.4" height="16" rx="2" fill="#111827" />
          <circle cx="44" cy="53" r="2.7" fill="#111827" />
        </svg>
      );
  }
};

export const SafetyView: React.FC<SafetyViewProps> = ({
  user,
  onBack,
  onOpenMenu,
  onNavigate,
}) => {
  const { t, isRTL } = useLanguage();
  const [showSupportOptions, setShowSupportOptions] = useState(false);
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [showCall122Modal, setShowCall122Modal] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<SafetyTopic | null>(null);

  const [isAddingContact, setIsAddingContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [contactError, setContactError] = useState<string | null>(null);
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const contacts = user.safetyContacts || [];

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactError(null);
    const trimmedName = newContactName.trim();
    const cleanPhone = newContactPhone.replace(/\D/g, '');
    if (!trimmedName) {
      setContactError(isRTL ? 'يرجى إدخال اسم جهة الاتصال' : 'Please enter a contact name');
      return;
    }
    if (cleanPhone.length < 7) {
      setContactError(t('err_invalid_phone', 'Please enter a valid phone number'));
      return;
    }

    setIsSavingContact(true);
    try {
      const contact: SafetyContact = {
        id: `contact_${Date.now()}`,
        name: trimmedName,
        phone: cleanPhone,
      };
      await addSafetyContact(user.id, contact);
      setNewContactName('');
      setNewContactPhone('');
      setIsAddingContact(false);
    } catch (err) {
      console.error('Failed to add safety contact:', err);
      setContactError(isRTL ? 'تعذر حفظ جهة الاتصال، حاول مجدداً' : 'Could not save contact');
    } finally {
      setIsSavingContact(false);
    }
  };

  const handleConfirmDeleteContact = async (contact: SafetyContact) => {
    setIsSavingContact(true);
    try {
      await removeSafetyContact(user.id, contact);
      setPendingDeleteId(null);
    } catch (err) {
      console.error('Failed to remove safety contact:', err);
    } finally {
      setIsSavingContact(false);
    }
  };

  return (
    <div
      className="h-full w-full bg-white flex flex-col overflow-hidden"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Top App Bar */}
      <header className="pt-safe px-4 py-3 flex items-center justify-between bg-white shrink-0 z-10">
        {onOpenMenu ? (
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label={isRTL ? 'فتح القائمة الجانبية' : 'Open menu'}
            className="w-11 h-11 rounded-full bg-white shadow-[0_4px_16px_rgba(0,0,0,0.08)] border border-gray-100 flex items-center justify-center text-gray-800 hover:bg-gray-50 active:scale-95 transition-all"
          >
            <Menu className="w-5 h-5" strokeWidth={2.2} />
          </button>
        ) : (
          <div className="w-11" />
        )}

        <h1 className="text-lg font-black text-gray-900 tracking-tight">
          {isRTL ? 'السلامة' : 'Safety'}
        </h1>

        <button
          type="button"
          onClick={onBack}
          aria-label={isRTL ? 'العودة للرئيسية' : 'Back to home'}
          className="w-11 h-11 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 active:scale-95 transition-all"
        >
          {isRTL ? (
            <ArrowLeft className="w-5 h-5" strokeWidth={2.2} />
          ) : (
            <ArrowRight className="w-5 h-5" strokeWidth={2.2} />
          )}
        </button>
      </header>

      {/* Scrollable Content */}
      <main className="flex-1 overflow-y-auto px-4 pb-10 pt-2">
        <div className="max-w-2xl mx-auto w-full">
          {/* Top Two Quick Cards: Support & Emergency Contacts */}
          <div className="grid grid-cols-2 gap-3 mb-3.5">
            <button
              type="button"
              onClick={() => setShowSupportOptions(true)}
              className="bg-[#F4F3EF] hover:bg-[#ECEAE3] rounded-2xl p-4 min-h-[104px] flex flex-col items-center justify-center gap-2.5 text-center transition-colors active:scale-[0.98]"
            >
              <MessageSquareText className="w-6 h-6 text-gray-900" strokeWidth={2} />
              <span className="text-sm font-bold text-gray-900 leading-snug">
                {isRTL ? 'الدعم' : 'Support'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowContactsModal(true)}
              className="bg-[#F4F3EF] hover:bg-[#ECEAE3] rounded-2xl p-4 min-h-[104px] flex flex-col items-center justify-center gap-2 text-center transition-colors active:scale-[0.98]"
            >
              <Users className="w-6 h-6 text-gray-900" strokeWidth={2} />
              <span className="text-sm font-bold text-gray-900 leading-snug">
                {isRTL ? 'جهات الاتصال في حالات الطوارئ' : 'Emergency contacts'}
              </span>
              {contacts.length > 0 && (
                <span className="text-[11px] font-semibold text-gray-500 tabular-nums">
                  {isRTL ? `${contacts.length} مضافة` : `${contacts.length} added`}
                </span>
              )}
            </button>
          </div>

          {/* Emergency Call 122 Button */}
          <button
            type="button"
            onClick={() => setShowCall122Modal(true)}
            className="w-full bg-[#F01447] hover:bg-[#d8103f] text-white rounded-2xl py-3.5 px-5 min-h-[52px] font-black text-base shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 mb-7"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 18v-5a5 5 0 0 1 10 0v5" />
              <path d="M5 18h14" />
              <path d="M12 4v2" />
              <path d="M5.6 7.6l1.4 1.4" />
              <path d="M18.4 7.6l-1.4 1.4" />
            </svg>
            <span>{isRTL ? 'اتصال على 122' : 'Call 122'}</span>
          </button>

          {/* "How you're protected" Section */}
          <h2 className="text-xl font-black text-gray-900 mb-3.5 text-start">
            {isRTL ? 'كيف تتم حمايتك' : "How you're protected"}
          </h2>

          <div className="grid grid-cols-2 gap-3">
            {SAFETY_TOPICS.map((topic) => (
              <button
                key={topic.id}
                type="button"
                onClick={() => setSelectedTopic(topic)}
                className="bg-[#F4F3EF] hover:bg-[#ECEAE3] rounded-2xl p-4 min-h-[150px] flex flex-col justify-between text-start transition-colors active:scale-[0.98] overflow-hidden"
              >
                <span className="text-[14px] font-bold text-gray-900 leading-snug">
                  {isRTL ? topic.titleAr : topic.titleEn}
                </span>
                <div className="self-end mt-3">
                  {renderTopicIllustration(topic.id)}
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>

      {/* Support Options Modal */}
      <SupportOptionsModal
        isOpen={showSupportOptions}
        onClose={() => setShowSupportOptions(false)}
        onSelectCustomerServiceChat={() => onNavigate('ADMIN_CHAT')}
        userName={user.name}
        userPhone={user.phone}
      />

      {/* Call 122 Confirmation Sheet */}
      <AnimatePresence>
        {showCall122Modal && (
          <div
            className="fixed inset-0 z-[160] bg-black/55 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
            dir={isRTL ? 'rtl' : 'ltr'}
            onClick={() => setShowCall122Modal(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 60 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-md bg-white rounded-t-[32px] sm:rounded-[28px] p-6 pb-8 sm:pb-6 shadow-2xl"
            >
              <div className="w-10 h-1.5 bg-gray-200 rounded-full mx-auto mb-5 sm:hidden" />
              <div className="w-14 h-14 rounded-2xl bg-rose-50 text-[#F01447] flex items-center justify-center mx-auto mb-4">
                <PhoneCall className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-black text-gray-900 text-center">
                {isRTL ? 'الاتصال بخدمة الطوارئ 122' : 'Call Emergency Services (122)'}
              </h3>
              <p className="text-xs font-semibold text-gray-500 text-center mt-1.5 mb-6 leading-relaxed">
                {isRTL
                  ? 'سيتم فتح تطبيق الهاتف للاتصال بشرطة النجدة 122 فوراً في حالات الطوارئ الحقيقية.'
                  : 'This will open your phone dialer to call Emergency Police (122) immediately.'}
              </p>
              <div className="flex flex-col gap-2.5">
                <a
                  href="tel:122"
                  onClick={() => setShowCall122Modal(false)}
                  className="w-full py-3.5 rounded-2xl bg-[#F01447] hover:bg-[#d8103f] text-white font-black text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98]"
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>{isRTL ? 'اتصال الآن على 122' : 'Call 122 Now'}</span>
                </a>
                <button
                  type="button"
                  onClick={() => setShowCall122Modal(false)}
                  className="w-full py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm transition-colors"
                >
                  {t('cancel', 'Cancel')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Emergency Contacts Modal */}
      <AnimatePresence>
        {showContactsModal && (
          <div
            className="fixed inset-0 z-[160] bg-black/55 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
            dir={isRTL ? 'rtl' : 'ltr'}
            onClick={() => {
              setShowContactsModal(false);
              setIsAddingContact(false);
              setContactError(null);
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 60 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-md bg-white rounded-t-[32px] sm:rounded-[28px] p-6 pb-8 sm:pb-6 shadow-2xl max-h-[85vh] overflow-y-auto"
            >
              <div className="w-10 h-1.5 bg-gray-200 rounded-full mx-auto mb-4 sm:hidden" />
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-black text-gray-900">
                    {isRTL ? 'جهات الاتصال في حالات الطوارئ' : 'Emergency Contacts'}
                  </h3>
                  <p className="text-xs font-semibold text-gray-500 mt-0.5">
                    {isRTL
                      ? 'أضف أشخاصاً موثوقين لمشاركة تفاصيل رحلتك معهم'
                      : 'Add trusted contacts to share live ride updates'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowContactsModal(false);
                    setIsAddingContact(false);
                    setContactError(null);
                  }}
                  aria-label={t('close', 'Close')}
                  className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {!isAddingContact && (
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingContact(true);
                    setContactError(null);
                  }}
                  className="w-full py-3 px-4 mb-4 rounded-2xl bg-gray-900 hover:bg-black text-white font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isRTL ? 'إضافة جهة اتصال للطوارئ' : 'Add Emergency Contact'}</span>
                </button>
              )}

              {isAddingContact && (
                <form
                  onSubmit={handleAddContact}
                  className="bg-[#F4F3EF] p-4 rounded-2xl mb-4 space-y-3"
                >
                  <input
                    type="text"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    placeholder={t('contact_name', 'Contact name')}
                    className="w-full p-3 bg-white rounded-xl font-bold text-sm text-gray-900 outline-none border border-gray-200 focus:border-gray-900"
                  />
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={15}
                    value={newContactPhone}
                    onChange={(e) => setNewContactPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder={t('contact_phone', 'Phone number')}
                    className="w-full p-3 bg-white rounded-xl font-bold text-sm text-gray-900 outline-none border border-gray-200 focus:border-gray-900 tabular-nums"
                    dir="ltr"
                  />
                  {contactError && (
                    <p className="text-xs font-bold text-rose-600">{contactError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingContact(false);
                        setContactError(null);
                      }}
                      className="flex-1 py-2.5 bg-white rounded-xl font-bold text-xs text-gray-600 border border-gray-200"
                    >
                      {t('cancel', 'Cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingContact}
                      className="flex-[2] py-2.5 bg-gray-900 rounded-xl font-bold text-xs text-white disabled:opacity-60"
                    >
                      {isSavingContact
                        ? isRTL
                          ? 'جاري الحفظ...'
                          : 'Saving...'
                        : t('confirm', 'Confirm')}
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-2.5">
                {contacts.length > 0 ? (
                  contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="bg-[#F4F3EF] p-3.5 rounded-2xl flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-white text-gray-900 flex items-center justify-center shrink-0 shadow-2xs">
                          <UserCheck className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-gray-900 text-sm truncate">
                            {contact.name}
                          </div>
                          <div className="text-xs font-semibold text-gray-500 tabular-nums" dir="ltr">
                            {contact.phone}
                          </div>
                        </div>
                      </div>

                      {pendingDeleteId === contact.id ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleConfirmDeleteContact(contact)}
                            disabled={isSavingContact}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold"
                          >
                            {isRTL ? 'حذف' : 'Delete'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDeleteId(null)}
                            className="px-2.5 py-1.5 rounded-lg bg-white text-gray-600 text-xs font-bold"
                          >
                            {isRTL ? 'إلغاء' : 'No'}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(contact.id)}
                          aria-label={isRTL ? 'حذف جهة الاتصال' : 'Remove contact'}
                          className="w-9 h-9 rounded-full bg-white text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-colors shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 bg-[#F4F3EF] rounded-2xl">
                    <p className="text-gray-500 font-bold text-xs">
                      {t('no_safety_contacts', 'No emergency contacts added yet')}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Topic Details Sheet */}
      <AnimatePresence>
        {selectedTopic && (
          <div
            className="fixed inset-0 z-[160] bg-black/55 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
            dir={isRTL ? 'rtl' : 'ltr'}
            onClick={() => setSelectedTopic(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 60 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-md bg-white rounded-t-[32px] sm:rounded-[28px] p-6 pb-8 sm:pb-6 shadow-2xl"
            >
              <div className="w-10 h-1.5 bg-gray-200 rounded-full mx-auto mb-4 sm:hidden" />
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[#F4F3EF] flex items-center justify-center text-gray-900 shrink-0">
                    {selectedTopic.id === 'proactive' && <ShieldCheck className="w-5 h-5 text-blue-600" />}
                    {selectedTopic.id === 'verification' && <UserCheck className="w-5 h-5 text-gray-900" />}
                    {selectedTopic.id === 'privacy' && <Lock className="w-5 h-5 text-gray-900" />}
                    {selectedTopic.id === 'staying_safe' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                    {selectedTopic.id === 'accidents' && <AlertTriangle className="w-5 h-5 text-amber-600" />}
                  </div>
                  <h3 className="text-lg font-black text-gray-900 leading-snug">
                    {isRTL ? selectedTopic.titleAr : selectedTopic.titleEn}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTopic(null)}
                  aria-label={t('close', 'Close')}
                  className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-sm font-medium text-gray-600 leading-relaxed mb-4">
                {isRTL ? selectedTopic.summaryAr : selectedTopic.summaryEn}
              </p>

              <div className="space-y-2.5 mb-5">
                {(isRTL ? selectedTopic.pointsAr : selectedTopic.pointsEn).map((point, idx) => (
                  <div
                    key={idx}
                    className="bg-[#F4F3EF] p-3 rounded-xl flex items-start gap-2.5 text-xs font-bold text-gray-800 leading-relaxed"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{point}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2.5">
                {selectedTopic.id === 'accidents' && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTopic(null);
                      setShowCall122Modal(true);
                    }}
                    className="flex-1 py-3 rounded-2xl bg-[#F01447] text-white font-black text-sm"
                  >
                    {isRTL ? 'اتصال على 122' : 'Call 122'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedTopic(null)}
                  className="flex-1 py-3 rounded-2xl bg-gray-900 text-white font-black text-sm"
                >
                  {isRTL ? 'فهمت' : 'Got it'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
