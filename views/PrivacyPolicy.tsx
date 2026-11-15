import React, { useEffect, useState } from 'react';
import {
  PRIVACY_POLICY_CONTENT,
  PRIVACY_PUBLIC_URL,
  PRIVACY_CONTACT_EMAIL,
  PrivacyLanguageContent,
  PrivacySection,
} from '../data/privacyPolicyData';
import { useLanguage } from '../contexts/LanguageContext';

type PolicyViewLang = 'ar' | 'en' | 'both';

interface PrivacyPolicyProps {
  isStandalone?: boolean;
  onBack?: () => void;
}

function resolveInitialLang(contextLang: 'ar' | 'en'): PolicyViewLang {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const qLang = params.get('lang')?.toLowerCase();
    if (qLang === 'en' || qLang === 'ar' || qLang === 'both') {
      return qLang;
    }
    const navLang = (navigator.language || '').toLowerCase();
    if (navLang.startsWith('en') && !localStorage.getItem('mowasla_lang')) {
      return 'en';
    }
  }
  return contextLang;
}

function PolicyArticle({
  doc,
  isDualMode,
}: {
  doc: PrivacyLanguageContent;
  isDualMode: boolean;
}) {
  const isAr = doc.langCode === 'ar';

  return (
    <article
      id={`policy-${doc.langCode}`}
      dir={doc.dir}
      lang={doc.langCode}
      className="bg-white border border-stone-200 rounded-2xl px-6 py-8 sm:px-12 sm:py-12 shadow-xs"
      style={{
        fontFamily: isAr
          ? "'Cairo', 'Alexandria', system-ui, -apple-system, sans-serif"
          : "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Editorial Document Header */}
      <header className="pb-8 border-b border-stone-200">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-medium text-stone-500 tabular-nums mb-4">
          <span>{doc.appName}</span>
          <span aria-hidden="true">·</span>
          <span>
            {doc.lastUpdatedLabel} {doc.lastUpdatedDate}
          </span>
          <span aria-hidden="true">·</span>
          <span>{doc.docCategory}</span>
        </div>

        <h1
          className="text-3xl sm:text-4xl font-black text-stone-900 tracking-tight leading-tight"
          style={{ textWrap: 'balance' }}
        >
          {doc.pageTitle}
        </h1>

        {isDualMode && (
          <p className="mt-3 text-xs font-semibold text-stone-500">
            {isAr ? 'النسخة العربية الرسمية' : 'Official English Version'}
          </p>
        )}
      </header>

      {/* Sections 01 - 07 */}
      <div className="divide-y divide-stone-200/80">
        {doc.sections.map((section: PrivacySection) => (
          <section
            key={`${doc.langCode}-${section.id}`}
            id={`${doc.langCode}-${section.id}`}
            className="py-7 sm:py-8 scroll-mt-24"
          >
            <div className="flex items-baseline gap-3 mb-3">
              <span className="text-xs font-mono font-semibold text-stone-400 tabular-nums shrink-0">
                {section.number}
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-stone-900 leading-snug">
                {section.title.replace(/^\d+\.\s*/, '')}
              </h2>
            </div>

            {section.intro && (
              <p className="text-[15px] sm:text-base text-stone-700 leading-[1.85] max-w-[68ch]">
                {section.intro}
              </p>
            )}

            {section.bullets && section.bullets.length > 0 && (
              <ul className="mt-4 space-y-3.5 max-w-[68ch]">
                {section.bullets.map((bullet, idx) => (
                  <li key={idx} className="text-[15px] sm:text-base text-stone-700 leading-[1.8]">
                    <div className="flex items-start gap-3">
                      <span
                        aria-hidden="true"
                        className="mt-2.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"
                      />
                      <div className="flex-1">
                        {bullet.label && (
                          <strong className="font-bold text-stone-900">
                            {bullet.label}{' '}
                          </strong>
                        )}
                        {bullet.text && <span>{bullet.text}</span>}
                      </div>
                    </div>

                    {bullet.subItems && bullet.subItems.length > 0 && (
                      <ul className="mt-2.5 ms-6 space-y-2.5 border-s border-stone-200 ps-4">
                        {bullet.subItems.map((sub, subIdx) => (
                          <li
                            key={subIdx}
                            className="text-sm sm:text-[15px] text-stone-600 leading-[1.8]"
                          >
                            {sub.label && (
                              <strong className="font-bold text-stone-900">
                                {sub.label}{' '}
                              </strong>
                            )}
                            <span>{sub.text}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {section.contactEmail && (
              <div className="mt-4 pt-3 flex flex-wrap items-center gap-3 text-sm sm:text-base">
                <span className="font-semibold text-stone-600">
                  {isAr ? 'البريد الإلكتروني:' : 'Email:'}
                </span>
                <a
                  href={`mailto:${section.contactEmail}`}
                  className="font-bold text-stone-900 underline decoration-amber-400 decoration-2 underline-offset-4 hover:text-amber-700 transition-colors"
                  dir="ltr"
                >
                  {section.contactEmail}
                </a>
              </div>
            )}
          </section>
        ))}
      </div>
    </article>
  );
}

export default function PrivacyPolicy({ isStandalone = false, onBack }: PrivacyPolicyProps) {
  const { language, setLanguage } = useLanguage();
  const [viewLang, setViewLang] = useState<PolicyViewLang>(() => resolveInitialLang(language));
  const [copiedLink, setCopiedLink] = useState(false);

  const activeSingleDoc =
    viewLang === 'en' ? PRIVACY_POLICY_CONTENT.en : PRIVACY_POLICY_CONTENT.ar;
  const pageDir: 'rtl' | 'ltr' = viewLang === 'en' ? 'ltr' : 'rtl';

  useEffect(() => {
    const splash = document.getElementById('initial-splash');
    if (splash) splash.remove();

    document.title =
      viewLang === 'en'
        ? 'Mowasla Privacy Policy'
        : viewLang === 'ar'
        ? 'سياسة الخصوصية لتطبيق مواصلة'
        : 'Mowasla Privacy Policy | سياسة الخصوصية لتطبيق مواصلة';
  }, [viewLang]);

  const handleSelectLanguage = (nextLang: PolicyViewLang) => {
    setViewLang(nextLang);
    if (nextLang === 'ar' || nextLang === 'en') {
      setLanguage(nextLang);
    }
    if (typeof window !== 'undefined' && isStandalone) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('lang', nextLang);
        window.history.replaceState({}, '', url.toString());
      } catch {}
    }
  };

  const handleCopyUrl = async () => {
    const targetUrl =
      typeof window !== 'undefined' && window.location.hostname !== 'localhost'
        ? `${window.location.origin}/privacy-policy`
        : PRIVACY_PUBLIC_URL;
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2400);
    } catch {}
  };

  const navContent = viewLang === 'en' ? PRIVACY_POLICY_CONTENT.en : PRIVACY_POLICY_CONTENT.ar;
  const anchorPrefix = viewLang === 'en' ? 'en' : 'ar';

  return (
    <div
      className="min-h-screen h-[100dvh] overflow-y-auto bg-[#FBF9F5] text-stone-900"
      dir={pageDir}
    >
      {/* Clean 3-Zone Editorial Top Bar */}
      <header className="sticky top-0 z-20 bg-[#FBF9F5]/95 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-6">
          {/* Zone 1: Single-line Wordmark */}
          <a
            href="/"
            onClick={(e) => {
              if (onBack) {
                e.preventDefault();
                onBack();
              }
            }}
            className="text-lg font-black tracking-tight text-stone-900 whitespace-nowrap shrink-0"
          >
            {viewLang === 'en' ? 'Mowasla' : 'مواصلة'}
          </a>

          {/* Zone 2: Concise Anchor Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-stone-600">
            <a
              href={`#${anchorPrefix}-introduction`}
              className="hover:text-stone-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              {navContent.navLabels.overview}
            </a>
            <a
              href={`#${anchorPrefix}-information-collected`}
              className="hover:text-stone-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              {navContent.navLabels.data}
            </a>
            <a
              href={`#${anchorPrefix}-retention-deletion`}
              className="hover:text-stone-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              {navContent.navLabels.deletion}
            </a>
            <a
              href={`#${anchorPrefix}-contact`}
              className="hover:text-stone-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              {navContent.navLabels.contact}
            </a>
          </nav>

          {/* Zone 3: Primary Action */}
          <div className="flex items-center shrink-0">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="px-4 py-2 text-xs sm:text-sm font-bold text-stone-900 bg-[#FFC90E] hover:bg-amber-400 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {viewLang === 'en' ? 'Back to App' : 'العودة للتطبيق'}
              </button>
            ) : (
              <a
                href="/"
                className="px-4 py-2 text-xs sm:text-sm font-bold text-stone-900 bg-[#FFC90E] hover:bg-amber-400 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                {viewLang === 'en' ? 'Open Mowasla' : 'فتح التطبيق'}
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        {/* Document Utility Toolbar (Language Switcher + Direct Link) */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div
            role="group"
            aria-label="Privacy policy language"
            className="inline-flex items-center gap-1 p-1 bg-stone-200/70 rounded-xl w-fit"
            dir="ltr"
          >
            <button
              type="button"
              onClick={() => handleSelectLanguage('ar')}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                viewLang === 'ar'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              العربية
            </button>
            <button
              type="button"
              onClick={() => handleSelectLanguage('en')}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                viewLang === 'en'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => handleSelectLanguage('both')}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                viewLang === 'both'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              العربية & English
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500">
            <button
              type="button"
              onClick={handleCopyUrl}
              className="px-3 py-2 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 font-semibold transition-colors whitespace-nowrap cursor-pointer"
            >
              {copiedLink
                ? viewLang === 'en'
                  ? 'Link Copied'
                  : 'تم نسخ الرابط'
                : viewLang === 'en'
                ? 'Copy Direct Link'
                : 'نسخ الرابط المباشر'}
            </button>
            <a
              href={`mailto:${PRIVACY_CONTACT_EMAIL}`}
              className="text-stone-600 hover:text-stone-900 underline underline-offset-4 whitespace-nowrap"
              dir="ltr"
            >
              {PRIVACY_CONTACT_EMAIL}
            </a>
          </div>
        </div>

        {/* Policy Body */}
        {viewLang === 'both' ? (
          <div className="space-y-8">
            <PolicyArticle doc={PRIVACY_POLICY_CONTENT.ar} isDualMode />
            <PolicyArticle doc={PRIVACY_POLICY_CONTENT.en} isDualMode />
          </div>
        ) : (
          <PolicyArticle doc={activeSingleDoc} isDualMode={false} />
        )}

        {/* Quiet Legal Footer */}
        <footer className="mt-10 pt-6 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500">
          <span>
            &copy; {new Date().getFullYear()} Mowasla · {PRIVACY_PUBLIC_URL}
          </span>
          <div className="flex items-center gap-4">
            <a
              href={`mailto:${PRIVACY_CONTACT_EMAIL}`}
              className="hover:text-stone-900 underline underline-offset-4"
              dir="ltr"
            >
              {PRIVACY_CONTACT_EMAIL}
            </a>
            <span aria-hidden="true">·</span>
            <a href="/" className="hover:text-stone-900 underline underline-offset-4">
              {viewLang === 'en' ? 'Home' : 'الصفحة الرئيسية'}
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}