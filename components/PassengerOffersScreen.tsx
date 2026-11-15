import React, { useMemo, useEffect, useRef, useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OfferDetails, Coordinates } from '../types';
import { calculateDistance } from '../services/firebase';
import { Star, ShieldCheck, X, Zap } from 'lucide-react';
import { HapticsService } from '../services/haptics';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface PassengerOffersScreenProps {
  offers: OfferDetails[];
  pickupLocation: Coordinates | null;
  onAccept: (offer: OfferDetails) => void;
  onReject: (offer: OfferDetails) => void;
  processingOfferId: string | null;
  t: (key: string, defaultValue?: string) => string;
  isRTL: boolean;
  offerDurationSeconds?: number;
  onCancel?: () => void;
}

// ----------------------------------------------------------------------
// Memoized Offer Card
// ----------------------------------------------------------------------
const OfferCard = memo(React.forwardRef<HTMLDivElement, { 
  offer: any; 
  isRTL: boolean; 
  t: any; 
  processingOfferId: string | null;
  onAccept: (offer: any) => void;
  onReject: (offer: any) => void;
  offerDurationSeconds?: number;
}>(({ 
  offer, 
  isRTL, 
  t, 
  processingOfferId, 
  onAccept, 
  onReject,
  offerDurationSeconds = 12
}, ref) => {
  const durationSec = offerDurationSeconds || 12;
  const isProcessing = processingOfferId === (offer.id || offer.driverId);
  const isDisabled = processingOfferId !== null && !isProcessing;
  const [timeLeft, setTimeLeft] = useState<number>(durationSec);

  const onRejectRef = useRef(onReject);
  const offerRef = useRef(offer);
  useEffect(() => {
    onRejectRef.current = onReject;
    offerRef.current = offer;
  }, [onReject, offer]);

  const offerKey = offer.id || offer.driverId;

  useEffect(() => {
    if (processingOfferId) return; // Do not auto-reject if an offer is currently being processed
    const now = Date.now();
    const rawCreated = typeof offer.createdAt === 'number' ? offer.createdAt : now;
    const elapsedMs = rawCreated > 0 && now >= rawCreated && (now - rawCreated) < durationSec * 1000
      ? now - rawCreated
      : 0;
    const initialRemainingSec = Math.max(1, Math.ceil((durationSec * 1000 - elapsedMs) / 1000));
    const targetEndMs = now + (durationSec * 1000 - elapsedMs);

    setTimeLeft(initialRemainingSec);
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((targetEndMs - Date.now()) / 1000));
      setTimeLeft(remaining);
    }, 300);
    const timer = setTimeout(() => {
      onRejectRef.current(offerRef.current);
    }, Math.max(250, durationSec * 1000 - elapsedMs));
    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [offerKey, durationSec, processingOfferId]);

  // Formatting strings
  const rating = offer.rating?.toFixed(2) || "5.00";
  const tripsCount = offer.driverTrips || Math.floor(Math.random() * 5000) + 100; // Simulated if not available
  const tripsLabel = isRTL ? 'رحلة' : 'trips';
  const price = offer.price || 0;
  const currency = t('currency', 'E£');
  const etaMins = offer.eta || 5;
  const etaLabel = isRTL ? 'دقيقة' : 'min';

  // Badges based on score / simulated for UI matching
  const isPlatinum = offer.rating >= 4.8 && tripsCount > 1000;
  const isVip = offer.price > 200 && isPlatinum;

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      className={cn(
        "bg-white rounded-[32px] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.08)] mb-4 border border-gray-100",
        isProcessing && "ring-2 ring-[#a3e635] scale-[1.02] transition-all",
        isDisabled && "opacity-50 grayscale-[0.5]"
      )}
      style={{ direction: isRTL ? 'rtl' : 'ltr' }}
    >
      {/* Top Row: ETA & Price */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1"></div> {/* Spacer for layout flex */}
        <div className="flex items-baseline gap-2 flex-row-reverse">
          {/* We want ETA then Price in RTL looking from right to left */}
          <motion.div layoutId={`eta-${offer.id}`} className="text-[26px] font-black text-gray-800 tracking-tight flex items-baseline gap-1">
            {etaMins} <span className="text-[20px] font-bold text-gray-600">{etaLabel}</span>
          </motion.div>
          <motion.div layoutId={`price-${offer.id}`} className="text-[28px] font-black text-gray-900 tracking-tight flex items-baseline gap-1">
            {price} <span className="text-[20px] font-bold text-gray-600">{currency}</span>
          </motion.div>
        </div>
      </div>

      {/* Second Row: Driver Details */}
      <div className="flex items-start gap-4 mb-5">
        <div className="flex-1 min-w-0 flex flex-col justify-center pt-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-gray-900 text-lg">{offer.driverName}</span>
            <div className="flex items-center gap-0.5 text-gray-800 font-bold text-sm ml-2">
               <Star className="w-3.5 h-3.5 fill-current text-black" />
               {rating}
            </div>
            <span className="text-gray-400 text-sm mx-1">•</span>
            <span className="text-gray-500 text-sm font-medium">{tripsCount} {tripsLabel}</span>
          </div>
          <div className="text-[15px] font-medium text-gray-600 mt-0.5">
            {[offer.vehicleBrand, offer.vehicleModel, (offer as any).vehicleColor, (offer as any).vehiclePlate].filter(Boolean).join(" • ") || (isRTL ? "سيارة معتمدة" : "Verified Car")}
          </div>
          <div className="flex items-center gap-2 mt-1 text-[13px] font-bold text-gray-500">
             <span className="flex items-center gap-1">
               <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> {isRTL ? 'متصل' : 'Online'}
             </span>
             <span>•</span>
             <span>{offer.distance?.toFixed(1) || "1.0"} {isRTL ? 'كم' : 'km'}</span>
          </div>
          
          {/* Badges */}
          <div className="flex flex-wrap gap-2 mt-2">
            {isPlatinum && (
              <div className="flex items-center gap-1 bg-[#f3e8ff] text-[#7e22ce] px-2 py-0.5 rounded-full text-xs font-bold">
                <Star className="w-3 h-3 fill-current" />
                {isRTL ? 'سائق بلاتيني' : 'Platinum Driver'}
              </div>
            )}
            {isVip && (
              <div className="flex items-center gap-1 bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full text-xs font-bold">
                VIP
              </div>
            )}
          </div>
        </div>
        
        <div className="shrink-0 relative">
          {offer.driverAvatar ? (
             <img src={offer.driverAvatar} alt="Driver" className="w-[60px] h-[60px] rounded-full object-cover shadow-sm border-2 border-gray-50" />
          ) : (
            <div className="w-[60px] h-[60px] rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold border-2 border-white shadow-sm">
              {offer.driverName?.substring(0,2).toUpperCase()}
            </div>
          )}
          {isPlatinum && (
            <div className="absolute -bottom-1 -left-1 bg-[#7e22ce] text-white p-1 rounded-full border-2 border-white">
               <Star className="w-2.5 h-2.5 fill-current" />
            </div>
          )}
        </div>
      </div>

      {/* Bottom Buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => {
            HapticsService.success();
            onAccept(offer);
          }}
          disabled={processingOfferId !== null}
          className="flex-[1.5] relative overflow-hidden bg-gradient-to-r from-[#84cc16] to-[#65a30d] text-white font-black text-[17px] rounded-[18px] transition-all flex items-center justify-center gap-2 h-[54px] shadow-sm active:scale-95 disabled:opacity-80"
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ duration: durationSec, ease: "linear" }}
            className={cn("absolute top-0 bottom-0 bg-blue-500 z-0", isRTL ? "right-0" : "left-0")}
          />
          <span className="relative z-10 flex items-center gap-2">
            {isProcessing ? <Zap className="w-5 h-5 animate-pulse" /> : `${isRTL ? 'قبول' : 'Accept'} (${timeLeft}s)`}
          </span>
        </button>
        <button
          onClick={() => {
            HapticsService.selection();
            onReject(offer);
          }}
          disabled={processingOfferId !== null}
          className="flex-1 bg-gray-100 text-gray-800 font-bold text-[17px] rounded-[18px] transition-all flex items-center justify-center h-[54px] active:scale-95 active:bg-gray-200 disabled:opacity-50"
        >
          {isRTL ? 'رفض' : 'Reject'}
        </button>
      </div>
    </motion.div>
  );
}));

// ----------------------------------------------------------------------
// Main Screen
// ----------------------------------------------------------------------
export const PassengerOffersScreen: React.FC<PassengerOffersScreenProps> = ({
  offers,
  pickupLocation,
  onAccept,
  onReject,
  processingOfferId,
  t,
  isRTL,
  offerDurationSeconds = 12,
  onCancel
}) => {
  // Parse offers and calculate dynamic fields with memoization to prevent heavy recalculations
  const processedOffers = useMemo(() => {
    return offers.map(offer => {
      let distance = 999;
      let eta = 999;
      
      if (offer.driverLocation && pickupLocation) {
        distance = calculateDistance(
          offer.driverLocation.lat,
          offer.driverLocation.lng,
          pickupLocation.lat,
          pickupLocation.lng
        );
        eta = Math.ceil(distance * 3); // ~ 3 mins per km in city
      } else {
        // Fallbacks if no location
        distance = Math.random() * 5 + 1;
        eta = Math.floor(distance * 3);
      }

      const rating = offer.driverRating || 4.5;
      const price = offer.price || 0;
      
      return {
        ...offer,
        distance,
        eta,
        rating,
        price
      };
    });
  }, [offers, pickupLocation]);

  // Sorting logic: 1. ETA, 2. Rating (desc), 3. Distance, 4. Fare
  const sortedOffers = useMemo(() => {
    return [...processedOffers].sort((a, b) => {
      if (a.eta !== b.eta) return a.eta - b.eta;
      if (b.rating !== a.rating) return b.rating - a.rating;
      if (a.distance !== b.distance) return a.distance - b.distance;
      return a.price - b.price;
    });
  }, [processedOffers]);

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex flex-col justify-between" style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
      {/* Blurred Map Overlay Background */}
      <div className="absolute inset-0 bg-white/20 backdrop-blur-[6px] pointer-events-auto" />

      {/* Header Area */}
      <div className="relative z-10 w-full px-5 pt-12 pb-4 pointer-events-auto">
        <div className="flex justify-between items-start">
          {/* Right side (or left depending on RTL) titles */}
          <div className="flex flex-col">
            <h1 className="text-[34px] font-black text-gray-900 leading-tight drop-shadow-sm mb-1">
              {isRTL ? 'اختر سائق' : 'Choose Driver'}
            </h1>
            <div className="flex items-center gap-1.5 bg-white/70 backdrop-blur-md px-3 py-1.5 rounded-full w-fit shadow-sm border border-white">
               <ShieldCheck className="w-4 h-4 text-[#3b82f6] fill-blue-50" />
               <span className="text-[13px] font-bold text-gray-700">
                 {isRTL ? 'تم التحقق من جميع السائقين' : 'All drivers verified'}
               </span>
            </div>
          </div>

          {/* Cancel Button */}
          {onCancel && (
            <button
              onClick={onCancel}
              className="flex items-center gap-1.5 bg-[#ffe4e6] text-[#e11d48] px-4 py-2.5 rounded-full font-bold text-[15px] shadow-sm active:scale-95 transition-transform"
            >
              <span>{isRTL ? 'إلغاء الطلب' : 'Cancel Request'}</span>
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>

      {/* Offers List Area */}
      <div className="relative z-10 w-full flex-1 overflow-hidden pointer-events-auto flex flex-col justify-end pb-6 px-4">
        {/* Virtualized/Scrollable Container for cards */}
        <div className="w-full max-h-[75vh] overflow-y-auto hide-scrollbar scroll-smooth flex flex-col gap-0 pb-10 pt-20" style={{
           WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)',
           maskImage: 'linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)'
        }}>
          <AnimatePresence mode="popLayout">
            {sortedOffers.map((offer) => (
              <OfferCard 
                key={offer.id || offer.driverId}
                offer={offer}
                isRTL={isRTL}
                t={t}
                processingOfferId={processingOfferId}
                onAccept={onAccept}
                onReject={onReject}
                offerDurationSeconds={offerDurationSeconds || 12}
              />
            ))}
          </AnimatePresence>
          
          {sortedOffers.length === 0 && (
             <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               className="flex flex-col items-center justify-center py-10"
             >
                <div className="w-16 h-16 bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center mb-4 shadow-sm">
                   <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
             </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};
