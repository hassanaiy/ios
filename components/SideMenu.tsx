import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Driver, UserRole, AppSettings } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { checkIsAdmin, subscribeToAppSettings, DEFAULT_SIDE_MENU_CONFIG } from '../services/firebase';
import { SupportOptionsModal } from './SupportOptionsModal';

interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | Driver;
  onNavigate: (view: any) => void;
  onLogout: () => void;
  onToggleDriverMode: () => void;
  isDriverMode: boolean;
  appSettings?: AppSettings | null;
}

const formatExternalLink = (rawUrl?: string): string => {
  if (!rawUrl || !rawUrl.trim()) return '';
  const trimmed = rawUrl.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

export const SideMenu: React.FC<SideMenuProps> = ({ 
  isOpen, onClose, user, onNavigate, onLogout, onToggleDriverMode, isDriverMode, appSettings: propAppSettings
}) => {
  const { t, isRTL } = useLanguage();
  const [showSupportOptions, setShowSupportOptions] = useState(false);
  const [liveSettings, setLiveSettings] = useState<AppSettings | null>(propAppSettings || null);

  useEffect(() => {
    if (propAppSettings) {
      setLiveSettings(propAppSettings);
    }
  }, [propAppSettings]);

  useEffect(() => {
    const unsub = subscribeToAppSettings((settings) => {
      if (settings) setLiveSettings(settings);
    });
    return () => unsub();
  }, []);

  const sideMenuConfig = {
    ...DEFAULT_SIDE_MENU_CONFIG,
    ...(liveSettings?.sideMenuConfig || {}),
  };

  const isSocialSectionVisible = sideMenuConfig.isSectionEnabled !== false;
  const socialItems = [
    {
      key: 'facebook',
      enabled: sideMenuConfig.isFacebookEnabled !== false,
      url: formatExternalLink(sideMenuConfig.facebookUrl),
      icon: 'fab fa-facebook-f',
      label: 'Facebook',
      colorClass: 'text-[#1877F2] bg-blue-50/80 hover:bg-[#1877F2] hover:text-white border-blue-100',
    },
    {
      key: 'website',
      enabled: sideMenuConfig.isWebsiteEnabled !== false,
      url: formatExternalLink(sideMenuConfig.websiteUrl),
      icon: 'fas fa-globe',
      label: isRTL ? 'الموقع الإلكتروني' : 'Website',
      colorClass: 'text-emerald-600 bg-emerald-50/80 hover:bg-emerald-600 hover:text-white border-emerald-100',
    },
    {
      key: 'tiktok',
      enabled: sideMenuConfig.isTiktokEnabled !== false,
      url: formatExternalLink(sideMenuConfig.tiktokUrl),
      icon: 'fab fa-tiktok',
      label: 'TikTok',
      colorClass: 'text-gray-900 bg-gray-100/90 hover:bg-gray-900 hover:text-white border-gray-200',
    },
    {
      key: 'instagram',
      enabled: sideMenuConfig.isInstagramEnabled !== false,
      url: formatExternalLink(sideMenuConfig.instagramUrl),
      icon: 'fab fa-instagram',
      label: 'Instagram',
      colorClass: 'text-[#E4405F] bg-pink-50/80 hover:bg-gradient-to-tr hover:from-amber-500 hover:via-pink-500 hover:to-purple-600 hover:text-white border-pink-100',
    },
  ].filter(item => item.enabled);

  return (
    <>
      <div 
        className={`fixed inset-0 z-50 flex ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
      >
        {/* Backdrop */}
        <div 
           className={`absolute inset-0 bg-gray-900/60 transition-opacity duration-200 ease-out ${isOpen ? 'opacity-100' : 'opacity-0'}`}
           onClick={onClose}
           style={{ willChange: 'opacity' }}
        ></div>

        {/* Menu Panel */}
        <div 
          className={`relative w-72 h-full glass-card border-l-0 shadow-[20px_0_40px_rgba(0,0,0,0.1)] flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isOpen ? 'translate-x-0' : (isRTL ? 'translate-x-full' : '-translate-x-full')
          } ${isRTL ? 'ml-auto rounded-l-3xl' : 'mr-auto rounded-r-3xl'}`}
          style={{ willChange: 'transform' }}
        >
          <div className="px-4 pt-safe pb-[15px] flex flex-col h-full overflow-y-auto">
              
              {/* User Header */}
              <div className="flex items-center gap-3 mb-4 mt-3 px-1">
                  <img src={user.avatar} alt={user.name} className="w-9 h-9 rounded-full border-2 border-gray-50 shadow-sm object-cover shrink-0" />
                  <div className="min-w-0">
                      <h2 className="font-bold text-sm text-gray-900 truncate">{user.name}</h2>
                      <div className="flex items-center gap-1 text-yellow-500 text-xs font-bold mt-0.5 tabular-nums">
                          5.0 <i className="fas fa-star text-[10px]"></i>
                      </div>
                  </div>
              </div>

              {/* Links */}
              <nav className="space-y-0.5">
                  <MenuLink icon="fa-map-marked-alt" label={t('home')} onClick={() => {onNavigate('HOME'); onClose();}} />
                  
                  {/* Specific Driver Menu Items */}
                  {isDriverMode && (
                      <>
                          <div className="pt-1.5 pb-0.5 px-2.5 text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('driver_mode')}</div>
                          <MenuLink icon="fa-money-bill-transfer" label={t('menu_checkouts')} onClick={() => {onNavigate('DRIVER_CHECKOUTS'); onClose();}} />
                          <MenuLink icon="fa-calendar-alt" label={t('work_schedule')} onClick={() => {onNavigate('DUTY_SCHEDULE'); onClose();}} />
                          <div className="border-t border-gray-100 my-1.5"></div>
                      </>
                  )}

                  <MenuLink icon="fa-user" label={t('personal_details')} onClick={() => {onNavigate('PROFILE'); onClose();}} />
                  <MenuLink icon="fa-history" label={t('rides')} onClick={() => {onNavigate('HISTORY'); onClose();}} />
                  
                  {!isDriverMode && (
                     <MenuLink icon="fa-comment-dots" label={t('messages_label')} onClick={() => {onNavigate('MESSAGES_LIST'); onClose();}} />
                  )}

                  <MenuLink icon="fa-shield-halved" label={isRTL ? "السلامة" : "Safety"} onClick={() => {onNavigate('SAFETY'); onClose();}} />
                  <MenuLink icon="fa-cog" label={t('settings')} onClick={() => {onNavigate('PROFILE'); onClose();}} />
                  <MenuLink icon="fa-headset" label={isRTL ? "تحدث معنا" : "Support"} onClick={() => { setShowSupportOptions(true); }} />
                  
                  {/* Admin Only Link */}
                  {user.role === UserRole.ADMIN && checkIsAdmin(user.email, user.phone) && (
                      <MenuLink 
                          icon="fa-clock" 
                          label={t('dashboard_clock')} 
                          onClick={() => { onNavigate('HOME'); onClose(); }} 
                      />
                  )}
              </nav>

              {/* Bottom Section: Driver/Passenger Toggle, Logout, Social Icons & App Version (moved down with 15px bottom padding) */}
              <div className="mt-auto pt-4 border-t border-gray-100/90 px-1 flex flex-col gap-2.5">
                  <motion.button 
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={onToggleDriverMode}
                    className={`w-full p-3 rounded-xl flex items-center justify-between transition-colors shadow-md overflow-hidden relative group ${
                        isDriverMode ? 'bg-[#6C63FF] text-white hover:bg-[#5A52D5]' : 'bg-[#FFC90E] text-gray-900 hover:bg-[#e4b40a]'
                    }`}
                  >
                     {/* Animated Background Shimmer effect */}
                     <motion.div 
                         className="absolute top-0 bottom-0 w-12 bg-white pointer-events-none opacity-[0.15] blur-sm skew-x-[-20deg]"
                         initial={{ left: '-100%' }}
                         animate={{ left: '200%' }}
                         transition={{ duration: 2.5, ease: 'easeInOut', repeat: Infinity, repeatDelay: 1 }}
                     />
                     
                     <div className="flex items-center gap-2.5 relative z-10">
                        <motion.div 
                            className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-base backdrop-blur-sm shrink-0"
                        >
                            <AnimatePresence mode="wait">
                                <motion.i 
                                    key={isDriverMode ? 'driver' : 'passenger'}
                                    initial={{ rotateY: -90, opacity: 0 }}
                                    animate={{ rotateY: 0, opacity: 1 }}
                                    exit={{ rotateY: 90, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className={`fas ${isDriverMode ? 'fa-user' : 'fa-car'}`}
                                ></motion.i>
                            </AnimatePresence>
                        </motion.div>
                        <div className="text-left rtl:text-right">
                            <div className="font-extrabold text-[13px] leading-tight">{t('driver_mode')}</div>
                            <div className="text-[10px] font-bold opacity-90">{isDriverMode ? t('switch_to_passenger') : t('switch_to_driver')}</div>
                        </div>
                     </div>
                     
                     <motion.div
                         whileHover={{ rotate: 180 }}
                         transition={{ type: "spring", stiffness: 200, damping: 10 }}
                         className="relative z-10 w-7 h-7 rounded-full bg-black/5 flex items-center justify-center opacity-80 group-hover:opacity-100 shrink-0"
                     >
                         <i className="fas fa-exchange-alt text-xs"></i>
                     </motion.div>
                  </motion.button>

                  {/* Logout */}
                  <button
                    onClick={onLogout}
                    className="flex items-center gap-2 text-red-500 font-bold px-2.5 py-1.5 hover:bg-red-50 rounded-lg transition-colors text-[13px] w-fit"
                  >
                      <i className="fas fa-sign-out-alt text-xs"></i> {t('logout')}
                  </button>

                  {/* Social Links & App Version Footer (Last of Side Menu) */}
                  {(isSocialSectionVisible && socialItems.length > 0) || sideMenuConfig.isVersionEnabled !== false ? (
                    <div className="pt-2.5 mt-0.5 border-t border-gray-100 flex flex-col items-center gap-2">
                      {isSocialSectionVisible && socialItems.length > 0 && (
                        <div className="flex items-center justify-center gap-2.5 w-full">
                          {socialItems.map((item) =>
                            item.url ? (
                              <a
                                key={item.key}
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={item.label}
                                aria-label={item.label}
                                className={`w-9 h-9 rounded-xl border flex items-center justify-center text-sm shadow-xs transition-all active:scale-90 ${item.colorClass}`}
                              >
                                <i className={item.icon}></i>
                              </a>
                            ) : (
                              <span
                                key={item.key}
                                title={item.label}
                                className={`w-9 h-9 rounded-xl border flex items-center justify-center text-sm opacity-60 ${item.colorClass}`}
                              >
                                <i className={item.icon}></i>
                              </span>
                            )
                          )}
                        </div>
                      )}

                      {sideMenuConfig.isVersionEnabled !== false && sideMenuConfig.appVersion && (
                        <div className="text-[10px] font-black text-gray-400 tracking-widest uppercase select-none">
                          {isRTL ? `الإصدار v${String(sideMenuConfig.appVersion).replace(/^v/i, '')}` : `Version v${String(sideMenuConfig.appVersion).replace(/^v/i, '')}`}
                        </div>
                      )}
                    </div>
                  ) : null}
              </div>
          </div>
        </div>
      </div>

      <SupportOptionsModal
        isOpen={showSupportOptions}
        onClose={() => setShowSupportOptions(false)}
        onSelectCustomerServiceChat={() => {
          onNavigate('ADMIN_CHAT');
          onClose();
        }}
        userName={user.name}
        userPhone={user.phone}
      />
    </>
  );
};

const MenuLink = ({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) => (
    <button onClick={onClick} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-gray-600 font-bold hover:bg-gray-50 hover:text-gray-900 transition-all group text-left rtl:text-right active:scale-95">
        <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 group-hover:bg-[#FFC90E] group-hover:text-gray-900 transition-colors shrink-0">
            <i className={`fas ${icon} text-xs`}></i>
        </div>
        <span className="text-[13px] truncate">{label}</span>
    </button>
);

