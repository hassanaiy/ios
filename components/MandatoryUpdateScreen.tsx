import React, { useState } from 'react';
import { openPlayStoreUpdate } from '../services/updateSystem';

interface MandatoryUpdateScreenProps {
  installedBuild?: number | null;
  requiredBuild?: number | null;
}

export const MandatoryUpdateScreen: React.FC<MandatoryUpdateScreenProps> = ({
  installedBuild,
  requiredBuild,
}) => {
  const [isOpeningStore, setIsOpeningStore] = useState(false);

  const handleUpdateClick = async () => {
    if (isOpeningStore) return;
    setIsOpeningStore(true);
    try {
      await openPlayStoreUpdate();
    } finally {
      setTimeout(() => setIsOpeningStore(false), 1200);
    }
  };

  return (
    <div
      dir="rtl"
      lang="ar"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="mandatory-update-title"
      aria-describedby="mandatory-update-desc"
      className="fixed inset-0 z-[99999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-5 select-none touch-none"
    >
      <div className="bg-white w-full max-w-md rounded-[32px] p-7 sm:p-8 shadow-2xl border border-slate-100 relative overflow-hidden text-center">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#FFC90E]" />
        <div className="absolute -top-20 -right-20 w-56 h-56 bg-[#FFC90E] rounded-full blur-[90px] opacity-20 pointer-events-none" />

        <div className="w-20 h-20 rounded-3xl bg-amber-50 border-4 border-white shadow-lg shadow-amber-100/70 flex items-center justify-center mx-auto mb-6 relative z-10">
          <i className="fas fa-arrow-circle-up text-4xl text-amber-500" aria-hidden="true" />
        </div>

        <div className="relative z-10">
          <h1
            id="mandatory-update-title"
            className="text-2xl sm:text-3xl font-black text-slate-900 mb-3 tracking-tight"
          >
            تحديث إجباري مطلوب
          </h1>

          <p
            id="mandatory-update-desc"
            className="text-sm sm:text-base font-medium text-slate-600 leading-relaxed mb-6"
          >
            إصدار التطبيق الحالي لم يعد مدعوماً. يرجى تحديث تطبيق مواصلة إلى أحدث إصدار من متجر Google Play للاستمرار في استخدام التطبيق.
          </p>

          {typeof installedBuild === 'number' &&
            installedBuild > 0 &&
            typeof requiredBuild === 'number' &&
            requiredBuild > 0 && (
              <div className="inline-flex items-center justify-center gap-3 px-4 py-2 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs font-bold text-slate-600 mb-6">
                <span>الإصدار المثبت: {installedBuild}</span>
                <span className="text-slate-300">|</span>
                <span>الإصدار المطلوب: {requiredBuild}</span>
              </div>
            )}

          <button
            type="button"
            onClick={handleUpdateClick}
            disabled={isOpeningStore}
            className="w-full h-14 rounded-2xl bg-[#FFC90E] hover:bg-yellow-400 active:scale-[0.98] disabled:opacity-80 text-slate-900 font-black text-lg shadow-xl shadow-amber-200/60 flex items-center justify-center gap-3 transition-all cursor-pointer"
          >
            <i className="fab fa-google-play text-xl" aria-hidden="true" />
            <span>{isOpeningStore ? 'جاري فتح المتجر...' : 'تحديث التطبيق الآن'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MandatoryUpdateScreen;
