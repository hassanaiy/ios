import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { Pin, PinOff, Trash2 } from 'lucide-react';
import { Ride, Driver, User, OfferDetails } from '../types';
import { Button } from './ui/Button';
import { useLanguage } from '../contexts/LanguageContext';
import { getUserProfile, subscribeToDriverRideOffer } from '../services/firebaseBridge';
import { PremiumSkeleton } from './ui/PremiumUI';
import { HapticsService } from '../services/haptics';
import { AnimatedAcceptButton } from './AnimatedAcceptButton';

const OfferCountdown: React.FC<{ isSmall?: boolean }> = ({ isSmall }) => {
    const [timeLeft, setTimeLeft] = useState(12);
    useEffect(() => {
        if (timeLeft <= 0) return;
        const interval = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        return () => clearInterval(interval);
    }, [timeLeft]);
    
    return <span className={isSmall ? "" : "text-3xl font-black mt-2 inline-block"}>{timeLeft}s</span>;
};

// --- Main Popup Component ---
interface DriverRequestsPopupProps {
  requests: Ride[];
  onAccept: (ride: Ride, finalFare?: number, offerId?: string) => void;
  onSelect: (ride: Ride) => void;
  onRemove?: (ride: Ride) => void;
  onTogglePin?: (ride: Ride) => void;
  pinnedIds?: string[];
  activeOfferIds?: string[];
  offerDurationSeconds?: number;
}

export const DriverRequestsPopup: React.FC<DriverRequestsPopupProps> = ({
  requests,
  onAccept,
  onSelect,
  onRemove,
  onTogglePin,
  pinnedIds = [],
  activeOfferIds = [],
  offerDurationSeconds = 12
}) => {
    const { t, isRTL } = useLanguage();
    if (requests.length === 0) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-4 pb-safe overflow-hidden pointer-events-none flex flex-col items-end gap-3">
            <div 
                className="w-full max-w-md mx-auto flex flex-col-reverse gap-3 overflow-y-auto max-h-[70vh] hide-scrollbar pointer-events-auto"
            >
                <AnimatePresence initial={false}>
                    {requests.map((ride) => (
                        <RequestCardVertical
                            key={ride.id}
                            ride={ride}
                            onAccept={onAccept}
                            onSelect={onSelect}
                            onRemove={onRemove}
                            onTogglePin={onTogglePin}
                            isPinned={pinnedIds.includes(ride.id)}
                            t={t}
                            isRTL={isRTL}
                            isActiveOffer={activeOfferIds.includes(ride.id)}
                            offerDurationSeconds={offerDurationSeconds}
                        />
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
};

// --- Request Card Component (Vertical List Item) ---
interface RequestCardVerticalProps {
    ride: Ride;
    onAccept: (ride: Ride) => void;
    onSelect: (ride: Ride) => void;
    onRemove?: (ride: Ride) => void;
    onTogglePin?: (ride: Ride) => void;
    isPinned?: boolean;
    t: (key: string) => string;
    isRTL: boolean;
    isActiveOffer?: boolean;
    offerDurationSeconds?: number;
}

const LEFT_TRAY_WIDTH = 156;
const RIGHT_REMOVE_THRESHOLD = 105;

const RequestCardVertical: React.FC<RequestCardVerticalProps> = ({
    ride,
    onAccept,
    onSelect,
    onRemove,
    onTogglePin,
    isPinned = false,
    t,
    isRTL,
    isActiveOffer,
    offerDurationSeconds = 12
}) => {
    const isParcel = ride.rideType === 'PARCEL';
    const [activeSince, setActiveSince] = useState<number | null>(null);
    const [isLeftTrayOpen, setIsLeftTrayOpen] = useState(false);
    const [isRemoving, setIsRemoving] = useState(false);
    const isDraggingRef = useRef(false);
    const crossedThresholdRef = useRef(false);

    const x = useMotionValue(0);
    const rightBackdropOpacity = useTransform(x, [10, 65], [0, 1]);
    const rightIconScale = useTransform(x, [10, RIGHT_REMOVE_THRESHOLD], [0.75, 1.12]);
    const leftTrayOpacity = useTransform(x, [-10, -55], [0, 1]);

    useEffect(() => {
        if (isActiveOffer && !activeSince) {
            setActiveSince(Date.now());
        } else if (!isActiveOffer && activeSince !== null) {
            setActiveSince(null);
        }
    }, [isActiveOffer, activeSince]);

    const closeTray = () => {
        setIsLeftTrayOpen(false);
        animate(x, 0, { type: 'spring', stiffness: 420, damping: 32 });
    };

    const triggerDirectRemove = async (direction: 'left' | 'right') => {
        if (isRemoving) return;
        setIsRemoving(true);
        setIsLeftTrayOpen(false);
        HapticsService.medium();
        const targetX = direction === 'right' ? 440 : -440;
        await animate(x, targetX, { duration: 0.22, ease: [0.16, 1, 0.3, 1] });
        onRemove?.(ride);
    };

    const handleTogglePin = (e: React.MouseEvent) => {
        e.stopPropagation();
        HapticsService.light();
        closeTray();
        onTogglePin?.(ride);
    };

    const handleTrayRemove = (e: React.MouseEvent) => {
        e.stopPropagation();
        triggerDirectRemove('left');
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
                opacity: 0,
                x: 420,
                height: 0,
                marginBottom: 0,
                transition: { duration: 0.24, ease: [0.16, 1, 0.3, 1] }
            }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            style={{ flexShrink: 0 }}
        >
            <div className="relative overflow-hidden rounded-[32px] mb-[11px]" dir="ltr">
                {/* Right-Swipe Direct Remove Backdrop (visible on left edge when swiping right) */}
                {!isActiveOffer && (
                    <motion.div
                        style={{ opacity: rightBackdropOpacity }}
                        className="absolute inset-0 rounded-[32px] bg-gradient-to-r from-red-500 to-rose-600 flex items-center justify-start pl-6 pointer-events-none"
                        aria-hidden="true"
                    >
                        <motion.div style={{ scale: rightIconScale }} className="flex items-center gap-2.5 text-white">
                            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                <Trash2 className="w-5 h-5" />
                            </div>
                            <span className="font-bold text-sm tracking-tight whitespace-nowrap">
                                {isRTL ? 'إزالة الطلب' : 'Remove'}
                            </span>
                        </motion.div>
                    </motion.div>
                )}

                {/* Left-Swipe Action Tray (visible on right edge when swiping left: Pin + Remove) */}
                {!isActiveOffer && (
                    <motion.div
                        style={{ opacity: leftTrayOpacity }}
                        className={`absolute inset-0 rounded-[32px] bg-slate-900/95 flex items-center justify-end p-2.5 gap-2 ${
                            isLeftTrayOpen ? 'pointer-events-auto z-10' : 'pointer-events-none'
                        }`}
                    >
                        <button
                            type="button"
                            onClick={handleTogglePin}
                            className={`h-full min-w-[66px] px-2.5 rounded-[22px] flex flex-col items-center justify-center gap-1.5 font-bold text-xs transition-transform active:scale-95 ${
                                isPinned
                                    ? 'bg-slate-700 text-amber-300 hover:bg-slate-600'
                                    : 'bg-[#FFC90E] text-[#1A1F36] hover:brightness-105'
                            }`}
                            aria-label={isPinned ? (isRTL ? 'إلغاء تثبيت الطلب' : 'Unpin request') : (isRTL ? 'تثبيت الطلب' : 'Pin request')}
                        >
                            {isPinned ? <PinOff className="w-5 h-5" /> : <Pin className="w-5 h-5" />}
                            <span className="whitespace-nowrap">
                                {isPinned ? (isRTL ? 'إلغاء' : 'Unpin') : (isRTL ? 'تثبيت' : 'Pin')}
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={handleTrayRemove}
                            className="h-full min-w-[66px] px-2.5 rounded-[22px] bg-red-500 hover:bg-red-600 text-white flex flex-col items-center justify-center gap-1.5 font-bold text-xs transition-transform active:scale-95"
                            aria-label={isRTL ? 'إزالة الطلب' : 'Remove request'}
                        >
                            <Trash2 className="w-5 h-5" />
                            <span className="whitespace-nowrap">
                                {isRTL ? 'إزالة' : 'Remove'}
                            </span>
                        </button>
                    </motion.div>
                )}

                {/* Draggable Foreground Request Card */}
                <motion.div
                    dir={isRTL ? 'rtl' : 'ltr'}
                    drag={!isActiveOffer && !isRemoving ? 'x' : false}
                    dragDirectionLock
                    dragConstraints={{ left: -175, right: 320 }}
                    dragElastic={{ left: 0.12, right: 0.35 }}
                    dragMomentum={false}
                    onDragStart={() => {
                        isDraggingRef.current = true;
                        crossedThresholdRef.current = false;
                    }}
                    onDrag={() => {
                        const currentX = x.get();
                        if (!crossedThresholdRef.current && currentX >= RIGHT_REMOVE_THRESHOLD) {
                            crossedThresholdRef.current = true;
                            HapticsService.light();
                        } else if (crossedThresholdRef.current && currentX < RIGHT_REMOVE_THRESHOLD) {
                            crossedThresholdRef.current = false;
                        }
                    }}
                    onDragEnd={(_, info) => {
                        const currentX = x.get();
                        if (currentX >= RIGHT_REMOVE_THRESHOLD || (currentX > 45 && info.velocity.x > 460)) {
                            triggerDirectRemove('right');
                        } else if (currentX <= -60 || (currentX < -25 && info.velocity.x < -380)) {
                            setIsLeftTrayOpen(true);
                            HapticsService.light();
                            animate(x, -LEFT_TRAY_WIDTH, { type: 'spring', stiffness: 420, damping: 32 });
                        } else {
                            closeTray();
                        }
                        window.setTimeout(() => {
                            isDraggingRef.current = false;
                        }, 80);
                    }}
                    className={`relative z-20 glass-panel p-5 border transition-colors ${
                        isActiveOffer
                            ? 'cursor-default ring-2 ring-[#FFC90E]'
                            : 'cursor-grab active:cursor-grabbing hover:border-gray-300'
                    } ${
                        isPinned
                            ? 'border-amber-400 shadow-[0_8px_30px_rgba(245,158,11,0.18)]'
                            : isParcel
                                ? 'border-orange-300 shadow-[0_4px_15px_rgba(249,115,22,0.15)]'
                                : 'border-glass-border shadow-[0_8px_30px_rgba(0,0,0,0.08)]'
                    }`}
                    style={{ x, borderRadius: '32px', touchAction: 'pan-y' }}
                    onClick={() => {
                        if (isDraggingRef.current || isRemoving) return;
                        if (isLeftTrayOpen) {
                            closeTray();
                            return;
                        }
                        if (!isActiveOffer) {
                            HapticsService.light();
                            onSelect(ride);
                        }
                    }}
                >
                    {!isActiveOffer && (
                        <>
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-1 flex-wrap">
                                       <i className={`fas ${isParcel ? 'fa-box-open text-orange-500' : 'fa-car text-blue-500'}`}></i>
                                       <span>{isParcel ? t('parcel_delivery') : (ride.status === 'SCHEDULED' ? 'SCHEDULED' : t('new_request'))}</span>
                                       {isPinned && (
                                           <span className="inline-flex items-center gap-1 text-amber-600 font-bold">
                                               <span aria-hidden="true">·</span>
                                               <Pin className="w-3 h-3 fill-amber-500 text-amber-600" />
                                               <span>{isRTL ? 'مثبت' : 'Pinned'}</span>
                                           </span>
                                       )}
                                       {ride.status === 'SCHEDULED' && ride.scheduledTime && (
                                          <span className="ml-1 bg-[#FFC90E] text-black px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter">
                                              {new Date(ride.scheduledTime).toLocaleDateString()} {new Date(ride.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'})}
                                          </span>
                                       )}
                                       {ride.isLargeGroup && (
                                           <span className="ml-1 bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter">
                                               {t('large_group_badge')}
                                           </span>
                                       )}
                                       {ride.bookingType === 'FOR_OTHER' && (
                                           <span className="ml-1 bg-blue-600 text-white px-2 py-0.5 rounded-full text-[9px] font-black tracking-tight shadow-2xs">
                                               {t('for_other_badge')}
                                           </span>
                                       )}
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <div className="text-3xl font-black text-gray-900 tabular-nums">{ride.fare} <span className="text-base font-bold text-gray-500">{t('currency')}</span></div>
                                        {ride.priceBoosted && ride.priceDirection !== 'down' && (
                                            <span className="inline-flex items-center gap-1 bg-emerald-500 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                                                <span>🔥</span>
                                                <span>{isRTL ? 'العميل رفع السعر!' : 'Price Raised!'}</span>
                                            </span>
                                        )}
                                        {!ride.priceBoosted && ride.priceChanged && ride.priceDirection === 'down' && ride.lastPriceUpdate && (Date.now() - ride.lastPriceUpdate < 180000) && (
                                            <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 border border-amber-200 text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                                                <span>{isRTL ? 'تم تعديل السعر' : 'Fare Updated'}</span>
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-black text-gray-800 tabular-nums">{ride.distanceText}</div>
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter tabular-nums">{ride.durationText}</div>
                                </div>
                            </div>

                            {ride.bookingType === 'FOR_OTHER' && ride.actualPassenger && (
                                <div className="mb-3 p-2.5 rounded-2xl bg-blue-50/90 border border-blue-200 flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="text-[11px] font-black text-blue-900 truncate">
                                            {t('actual_passenger')}: {ride.actualPassenger.name}
                                        </div>
                                        <div className="text-[11px] font-mono font-bold text-blue-700" dir="ltr">
                                            {ride.actualPassenger.phone}
                                        </div>
                                        {ride.actualPassenger.note && (
                                            <div className="text-[10px] font-bold text-gray-700 mt-0.5 truncate">
                                                {t('driver_notes')}: {ride.actualPassenger.note}
                                            </div>
                                        )}
                                    </div>
                                    <a
                                        href={`tel:${ride.actualPassenger.phone}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-9 h-9 rounded-full bg-green-500 text-white flex items-center justify-center shrink-0 shadow-xs active:scale-90 transition-transform"
                                        title={t('call_actual_passenger')}
                                    >
                                        <i className="fas fa-phone text-xs"></i>
                                    </a>
                                </div>
                            )}

                            <div className="flex flex-col">
                                {/* Pickup Row */}
                                <div className="flex items-stretch gap-3">
                                    <div className="w-4 flex flex-col items-center shrink-0">
                                        <div className="w-3.5 h-3.5 mt-0.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20 flex items-center justify-center shrink-0">
                                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                        </div>
                                        <div className="w-[2.5px] flex-1 min-h-[16px] bg-gradient-to-b from-emerald-500 to-[#2563EB] mt-1 rounded-full" />
                                    </div>
                                    <div className="flex-1 min-w-0 pb-2.5">
                                        <p className="text-sm font-bold text-gray-800 leading-snug" dir="auto">{ride.pickup.address}</p>
                                    </div>
                                </div>

                                {/* Dropoff Row with downward arrow pointing to destination */}
                                <div className="flex items-stretch gap-3">
                                    <div className="w-4 flex flex-col items-center shrink-0 -mt-1">
                                        <svg className="w-3.5 h-3.5 text-[#2563EB] shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                                            <path d="M8 13L2.5 6.5h3.5V1h4v5.5h3.5L8 13z" />
                                        </svg>
                                        <div className="w-3.5 h-3.5 mt-0.5 rounded-full bg-[#2563EB] ring-4 ring-blue-500/20 flex items-center justify-center shrink-0">
                                            <div className="w-1.5 h-1.5 rounded-sm bg-white" />
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0 pt-2.5">
                                        <p className="text-sm font-bold text-[#2563EB] leading-snug" dir="auto">{ride.dropoff.address}</p>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                    
                    <div className="mt-5 flex gap-3">
                        {isActiveOffer ? (
                            <AnimatedAcceptButton 
                                createdAt={activeSince || Date.now()} // The moment it became active
                                durationSeconds={offerDurationSeconds}
                                onAccept={() => {}}
                                text={t('waiting_passenger')}
                                expiredText={isRTL ? 'انتهت مهلة العرض' : 'Offer Expired'}
                                isRTL={isRTL}
                                className="flex-1 h-14 bg-[#FFC90E] text-[#1A1F36] rounded-[30px] font-black uppercase text-[13px] tracking-tight shadow-lg shadow-yellow-100 border border-yellow-300"
                                style={{ backgroundColor: '#FFC90E', color: '#1A1F36' }}
                                disabled={true}
                                startTimerOnClick={false}
                            />
                        ) : (
                            <>
                                <Button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (isDraggingRef.current) return;
                                        if (isLeftTrayOpen) { closeTray(); return; }
                                        HapticsService.light();
                                        onSelect(ride);
                                    }} 
                                    variant="secondary" 
                                    className="flex-1 h-14 bg-gray-100/80 backdrop-blur-md text-gray-900 border-none shadow-none text-sm hover:bg-gray-200/80"
                                >
                                    <i className="fas fa-tags mr-2 rtl:ml-2 rtl:mr-0 text-gray-500"></i>
                                    {t('offer_price')}
                                </Button>
                                <Button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (isDraggingRef.current) return;
                                        if (isLeftTrayOpen) { closeTray(); return; }
                                        HapticsService.success();
                                        onAccept(ride);
                                    }} 
                                    className="flex-1 h-14 border-none flex items-center justify-center text-lg font-bold whitespace-nowrap shadow-[0_4px_15px_rgba(31,68,223,0.3)] transition-transform hover:scale-105 active:scale-95"
                                    style={{ borderRadius: '30px', backgroundColor: '#1f44df', color: '#ffffff' }}
                                >
                                    {t('accept_ride')}
                                </Button>
                            </>
                        )}
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
};


// --- Trip Details Bottom Sheet ---
interface TripDetailsSheetProps {
    ride: Ride | null;
    driver: Driver;
    onClose: () => void;
    onAccept: (ride: Ride, finalFare?: number, offerId?: string) => void;
    onReject: (ride: Ride) => void;
    onSendOffer: (ride: Ride, price: number) => void;
}

export const TripDetailsSheet: React.FC<TripDetailsSheetProps> = ({ ride, driver, onClose, onAccept, onReject, onSendOffer }) => {
    const { t, isRTL } = useLanguage();
    const [passenger, setPassenger] = useState<User | null>(null);
    const [proposedPrice, setProposedPrice] = useState<number>(0);
    const [isLoadingPassenger, setIsLoadingPassenger] = useState(false);
    const [myOffer, setMyOffer] = useState<OfferDetails | null>(null);

    const hasCounterOffer = myOffer?.status === 'countered' && myOffer.passengerCounterPrice;

    useEffect(() => {
        if (ride) {
            setProposedPrice(ride.fare);
            setIsLoadingPassenger(true);
            getUserProfile(ride.passengerId).then(p => {
                if (p) setPassenger(p);
                setIsLoadingPassenger(false);
            });
            const unsubOffer = subscribeToDriverRideOffer(ride.id, driver.id, setMyOffer);
            return () => unsubOffer();
        } else {
            setPassenger(null);
            setMyOffer(null);
        }
    }, [ride, driver.id]);

    if (!ride) return null;
    
    const isParcel = ride.rideType === 'PARCEL';

    const handleAcceptCounter = () => {
        if (hasCounterOffer) {
            onAccept(ride, myOffer.passengerCounterPrice, myOffer.id);
            onClose();
        }
    };
    
    const handleRejectCounter = () => {
        if (myOffer?.id) {
            onSendOffer(ride, proposedPrice);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col justify-end animate-fade-in" onClick={onClose}>
            <div 
                className="bg-white rounded-t-[40px] shadow-2xl p-6 pt-3 pb-safe max-h-[90vh] overflow-y-auto animate-slide-up"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6"></div>

                {(!myOffer || hasCounterOffer) ? (
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-black flex items-center gap-2">
                            {isParcel && <i className="fas fa-box-open text-orange-500"></i>}
                            {isParcel ? t('parcel_delivery') : t('trip_details')}
                        </h2>
                        <span className="font-mono text-[10px] text-gray-400 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">#{ride.id.slice(0, 8)}</span>
                    </div>
                ) : (
                    <div className="flex justify-end mb-4">
                        <Button onClick={onClose} variant="ghost" className="rounded-full bg-gray-100 hover:bg-gray-200">
                            <i className="fas fa-times text-gray-500"></i>
                        </Button>
                    </div>
                )}

                {hasCounterOffer && (
                    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-4 mb-6 text-center animate-pulse">
                        <div className="text-yellow-700 font-black text-sm">{passenger?.name} {t('is_asking_diff_price')}</div>
                        <div className="text-3xl font-black text-gray-900 my-2">{myOffer.passengerCounterPrice} {t('currency')}</div>
                        <div className="flex gap-2">
                            <button onClick={handleRejectCounter} className="flex-1 py-3 bg-red-100 text-red-600 rounded-xl font-bold text-sm">{t('decline')}</button>
                            <button onClick={handleAcceptCounter} className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold text-sm">{t('accept')}</button>
                        </div>
                    </div>
                )}

                {(!myOffer || hasCounterOffer) ? (
                    <>
                        <div className="bg-black/5 backdrop-blur-md rounded-3xl p-5 flex items-center gap-4 mb-4 border border-glass-border">
                            {isLoadingPassenger ? <PremiumSkeleton className="w-12 h-12 rounded-full shrink-0" /> : (
                                <img src={passenger?.avatar} className="w-12 h-12 rounded-full border-2 border-white object-cover shadow-sm shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5 flex items-center gap-1.5">
                                    <span>
                                        {isParcel
                                            ? t('sender')
                                            : ride.bookingType === 'FOR_OTHER'
                                              ? t('booking_owner')
                                              : t('passenger')}
                                    </span>
                                    {ride.bookingType === 'FOR_OTHER' && (
                                        <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-[9px] font-black">
                                            {t('for_other_badge')}
                                        </span>
                                    )}
                                </div>
                                {isLoadingPassenger ? (
                                    <PremiumSkeleton className="h-5 w-3/4 max-w-[150px] mb-1.5" />
                                ) : (
                                    <div className="font-black text-lg text-gray-900 truncate">{ride.bookedBy?.name || passenger?.name}</div>
                                )}
                                {isLoadingPassenger ? (
                                    <PremiumSkeleton className="h-3 w-1/4" />
                                ) : (
                                    <div className="flex items-center gap-1 text-yellow-500 text-xs font-bold mt-0.5">
                                        <i className="fas fa-star text-[10px]"></i> {passenger?.rating?.toFixed(1) || 'N/A'}
                                    </div>
                                )}
                            </div>
                            <div className="text-right shrink-0">
                                <div className="font-black text-2xl text-gray-900">{ride.fare}</div>
                                <div className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{t('currency')}</div>
                                <div className="text-[10px] font-bold text-green-600 mt-1">{isRTL ? "الصافي لك:" : "Net:"} {(ride.fare * (1 - ((driver?.commissionPercentage || 10) / 100))).toFixed(2)}</div>
                            </div>
                        </div>

                        {ride.bookingType === 'FOR_OTHER' && ride.actualPassenger && (
                            <div className="mb-6 p-4 rounded-3xl bg-blue-50 border border-blue-200 space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-black text-blue-600 uppercase tracking-wider">
                                            {t('actual_passenger')} ({t('for_other_badge')})
                                        </div>
                                        <div className="text-base font-black text-gray-900 truncate">
                                            {ride.actualPassenger.name}
                                        </div>
                                        <div className="text-xs font-mono font-bold text-blue-700" dir="ltr">
                                            {ride.actualPassenger.phone}
                                        </div>
                                    </div>
                                    <a
                                        href={`tel:${ride.actualPassenger.phone}`}
                                        className="px-3.5 py-2.5 rounded-2xl bg-green-600 hover:bg-green-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm shrink-0 active:scale-95 transition-transform"
                                    >
                                        <i className="fas fa-phone"></i>
                                        <span>{t('call_actual_passenger')}</span>
                                    </a>
                                </div>
                                {ride.actualPassenger.note && (
                                    <div className="p-2.5 rounded-xl bg-white border border-blue-100 text-xs">
                                        <span className="font-black text-gray-600">{t('driver_notes')}: </span>
                                        <span className="font-bold text-gray-900">{ride.actualPassenger.note}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Refined Timeline in Sheet */}
                        <div className={`bg-[#F8F7FF] rounded-[28px] p-6 mb-6 relative border border-[#EEF0FF]`}>
                            <div className={`absolute top-10 bottom-10 ${isRTL ? 'right-[31px]' : 'left-[31px]'} w-0.5 border-l-2 border-dashed border-[#8B5CF6] opacity-40 flex items-center justify-center`}>
                                <svg className="w-3.5 h-3.5 text-[#2563EB] bg-[#F8F7FF] rounded-full shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                                    <path d="M8 13L2.5 6.5h3.5V1h4v5.5h3.5L8 13z" />
                                </svg>
                            </div>
                            <div className={`flex ${isRTL ? 'flex-row' : 'flex-row-reverse'} items-start justify-between mb-8 relative z-10`}>
                                <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                                    <div className="text-[#8B5CF6] text-[11px] font-black uppercase tracking-[0.15em] mb-1">{t('pickup_caps')}</div>
                                    <div className="font-bold text-gray-700 text-sm leading-tight break-words" dir="auto">{ride.pickup.address}</div>
                                </div>
                                <div className={`w-4 h-4 rounded-full border-[3px] border-emerald-500 bg-white shrink-0 mt-1 ${isRTL ? 'ml-0 mr-4' : 'mr-0 ml-4'}`}></div>
                            </div>
                            <div className={`flex ${isRTL ? 'flex-row' : 'flex-row-reverse'} items-start justify-between relative z-10`}>
                                <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                                    <div className="text-[#2563EB] text-[11px] font-black uppercase tracking-[0.15em] mb-1">{t('dropoff_caps')}</div>
                                    <div className="font-bold text-[#2563EB] text-sm leading-tight break-words" dir="auto">{ride.dropoff.address}</div>
                                </div>
                                <div className={`w-4 h-4 rounded-full bg-[#2563EB] shrink-0 mt-1 shadow-sm border-2 border-white ${isRTL ? 'ml-0 mr-4' : 'mr-0 ml-4'}`}></div>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 mb-8">
                           <div className="bg-blue-50 text-blue-800 p-4 rounded-2xl flex flex-col items-center justify-center gap-1 border border-blue-100">
                                <span className="text-[10px] font-black text-blue-300 uppercase tracking-widest">{t('km')}</span>
                                <span className="font-black text-lg">{ride.distanceText}</span>
                           </div>
                           <div className="bg-blue-50 text-blue-800 p-4 rounded-2xl flex flex-col items-center justify-center gap-1 border border-blue-100">
                                <span className="text-[10px] font-black text-blue-300 uppercase tracking-widest">{t('min')}</span>
                                <span className="font-black text-lg">{ride.durationText}</span>
                           </div>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                         <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
                            <i className="fas fa-hourglass-half text-4xl text-yellow-600 animate-spin-slow"></i>
                         </div>
                         <h3 className="text-xl font-black text-gray-900 mb-2">{t('waiting_passenger')}</h3>
                         <p className="text-gray-500 text-sm font-medium">{t('passenger_notified_offer')}</p>
                         <Button onClick={onClose} variant="ghost" className="mt-8 text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                            {t('close')}
                         </Button>
                    </div>
                )}

                {!myOffer && (
                    <div className="bg-gray-50 rounded-[32px] p-6 mb-8 border border-gray-100">
                        <h3 className="text-xs font-black text-gray-400 text-center uppercase tracking-[0.2em] mb-4">{t('offer_price', 'Counter Offer')}</h3>
                        <div className="flex flex-col gap-3 mb-6 relative">
                            {(() => {
                                const base = ride.baseFareAmount || ride.fare;
                                const dist = ride.distanceValue ? ride.distanceValue / 1000 : 5;
                                const hour = new Date().getHours();
                                const isNight = hour >= 22 || hour <= 5;
                                const isRushHour = (hour >= 8 && hour <= 10) || (hour >= 16 && hour <= 19);

                                let rawBumps = [5, 10, 15];
                                if (dist > 15) {
                                    rawBumps = [10, 20, 30, 40];
                                } else if (dist > 5) {
                                    rawBumps = [5, 10, 15, 20];
                                }

                                // Apply smart adjustments
                                if (isNight || isRushHour) {
                                    rawBumps = rawBumps.map(b => b + 5);
                                }

                                // Cap at 30% increase
                                const validBumps = rawBumps.filter(b => (b / base) <= 0.3);
                                if (validBumps.length === 0) validBumps.push(5);

                                // Select primary recommendation
                                let recIndex = 0;
                                if (isNight || isRushHour) {
                                    recIndex = Math.min(validBumps.length - 1, 2);
                                } else if (dist > 10) {
                                    recIndex = Math.min(validBumps.length - 1, 1);
                                }

                                return (
                                    <div className="flex flex-wrap justify-center gap-3 w-full" dir={isRTL ? 'rtl' : 'ltr'}>
                                        {validBumps.slice(0, 4).map((bump, idx) => {
                                            const presetFare = ride.fare + bump;
                                            const isRecommended = idx === recIndex;
                                            return (
                                                <button 
                                                    key={bump} 
                                                    onClick={() => {
                                                        HapticsService.light();
                                                        onSendOffer(ride, presetFare);
                                                    }} 
                                                    className={`relative border-2 rounded-2xl font-black text-sm transition-all duration-200 active:scale-95 flex flex-col items-center justify-center flex-1 min-w-[75px] ${
                                                        isRecommended 
                                                        ? 'py-4 bg-gradient-to-br from-[#FFC90E] to-[#FFA000] border-transparent text-[#1A1F36] shadow-xl shadow-yellow-200/50 hover:brightness-110 scale-[1.02] z-10' 
                                                        : 'py-3 bg-white border-gray-100 text-gray-800 shadow-sm hover:border-[#6C63FF] hover:bg-gray-50'
                                                    }`}
                                                >
                                                    {isRecommended && (
                                                        <span className="absolute -top-3 bg-[#1A1F36] text-[#FFC90E] text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-widest whitespace-nowrap shadow-md left-1/2 -translate-x-1/2 border border-yellow-500/20">
                                                            {isRTL ? 'موصى به' : 'Recommended'}
                                                        </span>
                                                    )}
                                                    <span className={`leading-none mb-1 ${isRecommended ? 'text-2xl mt-1' : 'text-xl'}`}>+{bump}</span>
                                                    <span className={`text-[11px] font-bold uppercase ${isRecommended ? 'text-gray-900/80' : 'text-gray-400'}`}>
                                                        {presetFare} {t('currency')}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>
                        <div className="text-center mt-2">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                {isRTL ? 'تنتهي صلاحية العرض خلال 12 ثانية' : 'Offers expire in 12s'}
                            </span>
                        </div>
                    </div>
                )}

                <div className="flex gap-4">
                    {(!myOffer || hasCounterOffer) && (
                        <Button 
                            onClick={() => { onReject(ride); onClose(); }} 
                            variant="secondary" 
                            className="flex-1 h-14 bg-red-50 text-red-500 border-none shadow-none font-black uppercase text-xs tracking-widest hover:bg-red-100"
                        >
                            <i className="fas fa-trash-alt mr-2 rtl:ml-2 rtl:mr-0"></i>
                            {t('reject')}
                        </Button>
                    )}
                    <Button 
                        onClick={() => { onAccept(ride); }} 
                        className="flex-[2] h-14 bg-green-500 text-white border-none flex items-center justify-center whitespace-nowrap shadow-green-200 font-bold uppercase text-base tracking-wide"
                        style={{ backgroundColor: '#22c55e', borderRadius: '12px' }}
                    >
                        {t('accept_ride')}
                    </Button>
                </div>
            </div>
        </div>
    );
};
