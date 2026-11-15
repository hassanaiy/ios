import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { HomeAdBannerActionType, HomeAdBannerConfig } from '../types';
import {
  subscribeToAppSettings,
  updateHomeAdBanner,
  DEFAULT_HOME_AD_BANNER,
} from '../services/firebaseBridge';

export const HomeAdBannerAdminEditor: React.FC = () => {
  const { isRTL } = useLanguage();
  const [form, setForm] = useState<HomeAdBannerConfig>(
    DEFAULT_HOME_AD_BANNER as HomeAdBannerConfig
  );
  const [previewLang, setPreviewLang] = useState<'ar' | 'en'>(isRTL ? 'ar' : 'en');
  const [isSaving, setIsSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const isEditingRef = useRef(false);

  useEffect(() => {
    const unsub = subscribeToAppSettings((settings) => {
      if (settings?.homeAdBanner && !isEditingRef.current) {
        setForm({
          ...(DEFAULT_HOME_AD_BANNER as HomeAdBannerConfig),
          ...settings.homeAdBanner,
        });
      }
    });
    return () => unsub();
  }, []);

  const showFeedback = (msgAr: string, msgEn: string) => {
    setSavedNotice(isRTL ? msgAr : msgEn);
    setTimeout(() => {
      setSavedNotice(null);
    }, 3500);
  };

  const handleImmediateToggleCard = async () => {
    const nextEnabled = !form.isEnabled;
    const updated: HomeAdBannerConfig = { ...form, isEnabled: nextEnabled };
    setForm(updated);
    setIsSaving(true);
    try {
      await updateHomeAdBanner(updated);
      showFeedback(
        nextEnabled
          ? 'تم إظهار البطاقة الإعلانية فوراً لجميع المستخدمين ✓'
          : 'تم إخفاء البطاقة الإعلانية فوراً عن جميع المستخدمين ✓',
        nextEnabled
          ? 'Ad card is now visible immediately for all users ✓'
          : 'Ad card is now hidden immediately for all users ✓'
      );
    } catch (e) {
      console.error('Toggle card visibility error:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleImmediateToggleButton = async () => {
    const nextBtnEnabled = !form.isButtonEnabled;
    const updated: HomeAdBannerConfig = { ...form, isButtonEnabled: nextBtnEnabled };
    setForm(updated);
    setIsSaving(true);
    try {
      await updateHomeAdBanner(updated);
      showFeedback(
        nextBtnEnabled
          ? 'تم تفعيل وإظهار زر البطاقة فوراً لجميع المستخدمين ✓'
          : 'تم إخفاء زر البطاقة فوراً لجميع المستخدمين ✓',
        nextBtnEnabled
          ? 'Card button enabled immediately for all users ✓'
          : 'Card button hidden immediately for all users ✓'
      );
    } catch (e) {
      console.error('Toggle button visibility error:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleImmediateToggleHideAll = async () => {
    const nextHidden = !form.isSectionHidden;
    const updated: HomeAdBannerConfig = { ...form, isSectionHidden: nextHidden };
    setForm(updated);
    setIsSaving(true);
    try {
      await updateHomeAdBanner(updated);
      showFeedback(
        nextHidden
          ? 'تم إخفاء القسم بالكامل (الإعلان وسجل الوجهات) فوراً عن جميع المستخدمين ✓'
          : 'تم إلغاء الإخفاء الشامل وإظهار القسم فوراً لجميع المستخدمين ✓',
        nextHidden
          ? 'Entire section (Ad Card & Direction History) hidden immediately for all users ✓'
          : 'Entire section visibility restored immediately for all users ✓'
      );
    } catch (e) {
      console.error('Toggle hide entire section error:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleImmediateToggleQuickDestinations = async () => {
    const currentlyEnabled = form.isQuickDestinationsEnabled !== false;
    const nextQuickEnabled = !currentlyEnabled;
    const updated: HomeAdBannerConfig = {
      ...form,
      isQuickDestinationsEnabled: nextQuickEnabled,
    };
    setForm(updated);
    setIsSaving(true);
    try {
      await updateHomeAdBanner(updated);
      showFeedback(
        nextQuickEnabled
          ? 'تم إظهار سجل الوجهات المقترحة أسفل البطاقة فوراً لجميع المستخدمين ✓'
          : 'تم إخفاء سجل الوجهات المقترحة أسفل البطاقة فوراً لجميع المستخدمين ✓',
        nextQuickEnabled
          ? 'Direction history & suggested places shown immediately for all users ✓'
          : 'Direction history & suggested places hidden immediately for all users ✓'
      );
    } catch (e) {
      console.error('Toggle quick destinations visibility error:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAll = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      await updateHomeAdBanner(form);
      isEditingRef.current = false;
      showFeedback(
        'تم حفظ وتحديث البطاقة الإعلانية فوراً لجميع المستخدمين ✓',
        'Ad banner card saved and updated immediately for all users ✓'
      );
    } catch (err) {
      console.error('Save home ad banner error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    const def = { ...(DEFAULT_HOME_AD_BANNER as HomeAdBannerConfig) };
    setForm(def);
    setIsSaving(true);
    try {
      await updateHomeAdBanner(def);
      isEditingRef.current = false;
      showFeedback(
        'تمت استعادة الإعدادات الافتراضية للبطاقة فوراً ✓',
        'Default banner settings restored immediately ✓'
      );
    } catch (err) {
      console.error('Reset home ad banner error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = <K extends keyof HomeAdBannerConfig>(
    key: K,
    value: HomeAdBannerConfig[K]
  ) => {
    isEditingRef.current = true;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const isPreviewRTL = previewLang === 'ar';
  const previewTopic = isPreviewRTL ? form.topicAr : form.topicEn;
  const previewSubTopic = isPreviewRTL ? form.subTopicAr : form.subTopicEn;
  const previewTitle = isPreviewRTL ? form.titleAr : form.titleEn;
  const previewText = isPreviewRTL ? form.textAr : form.textEn;
  const previewBadge = isPreviewRTL ? form.badgeTextAr : form.badgeTextEn;
  const previewBtn = isPreviewRTL ? form.buttonTextAr : form.buttonTextEn;

  return (
    <div
      className="bg-white p-8 sm:p-10 rounded-[40px] shadow-sm border border-gray-100 space-y-8 relative overflow-hidden"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#4C1D95] via-[#6D28D9] to-[#FF2E75] text-white flex items-center justify-center text-2xl shadow-md shadow-purple-500/20 shrink-0">
            <i className="fas fa-ad"></i>
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
              {isRTL
                ? 'إدارة البطاقة الإعلانية الترويجية في الشاشة الرئيسية'
                : 'Home Screen Promotional Ad Card Control'}
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 font-bold mt-0.5">
              {isRTL
                ? 'تحكم كامل في إظهار/إخفاء البطاقة، الموضوع، العنوان، النص، وتفعيل/إخفاء الزر وإجراء الضغط بتأثير فوري لجميع المستخدمين.'
                : 'Full real-time control over card visibility, topic, title, text, button visibility, and click action for all users.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleResetDefaults}
          disabled={isSaving}
          className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs transition-all active:scale-95 shrink-0 self-start sm:self-auto"
        >
          <i className="fas fa-undo-alt mx-1.5"></i>
          {isRTL ? 'استعادة الافتراضي' : 'Reset Default'}
        </button>
      </div>

      {/* Instant Master Toggles: Hide Entire Section, Show/Hide Card, Show/Hide Direction History, Button */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Toggle 0 (Master): Hide Entire Section (Ad Card + History of Directions) */}
        <div
          className={`p-5 rounded-3xl border transition-all flex items-center justify-between gap-4 ${
            form.isSectionHidden
              ? 'bg-rose-50/70 border-rose-200'
              : 'bg-gray-50 border-gray-200'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center text-lg shrink-0 ${
                form.isSectionHidden
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              <i className={`fas ${form.isSectionHidden ? 'fa-eye-slash' : 'fa-layer-group'}`}></i>
            </div>
            <div>
              <div className="font-black text-gray-900 text-sm">
                {isRTL
                  ? 'إخفاء القسم بالكامل (الإعلان + سجل الوجهات)'
                  : 'Hide Entire Section (Ad Card + Direction History)'}
              </div>
              <div className="text-xs font-bold text-gray-500 mt-0.5">
                {form.isSectionHidden
                  ? isRTL
                    ? 'تم إخفاء بطاقة الكابتن وسجل الوجهات بالأسفل بالكامل'
                    : 'Both Captain Ad Card & direction history below are hidden'
                  : isRTL
                  ? 'فعّل هذا الخيار لإخفاء البطاقة وسجل الوجهات المقترحة معاً'
                  : 'Enable to hide both the ad card and direction history together'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleImmediateToggleHideAll}
            disabled={isSaving}
            aria-label={isRTL ? 'إخفاء القسم بالكامل' : 'Hide entire section'}
            className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 flex items-center shrink-0 cursor-pointer ${
              form.isSectionHidden ? 'bg-rose-600' : 'bg-gray-300'
            }`}
          >
            <div
              className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 ${
                form.isSectionHidden ? (isRTL ? '-translate-x-6' : 'translate-x-6') : ''
              }`}
            />
          </button>
        </div>

        {/* Toggle 1: Show / Hide Direction History & Suggested Places Below */}
        <div
          className={`p-5 rounded-3xl border transition-all flex items-center justify-between gap-4 ${
            form.isQuickDestinationsEnabled !== false && !form.isSectionHidden
              ? 'bg-amber-50/60 border-amber-200'
              : 'bg-gray-50 border-gray-200'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center text-lg shrink-0 ${
                form.isQuickDestinationsEnabled !== false && !form.isSectionHidden
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              <i className="fas fa-history"></i>
            </div>
            <div>
              <div className="font-black text-gray-900 text-sm">
                {isRTL
                  ? 'إظهار سجل الوجهات المقترحة بالأسفل'
                  : 'Show Direction History & Suggested Places'}
              </div>
              <div className="text-xs font-bold text-gray-500 mt-0.5">
                {form.isSectionHidden
                  ? isRTL
                    ? 'مخفي حالياً لأن خيار الإخفاء الشامل مفعّل'
                    : 'Hidden while Hide Entire Section is active'
                  : form.isQuickDestinationsEnabled !== false
                  ? isRTL
                    ? 'سجل الوجهات السابقة ظاهر أسفل شريط التبديل'
                    : 'Direction history carousel is visible below'
                  : isRTL
                  ? 'سجل الوجهات مخفي (تظهر البطاقة الإعلانية فقط)'
                  : 'Direction history is hidden (ad card only)'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleImmediateToggleQuickDestinations}
            disabled={isSaving}
            aria-label={isRTL ? 'إظهار سجل الوجهات' : 'Show direction history'}
            className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 flex items-center shrink-0 cursor-pointer ${
              form.isQuickDestinationsEnabled !== false ? 'bg-amber-500' : 'bg-gray-300'
            }`}
          >
            <div
              className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 ${
                form.isQuickDestinationsEnabled !== false
                  ? isRTL
                    ? '-translate-x-6'
                    : 'translate-x-6'
                  : ''
              }`}
            />
          </button>
        </div>

        {/* Toggle 2: Show / Hide Captain Ad Card */}
        <div
          className={`p-5 rounded-3xl border transition-all flex items-center justify-between gap-4 ${
            form.isEnabled && !form.isSectionHidden
              ? 'bg-emerald-50/60 border-emerald-200'
              : 'bg-gray-50 border-gray-200'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center text-lg shrink-0 ${
                form.isEnabled && !form.isSectionHidden
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              <i className={`fas ${form.isEnabled ? 'fa-eye' : 'fa-eye-slash'}`}></i>
            </div>
            <div>
              <div className="font-black text-gray-900 text-sm">
                {isRTL
                  ? 'إظهار البطاقة الإعلانية للكابتن'
                  : 'Show Captain Ad Card to Users'}
              </div>
              <div className="text-xs font-bold text-gray-500 mt-0.5">
                {form.isSectionHidden
                  ? isRTL
                    ? 'مخفية حالياً لأن خيار الإخفاء الشامل مفعّل'
                    : 'Hidden while Hide Entire Section is active'
                  : form.isEnabled
                  ? isRTL
                    ? 'البطاقة ظاهرة ومفعلة حالياً في الشاشة الرئيسية'
                    : 'Card is currently visible on the Home Screen'
                  : isRTL
                  ? 'البطاقة مخفية حالياً عن جميع المستخدمين'
                  : 'Card is currently hidden for all users'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleImmediateToggleCard}
            disabled={isSaving}
            className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 flex items-center shrink-0 cursor-pointer ${
              form.isEnabled ? 'bg-emerald-600' : 'bg-gray-300'
            }`}
          >
            <div
              className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 ${
                form.isEnabled ? (isRTL ? '-translate-x-6' : 'translate-x-6') : ''
              }`}
            />
          </button>
        </div>

        {/* Toggle 3: Enable / Hide Action Button inside Card */}
        <div
          className={`p-5 rounded-3xl border transition-all flex items-center justify-between gap-4 ${
            form.isButtonEnabled
              ? 'bg-purple-50/60 border-purple-200'
              : 'bg-gray-50 border-gray-200'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center text-lg shrink-0 ${
                form.isButtonEnabled
                  ? 'bg-[#FF2E75] text-white shadow-sm'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              <i className="fas fa-hand-pointer"></i>
            </div>
            <div>
              <div className="font-black text-gray-900 text-sm">
                {isRTL
                  ? 'تفعيل وإظهار زر الإجراء داخل البطاقة'
                  : 'Enable Action Button Inside Card'}
              </div>
              <div className="text-xs font-bold text-gray-500 mt-0.5">
                {form.isButtonEnabled
                  ? isRTL
                    ? 'الزر الوردي مفعل وظاهر داخل البطاقة'
                    : 'Action button is visible inside the card'
                  : isRTL
                  ? 'الزر مخفي (تظهر البطاقة كإعلان بدون زر)'
                  : 'Action button is hidden'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleImmediateToggleButton}
            disabled={isSaving}
            className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 flex items-center shrink-0 cursor-pointer ${
              form.isButtonEnabled ? 'bg-[#FF2E75]' : 'bg-gray-300'
            }`}
          >
            <div
              className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 ${
                form.isButtonEnabled ? (isRTL ? '-translate-x-6' : 'translate-x-6') : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Live Preview Box */}
      <div className="p-5 rounded-3xl bg-gray-50 border border-gray-200/80 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse"></span>
            <span className="text-xs font-black uppercase tracking-wider text-gray-600">
              {isRTL ? 'معاينة حية مباشرة للبطاقة' : 'Live Card Preview'}
            </span>
            {form.isSectionHidden ? (
              <span className="text-xs font-black text-rose-600">
                · {isRTL ? '(القسم بالكامل مخفي: الإعلان + سجل الوجهات)' : '(Entire Section Hidden: Ad Card + History)'}
              </span>
            ) : !form.isEnabled ? (
              <span className="text-xs font-black text-red-600">
                · {isRTL ? '(البطاقة الإعلانية مخفية عن المستخدمين)' : '(Ad Card Hidden for Users)'}
              </span>
            ) : form.isQuickDestinationsEnabled === false ? (
              <span className="text-xs font-black text-amber-600">
                · {isRTL ? '(سجل الوجهات بالأسفل مخفي)' : '(Direction History Hidden)'}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200">
            <button
              type="button"
              onClick={() => setPreviewLang('ar')}
              className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                previewLang === 'ar'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              العربية
            </button>
            <button
              type="button"
              onClick={() => setPreviewLang('en')}
              className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                previewLang === 'en'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              English
            </button>
          </div>
        </div>

        {/* Exact Card Preview */}
        <div
          className={`relative w-full rounded-[24px] overflow-hidden p-3.5 sm:p-4 bg-gradient-to-r from-[#4C1D95] via-[#6D28D9] to-[#7C3AED] text-white shadow-[0_8px_25px_rgba(109,40,217,0.28)] border border-purple-400/20 flex items-center justify-between min-h-[88px] sm:min-h-[92px] select-none transition-opacity ${
            form.isEnabled && !form.isSectionHidden ? 'opacity-100' : 'opacity-45'
          }`}
          dir={isPreviewRTL ? 'rtl' : 'ltr'}
        >
          <div className="relative z-10 flex items-center gap-3 min-w-0 pr-1 flex-1">
            <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl overflow-hidden bg-purple-950/80 border border-white/20 shrink-0 shadow-md">
              <img
                src={form.imageUrl?.trim() || DEFAULT_HOME_AD_BANNER.imageUrl}
                alt="Preview"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    '/driver_banner_art_1791386105464.jpg';
                }}
              />
              {previewBadge && (
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent py-0.5 text-center">
                  <span className="text-[9px] font-black text-yellow-300">{previewBadge}</span>
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] sm:text-[11px] font-black tracking-widest uppercase text-pink-300 truncate">
                  {previewTopic || (isPreviewRTL ? 'عرض خاص' : 'SPECIAL OFFER')}
                </span>
                {previewSubTopic && (
                  <>
                    <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-white/40 shrink-0"></span>
                    <span className="hidden sm:inline-block text-[10px] text-purple-200 font-semibold truncate">
                      {previewSubTopic}
                    </span>
                  </>
                )}
              </div>

              <div className="text-sm sm:text-base font-black text-white leading-tight truncate">
                {previewTitle || (isPreviewRTL ? 'عنوان البطاقة' : 'Card Title')}
              </div>

              <div className="text-[11px] sm:text-xs text-purple-100/90 truncate mt-0.5 font-medium flex items-center gap-1.5">
                <i className="fas fa-check-circle text-[10px] text-emerald-400 shrink-0"></i>
                <span className="truncate">
                  {previewText || (isPreviewRTL ? 'النص التوضيحي للبطاقة' : 'Card subtitle text')}
                </span>
              </div>
            </div>
          </div>

          {form.isButtonEnabled && (
            <div className="relative z-10 shrink-0 flex items-center gap-2 pl-1">
              <span className="bg-[#FF2E75] text-white font-extrabold text-xs sm:text-sm px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-full shadow-[0_4px_14px_rgba(255,46,117,0.45)] flex items-center gap-1.5">
                <span>{previewBtn || (isPreviewRTL ? 'سجل الآن' : 'APPLY NOW')}</span>
                <i
                  className={`fas ${isPreviewRTL ? 'fa-arrow-left' : 'fa-arrow-right'} text-[10px]`}
                ></i>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Form Fields */}
      <form onSubmit={handleSaveAll} className="space-y-6">
        {/* Row 1: Topic / Kicker */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-black text-gray-500 uppercase tracking-wider mb-1.5 block">
              {isRTL ? 'الموضوع / الشارة العلوية (عربي)' : 'Topic / Kicker (Arabic)'}
            </label>
            <input
              type="text"
              dir="rtl"
              value={form.topicAr}
              onChange={(e) => updateField('topicAr', e.target.value)}
              placeholder="عرض خاص للكباتن"
              className="w-full p-3.5 bg-gray-50 rounded-2xl border border-gray-200 focus:bg-white focus:border-purple-600 outline-none font-bold text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-black text-gray-500 uppercase tracking-wider mb-1.5 block">
              {isRTL ? 'الموضوع / الشارة العلوية (English)' : 'Topic / Kicker (English)'}
            </label>
            <input
              type="text"
              dir="ltr"
              value={form.topicEn}
              onChange={(e) => updateField('topicEn', e.target.value)}
              placeholder="SPECIAL OFFER"
              className="w-full p-3.5 bg-gray-50 rounded-2xl border border-gray-200 focus:bg-white focus:border-purple-600 outline-none font-bold text-sm"
            />
          </div>
        </div>

        {/* Row 2: Secondary Topic */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-black text-gray-500 uppercase tracking-wider mb-1.5 block">
              {isRTL ? 'العنوان الفرعي العلوي (عربي - اختياري)' : 'Sub-Topic Tag (Arabic - Optional)'}
            </label>
            <input
              type="text"
              dir="rtl"
              value={form.subTopicAr || ''}
              onChange={(e) => updateField('subTopicAr', e.target.value)}
              placeholder="دخل يومي يصل لـ 15,000 ج.م"
              className="w-full p-3.5 bg-gray-50 rounded-2xl border border-gray-200 focus:bg-white focus:border-purple-600 outline-none font-bold text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-black text-gray-500 uppercase tracking-wider mb-1.5 block">
              {isRTL ? 'العنوان الفرعي العلوي (English - Optional)' : 'Sub-Topic Tag (English - Optional)'}
            </label>
            <input
              type="text"
              dir="ltr"
              value={form.subTopicEn || ''}
              onChange={(e) => updateField('subTopicEn', e.target.value)}
              placeholder="Earn up to 15,000 EGP"
              className="w-full p-3.5 bg-gray-50 rounded-2xl border border-gray-200 focus:bg-white focus:border-purple-600 outline-none font-bold text-sm"
            />
          </div>
        </div>

        {/* Row 3: Main Title */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-black text-gray-500 uppercase tracking-wider mb-1.5 block">
              {isRTL ? 'العنوان الرئيسي للبطاقة (عربي)' : 'Main Headline Title (Arabic)'}
            </label>
            <input
              type="text"
              dir="rtl"
              value={form.titleAr}
              onChange={(e) => updateField('titleAr', e.target.value)}
              placeholder="انضم ككابتن مع وصلني"
              className="w-full p-3.5 bg-gray-50 rounded-2xl border border-gray-200 focus:bg-white focus:border-purple-600 outline-none font-black text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-black text-gray-500 uppercase tracking-wider mb-1.5 block">
              {isRTL ? 'العنوان الرئيسي للبطاقة (English)' : 'Main Headline Title (English)'}
            </label>
            <input
              type="text"
              dir="ltr"
              value={form.titleEn}
              onChange={(e) => updateField('titleEn', e.target.value)}
              placeholder="DRIVE WITH WASLNY"
              className="w-full p-3.5 bg-gray-50 rounded-2xl border border-gray-200 focus:bg-white focus:border-purple-600 outline-none font-black text-sm"
            />
          </div>
        </div>

        {/* Row 4: Description Text */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-black text-gray-500 uppercase tracking-wider mb-1.5 block">
              {isRTL ? 'النص التوضيحي أسفل العنوان (عربي)' : 'Card Description Text (Arabic)'}
            </label>
            <input
              type="text"
              dir="rtl"
              value={form.textAr}
              onChange={(e) => updateField('textAr', e.target.value)}
              placeholder="عمولة 0% لأول شهر • تفعيل فوري في 15 دقيقة"
              className="w-full p-3.5 bg-gray-50 rounded-2xl border border-gray-200 focus:bg-white focus:border-purple-600 outline-none font-bold text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-black text-gray-500 uppercase tracking-wider mb-1.5 block">
              {isRTL ? 'النص التوضيحي أسفل العنوان (English)' : 'Card Description Text (English)'}
            </label>
            <input
              type="text"
              dir="ltr"
              value={form.textEn}
              onChange={(e) => updateField('textEn', e.target.value)}
              placeholder="0% fee 1st month • 15 min fast approval"
              className="w-full p-3.5 bg-gray-50 rounded-2xl border border-gray-200 focus:bg-white focus:border-purple-600 outline-none font-bold text-sm"
            />
          </div>
        </div>

        {/* Row 5: Thumbnail Badge & Image URL */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-[11px] font-black text-gray-500 uppercase tracking-wider mb-1.5 block">
              {isRTL ? 'شارة الصورة المصغرة (عربي)' : 'Thumbnail Badge (Arabic)'}
            </label>
            <input
              type="text"
              dir="rtl"
              value={form.badgeTextAr || ''}
              onChange={(e) => updateField('badgeTextAr', e.target.value)}
              placeholder="0% عمولة"
              className="w-full p-3.5 bg-gray-50 rounded-2xl border border-gray-200 focus:bg-white focus:border-purple-600 outline-none font-bold text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-black text-gray-500 uppercase tracking-wider mb-1.5 block">
              {isRTL ? 'شارة الصورة المصغرة (English)' : 'Thumbnail Badge (English)'}
            </label>
            <input
              type="text"
              dir="ltr"
              value={form.badgeTextEn || ''}
              onChange={(e) => updateField('badgeTextEn', e.target.value)}
              placeholder="0% Fee"
              className="w-full p-3.5 bg-gray-50 rounded-2xl border border-gray-200 focus:bg-white focus:border-purple-600 outline-none font-bold text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-black text-gray-500 uppercase tracking-wider mb-1.5 block">
              {isRTL ? 'رابط الصورة المصغرة (اختياري)' : 'Thumbnail Image URL'}
            </label>
            <input
              type="text"
              dir="ltr"
              value={form.imageUrl || ''}
              onChange={(e) => updateField('imageUrl', e.target.value)}
              placeholder="/assets/driver_banner_art_1791386105464.jpg"
              className="w-full p-3.5 bg-gray-50 rounded-2xl border border-gray-200 focus:bg-white focus:border-purple-600 outline-none font-mono text-xs"
            />
          </div>
        </div>

        {/* Row 6: Button Text & On-Press Action */}
        <div className="p-5 rounded-3xl bg-purple-50/40 border border-purple-100 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-black text-gray-900 text-sm flex items-center gap-2">
              <i className="fas fa-mouse-pointer text-[#FF2E75]"></i>
              <span>
                {isRTL
                  ? 'إعدادات نص الزر وإجراء الضغط (On Press Action)'
                  : 'Button Label & On-Press Action Settings'}
              </span>
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-black text-gray-500 uppercase tracking-wider mb-1.5 block">
                {isRTL ? 'نص الزر (عربي)' : 'Button Text (Arabic)'}
              </label>
              <input
                type="text"
                dir="rtl"
                value={form.buttonTextAr}
                onChange={(e) => updateField('buttonTextAr', e.target.value)}
                placeholder="سجل ككابتن الآن"
                className="w-full p-3.5 bg-white rounded-2xl border border-gray-200 focus:border-[#FF2E75] outline-none font-black text-sm"
              />
            </div>
            <div>
              <label className="text-[11px] font-black text-gray-500 uppercase tracking-wider mb-1.5 block">
                {isRTL ? 'نص الزر (English)' : 'Button Text (English)'}
              </label>
              <input
                type="text"
                dir="ltr"
                value={form.buttonTextEn}
                onChange={(e) => updateField('buttonTextEn', e.target.value)}
                placeholder="APPLY NOW"
                className="w-full p-3.5 bg-white rounded-2xl border border-gray-200 focus:border-[#FF2E75] outline-none font-black text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-black text-gray-500 uppercase tracking-wider mb-1.5 block">
                {isRTL
                  ? 'الإجراء عند الضغط على الزر أو البطاقة'
                  : 'Action When Button / Card is Pressed'}
              </label>
              <select
                value={form.buttonActionType}
                onChange={(e) =>
                  updateField('buttonActionType', e.target.value as HomeAdBannerActionType)
                }
                className="w-full p-3.5 bg-white rounded-2xl border border-gray-200 focus:border-purple-600 outline-none font-bold text-sm text-gray-900"
              >
                <option value="explainer_modal">
                  {isRTL
                    ? 'فتح نافذة شرح مميزات الكابتن والتسجيل (الافتراضي)'
                    : 'Open Captain Explainer Modal & Apply (Default)'}
                </option>
                <option value="driver_registration">
                  {isRTL
                    ? 'الانتقال المباشر لصفحة التسجيل ككابتن'
                    : 'Navigate Directly to Captain Registration'}
                </option>
                <option value="support_chat">
                  {isRTL
                    ? 'فتح محادثة خدمة العملاء المباشرة'
                    : 'Open Customer Service Live Chat'}
                </option>
                <option value="whatsapp">
                  {isRTL
                    ? 'فتح محادثة واتساب خدمة العملاء'
                    : 'Open WhatsApp Customer Support'}
                </option>
                <option value="profile">
                  {isRTL
                    ? 'فتح الملف الشخصي والمكافآت'
                    : 'Open User Profile & Rewards'}
                </option>
                <option value="external_url">
                  {isRTL ? 'فتح رابط خارجي مخصص (URL)' : 'Open Custom External Link (URL)'}
                </option>
                <option value="none">
                  {isRTL
                    ? 'بدون إجراء عند الضغط (عرض إعلاني فقط)'
                    : 'No Action on Press (Display Only)'}
                </option>
              </select>
            </div>

            {form.buttonActionType === 'external_url' && (
              <div>
                <label className="text-[11px] font-black text-gray-500 uppercase tracking-wider mb-1.5 block">
                  {isRTL ? 'الرابط الخارجي المخصص (URL)' : 'Custom Target URL'}
                </label>
                <input
                  type="url"
                  dir="ltr"
                  value={form.buttonActionUrl || ''}
                  onChange={(e) => updateField('buttonActionUrl', e.target.value)}
                  placeholder="https://example.com"
                  className="w-full p-3.5 bg-white rounded-2xl border border-gray-200 focus:border-purple-600 outline-none font-mono text-sm"
                />
              </div>
            )}
          </div>
        </div>

        {/* Save Button & Feedback */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-[#4C1D95] via-[#6D28D9] to-[#FF2E75] hover:opacity-95 disabled:opacity-50 text-white font-black text-sm shadow-lg shadow-purple-500/25 transition-all flex items-center justify-center gap-2.5 active:scale-95 cursor-pointer"
          >
            {isSaving ? (
              <i className="fas fa-spinner fa-spin"></i>
            ) : (
              <i className="fas fa-bolt"></i>
            )}
            <span>
              {isRTL
                ? 'حفظ وتعميم التغييرات فوراً لجميع المستخدمين'
                : 'Save & Publish Immediately to All Users'}
            </span>
          </button>

          {savedNotice && (
            <div className="flex items-center gap-2 text-emerald-600 font-black text-xs sm:text-sm animate-fade-in">
              <i className="fas fa-check-circle text-base"></i>
              <span>{savedNotice}</span>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};
