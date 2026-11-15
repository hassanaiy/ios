import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DriverAppExplainerModal } from './DriverAppExplainerModal';
import { HomeAdBannerConfig } from '../types';
import {
  subscribeToAppSettings,
  DEFAULT_HOME_AD_BANNER,
  DEFAULT_SUPPORT_WHATSAPP,
  formatWhatsAppUrl,
} from '../services/firebase';

export interface QuickPlace {
  id: string;
  name: string;
  address: string;
  type: string;
  coords: { lat: number; lng: number };
  dist?: number;
}

interface QuickDestinationsAndAdBannerProps {
  quickAccessPlaces: QuickPlace[];
  handleSelectPlace: (place: QuickPlace, type: 'dropoff') => void;
  getLocationIcon: (name: string, type: string) => string;
  onNavigate: (view: string) => void;
  isRTL: boolean;
  t: (key: string, defaultEn?: string, defaultAr?: string) => string;
  adBannerConfig?: HomeAdBannerConfig;
}

export const QuickDestinationsAndAdBanner: React.FC<QuickDestinationsAndAdBannerProps> = ({
  quickAccessPlaces,
  handleSelectPlace,
  getLocationIcon,
  onNavigate,
  isRTL,
  t,
  adBannerConfig,
}) => {
  const [liveBannerConfig, setLiveBannerConfig] = useState<HomeAdBannerConfig>(
    adBannerConfig || (DEFAULT_HOME_AD_BANNER as HomeAdBannerConfig)
  );
  const [supportWhatsapp, setSupportWhatsapp] = useState<string>(DEFAULT_SUPPORT_WHATSAPP);

  // Subscribe in real-time to global app settings so Admin changes take effect immediately for all users
  useEffect(() => {
    const unsub = subscribeToAppSettings((settings) => {
      if (settings?.homeAdBanner) {
        setLiveBannerConfig({
          ...(DEFAULT_HOME_AD_BANNER as HomeAdBannerConfig),
          ...settings.homeAdBanner,
        });
      } else {
        setLiveBannerConfig(DEFAULT_HOME_AD_BANNER as HomeAdBannerConfig);
      }
      if (settings?.supportWhatsappNumber && settings.supportWhatsappNumber.trim()) {
        setSupportWhatsapp(settings.supportWhatsappNumber.trim());
      } else {
        setSupportWhatsapp(DEFAULT_SUPPORT_WHATSAPP);
      }
    });
    return () => unsub();
  }, []);

  const banner: HomeAdBannerConfig = adBannerConfig
    ? { ...(DEFAULT_HOME_AD_BANNER as HomeAdBannerConfig), ...adBannerConfig }
    : liveBannerConfig;

  const isSectionHidden = banner.isSectionHidden === true;
  const isQuickDestinationsEnabled = banner.isQuickDestinationsEnabled !== false;
  const isBannerEnabled = banner.isEnabled !== false;
  const isButtonEnabled = banner.isButtonEnabled !== false;
  const hasPlaces =
    isQuickDestinationsEnabled &&
    Boolean(quickAccessPlaces && quickAccessPlaces.length > 0);

  // Mode: 'destinations' for first 10 seconds (one-time only), then transitions to 'banner' if enabled
  const [currentMode, setCurrentMode] = useState<'destinations' | 'banner'>(
    hasPlaces ? 'destinations' : 'banner'
  );
  const [isExplainerOpen, setIsExplainerOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const hasTransitionedOnceRef = useRef(false);

  // Keep mode valid when Admin toggles banner visibility or places load in real time
  useEffect(() => {
    if (!isBannerEnabled) {
      setCurrentMode('destinations');
      return;
    }
    if (!hasPlaces) {
      setCurrentMode('banner');
      return;
    }
    if (hasTransitionedOnceRef.current) return;
    if (isPaused) return;

    const timer = setTimeout(() => {
      if (isBannerEnabled) {
        setCurrentMode('banner');
        hasTransitionedOnceRef.current = true;
      }
    }, 10000);

    return () => clearTimeout(timer);
  }, [hasPlaces, isPaused, isBannerEnabled]);

  const handleApplyAsDriver = () => {
    setIsExplainerOpen(false);
    onNavigate('DRIVER_REGISTRATION');
  };

  const handleManualSwitch = (mode: 'destinations' | 'banner') => {
    if (mode === 'banner' && !isBannerEnabled) return;
    hasTransitionedOnceRef.current = true;
    setCurrentMode(mode);
  };

  const executeBannerAction = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const actionType = banner.buttonActionType || 'explainer_modal';

    switch (actionType) {
      case 'explainer_modal':
        setIsExplainerOpen(true);
        break;
      case 'driver_registration':
        onNavigate('DRIVER_REGISTRATION');
        break;
      case 'support_chat':
        onNavigate('ADMIN_CHAT');
        break;
      case 'whatsapp': {
        const waUrl = formatWhatsAppUrl(supportWhatsapp);
        const a = document.createElement('a');
        a.href = waUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        break;
      }
      case 'profile':
        onNavigate('PROFILE');
        break;
      case 'external_url': {
        const targetUrl = (banner.buttonActionUrl || '').trim();
        if (targetUrl) {
          const normalizedUrl =
            targetUrl.startsWith('http://') || targetUrl.startsWith('https://')
              ? targetUrl
              : `https://${targetUrl}`;
          const a = document.createElement('a');
          a.href = normalizedUrl;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
        break;
      }
      case 'none':
      default:
        break;
    }
  };

  // If the admin hid the entire section, or disabled the card AND quick places are hidden/empty, hide everything cleanly
  if (isSectionHidden || (!isBannerEnabled && !hasPlaces)) {
    return null;
  }

  const effectiveMode: 'destinations' | 'banner' =
    !isBannerEnabled ? 'destinations' : !hasPlaces ? 'banner' : currentMode;

  const topicText = isRTL
    ? banner.topicAr || DEFAULT_HOME_AD_BANNER.topicAr
    : banner.topicEn || DEFAULT_HOME_AD_BANNER.topicEn;
  const subTopicText = isRTL
    ? banner.subTopicAr ?? DEFAULT_HOME_AD_BANNER.subTopicAr
    : banner.subTopicEn ?? DEFAULT_HOME_AD_BANNER.subTopicEn;
  const titleText = isRTL
    ? banner.titleAr || DEFAULT_HOME_AD_BANNER.titleAr
    : banner.titleEn || DEFAULT_HOME_AD_BANNER.titleEn;
  const bodyText = isRTL
    ? banner.textAr || DEFAULT_HOME_AD_BANNER.textAr
    : banner.textEn || DEFAULT_HOME_AD_BANNER.textEn;
  const badgeText = isRTL
    ? banner.badgeTextAr ?? DEFAULT_HOME_AD_BANNER.badgeTextAr
    : banner.badgeTextEn ?? DEFAULT_HOME_AD_BANNER.badgeTextEn;
  const buttonText = isRTL
    ? banner.buttonTextAr || DEFAULT_HOME_AD_BANNER.buttonTextAr
    : banner.buttonTextEn || DEFAULT_HOME_AD_BANNER.buttonTextEn;
  const imageSrc = banner.imageUrl?.trim() || DEFAULT_HOME_AD_BANNER.imageUrl;
  const isClickableCard = banner.buttonActionType !== 'none';

  return (
    <div
      className="relative w-full px-0"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Top micro controls: Choice Chips on the left side, Title on the right */}
      {hasPlaces && (
        <div
          className="flex items-center justify-between pb-1.5 px-2 text-[11px] text-gray-400 font-semibold select-none"
          dir="ltr"
        >
          {/* Choice Chips on the Left Side */}
          <div className="flex items-center bg-gray-100/90 rounded-full p-0.5 border border-gray-200/60 shadow-xs">
            {/* Destination Chip */}
            <button
              type="button"
              onClick={() => handleManualSwitch('destinations')}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all flex items-center gap-1.5 ${
                effectiveMode === 'destinations'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-400 hover:text-gray-700'
              }`}
              title={isRTL ? 'عرض الوجهات' : 'Show Destinations'}
            >
              <i className="fas fa-map-marker-alt text-[9px]"></i>
              <span>{t('quick_places', 'Places', 'الوجهات')}</span>
            </button>

            {/* Driver Banner Chip (Only shown if Banner is enabled by Admin) */}
            {isBannerEnabled && (
              <button
                type="button"
                onClick={() => handleManualSwitch('banner')}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all flex items-center gap-1.5 ${
                  effectiveMode === 'banner'
                    ? 'bg-gradient-to-r from-[#6D28D9] to-[#FF2E75] text-white shadow-xs'
                    : 'text-gray-400 hover:text-gray-700'
                }`}
                title={isRTL ? 'عرض الإعلان' : 'Show Promo Banner'}
              >
                <i className="fas fa-car text-[9px]"></i>
                <span>{t('captain_title', 'Captain', 'كابتن')}</span>
              </button>
            )}
          </div>

          {/* Section Title on the other side */}
          <div className="flex items-center gap-1.5" dir={isRTL ? 'rtl' : 'ltr'}>
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
            <span className="text-gray-500">
              {effectiveMode === 'destinations'
                ? t('suggested_destinations', 'Suggested Destinations', 'الوجهات المقترحة')
                : topicText}
            </span>
          </div>
        </div>
      )}

      {/* Main Switchable Section with Animated Transition */}
      <div className="min-h-[88px] sm:min-h-[92px] relative">
        <AnimatePresence mode="wait">
          {effectiveMode === 'destinations' && hasPlaces ? (
            <motion.div
              key="destinations-view"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.45, ease: 'easeInOut' }}
              className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar snap-x snap-mandatory"
            >
              {quickAccessPlaces.slice(0, 10).map((place, idx) => (
                <button
                  key={`${place.id}-${idx}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectPlace({ ...place, coords: place.coords }, 'dropoff');
                  }}
                  className="min-w-[70%] sm:min-w-[280px] snap-center flex items-center p-3.5 sm:p-4 bg-white hover:bg-gray-50 rounded-[24px] transition-all duration-300 shadow-[0_2px_15px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_25px_rgba(0,0,0,0.08)] border border-gray-100 gap-3.5 group active:scale-95"
                >
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#FFC90E]/15 flex items-center justify-center shrink-0 transition-transform duration-500 group-hover:rotate-12">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#FFC90E] flex items-center justify-center shadow-md shadow-yellow-200">
                      <i
                        className={`fas ${getLocationIcon(place.name, place.type)} text-gray-900 text-base sm:text-lg`}
                      ></i>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 text-left rtl:text-right">
                    <div
                      className="font-black text-gray-900 text-base sm:text-lg truncate leading-tight group-hover:text-[#FFC90E] transition-colors"
                      dir="auto"
                    >
                      {place.name}
                    </div>
                    <div
                      className="text-xs text-gray-400 truncate mt-1 font-bold flex items-center gap-1"
                      dir="auto"
                    >
                      <i className="fas fa-location-arrow text-[10px] opacity-50"></i>
                      <span>{place.address}</span>
                    </div>
                  </div>
                </button>
              ))}
            </motion.div>
          ) : isBannerEnabled ? (
            <motion.div
              key="driver-banner-view"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.45, ease: 'easeInOut' }}
              onClick={isClickableCard ? executeBannerAction : undefined}
              className={`relative w-full rounded-[24px] overflow-hidden p-3.5 sm:p-4 bg-gradient-to-r from-[#4C1D95] via-[#6D28D9] to-[#7C3AED] text-white shadow-[0_8px_25px_rgba(109,40,217,0.28)] border border-purple-400/20 flex items-center justify-between min-h-[88px] sm:min-h-[92px] group select-none ${
                isClickableCard ? 'cursor-pointer active:scale-[0.99] transition-transform' : ''
              }`}
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              {/* Background Fluid Wave Graphics */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <svg
                  className="absolute -right-8 -bottom-12 w-64 h-64 text-purple-400/20 transform rotate-12"
                  viewBox="0 0 200 200"
                  fill="currentColor"
                >
                  <path
                    d="M41.7,-58.5C53.7,-51.7,63,-39.8,68.5,-25.9C73.9,-12,75.4,3.8,70.9,17.7C66.4,31.5,55.8,43.3,43.3,53.2C30.7,63.1,16.2,71,-0.2,71.3C-16.6,71.5,-32.1,64.2,-44.8,53.7C-57.5,43.3,-67.4,29.7,-70.6,14.6C-73.8,-0.5,-70.3,-17,-61.7,-30.2C-53.1,-43.3,-39.4,-53.1,-25.6,-59.2C-11.8,-65.3,2.1,-67.7,15.7,-65.4C29.4,-63.1,42.7,-56.1,41.7,-58.5Z"
                    transform="translate(100 100)"
                  />
                </svg>

                <svg
                  className="absolute -left-10 -top-10 w-52 h-52 text-indigo-400/15"
                  viewBox="0 0 200 200"
                  fill="currentColor"
                >
                  <path
                    d="M48.2,-67.3C61.4,-57.4,70.3,-42.6,75.3,-26.7C80.3,-10.8,81.4,6.2,76.6,21.8C71.8,37.3,61,51.5,47.1,61.9C33.1,72.4,16.1,79.2,-1.3,81C-18.7,82.8,-36.4,79.6,-50.2,70C-64,60.4,-73.9,44.4,-78.9,27.3C-83.9,10.2,-83.9,-8,-77.8,-24C-71.6,-40,-59.3,-53.7,-44.6,-63.3C-29.9,-72.9,-12.8,-78.4,2.9,-82.4C18.6,-86.3,34.9,-77.2,48.2,-67.3Z"
                    transform="translate(100 100)"
                  />
                </svg>

                <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-36 h-36 bg-pink-500/15 rounded-full blur-2xl"></div>
              </div>

              {/* Left / Start Content: Thumbnail + Topic + Title + Text */}
              <div className="relative z-10 flex items-center gap-3 min-w-0 pr-1 flex-1">
                <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl overflow-hidden bg-purple-950/80 border border-white/20 shrink-0 shadow-md group-hover:scale-105 transition-transform duration-300">
                  <img
                    src={imageSrc}
                    alt={titleText}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src =
                        '/driver_banner_art_1791386105464.jpg';
                    }}
                  />
                  {badgeText && (
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent py-0.5 text-center">
                      <span className="text-[9px] font-black text-yellow-300">{badgeText}</span>
                    </div>
                  )}
                </div>

                {/* Text Block */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] sm:text-[11px] font-black tracking-widest uppercase text-pink-300 drop-shadow-xs truncate">
                      {topicText}
                    </span>
                    {subTopicText && (
                      <>
                        <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-white/40 shrink-0"></span>
                        <span className="hidden sm:inline-block text-[10px] text-purple-200 font-semibold truncate">
                          {subTopicText}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Main Bold Headline */}
                  <div className="text-sm sm:text-base font-black text-white leading-tight truncate drop-shadow-sm group-hover:text-pink-200 transition-colors">
                    {titleText}
                  </div>

                  {/* Subtitle / Description */}
                  <div className="text-[11px] sm:text-xs text-purple-100/90 truncate mt-0.5 font-medium flex items-center gap-1.5">
                    <i className="fas fa-check-circle text-[10px] text-emerald-400 shrink-0"></i>
                    <span className="truncate">{bodyText}</span>
                  </div>
                </div>
              </div>

              {/* Right / End Content: Action Button (Only rendered when enabled by Admin) */}
              {isButtonEnabled && (
                <div className="relative z-10 shrink-0 flex items-center gap-2 pl-1">
                  <button
                    type="button"
                    onClick={executeBannerAction}
                    className="bg-[#FF2E75] hover:bg-[#FF1260] active:scale-95 text-white font-extrabold text-xs sm:text-sm px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-full shadow-[0_4px_14px_rgba(255,46,117,0.45)] hover:shadow-[0_6px_20px_rgba(255,46,117,0.6)] transition-all flex items-center gap-1.5 cursor-pointer transform group-hover:scale-105"
                  >
                    <span>{buttonText}</span>
                    <i
                      className={`fas ${isRTL ? 'fa-arrow-left' : 'fa-arrow-right'} text-[10px]`}
                    ></i>
                  </button>
                </div>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Explainer Modal */}
      <DriverAppExplainerModal
        isOpen={isExplainerOpen}
        onClose={() => setIsExplainerOpen(false)}
        onApplyAsDriver={handleApplyAsDriver}
        isRTL={isRTL}
      />
    </div>
  );
};
