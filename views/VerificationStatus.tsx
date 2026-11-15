
import React, { useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { User, Driver } from '../types';
import { Button } from '../components/ui/Button';

interface VerificationStatusProps {
  user: User | Driver;
  onNavigate?: (view: 'HOME' | 'DRIVER_REGISTRATION') => void;
  onBack?: () => void;
  onStartWork?: () => void;
}

const Step = ({ title, desc, icon, isCompleted, isActive, isError }: { title: string, desc: string, icon: string, isCompleted: boolean, isActive?: boolean, isError?: boolean }) => {
    return (
        <div className="flex gap-4">
            <div className="flex flex-col items-center">
                <div 
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm transition-all duration-300 shadow-md
                        ${isError ? 'bg-red-500' : isCompleted ? 'bg-green-500' : 'bg-gray-300'}
                    `}
                >
                    <i className={`fas ${icon}`}></i>
                </div>
                <div className={`w-0.5 flex-1 mt-1 ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}`}></div>
            </div>
            <div className="pb-12 flex-1">
                <h3 className={`font-bold ${isError ? 'text-red-600' : 'text-gray-900'}`}>{title}</h3>
                <p className="text-sm text-gray-500">{desc}</p>
            </div>
        </div>
    );
};

export default function VerificationStatus({ user, onNavigate, onBack, onStartWork }: VerificationStatusProps) {
  const { t, isRTL } = useLanguage();
  
  // Resolve status based on kycStatus if available, fallback to legacy fields
  const resolvedStatus = user.kycStatus === 'REJECTED' ? 'rejected' 
                       : user.kycStatus === 'APPROVED' ? 'approved' 
                       : user.kycStatus === 'PENDING_REVIEW' ? 'pending' 
                       : ((user as Driver).status || 'pending');
                       
  const prevStatusRef = useRef(resolvedStatus);

  // Handle back navigation. Prioritize onBack if it exists, otherwise use onNavigate.
  const handleBackAction = useCallback(() => {
    if (onBack) {
      onBack();
    } else if (onNavigate) {
      onNavigate('HOME');
    }
  }, [onBack, onNavigate]);

  const handleStartWork = useCallback(() => {
    if (onStartWork) {
      onStartWork();
    } else if (onNavigate) {
      onNavigate('HOME');
    } else if (onBack) {
      onBack();
    }
  }, [onStartWork, onNavigate, onBack]);

  // Effect to listen for status changes (Real-time update)
  useEffect(() => {
    if (prevStatusRef.current === 'pending' && resolvedStatus === 'approved') {
        // 1. Play Success Sound
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3');
        audio.play().catch(() => {});

        // 2. Direct replace and transition without blocking alert dialog
        handleStartWork();
    }
    prevStatusRef.current = resolvedStatus;
  }, [resolvedStatus, handleStartWork]);

  // --- Approved State ---
  if (resolvedStatus === 'approved') {
    return (
      <div className="h-full w-full bg-white flex flex-col items-center justify-center p-8 text-center" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 animate-bounce">
          <i className="fas fa-check-circle text-6xl text-green-500"></i>
        </div>
        <h1 className="text-3xl font-black text-gray-900 mb-2">{t('driver_app_approved')}</h1>
        <p className="text-gray-500 mb-10">{t('congrats_driver')}</p>
        <div className="w-full max-w-sm space-y-3">
            <Button onClick={handleStartWork} className="w-full h-14 text-lg bg-[#FFC90E] text-black shadow-xl shadow-yellow-200">
                {isRTL ? 'ابدأ العمل واستقبل الرحلات' : 'Start Work & Accept Rides'}
            </Button>
        </div>
      </div>
    );
  }

  // --- Rejected State ---
  if (resolvedStatus === 'rejected') {
     return (
        <div className="h-full w-full bg-white flex flex-col items-center justify-center p-8 text-center" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mb-6">
                <i className="fas fa-times-circle text-6xl text-red-500"></i>
            </div>
            <h1 className="text-3xl font-black text-gray-900 mb-2">{t('verif_rejected')}</h1>
            
            {user.rejectionReason && (
                <div className="w-full max-w-sm mb-8 p-6 bg-red-50 border border-red-100 rounded-[32px] text-left rtl:text-right relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 text-4xl text-red-600"><i className="fas fa-exclamation-triangle"></i></div>
                    <label className="text-[10px] font-black text-red-400 uppercase tracking-widest block mb-2">{isRTL ? 'سبب الرفض' : 'Rejection Reason'}</label>
                    <p className="text-sm font-bold text-red-700 leading-relaxed relative z-10">{user.rejectionReason}</p>
                </div>
            )}

            {!user.rejectionReason && <p className="text-gray-500 mb-10">{t('fix_issue_docs')}</p>}

            <div className="w-full max-w-sm space-y-3">
                <Button onClick={() => onNavigate && onNavigate('DRIVER_REGISTRATION')} className="w-full h-14 text-lg bg-gray-900 text-white shadow-xl shadow-gray-200">
                    {isRTL ? 'إعادة رفع المستندات' : 'Re-upload Documents'}
                </Button>
                <Button onClick={handleBackAction} variant="outline" className="w-full h-14 border-none text-gray-400 font-bold">
                    {t('close')}
                </Button>
            </div>
        </div>
     );
  }

  // --- Pending State ---
  return (
    <div className="h-full w-full bg-gray-50 flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="p-4 pt-safe flex items-center justify-between bg-white border-b border-gray-100">
        <button onClick={handleBackAction} className="w-10 h-10 flex items-center justify-center">
          <i className={`fas ${isRTL ? 'fa-arrow-right' : 'fa-arrow-left'} text-lg text-gray-700`}></i>
        </button>
        <h1 className="text-base font-bold text-gray-900">{t('verification_title')}</h1>
        <button onClick={handleBackAction} className="px-4 text-gray-600 font-semibold">{t('close')}</button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Timeline */}
        <div className="mb-8">
            <div className="relative">
                <Step 
                    title={t('step_docs_submitted')} 
                    desc={t('step_docs_desc')} 
                    icon="fa-check" 
                    isCompleted={true} 
                />
                 <Step 
                    title={t('step_ready')} 
                    desc={t('step_ready_desc')} 
                    icon="fa-check" 
                    isCompleted={true} 
                />
                <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 text-sm bg-gray-200 shadow-sm animate-pulse">
                            <i className="fas fa-hourglass-half"></i>
                        </div>
                    </div>
                    <div className="pb-4 flex-1">
                        <h3 className="font-bold text-gray-900">{t('step_admin_review')}</h3>
                        <p className="text-sm text-gray-500">{t('step_review_desc')}</p>
                    </div>
                </div>
            </div>
        </div>
        
        {/* Info Box */}
        <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 text-center mb-6 flex flex-col items-center justify-center min-h-[150px]">
            <i className="fas fa-file-signature text-4xl text-blue-500 mb-4 animate-pulse"></i>
            <h2 className="text-blue-900 font-black text-xl mb-2">
                {isRTL ? "مستنداتك قيد المراجعة الآن" : "Your documents are under review"}
            </h2>
        </div>

        {/* Fee Policy Info */}
        <div className="bg-yellow-50 p-6 rounded-2xl border border-yellow-100 mb-6">
            <div className="flex items-center gap-3 mb-2 text-yellow-800">
                <i className="fas fa-info-circle text-lg"></i>
                <h3 className="font-black text-sm uppercase tracking-wide">{t('admin_fees_title')}</h3>
            </div>
            <p className="text-xs font-bold text-yellow-700 leading-relaxed">
                {isRTL 
                    ? "تستمتع بفترة مجانية بدون عمولة لمدة شهر. بعد ذلك تخصم عمولة ١٠٪. يجب تسوية الرسوم أسبوعياً كل يوم سبت عبر إنستا باي أو فودافون كاش."
                    : "Enjoy a 1-month free trial with 0% commission. After that, a 10% commission applies. Fees must be settled weekly on Saturdays via InstaPay or Vodafone Cash."
                }
            </p>
        </div>

        {/* Other Docs */}
        <div>
            <h2 className="font-bold text-gray-800 mb-3">{t('optional_docs_title')}</h2>
            <button className="w-full flex items-center justify-between p-4 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-3">
                    <i className="fas fa-file-alt text-gray-400"></i>
                    <span className="font-semibold text-gray-700">{t('doc_criminal_record')} (optional)</span>
                </div>
                <i className={`fas ${isRTL ? 'fa-chevron-left' : 'fa-chevron-right'} text-gray-300`}></i>
            </button>
        </div>
      </div>
      
      {/* Footer Button */}
      <div className="p-4 bg-gray-50 border-t border-gray-100 pb-safe">
        <Button onClick={handleBackAction} variant="secondary" className="w-full h-14 bg-gray-200 text-gray-600">
            {t('ok_btn')}
        </Button>
      </div>
    </div>
  );
}
