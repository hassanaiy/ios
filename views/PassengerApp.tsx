import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { DynamicMap as Map } from "../components/DynamicMap";
import { Button } from "../components/ui/Button";
import { LocationGuard } from "../components/LocationGuard";
import { ChatPanel } from "../components/ChatPanel";
import {
  User,
  RideStatus,
  Coordinates,
  Driver,
  PaymentMethod,
  VehicleType,
  Place,
  OfferDetails,
  UserRole,
  Ride,
  AppSettings,
  PaymentStatus,
  PricingConfig,
  BookingType,
} from "../types";
import {
  db,
  subscribeToOnlineDrivers,
  createRideRequest,
  subscribeToRide,
  getUserProfile,
  rateUser,
  calculateDynamicFareRange,
  updateRideStatus,
  saveRecentDestination,
  subscribeToRecentDestinations,
  subscribeToRideMessages,
  acceptRideOffer,
  rejectRideOffer,
  checkActiveRide,
  subscribeToRideOffers,
  calculateDistance,
  subscribeToAppSettings,
  triggerSOS,
  sendMessage,
  sendPassengerCounterOffer,
  initiateInstapayPayment,
  subscribeToPricingSettings,
  getUserRides,
  ensureRideRewardsProcessed,
  validateAndNormalizePassengerPhone,
  getSavedOtherPassengers,
  getStoredRideVerificationPin,
  generateRideVerificationPin,
  checkIsAdmin,
  auth,
} from "../services/firebase";
import { PassengerOffersScreen } from "../components/PassengerOffersScreen";
import { InstaPayPaymentSheet } from "../components/InstaPayPaymentSheet";
import { DriverBadge } from "../components/DriverBadge";
import { QuickDestinationsAndAdBanner } from "../components/QuickDestinationsAndAdBanner";
import { BookForOtherModal } from "../components/BookForOtherModal";
import { PassengerScheduledRidesModal } from "../components/PassengerScheduledRidesModal";
import {
  createScheduledRideBooking,
  validateScheduledBookingInput,
  formatInServiceTimezone,
} from "../services/scheduledRidesService";
import { RecurringFrequency } from "../types";
import { doc, updateDoc, arrayUnion, getDoc, collection, getDocs } from "firebase/firestore";
import { useLanguage } from "../contexts/LanguageContext";
import {
  searchPlaces,
  searchLocalPlacesSync,
  mergePlacesHistory,
  getSuggestedPlaces,
  getPlaceDetails,
  saveToRecent,
  getLocalRecentSearches,
  toggleFavoritePlace,
  getFavoritePlaces,
  reverseGeocodeDetailed,
} from "../services/placesService";
import { CapacitorService } from "../services/capacitorService";
import { HapticsService } from "../services/haptics";
import {
  Skeleton,
  PremiumSkeleton,
  GlassCard,
} from "../components/ui/PremiumUI";
import { ImpactStyle } from "@capacitor/haptics";
import { Geolocation } from "@capacitor/geolocation";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import SOSButton from "../components/SOSButton";

import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  MapPin,
  Clock,
  X,
  Users,
  Star,
  Navigation2,
  Zap,
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
  XCircle,
  Map as MapIcon,
  Loader2,
  Plane,
  ChevronRight,
  RotateCw,
  Info,
  Minus,
  Plus,
  Check,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { AppLauncher } from "@capacitor/app-launcher";
import { Browser } from "@capacitor/browser";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const openNavigation = async (destinationStr: string) => {
  let appUrl = "";
  // destinationStr might be lat,lng or origin=lat,lng&destination=lat,lng
  // let's extract the destination coordinates for intent if needed
  // The previous code had: `?api=1&destination=${destLoc}` where destLoc is `lat,lng`
  // or `?api=1&origin=${orig}&destination=${dest}`

  // We can try extracting the destination parts
  const destMatch = destinationStr.match(/destination=([\d.-]+,[\d.-]+)/);
  const destLatEng = destMatch
    ? destMatch[1]
    : destinationStr.split("&")[0].replace("destination=", "");

  appUrl = `google.navigation:q=${destLatEng}`;

  try {
    const canOpen = await AppLauncher.canOpenUrl({ url: appUrl });
    if (canOpen.value) {
      await AppLauncher.openUrl({ url: appUrl });
    } else {
      await Browser.open({
        url: `https://www.google.com/maps/dir/?api=1&${destinationStr.includes("destination=") ? destinationStr : "destination=" + destinationStr}`,
      });
    }
  } catch (e) {
    window.open(
      `https://www.google.com/maps/dir/?api=1&${destinationStr.includes("destination=") ? destinationStr : "destination=" + destinationStr}`,
      "_blank",
    );
  }
};

interface PassengerAppProps {
  user: User;
  rebookData?: { ride: Ride; preferSameDriver: boolean } | null;
  clearRebookData?: () => void;
  onNavigate: (view: string) => void;
  setSupportRideId: (rideId: string | null) => void;
  onHeaderVisibilityChange?: (visible: boolean) => void;
}

const SEARCH_TIMEOUT_MS = 15 * 60 * 1000;
const CANCEL_TIMEOUT_MS = 5 * 60 * 1000;

// Helper to resolve asset paths correctly across environments (Vite, Capacitor, Sub-paths)
const getAsset = (path: string) => {
  try {
    // @ts-ignore: Suppress TS error for import.meta.env in non-Vite environments
    const baseUrl = import.meta.env?.BASE_URL || "/";
    // Ensure we don't double slash if baseUrl ends with / and path starts with /
    const safeBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    const safePath = path.startsWith("/") ? path.slice(1) : path;
    return `${safeBase}${safePath}`;
  } catch (e) {
    // Fallback for environments where import.meta is not supported
    return path.startsWith("/") ? path : `/${path}`;
  }
};

const getLocationIcon = (name: string, type: string) => {
  const n = name.toLowerCase();

  // Arabic & English keywords
  if (
    n.includes("home") ||
    n.includes("منزل") ||
    n.includes("بيت") ||
    type === "home"
  )
    return "fa-home";
  if (
    n.includes("work") ||
    n.includes("عمل") ||
    n.includes("شغل") ||
    type === "work"
  )
    return "fa-briefcase";
  if (
    n.includes("school") ||
    n.includes("مدرسة") ||
    n.includes("college") ||
    n.includes("university") ||
    n.includes("جامعة") ||
    n.includes("كلية") ||
    n.includes("collage")
  )
    return "fa-university";
  if (n.includes("mosque") || n.includes("مسجد") || n.includes("جامع"))
    return "fa-mosque";
  if (
    n.includes("hospital") ||
    n.includes("مستشفى") ||
    n.includes("عيادة") ||
    n.includes("clinic")
  )
    return "fa-hospital";
  if (
    n.includes("restaurant") ||
    n.includes("مطعم") ||
    n.includes("cafe") ||
    n.includes("كافيه") ||
    n.includes("قهوة")
  )
    return "fa-utensils";
  if (
    n.includes("mall") ||
    n.includes("مول") ||
    n.includes("market") ||
    n.includes("سوق") ||
    n.includes("shop") ||
    n.includes("محل")
  )
    return "fa-shopping-bag";
  if (
    n.includes("gym") ||
    n.includes("جيم") ||
    n.includes("نادي") ||
    n.includes("club")
  )
    return "fa-dumbbell";
  if (n.includes("airport") || n.includes("مطار")) return "fa-plane";
  if (n.includes("station") || n.includes("محطة")) return "fa-train";
  if (n.includes("bank") || n.includes("بنك")) return "fa-university";
  if (n.includes("pharmacy") || n.includes("صيدلية")) return "fa-pills";
  if (n.includes("park") || n.includes("حديقة") || n.includes("منتزه"))
    return "fa-tree";

  return type === "history" ? "fa-history" : "fa-map-marker-alt";
};

interface VehicleCardProps {
  type: {
    id: VehicleType;
    name: string;
    image: string;
    seats: number;
  };
  priceRange: { min: number; recommended: number; max: number } | null;
  duration: number;
  isSelected: boolean;
  isDisabled?: boolean;
  onSelect: (type: VehicleType) => void;
  currencyLabel: string;
}

const VehicleCard: React.FC<VehicleCardProps> = ({
  type,
  priceRange,
  duration,
  isSelected,
  isDisabled,
  onSelect,
  currencyLabel,
}) => (
  <button
    onClick={() => {
      HapticsService.selection();
      onSelect(type.id);
    }}
    className={`relative rounded-2xl flex flex-col items-center justify-between min-w-[95px] h-[130px] transition-all duration-500 overflow-visible ${
      isDisabled
        ? "opacity-60 grayscale cursor-not-allowed"
        : isSelected
          ? "shadow-xl transform scale-105 z-10"
          : "hover:-translate-y-0.5"
    }`}
  >
    {/* Background Layer with Animated Border */}
    <div className={`absolute inset-0 rounded-2xl overflow-hidden transition-all duration-300 ${isDisabled ? 'glass-panel border border-transparent' : isSelected ? '' : 'glass-panel border border-transparent hover:border-gray-200'}`}>
       {isSelected && (
          <>
             <div className="absolute -inset-[100%] bg-[conic-gradient(from_0deg_at_50%_50%,transparent_0%,#FFC90E_50%,transparent_100%)] animate-[spin_2s_linear_infinite] z-0"></div>
             <div className="absolute inset-[2px] rounded-[14px] bg-gradient-to-b from-[#FFF9E5] to-white z-0"></div>
          </>
       )}
    </div>

    <div className="relative z-10 w-full h-full flex flex-col items-center justify-between p-2">
      <div
        className={`absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wider transition-colors ${isDisabled ? "text-gray-400" : isSelected ? "text-amber-500" : "text-gray-400"}`}
      >
        {type.name}
      </div>
      <div className="w-full h-14 flex items-center justify-center mt-3 relative">
        <img
          src={type.image}
          className={`w-full h-full object-contain drop-shadow-md transition-all duration-700 ease-out mix-blend-multiply ${
            isDisabled
              ? "opacity-50"
              : isSelected
                ? "scale-[1.25] -translate-y-1 drop-shadow-2xl"
                : "scale-100 grayscale-[0.1] opacity-95"
          }`}
          alt={type.name}
          onError={(e) => {
            (e.target as HTMLImageElement).style.opacity = "0";
          }}
        />
        {isSelected && (
          <div className="absolute -bottom-1.5 w-12 h-0.5 bg-black/20 rounded-full blur-md animate-pulse"></div>
        )}
      </div>
      <div className="text-center w-full z-10 mt-auto pb-0.5">
        <div className="text-[9px] font-bold text-gray-400 mb-0.5">
          {duration} min
        </div>
        <div className="font-black text-lg text-gray-900 leading-none" dir="ltr">
          {priceRange ? priceRange.recommended : "..."}{" "}
          <span className="text-[10px] font-bold text-gray-500">
            {currencyLabel}
          </span>
        </div>
      </div>
    </div>
  </button>
);

// ... (Rest of components DriverOfferCard, TripProgressRoadmap remain same)
const DriverOfferCard = ({
  offer,
  onAccept,
  onReject,
  processing,
  isRTL,
  t,
  isBestOffer,
  pickupLocation,
}: any) => {
  const [timeLeft, setTimeLeft] = useState(10);

  let eta = "...";
  let distanceDisplay = "";

  if (offer.driverLocation && pickupLocation) {
    const dist = calculateDistance(
      offer.driverLocation.lat,
      offer.driverLocation.lng,
      pickupLocation.lat,
      pickupLocation.lng,
    );
    const etaVal = Math.ceil(dist * 3);
    eta = etaVal.toString();
    distanceDisplay = dist.toFixed(1);
  } else {
    eta = (Math.floor(Math.random() * 5) + 2).toString();
  }

  const year = offer.vehicleYear || "2015";

  useEffect(() => {
    if (processing) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setTimeout(() => onReject(offer), 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [processing, offer, onReject]);

  const progressPercent = (timeLeft / 10) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={cn(
        "glass-card p-3 transition-all duration-300 relative",
        isBestOffer
          ? "border-[#FFC90E] shadow-[0_0_15px_rgba(255,201,14,0.3)]"
          : "border-glass-border",
      )}
    >
      {isBestOffer && (
        <div
          className={cn(
            "absolute top-0 px-2 py-[2px] bg-[#FFC90E] text-black text-[9px] font-black rounded-b-md uppercase tracking-widest z-10",
            isRTL ? "right-5" : "left-5",
          )}
        >
          {t("best_offer")}
        </div>
      )}

      <div className="flex justify-between items-center mb-3 mt-1 relative z-10">
        <div className="flex flex-col items-center justify-center bg-black/5 rounded-xl px-2 py-1 min-w-[50px] backdrop-blur-md">
          <div
            className={cn(
              "text-[13px] font-black leading-none",
              timeLeft < 5 ? "text-red-500 animate-pulse" : "text-blue-600",
            )}
          >
            {timeLeft}s
          </div>
          <div className="text-[9px] text-gray-500 mt-[2px] font-bold uppercase tracking-widest">
            {isRTL ? "دقيقة" : "min"}
          </div>
        </div>

        <div className="flex flex-col text-end">
          <div className="flex gap-1 items-end justify-end">
            <span className="text-3xl leading-none font-black text-[#0f172a] drop-shadow-sm tracking-tighter">
              {offer.price}
            </span>
            <span className="text-xs font-bold text-gray-500 pb-[2px] uppercase">
              {t("currency")}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4 bg-black/5 backdrop-blur-md p-2.5 rounded-2xl border border-glass-border relative z-10">
        <div className="relative shrink-0">
          {offer.driverName ? (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-sm border border-white/50">
              {offer.driverName.substring(0, 2).toUpperCase()}
            </div>
          ) : (
            <img
              src={
                offer.driverAvatar ||
                "https://ui-avatars.com/api/?name=Driver&background=random"
              }
              className="w-10 h-10 rounded-xl object-cover shadow-sm border border-white/50"
              alt="driver"
            />
          )}
          <div
            className={cn(
              "absolute -bottom-1 -right-1 bg-yellow-400 rounded-md px-1 py-[1.5px] shadow-sm border-2 border-white flex items-center gap-[2px]",
            )}
          >
            <Star className="w-2 h-2 text-yellow-900 fill-current" />
            <span className="text-[9px] font-black text-yellow-900 leading-none">
              {offer.driverRating?.toFixed(1) || "5.0"}
            </span>
          </div>
        </div>
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-gray-900 text-sm truncate leading-tight">
              {offer.driverName}
            </span>
            {offer.isVerified && (
              <ShieldCheck className="w-[14px] h-[14px] text-blue-500 fill-blue-50" />
            )}
            {offer.driverLevel && <DriverBadge level={offer.driverLevel} />}
          </div>
          <div className="text-[11px] text-gray-500 font-medium tracking-tight truncate mt-0.5">
            {offer.vehicleBrand} {offer.vehicleModel} • {year}
          </div>
        </div>

        {offer.driverLocation && pickupLocation && (
          <div className="flex flex-col items-end pr-1 border-l border-gray-200/50 pl-3">
            <span className="text-[12px] font-black text-gray-900">
              {distanceDisplay} km
            </span>
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
              {eta} {t("min")}
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-2 relative w-full mb-1 z-10">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            HapticsService.medium();
            onReject(offer);
          }}
          disabled={processing}
          className="w-12 h-12 rounded-[14px] bg-red-50 text-red-500 flex items-center justify-center transition-all hover:bg-red-100 hover:text-red-600 shrink-0 border border-red-100/50"
        >
          <X className="w-5 h-5 stroke-[2.5]" />
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            HapticsService.success();
            onAccept(offer);
          }}
          disabled={processing}
          className="flex-[1.2] relative overflow-hidden text-white font-black text-sm rounded-[14px] transition-all flex items-center justify-center gap-2 h-12 shadow-md uppercase tracking-wider"
          style={{
            backgroundColor: "#1f44df",
            boxShadow: "0 4px 14px 0 rgba(31, 68, 223, 0.3)",
          }}
        >
          {processing ? <Zap className="w-4 h-4 animate-pulse" /> : t("accept")}
        </motion.button>
      </div>

      {/* Progress line indicator */}
      {!processing && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gray-100/50">
          <motion.div
            initial={{ width: "100%" }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ ease: "linear", duration: 1 }}
            className="h-full bg-[#1f44df]"
          />
        </div>
      )}
    </motion.div>
  );
};

const TripProgressRoadmap = ({
  status,
  isRTL,
}: {
  status: RideStatus;
  isRTL: boolean;
}) => {
  const { t } = useLanguage();
  let progress = 5;
  let iconProps = {};
  if (status === RideStatus.ACCEPTED) {
    progress = 10;
    iconProps = { scale: 1.1 };
  }
  if (status === RideStatus.ARRIVED) {
    progress = 40;
    iconProps = { scale: 1.25, rotate: isRTL ? -10 : 10 };
  }
  if (status === RideStatus.IN_PROGRESS) {
    progress = 75;
    iconProps = { scale: 1.15 };
  }
  if (status === RideStatus.COMPLETED) {
    progress = 100;
    iconProps = { scale: 1, rotate: 0 };
  }
  return (
    <div className="w-full px-4 mb-4 mt-1">
      <div className="flex justify-between text-[8px] font-black text-gray-400 mb-2 uppercase tracking-widest relative">
        <motion.span
          animate={{
            color: status === RideStatus.ACCEPTED ? "#FFC90E" : "#9ca3af",
          }}
          className={`transition-colors ${status === RideStatus.ACCEPTED ? "text-[#FFC90E]" : ""}`}
        >
          {t("status_accepted")}
        </motion.span>
        <motion.span
          animate={{
            color: status === RideStatus.ARRIVED ? "#FFC90E" : "#9ca3af",
          }}
          className={`transition-colors ${status === RideStatus.ARRIVED ? "text-[#FFC90E]" : ""}`}
        >
          {t("status_arrived")}
        </motion.span>
        <motion.span
          animate={{
            color: status === RideStatus.COMPLETED ? "#FFC90E" : "#9ca3af",
          }}
          className={`transition-colors ${status === RideStatus.COMPLETED ? "text-[#FFC90E]" : ""}`}
        >
          {t("status_completed")}
        </motion.span>
      </div>
      <div className="relative h-1.5 bg-gray-100 rounded-full w-full overflow-visible">
        <motion.div
          initial={{ width: "5%" }}
          animate={{ width: `${progress}%` }}
          transition={{ type: "spring", stiffness: 50, damping: 15 }}
          className="absolute top-0 h-full bg-[#FFC90E] rounded-full shadow-[0_0_10px_rgba(255,201,14,0.4)]"
          style={{ left: isRTL ? "auto" : 0, right: isRTL ? 0 : "auto" }}
        />
        <motion.div
          initial={{
            left: isRTL ? "auto" : "5%",
            right: isRTL ? "5%" : "auto",
            y: "-50%",
          }}
          animate={{
            left: isRTL ? "auto" : `calc(${progress}% - 14px)`,
            right: isRTL ? `calc(${progress}% - 14px)` : "auto",
            y: "-50%",
            ...iconProps,
          }}
          transition={{ type: "spring", stiffness: 55, damping: 14 }}
          className="absolute top-1/2 w-7 h-7 bg-white border-[2px] border-[#FFC90E] rounded-full flex items-center justify-center shadow-md z-20"
        >
          <i
            className={`fas fa-car text-[#FFC90E] text-[10px] ${isRTL ? "scale-x-[-1]" : ""}`}
          ></i>
        </motion.div>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={status}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.2 }}
          className="text-center mt-3 font-bold text-[10px] text-gray-800 bg-gray-50 py-1 px-3 rounded-full mx-auto w-fit shadow-sm border border-gray-100"
        >
          {status === RideStatus.ACCEPTED && t("driver_arriving")}
          {status === RideStatus.ARRIVED && t("arrived_pickup")}
          {status === RideStatus.IN_PROGRESS && t("heading_to")}
          {status === RideStatus.COMPLETED && t("trip_completed")}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default function PassengerApp({
  user,
  rebookData,
  clearRebookData,
  onNavigate,
  setSupportRideId,
  onHeaderVisibilityChange,
}: PassengerAppProps) {
  useEffect(() => {
    console.log("⏱️ Startup Timing: Home Rendered (Passenger)", performance.now(), 'ms');
  }, []);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const { t, isRTL, language } = useLanguage();

  const VEHICLE_TYPES = [
    {
      id: VehicleType.MOTO,
      name: t("vehicle_moto"),
      image: getAsset("assets/moto.png"),
      seats: 1,
    },
    {
      id: VehicleType.STANDARD,
      name: t("vehicle_standard"),
      image: getAsset("assets/standard.png"),
      seats: 4,
    },
    {
      id: VehicleType.COMFORT,
      name: t("vehicle_comfort"),
      image: getAsset("assets/comf.png"),
      seats: 4,
    },
  ];

  const [rideStatus, setRideStatus] = useState<RideStatus>(() => {
    const cached = localStorage.getItem('mowasla_ride_status');
    return cached ? (cached as RideStatus) : RideStatus.IDLE;
  });
  const [rideType, setRideType] = useState<"RIDE" | "PARCEL">("RIDE");
  const [currentRideId, setCurrentRideId] = useState<string | null>(() => {
    return localStorage.getItem('mowasla_ride_id');
  });
  const [activeRideData, setActiveRideData] = useState<Ride | null>(() => {
    try {
      const cached = localStorage.getItem('mowasla_ride_data');
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  const activeRideDataRef = useRef<Ride | null>(activeRideData);
  useEffect(() => {
    activeRideDataRef.current = activeRideData;
  }, [activeRideData]);
  
  useEffect(() => {
    if (rideStatus === RideStatus.IDLE || rideStatus === RideStatus.CANCELLED || rideStatus === RideStatus.COMPLETED) {
        localStorage.removeItem('mowasla_ride_status');
        localStorage.removeItem('mowasla_ride_id');
        localStorage.removeItem('mowasla_ride_data');
    } else {
        localStorage.setItem('mowasla_ride_status', rideStatus);
        if (currentRideId) localStorage.setItem('mowasla_ride_id', currentRideId);
        if (activeRideData) localStorage.setItem('mowasla_ride_data', JSON.stringify(activeRideData));
    }
  }, [rideStatus, currentRideId, activeRideData]);

  const [offers, setOffers] = useState<OfferDetails[]>([]);
  const [rejectedOfferIds, setRejectedOfferIds] = useState<string[]>([]);
  const [driverEta, setDriverEta] = useState<string | null>(null);
  const [searchTimer, setSearchTimer] = useState<any | null>(null);
  const [expiredRide, setExpiredRide] = useState<Ride | null>(null);
  const [useRewardDiscount, setUseRewardDiscount] = useState<boolean>(() => {
    try {
      return localStorage.getItem("mowasla_use_reward_discount") === "true";
    } catch {
      return false;
    }
  });
  const rewardPoints = Number(user.rewardPoints || 0);
  const isRewardsEnabled = appSettings?.isRewardsEnabled !== false;
  const rewardThresholdPoints = Math.max(1, Number(appSettings?.rewardThresholdPoints ?? 50));
  const rewardDiscountAmount = Math.max(1, Number(appSettings?.rewardDiscountAmount ?? 20));
  const rewardPointsPerTrip = Math.max(1, Number(appSettings?.rewardPointsPerTrip ?? 5));
  const isRewardEligible = isRewardsEnabled && rewardPoints >= rewardThresholdPoints;

  const handleToggleUseRewardDiscount = useCallback((nextVal: boolean) => {
    setUseRewardDiscount(nextVal);
    try {
      localStorage.setItem("mowasla_use_reward_discount", nextVal ? "true" : "false");
      window.dispatchEvent(
        new CustomEvent("mowasla-reward-discount-change", { detail: { active: nextVal } })
      );
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (!isRewardEligible && useRewardDiscount) {
      setUseRewardDiscount(false);
      try {
        localStorage.setItem("mowasla_use_reward_discount", "false");
      } catch {}
    }
  }, [isRewardEligible, useRewardDiscount]);

  useEffect(() => {
    const onDiscountEvent = (e: Event) => {
      const customEvt = e as CustomEvent;
      if (customEvt.detail && typeof customEvt.detail.active === "boolean") {
        setUseRewardDiscount(customEvt.detail.active && isRewardEligible);
      } else {
        try {
          setUseRewardDiscount(
            localStorage.getItem("mowasla_use_reward_discount") === "true" && isRewardEligible
          );
        } catch {}
      }
    };
    window.addEventListener("mowasla-reward-discount-change", onDiscountEvent);
    window.addEventListener("storage", onDiscountEvent);
    return () => {
      window.removeEventListener("mowasla-reward-discount-change", onDiscountEvent);
      window.removeEventListener("storage", onDiscountEvent);
    };
  }, [isRewardEligible]);

  const [searchNotification, setSearchNotification] = useState<string | null>(
    null,
  );
  const [searchCountdown, setSearchCountdown] = useState(120); // 2 minutes countdown
  const [showSearchTimeoutModal, setShowSearchTimeoutModal] = useState(false);
  const [priceBoostNotice, setPriceBoostNotice] = useState<string | null>(null);
  const priceBoostedAt50Ref = useRef(false);
  const [draftSearchFare, setDraftSearchFare] = useState<number>(0);
  const [isUpdatingSearchFare, setIsUpdatingSearchFare] = useState<boolean>(false);
  const [searchFareUpdateStatus, setSearchFareUpdateStatus] = useState<{
    message: string;
    isIncrease: boolean;
  } | null>(null);
  const lastCommittedSearchFareRef = useRef<number>(0);
  const lastTrackedFareRideIdRef = useRef<string | null>(null);
  const searchEndTimeRef = useRef<number | null>(null);
  const trackedSearchRideIdRef = useRef<string | null>(null);
  const savedRemainingSecondsRef = useRef<number>(120);
  const [showSearchTripDetails, setShowSearchTripDetails] = useState(false);
  const [searchElapsedTime, setSearchElapsedTime] = useState(0);
  const [searchTotalTime, setSearchTotalTime] = useState(120);
  const [showExpressPopup, setShowExpressPopup] = useState(false);
  const searchTimerRef = useRef<any>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [processingOfferId, setProcessingOfferId] = useState<string | null>(
    null,
  );
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [cancellationReason, setCancellationReason] = useState<string>("");
  const [customReason, setCustomReason] = useState<string>("");
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [tripRating, setTripRating] = useState(0);
  const [tripComment, setTripComment] = useState("");
  const [showFareSheet, setShowFareSheet] = useState(false);
  const [showFareBreakdown, setShowFareBreakdown] = useState(false);
  const [showInstaPaySheet, setShowInstaPaySheet] = useState(false);
  const [nearbyAlertTriggered, setNearbyAlertTriggered] = useState(false);
  const [nearbyDistance, setNearbyDistance] = useState<number | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduledTime, setScheduledTime] = useState("");
  const [showScheduleSuccess, setShowScheduleSuccess] = useState(false);
  const [showScheduleTriggerModal, setShowScheduleTriggerModal] =
    useState(false);
  const [scheduleCountdown, setScheduleCountdown] = useState<string>("");
  const [isScheduleDue, setIsScheduleDue] = useState(false);
  const [topNotification, setTopNotification] = useState<{
    title: string;
    body: string;
    type: "offer" | "success" | "message" | "status";
  } | null>(null);
  const prevRideStatus = useRef<RideStatus>(RideStatus.IDLE);
  const lastMessageIdRef = useRef<string | null>(null);
  const prevOffersLength = useRef(0);
  const getCachedLocation = (): Coordinates | null => {
    try {
      const s = localStorage.getItem("passenger_last_loc");
      if (!s) return null;
      const parsed = JSON.parse(s);
      if (parsed && typeof parsed.lat === "number" && typeof parsed.lng === "number") {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  };
  const [isInitialLocating, setIsInitialLocating] =
    useState<boolean>(!getCachedLocation());
  const [pickup, setPickup] = useState<Coordinates | null>(() => {
    try {
      const cached = localStorage.getItem('mowasla_ride_data');
      if (cached) {
        const coords = JSON.parse(cached)?.pickup?.coords;
        if (coords && typeof coords.lat === 'number') return coords;
      }
    } catch {}
    return getCachedLocation();
  });
  const [dropoff, setDropoff] = useState<Coordinates | null>(() => {
    try {
      const cached = localStorage.getItem('mowasla_ride_data');
      if (cached) return JSON.parse(cached).dropoff.coords;
    } catch {}
    return null;
  });
  const [pickupAddress, setPickupAddress] = useState<string>(() => {
    try {
      const cached = localStorage.getItem('mowasla_ride_data');
      if (cached) {
        const addr = JSON.parse(cached)?.pickup?.address;
        if (addr) return addr;
      }
      const lastAddr = localStorage.getItem('passenger_last_addr');
      if (lastAddr && !(language === 'ar' && /[A-Za-z]/.test(lastAddr) && !/[\u0600-\u06FF]/.test(lastAddr))) {
        return lastAddr;
      }
    } catch {}
    return "";
  });
  const [cityName, setCityName] = useState<string>(() => {
    try {
      return localStorage.getItem('passenger_last_city') || "";
    } catch {
      return "";
    }
  });
  const [dropoffAddress, setDropoffAddress] = useState<string>(() => {
    try {
      const cached = localStorage.getItem('mowasla_ride_data');
      if (cached) return JSON.parse(cached).dropoff.address;
    } catch {}
    return "";
  });
  const [mapCenter, setMapCenter] = useState<Coordinates | null>(() => {
    try {
      const cached = localStorage.getItem('mowasla_ride_data');
      if (cached) {
        const coords = JSON.parse(cached)?.pickup?.coords;
        if (coords && typeof coords.lat === 'number') return coords;
      }
    } catch {}
    return getCachedLocation();
  });
  const [passengerLocation, setPassengerLocation] =
    useState<Coordinates | null>(getCachedLocation());
  const passengerLocationRef = useRef<Coordinates | null>(passengerLocation);
  const hasCustomPickupRef = useRef<boolean>(false);
  const isPickingFromMapRef = useRef<"none" | "pickup" | "dropoff">("none");
  const lastEtaCalcRef = useRef<{ lat: number; lng: number; at: number } | null>(null);

  useEffect(() => {
    passengerLocationRef.current = passengerLocation;
  }, [passengerLocation]);
  const [isMapAutoFollowing, setIsMapAutoFollowing] = useState(true);
  const [showMapTooltip, setShowMapTooltip] = useState(false);
  const [isMapMoving, setIsMapMoving] = useState(false);

  useEffect(() => {
    let watchId: string | null = null;
    const handleWatchedCoords = (loc: Coordinates, accuracy?: number) => {
      if (
        !loc ||
        typeof loc.lat !== "number" ||
        typeof loc.lng !== "number" ||
        !Number.isFinite(loc.lat) ||
        !Number.isFinite(loc.lng) ||
        (loc.lat === 0 && loc.lng === 0)
      ) {
        return;
      }
      if (
        typeof accuracy === "number" &&
        Number.isFinite(accuracy) &&
        accuracy > 80 &&
        passengerLocationRef.current
      ) {
        return;
      }
      setPassengerLocation((prev) => {
        if (prev && calculateDistance(prev.lat, prev.lng, loc.lat, loc.lng) < 0.005) {
          return prev;
        }
        return loc;
      });
      localStorage.setItem("passenger_last_loc", JSON.stringify(loc));
      setIsInitialLocating(false);

      // Keep pickup and mapCenter synchronized with current GPS location if passenger hasn't chosen a custom pin
      if (!hasCustomPickupRef.current && isPickingFromMapRef.current !== "pickup" && !activeRideDataRef.current) {
        setPickup((prev) => {
          if (!prev || calculateDistance(prev.lat, prev.lng, loc.lat, loc.lng) >= 0.005) {
            return loc;
          }
          return prev;
        });
        setMapCenter((prev) => prev || loc);
      }
    };

    const startWatch = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
            await CapacitorService.ensureLocationPermission();
            watchId = await CapacitorService.watchPosition((pos, err) => {
                if (err || !pos?.coords) return;
                handleWatchedCoords(
                  { lat: pos.coords.latitude, lng: pos.coords.longitude },
                  pos.coords.accuracy
                );
            });
        } catch (e: any) { 
          if (e?.code !== 1 && e?.message !== "Permission denied") {
            console.error("Native watch error", e); 
          }
        }
      } else {
        if (!navigator.geolocation) return;
        const id = navigator.geolocation.watchPosition(
          (pos) => {
            handleWatchedCoords(
              { lat: pos.coords.latitude, lng: pos.coords.longitude },
              pos.coords.accuracy
            );
          },
          (err) => {
            if (err?.code !== 1) { // 1 = PERMISSION_DENIED
              console.warn("Passenger watch position notice:", err?.message || err);
            }
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
        );
        watchId = id.toString();
      }
    };
    startWatch();

    return () => {
        if (watchId) {
            if (Capacitor.isNativePlatform()) {
                Geolocation.clearWatch({ id: watchId });
            } else {
                navigator.geolocation.clearWatch(parseInt(watchId));
            }
        }
    };
  }, []);
  const [assignedDriver, setAssignedDriver] = useState<Driver | null>(null);
  const [assignedDriverLoc, setAssignedDriverLoc] =
    useState<Coordinates | null>(null);
  const [assignedDriverHeading, setAssignedDriverHeading] = useState<
    number | undefined
  >(undefined);
  const [isDriverFavorite, setIsDriverFavorite] = useState(false);
  const [searchMode, setSearchMode] = useState<"none" | "pickup" | "dropoff">(
    "none",
  );
  const [isPickingFromMap, setIsPickingFromMap] = useState<
    "none" | "pickup" | "dropoff"
  >("none");
  const mapMoveAbortRef = useRef<AbortController | null>(null);
  const mapMoveSeqRef = useRef<number>(0);
  const lastResolvedPickRef = useRef<{
    lat: number;
    lng: number;
    address: string;
    mode: "pickup" | "dropoff";
  } | null>(null);
  useEffect(() => {
    isPickingFromMapRef.current = isPickingFromMap;
  }, [isPickingFromMap]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Place[]>([]);
  const [localHistory, setLocalHistory] = useState<Place[]>(() => getLocalRecentSearches());
  const [recentPlaces, setRecentPlaces] = useState<Place[]>([]);
  const [pastRidePlaces, setPastRidePlaces] = useState<Place[]>([]);
  const [isSearchingLoading, setIsSearchingLoading] = useState(false);
  const [showLocationConfirm, setShowLocationConfirm] = useState(false);
  const currentDriverIdRef = useRef<string | null>(null);
  const [distanceKm, setDistanceKm] = useState<number>(0);
  const [isLocating, setIsLocating] = useState(false);
  const [showLocationTooltip, setShowLocationTooltip] = useState(true);
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLocationTooltip(false);
    }, 10000);
    return () => clearTimeout(timer);
  }, []);

  const [selectedVehicleType, setSelectedVehicleType] = useState<VehicleType>(
    VehicleType.STANDARD,
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    PaymentMethod.CASH,
  );
  const [offeredFare, setOfferedFare] = useState(0);
  const [customFare, setCustomFare] = useState(0);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("NORMAL");
  const [priceRanges, setPriceRanges] = useState<{
    [key in VehicleType]?: { 
      min: number; 
      recommended: number; 
      max: number;
      breakdown?: {
        baseFare: number;
        distanceFare: number;
        timeFare: number;
        fees: number;
        surge: number;
        total: number;
      };
    };
  }>({});
  const [parcelDetails, setParcelDetails] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  // --- Book a Ride for Someone Else State ---
  const [bookingType, setBookingType] = useState<BookingType>("SELF");
  const [showBookForOtherModal, setShowBookForOtherModal] = useState(false);
  const [otherPassengerName, setOtherPassengerName] = useState("");
  const [otherPassengerPhone, setOtherPassengerPhone] = useState("");
  const [otherPassengerCountryCode, setOtherPassengerCountryCode] = useState("+20");
  const [otherPassengerNote, setOtherPassengerNote] = useState("");
  const [rideVerificationEnabled, setRideVerificationEnabled] = useState(false);
  const [otherPassengerError, setOtherPassengerError] = useState<string | null>(null);
  const [showSavedContactsPicker, setShowSavedContactsPicker] = useState(false);

  const savedOtherContacts = useMemo(() => {
    const safetyList = (user.safetyContacts || []).map((c) => ({
      name: c.name,
      phone: c.phone,
    }));
    const recentOtherList = getSavedOtherPassengers(user.id);
    const merged: { name: string; phone: string }[] = [];
    const seen = new Set<string>();
    for (const item of [...recentOtherList, ...safetyList]) {
      if (!item?.name || !item?.phone) continue;
      const key = item.phone.replace(/\s+/g, "");
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(item);
      }
    }
    return merged;
  }, [user.id, user.safetyContacts, bookingType]);

  const [isSosActivated, setIsSosActivated] = useState(false);
  const [targetPreferredDrivers, setTargetPreferredDrivers] = useState<
    string[]
  >([]);
  const [isLargeGroup, setIsLargeGroup] = useState(false);
  const [motoWarningAccepted, setMotoWarningAccepted] = useState(false);
  const [showMotoWarning, setShowMotoWarning] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [isDriverDetailsExpanded, setIsDriverDetailsExpanded] = useState(false);
  const successAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Auto-expand driver details for 5s after waiting 8s on accepted trip
  useEffect(() => {
    let hideTimer: any;
    if (rideStatus === RideStatus.ACCEPTED) {
      setIsDriverDetailsExpanded(false);

      const showTimer = setTimeout(() => {
        setIsDriverDetailsExpanded(true);
        hideTimer = setTimeout(() => {
          setIsDriverDetailsExpanded(false);
        }, 5000);
      }, 8000);

      return () => {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
      };
    }
  }, [rideStatus]);

  useEffect(() => {
    // Setup background audio context unlock
    const unlockAudio = () => {
      const unlock = (audio: HTMLAudioElement) => {
        audio
          .play()
          .then(() => {
            audio.pause();
            audio.currentTime = 0;
          })
          .catch(() => {});
      };

      if (audioRef.current) unlock(audioRef.current);
      if (successAudioRef.current) unlock(successAudioRef.current);

      document.removeEventListener("click", unlockAudio);
      document.removeEventListener("touchstart", unlockAudio);
    };

    document.addEventListener("click", unlockAudio);
    document.addEventListener("touchstart", unlockAudio);

    return () => {
      document.removeEventListener("click", unlockAudio);
      document.removeEventListener("touchstart", unlockAudio);
    };
  }, []);

  // Play audio safely across environments
  const playAlertSound = useCallback(
    async (
      type:
        | "success"
        | "alert"
        | "arrival"
        | "counter_offer"
        | "cancelled" = "alert",
    ) => {
      try {
        const settings = user.notificationSettings;
        if (settings) {
          if (type === "success" && settings.driverAcceptedSound === false)
            return;
          if (type === "arrival" && settings.driverNearingAlert === false)
            return;
          if (type === "cancelled" && settings.rideCancelledAlert === false)
            return;
          if (type === "counter_offer" && settings.generalAppNotifs === false)
            return;
        }

        const { AudioService } = await import("../services/audioService");
        if (type === "success") {
          await AudioService.play("accepted");
        } else if (type === "arrival") {
          await AudioService.play("arrival");
        } else if (type === "counter_offer") {
          await AudioService.play("counter_offer");
        } else if (type === "cancelled") {
          await AudioService.play("cancelled");
        } else {
          await AudioService.play("incoming_ride");
        }

        const { CapacitorService } =
          await import("../services/capacitorService");
        await CapacitorService.impact();
      } catch (e) {
        console.warn("Haptics/Audio failed", e);
      }
    },
    [user.notificationSettings],
  );

  // Sheet Minimize State
  const [isSheetMinimized, setIsSheetMinimized] = useState(false);

  // --- AIRPORT FEE STATE ---
  const [pricingConfig, setPricingConfig] = useState<PricingConfig | null>(
    null,
  );
  const [isAirportRide, setIsAirportRide] = useState(false);
  const [showAirportInfo, setShowAirportInfo] = useState(false);
  const [airportInfoShownInSession, setAirportInfoShownInSession] =
    useState(false);

  // --- CUSTOM DATE PICKER STATE ---
  const [showScheduleSheet, setShowScheduleSheet] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(
    new Date(Date.now() + 60 * 60 * 1000),
  ); // Default +1h
  const [selectedHour, setSelectedHour] = useState<number>(
    new Date(Date.now() + 60 * 60 * 1000).getHours() % 12 || 12,
  );
  const [selectedMinute, setSelectedMinute] = useState<number>(0);
  const [selectedPeriod, setSelectedPeriod] = useState<"AM" | "PM">(
    new Date(Date.now() + 60 * 60 * 1000).getHours() >= 12 ? "PM" : "AM",
  );
  const [scheduledPassengerCount, setScheduledPassengerCount] = useState<number>(1);
  const [scheduledDriverNote, setScheduledDriverNote] = useState<string>("");
  const [recurringFrequency, setRecurringFrequency] = useState<RecurringFrequency>("ONE_TIME");
  const [recurringWeekdays, setRecurringWeekdays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [recurringEndDate, setRecurringEndDate] = useState<string>("");
  const [showScheduledRidesModal, setShowScheduledRidesModal] = useState<boolean>(false);
  const [confirmedScheduledRide, setConfirmedScheduledRide] = useState<Ride | null>(null);

  // ... (Effects and helpers same as before) ...
  useEffect(() => {
    const unsubscribe = subscribeToOnlineDrivers((drivers) => {
      setAvailableDrivers(drivers);
    });
    return () => unsubscribe();
  }, []);
  const sessionStartTime = useRef(Date.now());
  const [showForceReload, setShowForceReload] = useState(false);
  const [showWelcomeOffer, setShowWelcomeOffer] = useState(() => {
    try {
      const stored = localStorage.getItem(`mowasla_welcome_offer_${user?.id}`);
      // If appSettings is not loaded yet, we'll check again in a useEffect
      return !stored;
    } catch {
      return true;
    }
  });

  const handleDismissWelcomeOffer = () => {
    if (appSettings?.welcomeOffer?.pushTimestamp) {
      localStorage.setItem(
        `mowasla_welcome_offer_${user?.id}_${appSettings.welcomeOffer.pushTimestamp}`,
        "true",
      );
    } else {
      localStorage.setItem(`mowasla_welcome_offer_${user?.id}`, "true");
    }
    setShowWelcomeOffer(false);
  };

  useEffect(() => {
    if (
      appSettings?.welcomeOffer &&
      appSettings.welcomeOffer.isEnabled !== false
    ) {
      const timestamp = appSettings.welcomeOffer.pushTimestamp;
      if (timestamp) {
        const seen = localStorage.getItem(
          `mowasla_welcome_offer_${user?.id}_${timestamp}`,
        );
        if (!seen) setShowWelcomeOffer(true);
      }
    }
  }, [
    appSettings?.welcomeOffer?.pushTimestamp,
    appSettings?.welcomeOffer?.isEnabled,
    user?.id,
  ]);

  useEffect(() => {
    if (onHeaderVisibilityChange) {
      if (
        rideStatus === RideStatus.IDLE &&
        !showFareSheet &&
        searchMode === "none"
      ) {
        onHeaderVisibilityChange(true);
      } else {
        onHeaderVisibilityChange(false);
      }
    }
    return () => {
      if (onHeaderVisibilityChange) onHeaderVisibilityChange(true);
    };
  }, [rideStatus, showFareSheet, searchMode, onHeaderVisibilityChange]);

  useEffect(() => {
    const isAdminAccount =
      user?.role === UserRole.ADMIN ||
      Boolean((user as any)?.isAdmin) ||
      checkIsAdmin(auth.currentUser?.email || user?.email, auth.currentUser?.phoneNumber || user?.phone);
    if (isAdminAccount) {
      setShowForceReload(false);
      return;
    }
    const unsub = subscribeToAppSettings((settings) => {
      setAppSettings(settings);
      if (
        settings?.forceReload &&
        settings.forceReload.timestamp > sessionStartTime.current
      ) {
        setShowForceReload(true);
      }
    });
    return () => unsub();
  }, [user?.role, user?.email, user?.phone]);

  // Load past ride pickup/dropoff places so full trip history is always searchable
  useEffect(() => {
    if (!user.id) return;
    let cancelled = false;
    getUserRides(user.id, UserRole.PASSENGER)
      .then((rides) => {
        if (cancelled || !Array.isArray(rides)) return;
        const extracted: Place[] = [];
        for (const r of rides) {
          const ts = typeof r.timestamp === "number" ? r.timestamp : 0;
          if (r.dropoff?.address && r.dropoff?.coords?.lat && r.dropoff?.coords?.lng) {
            extracted.push({
              id: `ride_drop_${r.id}`,
              name: r.dropoff.address,
              address: r.dropoff.address,
              coords: { lat: Number(r.dropoff.coords.lat), lng: Number(r.dropoff.coords.lng) },
              type: "history",
              updatedAt: ts,
            });
          }
          if (r.pickup?.address && r.pickup?.coords?.lat && r.pickup?.coords?.lng) {
            extracted.push({
              id: `ride_pick_${r.id}`,
              name: r.pickup.address,
              address: r.pickup.address,
              coords: { lat: Number(r.pickup.coords.lat), lng: Number(r.pickup.coords.lng) },
              type: "history",
              updatedAt: ts ? ts - 1 : 0,
            });
          }
        }
        setPastRidePlaces(extracted);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const allHistoryPlaces = useMemo(() => {
    return mergePlacesHistory(recentPlaces, localHistory, pastRidePlaces);
  }, [recentPlaces, localHistory, pastRidePlaces]);

  // --- AUTO COMPLETE HOOK ---
  useEffect(() => {
    if (searchMode === "none") return;
    let isCancelled = false;
    const abortController = new AbortController();
    const query = searchQuery.trim();
    const userLoc = passengerLocationRef.current || undefined;

    // 1. Immediately display all matching full history + local Egypt places synchronously (0ms)
    const instantLocal = searchLocalPlacesSync(query, language, userLoc, allHistoryPlaces);
    setSearchResults(instantLocal);

    if (query.length === 0) {
      setIsSearchingLoading(false);
      return () => {
        isCancelled = true;
        abortController.abort();
      };
    }

    // 2. Fetch external real-time autocomplete (from 1+ characters) and merge cleanly
    setIsSearchingLoading(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const results = await searchPlaces(
          query,
          language,
          userLoc,
          allHistoryPlaces,
          abortController.signal,
        );
        if (!isCancelled) {
          setSearchResults(results);
        }
      } catch (e) {
        if (String(e).includes('permission')) {
          console.log('Permission error caught:', e);
        } else if (!abortController.signal.aborted) {
          console.error(e);
        }
      } finally {
        if (!isCancelled) {
          setIsSearchingLoading(false);
        }
      }
    }, 150);

    return () => {
      isCancelled = true;
      abortController.abort();
      clearTimeout(delayDebounceFn);
    };
  }, [searchQuery, searchMode, language, allHistoryPlaces]);

  // Pool of REAL online drivers from Firestore only
  const allDriversPool = useMemo(() => {
    return availableDrivers.filter(
      (d) =>
        Boolean(
          d &&
          d.id &&
          !d.id.startsWith("sim-") &&
          d.isOnline &&
          d.currentLocation &&
          typeof d.currentLocation.lat === "number" &&
          typeof d.currentLocation.lng === "number" &&
          (d.currentLocation.lat !== 0 || d.currentLocation.lng !== 0)
        )
    );
  }, [availableDrivers]);

  const viewingDrivers = useMemo(() => {
    const pool = allDriversPool;
    const centerParam = pickup || passengerLocation || mapCenter || { lat: 26.1202, lng: 32.4789 };

    if (rideStatus === RideStatus.IDLE) {
      return pool
        .filter((driver) => {
          if (!driver.currentLocation) return false;
          const dist = calculateDistance(
            centerParam.lat,
            centerParam.lng,
            driver.currentLocation.lat,
            driver.currentLocation.lng,
          );
          return dist <= 50; // Show real online cars within 50km
        })
        .sort((a, b) => {
          const distA = calculateDistance(
            centerParam.lat,
            centerParam.lng,
            a.currentLocation!.lat,
            a.currentLocation!.lng,
          );
          const distB = calculateDistance(
            centerParam.lat,
            centerParam.lng,
            b.currentLocation!.lat,
            b.currentLocation!.lng,
          );
          return distA - distB;
        })
        .slice(0, 15);
    }
    if (
      !pickup ||
      (rideStatus !== RideStatus.SEARCHING &&
        rideStatus !== RideStatus.OFFER_RECEIVED)
    ) {
      return [];
    }
    const radiusKm = Math.max(activeRideData?.searchRadiusKm || 15, 20);
    const rejectedBy = new Set(activeRideData?.rejectedBy || []);
    const offeredBy = new Set(offers.map((o) => o.driverId));
    return pool
      .filter((driver) => {
        if (
          !driver.currentLocation ||
          rejectedBy.has(driver.id) ||
          offeredBy.has(driver.id)
        ) {
          return false;
        }
        const dist = calculateDistance(
          pickup.lat,
          pickup.lng,
          driver.currentLocation.lat,
          driver.currentLocation.lng,
        );
        if (dist > radiusKm) return false;
        const rideVehicleType = (selectedVehicleType || "STANDARD").toUpperCase();
        const driverVehicleType = (
          driver.vehicleType || "STANDARD"
        ).toUpperCase();
        const isMotoRide =
          rideVehicleType === "MOTO" || rideVehicleType === "SCOOTER";
        const isMotoDriver =
          driverVehicleType === "MOTO" || driverVehicleType === "SCOOTER";
        if (rideType === "PARCEL") {
          return (
            driverVehicleType === "MOTO" ||
            driverVehicleType === "SCOOTER" ||
            driverVehicleType === "STANDARD"
          );
        }
        return isMotoRide === isMotoDriver;
      })
      .sort((a, b) => {
        const distA = calculateDistance(
          pickup.lat,
          pickup.lng,
          a.currentLocation!.lat,
          a.currentLocation!.lng,
        );
        const distB = calculateDistance(
          pickup.lat,
          pickup.lng,
          b.currentLocation!.lat,
          b.currentLocation!.lng,
        );
        return distA - distB;
      })
      .slice(0, 15);
  }, [
    allDriversPool,
    pickup,
    mapCenter,
    passengerLocation,
    rideStatus,
    activeRideData?.searchRadiusKm,
    activeRideData?.rejectedBy,
    offers,
    selectedVehicleType,
    rideType,
  ]);

  const cleanAddress = (addr: string) => {
    if (!addr) return "";
    return addr.replace(/^[A-Z0-9]+\+[A-Z0-9]+[\s,\u060C]*/i, "").trim();
  };

  const calculateDriverEta = useCallback(
    async (driverLocation: Coordinates, pickupLocation: Coordinates) => {
      try {
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${driverLocation.lng},${driverLocation.lat};${pickupLocation.lng},${pickupLocation.lat}?overview=false`,
        );
        const data = await res.json();
        if (data && data.routes && data.routes.length > 0) {
          const durationSec = data.routes[0].duration;
          const estimatedMinutes = Math.ceil(durationSec / 60);
          return `${estimatedMinutes} ${t("min")}`;
        }
      } catch (e) {}
      const dist = calculateDistance(
        driverLocation.lat,
        driverLocation.lng,
        pickupLocation.lat,
        pickupLocation.lng,
      );
      const estimatedMinutes = Math.ceil(dist * 2.5);
      return `~${estimatedMinutes} ${t("min")}`;
    },
    [t],
  );

  const resolvePickupAddressFast = useCallback(
    async (coords: Coordinates) => {
      if (!coords || typeof coords.lat !== "number" || typeof coords.lng !== "number") return;

      const saveResolvedAddress = (addr: string, city: string) => {
        if (addr) {
          setPickupAddress(addr);
          localStorage.setItem("passenger_last_addr", addr);
        }
        if (city) {
          setCityName(city);
          localStorage.setItem("passenger_last_city", city);
        }
        setIsLocating(false);
        setIsInitialLocating(false);
      };

      try {
        const detailed = await reverseGeocodeDetailed(coords, language);
        const addr = cleanAddress(detailed.address || "");
        if (addr) {
          saveResolvedAddress(addr, detailed.city || "");
          return;
        }
      } catch {}

      const cachedAddr = localStorage.getItem("passenger_last_addr");
      const usableCachedAddr =
        cachedAddr &&
        !(language === "ar" && /[A-Za-z]/.test(cachedAddr) && !/[\u0600-\u06FF]/.test(cachedAddr))
          ? cachedAddr
          : "";
      const cachedCity = localStorage.getItem("passenger_last_city") || "";
      const usableCachedCity =
        cachedCity &&
        !(language === "ar" && /[A-Za-z]/.test(cachedCity) && !/[\u0600-\u06FF]/.test(cachedCity))
          ? cachedCity
          : "";
      saveResolvedAddress(usableCachedAddr || t("current_location"), usableCachedCity);
    },
    [language, t]
  );

  const handleGetCurrentLocation = async (
    isStartup = false,
    force = false,
    retryCount = 0,
  ) => {
    if (retryCount === 0) {
      setIsLocating(true);
      if (!pickup && !localStorage.getItem("passenger_last_loc"))
        setIsInitialLocating(true);
      setIsMapAutoFollowing(true);
      if (!isStartup) setIsSheetMinimized(false);

      // 1. FAST PATH: Use cached location & cached address immediately (0ms)
      const cachedLocStr = localStorage.getItem("passenger_last_loc");
      const cachedAddrStr = localStorage.getItem("passenger_last_addr");
      if (cachedLocStr && (isStartup || force)) {
        try {
          const cachedCoords = JSON.parse(cachedLocStr);
          if (cachedCoords && typeof cachedCoords.lat === "number") {
            setPassengerLocation(cachedCoords);
            if (
              force ||
              isStartup ||
              (!activeRideData &&
                isPickingFromMap === "none" &&
                searchMode === "none")
            ) {
              setPickup(cachedCoords);
              setMapCenter(cachedCoords);
              setIsInitialLocating(false);
              const usableCachedAddr =
                cachedAddrStr &&
                !(language === "ar" && /[A-Za-z]/.test(cachedAddrStr) && !/[\u0600-\u06FF]/.test(cachedAddrStr))
                  ? cachedAddrStr
                  : "";
              if (usableCachedAddr && !pickupAddress) {
                setPickupAddress(usableCachedAddr);
              } else if (!pickupAddress || (language === "ar" && /[A-Za-z]/.test(pickupAddress) && !/[\u0600-\u06FF]/.test(pickupAddress))) {
                resolvePickupAddressFast(cachedCoords);
              }
            }
          }
        } catch {}
      }
    }

    const applyCoordinates = (coords: Coordinates, refineOnly = false) => {
      if (!coords || typeof coords.lat !== "number" || typeof coords.lng !== "number") return;
      localStorage.setItem("passenger_last_loc", JSON.stringify(coords));
      setPassengerLocation(coords);
      setIsInitialLocating(false);

      if (force) {
        hasCustomPickupRef.current = false;
      }

      const shouldUpdatePickup =
        (force && !activeRideData && isPickingFromMap !== "dropoff") ||
        isStartup ||
        (!hasCustomPickupRef.current &&
          !activeRideData &&
          isPickingFromMap !== "dropoff" &&
          isPickingFromMap !== "pickup");

      if (shouldUpdatePickup) {
        setPickup(coords);
      }

      if (
        force ||
        isStartup ||
        (!activeRideData &&
          !dropoff &&
          isPickingFromMap === "none" &&
          searchMode === "none") ||
        activeRideData
      ) {
        setMapCenter(coords);
        if (activeRideData && isPickingFromMap === "none") {
          setIsLocating(false);
          return;
        }
      }

      if (shouldUpdatePickup) {
        resolvePickupAddressFast(coords);
      } else if (!refineOnly) {
        setIsLocating(false);
      }
    };

    try {
      let resolvedAny = false;

      if (Capacitor.isNativePlatform()) {
        await CapacitorService.ensureLocationPermission();

        // Fire fast coarse fix AND high-accuracy GPS concurrently so Android responds in <400ms
        const coarsePromise = Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 2200,
          maximumAge: 300000,
        }).then((pos) => {
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          if (!resolvedAny) {
            resolvedAny = true;
            applyCoordinates(c, false);
          }
          return c;
        });

        const highAccPromise = Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 4500,
          maximumAge: 10000,
        }).then((pos) => {
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          resolvedAny = true;
          applyCoordinates(c, true);
          return c;
        });

        await Promise.any([coarsePromise, highAccPromise]);
      } else {
        if (!navigator.geolocation) {
          throw new Error("Geolocation not supported");
        }

        const getWebPos = (
          enableHighAccuracy: boolean,
          timeout: number,
          maximumAge: number
        ): Promise<Coordinates> =>
          new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              (pos) =>
                resolve({
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                }),
              (err) => reject(err),
              { enableHighAccuracy, timeout, maximumAge }
            );
          });

        // Fire fast coarse/cached position (2.2s) and high-accuracy GPS (4.5s) in parallel
        const coarseWebPromise = getWebPos(false, 2200, 300000).then((c) => {
          if (!resolvedAny) {
            resolvedAny = true;
            applyCoordinates(c, false);
          }
          return c;
        });

        const highAccWebPromise = getWebPos(true, 4500, 15000).then((c) => {
          resolvedAny = true;
          applyCoordinates(c, true);
          return c;
        });

        await Promise.any([coarseWebPromise, highAccWebPromise]);
      }
    } catch (geoErr: any) {
      // Fallback 1: Use cached coordinates if available
      const cached = getCachedLocation() || pickup;
      if (cached) {
        applyCoordinates(cached, false);
        return;
      }

      // Fallback 2: Fast IP-based geolocation so web/devices without GPS still get user's city immediately
      try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 2000);
        const ipRes = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=${language}`,
          { signal: controller.signal }
        );
        clearTimeout(tid);
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          if (typeof ipData.latitude === "number" && typeof ipData.longitude === "number") {
            const ipCoords = { lat: ipData.latitude, lng: ipData.longitude };
            applyCoordinates(ipCoords, false);
            return;
          }
        }
      } catch {}

      // Fallback 3: Default coordinates (Dishna / Qena)
      const defaultCoords = { lat: 26.1202, lng: 32.4789 };
      applyCoordinates(defaultCoords, false);
    }
  };

  useEffect(() => {
    if (!user.id) return;
    const unsubscribe = subscribeToRecentDestinations(user.id, (places) => {
      setRecentPlaces(places);
    });
    return () => unsubscribe();
  }, [user.id]);

  // Trigger location fetch immediately on mount and whenever user.id changes (e.g. right after login or new account registration)
  useEffect(() => {
    if (!activeRideData && !rebookData) {
      handleGetCurrentLocation(true, true);
    }
  }, [user.id]);

  // Refresh location when app comes to foreground
  useEffect(() => {
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (!activeRideData && !rebookData) handleGetCurrentLocation(false, false);
      } else {
        if (rideStatus === RideStatus.SEARCHING) {
           CapacitorService.scheduleNotification(isRTL ? "جاري البحث..." : "Still searching...", isRTL ? "نحن نبحث عن أفضل الكباتن لرحلتك." : "We are still looking for the best drivers for you.", 1001);
        }
      }
    };


    let appStateListener: any = null;
    if (Capacitor.isNativePlatform()) {
      App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) {
          if (!activeRideData && !rebookData) handleGetCurrentLocation(false, false);
        } else {
          if (rideStatus === RideStatus.SEARCHING) {
             CapacitorService.scheduleNotification(isRTL ? "جاري البحث..." : "Still searching...", isRTL ? "نحن نبحث عن أفضل الكباتن لرحلتك." : "We are still looking for the best drivers for you.", 1001);
          }
        }
      }).then((listener) => {
        appStateListener = listener;
      });
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (appStateListener) appStateListener.remove();
    };
  }, [activeRideData, rebookData]);

  // Location Confirmation Trigger
  useEffect(() => {
    // Use a versioned session key to ensure it shows at least once after this update
    const hasConfirmed = sessionStorage.getItem("mowasla_loc_confirmed_v6");

    const canShow =
      !showLocationConfirm &&
      rideStatus === RideStatus.IDLE &&
      pickup &&
      pickupAddress &&
      !dropoff &&
      searchMode === "none" &&
      isPickingFromMap === "none";

    if (!hasConfirmed && canShow) {
      const timer = setTimeout(() => {
        setShowLocationConfirm(true);
      }, 1500); // Reduced delay for better visibility
      return () => clearTimeout(timer);
    }
  }, [
    pickup,
    pickupAddress,
    rideStatus,
    dropoff,
    searchMode,
    isPickingFromMap,
    showLocationConfirm,
  ]);

  const confirmLocation = () => {
    sessionStorage.setItem("mowasla_loc_confirmed_v6", "true");
    HapticsService.medium();
    setShowLocationConfirm(false);
  };
  const changeLocation = () => {
    sessionStorage.setItem("mowasla_loc_confirmed_v6", "true");
    setShowLocationConfirm(false);
    handleOpenSearch("pickup");
  };

  const handleActivateSOS = async () => {
    if (!currentRideId || !pickup) return;
    try {
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      await triggerSOS(currentRideId, pickup, "passenger");
      setIsSosActivated(true);
      alert(
        "SOS Activated! Alerts have been dispatched to authorities and your safety contacts.",
      );
    } catch (error) {
      console.error("SOS Activation Failed:", error);
      alert(
        "Failed to activate SOS. Please try again or contact support directly.",
      );
    }
  };

  useEffect(() => {
    if (assignedDriver && user.favoriteDrivers?.includes(assignedDriver.id)) {
      setIsDriverFavorite(true);
    } else {
      setIsDriverFavorite(false);
    }
  }, [assignedDriver, user.favoriteDrivers]);

  // ... (Rest of effects and helpers) ...
  useEffect(() => {
    if (rebookData) {
      setPickup(rebookData.ride.pickup.coords);
      setPickupAddress(rebookData.ride.pickup.address);
      setDropoff(rebookData.ride.dropoff.coords);
      setDropoffAddress(rebookData.ride.dropoff.address);
      setCustomFare(rebookData.ride.fare);
      setSelectedVehicleType(rebookData.ride.requestedVehicleType);
      setPaymentMethod(rebookData.ride.paymentMethod);
      setIsLargeGroup(rebookData.ride.isLargeGroup || false);
      if (rebookData.ride.bookingType === "FOR_OTHER" && rebookData.ride.actualPassenger) {
        setBookingType("FOR_OTHER");
        setOtherPassengerName(rebookData.ride.actualPassenger.name || "");
        setOtherPassengerPhone(rebookData.ride.actualPassenger.phone || "");
        setOtherPassengerNote(rebookData.ride.actualPassenger.note || "");
        setRideVerificationEnabled(Boolean(rebookData.ride.rideVerificationEnabled));
        setShowBookForOtherModal(true);
      } else {
        setBookingType("SELF");
        setShowBookForOtherModal(false);
      }
      if (rebookData.ride.dropoff.coords) {
        setMapCenter(rebookData.ride.dropoff.coords);
      }
      if (rebookData.preferSameDriver && rebookData.ride.driverId) {
        setTargetPreferredDrivers([rebookData.ride.driverId]);
        alert(t("drivers_found"));
      } else {
        setTargetPreferredDrivers([]);
      }
      if (clearRebookData) clearRebookData();
    }
  }, [rebookData]);

  useEffect(() => {
    const restoreSession = async () => {
      const active = await checkActiveRide(user.id, UserRole.PASSENGER);
      if (active) {
        setActiveRideData(active);
        setCurrentRideId(active.id);
        setRideStatus(active.status);
        setPickup(active.pickup.coords);
        setPickupAddress(active.pickup.address);
        setDropoff(active.dropoff.coords);
        setDropoffAddress(active.dropoff.address);
        setMapCenter(active.pickup.coords);
        setIsLargeGroup(active.isLargeGroup || false);
        if (active.driverId) {
          const driver = await getUserProfile(active.driverId);
          if (driver) setAssignedDriver(driver as Driver);
        }
      }
    };
    restoreSession();
  }, [user.id]);

  useEffect(() => {
    const unsub = subscribeToPricingSettings(setPricingConfig);
    return () => unsub();
  }, []);

  const isAirportDetected = useCallback((addr1: string, addr2: string) => {
    const combined = (addr1 + " " + addr2).toLowerCase();
    return (
      combined.includes("airport") ||
      combined.includes("مطار") ||
      combined.includes("international airport")
    );
  }, []);

  useEffect(() => {
    if (pickupAddress && dropoffAddress) {
      const detected = isAirportDetected(pickupAddress, dropoffAddress);
      if (detected && !airportInfoShownInSession) {
        setIsAirportRide(true);
        setShowAirportInfo(true);
        setAirportInfoShownInSession(true);
      } else {
        setIsAirportRide(detected);
      }
    }
  }, [
    pickupAddress,
    dropoffAddress,
    isAirportDetected,
    airportInfoShownInSession,
  ]);

  useEffect(() => {
    if (pickup && dropoff) {
      const dist = calculateDistance(
        pickup.lat,
        pickup.lng,
        dropoff.lat,
        dropoff.lng,
      );
      setDistanceKm(dist);
      const estimatedDuration = Math.ceil(dist * 3);
      const fetchPrices = async () => {
        const ranges: any = {};
        const fee = pricingConfig?.airportFee || 30;
        const surge =
          pricingConfig?.surgeEnabled && pricingConfig?.surgeMultiplier
            ? pricingConfig.surgeMultiplier
            : 1.0;
        for (const type of VEHICLE_TYPES) {
          ranges[type.id] = await calculateDynamicFareRange(
            dist,
            type.id,
            estimatedDuration,
            isAirportRide,
            fee,
            surge,
          );
        }
        setPriceRanges(ranges);
        if (ranges[selectedVehicleType]) {
          setCustomFare(ranges[selectedVehicleType].recommended);
        }
      };
      fetchPrices();
    }
  }, [pickup, dropoff, pickupAddress, isAirportRide, pricingConfig]);

  useEffect(() => {
    if (priceRanges[selectedVehicleType]) {
      setCustomFare(priceRanges[selectedVehicleType]!.recommended);
      setSelectedPresetId("NORMAL");
    }
  }, [selectedVehicleType, priceRanges]);

  const searchFareStep = 5;
  const searchVehicleKey = (activeRideData?.requestedVehicleType ||
    selectedVehicleType) as VehicleType;
  const searchMinFare = Math.max(
    10,
    Number(priceRanges[searchVehicleKey]?.min || 10),
  );
  const committedSearchFare = Number(
    activeRideData?.fare ||
      activeRideData?.price ||
      offeredFare ||
      customFare ||
      0,
  );

  useEffect(() => {
    if (rideStatus === RideStatus.SEARCHING && currentRideId) {
      if (
        lastTrackedFareRideIdRef.current !== currentRideId ||
        lastCommittedSearchFareRef.current !== committedSearchFare
      ) {
        lastTrackedFareRideIdRef.current = currentRideId;
        lastCommittedSearchFareRef.current = committedSearchFare;
        setDraftSearchFare(committedSearchFare);
      }
    } else if (rideStatus === RideStatus.IDLE || !currentRideId) {
      lastTrackedFareRideIdRef.current = null;
      lastCommittedSearchFareRef.current = 0;
      setDraftSearchFare(0);
    }
  }, [rideStatus, currentRideId, committedSearchFare]);

  const handleAdjustSearchFare = (delta: number) => {
    const baseVal =
      draftSearchFare > 0 ? draftSearchFare : committedSearchFare;
    const nextVal = Math.max(searchMinFare, Math.round(baseVal + delta));
    if (nextVal !== draftSearchFare) {
      HapticsService.light();
      setDraftSearchFare(nextVal);
      setSearchFareUpdateStatus(null);
    }
  };

  const handleConfirmSearchFareUpdate = async () => {
    if (!currentRideId || isUpdatingSearchFare) return;
    const baseVal =
      draftSearchFare > 0 ? draftSearchFare : committedSearchFare;
    const newPrice = Math.max(searchMinFare, Math.round(baseVal));
    const oldPrice = committedSearchFare;
    if (newPrice === oldPrice) return;

    const isIncrease = newPrice > oldPrice;
    const nowTs = Date.now();
    setIsUpdatingSearchFare(true);

    try {
      const updatePayload: Record<string, unknown> = {
        fare: newPrice,
        price: newPrice,
        priceBoosted: isIncrease,
        priceChanged: true,
        priceDirection: isIncrease ? "up" : "down",
        lastPriceUpdate: nowTs,
        lastActiveAt: nowTs,
        timestamp: nowTs,
      };

      if (isIncrease) {
        const offersSnap = await getDocs(
          collection(db, "rides", currentRideId, "offers"),
        );
        const activePendingDriverIds = offersSnap.docs
          .map((d) => d.data() as OfferDetails)
          .filter(
            (o) =>
              o &&
              (o.status === "pending" || o.status === "countered") &&
              o.driverId,
          )
          .map((o) => o.driverId);

        updatePayload.rejectedBy = [];
        updatePayload.offeringDriverIds = activePendingDriverIds;
        updatePayload.notifiedDriverIds = [];
      }

      await updateDoc(doc(db, "rides", currentRideId), updatePayload);

      lastCommittedSearchFareRef.current = newPrice;
      setDraftSearchFare(newPrice);
      setOfferedFare(newPrice);
      setCustomFare(newPrice);
      setActiveRideData((prev) =>
        prev
          ? {
              ...prev,
              fare: newPrice,
              price: newPrice,
              priceBoosted: isIncrease,
              priceChanged: true,
              priceDirection: isIncrease ? "up" : "down",
              lastPriceUpdate: nowTs,
              timestamp: nowTs,
            }
          : prev,
      );

      HapticsService.medium();
      setSearchFareUpdateStatus({
        isIncrease,
        message: isRTL
          ? `تم تحديث السعر إلى ${newPrice} ${t("currency", "ج.م")} وإرساله للكباتن الآن`
          : `Fare updated to ${newPrice} ${t("currency", "EGP")} and sent to captains`,
      });
      setTimeout(() => {
        setSearchFareUpdateStatus(null);
      }, 4500);
    } catch (e) {
      console.error("Failed to confirm updated ride fare:", e);
      setSearchFareUpdateStatus({
        isIncrease: false,
        message: isRTL
          ? "تعذر تحديث السعر، حاول مرة أخرى"
          : "Could not update fare, please try again",
      });
    } finally {
      setIsUpdatingSearchFare(false);
    }
  };

  // ... (Rest of effects) ...
  // Search countdown timer (starts at 2 minutes, boosts price at 50s, prompts passenger on timeout)
  useEffect(() => {
    let radiusTimer1: any, radiusTimer2: any;

    if (rideStatus === RideStatus.SEARCHING && currentRideId) {
      // Restore or initialize target end time for the active ride search
      if (trackedSearchRideIdRef.current !== currentRideId) {
        trackedSearchRideIdRef.current = currentRideId;
        let restoredEndTime: number | null = null;
        let restoredBoosted = false;
        try {
          const rawTimer = localStorage.getItem("mowasla_search_timer");
          if (rawTimer) {
            const parsedTimer = JSON.parse(rawTimer);
            if (parsedTimer && parsedTimer.rideId === currentRideId && typeof parsedTimer.endTime === "number") {
              restoredEndTime = parsedTimer.endTime;
              restoredBoosted = Boolean(parsedTimer.boosted);
            }
          }
        } catch {}

        const targetEnd = restoredEndTime && restoredEndTime > Date.now()
          ? restoredEndTime
          : Date.now() + 120 * 1000;
        const initRemaining = Math.max(1, Math.round((targetEnd - Date.now()) / 1000));
        searchEndTimeRef.current = targetEnd;
        savedRemainingSecondsRef.current = initRemaining;
        priceBoostedAt50Ref.current = restoredBoosted;
        setPriceBoostNotice(null);
        setShowSearchTimeoutModal(false);
        setSearchCountdown(initRemaining);
        try {
          localStorage.setItem(
            "mowasla_search_timer",
            JSON.stringify({ rideId: currentRideId, endTime: targetEnd, boosted: restoredBoosted })
          );
        } catch {}
      } else {
        // RESUMING search for the same ride (e.g. after driver offer was rejected/expired)
        const resumeRemaining = Math.max(5, savedRemainingSecondsRef.current || 120);
        const targetEnd = Date.now() + resumeRemaining * 1000;
        searchEndTimeRef.current = targetEnd;
        setSearchCountdown(resumeRemaining);
        try {
          localStorage.setItem(
            "mowasla_search_timer",
            JSON.stringify({ rideId: currentRideId, endTime: targetEnd, boosted: priceBoostedAt50Ref.current })
          );
        } catch {}
      }

      if (searchTimerRef.current) clearInterval(searchTimerRef.current);
      searchTimerRef.current = setInterval(async () => {
        if (!searchEndTimeRef.current) return;
        const remaining = Math.max(0, Math.round((searchEndTimeRef.current - Date.now()) / 1000));
        savedRemainingSecondsRef.current = remaining;
        setSearchCountdown(remaining);

        // When time reaches 50 seconds remaining: automatically increase price and notify drivers/passenger
        if (remaining <= 50 && remaining > 0 && !priceBoostedAt50Ref.current && currentRideId) {
          priceBoostedAt50Ref.current = true;
          try {
            localStorage.setItem(
              "mowasla_search_timer",
              JSON.stringify({ rideId: currentRideId, endTime: searchEndTimeRef.current, boosted: true })
            );
          } catch {}
          try {
            const rideSnap = await getDoc(doc(db, "rides", currentRideId));
            if (rideSnap.exists()) {
              const rData = rideSnap.data() as Ride;
              const currentPrice = Number(rData.fare || rData.price || 35);
              // Smart increase: add 10 EGP or ~15% rounded to nearest 5 EGP (min 10 EGP)
              const boostAdd = Math.max(10, Math.ceil((currentPrice * 0.15) / 5) * 5);
              const newPrice = currentPrice + boostAdd;

              const offersSnap = await getDocs(collection(db, "rides", currentRideId, "offers"));
              const activePendingDriverIds = offersSnap.docs
                .map((d) => d.data() as OfferDetails)
                .filter((o) => o && (o.status === "pending" || o.status === "countered") && o.driverId)
                .map((o) => o.driverId);

              await updateDoc(doc(db, "rides", currentRideId), {
                fare: newPrice,
                price: newPrice,
                priceBoosted: true,
                priceDirection: "up",
                autoBoostAmount: (rData.autoBoostAmount || 0) + boostAdd,
                lastPriceUpdate: Date.now(),
                priceChanged: true,
                timestamp: Date.now(),
                lastActiveAt: Date.now(),
                rejectedBy: [], // Reset rejected drivers so they can review the higher price
                offeringDriverIds: activePendingDriverIds, // Clear previously rejected offerors so they receive the boosted request
                notifiedDriverIds: [], // Allow drivers to be notified again
              });

              const noticeText = isRTL
                ? `تم زيادة السعر تلقائياً إلى ${newPrice} ج.م لتشجيع الكباتن على قبول الرحلة!`
                : `Price automatically increased to ${newPrice} EGP to speed up captain acceptance!`;
              setPriceBoostNotice(noticeText);
              HapticsService.medium();
            }
          } catch (e) {
            console.error("Auto price boost at 50s failed:", e);
          }
        }

        // When 2 minutes finish: stop timer and ask passenger to make new search, continue, or cancel
        if (remaining <= 0) {
          if (searchTimerRef.current) {
            clearInterval(searchTimerRef.current);
            searchTimerRef.current = null;
          }
          setShowSearchTimeoutModal(true);
          HapticsService.heavy();
        }
      }, 1000);

      setSearchNotification(t("searching_3km"));
      radiusTimer1 = setTimeout(async () => {
        if (currentRideId) {
          try {
            await updateDoc(doc(db, "rides", currentRideId), {
              searchRadiusKm: 5,
            });
            setSearchNotification(t("expanding_5km"));
            setSearchTotalTime(75);
          } catch (e) {}
        }
      }, 15000);
      radiusTimer2 = setTimeout(async () => {
        if (currentRideId) {
          try {
            await updateDoc(doc(db, "rides", currentRideId), {
              searchRadiusKm: 8,
            });
            setSearchNotification(t("searching_further"));
            setSearchTotalTime(105);
          } catch (e) {}
        }
      }, 30000);
    } else {
      setSearchNotification(null);
      // When rideStatus is not SEARCHING (e.g. OFFER_RECEIVED):
      // Pause the interval and save the exact remaining time
      if (searchTimerRef.current) {
        clearInterval(searchTimerRef.current);
        searchTimerRef.current = null;
      }
      if (searchEndTimeRef.current) {
        const remaining = Math.max(0, Math.round((searchEndTimeRef.current - Date.now()) / 1000));
        if (remaining > 0) {
          savedRemainingSecondsRef.current = remaining;
        }
      }

      // ONLY discard search state if the ride is truly terminated, accepted, or completed
      if (
        rideStatus !== RideStatus.SEARCHING &&
        rideStatus !== RideStatus.OFFER_RECEIVED
      ) {
        trackedSearchRideIdRef.current = null;
        searchEndTimeRef.current = null;
        savedRemainingSecondsRef.current = 120;
        try {
          localStorage.removeItem("mowasla_search_timer");
        } catch {}
      }
    }
    return () => {
      clearTimeout(radiusTimer1);
      clearTimeout(radiusTimer2);
      if (searchTimerRef.current && rideStatus !== RideStatus.SEARCHING) {
        clearInterval(searchTimerRef.current);
        searchTimerRef.current = null;
      }
    };
  }, [rideStatus, currentRideId]);

  useEffect(() => {
    if (!currentRideId) return;
    const unsubscribe = subscribeToRide(currentRideId, async (updatedRide) => {
      if (!updatedRide) return;

      const newStatus = updatedRide.status;
      const oldStatus = prevRideStatus.current;

      if (newStatus !== oldStatus) {
        if (newStatus === RideStatus.ACCEPTED) {
          playAlertSound("success");
          try {
            CapacitorService.vibrate();
            CapacitorService.scheduleNotification(
              t("status_accepted"),
              t("ride_accepted_notif"),
            );
          } catch (e) {}
        } else if (newStatus === RideStatus.ARRIVED) {
          playAlertSound("arrival");
          try {
            CapacitorService.vibrate();
            CapacitorService.scheduleNotification(
              t("status_arrived"),
              t("captain_arrived_notif"),
            );
          } catch (e) {}
          setTopNotification({
            title: t("status_arrived"),
            body: t("captain_arrived_notif"),
            type: "success",
          });
          setTimeout(() => setTopNotification(null), 15000);
        } else if (
          newStatus === RideStatus.SEARCHING &&
          oldStatus === RideStatus.ACCEPTED
        ) {
          setTopNotification({
            title: t("status_searching"),
            body: t("replacement_notif"),
            type: "offer",
          });
          setAssignedDriver(null);
          setAssignedDriverLoc(null);
          setTimeout(() => setTopNotification(null), 10000);
        } else if (newStatus === RideStatus.CANCELLED) {
          playAlertSound("cancelled");
          setTopNotification({
            title: t("status_cancelled"),
            body: t("ride_cancelled_notif"),
            type: "offer",
          });
          setTimeout(() => setTopNotification(null), 15000);
          setTimeout(() => resetRide(), 2000);
        }
        prevRideStatus.current = newStatus;
      }

      setActiveRideData(updatedRide);
      setRideStatus(newStatus);
      if (
        typeof updatedRide.fare === "number" &&
        updatedRide.fare > 0 &&
        (newStatus === RideStatus.SEARCHING ||
          newStatus === RideStatus.OFFER_RECEIVED)
      ) {
        setOfferedFare(updatedRide.fare);
      }

      // Only auto-cancel unaccepted requests (SEARCHING / OFFER_RECEIVED) after 10 minutes of inactivity.
      // Never auto-cancel an ACCEPTED, ARRIVED, IN_PROGRESS, or SCHEDULED ride!
      if (
        (updatedRide.status === RideStatus.SEARCHING ||
          updatedRide.status === RideStatus.OFFER_RECEIVED) &&
        !updatedRide.isScheduled
      ) {
        const lastActive = updatedRide.lastActiveAt || updatedRide.timestamp;
        if (lastActive && Date.now() - lastActive > 10 * 60 * 1000) {
          await updateRideStatus(currentRideId, RideStatus.CANCELLED, {
            cancelledBy: "system_timeout",
            cancelReason: "Trip expired (10 min no activity)",
          });
          setTopNotification({
            title: t("trip_cancelled"),
            body: t("system_cancel_inactivity"),
            type: "offer",
          });
          resetRide();
          return;
        }
      }

      if (
        updatedRide.driverId &&
        currentDriverIdRef.current !== updatedRide.driverId
      ) {
        currentDriverIdRef.current = updatedRide.driverId;
        const drv = await getUserProfile(updatedRide.driverId);
        if (drv) {
          setAssignedDriver(drv as Driver);
          if (user.favoriteDrivers?.includes(drv.id)) {
            setIsDriverFavorite(true);
          }
          if (updatedRide.status === RideStatus.ACCEPTED) {
            playAlertSound("success");
          }
        }
      }

      if (
        updatedRide.status === RideStatus.COMPLETED &&
        rideStatus !== RideStatus.COMPLETED
      ) {
        setShowInstaPaySheet(false);
        HapticsService.success();
        ensureRideRewardsProcessed(updatedRide.id, user.id).catch((e) =>
          console.error("Failed to ensure ride rewards:", e),
        );
        setTopNotification({
          title: t("trip_completed"),
          body:
            t("book_another_prompt") +
            (isRewardsEnabled
              ? ` +${rewardPointsPerTrip} ${t("points_label")}`
              : ""),
          type: "success",
        });
        setTimeout(() => setTopNotification(null), 15000);

        // Save to history on completion
        if (updatedRide.dropoff && updatedRide.dropoff.address) {
          const safeDropoff = {
            lat: Number(updatedRide.dropoff.coords.lat),
            lng: Number(updatedRide.dropoff.coords.lng),
          };
          const historyPlace: Place = {
            id: `hist_${Date.now()}`,
            name: updatedRide.dropoff.address,
            address: updatedRide.dropoff.address,
            coords: safeDropoff,
            type: "history" as const,
          };
          saveRecentDestination(user.id, historyPlace).catch(e => { if(String(e).includes('permission')) { console.log('Permission error caught:', e); } else { if(String(e).includes('permission')) { console.log('Permission error caught:', e); } else { console.error(e); }; } });
          saveToRecent(historyPlace);
        }
      }
      if (
        updatedRide.status === RideStatus.CANCELLED &&
        rideStatus !== RideStatus.CANCELLED
      ) {
        setTopNotification({
          title: t("ride_cancelled_alert"),
          body: updatedRide.cancelReason || t("driver_cancelled"),
          type: "offer",
        });
        setTimeout(() => {
          resetRide();
          setTopNotification({
            title: t("ride_cancelled_alert"),
            body: t("ride_cancelled_alert"),
            type: "offer",
          });
          setTimeout(() => setTopNotification(null), 15000);
          setTimeout(() => handleGetCurrentLocation(true, true), 200);
        }, 1000);
      }

      if (updatedRide.driverLocation) {
        const nextLoc = updatedRide.driverLocation;
        if (
          typeof nextLoc.lat === "number" &&
          typeof nextLoc.lng === "number" &&
          Number.isFinite(nextLoc.lat) &&
          Number.isFinite(nextLoc.lng) &&
          (nextLoc.lat !== 0 || nextLoc.lng !== 0)
        ) {
          setAssignedDriverLoc((prev) => {
            if (prev && calculateDistance(prev.lat, prev.lng, nextLoc.lat, nextLoc.lng) < 0.002) {
              return prev;
            }
            return nextLoc;
          });
        }
        const nextHeading = updatedRide.driverHeading;
        setAssignedDriverHeading((prev) => {
          if (typeof nextHeading !== "number" || !Number.isFinite(nextHeading)) return prev;
          if (typeof prev === "number") {
            const diff = Math.abs((((nextHeading - prev) % 360) + 540) % 360 - 180);
            if (diff < 5) return prev;
          }
          return nextHeading;
        });
      }
      if (updatedRide.status === RideStatus.ACCEPTED) {
        if (updatedRide.driverLocation && updatedRide.pickup.coords) {
          const prevEta = lastEtaCalcRef.current;
          const now = Date.now();
          const movedKm = prevEta
            ? calculateDistance(
                prevEta.lat,
                prevEta.lng,
                updatedRide.driverLocation.lat,
                updatedRide.driverLocation.lng,
              )
            : Infinity;
          if (!prevEta || now - prevEta.at >= 12000 || movedKm >= 0.08) {
            lastEtaCalcRef.current = {
              lat: updatedRide.driverLocation.lat,
              lng: updatedRide.driverLocation.lng,
              at: now,
            };
            const eta = await calculateDriverEta(
              updatedRide.driverLocation,
              updatedRide.pickup.coords,
            );
            setDriverEta(eta);
          }
        }
      } else {
        lastEtaCalcRef.current = null;
        setDriverEta(null);
      }

      // Auto-show InstaPay sheet if payment is pending
      if (
        updatedRide.status === RideStatus.IN_PROGRESS &&
        updatedRide.paymentMethod === PaymentMethod.INSTAPAY &&
        updatedRide.paymentStatus === PaymentStatus.AWAITING_CONFIRMATION
      ) {
        setShowInstaPaySheet(true);
      }

      if (updatedRide.status === RideStatus.COMPLETED) {
        setShowRatingModal(true);
      }
    });
    return () => unsubscribe();
  }, [currentRideId, user.favoriteDrivers, rideStatus, calculateDriverEta]);

  useEffect(() => {
    if (!currentRideId || !activeRideData) return;
    const interval = setInterval(async () => {
      if (
        (activeRideData.status === RideStatus.SEARCHING ||
          activeRideData.status === RideStatus.OFFER_RECEIVED) &&
        !activeRideData.isScheduled
      ) {
        const lastActive =
          activeRideData.lastActiveAt || activeRideData.timestamp;
        if (lastActive && Date.now() - lastActive > 10 * 60 * 1000) {
          await updateRideStatus(currentRideId, RideStatus.CANCELLED, {
            cancelledBy: "system_timeout",
            cancelReason: "Trip expired (10 min no activity)",
          });
          setTopNotification({
            title: "Trip Cancelled",
            body: isRTL
              ? "تم إلغاء الرحلة لعدم وجود نشاط لمدة ١٠ دقائق."
              : "Ride cancelled due to 10 min inactivity.",
            type: "offer",
          });
          resetRide();
        }
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [currentRideId, activeRideData, isRTL]);

  const rejectedOfferIdsRef = useRef<string[]>(rejectedOfferIds);
  useEffect(() => {
    rejectedOfferIdsRef.current = rejectedOfferIds;
  }, [rejectedOfferIds]);

  useEffect(() => {
    const isSearchingOrOffering =
      rideStatus === RideStatus.SEARCHING ||
      rideStatus === RideStatus.OFFER_RECEIVED ||
      activeRideData?.status === RideStatus.SEARCHING ||
      activeRideData?.status === RideStatus.OFFER_RECEIVED;

    if (!currentRideId || !isSearchingOrOffering) {
      if (offers.length > 0) setOffers([]);
      return;
    }
    const unsubscribe = subscribeToRideOffers(currentRideId, (newOffers) => {
      console.log("📥 Received ride offers count:", newOffers.length, newOffers);
      if (newOffers.length > prevOffersLength.current) {
        const latestOffer = newOffers[0];
        const key = latestOffer.id || `${latestOffer.driverId}_${latestOffer.price}`;
        if (
          !rejectedOfferIdsRef.current.includes(key) &&
          !rejectedOfferIdsRef.current.includes(latestOffer.driverId)
        ) {
          setTopNotification({
            title: t("driver_accepted_trip", "Driver accepted your trip!"),
            body: `${latestOffer.driverName} - ${latestOffer.price} ${t("currency")} (12s)`,
            type: "offer",
          });
          setTimeout(() => {
            setTopNotification((prev) =>
              prev?.type === "offer" ? null : prev,
            );
          }, 15000);
          playAlertSound("counter_offer");
          CapacitorService.scheduleNotification(
            t("driver_accepted_trip", "Driver accepted your trip!"),
            `${latestOffer.driverName} - ${latestOffer.price} ${t("currency")}`,
          );
        }
      }
      prevOffersLength.current = newOffers.length;
      setOffers(newOffers);
    });
    return () => unsubscribe();
  }, [currentRideId, rideStatus, activeRideData?.status, t, playAlertSound, pricingConfig?.offerExpirationSeconds]);

  const handleMapDrag = () => {
    // Minimize sheet on map interaction to see map without triggering redundant state updates
    setIsSheetMinimized((prev) => (prev ? prev : true));
    setIsMapAutoFollowing((prev) => (prev ? false : prev));
    if (rideStatus === RideStatus.IDLE && !dropoff && isPickingFromMapRef.current === "none") {
      setShowMapTooltip((prev) => (prev ? prev : true));
    }
    lastResolvedPickRef.current = null;
    if (isPickingFromMapRef.current !== "none") {
      setIsMapMoving((prev) => (prev ? prev : true));
      if (isPickingFromMapRef.current === "pickup") {
        setPickupAddress(isRTL ? "جارٍ تحديد الموقع..." : "Finding location...");
      } else if (isPickingFromMapRef.current === "dropoff") {
        setDropoffAddress(isRTL ? "جارٍ تحديد الموقع..." : "Finding location...");
      }
    }
  };

  const resolvePickingAddressForCenter = useCallback(
    async (center: Coordinates, mode: "pickup" | "dropoff") => {
      if (!center || typeof center.lat !== "number" || typeof center.lng !== "number") return;
      if (mapMoveAbortRef.current) {
        mapMoveAbortRef.current.abort();
      }
      const controller = new AbortController();
      mapMoveAbortRef.current = controller;
      const seq = ++mapMoveSeqRef.current;

      const loadingText = isRTL ? "جارٍ تحديد الموقع..." : "Loading Address...";
      if (mode === "pickup") {
        setPickupAddress(loadingText);
      } else {
        setDropoffAddress(loadingText);
      }

      try {
        const detailed = await reverseGeocodeDetailed(center, language, controller.signal);
        if (controller.signal.aborted || seq !== mapMoveSeqRef.current) return;
        if (isPickingFromMapRef.current !== mode) return;

        const resolved = cleanAddress(detailed.address || "") || t("pinned_location");
        lastResolvedPickRef.current = {
          lat: center.lat,
          lng: center.lng,
          address: resolved,
          mode,
        };
        if (mode === "pickup") {
          setPickupAddress(resolved);
          if (detailed.city) {
            setCityName(detailed.city);
            localStorage.setItem("passenger_last_city", detailed.city);
          }
        } else {
          setDropoffAddress(resolved);
        }
      } catch {
        if (controller.signal.aborted || seq !== mapMoveSeqRef.current) return;
        if (isPickingFromMapRef.current !== mode) return;
        const fallback = t("pinned_location");
        if (mode === "pickup") setPickupAddress(fallback);
        else setDropoffAddress(fallback);
      }
    },
    [isRTL, language, t],
  );

  useEffect(() => {
    if (isPickingFromMap === "none") {
      if (mapMoveAbortRef.current) {
        mapMoveAbortRef.current.abort();
        mapMoveAbortRef.current = null;
      }
      lastResolvedPickRef.current = null;
      return;
    }
    const initialCoord =
      mapCenter ||
      (isPickingFromMap === "dropoff" ? dropoff : pickup) ||
      pickup ||
      passengerLocation;
    if (initialCoord) {
      resolvePickingAddressForCenter(initialCoord, isPickingFromMap);
    }
  }, [isPickingFromMap]);

  const handleMapMoveEnd = (center: Coordinates) => {
    setIsMapMoving((prev) => (prev ? false : prev));
    if (isPickingFromMap !== "none") {
      // Update crosshair center & preview exact detailed address without triggering route fitBounds loop mid-drag
      setMapCenter(center);
      resolvePickingAddressForCenter(center, isPickingFromMap);
    }
  };

  useEffect(() => {
    let tm: any;
    if (showMapTooltip) {
      tm = setTimeout(() => setShowMapTooltip(false), 3000);
    }
    return () => clearTimeout(tm);
  }, [showMapTooltip]);

  const handleMapClick = (coords: Coordinates, address?: string) => {
    // CRITICAL: On search page and active ride states, NEVER allow map touches to place or modify direction marks!
    if (
      rideStatus === RideStatus.SEARCHING ||
      rideStatus === RideStatus.OFFER_RECEIVED ||
      rideStatus === RideStatus.ACCEPTED ||
      rideStatus === RideStatus.IN_PROGRESS ||
      !!activeRideData
    ) {
      console.log("[Map] Map click ignored during active ride / search state");
      return;
    }

    console.log("[MapDebug] Tapped coordinates:", coords);
    console.log("[MapDebug] Selected location state (Before):", {
      isPickingFromMap,
      pickup,
      dropoff,
    });

    if (!isSheetMinimized) {
      setIsSheetMinimized(true);
    } else {
      setIsSheetMinimized(false);
    }

    const setGeocodedAddress = (
      type: "pickup" | "dropoff",
      fallbackAddr: string,
    ) => {
      if (type === "pickup") {
        setPickup(coords);
      } else {
        setDropoff(coords);
      }

      if (address) {
        const cleanAddr = cleanAddress(address) || fallbackAddr;
        console.log(
          "[MapDebug] Reverse geocode result (immediate):",
          cleanAddr,
        );
        if (type === "pickup") setPickupAddress(cleanAddr);
        if (type === "dropoff") setDropoffAddress(cleanAddr);
        return;
      }

      if (type === "pickup") {
        setPickupAddress(
          isRTL ? "جارٍ تحديد الموقع..." : "Finding location...",
        );
      } else {
        setDropoffAddress(
          isRTL ? "جارٍ تحديد الموقع..." : "Finding location...",
        );
      }

      const fetchGeocoded = async () => {
        try {
          const detailed = await reverseGeocodeDetailed(coords, language);
          const finalAddr = cleanAddress(detailed.address || "") || fallbackAddr;
          console.log("[MapDebug] Reverse geocode result (detailed):", finalAddr);
          if (type === "pickup") {
            setPickupAddress(finalAddr);
            if (detailed.city) {
              setCityName(detailed.city);
              localStorage.setItem("passenger_last_city", detailed.city);
            }
          } else {
            setDropoffAddress(finalAddr);
          }
        } catch {
          console.log(
            "[MapDebug] Reverse geocode result (failed entirely):",
            fallbackAddr,
          );
          if (type === "pickup") setPickupAddress(fallbackAddr);
          if (type === "dropoff") setDropoffAddress(fallbackAddr);
        }
      };
      fetchGeocoded();
    };

    let target = isPickingFromMap;
    const wasPickingFromMap = isPickingFromMap !== "none";
    if (target === "none") {
      if (!pickup) target = "pickup";
      else if (!dropoff) target = "dropoff";
      else target = "dropoff";
    }

    if (target === "pickup") {
      CapacitorService.impact(ImpactStyle.Light);
      HapticsService.medium();
      hasCustomPickupRef.current = true;
      setMapCenter(coords);
      setGeocodedAddress("pickup", t("pinned_location"));
      setIsPickingFromMap("none");
      if (wasPickingFromMap) setIsSheetMinimized(false);
      setIsMapAutoFollowing(true);
    } else if (target === "dropoff") {
      CapacitorService.impact(ImpactStyle.Light);
      HapticsService.medium();
      setMapCenter(coords);
      setGeocodedAddress("dropoff", t("pinned_location"));
      setIsPickingFromMap("none");
      if (wasPickingFromMap) setIsSheetMinimized(false);
      setIsMapAutoFollowing(true);
    }
  };

  const handleOpenInGoogleMaps = () => {
    let destLoc = "";
    // Priority: Dropoff (if trip active or set), then Pickup (if no dropoff set)
    if (activeRideData?.dropoff?.coords) {
      destLoc = `${activeRideData.dropoff.coords.lat},${activeRideData.dropoff.coords.lng}`;
    } else if (dropoff) {
      destLoc = `${dropoff.lat},${dropoff.lng}`;
    } else if (pickup) {
      destLoc = `${pickup.lat},${pickup.lng}`;
    } else if (passengerLocation) {
      destLoc = `${passengerLocation.lat},${passengerLocation.lng}`;
    }

    if (destLoc) {
      openNavigation(destLoc);
    }
  };

  const handleSelectPlace = async (
    place: Place,
    targetMode?: "pickup" | "dropoff",
  ) => {
    setIsSheetMinimized(false); // Show sheet when place selected
    const mode = targetMode || (searchMode === "none" ? "dropoff" : searchMode);
    let coords = place.coords;
    const name = place.name;
    if (place.isGooglePlace && place.id) {
      const details = await getPlaceDetails(place.id);
      if (details) {
        coords = details;
        place.coords = details;
      }
    }
    const cleanCoords = { lat: Number(coords.lat), lng: Number(coords.lng) };
    const placeToSave: Place = {
      id: place.id || `hist_${Date.now()}`,
      name: place.name,
      address: place.address,
      coords: cleanCoords,
      type: place.type === "home" || place.type === "work" ? place.type : "history",
      isGooglePlace: place.isGooglePlace,
      updatedAt: Date.now(),
    };
    saveToRecent(placeToSave);
    setLocalHistory(getLocalRecentSearches());
    if (user.id) {
      saveRecentDestination(user.id, placeToSave).catch((e) => {
        if (String(e).includes("permission")) {
          console.log("Permission error caught:", e);
        } else {
          console.error(e);
        }
      });
    }
    if (mode === "pickup") {
      hasCustomPickupRef.current = true;
      setPickup(cleanCoords);
      setPickupAddress(cleanAddress(name));
      setMapCenter(cleanCoords);
      setIsMapAutoFollowing(true);
    } else if (mode === "dropoff") {
      setDropoff(cleanCoords);
      setDropoffAddress(cleanAddress(name));
      setIsMapAutoFollowing(true);
    }
    setSearchMode("none");
    setSearchQuery("");
  };

  const handleOpenSearch = async (mode: "pickup" | "dropoff") => {
    setSearchMode(mode);
    setSearchQuery("");
    const local = getLocalRecentSearches();
    setLocalHistory(local);
    const mergedHist = mergePlacesHistory(recentPlaces, local, pastRidePlaces);
    const userLoc = passengerLocationRef.current || undefined;
    setSearchResults(searchLocalPlacesSync("", language, userLoc, mergedHist));
    try {
      const results = await searchPlaces("", language, userLoc, mergedHist);
      setSearchResults(results);
    } catch (e) {
      if (String(e).includes("permission")) {
        console.log("Permission error caught:", e);
      } else {
        console.error(e);
      }
    }
  };

  const handleZeroFareRecovery = () => {
    const msg = isRTL
      ? "يرجى تحديد موقعك الحالي أولاً"
      : "Please select your current location first";
    CapacitorService.impact(ImpactStyle.Heavy);
    setTopNotification({
      title: isRTL ? "تنبيه" : "Attention",
      body: msg,
      type: "offer",
    });
    setShowFareSheet(false);

    setTimeout(() => {
      handleGetCurrentLocation(false, true);
    }, 300);
  };

  const handleRequestRide = async (overrideBookingType?: BookingType) => {
    const effectiveBookingType: BookingType =
      overrideBookingType === "FOR_OTHER" || overrideBookingType === "SELF"
        ? overrideBookingType
        : bookingType;
    if (!pickup || !dropoff) return;
    const range = priceRanges[selectedVehicleType];
    if (!range && rideType === "RIDE") return;
    const baseFare = rideType === "RIDE" ? range!.recommended : customFare;
    const effectiveCustomFare =
      customFare > 0
        ? customFare
        : baseFare > 0
          ? Math.round(baseFare / 5) * 5
          : 0;

    if (baseFare === 0 || effectiveCustomFare === 0) {
      handleZeroFareRecovery();
      return;
    }

    const computedUrgencyBoost = Math.max(0, effectiveCustomFare - baseFare);
    let finalFare = effectiveCustomFare;

    let syntheticUrgencyLevel: "NORMAL" | "FASTER" | "URGENT" = "NORMAL";
    if (effectiveCustomFare >= baseFare * 1.15) {
      syntheticUrgencyLevel = "URGENT";
    } else if (effectiveCustomFare >= baseFare * 1.05) {
      syntheticUrgencyLevel = "FASTER";
    }

    const activeRewardDiscount = isRewardEligible && useRewardDiscount;
    if (activeRewardDiscount) {
      finalFare = Math.max(10, finalFare - rewardDiscountAmount);
    }

    let scheduledTimestamp = 0;
    let shouldSearchImmediately = false;
    if (isScheduling) {
      const date = new Date(selectedDate);
      let hour24 = selectedHour;
      if (selectedPeriod === "PM" && hour24 < 12) hour24 += 12;
      if (selectedPeriod === "AM" && hour24 === 12) hour24 = 0;

      date.setHours(hour24, selectedMinute, 0, 0);
      scheduledTimestamp = date.getTime();

      const schedValidation = validateScheduledBookingInput({
        scheduledPickupAt: scheduledTimestamp,
        pickup: pickup ? { address: pickupAddress, coords: pickup } : null,
        dropoff: dropoff ? { address: dropoffAddress, coords: dropoff } : null,
        category: selectedVehicleType,
        fare: finalFare,
        passengerCount: scheduledPassengerCount,
        bookingType: effectiveBookingType,
      });

      if (!schedValidation.valid) {
        alert(
          isRTL
            ? schedValidation.errorMessageAr || t("invalid_time")
            : schedValidation.errorMessageEn || t("invalid_time")
        );
        return;
      }
    }

    setIsRequesting(true);
    CapacitorService.impact(ImpactStyle.Heavy);

    // Clean up previous search state
    setRejectedOfferIds([]);
    setOffers([]);
    prevOffersLength.current = 0;

    try {
      const safePickup = { lat: Number(pickup.lat), lng: Number(pickup.lng) };
      const safeDropoff = {
        lat: Number(dropoff.lat),
        lng: Number(dropoff.lng),
      };
      const safeHistoryPlace = {
        id: `hist_${Date.now()}`,
        name: dropoffAddress,
        address: dropoffAddress,
        coords: safeDropoff,
        type: "history" as const,
      };
      saveRecentDestination(user.id, safeHistoryPlace).catch(e => { if(String(e).includes('permission')) { console.log('Permission error caught:', e); } else { if(String(e).includes('permission')) { console.log('Permission error caught:', e); } else { console.error(e); }; } });
      saveToRecent(safeHistoryPlace);
      const finalPreferredIds = [
        ...(user.favoriteDrivers || []),
        ...targetPreferredDrivers,
      ];
      const uniquePreferredIds = Array.from(new Set(finalPreferredIds));
      const estimatedDuration = Math.ceil(distanceKm * 3);

      // Calculate start of counter offers (+15s)
      const matchingPhaseSeconds =
        pricingConfig?.initialDriverMatchingPhaseSeconds || 15;
      const counterOffersStartAt = Date.now() + matchingPhaseSeconds * 1000;

      const rideData: Partial<Ride> = {
        passengerId: user.id,
        passengerName: user.name,
        pickup: { address: pickupAddress, coords: safePickup },
        dropoff: { address: dropoffAddress, coords: safeDropoff },
        baseFareAmount: baseFare,
        urgencyBoostLevel: syntheticUrgencyLevel,
        urgencyBoostAmount: computedUrgencyBoost,
        autoBoostAmount: 0,
        isAutoBoosting: true,
        initialDriverSearchEndTime: counterOffersStartAt,
        fare: finalFare,
        requestedVehicleType: selectedVehicleType,
        paymentMethod,
        preferredDriverIds: uniquePreferredIds,
        rideType,
        isLargeGroup,
        promoApplied: activeRewardDiscount,
        promoAmount: activeRewardDiscount ? rewardDiscountAmount : 0,
        pointsRedeemed: activeRewardDiscount ? rewardThresholdPoints : 0,
        distanceValue: distanceKm,
        distanceText: `${distanceKm.toFixed(1)} ${t("km")}`,
        durationText: `${estimatedDuration} ${t("min")}`,
      };
      if (rideType === "PARCEL") {
        if (!parcelDetails || !recipientName || !recipientPhone) {
          alert(t("fill_parcel_details_alert"));
          setIsRequesting(false);
          return;
        }
        rideData.parcelDetails = parcelDetails;
        rideData.recipient = { name: recipientName, phone: recipientPhone };
        rideData.bookingType = "SELF";
        rideData.bookedBy = {
          userId: user.id,
          name: user.name,
          phone: user.phone,
        };
        rideData.actualPassenger = null;
      } else if (effectiveBookingType === "FOR_OTHER") {
        const trimmedName = otherPassengerName.trim();
        if (trimmedName.length < 2) {
          setOtherPassengerError(t("err_other_passenger_name"));
          setIsRequesting(false);
          return;
        }
        const phoneValidation = validateAndNormalizePassengerPhone(
          otherPassengerPhone,
          otherPassengerCountryCode,
        );
        if (!phoneValidation.isValid) {
          setOtherPassengerError(
            phoneValidation.errorAr && isRTL
              ? phoneValidation.errorAr
              : phoneValidation.errorEn || t("err_other_passenger_phone")
          );
          setIsRequesting(false);
          return;
        }
        setOtherPassengerError(null);
        rideData.bookingType = "FOR_OTHER";
        rideData.bookedBy = {
          userId: user.id,
          name: user.name,
          phone: user.phone,
        };
        rideData.actualPassenger = {
          name: trimmedName,
          phone: phoneValidation.normalizedPhone,
          note: otherPassengerNote.trim() ? otherPassengerNote.trim() : null,
          userId: null,
        };
        rideData.rideVerificationEnabled = rideVerificationEnabled;
      } else {
        rideData.bookingType = "SELF";
        rideData.bookedBy = {
          userId: user.id,
          name: user.name,
          phone: user.phone,
        };
        rideData.actualPassenger = null;
        rideData.rideVerificationEnabled = false;
      }
      if (isScheduling && scheduledTimestamp > 0 && !shouldSearchImmediately) {
        rideData.scheduledTime = scheduledTimestamp;
        rideData.scheduledPickupAt = scheduledTimestamp;
        rideData.isScheduled = true;
        rideData.scheduleStatus = "SCHEDULED";
        rideData.bookingTimezone = "Africa/Cairo";
        rideData.passengerCount =
          selectedVehicleType === VehicleType.MOTO ? 1 : scheduledPassengerCount;
        rideData.driverNote = scheduledDriverNote.trim() || null;
        rideData.estimatedFare = finalFare;
        rideData.status = RideStatus.SCHEDULED;
      } else {
        rideData.status = RideStatus.SEARCHING;
      }

      const generatedPin =
        rideType === "RIDE" &&
        effectiveBookingType === "FOR_OTHER" &&
        rideVerificationEnabled
          ? generateRideVerificationPin()
          : null;

      let rideId = "";
      if (
        isScheduling &&
        scheduledTimestamp > 0 &&
        !shouldSearchImmediately &&
        recurringFrequency !== "ONE_TIME"
      ) {
        const tzInfo = formatInServiceTimezone(scheduledTimestamp, "Africa/Cairo");
        const createdRes = await createScheduledRideBooking({
          passengerId: user.id,
          passengerName: rideData.passengerName || user.name,
          passengerPhone: user.phone,
          pickup: { address: pickupAddress, coords: safePickup },
          dropoff: { address: dropoffAddress, coords: safeDropoff },
          scheduledPickupAt: scheduledTimestamp,
          category: selectedVehicleType,
          paymentMethod,
          fare: finalFare,
          distanceValue: distanceKm,
          distanceText: `${distanceKm.toFixed(1)} ${t("km")}`,
          durationText: `${estimatedDuration} ${t("min")}`,
          passengerCount:
            selectedVehicleType === VehicleType.MOTO ? 1 : scheduledPassengerCount,
          driverNote: scheduledDriverNote.trim() || undefined,
          bookingType: rideData.bookingType,
          bookedBy: rideData.bookedBy,
          actualPassenger: rideData.actualPassenger,
          preferredDriverIds: uniquePreferredIds,
          isLargeGroup,
          promoApplied: activeRewardDiscount,
          promoAmount: activeRewardDiscount ? rewardDiscountAmount : 0,
          pointsRedeemed: activeRewardDiscount ? rewardThresholdPoints : 0,
          frequency: recurringFrequency,
          weekdays: recurringWeekdays,
          startDate: tzInfo.dateStr,
          endDate: recurringEndDate || null,
          pickupTimeStr: tzInfo.timeStr,
        });
        rideId = createdRes.rideId;
      } else {
        rideId = await createRideRequest({
          ...rideData,
          rawVerificationPin: generatedPin,
        });
      }

      setShowBookForOtherModal(false);
      if (activeRewardDiscount) {
        handleToggleUseRewardDiscount(false);
      }

      if (isScheduling && scheduledTimestamp > 0 && !shouldSearchImmediately) {
        const confirmedObj: Ride = {
          ...(rideData as Ride),
          id: rideId,
          status: RideStatus.SCHEDULED,
          isScheduled: true,
          scheduledPickupAt: scheduledTimestamp,
          scheduledTime: scheduledTimestamp,
          scheduleStatus: "SCHEDULED",
          timestamp: Date.now(),
          createdAt: new Date().toISOString(),
        };
        setConfirmedScheduledRide(confirmedObj);
        setShowScheduledRidesModal(true);
        resetRide();
        setShowFareSheet(false);
      } else {
        // OPTIMISTIC UPDATE: Set active data immediately so searching UI shows up without delay
        const newRide = {
          id: rideId,
          status: RideStatus.SEARCHING,
          ...rideData,
          timestamp: Date.now(),
          createdAt: new Date().toISOString(),
        } as Ride;

        setActiveRideData(newRide);
        setCurrentRideId(rideId);
        setRideStatus(RideStatus.SEARCHING);

        // CRITICAL FIX: Only close sheet AFTER data is set to prevent white screen flash
        setShowFareSheet(false);
      }
    } catch (e: any) {
      if(String(e).includes('permission')) { console.log('Permission error caught:', e); } else { console.error(e); };
      setRideStatus(RideStatus.IDLE);
      alert(e?.message || "Failed to request ride. Please try again.");
    } finally {
      setIsRequesting(false);
    }
  };

  const resetRide = () => {
    // Do NOT clear pickupAddress here to prevent blinking
    setDropoff(null);
    setDropoffAddress("");
    setShowFareSheet(false);
    setRideStatus(RideStatus.IDLE);
    setCurrentRideId(null);
    setActiveRideData(null);
    setAssignedDriver(null);
    setAssignedDriverLoc(null);
    setAssignedDriverHeading(undefined);
    currentDriverIdRef.current = null;
    setOffers([]);
    setRejectedOfferIds([]);
    setIsDriverFavorite(false);
    setCustomFare(0);
    setOfferedFare(0);
    setTripRating(0);
    setTripComment("");
    setExpiredRide(null);
    setIsScheduling(false);
    setScheduledTime("");
    setShowScheduleTriggerModal(false);
    setIsScheduleDue(false);
    setScheduleCountdown("");
    setTargetPreferredDrivers([]);
    setTopNotification(null);
    prevOffersLength.current = 0;
    setIsSosActivated(false);
    setSearchCountdown(120);
    setShowSearchTimeoutModal(false);
    setPriceBoostNotice(null);
    priceBoostedAt50Ref.current = false;
    setDraftSearchFare(0);
    setIsUpdatingSearchFare(false);
    setSearchFareUpdateStatus(null);
    lastCommittedSearchFareRef.current = 0;
    lastTrackedFareRideIdRef.current = null;
    setSearchElapsedTime(0);
    setSearchTotalTime(120);
    setIsLargeGroup(false);
    setUseRewardDiscount(false);
    setIsSheetMinimized(false);
    setNearbyAlertTriggered(false);
    setNearbyDistance(null);
    setSelectedPresetId("NORMAL");
    setShowAdvancedOptions(false);
    if (searchTimer) clearTimeout(searchTimer);
    if (searchTimerRef.current) {
      clearInterval(searchTimerRef.current);
      searchTimerRef.current = null;
    }
    trackedSearchRideIdRef.current = null;
    searchEndTimeRef.current = null;
    savedRemainingSecondsRef.current = 120;
    setShowSearchTripDetails(false);
    priceBoostedAt50Ref.current = false;
    try {
      localStorage.removeItem("mowasla_search_timer");
    } catch {}
  };

  const handleContinueSearch = async () => {
    setShowSearchTimeoutModal(false);
    const nextEnd = Date.now() + 120 * 1000;
    searchEndTimeRef.current = nextEnd;
    savedRemainingSecondsRef.current = 120;
    priceBoostedAt50Ref.current = false;
    setPriceBoostNotice(null);
    setSearchCountdown(120);
    HapticsService.light();

    if (currentRideId) {
      try {
        localStorage.setItem(
          "mowasla_search_timer",
          JSON.stringify({ rideId: currentRideId, endTime: nextEnd, boosted: false })
        );
      } catch {}
      try {
        await updateDoc(doc(db, "rides", currentRideId), {
          status: RideStatus.SEARCHING,
          lastActiveAt: Date.now(),
          timestamp: Date.now(),
          rejectedBy: [],
          offeringDriverIds: [],
          notifiedDriverIds: [],
        });
      } catch (e) {
        console.warn("Continue search update failed:", e);
      }
    }

    if (searchTimerRef.current) clearInterval(searchTimerRef.current);
    searchTimerRef.current = setInterval(async () => {
      if (!searchEndTimeRef.current) return;
      const remaining = Math.max(0, Math.round((searchEndTimeRef.current - Date.now()) / 1000));
      savedRemainingSecondsRef.current = remaining;
      setSearchCountdown(remaining);

      if (remaining <= 50 && remaining > 0 && !priceBoostedAt50Ref.current && currentRideId) {
        priceBoostedAt50Ref.current = true;
        try {
          localStorage.setItem(
            "mowasla_search_timer",
            JSON.stringify({ rideId: currentRideId, endTime: searchEndTimeRef.current, boosted: true })
          );
        } catch {}
        try {
          const rideSnap = await getDoc(doc(db, "rides", currentRideId));
          if (rideSnap.exists()) {
            const rData = rideSnap.data() as Ride;
            const currentPrice = Number(rData.fare || rData.price || 35);
            const boostAdd = Math.max(10, Math.ceil((currentPrice * 0.15) / 5) * 5);
            const newPrice = currentPrice + boostAdd;
            const offersSnap = await getDocs(collection(db, "rides", currentRideId, "offers"));
            const activePendingDriverIds = offersSnap.docs
              .map((d) => d.data() as OfferDetails)
              .filter((o) => o && (o.status === "pending" || o.status === "countered") && o.driverId)
              .map((o) => o.driverId);

            await updateDoc(doc(db, "rides", currentRideId), {
              fare: newPrice,
              price: newPrice,
              priceBoosted: true,
              priceDirection: "up",
              autoBoostAmount: (rData.autoBoostAmount || 0) + boostAdd,
              lastPriceUpdate: Date.now(),
              priceChanged: true,
              timestamp: Date.now(),
              lastActiveAt: Date.now(),
              rejectedBy: [],
              offeringDriverIds: activePendingDriverIds,
              notifiedDriverIds: [],
            });

            const noticeText = isRTL
              ? `تم زيادة السعر تلقائياً إلى ${newPrice} ج.م لتشجيع الكباتن على قبول الرحلة!`
              : `Price automatically increased to ${newPrice} EGP to speed up captain acceptance!`;
            setPriceBoostNotice(noticeText);
            HapticsService.medium();
          }
        } catch (e) {
          console.error("Auto boost failed", e);
        }
      }

      if (remaining <= 0) {
        if (searchTimerRef.current) {
          clearInterval(searchTimerRef.current);
          searchTimerRef.current = null;
        }
        setShowSearchTimeoutModal(true);
        HapticsService.heavy();
      }
    }, 1000);
  };

  const handleNewSearch = async () => {
    setShowSearchTimeoutModal(false);
    HapticsService.medium();

    if (currentRideId) {
      try {
        await updateDoc(doc(db, "rides", currentRideId), {
          status: RideStatus.CANCELLED,
          cancelledBy: "passenger",
          cancelReason: "new_search",
        });
      } catch (e) {
        console.warn("Cancel ride for new search error:", e);
      }
    }

    if (searchTimerRef.current) {
      clearInterval(searchTimerRef.current);
      searchTimerRef.current = null;
    }
    trackedSearchRideIdRef.current = null;
    searchEndTimeRef.current = null;
    priceBoostedAt50Ref.current = false;
    setSearchCountdown(120);
    setCurrentRideId(null);
    setActiveRideData(null);
    setRideStatus(RideStatus.IDLE);
    setOffers([]);
    setRejectedOfferIds([]);
    setPriceBoostNotice(null);

    // Keep pickup and dropoff so passenger can immediately re-configure or re-request!
    setShowFareSheet(true);
  };

  const handleCancelSearchFromTimeout = async () => {
    setShowSearchTimeoutModal(false);
    HapticsService.light();

    if (currentRideId) {
      try {
        await updateDoc(doc(db, "rides", currentRideId), {
          status: RideStatus.CANCELLED,
          cancelledBy: "passenger",
          cancelReason: "timeout_cancelled",
        });
      } catch (e) {
        console.warn("Cancel ride timeout error:", e);
      }
    }
    resetRide();
  };

  const handleBackFromIdleSheet = () => {
    if (showFareSheet) {
      setShowFareSheet(false);
      return;
    }
    if (dropoff) {
      setDropoff(null);
      setDropoffAddress("");
      setDistanceKm(0);
      setCustomFare(0);
      setOfferedFare(0);
      setPriceRanges({});
      setIsScheduling(false);
      setScheduledTime("");
      setUseRewardDiscount(false);
      setIsLargeGroup(false);
      setSelectedPresetId("NORMAL");
      setShowAdvancedOptions(false);
      return;
    }
  };

  // ... (Rest of handlers same as before) ...
  const handleCancelRideTrigger = () => {
    if (currentRideId) setShowCancelConfirmation(true);
  };
  useEffect(() => {
    if (!currentRideId) {
      lastMessageIdRef.current = null;
      return;
    }

    const unsub = subscribeToRideMessages(currentRideId, (msgs) => {
      if (msgs.length === 0 && lastMessageIdRef.current === null) {
        lastMessageIdRef.current = "empty";
        return;
      }

      if (msgs.length > 0) {
        const lastMsg = msgs[msgs.length - 1];

        // Initialize ref on first load to avoid notifying for existing messages
        if (lastMessageIdRef.current === null) {
          lastMessageIdRef.current = lastMsg.id || "initial";
          return;
        }

        if (lastMsg.id !== lastMessageIdRef.current) {
          if (lastMsg.senderId !== user.id && !isChatOpen) {
            setHasUnreadMessages(true);
            setTopNotification({
              title: lastMsg.isSystem
                ? isRTL
                  ? "رسالة جديدة"
                  : "New Message"
                : t("new_message"),
              body: lastMsg.text || (isRTL ? "رسالة صوتية" : "Voice message"),
              type: "message",
            });
            setTimeout(() => setTopNotification(null), 10000);
            // Slight delay for audio to avoid overlapping initial acceptance sounds
            setTimeout(async () => {
              const { AudioService } = await import("../services/audioService");
              AudioService.play("chat_message");
            }, 500);
          }
          lastMessageIdRef.current = lastMsg.id || "unknown";
        }
      }
    });

    return () => unsub();
  }, [currentRideId, isChatOpen, user.id, isRTL, t]);

  const handleAcceptOffer = async (offer: OfferDetails) => {
    if (currentRideId) {
      CapacitorService.impact(ImpactStyle.Medium);
      setProcessingOfferId(offer.id || offer.driverId);
      try {
        await acceptRideOffer(currentRideId, offer);
      } catch (e) {
        if(String(e).includes('permission')) { console.log('Permission error caught:', e); } else { console.error(e); };
        setProcessingOfferId(null);
      }
    }
  };

  const handleRejectOffer = async (offer: OfferDetails) => {
    const key = offer.id || `${offer.driverId}_${offer.price}`;
    setRejectedOfferIds((prev) => [...prev, key]);
    if (currentRideId && offer.id) {
      await rejectRideOffer(currentRideId, offer.id);
      // add to rejectedBy to drop from driver's list
      await updateDoc(doc(db, "rides", currentRideId), {
        rejectedBy: arrayUnion(offer.driverId),
      }).catch(() => {});
    }
    const remainingOffers = offers.filter((o) => {
      const oKey = o.id || `${o.driverId}_${o.price}`;
      return !rejectedOfferIds.includes(oKey) && oKey !== key;
    });
    if (remainingOffers.length === 0 && currentRideId) {
      setRideStatus(RideStatus.SEARCHING);
      await updateDoc(doc(db, "rides", currentRideId), {
        status: RideStatus.SEARCHING,
      }).catch(() => {});
    }
  };

  const triggerNearbyAlert = useCallback(() => {
    playAlertSound("arrival");

    if (Capacitor.isNativePlatform()) {
      CapacitorService.scheduleNotification(
        isRTL ? "الكابتن قريب جداً!" : "Captain is arriving!",
        isRTL ? "الكابتن يقترب من موقعك" : "The captain is arriving nearby",
      );
    }
    
    if (currentRideId) {
      sendMessage(
        currentRideId,
        "system",
        isRTL
          ? "الكابتن يقترب من موقعك"
          : "The captain is arriving nearby",
        true,
      ).catch(() => {});
    }
  }, [isRTL, playAlertSound, currentRideId]);

  useEffect(() => {
    if (!currentRideId || !activeRideData) return;
    if (
      activeRideData.status !== RideStatus.ACCEPTED &&
      activeRideData.status !== RideStatus.ARRIVED
    ) {
      return;
    }

    if (assignedDriverLoc && activeRideData.pickup?.coords) {
      const distKm = calculateDistance(
        assignedDriverLoc.lat,
        assignedDriverLoc.lng,
        activeRideData.pickup.coords.lat,
        activeRideData.pickup.coords.lng,
      );

      const isNearbyByTime = driverEta === "1 min";

      if (distKm <= 0.1 || isNearbyByTime) {
        setNearbyDistance(Math.round(distKm * 1000));
        if (!nearbyAlertTriggered) {
          setNearbyAlertTriggered(true);
          triggerNearbyAlert();
        }
      }
    }
  }, [
    assignedDriverLoc,
    activeRideData,
    nearbyAlertTriggered,
    currentRideId,
    triggerNearbyAlert,
    driverEta,
  ]);

  const confirmCancelRide = async () => {
    if (!currentRideId) return;
    const finalReason =
      cancellationReason === t("reason_other")
        ? customReason || t("reason_other")
        : cancellationReason || t("passenger_cancelled");
    await updateRideStatus(currentRideId, RideStatus.CANCELLED, {
      cancelledBy: user.id,
      cancelReason: finalReason,
    });
    await sendMessage(
      currentRideId,
      "system",
      isRTL ? "تم إلغاء الرحلة" : "Trip has been canceled",
      true,
    );
    resetRide();
    setTimeout(() => handleGetCurrentLocation(true, true), 200);
    setShowCancelConfirmation(false);
  };

  const handleRateDriver = async () => {
    if (!currentRideId || !assignedDriver) return;
    try {
      await rateUser(
        currentRideId,
        assignedDriver.id,
        user.id,
        user.name,
        tripRating || 5,
        tripComment,
      );
    } catch (e) {
      if(String(e).includes('permission')) { console.log('Permission error caught:', e); } else { console.error(e); };
    }
    setShowRatingModal(false);
    resetRide();
    setTimeout(() => handleGetCurrentLocation(true, true), 200);
  };

  const displayHistory =
    searchResults.length > 0 || searchQuery
      ? searchResults
      : allHistoryPlaces.length > 0
        ? allHistoryPlaces
        : [];

  const effectiveAssignedDriverLoc =
    assignedDriverLoc ||
    activeRideData?.driverLocation ||
    assignedDriver?.currentLocation ||
    null;

  const mapDrivers = useMemo(() => {
    if (assignedDriver && effectiveAssignedDriverLoc) {
      return [
        {
          id: assignedDriver.id,
          lat: effectiveAssignedDriverLoc.lat,
          lng: effectiveAssignedDriverLoc.lng,
          heading:
            assignedDriverHeading ||
            effectiveAssignedDriverLoc.heading ||
            0,
          isNearby: nearbyAlertTriggered,
        },
      ];
    }
    return viewingDrivers
      .map((d) => ({
        id: d.id,
        lat: d.currentLocation?.lat || 0,
        lng: d.currentLocation?.lng || 0,
        heading: d.currentLocation?.heading || 0,
        isNearby: false,
      }))
      .filter((d) => d.lat !== 0);
  }, [assignedDriver, effectiveAssignedDriverLoc, assignedDriverHeading, nearbyAlertTriggered, viewingDrivers]);

  const previewDrivers = useMemo(() => {
    return viewingDrivers
      .map((driver) => {
        let dist = 999;
        if (driver.currentLocation && pickup) {
          dist = calculateDistance(
            pickup.lat,
            pickup.lng,
            driver.currentLocation.lat,
            driver.currentLocation.lng,
          );
        }
        return { ...driver, _dist: dist };
      })
      .sort((a, b) => a._dist - b._dist)
      .slice(0, 10);
  }, [viewingDrivers, pickup]);
  const visibleOffers = useMemo(() => {
    return offers
      .filter((offer) => {
        if (!offer) return false;
        if (offer.status === "rejected" || offer.status === "accepted") return false;
        const key = offer.id || `${offer.driverId}_${offer.price}`;
        const dKey = offer.driverId;
        return (
          !rejectedOfferIds.includes(key) &&
          (!dKey || !rejectedOfferIds.includes(dKey))
        );
      })
      .sort((a, b) => {
        let distA = 5;
        let distB = 5;
        if (a.driverLocation && pickup)
          distA = calculateDistance(
            a.driverLocation.lat,
            a.driverLocation.lng,
            pickup.lat,
            pickup.lng,
          );
        if (b.driverLocation && pickup)
          distB = calculateDistance(
            b.driverLocation.lat,
            b.driverLocation.lng,
            pickup.lat,
            pickup.lng,
          );

        // Simplified scoring based on: Closest driver, lowest extra amount, driver rating
        // Lower score is better.
        // 1 km difference = +10 score. 10 EGP difference = +5 score. 1.0 rating difference = -10 score
        const scoreA = distA * 10 + a.price * 0.5 - (a.driverRating || 4.5) * 10;
        const scoreB = distB * 10 + b.price * 0.5 - (b.driverRating || 4.5) * 10;

        return scoreA - scoreB;
      });
  }, [offers, rejectedOfferIds, pickup]);
  const bestOfferPrice = visibleOffers.length > 0 ? visibleOffers[0].price : 0;
  const quickAccessPlaces = useMemo(() => {
    const hist = [...allHistoryPlaces];
    const suggested = getSuggestedPlaces(language, pickup || undefined, 25);

    const combined = [...hist, ...suggested];
    const seen = new Set();
    const unique = combined.filter((p) => {
      const key = `${p.name}_${p.coords.lat.toFixed(4)}_${p.coords.lng.toFixed(4)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (pickup) {
      return unique
        .map((p) => ({
          ...p,
          dist: calculateDistance(
            pickup.lat,
            pickup.lng,
            p.coords.lat,
            p.coords.lng,
          ),
        }))
        .sort((a, b) => (a.dist || 0) - (b.dist || 0))
        .slice(0, 15);
    }
    return unique.slice(0, 15);
  }, [allHistoryPlaces, pickup, language]);
  const isTripActive = [
    RideStatus.ACCEPTED,
    RideStatus.ARRIVED,
    RideStatus.IN_PROGRESS,
  ].includes(rideStatus);

  const [measuredSheetHeight, setMeasuredSheetHeight] = useState<number>(0);
  const sheetResizeObserverRef = useRef<ResizeObserver | null>(null);
  const bottomSheetRef = useCallback((node: HTMLDivElement | null) => {
    if (sheetResizeObserverRef.current) {
      sheetResizeObserverRef.current.disconnect();
      sheetResizeObserverRef.current = null;
    }
    if (node && typeof ResizeObserver !== "undefined") {
      const updateHeight = () => {
        const nextHeight = Math.round(node.offsetHeight);
        if (nextHeight > 0) {
          setMeasuredSheetHeight((prev) => (Math.abs(prev - nextHeight) > 10 ? nextHeight : prev));
        }
      };
      updateHeight();
      const ro = new ResizeObserver(updateHeight);
      ro.observe(node);
      sheetResizeObserverRef.current = ro;
    }
  }, []);

  const SAFE_BOTTOM_MARGIN = 28; // Safe clearance (px) above the bottom sheet

  const getMapBottomPadding = () => {
    const h = typeof window !== "undefined" ? window.innerHeight : 800;
    if (searchMode !== "none" || isPickingFromMap !== "none") return 0;
    if (rideStatus === RideStatus.IDLE) {
      if (measuredSheetHeight > 0 && !showFareSheet) {
        return Math.min(measuredSheetHeight + SAFE_BOTTOM_MARGIN, Math.round(h * 0.62));
      }
      if (dropoff) {
        const basePadding = showFareSheet ? Math.min(h * 0.50, 400) : Math.min(h * 0.42, 340);
        return (appSettings?.promoBanner?.isEnabled ? basePadding + 30 : basePadding) + SAFE_BOTTOM_MARGIN;
      }
      const idleBase = Math.min(h * 0.46, 360);
      return (appSettings?.promoBanner?.isEnabled ? idleBase + 24 : idleBase) + SAFE_BOTTOM_MARGIN;
    }
    if (
      rideStatus === RideStatus.SEARCHING ||
      rideStatus === RideStatus.OFFER_RECEIVED
    ) {
      return (visibleOffers.length > 0 ? Math.min(h * 0.52, 400) : Math.min(h * 0.44, 340)) + SAFE_BOTTOM_MARGIN;
    }
    if (isTripActive) return Math.min(h * 0.44, 340) + SAFE_BOTTOM_MARGIN;
    if (rideStatus === RideStatus.COMPLETED) return Math.min(h * 0.38, 290) + SAFE_BOTTOM_MARGIN;
    return 0;
  };

  const mapPadding = isSheetMinimized ? 0 : getMapBottomPadding();

  const getMapTopPadding = () => {
    if (searchMode !== "none" || isPickingFromMap !== "none") return 0;
    // Account for top-safe + floating header + current location pill card
    return 145;
  };

  const topPadding = getMapTopPadding();

  const ModalActionItem = ({
    icon,
    label,
    onClick,
  }: {
    icon: string;
    label: string;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 rounded-xl text-gray-700 font-bold hover:bg-gray-100 text-left active:scale-95 transition-transform"
    >
      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500">
        <i className={`fas ${icon}`}></i>
      </div>
      {label}
    </button>
  );

  const InfoRow = ({
    label,
    value,
    isMono = false,
    valueColor = "text-gray-800",
  }: {
    label: string;
    value: string;
    isMono?: boolean;
    valueColor?: string;
  }) => (
    <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
      <span className="text-sm font-bold text-gray-500">{label}</span>
      <span
        className={`text-sm font-bold ${valueColor} ${isMono ? "font-mono" : ""}`}
      >
        {value}
      </span>
    </div>
  );

  const [showDriverDetailsModal, setShowDriverDetailsModal] = useState(false);
  const [showSafetyContactsModal, setShowSafetyContactsModal] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);

  const searchProgress = Math.min(
    100,
    (searchElapsedTime / searchTotalTime) * 100,
  );

  // --- DATE PICKER HELPERS ---
  const generateDates = () => {
    const dates = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  const dayNames = isRTL
    ? ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <LocationGuard type="passenger">
      {visibleOffers.length > 0 && rideStatus === RideStatus.OFFER_RECEIVED && (
        <div className="pointer-events-none fixed inset-0 z-[200] border-[6px] border-[#FFC90E] opacity-90 animate-edge-glow pointer-events-none transition-opacity duration-300"></div>
      )}
      {isInitialLocating ? (
        <div
          className="h-full w-full relative bg-gray-50 flex items-center justify-center z-50"
          dir={isRTL ? "rtl" : "ltr"}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-600 font-bold animate-pulse">
              {isRTL ? "جارٍ تحديد موقعك..." : "Locating..."}
            </p>
          </div>
        </div>
      ) : (
        <div
          className="h-full w-full relative bg-gray-100 overflow-hidden"
          dir={isRTL ? "rtl" : "ltr"}
        >
          {isTripActive && (
            <SOSButton
              onActivate={handleActivateSOS}
              isActivated={isSosActivated}
            />
          )}
          {showLocationConfirm && (
            <div className="fixed inset-0 z-[1001] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white/90 backdrop-blur-xl w-full max-w-[280px] rounded-[14px] overflow-hidden shadow-2xl flex flex-col"
              >
                <div className="p-5 flex flex-col items-center">
                  <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                    <MapPin className="w-6 h-6 text-blue-500" />
                  </div>
                  <h3 className="text-[17px] font-bold text-center mb-2 leading-tight text-gray-900">
                    {t("confirm_location")}
                  </h3>
                  <p className="text-[13px] text-center text-gray-500 leading-snug">
                    {t("are_you_at")}{" "}
                    <span className="text-gray-900 font-bold">
                      {cityName || pickupAddress || t("current_location")}
                    </span>
                    {t("is_this_correct_q")}
                  </p>
                </div>

                <div className="flex border-t border-gray-200">
                  <button
                    onClick={changeLocation}
                    className={`flex-1 py-3 text-[#007AFF] text-[17px] font-normal active:bg-gray-200/50 transition-colors ${isRTL ? "border-l" : "border-r"} border-gray-200`}
                  >
                    {t("no")}
                  </button>
                  <button
                    onClick={confirmLocation}
                    className="flex-1 py-3 text-[#007AFF] text-[17px] font-bold active:bg-gray-200/50 transition-colors"
                  >
                    {t("yes")}
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* FLOATING NOTIFICATIONS CONTAINER */}
          <div className="fixed top-safe mt-4 left-0 right-0 z-[1002] flex flex-col gap-3 items-center pointer-events-none px-4">
            <AnimatePresence>
              {topNotification && topNotification.type === "message" && (
                <motion.div
                  layout
                  key="notif-message"
                  initial={{ opacity: 0, y: -50, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="flex justify-center pointer-events-auto w-full"
                >
                  <div
                    className="bg-white/95 backdrop-blur-xl rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.15)] border border-gray-100 p-2 pl-2 pr-5 rtl:pr-2 rtl:pl-5 flex items-center gap-3 w-max max-w-full cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => {
                      setTopNotification(null);
                      setIsChatOpen(true);
                      setHasUnreadMessages(false);
                    }}
                  >
                    <div className="relative shrink-0">
                      {assignedDriver?.avatar ? (
                        <img
                          src={assignedDriver.avatar}
                          alt={assignedDriver.name}
                          className="w-11 h-11 rounded-full object-cover shadow-sm border border-gray-100"
                        />
                      ) : (
                        <div className="w-11 h-11 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center border border-blue-200">
                          <i className="fas fa-car"></i>
                        </div>
                      )}
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
                    </div>
                    <div
                      className="flex flex-col overflow-hidden max-w-[220px]"
                      dir={isRTL ? "rtl" : "ltr"}
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-[14px] text-gray-900 leading-none truncate">
                          {assignedDriver
                            ? assignedDriver.name.split(" ")[0]
                            : isRTL
                              ? "الكابتن"
                              : "Captain"}
                        </span>
                        <span className="text-[9px] items-center text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-black uppercase tracking-widest leading-none">
                          {topNotification.title}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-gray-500 truncate">
                        {topNotification.body}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}

              {topNotification && topNotification.type !== "message" && (
                <motion.div
                  layout
                  key="notif-general"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="pointer-events-auto w-full"
                >
                  <div
                    className={`bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] p-4 border-l-4 flex flex-col gap-2 ${
                      topNotification.type === "offer"
                        ? "border-[#FFC90E]"
                        : "border-green-500"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                          topNotification.type === "offer"
                            ? "bg-yellow-100 text-[#FFC90E]"
                            : "bg-green-100 text-green-600"
                        }`}
                      >
                        <i
                          className={`fas ${
                            topNotification.type === "offer"
                              ? "fa-tags"
                              : "fa-check"
                          }`}
                        ></i>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-900 leading-tight">
                          {topNotification.title}
                        </h4>
                        <p className="text-sm text-gray-600 leading-snug mt-1">
                          {topNotification.body}
                        </p>
                      </div>
                      <button
                        onClick={() => setTopNotification(null)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                    {topNotification.type === "success" &&
                      rideStatus === RideStatus.COMPLETED && (
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => {
                              setTopNotification(null);
                              resetRide();
                            }}
                            className="flex-1 bg-green-600 text-white py-2 rounded-lg text-xs font-bold shadow-md hover:bg-green-700 transition-colors"
                          >
                            {t("book_new")}
                          </button>
                          <button
                            onClick={() => setTopNotification(null)}
                            className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors"
                          >
                            {t("close")}
                          </button>
                        </div>
                      )}
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>

          {/* Floating Pickup Location Card (Top Center) */}
          {rideStatus === RideStatus.IDLE &&
            searchMode === "none" &&
            isPickingFromMap === "none" &&
            !expiredRide &&
            !showFareSheet &&
            !dropoff && (
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: -20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: -20 }}
                transition={{
                  type: "spring",
                  stiffness: 420,
                  damping: 30,
                  mass: 0.8,
                }}
                className="absolute top-safe mt-20 left-0 right-0 z-40 flex justify-center pointer-events-none px-4 transform-gpu will-change-transform"
              >
                <button
                  onClick={() => handleOpenSearch("pickup")}
                  className="pointer-events-auto bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-3xl py-3 px-6 flex items-center gap-3 border border-gray-100 w-full active:scale-95 transition-all hover:shadow-xl text-left rtl:text-right relative overflow-hidden"
                >
                  {isLocating && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-50 to-transparent animate-pulse -translate-x-full"></div>
                  )}
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${isLocating ? "bg-[#1D4ED8] shadow-[0_0_10px_rgba(29,78,216,0.5)]" : "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]"} animate-pulse shrink-0`}
                  ></div>
                  <span
                    className={`text-sm font-bold leading-snug break-words flex-1 ${isLocating && (!pickupAddress || pickupAddress.includes("تحديث")) ? "text-[#1D4ED8]" : "text-gray-900"}`}
                    dir="auto"
                  >
                    {isLocating &&
                    (!pickupAddress || pickupAddress.includes("تحديث")) ? (
                       isRTL
                        ? "جاري تحديد وتقريب موقعك..."
                        : "Locating your exact address..."
                    ) : (
                      <>
                        <span className="text-gray-500 font-medium">
                          {t("you_are_here") || (isRTL ? "موقعك الحالى : " : "You are here : ")}
                        </span>
                        <span>{pickupAddress || t("current_location")}</span>
                      </>
                    )}
                  </span>
                  {isLocating ? (
                    <i className="fas fa-spinner fa-spin text-[#1D4ED8] text-xs shrink-0"></i>
                  ) : (
                    <i className="fas fa-chevron-down text-gray-400 text-xs shrink-0"></i>
                  )}
                </button>
              </motion.div>
            )}

          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            id="map-container"
            className="absolute inset-0 bg-[#fdfdfd] transform-gpu will-change-transform"
            style={
              {
                "--bottom-sheet-height": `${isSheetMinimized ? 0 : (measuredSheetHeight || Math.max(0, mapPadding - SAFE_BOTTOM_MARGIN))}px`,
              } as React.CSSProperties
            }
          >
            <Map
              pickup={
                isPickingFromMap === "pickup"
                  ? null
                  : rideStatus === RideStatus.IN_PROGRESS
                    ? null
                    : (dropoff ||
                       activeRideData ||
                       rideStatus === RideStatus.ACCEPTED ||
                       rideStatus === RideStatus.ARRIVED ||
                       rideStatus === RideStatus.SEARCHING)
                      ? (activeRideData?.pickup?.coords || pickup || null)
                      : null
              }
              dropoff={
                isPickingFromMap !== "none"
                  ? null
                  : (rideStatus === RideStatus.ACCEPTED ||
                     rideStatus === RideStatus.ARRIVED)
                    ? null
                    : (activeRideData?.dropoff?.coords || dropoff || null)
              }
              pickupAddress={pickupAddress || activeRideData?.pickup?.address}
              dropoffAddress={dropoffAddress || activeRideData?.dropoff?.address}
              routeStart={
                rideStatus === RideStatus.ACCEPTED ||
                rideStatus === RideStatus.ARRIVED
                  ? effectiveAssignedDriverLoc
                  : rideStatus === RideStatus.IN_PROGRESS
                    ? (effectiveAssignedDriverLoc || activeRideData?.pickup?.coords || pickup)
                    : undefined
              }
              routeEnd={
                rideStatus === RideStatus.ACCEPTED ||
                rideStatus === RideStatus.ARRIVED
                  ? (activeRideData?.pickup?.coords || pickup)
                  : rideStatus === RideStatus.IN_PROGRESS
                    ? (activeRideData?.dropoff?.coords || dropoff)
                    : undefined
              }
              drivers={mapDrivers}
              onMapClick={
                (rideStatus === RideStatus.SEARCHING ||
                 rideStatus === RideStatus.OFFER_RECEIVED ||
                 rideStatus === RideStatus.ACCEPTED ||
                 rideStatus === RideStatus.ARRIVED ||
                 rideStatus === RideStatus.IN_PROGRESS ||
                 !!activeRideData)
                  ? undefined
                  : handleMapClick
              }
              onMapDrag={handleMapDrag}
              onMapMoveEnd={handleMapMoveEnd}
              showRoute={
                isPickingFromMap === "none" &&
                ((
                  (rideStatus === RideStatus.ACCEPTED ||
                   rideStatus === RideStatus.ARRIVED) &&
                  !!effectiveAssignedDriverLoc &&
                  !!(activeRideData?.pickup?.coords || pickup)
                ) ||
                (
                  rideStatus === RideStatus.IN_PROGRESS &&
                  !!(effectiveAssignedDriverLoc || activeRideData?.pickup?.coords || pickup) &&
                  !!(activeRideData?.dropoff?.coords || dropoff)
                ) ||
                (
                  rideStatus !== RideStatus.ACCEPTED &&
                  rideStatus !== RideStatus.ARRIVED &&
                  rideStatus !== RideStatus.IN_PROGRESS &&
                  !!(pickup || activeRideData?.pickup?.coords) &&
                  !!(dropoff || activeRideData?.dropoff?.coords)
                ))
              }
              centerOn={
                rideStatus === RideStatus.ACCEPTED ||
                rideStatus === RideStatus.ARRIVED
                  ? (effectiveAssignedDriverLoc || activeRideData?.pickup?.coords || pickup || mapCenter)
                  : rideStatus === RideStatus.IN_PROGRESS
                    ? (effectiveAssignedDriverLoc || activeRideData?.dropoff?.coords || dropoff || mapCenter)
                    : (dropoff || activeRideData?.dropoff?.coords) && (pickup || activeRideData?.pickup?.coords) && isPickingFromMap === "none"
                      ? null
                      : mapCenter
              }
              bottomPadding={mapPadding}
              topPadding={topPadding}
              showUserOverlay={true}
              userLocation={passengerLocation}
              isMapAutoFollowing={isMapAutoFollowing}
              isSearchingForDrivers={
                rideStatus === RideStatus.SEARCHING ||
                rideStatus === RideStatus.OFFER_RECEIVED
              }
            />

            <AnimatePresence>
              {isPickingFromMap !== "none" && (
                <motion.div
                  initial={{ scale: 0, opacity: 0, y: -25 }}
                  animate={{
                    scale: 1,
                    opacity: 1,
                    y: isMapMoving ? -15 : 0,
                  }}
                  exit={{ scale: 0, opacity: 0, y: -25 }}
                  transition={{ type: "spring", stiffness: 420, damping: 26 }}
                  className="absolute left-1/2 top-1/2 z-[50] pointer-events-none -translate-x-1/2 -translate-y-[100%] transform-gpu will-change-transform"
                  style={{ top: "50%", left: "50%", position: "absolute" }}
                >
                  <div className="relative flex flex-col items-center justify-center">
                    <div
                      className={`relative flex items-center justify-center w-12 h-12 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.2)] border-[3px] border-white backdrop-blur-sm ${isPickingFromMap === "pickup" ? "bg-[#10b981]/90" : "bg-[#ef4444]/90"}`}
                    >
                      <MapPin
                        className="w-6 h-6 text-white"
                        strokeWidth={2.5}
                      />
                    </div>
                    {/* STEM */}
                    <div
                      className={`w-1 shadow-sm ${isPickingFromMap === "pickup" ? "bg-[#10b981]" : "bg-[#ef4444]"}`}
                      style={{ height: "18px" }}
                    ></div>
                    {/* Shadow base underneath */}
                    <div
                      className="absolute -bottom-1 w-3 h-1.5 bg-black/40 rounded-[100%] blur-[1px] transition-all duration-300"
                      style={{
                        transform: isMapMoving ? "scale(0.3)" : "scale(1.5)",
                        opacity: isMapMoving ? 0.2 : 0.6,
                      }}
                    ></div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* MAP PICKING CONFIRMATION BAR */}
          <AnimatePresence>
            {isPickingFromMap !== "none" && (
              <motion.div
                key="map-picking-bar"
                initial={{ opacity: 0, y: 24, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.94 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                className="fixed bottom-6 inset-x-4 max-w-lg mx-auto z-[70] bg-white/95 backdrop-blur-md rounded-[28px] p-4 shadow-[0_15px_40px_rgba(0,0,0,0.18)] border border-gray-100 flex flex-col gap-3 transform-gpu will-change-transform"
                dir={isRTL ? "rtl" : "ltr"}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${isPickingFromMap === 'pickup' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                    <i className={`fas ${isPickingFromMap === 'pickup' ? 'fa-map-pin' : 'fa-flag-checkered'} text-lg`}></i>
                  </div>
                  <div className="flex-1 min-w-0 text-left rtl:text-right">
                    <div className="text-[11px] font-bold text-gray-400">
                      {isPickingFromMap === "pickup"
                        ? (isRTL ? "تحديد نقطة الانطلاق" : "Set Pickup Location")
                        : (isRTL ? "تحديد وجهة الوصول" : "Set Destination")}
                    </div>
                    <div className="text-sm font-black text-gray-900 line-clamp-2 leading-snug" dir="auto">
                      {isPickingFromMap === "pickup"
                        ? (pickupAddress || (isRTL ? "الموقع المحدد على الخريطة" : "Pinned Location"))
                        : (dropoffAddress || (isRTL ? "الموقع المحدد على الخريطة" : "Pinned Location"))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setIsPickingFromMap("none");
                      setIsSheetMinimized(false);
                    }}
                    className="py-3 px-4 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm active:scale-95 transition-all"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    onClick={() => {
                      if (mapCenter) {
                        const mode = isPickingFromMap;
                        const resolved = lastResolvedPickRef.current;
                        const isMatchingResolved =
                          resolved &&
                          resolved.mode === mode &&
                          Math.abs(resolved.lat - mapCenter.lat) < 0.00025 &&
                          Math.abs(resolved.lng - mapCenter.lng) < 0.00025 &&
                          resolved.address &&
                          resolved.address !== t("pinned_location") &&
                          resolved.address !== (isRTL ? "جارٍ تحديد الموقع..." : "Loading Address...") &&
                          resolved.address !== (isRTL ? "جارٍ تحديد الموقع..." : "Finding location...");
                        handleMapClick(
                          mapCenter,
                          isMatchingResolved ? resolved.address : undefined
                        );
                      } else {
                        setIsPickingFromMap("none");
                        setIsSheetMinimized(false);
                      }
                    }}
                    className={`flex-1 py-3 px-4 rounded-2xl text-white font-black text-sm shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 ${
                      isPickingFromMap === "pickup"
                        ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/25"
                        : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/25"
                    }`}
                  >
                    <i className="fas fa-check"></i>
                    <span>{isRTL ? "تأكيد هذا الموقع" : "Confirm Location"}</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {searchMode === "none" &&
            isPickingFromMap === "none" &&
            !dropoff &&
            rideStatus === RideStatus.IDLE &&
            !showFareSheet && (
              <div
                className="absolute right-4 z-[60] flex flex-col gap-2 items-end"
                style={{
                  bottom: isSheetMinimized
                    ? 90
                    : (measuredSheetHeight > 0
                        ? measuredSheetHeight
                        : Math.max(280, mapPadding - SAFE_BOTTOM_MARGIN)) + 20,
                  transition: "bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              >
                <div className="relative flex flex-col items-center">
                  {showLocationTooltip && (
                    <div
                      onClick={(e: React.MouseEvent<HTMLDivElement>) => {
                        e.stopPropagation();
                        setShowLocationTooltip(false);
                      }}
                      className="absolute right-full mr-4 top-1/2 -translate-y-1/2 w-max bg-[#1E293B] text-white text-xs font-bold py-2.5 px-3 rounded-xl shadow-lg border border-gray-800 flex items-center gap-2 cursor-pointer select-none"
                      style={{ animation: "bounce-x 2s infinite" }}
                    >
                      <span>
                        {language === "ar"
                          ? "اضغط لتحديد موقعك الحالى"
                          : "Tap to find your location"}
                      </span>
                      <div className="absolute top-1/2 -right-1.5 border-t border-r -translate-y-1/2 w-3 h-3 bg-[#1E293B] rotate-45 border-gray-800 rounded-sm"></div>
                    </div>
                  )}
                  <button
                    id="current-location-btn"
                    disabled={isLocating}
                    aria-label={language === "ar" ? "تحديد موقعك الحالي" : "Center on my location"}
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                      e.stopPropagation();
                      setShowLocationTooltip(false);
                      setIsMapAutoFollowing(true);
                      handleGetCurrentLocation(false, true);
                    }}
                    className={`w-10 h-10 bg-transparent transition-all active:scale-90 disabled:opacity-50 flex items-center justify-center drop-shadow-[0_2px_6px_rgba(255,255,255,0.95)] ${isMapAutoFollowing ? "text-blue-600" : "text-gray-700 hover:text-blue-600"}`}
                  >
                    <i
                      className={`fas ${isLocating ? "fa-spinner fa-spin" : "fa-location-crosshairs"} text-2xl`}
                    ></i>
                  </button>
                </div>
              </div>
            )}

          {/* SEARCH OVERLAY */}
          <AnimatePresence>
            {searchMode !== "none" && (
              <motion.div
                key="search-overlay"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                className="fixed inset-0 bg-white z-[60] pt-safe flex flex-col transform-gpu will-change-transform origin-center"
              >
              {/* Search content... */}
              <div className="px-4 pt-[5px] pb-2 flex items-center gap-2 border-b border-gray-100">
                <button
                  onClick={() => setSearchMode("none")}
                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
                >
                  {isRTL ? (
                    <ArrowRight size={22} strokeWidth={2.5} />
                  ) : (
                    <ArrowLeft size={22} strokeWidth={2.5} />
                  )}
                </button>
                <div className="flex-1 relative">
                  <Search
                    className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? "right-4" : "left-4"} text-blue-500`}
                    size={20}
                    strokeWidth={2.5}
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={
                      searchMode === "pickup" ? t("pickup_loc") : t("where_to")
                    }
                    className={`w-full p-4 bg-gray-50/80 hover:bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-100 border border-transparent rounded-2xl outline-none font-bold text-[#292a2f] transition-all ${isRTL ? "pr-12 pl-14" : "pl-12 pr-14"} shadow-sm`}
                    autoFocus
                    dir="auto"
                  />
                  <div className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? "left-3" : "right-3"} flex items-center gap-1.5`}>
                    {isSearchingLoading && (
                      <Loader2 size={18} className="animate-spin text-blue-500 shrink-0" />
                    )}
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                      >
                        <XCircle size={18} strokeWidth={2.5} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                <button
                  onClick={() => {
                    setIsPickingFromMap(searchMode);
                    setSearchMode("none");
                    setIsSheetMinimized(true);
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-blue-50 transition-colors text-blue-600 font-bold group"
                >
                  <div className="w-12 h-12 bg-blue-100/50 group-hover:bg-blue-100 rounded-full flex items-center justify-center transition-colors">
                    <MapIcon size={24} strokeWidth={2} />
                  </div>
                  {t("set_on_map")}
                </button>

                {searchResults.length === 0 && isSearchingLoading ? (
                  <div className="p-4 space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex gap-4 items-center">
                        <PremiumSkeleton className="w-10 h-10 rounded-full shrink-0" />
                        <div className="space-y-2 flex-1">
                          <PremiumSkeleton className="h-4 w-3/4 rounded" />
                          <PremiumSkeleton className="h-3 w-1/2 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : searchResults.length === 0 && !isSearchingLoading && searchQuery.trim().length > 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <p className="font-bold text-gray-700">{isRTL ? "لم يتم العثور على أماكن مطابقة" : "No matching places found"}</p>
                    <p className="text-xs text-gray-400 mt-1">{isRTL ? "جرّب البحث باسم مكان آخر أو حدده على الخريطة" : "Try searching another location or pick from map"}</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {searchResults.map((place: Place, i) => (
                      <div
                        key={place.id || `${place.name}_${i}`}
                        className="w-full flex items-center justify-between p-2 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 group rounded-xl"
                      >
                        <button
                          onClick={() => handleSelectPlace(place)}
                          className="flex-1 flex items-center gap-4 p-2 text-left rtl:text-right"
                        >
                          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 shrink-0">
                            {place.isFavorite ? (
                              <i className="fas fa-heart text-red-500"></i>
                            ) : (
                              <i
                                className={`fas ${getLocationIcon(place.name, place.type)}`}
                              ></i>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div
                              className="font-bold text-gray-900 truncate"
                              dir="auto"
                            >
                              {place.name}
                            </div>
                            <div
                              className="text-xs text-gray-500 truncate"
                              dir="auto"
                            >
                              {place.dist !== undefined && (
                                <span className="text-blue-600 font-bold mr-1">
                                  {place.dist < 1
                                    ? `${Math.round(place.dist * 1000)} m`
                                    : `${place.dist.toFixed(1)} km`}{" "}
                                  &bull;
                                </span>
                              )}
                              {place.address}
                            </div>
                          </div>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const isFav = toggleFavoritePlace(place);
                            // Optimistically update the list
                            setSearchResults((prev) =>
                              prev.map((p) =>
                                p.id === place.id
                                  ? { ...p, isFavorite: isFav }
                                  : p,
                              ),
                            );
                          }}
                          className="p-3 text-gray-400 hover:text-red-500 transition-colors shrink-0 outline-none"
                        >
                          <i
                            className={`fa-heart ${place.isFavorite ? "fas text-red-500" : "far opacity-50 group-hover:opacity-100"}`}
                          ></i>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Bottom Sheet (IDLE / SELECTION) */}
          <AnimatePresence>
            {rideStatus === RideStatus.IDLE &&
              searchMode === "none" &&
              isPickingFromMap === "none" &&
              !expiredRide &&
              !showFareSheet && (
                <>
                  <motion.div
                    ref={bottomSheetRef}
                    key="main-idle-sheet"
                    initial={{ opacity: 0, y: 32, scale: 0.93 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 24, scale: 0.95 }}
                    transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                    className={`fixed bottom-0 left-0 right-0 z-50 glass-panel rounded-t-[35px] shadow-[0_-10px_35px_rgba(0,0,0,0.15)] pb-safe flex flex-col transform-gpu will-change-transform origin-bottom ${isSheetMinimized ? "translate-y-[calc(100%+10px)] pointer-events-none" : "translate-y-0"} ${dropoff ? "max-h-[85vh] h-auto" : "h-auto pb-4"}`}
                  >
                    {dropoff && (
                      <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 450, damping: 25 }}
                        onClick={handleBackFromIdleSheet}
                        className={`absolute -top-5 ${isRTL ? "right-5" : "left-5"} w-12 h-12 glass-panel rounded-full flex items-center justify-center text-gray-800 shadow-2xl hover:bg-gray-50 active:scale-90 transition-all z-[60]`}
                      >
                        <i className={`fas ${isRTL ? "fa-arrow-right" : "fa-arrow-left"} text-xl`}></i>
                      </motion.button>
                    )}

                    {/* Pull Handle */}
                    <div
                      className="w-full flex justify-center pt-3 pb-1 cursor-pointer"
                      onClick={() => setIsSheetMinimized(true)}
                    >
                      <div className="w-12 h-1.5 bg-gray-200 rounded-full"></div>
                    </div>

                    <motion.div
                      initial={{ opacity: 0, x: isRTL ? 30 : -30 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.22 }}
                      className="pb-1"
                    >
                      <div className="flex gap-2.5 overflow-x-auto hide-scrollbar px-6 py-1 snap-x">
                        {/* Card 1: Personal Ride (مشوار) */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRideType("RIDE");
                            setBookingType("SELF");
                            setShowBookForOtherModal(false);
                          }}
                          className={`snap-start shrink-0 min-w-[162px] sm:min-w-[178px] p-2 rounded-2xl border transition-all flex items-center gap-2.5 text-left rtl:text-right active:scale-95 ${
                            rideType === "RIDE" && !showBookForOtherModal
                              ? "bg-gradient-to-br from-[#FFF9E5] to-white border-[#FFC90E] shadow-sm ring-1 ring-[#FFC90E]/50"
                              : "bg-white/90 hover:bg-white border-gray-200/80 shadow-2xs"
                          }`}
                        >
                          <div className="w-11 h-11 rounded-xl overflow-hidden bg-white border border-gray-100 shrink-0 shadow-2xs flex items-center justify-center">
                            <img
                              src={getAsset("assets/images/service_ride_card_1794579002856.jpg")}
                              alt={t("ride_type_ride")}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs sm:text-[13px] font-black text-gray-900 truncate leading-tight">
                              {t("ride_type_ride")}
                            </div>
                            <div className="text-[10px] font-bold text-gray-500 truncate mt-0.5 leading-tight">
                              {isRTL ? "احجز مشوارك الآن" : "Book your personal ride"}
                            </div>
                          </div>
                        </button>

                        {/* Card 2: Book for Someone Else (حجز لشخص آخر) */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRideType("RIDE");
                            setBookingType("FOR_OTHER");
                            setOtherPassengerError(null);
                            setShowBookForOtherModal(true);
                          }}
                          className={`snap-start shrink-0 min-w-[174px] sm:min-w-[190px] p-2 rounded-2xl border transition-all flex items-center gap-2.5 text-left rtl:text-right active:scale-95 ${
                            showBookForOtherModal
                              ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                              : "bg-white/90 hover:bg-blue-50/50 border-gray-200/80 shadow-2xs"
                          }`}
                        >
                          <div className="w-11 h-11 rounded-xl overflow-hidden bg-white border border-blue-100 shrink-0 shadow-2xs flex items-center justify-center">
                            <img
                              src={getAsset("assets/images/service_for_other_card_1794579005171.jpg")}
                              alt={isRTL ? "حجز لشخص آخر" : "For Someone Else"}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div
                              className={`text-xs sm:text-[13px] font-black truncate leading-tight ${
                                showBookForOtherModal ? "text-white" : "text-gray-900"
                              }`}
                            >
                              {isRTL ? "حجز لشخص آخر" : "For Someone Else"}
                            </div>
                            <div
                              className={`text-[10px] font-bold truncate mt-0.5 leading-tight ${
                                showBookForOtherModal ? "text-blue-100" : "text-gray-500"
                              }`}
                            >
                              {isRTL ? "رحلة لعائلتك أو صديقك" : "Ride for family or friend"}
                            </div>
                          </div>
                        </button>

                        {/* Card 3: Mowasla Express (مواصلة إكسبرس) */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRideType("PARCEL");
                            setBookingType("SELF");
                            setShowBookForOtherModal(false);
                            setShowExpressPopup(true);
                          }}
                          className={`snap-start shrink-0 min-w-[170px] sm:min-w-[186px] p-2 rounded-2xl border transition-all flex items-center gap-2.5 text-left rtl:text-right active:scale-95 ${
                            rideType === "PARCEL"
                              ? "bg-gradient-to-br from-[#FFF9E5] to-white border-[#FFC90E] shadow-sm ring-1 ring-[#FFC90E]/50"
                              : "bg-white/90 hover:bg-white border-gray-200/80 shadow-2xs"
                          }`}
                        >
                          <div className="w-11 h-11 rounded-xl overflow-hidden bg-white border border-amber-100 shrink-0 shadow-2xs flex items-center justify-center">
                            <img
                              src={getAsset("assets/images/service_express_card_1794579005461.jpg")}
                              alt={t("ride_type_express")}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs sm:text-[13px] font-black text-gray-900 truncate leading-tight">
                              {t("ride_type_express")}
                            </div>
                            <div className="text-[10px] font-bold text-gray-500 truncate mt-0.5 leading-tight">
                              {isRTL ? "توصيل طلبات وطرود" : "Fast parcel delivery"}
                            </div>
                          </div>
                        </button>

                        {/* Card 4: Scheduled & Recurring Rides (الرحلات المجدولة) */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowScheduledRidesModal(true);
                          }}
                          className="snap-start shrink-0 min-w-[168px] sm:min-w-[184px] p-2 rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/90 to-white hover:from-indigo-100/80 transition-all flex items-center gap-2.5 text-left rtl:text-right active:scale-95 shadow-2xs"
                        >
                          <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white shrink-0 shadow-xs flex items-center justify-center">
                            <i className="fas fa-calendar-alt text-lg text-[#FFC90E]"></i>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs sm:text-[13px] font-black text-gray-900 truncate leading-tight">
                              {isRTL ? "الرحلات المجدولة" : "Scheduled Rides"}
                            </div>
                            <div className="text-[10px] font-bold text-indigo-600 truncate mt-0.5 leading-tight">
                              {isRTL ? "حجز مسبق وجداول متكررة" : "Advance & recurring"}
                            </div>
                          </div>
                        </button>
                      </div>
                    </motion.div>

                    <div
                      className={`flex-1 overflow-y-auto px-6 py-4 space-y-4 pt-2 hide-scrollbar`}
                    >
                      <motion.div
                        initial={{
                          scaleX: 0.96,
                          opacity: 0,
                          originX: isRTL ? 1 : 0,
                        }}
                        animate={{ scaleX: 1, opacity: 1 }}
                        transition={{
                          duration: 0.24,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        className="relative group bg-white rounded-[26px] p-2.5 sm:p-3 shadow-[0_6px_25px_rgba(0,0,0,0.07)] hover:shadow-[0_10px_35px_rgba(0,0,0,0.11)] border border-gray-100 hover:border-red-200 transition-all duration-300"
                      >
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenSearch("dropoff");
                            }}
                            className="flex-1 flex items-center gap-3 sm:gap-3.5 p-1 relative text-left rtl:text-right group cursor-pointer active:scale-[0.99] transition-transform select-none min-w-0"
                          >
                            {/* Modern Glowing Gradient Location Pin Icon Badge */}
                            <div className="relative shrink-0">
                              <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-gradient-to-tr from-[#EF4444] via-[#F43F5E] to-[#FB7185] text-white flex items-center justify-center shadow-[0_4px_14px_rgba(239,68,68,0.38)] group-hover:scale-105 group-hover:shadow-[0_6px_20px_rgba(239,68,68,0.5)] transition-all duration-300">
                                <i className="fas fa-map-marker-alt text-xl text-white drop-shadow-xs"></i>
                              </div>
                              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-rose-400 rounded-full animate-ping opacity-60"></span>
                            </div>

                            {/* Center Text Block: Modern, Bold & Obvious */}
                            <div className="flex-1 min-w-0">
                              {dropoffAddress ? (
                                <>
                                  <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-rose-600">
                                    <i className="fas fa-location-arrow text-[10px]"></i>
                                    <span>{isRTL ? "وجهة الوصول" : "Destination"}</span>
                                  </div>
                                  <div
                                    className="text-base sm:text-lg font-black text-gray-900 line-clamp-2 leading-snug mt-0.5"
                                    dir="auto"
                                  >
                                    {dropoffAddress}
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div
                                    className="text-lg sm:text-xl font-black text-gray-900 tracking-tight leading-tight group-hover:text-rose-600 transition-colors"
                                    dir="auto"
                                  >
                                    {t("dropoff_loc", "Where to?", "وجهتك؟")}
                                  </div>
                                  <div
                                    className="text-xs sm:text-[13px] font-bold text-gray-400 group-hover:text-gray-500 transition-colors truncate mt-0.5 flex items-center gap-1.5"
                                    dir="auto"
                                  >
                                    <i className="fas fa-search text-[10px] text-gray-300 group-hover:text-rose-500 transition-colors"></i>
                                    <span>
                                      {isRTL
                                        ? "ابحث عن عنوان أو اختر من الخريطة"
                                        : "Search address or pick on map"}
                                    </span>
                                  </div>
                                </>
                              )}
                            </div>
                          </button>

                          {/* Action Buttons on End */}
                          <div className="shrink-0 flex items-center gap-1.5 pl-1 rtl:pr-1">
                            {dropoffAddress ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDropoff(null);
                                  setDropoffAddress("");
                                }}
                                className="w-9 h-9 rounded-full bg-gray-100 hover:bg-rose-50 text-gray-400 hover:text-rose-600 flex items-center justify-center transition-all active:scale-90"
                                title={isRTL ? "إلغاء الوجهة" : "Clear Destination"}
                              >
                                <i className="fas fa-times text-sm"></i>
                              </button>
                            ) : (
                              <>
                                {/* Direct Map Picker Button */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsPickingFromMap("dropoff");
                                    setIsSheetMinimized(true);
                                  }}
                                  className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 text-xs font-black transition-all active:scale-95 border border-gray-200/60 shadow-xs"
                                  title={isRTL ? "تحديد من الخريطة" : "Pick on Map"}
                                >
                                  <i className="fas fa-map-marked-alt text-rose-500 text-xs"></i>
                                  <span>{isRTL ? "الخريطة" : "Map"}</span>
                                </button>

                                {/* Action Arrow / Search Trigger */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenSearch("dropoff");
                                  }}
                                  className="w-10 h-10 rounded-xl bg-rose-50 group-hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-all active:scale-95 shadow-xs"
                                >
                                  <i
                                    className={`fas ${isRTL ? "fa-arrow-left" : "fa-arrow-right"} text-sm`}
                                  ></i>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </motion.div>

                      <AnimatePresence mode="popLayout" initial={false}>
                        {!dropoff ? (
                          appSettings?.homeAdBanner?.isSectionHidden ||
                          (appSettings?.homeAdBanner?.isEnabled === false &&
                            (appSettings?.homeAdBanner?.isQuickDestinationsEnabled === false ||
                              quickAccessPlaces.length === 0)) ? null : (
                            <motion.div
                              key="destinations-and-ad-view"
                              initial={{ opacity: 0, scale: 0.92 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.94 }}
                              transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                              className="space-y-4 transform-gpu will-change-transform -mx-[19px] px-0 origin-center"
                            >
                              <QuickDestinationsAndAdBanner
                                quickAccessPlaces={quickAccessPlaces}
                                handleSelectPlace={handleSelectPlace}
                                getLocationIcon={getLocationIcon}
                                onNavigate={onNavigate}
                                isRTL={isRTL}
                                t={t}
                                adBannerConfig={appSettings?.homeAdBanner}
                              />
                            </motion.div>
                          )
                        ) : (
                          <motion.div
                            key="vehicle-selection-view"
                            initial={{ opacity: 0, scale: 0.92 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.94 }}
                            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                            className="pt-2 pb-4 transform-gpu will-change-transform origin-center"
                          >
                          {rideType === "RIDE" && (
                            <>
                              {/* Booking Mode Selector: Book Now (احجز الآن) vs Schedule a Ride (جدولة رحلة) */}
                              <div className="mb-3 p-1 rounded-2xl bg-gray-100 flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsScheduling(false);
                                    setRecurringFrequency("ONE_TIME");
                                  }}
                                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                                    !isScheduling
                                      ? "bg-white text-gray-900 shadow-xs"
                                      : "text-gray-500 hover:text-gray-800"
                                  }`}
                                >
                                  <i className="fas fa-bolt text-amber-500"></i>
                                  <span>{isRTL ? "احجز الآن" : "Book Now"}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsScheduling(true);
                                    setShowScheduleSheet(true);
                                  }}
                                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                                    isScheduling
                                      ? "bg-[#1f44df] text-white shadow-xs"
                                      : "text-gray-500 hover:text-gray-800"
                                  }`}
                                >
                                  <i className="fas fa-calendar-check text-[#FFC90E]"></i>
                                  <span>{isRTL ? "جدولة رحلة" : "Schedule a Ride"}</span>
                                </button>
                              </div>

                              {/* Active Scheduled Summary Pill when Schedule a Ride is selected */}
                              {isScheduling && (
                                <div className="mb-3 p-3 rounded-2xl bg-blue-50/90 border border-blue-200 flex items-center justify-between gap-2">
                                  <div className="text-xs">
                                    <div className="font-black text-blue-950 flex items-center gap-1.5">
                                      <i className="fas fa-clock text-blue-600"></i>
                                      <span>
                                        {selectedDate.toLocaleDateString(
                                          isRTL ? "ar-EG" : "en-US",
                                          { weekday: "short", month: "short", day: "numeric" }
                                        )}{" "}
                                        • {selectedHour}:{selectedMinute.toString().padStart(2, "0")}{" "}
                                        {selectedPeriod}
                                      </span>
                                    </div>
                                    <div className="text-[11px] font-bold text-blue-700 mt-0.5">
                                      {recurringFrequency !== "ONE_TIME"
                                        ? isRTL
                                          ? `جدول متكرر (${recurringFrequency}) • ${scheduledPassengerCount} ركاب`
                                          : `Recurring (${recurringFrequency}) • ${scheduledPassengerCount} pax`
                                        : isRTL
                                        ? `رحلة مجدولة مسبقاً • ${scheduledPassengerCount} ركاب`
                                        : `Advance scheduled ride • ${scheduledPassengerCount} pax`}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setShowScheduleSheet(true)}
                                    className="px-3 py-1.5 rounded-xl bg-white text-blue-700 border border-blue-200 text-xs font-black shrink-0"
                                  >
                                    {isRTL ? "تعديل الموعد" : "Edit Time"}
                                  </button>
                                </div>
                              )}

                              <div className="flex justify-between items-center mb-4 px-1">
                                <h3 className="font-bold text-gray-900">
                                  {t("choose_vehicle_title")}
                                </h3>
                              </div>
                              <div className="flex gap-3 overflow-x-auto hide-scrollbar py-4 -mx-6 px-6">
                                {VEHICLE_TYPES.map((type) => {
                                  const isMoto = type.id === VehicleType.MOTO;
                                  const isTooFarForMoto =
                                    isMoto &&
                                    distanceKm > 15 &&
                                    !motoWarningAccepted;
                                  return (
                                    <VehicleCard
                                      key={type.id}
                                      type={type}
                                      priceRange={priceRanges[type.id] || null}
                                      duration={Math.ceil(distanceKm * 2.5)}
                                      isSelected={
                                        selectedVehicleType === type.id
                                      }
                                      isDisabled={isTooFarForMoto}
                                      onSelect={(selectedId) => {
                                        if (
                                          selectedId === VehicleType.MOTO &&
                                          distanceKm > 15 &&
                                          !motoWarningAccepted
                                        ) {
                                          setShowMotoWarning(true);
                                        } else {
                                          setSelectedVehicleType(selectedId);
                                        }
                                      }}
                                      currencyLabel={t("currency")}
                                    />
                                  );
                                })}
                              </div>
                            </>
                          )}
                          {rideType === "PARCEL" && (
                            <div className="space-y-3 mb-4 animate-fade-in">
                              <h3 className="font-bold text-gray-900 px-1">
                                {t("delivery_details")}
                              </h3>
                              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-3">
                                <input
                                  type="text"
                                  value={parcelDetails}
                                  onChange={(e) =>
                                    setParcelDetails(e.target.value)
                                  }
                                  placeholder={t("parcel_details_placeholder")}
                                  className="w-full bg-white p-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#FFC90E] transition-colors"
                                />
                                <input
                                  type="text"
                                  value={recipientName}
                                  onChange={(e) =>
                                    setRecipientName(e.target.value)
                                  }
                                  placeholder={t("recipient_name_placeholder")}
                                  className="w-full bg-white p-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#FFC90E] transition-colors"
                                />
                                <input
                                  type="tel"
                                  value={recipientPhone}
                                  onChange={(e) =>
                                    setRecipientPhone(e.target.value)
                                  }
                                  placeholder={t("recipient_phone_placeholder")}
                                  className="w-full bg-white p-3 rounded-xl border border-gray-200 text-2xl font-black outline-none focus:border-[#FFC90E] transition-colors"
                                />
                              </div>
                            </div>
                          )}
                          <div className="w-full">
                            <Button
                              onClick={() => {
                                if (rideType === "RIDE" && bookingType === "FOR_OTHER") {
                                  if (otherPassengerName.trim().length < 2) {
                                    setOtherPassengerError(t("err_other_passenger_name"));
                                    HapticsService.heavy();
                                    return;
                                  }
                                  const phoneCheck = validateAndNormalizePassengerPhone(
                                    otherPassengerPhone,
                                    otherPassengerCountryCode,
                                  );
                                  if (!phoneCheck.isValid) {
                                    setOtherPassengerError(t("err_other_passenger_phone"));
                                    HapticsService.heavy();
                                    return;
                                  }
                                  setOtherPassengerError(null);
                                }
                                setShowFareSheet(true);
                              }}
                              isLoading={false}
                              style={{ borderRadius: "30px" }}
                              className="w-full h-14 text-black shadow-lg rounded-[30px] text-lg font-black transition-all bg-[#FFC90E] shadow-yellow-200 hover:bg-orange-600"
                            >
                              {isRTL ? "متابعة" : "Continue"}
                            </Button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>

                {isSheetMinimized && (
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 420, damping: 28 }}
                    className="fixed bottom-safe left-0 right-0 z-40 flex justify-center pb-4 pointer-events-auto"
                  >
                    <button
                      onClick={() => setIsSheetMinimized(false)}
                      className="bg-[#FFC90E] shadow-xl border border-yellow-400 px-6 py-3 rounded-[30px] flex items-center gap-2 text-gray-900 font-black hover:bg-yellow-500 transition-transform active:scale-95"
                    >
                      <i className="fas fa-chevron-up text-gray-900"></i>
                      <span>{dropoff ? t("trip_details") : t("where_to")}</span>
                    </button>
                  </motion.div>
                )}
              </>
            )}
          </AnimatePresence>

          {/* FARE NEGOTIATION / CONFIRMATION SHEET (ADDED MISSING UI) */}
          <AnimatePresence>
            {showFareSheet && (
              <motion.div
                key="fare-negotiation-sheet"
                initial={{ opacity: 0, y: 28, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 24, scale: 0.94 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                className="fixed bottom-0 left-0 right-0 z-[60] glass-panel rounded-t-[32px] shadow-[0_-15px_50px_rgba(0,0,0,0.15)] pb-safe p-5 transform-gpu will-change-transform origin-bottom"
                onClick={(e) => e.stopPropagation()}
              >
              <div className="w-12 h-1 bg-gray-300/50 rounded-full mx-auto mb-4"></div>

              <button
                onClick={() => setShowFareSheet(false)}
                className="absolute top-5 left-5 w-9 h-9 bg-black/5 rounded-full flex items-center justify-center text-gray-500 hover:bg-black/10 transition-colors"
              >
                <i className="fas fa-arrow-left text-sm"></i>
              </button>

              <div className="text-center mb-5">
                <h2 className="text-xl font-black text-gray-900">
                  {t("confirm_request")}
                </h2>
                <p className="text-xs font-bold text-gray-400 mt-0.5">
                  {t("pickup_urgency", "Select Urgency")}
                </p>
                {pricingConfig?.surgeEnabled &&
                  pricingConfig.surgeMultiplier > 1 && (
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 text-red-600 border border-red-100/50">
                      <Zap className="w-3 h-3 fill-current" />
                      <span className="text-[10px] font-black uppercase tracking-wider">
                        {isRTL
                          ? pricingConfig.surgeReasonAr
                          : pricingConfig.surgeReasonEn}
                      </span>
                    </div>
                  )}
              </div>

              <div className="mb-6">
                {(() => {
                  const recFare =
                    priceRanges[selectedVehicleType]?.recommended ||
                    customFare ||
                    50;
                  const minFare = priceRanges[selectedVehicleType]?.min || 10;

                  const roundedRecFare = Math.round(recFare / 5) * 5;
                  const quickPrices = Array.from(
                    new Set([
                      Math.round(Math.max(minFare, recFare * 0.8) / 5) * 5,
                      roundedRecFare,
                      Math.round((recFare * 1.2) / 5) * 5,
                      Math.round((recFare * 1.5) / 5) * 5,
                      Math.round((recFare * 2.0) / 5) * 5,
                      Math.round((recFare * 2.5) / 5) * 5,
                    ]),
                  )
                    .filter((v) => v >= minFare)
                    .sort((a, b) => a - b)
                    .slice(0, 6);

                  let zoneStr = "RECOMMENDED";
                  let zoneBadge = isRTL ? "💰 سعر اقتصادي" : "💰 Economical";
                  let zoneTextColor = "text-yellow-700";
                  let zoneBgColor = "bg-[#FFC90E]/20 border-[#FFC90E]";

                  if (customFare < recFare * 0.95) {
                    zoneStr = "LOW";
                    zoneBadge = isRTL ? "💰 سعر اقتصادي" : "💰 Economical";
                    zoneTextColor = "text-gray-600";
                    zoneBgColor = "bg-gray-100 border-gray-200";
                  } else if (customFare > recFare * 1.2) {
                    zoneStr = "URGENT";
                    zoneBadge = isRTL
                      ? "🔥 فرصة قبول أعلى"
                      : "🔥 Better Chance";
                    zoneTextColor = "text-orange-600";
                    zoneBgColor = "bg-orange-50 border-orange-200";
                  } else if (customFare > recFare * 1.05) {
                    zoneStr = "HIGH";
                    zoneBadge = isRTL ? "⚡ قبول أسرع" : "⚡ Faster matching";
                    zoneTextColor = "text-blue-600";
                    zoneBgColor = "bg-blue-50 border-blue-200";
                  }

                  return (
                    <div className="flex flex-col gap-4">
                      {/* SMART RECOMMENDED PRICE CARD */}
                      <div
                        style={{ borderRadius: "30px" }}
                        className="glass-panel p-4 rounded-[30px] border border-[#FFC90E]/30 bg-gradient-to-br from-[#FFF9E5]/50 to-white relative overflow-hidden flex flex-col items-center justify-center text-center cursor-pointer active:scale-95 transition-transform"
                        onClick={() => {
                          HapticsService.light();
                          setCustomFare(roundedRecFare);
                        }}
                      >
                        <div className="absolute top-0 left-0 w-1 bg-[#FFC90E] h-full shadow-[0_0_10px_#FFC90E]"></div>
                        <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-1">
                          {isRTL ? "السعر المقترح" : "Recommended Price"}
                        </span>
                        <div className="flex items-center gap-1.5 pt-1">
                          <span className="text-4xl font-black text-gray-900 leading-none">
                            {roundedRecFare}
                          </span>
                          <span className="text-xs font-bold text-gray-500 uppercase pb-1">
                            {t("currency")}
                          </span>
                        </div>
                        <div className="mt-2 text-[10px] font-medium text-gray-400">
                          {isRTL
                            ? "مبني على المسافة، الطلب، والزحام المروري"
                            : "Based on distance, demand, and traffic"}
                        </div>
                      </div>

                      {/* QUICK PRICE OPTIONS */}
                      <div className="mt-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[11px] font-black text-gray-800 tracking-wide">
                            {isRTL ? "خيارات سريعة" : "Quick Options"}
                          </span>
                          <div className="h-px bg-gray-200 flex-1"></div>
                        </div>
                        <div
                          className="flex overflow-x-auto gap-2 pb-2 px-1 -mx-1 snap-x"
                          style={{
                            msOverflowStyle: "none",
                            scrollbarWidth: "none",
                          }}
                        >
                          {quickPrices.map((price, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                HapticsService.light();
                                setCustomFare(price);
                              }}
                              style={{ borderRadius: "30px" }}
                              className={`snap-center shrink-0 w-[75px] h-[58px] rounded-[30px] flex flex-col items-center justify-center border transition-all ${
                                customFare === price
                                  ? "bg-[#FFC90E] border-[#FFC90E] shadow-md transform scale-[1.03] select-none"
                                  : "bg-white border-gray-200 text-gray-700 hover:border-[#FFC90E]"
                              }`}
                            >
                              <span
                                className={`text-lg font-black leading-none ${customFare === price ? "text-gray-900" : "text-gray-800"}`}
                              >
                                {price}
                              </span>
                              <span
                                className={`text-[9px] font-bold mt-1 ${customFare === price ? "text-gray-800" : "text-gray-500"} uppercase`}
                              >
                                {t("currency")}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* CUSTOM PRICE INPUT */}
                      <div className="mt-1">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-[11px] font-black text-gray-800 tracking-wide">
                            {isRTL ? "حدد سعرك بنفسك" : "Custom Price"}
                          </span>
                          <div className="h-px bg-gray-200 flex-1"></div>
                        </div>

                        <div className="relative">
                          <div
                            className={`absolute left-3 right-3 -top-2.5 flex justify-center z-10 pointer-events-none`}
                          >
                            <span
                              className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${zoneBgColor} ${zoneTextColor} shadow-sm bg-white/90 backdrop-blur-sm`}
                            >
                              {zoneBadge}
                            </span>
                          </div>

                          <div
                            style={{ borderRadius: "30px" }}
                            className={`relative w-full h-[68px] rounded-[30px] border-2 transition-all flex items-center justify-between gap-2 px-3 bg-white shadow-sm focus-within:shadow-md focus-within:border-[#FFC90E] ${
                              customFare !== roundedRecFare &&
                              !quickPrices.includes(customFare)
                                ? "border-[#FFC90E] ring-4 ring-[#FFC90E]/10"
                                : "border-gray-200"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                HapticsService.light();
                                const baseVal = customFare > 0 ? customFare : roundedRecFare;
                                setCustomFare(Math.max(minFare, baseVal - 5));
                              }}
                              disabled={(customFare || roundedRecFare) <= minFare}
                              aria-label={isRTL ? "تقليل السعر" : "Decrease price"}
                              style={{ borderRadius: "22px" }}
                              className="w-11 h-11 rounded-[22px] bg-gray-100 hover:bg-gray-200 active:scale-90 flex items-center justify-center text-gray-800 transition-all shrink-0 disabled:opacity-35 disabled:pointer-events-none shadow-2xs"
                            >
                              <Minus className="w-5 h-5 stroke-[2.75]" />
                            </button>

                            <div className="flex-1 min-w-0 flex items-baseline justify-center gap-1.5">
                              <input
                                type="number"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={customFare || ""}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  if (isNaN(val)) {
                                    setCustomFare(0);
                                  } else {
                                    setCustomFare(val);
                                  }
                                }}
                                onBlur={() => {
                                  if (customFare < minFare) {
                                    setCustomFare(minFare);
                                  }
                                }}
                                className="w-24 text-center text-3xl font-black bg-transparent outline-none text-gray-900 placeholder:text-gray-300 tabular-nums"
                                placeholder="0"
                              />
                              <span className="text-xs font-bold text-gray-400 select-none uppercase shrink-0">
                                {t("currency")}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                HapticsService.light();
                                const baseVal = customFare > 0 ? customFare : roundedRecFare;
                                setCustomFare(baseVal + 5);
                              }}
                              aria-label={isRTL ? "زيادة السعر" : "Increase price"}
                              style={{ borderRadius: "22px" }}
                              className="w-11 h-11 rounded-[22px] bg-[#FFC90E] hover:bg-[#f0bc00] active:scale-90 flex items-center justify-center text-gray-900 transition-all shrink-0 shadow-sm"
                            >
                              <Plus className="w-5 h-5 stroke-[2.75]" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="grid grid-cols-2 gap-3 mb-5">
                <button
                  onClick={() =>
                    setPaymentMethod((prev) =>
                      prev === PaymentMethod.CASH
                        ? PaymentMethod.INSTAPAY
                        : PaymentMethod.CASH,
                    )
                  }
                  style={{ borderRadius: "30px" }}
                  className={`p-3 border rounded-[30px] flex items-center gap-2.5 shadow-sm transition-all ${paymentMethod === PaymentMethod.INSTAPAY ? "bg-yellow-50 border-yellow-200" : "bg-white border-gray-100"}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${paymentMethod === PaymentMethod.INSTAPAY ? "bg-yellow-100 text-yellow-600" : "bg-green-50 text-green-600"}`}
                  >
                    <i
                      className={`fas ${paymentMethod === PaymentMethod.INSTAPAY ? "fa-mobile-alt" : "fa-money-bill-wave"}`}
                    ></i>
                  </div>
                  <div className="text-left rtl:text-right flex-1 min-w-0">
                    <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">
                      {t("payment_method")}
                    </div>
                    <div className="font-bold text-xs truncate text-gray-900" dir="auto">
                      {paymentMethod === PaymentMethod.INSTAPAY
                        ? (isRTL ? "انستا باى" : "InstaPay")
                        : t("cash")}
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => setIsLargeGroup(!isLargeGroup)}
                  style={{ borderRadius: "30px" }}
                  className={`p-3 border rounded-[30px] flex items-center gap-2.5 shadow-sm active:scale-95 transition-all ${isLargeGroup ? "bg-blue-50 border-blue-200" : "bg-white border-gray-100"}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${isLargeGroup ? "bg-blue-100 text-blue-600" : "bg-gray-50 text-gray-400"}`}
                  >
                    <i className="fas fa-users"></i>
                  </div>
                  <div className="text-left rtl:text-right flex-1 min-w-0">
                    <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">
                      {t("options_label")}
                    </div>
                    <div
                      className={`font-bold text-xs truncate ${isLargeGroup ? "text-blue-700" : "text-gray-900"}`}
                    >
                      {isLargeGroup
                        ? t("large_group_badge")
                        : t("vehicle_standard")}
                    </div>
                  </div>
                </button>
              </div>

              {isRewardEligible && (
                <div
                  onClick={() => handleToggleUseRewardDiscount(!useRewardDiscount)}
                  style={{ borderRadius: "30px" }}
                  className={`p-3.5 rounded-[30px] border-2 mb-5 flex items-center justify-between cursor-pointer transition-all active:scale-[0.98] ${
                    useRewardDiscount
                      ? "bg-yellow-50/90 border-[#FFC90E] shadow-sm"
                      : "bg-white border-gray-100 hover:border-yellow-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-[#FFC90E] rounded-xl flex items-center justify-center text-black font-black text-xs shadow-sm shrink-0">
                      <i className="fas fa-gift"></i>
                    </div>
                    <div>
                      <div className="font-black text-xs text-gray-900 flex items-center gap-1.5">
                        <span>
                          {isRTL
                            ? `استخدام خصم المكافأة (-${rewardDiscountAmount} ${t("currency")})`
                            : `Use Reward Discount (-${rewardDiscountAmount} ${t("currency")})`}
                        </span>
                      </div>
                      <div className="text-[10px] font-bold text-gray-500 mt-0.5">
                        {isRTL
                          ? `رصيدك ${rewardPoints} نقطة • سيتم خصم ${rewardThresholdPoints} نقطة`
                          : `Balance: ${rewardPoints} pts • Uses ${rewardThresholdPoints} pts`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {useRewardDiscount && customFare > 0 && (
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-1 rounded-lg">
                        {Math.max(10, customFare - rewardDiscountAmount)} {t("currency")}
                      </span>
                    )}
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                        useRewardDiscount
                          ? "bg-[#FFC90E] text-gray-900"
                          : "bg-gray-100 text-gray-300"
                      }`}
                    >
                      <i className="fas fa-check text-xs"></i>
                    </div>
                  </div>
                </div>
              )}

              {/* PHASE 2: CLEAR BOOKING SUMMARY FOR "BOOK FOR SOMEONE ELSE" */}
              {rideType === "RIDE" && bookingType === "FOR_OTHER" && (
                <div
                  style={{ borderRadius: "30px" }}
                  className="mb-4 p-3.5 rounded-[30px] bg-blue-50/90 border border-blue-200 text-xs space-y-2 shadow-2xs"
                >
                  <div className="flex items-center justify-between border-b border-blue-200/60 pb-2">
                    <div className="flex items-center gap-1.5 font-black text-blue-900">
                      <i className="fas fa-user-check text-blue-600"></i>
                      <span>{t("confirm_passenger_details")}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-black">
                      {t("for_other_badge")}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-gray-500 font-bold block">
                        {t("actual_passenger")}:
                      </span>
                      <span className="font-black text-gray-900">
                        {otherPassengerName}
                      </span>
                      <span className="block font-mono text-[10px] text-blue-700 font-bold" dir="ltr">
                        {
                          validateAndNormalizePassengerPhone(
                            otherPassengerPhone,
                            otherPassengerCountryCode,
                          ).normalizedPhone
                        }
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 font-bold block">
                        {t("booking_owner")}:
                      </span>
                      <span className="font-black text-gray-800">
                        {user.name}
                      </span>
                      <span className="block font-mono text-[10px] text-gray-500" dir="ltr">
                        {user.phone}
                      </span>
                    </div>
                  </div>
                  {otherPassengerNote.trim() && (
                    <div className="text-[11px] bg-white/80 px-2.5 py-1.5 rounded-xl border border-blue-100">
                      <span className="font-black text-gray-600">
                        {t("driver_notes")}:{" "}
                      </span>
                      <span className="font-bold text-gray-800">
                        {otherPassengerNote}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[10px] font-bold text-gray-600 pt-1 border-t border-blue-200/50">
                    <span className="truncate max-w-[48%]">
                      <i className="fas fa-circle text-[7px] text-emerald-500 mx-1"></i>
                      {pickupAddress || t("current_location")}
                    </span>
                    <span>→</span>
                    <span className="truncate max-w-[48%]">
                      <i className="fas fa-map-marker-alt text-[9px] text-red-500 mx-1"></i>
                      {dropoffAddress}
                    </span>
                  </div>
                </div>
              )}

              <Button
                onClick={() => handleRequestRide()}
                isLoading={isRequesting}
                style={{ borderRadius: "30px" }}
                className="w-full h-14 bg-[#FFC90E] text-gray-900 shadow-xl shadow-yellow-200 rounded-[30px] text-base font-black tracking-tight hover:bg-orange-500 active:scale-95 transition-all"
              >
                {isRequesting
                  ? t("locating")
                  : isScheduling
                    ? t("confirm") + " " + t("schedule_ride")
                    : isRewardEligible && useRewardDiscount && customFare > 0
                      ? `${t("request_now")} (${Math.max(10, customFare - rewardDiscountAmount)} ${t("currency")})`
                      : t("request_now")}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

          {/* FARE BREAKDOWN SHEET */}
          <AnimatePresence>
            {showFareBreakdown && (
              <div
                className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end justify-center p-0 sm:p-4"
                onClick={() => setShowFareBreakdown(false)}
              >
                <motion.div
                  initial={{ opacity: 0, y: 24, scale: 0.92 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.94 }}
                  transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                  className="bg-white w-full max-w-lg rounded-t-[35px] sm:rounded-[32px] p-6 pb-safe shadow-2xl transform-gpu will-change-transform origin-bottom"
                  onClick={(e) => e.stopPropagation()}
                >
                <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6"></div>
                <div className="flex justify-between items-center mb-6 px-1">
                  <h3 className="text-xl font-black text-gray-900">
                    {isRTL ? "تفاصيل التسعيرة" : "Fare Breakdown"}
                  </h3>
                  <button
                    onClick={() => setShowFareBreakdown(false)}
                    className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>

                <div className="space-y-4 mb-8">
                  {priceRanges[selectedVehicleType]?.breakdown ? (
                    <>
                      <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                        <span className="text-sm font-medium text-gray-600">
                          {isRTL ? "بداية العداد" : "Base Fare"}
                        </span>
                        <span className="font-bold text-gray-900">
                          {priceRanges[
                            selectedVehicleType
                          ]!.breakdown.baseFare.toFixed(2)}{" "}
                          {t("currency")}
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                        <span className="text-sm font-medium text-gray-600">
                          {isRTL ? "المسافة المقدرة" : "Distance Fare"}
                        </span>
                        <span className="font-bold text-gray-900">
                          {priceRanges[
                            selectedVehicleType
                          ]!.breakdown.distanceFare.toFixed(2)}{" "}
                          {t("currency")}
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                        <span className="text-sm font-medium text-gray-600">
                          {isRTL ? "الوقت المقدر" : "Time Fare"}
                        </span>
                        <span className="font-bold text-gray-900">
                          {priceRanges[
                            selectedVehicleType
                          ]!.breakdown.timeFare.toFixed(2)}{" "}
                          {t("currency")}
                        </span>
                      </div>
                      {priceRanges[selectedVehicleType]!.breakdown.fees > 0 && (
                        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                          <span className="text-sm font-medium text-gray-600">
                            {isRTL ? "رسوم إضافية" : "Extra Fees"}
                          </span>
                          <span className="font-bold text-gray-900">
                            {priceRanges[
                              selectedVehicleType
                            ]!.breakdown.fees.toFixed(2)}{" "}
                            {t("currency")}
                          </span>
                        </div>
                      )}
                      {priceRanges[selectedVehicleType]!.breakdown.surge >
                        1 && (
                        <div className="flex justify-between items-center border-b border-gray-100 pb-3 text-red-600">
                          <span className="text-sm font-medium">
                            {isRTL ? "عامل أوقات الذروة" : "Surge Multiplier"}
                          </span>
                          <span className="font-bold">
                            x{priceRanges[selectedVehicleType]!.breakdown.surge}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-base font-black text-gray-900">
                          {isRTL ? "الإجمالي المقدر" : "Estimated Total"}
                        </span>
                        <span className="text-lg font-black text-gray-900">
                          {priceRanges[
                            selectedVehicleType
                          ]!.breakdown.total.toFixed(2)}{" "}
                          {t("currency")}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-sm font-medium text-gray-500 py-4">
                      {isRTL ? "غير متوفر" : "Unavailable"}
                    </div>
                  )}
                </div>
                <Button
                  onClick={() => setShowFareBreakdown(false)}
                  className="w-full h-14 bg-gray-100 text-gray-900 rounded-2xl text-base font-black tracking-tight"
                >
                  {t("close")}
                </Button>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* ... (Rest of components CUSTOM DATE & TIME PICKER SHEET, Searching State, etc.) ... */}
          {/* CUSTOM DATE & TIME PICKER SHEET */}
          <AnimatePresence>
            {showScheduleSheet && (
              <div
                className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end justify-center p-0 sm:p-4"
                onClick={() => setShowScheduleSheet(false)}
              >
                <motion.div
                  initial={{ opacity: 0, y: 24, scale: 0.92 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.94 }}
                  transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                  className="bg-white w-full max-w-lg rounded-t-[35px] sm:rounded-[32px] p-6 pb-safe shadow-2xl transform-gpu will-change-transform origin-bottom"
                  onClick={(e) => e.stopPropagation()}
                >
                <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6"></div>
                <div className="flex justify-between items-center mb-6 px-1">
                  <h3 className="text-2xl font-black text-gray-900">
                    {t("schedule_ride")}
                  </h3>
                  <button
                    onClick={() => {
                      setIsScheduling(false);
                      setShowScheduleSheet(false);
                    }}
                    className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>

                {/* Horizontal Date List */}
                <div className="mb-8">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 px-1">
                    {t("pick_time")}
                  </label>
                  <div className="flex gap-3 overflow-x-auto pb-4 hide-scrollbar -mx-1 px-1">
                    {generateDates().map((date, idx) => {
                      const isSelected =
                        selectedDate.toDateString() === date.toDateString();
                      return (
                        <button
                          key={idx}
                          onClick={() => setSelectedDate(date)}
                          className={`min-w-[85px] h-[100px] rounded-[24px] flex flex-col items-center justify-center gap-1 transition-all border-2 active:scale-95 ${
                            isSelected
                              ? "bg-[#FFC90E] border-[#FFC90E] shadow-lg shadow-yellow-100 scale-105"
                              : "bg-gray-50 border-gray-50 text-gray-500"
                          }`}
                        >
                          <span
                            className={`text-[10px] font-black uppercase tracking-tighter ${isSelected ? "text-black/60" : "text-gray-400"}`}
                          >
                            {idx === 0
                              ? isRTL
                                ? "اليوم"
                                : "Today"
                              : idx === 1
                                ? isRTL
                                  ? "غداً"
                                  : "Tomorrow"
                                : dayNames[date.getDay()]}
                          </span>
                          <span
                            className={`text-2xl font-black ${isSelected ? "text-black" : "text-gray-800"}`}
                          >
                            {date.getDate()}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Time Grid Picker */}
                <div className="grid grid-cols-3 gap-6 mb-10">
                  {/* Hours */}
                  <div className="space-y-3">
                    <span className="block text-[9px] font-black text-gray-300 uppercase tracking-widest text-center">
                      HOUR
                    </span>
                    <div className="bg-gray-50 rounded-[28px] p-2 h-[180px] overflow-y-auto hide-scrollbar space-y-2">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => (
                        <button
                          key={h}
                          onClick={() => setSelectedHour(h)}
                          className={`w-full py-3 rounded-2xl font-black transition-all ${selectedHour === h ? "bg-white text-blue-600 shadow-sm scale-110" : "text-gray-400"}`}
                        >
                          {h}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Minutes */}
                  <div className="space-y-3">
                    <span className="block text-[9px] font-black text-gray-300 uppercase tracking-widest text-center">
                      MIN
                    </span>
                    <div className="bg-gray-50 rounded-[28px] p-2 h-[180px] overflow-y-auto hide-scrollbar space-y-2">
                      {[0, 15, 30, 45].map((m) => (
                        <button
                          key={m}
                          onClick={() => setSelectedMinute(m)}
                          className={`w-full py-3 rounded-2xl font-black transition-all ${selectedMinute === m ? "bg-white text-blue-600 shadow-sm scale-110" : "text-gray-400"}`}
                        >
                          {m.toString().padStart(2, "0")}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Period */}
                  <div className="space-y-3">
                    <span className="block text-[9px] font-black text-gray-300 uppercase tracking-widest text-center">
                      AM/PM
                    </span>
                    <div className="bg-gray-50 rounded-[28px] p-2 h-[180px] flex flex-col justify-center gap-4">
                      {["AM", "PM"].map((p) => (
                        <button
                          key={p}
                          onClick={() => setSelectedPeriod(p as any)}
                          className={`w-full py-6 rounded-2xl font-black transition-all ${selectedPeriod === p ? "bg-[#FFC90E] text-black shadow-md scale-105" : "text-gray-400"}`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Recurring Schedule & Passenger Details inside Schedule Sheet */}
                <div className="space-y-3 mb-6 bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-gray-700">
                      {isRTL ? "تكرار الرحلة المجدولة" : "Recurrence Frequency"}
                    </span>
                    <select
                      value={recurringFrequency}
                      onChange={(e) =>
                        setRecurringFrequency(e.target.value as RecurringFrequency)
                      }
                      className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-900"
                    >
                      <option value="ONE_TIME">
                        {isRTL ? "مرة واحدة فقط" : "One-time Ride"}
                      </option>
                      <option value="DAILY">
                        {isRTL ? "يومياً (طوال الأسبوع)" : "Daily"}
                      </option>
                      <option value="SELECTED_WEEKDAYS">
                        {isRTL ? "أيام محددة من الأسبوع" : "Selected Weekdays"}
                      </option>
                      <option value="WEEKLY">
                        {isRTL ? "أسبوعياً في نفس اليوم" : "Weekly"}
                      </option>
                    </select>
                  </div>

                  {recurringFrequency === "SELECTED_WEEKDAYS" && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {[
                        { idx: 0, ar: "الأحد", en: "Sun" },
                        { idx: 1, ar: "الإثنين", en: "Mon" },
                        { idx: 2, ar: "الثلاثاء", en: "Tue" },
                        { idx: 3, ar: "الأربعاء", en: "Wed" },
                        { idx: 4, ar: "الخميس", en: "Thu" },
                        { idx: 5, ar: "الجمعة", en: "Fri" },
                        { idx: 6, ar: "السبت", en: "Sat" },
                      ].map((d) => {
                        const active = recurringWeekdays.includes(d.idx);
                        return (
                          <button
                            key={d.idx}
                            type="button"
                            onClick={() => {
                              if (active && recurringWeekdays.length > 1) {
                                setRecurringWeekdays(
                                  recurringWeekdays.filter((x) => x !== d.idx)
                                );
                              } else if (!active) {
                                setRecurringWeekdays([...recurringWeekdays, d.idx]);
                              }
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                              active
                                ? "bg-blue-600 text-white"
                                : "bg-white border border-gray-200 text-gray-600"
                            }`}
                          >
                            {isRTL ? d.ar : d.en}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {recurringFrequency !== "ONE_TIME" && (
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-[11px] font-bold text-gray-500">
                        {isRTL ? "تاريخ انتهاء التكرار (اختياري)" : "End Date (Optional)"}
                      </span>
                      <input
                        type="date"
                        value={recurringEndDate}
                        onChange={(e) => setRecurringEndDate(e.target.value)}
                        className="px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-xs font-bold"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-1">
                        {isRTL ? "عدد الركاب" : "Passengers"}
                      </label>
                      <select
                        value={
                          selectedVehicleType === VehicleType.MOTO
                            ? 1
                            : scheduledPassengerCount
                        }
                        disabled={selectedVehicleType === VehicleType.MOTO}
                        onChange={(e) =>
                          setScheduledPassengerCount(Number(e.target.value))
                        }
                        className="w-full px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-bold"
                      >
                        {[1, 2, 3, 4].map((n) => (
                          <option key={n} value={n}>
                            {n} {isRTL ? "ركاب" : "pax"}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-1">
                        {isRTL ? "ملاحظة للسائق (اختياري)" : "Note for Driver"}
                      </label>
                      <input
                        type="text"
                        value={scheduledDriverNote}
                        onChange={(e) => setScheduledDriverNote(e.target.value)}
                        placeholder={isRTL ? "مثال: معي حقيبة سفر..." : "e.g., With luggage"}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setIsScheduling(false);
                      setShowScheduleSheet(false);
                    }}
                    className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-bold transition-all active:scale-95"
                  >
                    {t("cancel")}
                  </button>
                  <Button
                    onClick={() => {
                      setIsScheduling(true);
                      setShowScheduleSheet(false);
                    }}
                    className="flex-[2] h-14 bg-blue-600 text-white shadow-xl shadow-blue-200 rounded-2xl font-black transition-all active:scale-95"
                  >
                    {t("confirm")}
                  </Button>
                </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {(rideStatus === RideStatus.SEARCHING ||
              rideStatus === RideStatus.OFFER_RECEIVED) &&
              activeRideData && (
                <motion.div
                  key="searching-state-overlay"
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                  className="fixed inset-0 z-[65] flex flex-col pt-safe pointer-events-none transform-gpu will-change-transform origin-center"
                >
                  {visibleOffers.length > 0 ? (
                    <div className="absolute inset-0 pointer-events-auto z-50">
                      <PassengerOffersScreen
                        offers={visibleOffers}
                        pickupLocation={pickup}
                        onAccept={handleAcceptOffer}
                        onReject={handleRejectOffer}
                        processingOfferId={processingOfferId}
                        t={t}
                        isRTL={isRTL}
                        offerDurationSeconds={12}
                        onCancel={handleCancelRideTrigger}
                      />
                    </div>
                  ) : (
                    <>
                      {/* Transparent pointer-events pass-through layer for crystal clear map visibility */}
                      <div className="absolute inset-0 pointer-events-none z-0"></div>

                      {/* Header Area with Drivers Badge and Trip Details Toggle Icon */}
                      <div className="w-full max-w-lg mx-auto flex flex-col items-center pointer-events-none px-4 mt-4 z-30 shrink-0 relative">
                        <div className="w-full flex items-center justify-between gap-2">
                          {/* Nearby Captains Badge */}
                          <div className="flex-1 min-w-0 flex items-center justify-start">
                            <AnimatePresence mode="wait">
                              {previewDrivers.length > 0 ? (
                                <motion.div
                                  key="preview-drivers-present"
                                  initial={{ opacity: 0, y: -20, scale: 0.9 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: -20, scale: 0.9 }}
                                  className="bg-white/95 backdrop-blur-xl px-3.5 py-1.5 rounded-full shadow-[0_10px_25px_-5px_rgba(0,0,0,0.15)] flex flex-row items-center gap-2.5 border border-gray-100 max-w-full overflow-hidden pointer-events-auto"
                                >
                                  <div className="flex flex-col text-left rtl:text-right shrink-0">
                                    <span className="text-[11px] font-black text-gray-900 leading-none">
                                      {isRTL ? "كباتن بالجوار" : "Nearby Captains"}
                                    </span>
                                    <span className="text-[8px] font-bold text-green-600 mt-0.5 uppercase tracking-widest flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                      {isRTL ? "متاح الان" : "Live now"}
                                    </span>
                                  </div>
                                  <div className="flex -space-x-2.5 rtl:space-x-reverse overflow-hidden px-0.5 relative min-w-[42px]">
                                    <AnimatePresence>
                                      {previewDrivers.slice(0, 4).map((drv, i) => (
                                        <motion.div
                                          key={drv.id}
                                          initial={{ opacity: 0, scale: 0.5, x: 15 }}
                                          animate={{ opacity: 1, scale: 1, x: 0 }}
                                          exit={{ opacity: 0, scale: 0.5, width: 0 }}
                                          transition={{
                                            type: "spring",
                                            stiffness: 300,
                                            damping: 25,
                                            delay: i * 0.05,
                                          }}
                                          className="relative z-10 rounded-full overflow-hidden border-2 border-white shadow-sm bg-gray-100 shrink-0"
                                          style={{ zIndex: previewDrivers.length - i }}
                                        >
                                          <img
                                            src={
                                              drv.avatar ||
                                              `https://ui-avatars.com/api/?name=${encodeURIComponent(drv.name)}&background=random`
                                            }
                                            className="w-7 h-7 object-cover rounded-full"
                                            alt={drv.name}
                                          />
                                        </motion.div>
                                      ))}
                                    </AnimatePresence>
                                  </div>
                                </motion.div>
                              ) : activeRideData.notifiedDriverIds &&
                                activeRideData.notifiedDriverIds.length > 0 ? (
                                <motion.div
                                  key="notified-drivers-fallback"
                                  initial={{ opacity: 0, y: -20 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.9 }}
                                  className="bg-indigo-600 px-3.5 py-1.5 rounded-full shadow-[0_8px_16px_rgba(79,70,229,0.3)] flex items-center gap-2 border border-indigo-500/50 pointer-events-auto"
                                >
                                  <div className="flex flex-col text-white">
                                    <span className="text-[11px] font-black leading-none tracking-tight">
                                      {activeRideData.notifiedDriverIds.length}{" "}
                                      {isRTL ? "كابتن متاح" : "Captains"}
                                    </span>
                                    <span className="text-[8px] font-bold text-indigo-100 mt-0.5">
                                      {isRTL ? "يشاهدون طلبك" : "viewing request"}
                                    </span>
                                  </div>
                                </motion.div>
                              ) : null}
                            </AnimatePresence>
                          </div>

                          {/* Trip Details Toggle Icon Button */}
                          <motion.button
                            whileTap={{ scale: 0.92 }}
                            whileHover={{ scale: 1.04 }}
                            onClick={() => {
                              HapticsService.medium();
                              setShowSearchTripDetails((prev) => !prev);
                            }}
                            className={cn(
                              "pointer-events-auto flex items-center gap-2 px-3.5 py-2 rounded-full shadow-[0_10px_25px_-5px_rgba(0,0,0,0.15)] border transition-all duration-300 shrink-0",
                              showSearchTripDetails
                                ? "bg-gray-900 text-white border-gray-800 shadow-xl"
                                : "bg-white/95 text-gray-800 border-gray-100 hover:bg-white"
                            )}
                            title={
                              showSearchTripDetails
                                ? (isRTL ? "إخفاء التفاصيل" : "Hide Details")
                                : (isRTL ? "عرض تفاصيل الرحلة" : "Trip Details")
                            }
                          >
                            <motion.div
                              animate={{ rotate: showSearchTripDetails ? 90 : 0 }}
                              transition={{ type: "spring", stiffness: 400, damping: 25 }}
                              className="flex items-center justify-center"
                            >
                              {showSearchTripDetails ? (
                                <X className="w-4 h-4 text-white" />
                              ) : (
                                <Info className="w-4 h-4 text-indigo-600" />
                              )}
                            </motion.div>
                            <span className="text-xs font-black tracking-tight select-none">
                              {showSearchTripDetails
                                ? (isRTL ? "إخفاء التفاصيل" : "Hide Details")
                                : (isRTL ? "تفاصيل الرحلة" : "Trip Details")}
                            </span>
                          </motion.button>
                        </div>

                        {/* Animated Trip Details Display with Perfect Animation */}
                        <AnimatePresence>
                          {showSearchTripDetails && (
                            <motion.div
                              key="search-trip-details-panel"
                              initial={{ opacity: 0, y: -15, scale: 0.94 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -15, scale: 0.94 }}
                              transition={{
                                type: "spring",
                                stiffness: 450,
                                damping: 28,
                                mass: 0.75,
                              }}
                              className="pointer-events-auto w-full mt-3.5 z-40 transform-gpu will-change-transform"
                              dir={isRTL ? "rtl" : "ltr"}
                            >
                              <div className="bg-white/95 backdrop-blur-2xl rounded-[28px] p-4 sm:p-5 shadow-[0_20px_50px_rgba(0,0,0,0.22)] border border-gray-100/90 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                                <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

                                {/* Header with Title & Price */}
                                <div className="flex items-center justify-between pb-3.5 border-b border-gray-100 relative z-10">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shadow-sm">
                                      <MapPin className="w-4 h-4 stroke-[2.5]" />
                                    </div>
                                    <div>
                                      <span className="text-[9px] font-black uppercase text-indigo-600 tracking-wider block leading-none mb-1">
                                        {isRTL ? "طلب الرحلة" : "Trip Request"}
                                      </span>
                                      <h4 className="text-sm font-black text-gray-900 leading-none">
                                        {isRTL ? "تفاصيل الوجهة والسعر" : "Destination & Fare"}
                                      </h4>
                                    </div>
                                  </div>

                                  <div className="flex flex-col items-end bg-[#FFC90E]/20 border border-[#FFC90E]/40 rounded-2xl px-3 py-1.5 shadow-sm">
                                    <span className="text-[8px] font-black uppercase tracking-wider text-amber-900 leading-none">
                                      {isRTL ? "السعر المعروض" : "Offered Fare"}
                                    </span>
                                    <div className="flex items-baseline gap-1 mt-0.5">
                                      <span className="text-xl font-black text-gray-900 leading-none">
                                        {activeRideData?.fare || activeRideData?.price || offeredFare || customFare || 0}
                                      </span>
                                      <span className="text-[10px] font-extrabold text-gray-600 uppercase">
                                        {t("currency", "EGP")}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Pickup & Destination Addresses */}
                                <div className="py-3.5 relative z-10 space-y-2.5">
                                  {/* Pickup */}
                                  <div className="flex items-start gap-2.5">
                                    <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0 mt-0.5">
                                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <span className="text-[9px] font-extrabold uppercase text-gray-400 tracking-wider block">
                                        {t("pickup_location", "Pickup Location", "موقع الاستلام")}
                                      </span>
                                      <p className="text-xs font-bold text-gray-800 leading-snug break-words mt-0.5" dir="auto">
                                        {activeRideData?.pickup?.address || pickupAddress || t("current_location")}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Line */}
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-6 flex justify-center">
                                      <div className="w-0.5 h-3 bg-gray-200 rounded-full" />
                                    </div>
                                    <div className="flex-1 border-t border-dashed border-gray-200" />
                                  </div>

                                  {/* Destination */}
                                  <div className="flex items-start gap-2.5">
                                    <div className="w-6 h-6 rounded-full bg-red-50 text-red-600 border border-red-200 flex items-center justify-center shrink-0 mt-0.5">
                                      <MapPin className="w-3.5 h-3.5 text-red-500 fill-red-100" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <span className="text-[9px] font-extrabold uppercase text-red-500 tracking-wider block">
                                        {t("dropoff_location", "Dropoff Location", "نقطة الوصول")}
                                      </span>
                                      <p className="text-xs font-black text-gray-900 leading-snug break-words mt-0.5" dir="auto">
                                        {activeRideData?.dropoff?.address || dropoffAddress || t("pinned_location")}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                {/* Quick Meta Pills */}
                                <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center gap-2 relative z-10">
                                  {distanceKm > 0 && (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 rounded-xl text-gray-700 text-[11px] font-bold border border-gray-100">
                                      <Navigation2 className="w-3 h-3 text-indigo-600" />
                                      <span>{distanceKm.toFixed(1)} {t("km", "km", "كم")}</span>
                                      <span className="text-gray-300">•</span>
                                      <span>~{Math.ceil(distanceKm * 3)} {t("min", "min", "دقيقة")}</span>
                                    </div>
                                  )}

                                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 rounded-xl text-gray-700 text-[11px] font-bold border border-gray-100">
                                    <span className="text-gray-400 font-medium">{t("vehicle_type", "Vehicle Type", "نوع المركبة")}:</span>
                                    <span>
                                      {(() => {
                                        const vt = String(activeRideData?.requestedVehicleType || selectedVehicleType || "STANDARD").toUpperCase();
                                        if (vt === "COMFORT" || vt === "PREMIUM") return t("vehicle_comfort", "Premium", "مريح");
                                        if (vt === "MOTO" || vt === "SCOOTER") return t("vehicle_moto", "Scooter", "سكوتر");
                                        if (vt === "MOTORCYCLE") return t("vehicle_motorcycle", "Motorcycle", "دراجة نارية");
                                        return t("vehicle_standard", "Standard", "عادي");
                                      })()}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 rounded-xl text-gray-700 text-[11px] font-bold border border-gray-100">
                                    <span className="text-gray-400 font-medium">{t("payment_method", "Payment", "الدفع")}:</span>
                                    <span>{activeRideData?.paymentMethod === PaymentMethod.INSTAPAY ? (isRTL ? "انستا باى" : "InstaPay") : t("cash", "Cash", "كاش")}</span>
                                  </div>

                                  {activeRideData?.bookingType === "FOR_OTHER" &&
                                    activeRideData?.actualPassenger && (
                                      <div className="w-full mt-2 p-2.5 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-between gap-2">
                                        <div className="text-xs">
                                          <span className="inline-block px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-black mb-1">
                                            {t("for_other_badge")}
                                          </span>
                                          <div className="font-black text-gray-900">
                                            {t("actual_passenger")}:{" "}
                                            {activeRideData.actualPassenger.name} (
                                            <span dir="ltr">
                                              {activeRideData.actualPassenger.phone}
                                            </span>
                                            )
                                          </div>
                                        </div>
                                        {activeRideData.rideVerificationEnabled &&
                                          getStoredRideVerificationPin(
                                            activeRideData.id,
                                          ) && (
                                            <div className="bg-white px-2.5 py-1.5 rounded-xl border border-blue-200 text-center shrink-0">
                                              <span className="text-[9px] font-black text-gray-500 block">
                                                {t("ride_verification_pin")}
                                              </span>
                                              <span className="font-mono font-black text-sm text-blue-700 tracking-widest">
                                                {getStoredRideVerificationPin(
                                                  activeRideData.id,
                                                )}
                                              </span>
                                            </div>
                                          )}
                                      </div>
                                    )}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Main Content Area - Clean unobstructed live map */}
                      <div className="flex-1 overflow-visible pt-4 p-4 pointer-events-none hide-scrollbar flex flex-col items-center justify-start" />

                      {/* Bottom Control & Offers Sheet */}
                      <div className="fixed bottom-0 left-0 right-0 z-20 pointer-events-none pb-safe px-4 pt-4 flex flex-col justify-end">
                        {/* Red Reservation Time Left Card */}
                        <motion.div
                          key="full-card"
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          transition={{ duration: 0.3 }}
                          className="pointer-events-auto w-full bg-[#FF5C5C] rounded-[32px] p-5 mb-4 shadow-[0_12px_24px_-6px_rgba(255,92,92,0.4)] flex flex-col items-center relative overflow-hidden shrink-0"
                          dir={isRTL ? "rtl" : "ltr"}
                        >
                          <div className="absolute top-[-20%] left-[-10%] w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                          <div className="absolute bottom-[-10%] right-[-10%] w-24 h-24 bg-red-900/10 rounded-full blur-xl"></div>

                          <p className="text-white/90 text-[11px] font-bold uppercase tracking-[0.1em] mb-1 z-10 w-full text-center">
                            {isRTL ? "جاري البحث عن كابتن..." : t("finding_captain_title", "Reservation time left")}
                          </p>
                          <div
                            className="text-white text-3xl font-black tracking-tight mb-2 drop-shadow-sm z-10 w-full text-center tabular-nums"
                            dir="ltr"
                          >
                            {Math.floor(searchCountdown / 60)
                              .toString()
                              .padStart(2, "0")}{" "}
                            <span className="text-white/80">:</span>{" "}
                            {(searchCountdown % 60).toString().padStart(2, "0")}{" "}
                            <span className="text-base font-bold text-white/80">
                              mins
                            </span>
                          </div>

                          {/* Current Offered Price Display with +/- Adjuster & Confirm */}
                          <div className="w-full mb-3 z-10 flex flex-col gap-2">
                            <div className="flex items-center justify-between w-full px-3.5 py-2 bg-black/15 rounded-2xl gap-2">
                              <span className="text-white/95 text-xs font-bold shrink-0">
                                {isRTL ? "سعر الرحلة المعروض:" : "Offered fare:"}
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleAdjustSearchFare(-searchFareStep)}
                                  disabled={
                                    isUpdatingSearchFare ||
                                    (draftSearchFare || committedSearchFare) <= searchMinFare
                                  }
                                  aria-label={isRTL ? "تقليل السعر" : "Decrease fare"}
                                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 active:scale-90 flex items-center justify-center text-white transition-all disabled:opacity-35 disabled:pointer-events-none shadow-sm"
                                >
                                  <Minus className="w-4 h-4 stroke-[2.75]" />
                                </button>
                                <span className="text-white font-black text-sm min-w-[68px] text-center tabular-nums">
                                  {draftSearchFare || committedSearchFare} {t("currency", "EGP")}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleAdjustSearchFare(searchFareStep)}
                                  disabled={isUpdatingSearchFare}
                                  aria-label={isRTL ? "زيادة السعر" : "Increase fare"}
                                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 active:scale-90 flex items-center justify-center text-white transition-all disabled:opacity-35 disabled:pointer-events-none shadow-sm"
                                >
                                  <Plus className="w-4 h-4 stroke-[2.75]" />
                                </button>
                              </div>
                            </div>

                            <AnimatePresence>
                              {draftSearchFare > 0 && draftSearchFare !== committedSearchFare && (
                                <motion.button
                                  key="confirm-search-fare-btn"
                                  type="button"
                                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                                  transition={{ duration: 0.18 }}
                                  onClick={handleConfirmSearchFareUpdate}
                                  disabled={isUpdatingSearchFare}
                                  className="w-full py-2.5 px-4 bg-white hover:bg-white/95 active:scale-[0.98] text-[#D93838] rounded-2xl font-black text-xs shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-70"
                                >
                                  {isUpdatingSearchFare ? (
                                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                                  ) : (
                                    <Check className="w-4 h-4 stroke-[3] shrink-0" />
                                  )}
                                  <span>
                                    {isRTL
                                      ? `تأكيد السعر الجديد (${draftSearchFare} ${t("currency", "ج.م")})`
                                      : `Confirm New Fare (${draftSearchFare} ${t("currency", "EGP")})`}
                                  </span>
                                </motion.button>
                              )}
                            </AnimatePresence>

                            <AnimatePresence>
                              {searchFareUpdateStatus && (
                                <motion.div
                                  key="fare-updated-toast"
                                  initial={{ opacity: 0, y: -4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -4 }}
                                  className="w-full bg-emerald-400 text-emerald-950 px-3.5 py-2 rounded-2xl flex items-center gap-2 shadow-md font-extrabold text-xs"
                                >
                                  <Check className="w-4 h-4 text-emerald-900 shrink-0 stroke-[3]" />
                                  <span className="flex-1 leading-snug">
                                    {searchFareUpdateStatus.message}
                                  </span>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          {/* Price Boost Notice at 50s */}
                          {priceBoostNotice && (
                            <motion.div
                              initial={{ opacity: 0, y: -6, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              className="w-full bg-amber-400 text-amber-950 px-3.5 py-2 rounded-2xl mb-3 flex items-center gap-2 shadow-md font-extrabold text-xs z-10 text-right rtl:text-right ltr:text-left"
                            >
                              <Zap className="w-4 h-4 text-amber-900 shrink-0 animate-bounce" />
                              <span className="flex-1 leading-snug">{priceBoostNotice}</span>
                            </motion.div>
                          )}

                          {/* Swipe to cancel */}
                          <div
                            className="w-full bg-white rounded-full p-1.5 flex relative items-center shadow-inner group z-10 h-[60px] overflow-hidden"
                            dir={isRTL ? "rtl" : "ltr"}
                          >
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                              <span className="text-gray-900 font-extrabold text-[15px] opacity-80">
                                {t("cancel_ride", "Swipe to cancel")}
                              </span>
                            </div>

                            {/* Draggable handle */}
                            <motion.div
                              drag="x"
                              dragConstraints={{
                                left: isRTL ? -260 : 0,
                                right: isRTL ? 0 : 260,
                              }}
                              dragElastic={0.1}
                              dragSnapToOrigin
                              onDragEnd={(_, info) => {
                                if (Math.abs(info.offset.x) > 150)
                                  handleCancelRideTrigger();
                              }}
                              className="w-[48px] h-[48px] bg-[#FF6B6B] rounded-full flex items-center justify-center cursor-pointer shadow-md z-20 transition-transform active:scale-95 shrink-0"
                            >
                              <ChevronRight
                                className={cn(
                                  "text-white w-6 h-6 block transition-transform",
                                  isRTL && "rotate-180",
                                )}
                              />
                            </motion.div>
                          </div>
                        </motion.div>

                        {/* Finding Captain Indicator Bar */}
                        <div className="pointer-events-auto w-full mb-3 flex flex-col shadow-[0_8px_30px_rgba(0,0,0,0.1)] min-h-[76px] rounded-[32px] overflow-hidden bg-[#11bc69] border border-[#11bc69] ring-2 ring-white">
                          <div className="flex items-center justify-center p-6 gap-3">
                            <Loader2 className="w-6 h-6 text-white animate-spin" />
                            <span className="text-white font-bold text-[17px] tracking-tight">
                              {t("finding_captain", "Finding your captain...")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
            )}
          </AnimatePresence>

          {activeRideData && assignedDriver && showInstaPaySheet && (
            <InstaPayPaymentSheet
              ride={activeRideData}
              driver={assignedDriver}
              onConfirm={async () => {
                await initiateInstapayPayment(activeRideData.id);
                // Not closing immediately to show pending state if needed
              }}
              onClose={() => setShowInstaPaySheet(false)}
              onHelp={() =>
                onNavigate("SUPPORT")
              }
            />
          )}

          <AnimatePresence>
            {isTripActive && activeRideData && assignedDriver && (
              <motion.div
                key="trip-progress-card"
                initial={{ y: 28, scale: 0.92, opacity: 0 }}
                animate={{ y: 0, scale: 1, opacity: 1 }}
                exit={{ y: 24, scale: 0.94, opacity: 0 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                className="fixed bottom-0 left-0 right-0 z-50 glass-panel rounded-t-[40px] shadow-2xl px-6 pt-6 pb-[10px] pb-safe transform-gpu will-change-transform origin-bottom"
              >
                <div className="w-12 h-1.5 bg-gray-300/50 rounded-full mx-auto mb-6"></div>

                {/* Payment Status Bar */}
                {activeRideData.status === RideStatus.IN_PROGRESS &&
                  appSettings?.isInstaPayEnabled && (
                    <div className="mb-4 flex gap-2">
                      <button
                        onClick={() => {
                          openNavigation(
                            `${activeRideData.dropoff.coords.lat},${activeRideData.dropoff.coords.lng}`,
                          );
                        }}
                        className="w-full py-3 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-blue-200"
                      >
                        {t("navigate")}
                      </button>
                      <button
                        onClick={() => setShowInstaPaySheet(true)}
                        className="flex-1 h-12 bg-gray-50 rounded-2xl flex items-center justify-center gap-3 border border-gray-100 active:scale-95 transition-transform"
                      >
                        <img
                          src="https://img.icons8.com/color/48/bank-transfer.png"
                          alt="InstaPay"
                          className="w-5 h-5"
                        />
                        <span className="text-xs font-black text-gray-900 uppercase">
                          {activeRideData.paymentStatus ===
                          PaymentStatus.AWAITING_CONFIRMATION
                            ? (isRTL ? "في انتظار التأكيد" : "Pending Confirmation")
                            : (isRTL ? "ادفع عبر انستا باى" : "Pay via InstaPay")}
                        </span>
                      </button>
                      {activeRideData.paymentStatus ===
                        PaymentStatus.AWAITING_CONFIRMATION && (
                        <div className="w-12 h-12 bg-yellow-400 rounded-2xl flex items-center justify-center animate-pulse">
                          <Clock className="w-5 h-5 text-black" />
                        </div>
                      )}
                    </div>
                  )}

                <div className="flex flex-col mb-4">
                  <div className="flex items-center justify-between pb-2">
                    <div
                      className="flex items-center gap-3 flex-1 overflow-hidden"
                      onClick={() =>
                        setIsDriverDetailsExpanded(!isDriverDetailsExpanded)
                      }
                      role="button"
                    >
                      <div className="relative flex-shrink-0 flex items-center">
                        {assignedDriver.vehicleImageUrl && (
                          <div className="w-14 h-11 rtl:-ml-4 ltr:-mr-4 rounded-xl overflow-hidden shadow-sm border-2 border-gray-100 z-0 relative">
                            <img
                              src={assignedDriver.vehicleImageUrl}
                              className="w-full h-full object-cover"
                              alt="Car"
                            />
                            <div className="absolute inset-0 bg-black/5"></div>
                          </div>
                        )}
                        <div className="relative z-10 w-16 h-16">
                          <img
                            src={assignedDriver.avatar}
                            className="w-full h-full rounded-full object-cover border-4 border-white shadow-md bg-white relative z-10"
                            alt="Captain"
                          />
                          <div className="absolute -bottom-1 rtl:-right-1 ltr:-right-1 w-6 h-6 bg-[#FFC90E] rounded-full flex items-center justify-center border-2 border-white shadow-sm z-20">
                            <i className="fas fa-star text-[8px] text-black"></i>
                          </div>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-black text-gray-900 text-lg leading-none truncate">
                            {assignedDriver.name}
                          </h3>
                          {assignedDriver.isVerified && (
                            <i className="fas fa-check-circle text-blue-500 text-sm flex-shrink-0"></i>
                          )}
                        </div>
                        <div className="text-[9px] font-bold text-yellow-900 bg-[#FFC90E] px-1.5 py-0.5 rounded max-w-full w-fit mt-1 flex items-center gap-1 shadow-sm overflow-hidden">
                          <span className="truncate">
                            {assignedDriver.vehicleBrand}{" "}
                            {assignedDriver.vehicleModel}
                          </span>
                          <span className="opacity-50 shrink-0">•</span>
                          <span className="font-mono uppercase tracking-tighter bg-white/50 px-1 rounded shrink-0 leading-none py-0.5">
                            {assignedDriver.vehiclePlate}
                          </span>
                          <i
                            className={`fas fa-chevron-${isDriverDetailsExpanded ? "up" : "down"} text-[7px] ml-0.5 opacity-70 shrink-0`}
                          ></i>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md font-black uppercase tracking-tighter shadow-sm flex-shrink-0">
                            {assignedDriver.rating?.toFixed(1) || "5.0"}
                          </span>
                          {driverEta && (
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest whitespace-nowrap">
                              {t("driver_eta_label")} {driverEta}
                            </span>
                          )}
                          {activeRideData.fare && (
                            <span className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-md font-black uppercase tracking-tighter shadow-sm whitespace-nowrap">
                              {Math.round(activeRideData.fare)}{" "}
                              {isRTL ? "ج.م" : "EGP"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <a
                        href={`tel:${assignedDriver.phone}`}
                        className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center text-green-600 shadow-sm border border-green-100 hover:bg-green-100 active:scale-90 transition-all"
                      >
                        <i className="fas fa-phone"></i>
                      </a>
                      <button
                        onClick={() => {
                          setIsChatOpen(true);
                          setHasUnreadMessages(false);
                        }}
                        className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 shadow-sm border border-blue-100 hover:bg-blue-100 active:scale-90 transition-all relative"
                      >
                        <i className="fas fa-comment-dots"></i>
                        {hasUnreadMessages && (
                          <div className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></div>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Driver Details */}
                  <AnimatePresence>
                    {isDriverDetailsExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-4 border-t border-gray-100 mt-2 flex flex-col gap-3">
                          {assignedDriver.vehicleImageUrl && (
                            <div className="w-full h-32 rounded-xl overflow-hidden relative shadow-sm border border-gray-100">
                              <img
                                src={assignedDriver.vehicleImageUrl}
                                className="w-full h-full object-cover"
                                alt="Car Full"
                              />
                              <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md">
                                {assignedDriver.vehicleBrand}{" "}
                                {assignedDriver.vehicleColor}
                              </div>
                            </div>
                          )}
                          <div className="bg-[#FFC90E] rounded-xl p-3 flex items-center justify-center gap-2 border border-yellow-400 text-yellow-900 shadow-sm w-fit mx-auto min-w-[200px]">
                            <span className="font-bold text-[11px] uppercase tracking-wide truncate">
                              {assignedDriver.vehicleBrand}{" "}
                              {assignedDriver.vehicleModel} (
                              {assignedDriver.vehicleYear || "-"})
                            </span>
                            <span className="text-[10px] opacity-70">•</span>
                            <span className="font-mono text-[11px] font-black uppercase tracking-tighter bg-white/50 px-1.5 py-0.5 rounded">
                              {assignedDriver.vehiclePlate}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                {/* FOR_OTHER PASSENGER BANNER + PIN + SHARE LINK */}
                {activeRideData.bookingType === "FOR_OTHER" &&
                  activeRideData.actualPassenger && (
                    <div className="mb-3 p-3 rounded-2xl bg-blue-50/90 border border-blue-200 flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-black">
                              {t("for_other_badge")}
                            </span>
                            <span className="text-xs font-black text-gray-900 truncate">
                              {t("actual_passenger")}:{" "}
                              {activeRideData.actualPassenger.name}
                            </span>
                          </div>
                          <div
                            className="text-[11px] font-bold text-gray-500 mt-0.5"
                            dir="ltr"
                          >
                            {activeRideData.actualPassenger.phone}
                          </div>
                        </div>

                        {activeRideData.rideVerificationEnabled &&
                          getStoredRideVerificationPin(activeRideData.id) && (
                            <div className="bg-white px-3 py-1 rounded-xl border border-blue-200 text-center shrink-0 shadow-2xs">
                              <span className="text-[9px] font-black text-gray-500 block">
                                {t("ride_verification_pin")}
                              </span>
                              <span className="font-mono font-black text-base text-blue-700 tracking-widest">
                                {getStoredRideVerificationPin(activeRideData.id)}
                              </span>
                            </div>
                          )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowShareSheet(true)}
                        className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center justify-center gap-2 shadow-xs transition-all active:scale-98"
                      >
                        <i className="fas fa-share-alt"></i>
                        <span>{t("share_trip_tracking")}</span>
                      </button>
                    </div>
                  )}

                <TripProgressRoadmap status={rideStatus} isRTL={isRTL} />
                <div className="flex gap-3 mt-4 mb-2">
                  <button
                    onClick={handleCancelRideTrigger}
                    className="flex-1 h-14 !bg-[#e8491d] text-white font-black rounded-[30px] text-[19px] transition-all hover:!bg-[#d13f18] shadow-lg shadow-red-200"
                  >
                    {t("cancel_ride")}
                  </button>
                  <button
                    onClick={() => {
                      const drvLoc = effectiveAssignedDriverLoc;
                      if (drvLoc) {
                        let destStr = `destination=${drvLoc.lat},${drvLoc.lng}`;
                        if (rideStatus === RideStatus.IN_PROGRESS && dropoff) {
                          destStr = `origin=${drvLoc.lat},${drvLoc.lng}&destination=${dropoff.lat},${dropoff.lng}`;
                        } else if (pickup) {
                          destStr = `origin=${drvLoc.lat},${drvLoc.lng}&destination=${pickup.lat},${pickup.lng}`;
                        }
                        openNavigation(destStr);
                      }
                    }}
                    className="w-14 h-14 bg-blue-50 text-blue-600 flex items-center justify-center rounded-[30px] active:scale-95 transition-all shadow-sm border border-blue-100"
                  >
                    <i className="fas fa-map-marked-alt text-xl"></i>
                  </button>
                  <button
                    onClick={() => setShowShareSheet(true)}
                    className="w-14 h-14 bg-indigo-50 text-indigo-600 flex items-center justify-center rounded-[30px] active:scale-95 transition-all shadow-sm border border-indigo-100"
                  >
                    <i className="fas fa-share-alt text-xl"></i>
                  </button>
                  <button
                    onClick={() => setShowMoreActions(true)}
                    className="w-14 h-14 bg-gray-100 text-gray-700 flex items-center justify-center rounded-[30px] active:scale-95 transition-all"
                  >
                    <i className="fas fa-ellipsis-h text-xl"></i>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {showCancelConfirmation && (
            <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-md flex items-end justify-center">
              {" "}
              <div
                className="bg-white w-full rounded-t-[35px] p-6 pb-safe animate-slide-up shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                {" "}
                <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6 opacity-50"></div>{" "}
                <h3 className="text-xl font-black text-gray-900 mb-6 text-right rtl:text-right ltr:text-left px-2">
                  {t("cancel_reason_title")}
                </h3>{" "}
                <div className="space-y-3 mb-8">
                  {" "}
                  {[
                    t("reason_changed_mind"),
                    t("reason_driver_far"),
                    t("reason_long_wait"),
                    t("reason_other"),
                  ].map((reason) => (
                    <button
                      key={reason}
                      onClick={() => setCancellationReason(reason)}
                      className={`w-full p-4 rounded-2xl text-right rtl:text-right ltr:text-left font-bold transition-all text-sm ${cancellationReason === reason ? "bg-red-50 text-red-600 border border-red-200 shadow-sm" : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-transparent"}`}
                    >
                      {reason}
                    </button>
                  ))}{" "}
                </div>{" "}
                <div className="flex gap-3 pb-4">
                  <button
                    onClick={confirmCancelRide}
                    disabled={!cancellationReason}
                    className="flex-1 h-14 rounded-2xl font-black text-[19px] text-white !bg-[#e8491d] hover:!bg-[#d13f18] transition-all active:scale-95 disabled:opacity-50 disabled:grayscale shadow-lg shadow-red-100"
                  >
                    {t("cancel_submit")}
                  </button>
                  <button
                    onClick={() => setShowCancelConfirmation(false)}
                    className="flex-1 h-14 rounded-2xl font-black text-sm text-white bg-gray-900 shadow-xl shadow-gray-200 hover:bg-gray-800 transition-all active:scale-95"
                  >
                    {t("cancel_keep")}
                  </button>
                </div>{" "}
              </div>{" "}
            </div>
          )}

          {/* Search Timeout Dialog (2 Minutes Reached) */}
          <AnimatePresence>
            {showSearchTimeoutModal && (
              <div 
                className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-md flex items-end justify-center p-0"
                dir={isRTL ? "rtl" : "ltr"}
              >
                <motion.div
                  initial={{ y: "100%", opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: "100%", opacity: 0 }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  className="bg-white w-full rounded-t-[36px] p-6 pb-safe shadow-2xl max-w-md mx-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-5 opacity-60"></div>
                  
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200 shadow-sm">
                      <Clock className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-gray-900 leading-tight">
                        {isRTL ? "لم يتم العثور على كابتن بعد" : "No Captain Found Yet"}
                      </h3>
                      <p className="text-xs font-semibold text-gray-500 mt-0.5">
                        {isRTL 
                          ? "انتهت مهلة الدقيقتين. يمكنك متابعة البحث أو بدء بحث جديد أو إلغاء الطلب."
                          : "2 minutes have elapsed. You can continue searching, start a new search, or cancel."}
                      </p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-3.5 mb-5 border border-gray-100 flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-bold">
                      {isRTL ? "السعر الحالي للطلب:" : "Current Request Fare:"}
                    </span>
                    <span className="text-gray-900 font-black text-sm">
                      {activeRideData?.fare || activeRideData?.price || offeredFare || customFare || 0} {t("currency", "EGP")}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {/* Option 1: Continue Search */}
                    <button
                      onClick={handleContinueSearch}
                      className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all"
                    >
                      <RotateCw className="w-4 h-4" />
                      <span>{isRTL ? "متابعة البحث (+2 دقيقة)" : "Continue Searching (+2 mins)"}</span>
                    </button>

                    {/* Option 2: New Search */}
                    <button
                      onClick={handleNewSearch}
                      className="w-full py-3.5 px-4 bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
                    >
                      <Search className="w-4 h-4" />
                      <span>{isRTL ? "بحث جديد مع تعديل السعر" : "New Search & Adjust Fare"}</span>
                    </button>

                    {/* Option 3: Cancel Request */}
                    <button
                      onClick={handleCancelSearchFromTimeout}
                      className="w-full py-3 px-4 bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-700 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all border border-gray-200/80"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>{isRTL ? "إلغاء الطلب" : "Cancel Request"}</span>
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {showRatingModal && assignedDriver && activeRideData && (
            <div className="fixed inset-0 z-[160] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
              <div className="bg-white w-full max-sm rounded-[32px] p-6 text-center relative overflow-hidden animate-bounce-short shadow-2xl max-h-[90vh] overflow-y-auto">
                <h2 className="text-2xl font-black mb-6 uppercase italic text-gray-900 border-b pb-4 border-gray-100">
                  {t("trip_completed")}
                </h2>

                <div className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl mb-6 border border-gray-100 shadow-sm">
                  <div className="flex flex-col items-center flex-1 border-r rtl:border-l rtl:border-r-0 border-gray-200">
                    <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">
                      {t("distance", "Distance", "المسافة")}
                    </span>
                    <span className="font-mono font-black text-lg text-gray-900 whitespace-nowrap">
                      {activeRideData.distanceText || "-"}
                    </span>
                  </div>
                  <div className="flex flex-col items-center flex-1 border-r rtl:border-l rtl:border-r-0 border-gray-200">
                    <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">
                      {t("duration", "Duration", "المدة")}
                    </span>
                    <span className="font-sans font-black text-lg text-gray-900 whitespace-nowrap">
                      {activeRideData.durationText || "-"}
                    </span>
                  </div>
                  <div className="flex flex-col items-center flex-1">
                    <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">
                      {t("fare", "Fare", "الأجرة")}
                    </span>
                    <span className="font-sans font-black text-lg text-green-600 whitespace-nowrap">
                      {Math.round(activeRideData.fare || 0)}{" "}
                      <span className="text-xs">{isRTL ? "ج.م" : "EGP"}</span>
                    </span>
                  </div>
                </div>

                <div className="w-20 h-20 mx-auto mb-3 relative">
                  <img
                    src={assignedDriver.avatar}
                    className="w-full h-full object-cover rounded-full border-4 border-white shadow-lg"
                    alt="Driver"
                  />
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-[#FFC90E] rounded-full flex items-center justify-center border-4 border-white shadow-md">
                    <i className="fas fa-star text-[10px] text-black"></i>
                  </div>
                </div>
                <h2 className="text-lg font-black mb-1">
                  {t("rate_captain")} {assignedDriver.name.split(" ")[0]}?
                </h2>
                <p className="text-gray-400 text-[11px] font-bold mb-4 uppercase tracking-widest">
                  {t("how_was_ride")}
                </p>
                <div className="flex justify-center text-4xl text-gray-200 mb-6">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <i
                      key={s}
                      onClick={() => setTripRating(s)}
                      className={`fas fa-star cursor-pointer transition-all ${tripRating >= s ? "text-[#FFC90E]" : ""}`}
                    ></i>
                  ))}
                </div>
                <textarea
                  value={tripComment}
                  onChange={(e) => setTripComment(e.target.value)}
                  className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 mb-6 outline-none focus:border-[#FFC90E]"
                  placeholder={t("comment_placeholder")}
                  rows={2}
                ></textarea>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleRateDriver}
                    className="w-full h-14 bg-[#FFC90E] text-black font-black rounded-2xl shadow-lg active:scale-95 transition-all"
                  >
                    {t("submit_review")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {showMotoWarning && (
            <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
              <div className="bg-white w-full max-w-sm rounded-[32px] p-8 text-center shadow-2xl animate-bounce-short">
                <div className="w-20 h-20 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <i className="fas fa-motorcycle text-[#FFC90E] text-4xl"></i>
                </div>
                <h3 className="text-xl font-black text-gray-900 mb-3">
                  {t("moto_distance_warning_title")}
                </h3>
                <p className="text-gray-500 text-sm font-bold leading-relaxed mb-8">
                  {t("moto_distance_warning_body")}
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      setMotoWarningAccepted(true);
                      setShowMotoWarning(false);
                      setSelectedVehicleType(VehicleType.MOTO);
                    }}
                    className="w-full py-4 bg-[#FFC90E] text-gray-900 rounded-2xl font-black text-base shadow-lg shadow-yellow-100 active:scale-[0.98] transition-all"
                  >
                    {t("continue_anyway")}
                  </button>
                  <button
                    onClick={() => setShowMotoWarning(false)}
                    className="w-full py-4 bg-gray-100 text-gray-600 rounded-2xl font-black text-base active:scale-[0.98] transition-all"
                  >
                    {t("cancel")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {showAirportInfo && (
            <div className="fixed inset-0 z-[210] bg-black/60 backdrop-blur-md flex items-end justify-center">
              <div
                className="bg-white w-full rounded-t-[40px] p-8 pb-safe animate-slide-up shadow-2xl relative overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Decorative Pattern */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>

                <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-8 opacity-50"></div>

                <div className="w-20 h-20 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-yellow-100">
                  <Plane className="text-[#FFC90E] w-10 h-10" />
                </div>

                <h3 className="text-2xl font-black text-gray-900 mb-3 text-center">
                  {isRTL ? "تطبيق رسوم المطار" : "Airport Fee Applied"}
                </h3>

                <div className="bg-gray-50 rounded-2xl p-6 mb-8 border border-gray-100">
                  <p className="text-gray-600 text-center font-bold leading-relaxed">
                    {isRTL
                      ? `تتضمن هذه الرحلة رسوم دخول إضافية للمطار بقيمة ${pricingConfig?.airportFee || 30} ج.م.`
                      : `This trip includes an additional airport access fee of ${pricingConfig?.airportFee || 30} EGP.`}
                  </p>
                  <div className="mt-4 pt-4 border-t border-gray-200/50">
                    <p className="text-[11px] text-gray-400 text-center font-bold uppercase tracking-wider">
                      {isRTL
                        ? "يتم إضافة الرسوم تلقائياً لمواقع الاستلام أو التوصيل الخاصة بالمطار."
                        : "The fee is added automatically for airport pickup or drop-off locations."}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => setShowAirportInfo(false)}
                    className="w-full py-5 bg-[#FFC90E] text-gray-900 rounded-2xl font-black text-lg shadow-xl shadow-yellow-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:bg-[#e6b50d]"
                  >
                    <span>{isRTL ? "موافق" : "OK"}</span>
                    <ChevronRight
                      className={`w-5 h-5 ${isRTL ? "rotate-180" : ""}`}
                    />
                  </button>
                  <button
                    onClick={() => setShowAirportInfo(false)}
                    className="w-full py-4 text-gray-500 font-black text-sm uppercase tracking-widest hover:text-gray-700 transition-colors"
                  >
                    {isRTL ? "متابعة الحجز" : "Continue Booking"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {showMoreActions && (
            <div
              className="fixed inset-0 z-[120] bg-black/50 flex items-end"
              onClick={() => setShowMoreActions(false)}
            >
              {" "}
              <div
                className="bg-white w-full rounded-t-2xl p-4 pb-safe animate-slide-up"
                onClick={(e) => e.stopPropagation()}
              >
                {" "}
                <div className="w-10 h-1.5 bg-gray-200 rounded-full mx-auto mb-4"></div>{" "}
                <div className="space-y-2">
                  {" "}
                  <ModalActionItem
                    icon="fa-id-card"
                    label={t("driver_details")}
                    onClick={() => {
                      setShowMoreActions(false);
                      setShowDriverDetailsModal(true);
                    }}
                  />{" "}
                  <ModalActionItem
                    icon="fa-users"
                    label={t("safety_contacts")}
                    onClick={() => {
                      setShowMoreActions(false);
                      setShowSafetyContactsModal(true);
                    }}
                  />{" "}
                  <ModalActionItem
                    icon="fa-exclamation-triangle"
                    label={t("report_issue")}
                    onClick={() => {
                      setShowMoreActions(false);
                      if (currentRideId) {
                        setSupportRideId(currentRideId);
                        onNavigate("SUPPORT");
                      }
                    }}
                  />{" "}
                </div>{" "}
              </div>{" "}
            </div>
          )}
          {showDriverDetailsModal && assignedDriver && (
            <div
              className="fixed inset-0 z-[120] bg-black/50 flex items-center justify-center p-4"
              onClick={() => setShowDriverDetailsModal(false)}
            >
              {" "}
              <div
                className="bg-white w-full max-sm rounded-3xl p-6 animate-fade-in-up"
                onClick={(e) => e.stopPropagation()}
              >
                {" "}
                <h2 className="text-xl font-bold text-center mb-4">
                  {t("driver_details")}
                </h2>{" "}
                <div className="flex flex-col items-center mb-4">
                  {" "}
                  <img
                    src={assignedDriver.avatar}
                    className="w-20 h-20 rounded-full border-4 border-white shadow-lg mb-2"
                  />{" "}
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    {assignedDriver.name}
                    {(assignedDriver.isVerified ||
                      assignedDriver.status === "approved") && (
                      <i className="fas fa-check-circle text-blue-500 text-sm"></i>
                    )}
                  </h3>{" "}
                  <div className="text-sm text-gray-500">
                    {t("total_rides_count")}:{" "}
                    {assignedDriver.totalRides || "N/A"}
                  </div>{" "}
                </div>{" "}
                <div className="space-y-3">
                  {" "}
                  <InfoRow
                    label={t("vehicle_car")}
                    value={`${assignedDriver.vehicleBrand} ${assignedDriver.vehicleModel}`}
                  />{" "}
                  <InfoRow
                    label={t("color_label")}
                    value={assignedDriver.vehicleColor}
                  />{" "}
                  <InfoRow
                    label={t("plate_label")}
                    value={assignedDriver.vehiclePlate}
                    isMono
                  />{" "}
                  <InfoRow
                    label={isRTL ? "كابتن موثق" : "Verified Captain"}
                    value={isRTL ? "نعم" : "Yes"}
                    valueColor="text-blue-600 font-bold"
                  />{" "}
                  <InfoRow
                    label={t("legal_record_title")}
                    value={
                      assignedDriver.hasCriminalRecord === true
                        ? t("yes")
                        : t("no")
                    }
                    valueColor={
                      assignedDriver.hasCriminalRecord === true
                        ? "text-red-500 font-bold"
                        : "text-green-600 font-bold"
                    }
                  />{" "}
                </div>{" "}
                <button
                  onClick={() => setShowDriverDetailsModal(false)}
                  className="mt-6 w-full py-3 bg-gray-100 rounded-xl font-bold"
                >
                  {t("close")}
                </button>{" "}
              </div>{" "}
            </div>
          )}
          {showSafetyContactsModal && (
            <div
              className="fixed inset-0 z-[120] bg-black/50 flex items-center justify-center p-4"
              onClick={() => setShowSafetyContactsModal(false)}
            >
              {" "}
              <div
                className="bg-white w-full max-sm rounded-3xl p-6 animate-fade-in-up"
                onClick={(e) => e.stopPropagation()}
              >
                {" "}
                <h2 className="text-xl font-bold text-center mb-4">
                  {t("safety_contacts")}
                </h2>{" "}
                <div className="space-y-3">
                  {" "}
                  {user.safetyContacts && user.safetyContacts.length > 0 ? (
                    user.safetyContacts.map((contact) => (
                      <a
                        href={`tel:${contact.phone}`}
                        key={contact.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100"
                      >
                        {" "}
                        <div>
                          <div className="font-bold">{contact.name}</div>
                          <div className="text-sm text-gray-500">
                            {contact.phone}
                          </div>
                        </div>{" "}
                        <div className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                          <i className="fas fa-phone"></i>
                        </div>{" "}
                      </a>
                    ))
                  ) : (
                    <p className="text-center text-gray-500 py-4">
                      {t("no_safety_contacts")}
                    </p>
                  )}{" "}
                </div>{" "}
                <button
                  onClick={() => setShowSafetyContactsModal(false)}
                  className="mt-6 w-full py-3 bg-gray-100 rounded-xl font-bold"
                >
                  {t("close")}
                </button>{" "}
              </div>{" "}
            </div>
          )}

          {/* Modern Live Share Safety Sheet */}
          {showShareSheet && (
            <div
              className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-end"
              onClick={() => setShowShareSheet(false)}
            >
              <div
                className="bg-white w-full rounded-t-[32px] p-6 pb-safe animate-slide-up shadow-2xl relative"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6"></div>

                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-md">
                    <i className="fas fa-shield-alt text-2xl text-blue-600"></i>
                  </div>
                  <h2 className="text-2xl font-black text-gray-900 mb-2">
                    {isRTL ? "المشاركة المباشرة للأمان" : "Live Safety Sharing"}
                  </h2>
                  <p className="text-sm text-gray-500 font-bold max-w-[260px] mx-auto leading-relaxed">
                    {isRTL
                      ? "شارك مسار رحلتك المباشر مع عائلتك أو أرسله للكابتن لسهولة الوصول."
                      : "Share your live ride tracking for enhanced safety and easier pickups."}
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Option 0: Share directly with Actual Passenger via WhatsApp if FOR_OTHER */}
                  {activeRideData?.bookingType === "FOR_OTHER" &&
                    activeRideData?.actualPassenger?.phone && (
                      <button
                        onClick={() => {
                          setShowShareSheet(false);
                          const tokenQuery = activeRideData?.trackingToken
                            ? `?token=${encodeURIComponent(activeRideData.trackingToken)}`
                            : "";
                          const url = `${window.location.origin}/live/${currentRideId}${tokenQuery}`;
                          const storedPin = getStoredRideVerificationPin(
                            currentRideId || "",
                          );
                          const pinLine = storedPin
                            ? isRTL
                              ? `\nكود أمان بدء الرحلة مع الكابتن: ${storedPin}`
                              : `\nRide Start Verification PIN: ${storedPin}`
                            : "";
                          const driverLine = assignedDriver
                            ? isRTL
                              ? `\nالكابتن: ${assignedDriver.name} (${assignedDriver.vehicleBrand || ""} ${assignedDriver.vehicleModel || ""} - ${assignedDriver.vehiclePlate || ""})`
                              : `\nCaptain: ${assignedDriver.name} (${assignedDriver.vehicleBrand || ""} ${assignedDriver.vehicleModel || ""} - ${assignedDriver.vehiclePlate || ""})`
                            : "";
                          const msg = isRTL
                            ? `مرحباً ${activeRideData.actualPassenger.name}، قمت بحجز رحلة مواصلة لك.${driverLine}${pinLine}\nيمكنك متابعة موقع الكابتن والرحلة مباشرة بدون حساب عبر الرابط:\n${url}`
                            : `Hello ${activeRideData.actualPassenger.name}, I booked a Mowasla ride for you.${driverLine}${pinLine}\nTrack your captain and live trip without an account here:\n${url}`;
                          const rawDigits = activeRideData.actualPassenger.phone.replace(/[^0-9]/g, "");
                          const waDigits =
                            rawDigits.startsWith("01") && rawDigits.length === 11
                              ? `2${rawDigits}`
                              : rawDigits;
                          const waLink = `https://wa.me/${waDigits}?text=${encodeURIComponent(msg)}`;
                          window.open(waLink, "_blank");
                        }}
                        className="w-full flex items-center p-4 rounded-2xl bg-blue-50 border border-blue-200 active:scale-95 transition-all group"
                      >
                        <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center shadow-md mr-4 rtl:mr-0 rtl:ml-4 flex-shrink-0 group-hover:scale-105 transition-transform">
                          <i className="fab fa-whatsapp text-white text-2xl"></i>
                        </div>
                        <div className="text-left rtl:text-right flex-1">
                          <div className="font-black text-base text-gray-900 mb-0.5">
                            {t("whatsapp_share_other_passenger")} (
                            {activeRideData.actualPassenger.name})
                          </div>
                          <div className="text-xs font-bold text-blue-700">
                            {t("share_trip_tracking")}
                          </div>
                        </div>
                        <i
                          className={`fas fa-chevron-${isRTL ? "left" : "right"} text-blue-400`}
                        ></i>
                      </button>
                    )}

                  {/* Option 1: WhatsApp Driver */}
                  {assignedDriver && assignedDriver.phone && (
                    <button
                      onClick={() => {
                        setShowShareSheet(false);
                        const tokenQuery = activeRideData?.trackingToken
                          ? `?token=${encodeURIComponent(activeRideData.trackingToken)}`
                          : "";
                        const url = `${window.location.origin}/live/${currentRideId}${tokenQuery}`;
                        const msg = isRTL
                          ? `مرحباً كابتن، إحداثيات موقعي المباشر أثناء الرحلة لتسهيل الوصول:\n${url}`
                          : `Hello Captain, here is my live tracking link for an easier pickup:\n${url}`;
                        const waLink = `https://wa.me/${assignedDriver.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(msg)}`;
                        window.open(waLink, "_blank");
                      }}
                      className="w-full flex items-center p-4 rounded-2xl bg-[#effbf4] border border-[#25D366]/20 active:scale-95 transition-all group"
                    >
                      <div className="w-14 h-14 bg-[#25D366] rounded-xl flex items-center justify-center shadow-md mr-4 rtl:mr-0 rtl:ml-4 flex-shrink-0 group-hover:scale-105 transition-transform">
                        <i className="fab fa-whatsapp text-white text-2xl"></i>
                      </div>
                      <div className="text-left rtl:text-right flex-1">
                        <div className="font-black text-lg text-gray-900 mb-0.5">
                          {isRTL ? "إرسال للكابتن واتساب" : "Share with Driver"}
                        </div>
                        <div className="text-xs font-bold text-gray-500">
                          {isRTL
                            ? "إرسال رابط التتبع فوراً للكابتن"
                            : "Send live link directly via WhatsApp"}
                        </div>
                      </div>
                      <i
                        className={`fas fa-chevron-${isRTL ? "left" : "right"} text-gray-300`}
                      ></i>
                    </button>
                  )}

                  {/* Option 2: Share with Others */}
                  <button
                    onClick={() => {
                      setShowShareSheet(false);
                      const tokenQuery = activeRideData?.trackingToken
                        ? `?token=${encodeURIComponent(activeRideData.trackingToken)}`
                        : "";
                      const url = `${window.location.origin}/live/${currentRideId}${tokenQuery}`;
                      const storedPin = getStoredRideVerificationPin(
                        currentRideId || "",
                      );
                      const pinNote = storedPin
                        ? isRTL
                          ? ` (كود بدء الرحلة: ${storedPin})`
                          : ` (Start PIN: ${storedPin})`
                        : "";
                      if (navigator.share) {
                        navigator
                          .share({
                            title: t("share_trip_tracking"),
                            text: isRTL
                              ? `تتبع مسار الرحلة المباشر عبر هذا الرابط${pinNote}:`
                              : `Track live ride trajectory using this temporary link${pinNote}:`,
                            url: url,
                          })
                          .catch(() => {});
                      } else {
                        navigator.clipboard.writeText(url);
                      }
                    }}
                    className="w-full flex items-center p-4 rounded-2xl bg-gray-50 border border-gray-200 active:scale-95 transition-all group"
                  >
                    <div className="w-14 h-14 bg-gray-900 rounded-xl flex items-center justify-center shadow-md text-white mr-4 rtl:mr-0 rtl:ml-4 flex-shrink-0 group-hover:scale-105 transition-transform">
                      <i className="fas fa-share-nodes text-xl"></i>
                    </div>
                    <div className="text-left rtl:text-right flex-1">
                      <div className="font-black text-lg text-gray-900 mb-0.5">
                        {t("share_trip_tracking")}
                      </div>
                      <div className="text-xs font-bold text-gray-500">
                        {isRTL
                          ? "نسخ أو مشاركة رابط التتبع المباشر"
                          : "Copy or share temporary tracking link"}
                      </div>
                    </div>
                    <i
                      className={`fas fa-chevron-${isRTL ? "left" : "right"} text-gray-300`}
                    ></i>
                  </button>
                </div>

                <div className="mt-8">
                  <button
                    onClick={() => setShowShareSheet(false)}
                    className="w-full py-4 bg-gray-100 text-gray-600 rounded-2xl font-black text-base active:bg-gray-200 transition-colors"
                  >
                    {t("cancel")}
                  </button>
                </div>
              </div>
            </div>
          )}

          <AnimatePresence>
            {showForceReload && rideStatus === RideStatus.IDLE && user?.role !== UserRole.ADMIN && !checkIsAdmin(auth.currentUser?.email || user?.email, auth.currentUser?.phoneNumber || user?.phone) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 text-right rtl:text-right ltr:text-left"
              >
                <motion.div
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  className="bg-white w-full max-w-sm rounded-[32px] p-8 text-center shadow-2xl overflow-hidden relative"
                >
                  <div className="w-20 h-20 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <i className="fas fa-sync-alt text-[#FFC90E] text-4xl animate-spin-slow"></i>
                  </div>
                  <h3 className="text-xl font-black text-gray-900 mb-3 tracking-tighter">
                    {t("system_refresh_required")}
                  </h3>
                  <p className="text-gray-500 text-sm font-bold leading-relaxed mb-8">
                    {isRTL
                      ? appSettings?.forceReload?.messageAr
                      : appSettings?.forceReload?.messageEn}
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="w-full py-4 bg-[#FFC90E] text-gray-900 rounded-2xl font-black text-base shadow-lg shadow-yellow-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    <i className="fas fa-redo-alt"></i>
                    {t("refresh_now")}
                  </button>
                </motion.div>
              </motion.div>
            )}

            {showExpressPopup && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-6"
                onClick={() => setShowExpressPopup(false)}
              >
                <motion.div
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  className="bg-white w-full max-w-sm rounded-[32px] p-8 text-center shadow-2xl relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <i className="fas fa-box-open text-blue-500 text-4xl"></i>
                  </div>
                  <h3 className="text-xl font-black text-gray-900 mb-3">
                    {isRTL ? "مواصلة إكسبرس" : "Mowasla Express"}
                  </h3>
                  <p className="text-gray-500 text-sm font-bold leading-relaxed mb-8">
                    {isRTL
                      ? "وصلنى اكسبرس تمكنك توصيل الطرود او الطلبات الى اى مكان"
                      : "Mowasla Express enables you to deliver parcels or orders anywhere"}
                  </p>
                  <button
                    onClick={() => setShowExpressPopup(false)}
                    className="w-full py-4 bg-[#FFC90E] text-gray-900 rounded-2xl font-black text-base shadow-lg shadow-yellow-100 active:scale-[0.98] transition-all"
                  >
                    {t("close")}
                  </button>
                </motion.div>
              </motion.div>
            )}

            {showWelcomeOffer &&
              appSettings?.welcomeOffer?.isEnabled !== false && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
                  onClick={handleDismissWelcomeOffer}
                >
                  <motion.div
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    className="bg-white w-full max-w-sm rounded-[32px] p-8 text-center shadow-2xl relative overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {appSettings?.welcomeOffer?.image ? (
                      <div className="absolute top-0 left-0 w-full h-32 bg-gray-100 z-0 opacity-80 pointer-events-none">
                        <img
                          src={appSettings.welcomeOffer.image}
                          alt="offer cover"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/5"></div>
                      </div>
                    ) : (
                      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-[#FFC90E] to-yellow-500 z-0 opacity-80 pointer-events-none"></div>
                    )}

                    <button
                      onClick={handleDismissWelcomeOffer}
                      className={`absolute top-4 ${isRTL ? "left-4" : "right-4"} z-20 w-8 h-8 bg-black/20 hover:bg-black/30 rounded-full flex items-center justify-center text-white backdrop-blur-md transition-colors`}
                    >
                      <i className="fas fa-times"></i>
                    </button>

                    <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-6 relative z-10 shadow-[0_10px_25px_rgba(0,0,0,0.1)] border-4 border-white mt-4">
                      <div className="absolute inset-0 rounded-full bg-[#FFC90E] opacity-20 animate-ping"></div>
                      <i
                        className={`${appSettings?.welcomeOffer?.icon || "fas fa-gift"} text-yellow-500 text-4xl transform hover:rotate-12 transition-transform duration-300`}
                      ></i>
                    </div>

                    <h3 className="text-2xl font-black text-gray-900 mb-2 relative z-10 tracking-tight">
                      {isRTL
                        ? appSettings?.welcomeOffer?.titleAr ||
                          "أهلاً بك في مواصلة!"
                        : appSettings?.welcomeOffer?.titleEn ||
                          "Welcome to Mowasla!"}
                    </h3>

                    <p className="text-gray-500 text-sm font-bold leading-relaxed mb-6 relative z-10 whitespace-pre-wrap">
                      {isRTL
                        ? appSettings?.welcomeOffer?.messageAr ||
                          "استمتع بتجربة أسهل وأسرع. اجمع النقاط مع كل رحلة واحصل على خصومات حصرية وعروض مميزة خصيصاً لك."
                        : appSettings?.welcomeOffer?.messageEn ||
                          "Enjoy a faster and easier ride. Collect points with every trip and get exclusive discounts and special offers just for you."}
                    </p>

                    {(appSettings?.welcomeOffer?.highlightTitleEn ||
                      appSettings?.welcomeOffer?.highlightTitleAr) && (
                      <div className="bg-orange-50/80 rounded-2xl p-4 mb-6 relative z-10 border border-orange-100 flex items-center gap-4 text-left rtl:text-right shadow-sm">
                        <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0 text-orange-500">
                          <i className="fas fa-coins text-xl"></i>
                        </div>
                        <div>
                          <h4 className="font-black text-gray-900 text-sm mb-1">
                            {isRTL
                              ? appSettings?.welcomeOffer?.highlightTitleAr ||
                                "برنامج النقاط والمكافآت"
                              : appSettings?.welcomeOffer?.highlightTitleEn ||
                                "Points & Rewards"}
                          </h4>
                          <p className="text-xs font-bold text-gray-500 leading-tight">
                            {isRTL
                              ? appSettings?.welcomeOffer?.highlightMessageAr ||
                                "لكل رحلة تكتسب نقاطاً يمكنك تحويلها لاحقاً إلى خصومات فورية."
                              : appSettings?.welcomeOffer?.highlightMessageEn ||
                                "For every ride you earn points that can later be converted into instant discounts."}
                          </p>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={handleDismissWelcomeOffer}
                      className="w-full py-4 bg-[#FFC90E] text-gray-900 rounded-2xl font-black text-base shadow-lg shadow-yellow-200 active:scale-[0.98] transition-all relative z-10 hover:bg-yellow-400 flex items-center justify-center gap-2 group"
                    >
                      <span>
                        {isRTL ? "ابدأ رحلتك الآن" : "Start your journey"}
                      </span>
                      <i
                        className={`fas fa-arrow-${isRTL ? "left" : "right"} transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform`}
                      ></i>
                    </button>
                  </motion.div>
                </motion.div>
              )}
          </AnimatePresence>

          <AnimatePresence>
            {isChatOpen && currentRideId && assignedDriver && (
              <motion.div
                key="passenger-chat-overlay"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                className="fixed inset-0 z-[250] bg-white transform-gpu will-change-transform origin-center"
              >
                <ChatPanel
                  rideId={currentRideId}
                  currentUserId={user.id}
                  otherUserName={assignedDriver.name || "Captain"}
                  otherUserPhone={assignedDriver.phone}
                  onClose={() => setIsChatOpen(false)}
                  isPassenger={true}
                  passengerId={user.id}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <BookForOtherModal
            isOpen={
              showBookForOtherModal &&
              rideStatus === RideStatus.IDLE &&
              searchMode === "none" &&
              isPickingFromMap === "none"
            }
            onClose={() => {
              setShowBookForOtherModal(false);
              setBookingType("SELF");
              setOtherPassengerError(null);
            }}
            isRTL={isRTL}
            t={t}
            userName={user.name}
            userPhone={user.phone}
            otherPassengerName={otherPassengerName}
            setOtherPassengerName={setOtherPassengerName}
            otherPassengerPhone={otherPassengerPhone}
            setOtherPassengerPhone={setOtherPassengerPhone}
            otherPassengerNote={otherPassengerNote}
            setOtherPassengerNote={setOtherPassengerNote}
            rideVerificationEnabled={rideVerificationEnabled}
            setRideVerificationEnabled={setRideVerificationEnabled}
            otherPassengerError={otherPassengerError}
            setOtherPassengerError={setOtherPassengerError}
            savedOtherContacts={savedOtherContacts}
            pickupAddress={pickupAddress}
            dropoffAddress={dropoffAddress}
            hasDropoff={Boolean(dropoff)}
            distanceKm={distanceKm}
            onOpenSearchPickup={() => handleOpenSearch("pickup")}
            onPickPickupFromMap={() => {
              setIsPickingFromMap("pickup");
              setIsSheetMinimized(true);
            }}
            onOpenSearchDropoff={() => handleOpenSearch("dropoff")}
            onPickDropoffFromMap={() => {
              setIsPickingFromMap("dropoff");
              setIsSheetMinimized(true);
            }}
            vehicleTypes={VEHICLE_TYPES}
            selectedVehicleType={selectedVehicleType}
            onSelectVehicleType={(vt) => setSelectedVehicleType(vt)}
            priceRanges={priceRanges}
            customFare={customFare}
            setCustomFare={setCustomFare}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            isRequesting={isRequesting}
            onSubmitRide={() => {
              setBookingType("FOR_OTHER");
              handleRequestRide("FOR_OTHER");
            }}
          />

          <PassengerScheduledRidesModal
            isOpen={showScheduledRidesModal}
            onClose={() => setShowScheduledRidesModal(false)}
            passengerId={user.id}
            lang={language === "en" ? "en" : "ar"}
            initialConfirmedRide={confirmedScheduledRide}
            onClearConfirmedRide={() => setConfirmedScheduledRide(null)}
            onScheduleNewRide={() => {
              setIsScheduling(true);
              setShowScheduleSheet(true);
            }}
          />

          <audio
            ref={audioRef}
            src="/mixkit-arabian-mystery-harp-notification-2489.wav"
            preload="auto"
            playsInline
          />
          <audio
            ref={successAudioRef}
            src="/mixkit-arabian-mystery-harp-notification-2489.wav"
            preload="auto"
            playsInline
          />
        </div>
      )}
    </LocationGuard>
  );
}
