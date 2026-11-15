import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { Capacitor } from "@capacitor/core";
import {
  Driver,
  RideStatus,
  User,
  Ride,
  Coordinates,
  UserRole,
  PaymentMethod,
  AppSettings,
  PaymentStatus,
  PricingConfig,
} from "../types";
import { Button } from "../components/ui/Button";
import { LocationGuard } from "../components/LocationGuard";
import { DynamicMap as Map } from "../components/DynamicMap";
import { ChatPanel } from "../components/ChatPanel";
import { useLanguage } from "../contexts/LanguageContext";
import {
  updateUserProfile,
  updateDriverStatus,
  subscribeToRide,
  getUserProfile,
  acceptRideRequest,
  driverAcceptsCounterOffer,
  updateRideStatus,
  completeRide,
  updateRideDriverLocation,
  subscribeToRideMessages,
  proposeRideOffer,
  checkActiveRide,
  subscribeToAssignedRide,
  subscribeToUser,
  resolveCancellationRequest,
  processDriverSubscription,
  sendMessage,
  subscribeToDriverRequests,
  subscribeToScheduledRides,
  subscribeToHeatmapActivity,
  subscribeToDriverActiveOffers,
  expireRideOfferTimeout,
  rejectRideRequestByDriver,
  calculateDistance,
  getOrCreateAdminSupportTicket,
  sendSupportMessage,
  uploadFile,
  getDriverSettlements,
  submitSettlementPayment,
  driverCancelAndReassignRide,
  subscribeToAppSettings,
  confirmInstapayPayment,
  calculateDriverLevel,
  subscribeToPricingSettings,
  saveDeviceToken,
  verifyRideStartCode,
  checkIsAdmin,
  auth,
} from "../services/firebase";
import { reverseGeocodeDetailed } from "../services/placesService";
import { DriverInstructions } from "../components/DriverInstructions";
import {
  DriverRequestsPopup,
  TripDetailsSheet,
} from "../components/DriverRequests";
import { CapacitorService } from "../services/capacitorService";
import { ImpactStyle } from "@capacitor/haptics";
import { Geolocation } from "@capacitor/geolocation";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  Bell,
  CheckCircle,
  X,
  ShieldAlert,
  BadgeInfo,
  Navigation,
  Route,
  Compass,
} from "lucide-react";
import { db } from "../services/firebase";
import { updateDoc, doc } from "firebase/firestore";
import {
  PremiumSkeleton,
  GlassCard,
  Skeleton,
} from "../components/ui/PremiumUI";
import { HapticsService } from "../services/haptics";
import { AppLauncher } from "@capacitor/app-launcher";
import { Browser } from "@capacitor/browser";
import { DriverInsightsPanel } from "../components/DriverInsightsPanel";
import { DriverRewardsPanel } from "../components/DriverRewardsPanel";
import { VehicleManagementPanel } from "../components/VehicleManagementPanel";
import { DriverScheduledRidesView } from "../components/DriverScheduledRidesView";

const OFFER_WAIT_SECONDS = 12;

const calculateBearing = (from: Coordinates, to: Coordinates): number => {
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

const openNavigation = async (lat: number, lng: number) => {
  const appUrl = `google.navigation:q=${lat},${lng}`;
  try {
    const canOpen = await AppLauncher.canOpenUrl({ url: appUrl });
    if (canOpen.value) {
      await AppLauncher.openUrl({ url: appUrl });
    } else {
      await Browser.open({
        url: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
      });
    }
  } catch (e) {
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
      "_blank",
    );
  }
};

// Updated sound URL to a clearer, more reliable alert tone
const NOTIFICATION_SOUND_URL =
  "/mixkit-arabian-mystery-harp-notification-2489.wav";
const SUCCESS_SOUND_URL = "/mixkit-arabian-mystery-harp-notification-2489.wav";

let lastAlertSoundTime = 0;

interface DriverAppProps {
  driver: Driver;
  onNavigateToProfile: () => void;
  onLogout: () => void;
  showDutySchedule?: boolean;
  onCloseDutySchedule?: () => void;
}

const TripTimeline = ({
  pickup,
  dropoff,
  duration,
  isRTL,
  status,
}: {
  pickup: string;
  dropoff: string;
  duration?: string;
  isRTL: boolean;
  status?: RideStatus;
}) => {
  const { t } = useLanguage();

  // Extract numeric duration if present (e.g., "5 min" -> "5")
  const numericDuration = duration?.match(/\d+/)?.[0] || duration;

  return (
    <div
      className={`bg-[#F8F7FF] rounded-[28px] p-6 mb-6 relative border border-[#EEF0FF]`}
    >
      {/* Vertical Connecting Line */}
      <div
        className={`absolute top-10 bottom-10 ${isRTL ? "right-[31px]" : "left-[31px]"} w-0.5 border-l-2 border-dashed border-[#8B5CF6] opacity-20`}
      ></div>

      {/* PICKUP SECTION */}
      <div
        className={`flex ${isRTL ? "flex-row" : "flex-row-reverse"} items-start justify-between mb-8 relative z-10`}
      >
        <div className={`flex-1 min-w-0 ${isRTL ? "text-right" : "text-left"}`}>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[#8B5CF6] text-[11px] font-black uppercase tracking-[0.15em]">
              {t("pickup_caps")}
            </span>
            {status === RideStatus.ACCEPTED && (
              <div className="flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-600 text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block animate-ping"></span>
                <span>{t("status_arriving")}</span>
              </div>
            )}
            {status === RideStatus.ARRIVED && (
              <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-600 text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-ping"></span>
                <span>{t("status_arrived")}</span>
              </div>
            )}
          </div>
          <div
            className="font-bold text-gray-900 text-sm leading-tight truncate"
            dir="auto"
          >
            {pickup}
          </div>
          {duration && (
            <div
              className={`mt-2 flex items-center gap-1.5 text-[#9CA3AF] font-bold text-[13px] ${isRTL ? "justify-start" : "justify-end"}`}
            >
              <span dir="ltr">
                {numericDuration} {t("min")}
              </span>
              <i className="far fa-clock text-xs"></i>
            </div>
          )}
        </div>
        <div className={`relative shrink-0 mt-1 ${isRTL ? "ml-0 mr-4" : "mr-0 ml-4"}`}>
          {(status === RideStatus.ACCEPTED || status === RideStatus.ARRIVED) && (
            <div className={`absolute -inset-1 rounded-full animate-ping opacity-60 ${status === RideStatus.ARRIVED ? "bg-emerald-400" : "bg-blue-400"}`}></div>
          )}
          <div
            className={`w-4 h-4 rounded-full border-[3px] bg-white transition-all duration-300 ${
              status === RideStatus.ARRIVED
                ? "border-emerald-500 shadow-md shadow-emerald-200"
                : status === RideStatus.ACCEPTED
                ? "border-blue-500"
                : "border-[#8B5CF6]"
            }`}
          ></div>
        </div>
      </div>

      {/* DROPOFF SECTION */}
      <div
        className={`flex ${isRTL ? "flex-row" : "flex-row-reverse"} items-start justify-between relative z-10`}
      >
        <div className={`flex-1 min-w-0 ${isRTL ? "text-right" : "text-left"}`}>
          <div className="text-[#8B5CF6] text-[11px] font-black uppercase tracking-[0.15em] mb-1">
            {t("dropoff_caps")}
          </div>
          <div
            className="font-bold text-gray-900 text-sm leading-tight truncate"
            dir="auto"
          >
            {dropoff}
          </div>
        </div>
        <div
          className={`w-4 h-4 rounded-full bg-[#8B5CF6] shrink-0 mt-1 shadow-sm border-2 border-white ${isRTL ? "ml-0 mr-4" : "mr-0 ml-4"}`}
        ></div>
      </div>
    </div>
  );
};

export default function DriverApp({
  driver,
  onNavigateToProfile,
  onLogout,
  showDutySchedule = false,
  onCloseDutySchedule,
}: DriverAppProps) {
  useEffect(() => {
    console.log("⏱️ Startup Timing: Home Rendered (Driver)", performance.now(), 'ms');
  }, []);
  const { t, isRTL, language } = useLanguage();

  const [currentDriverProfile, setCurrentDriverProfile] =
    useState<Driver>(driver);
  const [isOnline, setIsOnline] = useState(driver.isOnline || false);
  const [rideStatus, setRideStatus] = useState(RideStatus.IDLE);
  const [currentLocation, setCurrentLocation] = useState<Coordinates>(
    driver.currentLocation || { lat: 30.0444, lng: 31.2357 },
  );
  const [driverHeading, setDriverHeading] = useState<number>(0);
  const [isNavRouteMode, setIsNavRouteMode] = useState<boolean>(true);
  const [isMapAutoFollowing, setIsMapAutoFollowing] = useState(true);
  const [currentAddress, setCurrentAddress] = useState<string>("");

  const geocoderRef = useRef<any>(null);

  const [showAddressBar, setShowAddressBar] = useState(false);
  const [showSettingsToolbar, setShowSettingsToolbar] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [showRewards, setShowRewards] = useState(false);
  const [showVehicleManager, setShowVehicleManager] = useState(false);
  const addressBarTimerRef = useRef<any>(null);
  const [lastGeocodedLoc, setLastGeocodedLoc] = useState<Coordinates | null>(
    null,
  );
  const [hasShownInitialPopup, setHasShownInitialPopup] = useState(false);

  const [topNotification, setTopNotification] = useState<{
    title: string;
    body: string;
    type: "success" | "message" | "status";
  } | null>(null);
  const topNotificationTimerRef = useRef<any>(null);
  const shownSessionAlertsRef = useRef<Set<string>>(new Set());

  const clearTopNotification = useCallback(() => {
    if (topNotificationTimerRef.current) {
      clearTimeout(topNotificationTimerRef.current);
      topNotificationTimerRef.current = null;
    }
    setTopNotification(null);
  }, []);

  const showTopNotification = useCallback(
    (
      notif: {
        title: string;
        body: string;
        type: "success" | "message" | "status";
      },
      durationMs: number = 8000,
      onceKey?: string,
    ) => {
      if (onceKey) {
        if (shownSessionAlertsRef.current.has(onceKey)) return;
        try {
          const storageKey = `mowasla_session_alert_${driver.id}_${onceKey}`;
          if (sessionStorage.getItem(storageKey) === "1") return;
          sessionStorage.setItem(storageKey, "1");
        } catch {}
        shownSessionAlertsRef.current.add(onceKey);
      }

      if (topNotificationTimerRef.current) {
        clearTimeout(topNotificationTimerRef.current);
        topNotificationTimerRef.current = null;
      }
      setTopNotification(notif);
      if (durationMs > 0) {
        topNotificationTimerRef.current = setTimeout(() => {
          setTopNotification(null);
          topNotificationTimerRef.current = null;
        }, durationMs);
      }
    },
    [driver.id],
  );

  // --- Free Trial States ---
  const [trialRemaining, setTrialRemaining] = useState<{
    days: number;
    hours: number;
    mins: number;
    secs: number;
  } | null>(null);
  const [showTrialBannerPopup, setShowTrialBannerPopup] = useState(false);

  useEffect(() => {
    const trialKey = `hasShownTrialBanner_${driver.id}`;
    const alreadyShown =
      localStorage.getItem(trialKey) === "true" ||
      localStorage.getItem("hasShownTrialBanner") === "true";
    if (trialRemaining && !alreadyShown) {
      localStorage.setItem(trialKey, "true");
      localStorage.setItem("hasShownTrialBanner", "true");
      setShowTrialBannerPopup(true);
      const timer = setTimeout(() => {
        setShowTrialBannerPopup(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [!!trialRemaining, driver.id]);

  useEffect(() => {
    if (
      currentDriverProfile?.isTrialActive &&
      currentDriverProfile?.trialEndDate &&
      !currentDriverProfile?.hasTrialExpired
    ) {
      const calculateRemaining = () => {
        const now = Date.now();
        const diff = currentDriverProfile.trialEndDate! - now;
        if (diff <= 0) {
          setTrialRemaining(null);
          if (currentDriverProfile.isTrialActive) {
            import("firebase/firestore").then(({ doc, updateDoc }) => {
              import("../services/firebaseBridge").then(({ db }) => {
                updateDoc(doc(db, "users", currentDriverProfile.id), {
                  isTrialActive: false,
                  hasTrialExpired: true,
                });
                alert(t("free_trial_expired"));
              });
            });
            // Force local update to prevent continuous alerts
            setCurrentDriverProfile((prev) => ({
              ...prev,
              isTrialActive: false,
              hasTrialExpired: true,
            }));
          }
          // If expired just now, we could handle notification here but let's rely on component re-render
        } else {
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
          const mins = Math.floor((diff / 1000 / 60) % 60);
          const secs = Math.floor((diff / 1000) % 60);
          setTrialRemaining({ days, hours, mins, secs });
        }
      };
      calculateRemaining();
      const interval = setInterval(calculateRemaining, 1000);
      return () => clearInterval(interval);
    } else {
      setTrialRemaining(null);
    }
  }, [
    currentDriverProfile?.isTrialActive,
    currentDriverProfile?.trialEndDate,
    currentDriverProfile?.hasTrialExpired,
  ]);

  // --- Real-time Request States ---
  const [scheduledRequests, setScheduledRequests] = useState<Ride[]>([]);
  const [newRequests, setNewRequests] = useState<Ride[]>([]);
  const [activeOffers, setActiveOffers] = useState<Ride[]>([]);
  const [heatPoints, setHeatPoints] = useState<Coordinates[]>([]);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showHeatmapInfo, setShowHeatmapInfo] = useState(false);

  const [dismissedRequestIds, setDismissedRequestIds] = useState<string[]>([]);
  const [pinnedRequestIds, setPinnedRequestIds] = useState<string[]>([]);

  // Update pendingRequests to include scheduled, deduplicated and with pinned rides anchored first
  const pendingRequests = useMemo(() => {
    const combined = [...newRequests, ...scheduledRequests, ...activeOffers];
    const seen = new Set<string>();
    const unique: Ride[] = [];
    for (const r of combined) {
      if (r && r.id && !seen.has(r.id)) {
        seen.add(r.id);
        unique.push(r);
      }
    }
    if (pinnedRequestIds.length === 0) return unique;
    const pinnedSet = new Set(pinnedRequestIds);
    const pinned = unique.filter((r) => pinnedSet.has(r.id));
    const unpinned = unique.filter((r) => !pinnedSet.has(r.id));
    return [...pinned, ...unpinned];
  }, [newRequests, scheduledRequests, activeOffers, pinnedRequestIds]);

  const [selectedRequest, setSelectedRequest] = useState<Ride | null>(null);

  useEffect(() => {
    // Stop when pending requests list is empty and no request is selected.
    if (pendingRequests.length === 0 && !selectedRequest) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  }, [pendingRequests, selectedRequest]);

  // --- Duty Schedule Logic ---
  useEffect(() => {
    const checkAutoOffline = async () => {
      if (!isOnline || !currentDriverProfile?.autoOfflineTime) return;

      const now = Date.now();
      if (now >= currentDriverProfile.autoOfflineTime) {
        // TRIGGER AUTO-OFFLINE
        setIsOnline(false);
        await updateDriverStatus(driver.id, false, currentLocationRef.current);

        // Clear the time in profile
        await updateUserProfile(driver.id, { autoOfflineTime: null } as any);

        // Show Notifications
        showTopNotification(
          {
            title: t("auto_offline_triggered"),
            body: t("auto_offline_desc_msg"),
            type: "status",
          },
          8000,
          `auto_offline_${currentDriverProfile.autoOfflineTime}`,
        );

        // Trigger Push Notification (App Message)
        CapacitorService.scheduleNotification(
          t("auto_offline_triggered"),
          t("auto_offline_desc_msg"),
        );

        if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]);
        playAlertSound("cancelled");
      }
    };

    const interval = setInterval(checkAutoOffline, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [
    isOnline,
    currentDriverProfile?.autoOfflineTime,
    driver.id,
    t,
    showTopNotification,
  ]);

  const handleSetAutoOffline = async (timestamp: number | null) => {
    try {
      await updateUserProfile(driver.id, { autoOfflineTime: timestamp } as any);
      setCurrentDriverProfile((prev) => ({
        ...prev,
        autoOfflineTime: timestamp,
      }));
      if (onCloseDutySchedule) onCloseDutySchedule();

      if (timestamp) {
        showTopNotification(
          {
            title: t("work_schedule"),
            body: t("duty_schedule_set"),
            type: "success",
          },
          5000,
        );
      }
    } catch (e) {
      console.error("Failed to set schedule", e);
    }
  };

  const getRemainingTimeStr = () => {
    if (!currentDriverProfile?.autoOfflineTime) return null;
    const diff = currentDriverProfile.autoOfflineTime - Date.now();
    if (diff <= 0) return t("offline");

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff / (1000 * 60)) % 60);
    return `${hours}h ${mins}m`;
  };

  // --- Offline Notification Logic (once per session when offline) ---
  useEffect(() => {
    if (!isOnline) {
      showTopNotification(
        {
          title: t("you_are_offline"),
          body: t("offline_desc"),
          type: "status",
        },
        7000,
        "offline_notice",
      );
    } else {
      setTopNotification((prev) =>
        prev?.title === t("you_are_offline") ? null : prev,
      );
    }
  }, [isOnline, t, showTopNotification]);

  const [activeRide, setActiveRide] = useState<Ride | null>(() => {
    try {
      const cached = localStorage.getItem('mowasla_driver_ride_data');
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });

  useEffect(() => {
    if (activeRide) {
        localStorage.setItem('mowasla_driver_ride_data', JSON.stringify(activeRide));
    } else {
        localStorage.removeItem('mowasla_driver_ride_data');
    }
  }, [activeRide]);
  const activeRideRef = useRef<Ride | null>(null);

  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [pricingConfig, setPricingConfig] = useState<PricingConfig | null>(null);
  const sessionStartTime = useRef(Date.now());
  const [showForceReload, setShowForceReload] = useState(false);

  useEffect(() => {
    const unsub = subscribeToPricingSettings((config) => {
      setPricingConfig(config);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const isAdminAccount =
      driver?.role === UserRole.ADMIN ||
      Boolean((driver as any)?.isAdmin) ||
      checkIsAdmin(auth.currentUser?.email || driver?.email, auth.currentUser?.phoneNumber || driver?.phone);
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
  }, [driver?.role, driver?.email, driver?.phone]);

  const handleToggleHeatmap = () => {
    const isFirstTime = !localStorage.getItem("heatmap_info_seen");
    const isNewDriver = (currentDriverProfile?.totalRides || 0) < 5; // Drivers with less than 5 rides get guidance

    if (
      !showHeatmap &&
      (isFirstTime ||
        (isNewDriver && !localStorage.getItem("heatmap_guide_dismissed")))
    ) {
      setShowHeatmapInfo(true);
    }
    setShowHeatmap(!showHeatmap);
  };

  const getDistance = (loc1: Coordinates, loc2: Coordinates) => {
    const R = 6371e3; // meters
    const φ1 = (loc1.lat * Math.PI) / 180;
    const φ2 = (loc2.lat * Math.PI) / 180;
    const Δφ = ((loc2.lat - loc1.lat) * Math.PI) / 180;
    const Δλ = ((loc2.lng - loc1.lng) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in meters
  };

  const cleanAddress = (addr: string) =>
    (addr || "").replace(/^[A-Z0-9]+\+[A-Z0-9]+[\s,\u060C]*/i, "").trim();

  const [isRefreshingLocation, setIsRefreshingLocation] = useState(false);
  const [showFinancialPanel, setShowFinancialPanel] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false); // Add this state
  const [settlements, setSettlements] = useState<any[]>([]);

  useEffect(() => {
    if (showFinancialPanel) {
      getDriverSettlements(driver.id).then(setSettlements).catch(e => { if(String(e).includes('permission')) { console.log('Permission error caught:', e); } else { if(String(e).includes('permission')) { console.log('Permission error caught:', e); } else { console.error(e); }; } });
    }
  }, [showFinancialPanel, driver.id]);

  const flashAddressNotification = () => {
    setShowAddressBar(true);
    if (addressBarTimerRef.current) clearTimeout(addressBarTimerRef.current);
    addressBarTimerRef.current = setTimeout(
      () => setShowAddressBar(false),
      5000,
    );
  };

  useEffect(() => {
    // Initial 10s popup - handled by first geocode
  }, []);

  const geocodeCurrentLocation = useCallback(
    async (loc: Coordinates, shouldFlash: boolean = false) => {
      let needsFlash = shouldFlash;

      if (!hasShownInitialPopup) {
        setHasShownInitialPopup(true);
        setLastGeocodedLoc(loc);
        needsFlash = true;
      } else if (lastGeocodedLoc && getDistance(lastGeocodedLoc, loc) > 10000) {
        setLastGeocodedLoc(loc);
      }

      if (!needsFlash && currentAddress) return;

      try {
        const detailed = await reverseGeocodeDetailed(loc, language === "ar" ? "ar" : "en");
        if (detailed.address) {
          setCurrentAddress(detailed.address);
          if (needsFlash) flashAddressNotification();
        }
      } catch {
        // failed to geocode
      }
    },
    [lastGeocodedLoc, hasShownInitialPopup, currentAddress, language],
  );

  useEffect(() => {
    if (selectedRequest) {
      const stillExists = pendingRequests.find(
        (r) => r.id === selectedRequest.id,
      );
      if (!stillExists) {
        setSelectedRequest(null);
      } else if (
        JSON.stringify(stillExists) !== JSON.stringify(selectedRequest)
      ) {
        setSelectedRequest(stillExists);
      }
    }
  }, [pendingRequests, selectedRequest]);

  // Mandatory Instant cancellation listener for the currently selected request popup
  useEffect(() => {
    if (!selectedRequest?.id) return;
    if (activeRide?.id === selectedRequest.id) return; // handled by the other activeRide listener
    const unsub = subscribeToRide(selectedRequest.id, (rideData) => {
      if (rideData && rideData.status === RideStatus.CANCELLED) {
        playAlertSound("cancelled");
        showTopNotification(
          {
            title: t("status_cancelled"),
            body: isRTL
              ? "تم إلغاء الرحلة من قبل الراكب."
              : "The passenger cancelled the trip.",
            type: "status",
          },
          8000,
          `ride_cancelled_${selectedRequest.id}`,
        );
        setSelectedRequest(null);
      }
    });
    return () => unsub();
  }, [selectedRequest?.id, activeRide?.id, t, isRTL, showTopNotification]);

  useEffect(() => {
    if (pendingRequests.length === 0 || activeRide) {
      stopAlertSound();
    }
  }, [pendingRequests, activeRide]);

  const [passenger, setPassenger] = useState<User | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

  const [showPaymentChoice, setShowPaymentChoice] = useState(false);
  const [showCancelApproval, setShowCancelApproval] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  const [isAccepting, setIsAccepting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const [showRadiusSlider, setShowRadiusSlider] = useState(false);
  const [searchRadius, setSearchRadius] = useState<number>(
    driver.searchRadius || 100,
  );
  const [showApprovalGreeting, setShowApprovalGreeting] = useState(false);

  // Also add state for settlements
  const [driverSettlements, setDriverSettlements] = useState<any[]>([]);

  useEffect(() => {
    if (!activeRide) return;
    const interval = setInterval(async () => {
      if (
        (activeRide.status === RideStatus.SEARCHING ||
          activeRide.status === RideStatus.OFFER_RECEIVED) &&
        !activeRide.isScheduled
      ) {
        const lastActive = activeRide.lastActiveAt || activeRide.timestamp;
        if (lastActive && Date.now() - lastActive > 10 * 60 * 1000) {
          await updateRideStatus(activeRide.id, RideStatus.CANCELLED, {
            cancelledBy: "system_timeout",
            cancelReason: "Trip expired (10 min no activity)",
          });
          showTopNotification(
            {
              title: "Trip Cancelled",
              body: t("system_cancel_inactivity"),
              type: "message",
            },
            8000,
          );
          setActiveRide(null);
          activeRideRef.current = null;
        }
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [activeRide, isRTL, showTopNotification, t]);

  useEffect(() => {
    if (driver) {
      getDriverSettlements(driver.id)
        .then(setDriverSettlements)
        .catch(e => { if(String(e).includes('permission')) { console.log('Permission error caught:', e); } else { if(String(e).includes('permission')) { console.log('Permission error caught:', e); } else { console.error(e); }; } });
    }
  }, [driver]);

  const handleUploadReceipt = async (settlementId: string, event: any) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const url = await uploadFile(
        file,
        `drivers/${driver.id}/settlement_${Date.now()}_${file.name}`,
      );
      await submitSettlementPayment(settlementId, url);
      alert(t("receipt_uploaded"));
      getDriverSettlements(driver.id).then(setDriverSettlements);
    } catch (err) {
      if(String(err).includes('permission')) { console.log('Permission error caught:', err); } else { console.error(err); };
      alert("Upload failed.");
    }
  };
  const [showFeePopup, setShowFeePopup] = useState(false);
  const [feeAmount, setFeeAmount] = useState(0);
  // --- Phase 7: Ride Verification PIN State ---
  const [showVerificationPinModal, setShowVerificationPinModal] = useState(false);
  const [verificationPinInput, setVerificationPinInput] = useState("");
  const [verificationPinError, setVerificationPinError] = useState<string | null>(null);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const successAudioRef = useRef<HTMLAudioElement | null>(null);
  const ringAudioRef = useRef<HTMLAudioElement | null>(null);
  const alertedRideIdsRef = useRef<Set<string>>(new Set());

  const prevRideStatus = useRef<RideStatus>(RideStatus.IDLE);
  const lastMessageIdRef = useRef<string | null>(null);
  const sentWelcomeMessagesRef = useRef<Set<string>>(new Set());
  const isCompletingRef = useRef(false);

  useEffect(() => {
    // --- New Progressive Financial Warning System ---
    const checkFinances = async () => {
      if (!currentDriverProfile) return;

      const status = currentDriverProfile.financialStatus || "active";
      const graceEnd = currentDriverProfile.gracePeriodEndTime;
      const now = Date.now();

      // Check if grace period expired and we need to downgrade
      if (status === "warning" && graceEnd && now > graceEnd) {
        await updateUserProfile(driver.id, {
          financialStatus: "soft_restricted",
          gracePeriodEndTime: now + 24 * 60 * 60 * 1000, // 1 more day until hard block
        } as any);
        return;
      } else if (status === "soft_restricted" && graceEnd && now > graceEnd) {
        await updateUserProfile(driver.id, {
          financialStatus: "blocked",
          gracePeriodEndTime: null,
        } as any);
        return;
      }

      // Apply restrictions based on status
      if (status === "blocked") {
        if (isOnline) {
          setIsOnline(false);
          await updateDriverStatus(driver.id, false, currentLocationRef.current);
          alert(
            "Your account is blocked due to unpaid settlements. Please upload your InstaPay receipt.",
          );
        }
        setShowFeePopup(true);
      } else if (status === "warning" || status === "soft_restricted") {
        const warningStorageKey = `lastSettlementWarning_${driver.id}`;
        const lastNotif = localStorage.getItem(warningStorageKey);
        const todayStr = new Date().toISOString().split("T")[0];

        if (lastNotif !== todayStr) {
          localStorage.setItem(warningStorageKey, todayStr);
          showTopNotification(
            {
              title: "Payment Reminder",
              body: `Please settle your account to avoid restrictions.`,
              type: "status",
            },
            10000,
            `settlement_warning_${todayStr}`,
          );
        }
      }
    };

    checkFinances();
    const interval = setInterval(checkFinances, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [
    currentDriverProfile?.financialStatus,
    currentDriverProfile?.gracePeriodEndTime,
    driver.id,
    isOnline,
    showTopNotification,
  ]);

  useEffect(() => {
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
      if (ringAudioRef.current) unlock(ringAudioRef.current);

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

  const playAlertSound = async (type: string = "incoming_ride") => {
    try {
      const settings = driver.notificationSettings;
      if (settings) {
        if (type === "incoming_ride" && settings.rideRequestSound === false)
          return;
      }

      const { CapacitorService } = await import("../services/capacitorService");
      if (!settings || settings.rideRequestVibration !== false) {
        await CapacitorService.impact();
        await CapacitorService.vibrate();
      }

      const { AudioService } = await import("../services/audioService");
      await AudioService.play(type);
    } catch (e) {
      console.warn("Alert sound failed", e);
    }
  };

  const stopAlertSound = async (type: string = "incoming_ride") => {
    try {
      const { AudioService } = await import("../services/audioService");
      await AudioService.stop(type);
    } catch (e) {
      console.warn("Stop sound failed", e);
    }
  };

  const prevDriverStatusRef = useRef<string | undefined>(currentDriverProfile.status);

  useEffect(() => {
    const triggerOneTimeApprovalModal = (profile: Driver) => {
      const seenLocal =
        localStorage.getItem(`approval_greeting_seen_${driver.id}`) === "true";
      const firestoreSeen = (profile as any).approvalGreetingSeen === true;
      if (seenLocal || firestoreSeen) {
        try {
          localStorage.removeItem(`mowasla_pending_approval_modal_${driver.id}`);
        } catch {}
        return;
      }

      localStorage.setItem(`approval_greeting_seen_${driver.id}`, "true");
      try {
        localStorage.removeItem(`mowasla_pending_approval_modal_${driver.id}`);
      } catch {}
      updateUserProfile(driver.id, {
        approvalGreetingSeen: true,
        approvalNoticeShown: true,
        approvedNotice: null,
      } as any).catch(() => {});

      setShowApprovalGreeting(true);
      CapacitorService.impact(ImpactStyle.Heavy).catch(() => {});
      if (successAudioRef.current) {
        successAudioRef.current.play().catch(() => {});
      }
    };

    // Only show approval greeting on initial mount if explicitly marked unseen/pending for this driver
    const pendingModal = (() => {
      try {
        return localStorage.getItem(`mowasla_pending_approval_modal_${driver.id}`) === "true";
      } catch {
        return false;
      }
    })();
    if (
      currentDriverProfile.status === "approved" &&
      ((currentDriverProfile as any).approvalGreetingSeen === false ||
        Boolean((currentDriverProfile as any).approvedNotice) ||
        pendingModal)
    ) {
      triggerOneTimeApprovalModal(currentDriverProfile);
    }

    const unsub = subscribeToUser(driver.id, (updatedUser) => {
      const updatedDriver = updatedUser as Driver;
      if (updatedDriver) {
        const wasStatus = prevDriverStatusRef.current;
        const isNowApproved = updatedDriver.status === "approved";
        const hasPendingNotice =
          (updatedDriver as any).approvalGreetingSeen === false ||
          Boolean((updatedDriver as any).approvedNotice);

        if (
          isNowApproved &&
          ((wasStatus && wasStatus !== "approved") || hasPendingNotice)
        ) {
          triggerOneTimeApprovalModal(updatedDriver);
        }
        prevDriverStatusRef.current = updatedDriver.status;
        setCurrentDriverProfile(updatedDriver);
        setIsOnline(updatedDriver.isOnline || false);
        setSearchRadius(updatedDriver.searchRadius || 100);
        calculateDriverLevel(updatedDriver);
      }
    });
    return () => unsub();
  }, [driver.id]);

  const currentLocationRef = useRef(currentLocation);
  const isOnlineRef = useRef(isOnline);
  const driverHeadingRef = useRef(driverHeading);
  const searchRadiusRef = useRef(searchRadius);
  const dismissedRequestIdsRef = useRef(dismissedRequestIds);
  const activeOffersRef = useRef<Ride[]>(activeOffers);

  useEffect(() => {
    currentLocationRef.current = currentLocation;
    isOnlineRef.current = isOnline;
    driverHeadingRef.current = driverHeading;
    searchRadiusRef.current = searchRadius;
    dismissedRequestIdsRef.current = dismissedRequestIds;
  }, [currentLocation, isOnline, driverHeading, searchRadius, dismissedRequestIds]);

  useEffect(() => {
    activeOffersRef.current = activeOffers;
  }, [activeOffers]);

  const [showDriverScheduledModal, setShowDriverScheduledModal] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setNewRequests([]);
      setScheduledRequests([]);
      alertedRideIdsRef.current.clear();
      return;
    }

    const unsubHeatmap = subscribeToHeatmapActivity((points) => {
      setHeatPoints(points);
    });

    const unsubScheduled = subscribeToScheduledRides((rides) => {
      const targetRides = rides.filter(
        (r) =>
          !dismissedRequestIdsRef.current.includes(r.id) &&
          !(r.rejectedBy || []).includes(driver.id) &&
          !(r.offeringDriverIds || []).includes(driver.id),
      );
      const nearby = targetRides.filter((r) => {
        const loc = currentLocationRef.current;
        if (!loc || !r.pickup?.coords) return false;
        const radius = searchRadiusRef.current || 100;
        if (radius >= 100) return true;
        const dist = calculateDistance(
          loc.lat,
          loc.lng,
          r.pickup.coords.lat,
          r.pickup.coords.lng,
        );
        return dist <= radius;
      });
      setScheduledRequests(nearby);
    });

    const unsub = subscribeToDriverRequests(currentDriverProfile, (rides) => {
      const activeRequests = rides.filter((r) => {
        // Skip only if this driver CURRENTLY has a pending active offer on this ride
        const hasCurrentlyPendingOffer = activeOffersRef.current.some((ao) => ao.id === r.id);
        if (hasCurrentlyPendingOffer) return false;

        // If passenger increased the fare recently, re-send to ALL nearby drivers including drivers whose prior offer was rejected
        const isBoostedRecent =
          r.priceBoosted &&
          r.priceDirection !== "down" &&
          r.lastPriceUpdate &&
          Date.now() - r.lastPriceUpdate < 180000;
        if (isBoostedRecent) {
          return !(r.offeringDriverIds || []).includes(driver.id);
        }
        return (
          !dismissedRequestIdsRef.current.includes(r.id) &&
          !(r.rejectedBy || []).includes(driver.id) &&
          !(r.offeringDriverIds || []).includes(driver.id)
        );
      });

      const nearbyRequests = activeRequests.filter((r) => {
        const loc = currentLocationRef.current;
        if (!loc || !r.pickup?.coords) return false;
        const radius = searchRadiusRef.current || 100;
        if (radius >= 100) return true;
        const dist = calculateDistance(
          loc.lat,
          loc.lng,
          r.pickup.coords.lat,
          r.pickup.coords.lng,
        );
        return dist <= radius;
      });

      const freshRequests = nearbyRequests.filter((r) => {
        const lastTs = r.lastActiveAt || r.timestamp || 0;
        const age = Date.now() - lastTs;
        return age <= 600000;
      });

      const unalertedBoosted = freshRequests.filter(
        (r) =>
          r.priceBoosted &&
          r.priceDirection !== "down" &&
          r.lastPriceUpdate &&
          !alertedRideIdsRef.current.has(`${r.id}_boost_${r.lastPriceUpdate}`),
      );
      if (unalertedBoosted.length > 0) {
        const boostedIds = new Set(unalertedBoosted.map((r) => r.id));
        setDismissedRequestIds((prev) => prev.filter((id) => !boostedIds.has(id)));
      }

      setNewRequests((currentRequests) => {
        const currentIds = new Set(currentRequests.map((r) => r.id));
        const trulyNew = freshRequests.filter((r) => !currentIds.has(r.id));
        const boostedNew = freshRequests.filter(
          (r) =>
            r.priceBoosted &&
            r.priceDirection !== "down" &&
            r.lastPriceUpdate &&
            !alertedRideIdsRef.current.has(`${r.id}_boost_${r.lastPriceUpdate}`),
        );
        const adjustedDownNew = freshRequests.filter(
          (r) =>
            !r.priceBoosted &&
            r.priceChanged &&
            r.priceDirection === "down" &&
            r.lastPriceUpdate &&
            !alertedRideIdsRef.current.has(`${r.id}_price_${r.lastPriceUpdate}`),
        );

        // Logic to play sound and trigger push notifications for new incoming requests or updated fares
        if (trulyNew.length > 0 || boostedNew.length > 0 || adjustedDownNew.length > 0) {
          let shouldPlay = false;
          trulyNew.forEach((r) => {
            if (!alertedRideIdsRef.current.has(r.id)) {
              alertedRideIdsRef.current.add(r.id);
              shouldPlay = true;

              // Dispatch real push & system notification for new trip request
              const notifTitle = r.rideType === 'PARCEL'
                ? (isRTL ? "طلب توصيل طرد جديد! 📦" : "New Parcel Delivery Request! 📦")
                : (isRTL ? "طلب رحلة جديد! 🚗" : "New Trip Request! 🚗");
              const notifBody = `${isRTL ? "من: " : "Pickup: "}${(r.pickup?.address || "").substring(0, 45)} | ${isRTL ? "الأجرة: " : "Fare: "}${r.fare || r.price || 0} ${t("currency", "EGP")}`;

              CapacitorService.scheduleNotification(notifTitle, notifBody, Math.floor(Math.random() * 100000), true);

              if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
                try {
                  new Notification(notifTitle, {
                    body: notifBody,
                    icon: "/favicon.ico",
                    tag: `ride_req_${r.id}`,
                  });
                } catch (_nErr) {}
              }
            }
          });
          boostedNew.forEach((r) => {
            alertedRideIdsRef.current.add(`${r.id}_boost_${r.lastPriceUpdate}`);
            shouldPlay = true;
            const boostTitle = isRTL ? "تم رفع سعر الرحلة! 🔥" : "Trip Fare Increased! 🔥";
            const boostBody = `${r.fare || r.price || 0} ${t("currency", "EGP")} • ${(r.pickup?.address || "").substring(0, 38)}`;
            showTopNotification(
              {
                title: boostTitle,
                body: boostBody,
                type: "success",
              },
              8000,
              `boost_${r.id}_${r.lastPriceUpdate}`,
            );
            CapacitorService.scheduleNotification(boostTitle, boostBody, Math.floor(Math.random() * 100000), true);
          });
          adjustedDownNew.forEach((r) => {
            alertedRideIdsRef.current.add(`${r.id}_price_${r.lastPriceUpdate}`);
            const updTitle = isRTL ? "تم تعديل سعر الرحلة" : "Trip Fare Updated";
            const updBody = `${r.fare || r.price || 0} ${t("currency", "EGP")} • ${(r.pickup?.address || "").substring(0, 38)}`;
            showTopNotification(
              {
                title: updTitle,
                body: updBody,
                type: "status",
              },
              6000,
              `price_${r.id}_${r.lastPriceUpdate}`,
            );
          });

          if (shouldPlay) {
            playAlertSound("incoming_ride");
          }
        } else if (freshRequests.length === 0 && currentRequests.length > 0) {
          // Stop ringing if all requests are handled or expired
          stopAlertSound("incoming_ride");
        }
        return freshRequests;
      });
    });

    // Periodically prune any requests in newRequests that cross the 10-minute expiration threshold
    const pruneInterval = setInterval(() => {
      setNewRequests((currentRequests) => {
        if (currentRequests.length === 0) return currentRequests;
        const now = Date.now();
        const remaining = currentRequests.filter((r) => {
          const lastTs = r.lastActiveAt || r.timestamp || 0;
          return now - lastTs <= 600000;
        });
        if (remaining.length === 0 && currentRequests.length > 0) {
          stopAlertSound("incoming_ride");
        }
        return remaining.length === currentRequests.length ? currentRequests : remaining;
      });
    }, 15000);

    return () => {
      clearInterval(pruneInterval);
      unsubHeatmap();
      unsubScheduled();
      unsub();
    };
  }, [isOnline, currentDriverProfile.id, isRTL, t]);

  // Ensure driver FCM device token is registered and up to date when online
  useEffect(() => {
    if (isOnline && currentDriverProfile?.id) {
      if (Capacitor.isNativePlatform()) {
        CapacitorService.setupPushNotifications(currentDriverProfile.id).catch((e) => console.warn("Native push setup:", e));
      } else {
        saveDeviceToken(currentDriverProfile.id).catch((e) => console.warn("Web push setup:", e));
      }
    }
  }, [isOnline, currentDriverProfile?.id]);

  // ... (Rest of useEffects: geocoder, geolocation, checkActiveRide, etc. - No changes)
  useEffect(() => {
    if (!isOnline) {
      setActiveOffers([]);
      return;
    }
    const unsub = subscribeToDriverActiveOffers(driver.id, (rides) => {
      const newOffers = rides.filter(
        (r) => !(r.rejectedBy || []).includes(driver.id),
      );
      setActiveOffers((currentOffers) => {
        const currentIds = new Set(currentOffers.map((o) => o.id));
        const newlyAdded = newOffers.filter((o) => !currentIds.has(o.id));
        if (newlyAdded.length > 0) {
          playAlertSound("counter_offer");
        }
        return newOffers;
      });
    });
    return () => unsub();
  }, [driver.id, isOnline]);

  const lastGeocodedLocationRef = useRef<Coordinates | null>(null);

  useEffect(() => {
    if (!currentLocation) return;

    const shouldGeocode = () => {
      if (!lastGeocodedLocationRef.current) return true;
      const dist = calculateDistance(
        currentLocation.lat,
        currentLocation.lng,
        lastGeocodedLocationRef.current.lat,
        lastGeocodedLocationRef.current.lng,
      );
      // Only geocode if moved more than 150 meters
      return dist > 0.15;
    };

    if (shouldGeocode()) {
      geocodeCurrentLocation(currentLocation, false);
      lastGeocodedLocationRef.current = currentLocation;
    }
  }, [currentLocation, geocodeCurrentLocation]);

  const lastLocationUpdateRef = useRef<number>(0);
  const lastPublishedLocRef = useRef<Coordinates | null>(null);
  const hasRealGpsFixRef = useRef<boolean>(false);
  const lastAcceptedGpsAtRef = useRef<number>(0);
  const lastGoodAccuracyRef = useRef<number>(Infinity);

  useEffect(() => {
    let watchId: number | null = null;
    let listener: any = null;
    let isCancelled = false;

    const applyDriverPosition = (
      loc: Coordinates,
      rawHeading?: number | null,
      forceSync: boolean = false,
      accuracy?: number | null,
      speed?: number | null,
    ) => {
      if (
        isCancelled ||
        !loc ||
        typeof loc.lat !== "number" ||
        isNaN(loc.lat) ||
        typeof loc.lng !== "number" ||
        isNaN(loc.lng) ||
        (loc.lat === 0 && loc.lng === 0)
      ) {
        return;
      }

      const now = Date.now();
      const validAccuracy =
        typeof accuracy === "number" && !isNaN(accuracy) && accuracy > 0
          ? accuracy
          : null;

      // Reject coarse / noisy GPS spikes once we already have a reliable fix
      if (hasRealGpsFixRef.current && validAccuracy !== null) {
        const msSinceLastFix = now - lastAcceptedGpsAtRef.current;
        if (validAccuracy > 65 && !(msSinceLastFix > 20000 && validAccuracy <= 150)) {
          return;
        }
      } else if (!forceSync && validAccuracy !== null && validAccuracy > 250) {
        return;
      }

      const prevLoc = currentLocationRef.current;
      const movedMeters = prevLoc ? getDistance(prevLoc, loc) : Infinity;

      // Stationary GPS drift deadband: ignore < 6m micro-jitter unless accuracy improved substantially
      const accuracyImproved =
        validAccuracy !== null &&
        lastGoodAccuracyRef.current < Infinity &&
        lastGoodAccuracyRef.current - validAccuracy >= 15;
      if (hasRealGpsFixRef.current && !forceSync && prevLoc) {
        const isStationary =
          typeof speed !== "number" || isNaN(speed) || speed < 0.8;
        const deadbandMeters = isStationary ? 6 : 3;
        if (movedMeters < deadbandMeters && !(accuracyImproved && movedMeters >= 3)) {
          return;
        }
      }

      hasRealGpsFixRef.current = true;
      lastAcceptedGpsAtRef.current = now;
      if (validAccuracy !== null) {
        lastGoodAccuracyRef.current = Math.min(lastGoodAccuracyRef.current, validAccuracy);
      }

      // Only update heading when genuinely moving to stop marker spinning while parked
      let nextHeading: number | undefined;
      const isMovingFastEnough =
        typeof speed === "number" && !isNaN(speed) && speed >= 1.2;
      if (
        typeof rawHeading === "number" &&
        !isNaN(rawHeading) &&
        rawHeading >= 0 &&
        (isMovingFastEnough || movedMeters >= 10)
      ) {
        nextHeading = rawHeading;
      } else if (movedMeters >= 12 && prevLoc && movedMeters < 2000) {
        nextHeading = calculateBearing(prevLoc, loc);
      }

      if (nextHeading !== undefined) {
        const prevHeading = driverHeadingRef.current || 0;
        let hDiff = Math.abs(nextHeading - prevHeading) % 360;
        if (hDiff > 180) hDiff = 360 - hDiff;
        if (hDiff >= 5) {
          driverHeadingRef.current = nextHeading;
          setDriverHeading(nextHeading);
        }
      }

      currentLocationRef.current = loc;
      setCurrentLocation(loc);

      const publishedLoc = lastPublishedLocRef.current;
      const movedSincePublish = publishedLoc ? getDistance(publishedLoc, loc) : Infinity;
      if (!forceSync && (now - lastLocationUpdateRef.current < 2500 || movedSincePublish < 6)) {
        return;
      }
      lastLocationUpdateRef.current = now;
      lastPublishedLocRef.current = loc;

      const onlineNow = isOnlineRef.current;
      if (onlineNow) {
        updateDriverStatus(driver.id, true, loc).catch(e => {
          if (String(e).includes("permission")) {
            console.log("Permission error caught:", e);
          } else {
            console.error(e);
          }
        });
      }
      const active = activeRideRef.current;
      if (
        active &&
        (onlineNow ||
          active.status === RideStatus.ACCEPTED ||
          active.status === RideStatus.ARRIVED ||
          active.status === RideStatus.IN_PROGRESS)
      ) {
        updateRideDriverLocation(
          active.id,
          loc,
          nextHeading ?? driverHeadingRef.current ?? undefined,
        ).catch(console.error);
      }
    };

    const setupTracking = async () => {
      // Use our NativeLocation plugin if running natively
      if (Capacitor.isNativePlatform()) {
        try {
          // @ts-ignore
          const { NativeLocation } = await import("capacitor-native-location");

          NativeLocation.getCurrentLocation()
            .then((nativePos: any) => {
              if (nativePos && typeof nativePos.latitude === "number") {
                applyDriverPosition(
                  { lat: nativePos.latitude, lng: nativePos.longitude },
                  nativePos.heading,
                  true,
                  nativePos.accuracy,
                  nativePos.speed,
                );
              }
            })
            .catch(() => {});

          await NativeLocation.startTracking();

          listener = await NativeLocation.addListener(
            "onLocationUpdate",
            (pos: any) => {
              applyDriverPosition(
                { lat: pos.latitude, lng: pos.longitude },
                pos.heading,
                false,
                pos.accuracy,
                pos.speed,
              );
            },
          );
        } catch (err: any) {
          if (err?.code !== 1 && err?.message !== "Permission denied") {
            console.error("Failed to start NativeLocation", err);
          }
        }
      } else {
        // Web browser geolocation: prioritize high-accuracy fix; coarse fallback only if high-accuracy fails
        if (!navigator.geolocation) return;

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            applyDriverPosition(
              { lat: pos.coords.latitude, lng: pos.coords.longitude },
              pos.coords.heading,
              true,
              pos.coords.accuracy,
              pos.coords.speed,
            );
          },
          () => {
            if (!hasRealGpsFixRef.current) {
              navigator.geolocation.getCurrentPosition(
                (fallbackPos) => {
                  if (!hasRealGpsFixRef.current) {
                    applyDriverPosition(
                      {
                        lat: fallbackPos.coords.latitude,
                        lng: fallbackPos.coords.longitude,
                      },
                      fallbackPos.coords.heading,
                      true,
                      fallbackPos.coords.accuracy,
                      fallbackPos.coords.speed,
                    );
                  }
                },
                () => {},
                { enableHighAccuracy: false, timeout: 5000, maximumAge: 30000 },
              );
            }
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 3000 },
        );

        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            applyDriverPosition(
              { lat: pos.coords.latitude, lng: pos.coords.longitude },
              pos.coords.heading,
              false,
              pos.coords.accuracy,
              pos.coords.speed,
            );
          },
          (err) => {
            if (err?.code !== 1) {
              console.warn("Driver watch location notice:", err?.message || err);
            }
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
        );
      }
    };

    setupTracking();

    return () => {
      isCancelled = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (listener) listener.remove();
    };
  }, [driver.id]);

  // Immediately publish live driver coordinates to active ride when accepted / arrived / in-progress
  useEffect(() => {
    if (
      activeRide?.id &&
      currentLocationRef.current &&
      (rideStatus === RideStatus.ACCEPTED ||
        rideStatus === RideStatus.ARRIVED ||
        rideStatus === RideStatus.IN_PROGRESS)
    ) {
      updateRideDriverLocation(
        activeRide.id,
        currentLocationRef.current,
        driverHeading,
      ).catch(() => {});
    }
  }, [activeRide?.id, rideStatus]);

  useEffect(() => {
    const restore = async () => {
      const active = await checkActiveRide(driver.id, UserRole.DRIVER);
      if (active) {
        setActiveRide(active);
        activeRideRef.current = active;
        setRideStatus(active.status);
        const p = await getUserProfile(active.passengerId);
        if (p) setPassenger(p as User);
        setIsOnline(true);
      }
    };
    restore();
  }, [driver.id]);

  useEffect(() => {
    if (!activeRide?.id) {
      lastMessageIdRef.current = null;
      return;
    }

    const unsub = subscribeToRideMessages(activeRide.id, (msgs) => {
      if (msgs.length > 0) {
        const lastMsg = msgs[msgs.length - 1];

        // Initialize ref on first load to avoid notifying for existing messages
        if (lastMessageIdRef.current === null) {
          lastMessageIdRef.current = lastMsg.id || "initial";
          return;
        }

        if (lastMsg.id !== lastMessageIdRef.current) {
          if (
            lastMsg.senderId !== driver.id &&
            !isChatOpen &&
            !lastMsg.isSystem
          ) {
            setHasUnreadMessages(true);
            showTopNotification(
              {
                title: t("new_message"),
                body: lastMsg.text || (isRTL ? "رسالة صوتية" : "Voice message"),
                type: "message",
              },
              10000,
            );
            setTimeout(async () => {
              const { AudioService } = await import("../services/audioService");
              AudioService.play("chat_message");
            }, 300);
          }
          lastMessageIdRef.current = lastMsg.id || "unknown";
        }
      }
    });

    return () => unsub();
  }, [activeRide?.id, isChatOpen, driver.id, isRTL, t, showTopNotification]);

  useEffect(() => {
    const unsubscribe = subscribeToAssignedRide(driver.id, async (ride) => {
      if (ride) {
        const newStatus = ride.status;
        const oldStatus = prevRideStatus.current;

        if (newStatus !== oldStatus) {
          if (newStatus === RideStatus.ACCEPTED || newStatus === RideStatus.IN_PROGRESS) {
            setIsNavRouteMode(true);
            setIsMapAutoFollowing(true);
          }
          if (newStatus === RideStatus.ACCEPTED) {
            playAlertSound("accepted");
            setIsMinimized(false);
            setTimeout(() => {
              setIsMinimized(true);
            }, 15000);
            showTopNotification(
              {
                title: t("status_accepted"),
                body: isRTL
                  ? "قبل الراكب عرضك! ابدأ الرحلة الآن."
                  : "Passenger has accepted your offer! Start the trip now.",
                type: "success",
              },
              10000,
              `ride_accepted_${ride.id}`,
            );

            if (!sentWelcomeMessagesRef.current.has(ride.id)) {
              sentWelcomeMessagesRef.current.add(ride.id);
            }
          }
          prevRideStatus.current = newStatus;
        }

        setActiveRide(ride);
        activeRideRef.current = ride;
        setRideStatus(newStatus);

        if (ride.cancellationRequest?.status === "pending") {
          if (!showCancelApproval) {
            setShowCancelApproval(true);
            playAlertSound("cancelled"); // Cancel sound
          }
        } else {
          setShowCancelApproval(false);
        }

        if (ride.passengerId && passenger?.id !== ride.passengerId) {
          const p = await getUserProfile(ride.passengerId);
          if (p) setPassenger(p as User);
        }
      } else if (activeRideRef.current) {
        const endedRideId = activeRideRef.current.id;
        if (isCompletingRef.current) {
          showTopNotification(
            {
              title: t("driver_trip_completed_title"),
              body: t("driver_trip_completed_body"),
              type: "success",
            },
            10000,
            `ride_completed_${endedRideId}`,
          );
          isCompletingRef.current = false;
        } else {
          showTopNotification(
            {
              title: t("status_cancelled"),
              body: isRTL
                ? "تم إلغاء الرحلة من قبل الراكب."
                : "The ride was cancelled by the passenger.",
              type: "status",
            },
            10000,
            `ride_cancelled_${endedRideId}`,
          );
        }
        setRideStatus(RideStatus.IDLE);
        setActiveRide(null);
        activeRideRef.current = null;
        setPassenger(null);
        setIsChatOpen(false);
        setShowCancelApproval(false);
        flashAddressNotification();
      }
    });
    return () => unsubscribe();
  }, [driver.id, passenger, showCancelApproval, t, isRTL, showTopNotification]);

  // Mandatory Instant Sync Listener for current Active Ride to ensure 0-delay updates
  useEffect(() => {
    if (!activeRide?.id) return;
    const currentId = activeRide.id;
    const unsub = subscribeToRide(currentId, (rideData) => {
      if (rideData && rideData.status === RideStatus.CANCELLED) {
        playAlertSound("cancelled");
        showTopNotification(
          {
            title: t("status_cancelled"),
            body: isRTL
              ? "تم إلغاء الرحلة من قبل الراكب."
              : "The passenger cancelled the trip.",
            type: "status",
          },
          10000,
          `ride_cancelled_${currentId}`,
        );
        setRideStatus(RideStatus.IDLE);
        setActiveRide(null);
        activeRideRef.current = null;
        setPassenger(null);
        setIsChatOpen(false);
        setShowCancelApproval(false);
        flashAddressNotification();
      }
    });
    return () => unsub();
  }, [activeRide?.id, t, isRTL, showTopNotification]);

  const toggleOnline = () => {
    if (currentDriverProfile.status !== "approved") {
      alert(t("account_pending_desc"));
      return;
    }
    if (currentDriverProfile.isBlockedByFees) {
      setShowFeePopup(true);
      return;
    }

    if (audioRef.current) {
      audioRef.current
        .play()
        .then(() => {
          audioRef.current?.pause();
          if (audioRef.current) audioRef.current.currentTime = 0;
        })
        .catch(() => {});
    }

    if (
      !isOnline &&
      (currentDriverProfile?.isBanned ||
        (currentDriverProfile?.suspendedUntil ?? 0) > Date.now())
    ) {
      alert(
        isRTL
          ? "عذراً، حسابك موقوف حالياً ولا يمكنك استقبال الطلبات."
          : "Account is suspended or banned. You cannot go online.",
      );
      return;
    }

    const newStatus = !isOnline;
    setIsOnline(newStatus);
    CapacitorService.impact(newStatus ? ImpactStyle.Heavy : ImpactStyle.Medium);
    updateDriverStatus(driver.id, newStatus, currentLocationRef.current);

    if (newStatus) {
      geocodeCurrentLocation(currentLocationRef.current, false);
    } else {
      showTopNotification(
        {
          title: isRTL ? "وضع عدم الاتصال" : "Offline Mode",
          body: isRTL
            ? "أنت الآن خارج الخدمة. لن تتلقى طلبات رحلات جديدة حتى تعاود الاتصال."
            : "You are now offline. You will not receive new ride requests until you go back online.",
          type: "status",
        },
        6000,
        "offline_notice",
      );
    }
  };

  const handleUpdateRadius = async (val: number) => {
    setSearchRadius(val);
    try {
      await updateUserProfile(driver.id, { searchRadius: val } as any);
      setCurrentDriverProfile((prev) => ({ ...prev, searchRadius: val }));
    } catch (e) {
      console.error("Failed to update search radius", e);
    }
  };

  const forceRefreshLocation = async () => {
    setIsRefreshingLocation(true);
    try {
      let pos;
      if (Capacitor.isNativePlatform()) {
        // @ts-ignore
        const { NativeLocation } = await import("capacitor-native-location");
        const nativePos = await NativeLocation.getCurrentLocation();
        pos = {
          coords: {
            latitude: nativePos.latitude,
            longitude: nativePos.longitude,
          },
        };
      } else {
        pos = await new Promise<any>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve,
            () => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: false,
                timeout: 5000,
                maximumAge: 60000,
              });
            },
            {
              enableHighAccuracy: true,
              timeout: 6000,
              maximumAge: 3000,
            },
          );
        });
      }

      if (pos && pos.coords) {
        const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        currentLocationRef.current = newLoc;
        lastPublishedLocRef.current = newLoc;
        lastLocationUpdateRef.current = Date.now();
        hasRealGpsFixRef.current = true;
        if (typeof pos.coords.accuracy === "number" && pos.coords.accuracy > 0) {
          lastGoodAccuracyRef.current = pos.coords.accuracy;
        }
        setCurrentLocation(newLoc);
        geocodeCurrentLocation(newLoc, false);

        if (isOnline) {
          await updateDriverStatus(driver.id, true, newLoc);
          if (activeRide) {
            await updateRideDriverLocation(activeRide.id, newLoc);
          }
        }
        if (navigator.vibrate) navigator.vibrate(50);
      }
    } catch (err: any) {
      const errorMsg = CapacitorService.formatLocationError(err);
      if (err?.code !== 1) {
        console.warn("Driver location notice:", errorMsg, err?.message || err);
      }
      alert(
        isRTL
          ? "تعذر تحديث الموقع. تحقق من الـ GPS والصلاحيات."
          : `${errorMsg} Check GPS.`,
      );
    } finally {
      setIsRefreshingLocation(false);
    }
  };

  const handleAcceptRide = async (
    ride: Ride,
    finalFare?: number,
    offerId?: string,
  ) => {
    try {
      CapacitorService.impact(ImpactStyle.Heavy);

      if (offerId && finalFare) {
        await driverAcceptsCounterOffer(
          ride.id,
          offerId,
          currentDriverProfile.id,
          finalFare,
        );
        showTopNotification(
          {
            title: t("offer_accepted_title", "Offer Accepted"),
            body: isRTL ? "تم قبول العرض المضاد!" : "Counter offer accepted!",
            type: "success",
          },
          8000,
        );
        setSelectedRequest(null);
        playAlertSound("accepted");
        return;
      }

      // Instead of immediate accept, send an offer with the finalFare or original fare
      const fareToOffer = finalFare || ride.fare;
      const driverToSend: Driver = {
        ...currentDriverProfile,
        currentLocation: currentDriverProfile.currentLocation || currentLocation,
      };
      const newOfferId = await proposeRideOffer(
        ride.id,
        driverToSend,
        fareToOffer,
      );

      showTopNotification(
        {
          title: t("offer_sent_title", "Offer Sent"),
          body: t(
            "offer_sent_excl",
            "Driver offered accepted! Waiting for passenger confirmation.",
          ),
          type: "success",
        },
        8000,
      );
      setSelectedRequest(null);
      playAlertSound("counter_offer");

      const offerExpiryMs = OFFER_WAIT_SECONDS * 1000;
      setTimeout(() => {
        expireRideOfferTimeout(ride.id, newOfferId, currentDriverProfile.id);
      }, offerExpiryMs);
    } catch (e) {
      console.error("Accept ride error:", e);
      alert(t("ride_unavailable"));
    }
  };

  const handleSendOffer = async (ride: Ride, price: number) => {
    try {
      const driverToSend: Driver = {
        ...currentDriverProfile,
        currentLocation: currentDriverProfile.currentLocation || currentLocation,
      };
      const offerId = await proposeRideOffer(
        ride.id,
        driverToSend,
        price,
      );
      showTopNotification(
        {
          title: t("offer_sent_title"),
          body: t("offer_sent_excl"),
          type: "success",
        },
        8000,
      );
      setSelectedRequest(null);

      const offerExpiryMs = OFFER_WAIT_SECONDS * 1000;
      setTimeout(() => {
        expireRideOfferTimeout(ride.id, offerId, currentDriverProfile.id);
      }, offerExpiryMs);
    } catch (e) {
      if(String(e).includes('permission')) { console.log('Permission error caught:', e); } else { console.error(e); };
      alert("Failed to send offer");
    }
  };

  const handleTogglePinRequest = (ride: Ride) => {
    setPinnedRequestIds((prev) =>
      prev.includes(ride.id)
        ? prev.filter((id) => id !== ride.id)
        : [ride.id, ...prev],
    );
  };

  const handleRejectRequest = (ride: Ride) => {
    setDismissedRequestIds((prev) =>
      prev.includes(ride.id) ? prev : [...prev, ride.id],
    );
    setPinnedRequestIds((prev) => prev.filter((id) => id !== ride.id));
    setNewRequests((prev) => prev.filter((r) => r.id !== ride.id));
    setScheduledRequests((prev) => prev.filter((r) => r.id !== ride.id));
    setSelectedRequest((prev) => (prev?.id === ride.id ? null : prev));
    rejectRideRequestByDriver(ride.id, driver.id);
  };

  const handleUpdateStatus = async (newStatus: RideStatus, bypassPinCheck = false) => {
    if (!activeRide) return;
    if (
      newStatus === RideStatus.IN_PROGRESS &&
      !bypassPinCheck &&
      activeRide.rideVerificationEnabled &&
      !activeRide.verificationVerified
    ) {
      setVerificationPinInput("");
      setVerificationPinError(null);
      setShowVerificationPinModal(true);
      return;
    }

    setStatusUpdating(true);
    CapacitorService.impact(ImpactStyle.Medium);
    try {
      if (newStatus === RideStatus.CANCELLED) {
        await driverCancelAndReassignRide(activeRide.id, driver.id);
        await sendMessage(
          activeRide.id,
          "system",
          isRTL
            ? "إلغاء السائق، جاري البحث عن بديل..."
            : "Driver canceled, reassigning...",
          true,
        );
        setRideStatus(RideStatus.IDLE);
        setActiveRide(null);
      } else {
        await updateRideStatus(activeRide.id, newStatus);
        setRideStatus(newStatus);
        if (newStatus === RideStatus.IN_PROGRESS) {
          setIsNavRouteMode(true);
          setIsMapAutoFollowing(true);
        }
      }
    } catch (e) {
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleConfirmRideStartPin = async () => {
    if (!activeRide) return;
    if (verificationPinInput.trim().length !== 4) {
      setVerificationPinError(t("invalid_verification_pin"));
      return;
    }
    setIsVerifyingPin(true);
    setVerificationPinError(null);
    try {
      const res = await verifyRideStartCode(activeRide.id, verificationPinInput.trim());
      if (!res.success) {
        if (res.error === "EXPIRED") {
          setVerificationPinError(t("verification_expired"));
        } else if (res.error === "TOO_MANY_ATTEMPTS") {
          setVerificationPinError(t("verification_too_many_attempts"));
        } else {
          setVerificationPinError(t("invalid_verification_pin"));
        }
        HapticsService.heavy();
        return;
      }
      setShowVerificationPinModal(false);
      setVerificationPinInput("");
      HapticsService.success();
      await handleUpdateStatus(RideStatus.IN_PROGRESS, true);
    } catch (e) {
      setVerificationPinError(t("invalid_verification_pin"));
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const handleFinalizeTrip = async (methodOverride?: PaymentMethod) => {
    if (!activeRide || !passenger) return;
    const method = methodOverride || activeRide.paymentMethod;

    // If method is INSTAPAY we don't complete immediately unless it's already confirmed
    if (
      method === PaymentMethod.INSTAPAY &&
      activeRide.paymentStatus !== PaymentStatus.PAID
    ) {
      setShowPaymentChoice(false);
      setStatusUpdating(true);
      try {
        // Mark ride as using InstaPay and signal passenger to pay if not already done
        await updateDoc(doc(db, "rides", activeRide.id), {
          paymentMethod: PaymentMethod.INSTAPAY,
          paymentStatus: activeRide.paymentStatus || PaymentStatus.PENDING,
          lastActiveAt: Date.now(),
        });
        showTopNotification(
          {
            title: isRTL ? "انتظار الدفع" : "Waiting for Payment",
            body: isRTL
              ? "اطلب من الراكب مسح الكود والدفع عبر إنستاباي."
              : "Ask passenger to scan QR and pay via InstaPay.",
            type: "status",
          },
          10000,
        );
      } catch (e) {
        if(String(e).includes('permission')) { console.log('Permission error caught:', e); } else { console.error(e); };
      } finally {
        setStatusUpdating(false);
      }
      return;
    }

    setStatusUpdating(true);
    isCompletingRef.current = true;
    try {
      await completeRide(
        activeRide.id,
        activeRide.fare,
        driver.id,
        passenger.id,
        method,
      );
      setShowPaymentChoice(false);
      setActiveRide(null);
      setRideStatus(RideStatus.IDLE);
    } catch (e: any) {
      isCompletingRef.current = false;
      alert(e.message || t("error_completing_trip"));
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleResolveCancellation = async (
    resolution: "approved" | "rejected",
  ) => {
    if (!activeRide) return;
    try {
      await resolveCancellationRequest(activeRide.id, resolution);
      setShowCancelApproval(false);
    } catch (e) {
      if(String(e).includes('permission')) { console.log('Permission error caught:', e); } else { console.error(e); };
      alert("Error processing request");
    }
  };

  const forceOffline = useCallback(() => {
    setIsOnline(false);
    updateDriverStatus(driver.id, false, currentLocation);
  }, [driver.id, currentLocation]);

  const drivers = useMemo(
    () => [
      {
        id: driver.id,
        lat: currentLocation.lat,
        lng: currentLocation.lng,
        heading: driverHeading,
      },
    ],
    [driver.id, currentLocation.lat, currentLocation.lng, driverHeading],
  );

  const navTargetCoords = useMemo(() => {
    if (!activeRide) return null;
    if (rideStatus === RideStatus.IN_PROGRESS) {
      return activeRide.dropoff?.coords || null;
    }
    return activeRide.pickup?.coords || null;
  }, [activeRide, rideStatus]);

  const isDriverHeadingToPickup =
    !!activeRide &&
    (rideStatus === RideStatus.ACCEPTED || rideStatus === RideStatus.ARRIVED);
  const isDriverHeadingToDropoff =
    !!activeRide && rideStatus === RideStatus.IN_PROGRESS;
  return (
    <LocationGuard type="driver" onOfflineForce={forceOffline}>
      <div
        className="h-full w-full relative bg-gray-100 overflow-hidden"
        dir={isRTL ? "rtl" : "ltr"}
      >
        {!isOnline && (
          <div
            className="fixed inset-0 pointer-events-none z-[1000] border-[4px] border-red-500/50 animate-pulse"
            style={{ boxShadow: "inset 0 0 20px rgba(239, 68, 68, 0.2)" }}
          ></div>
        )}
        {isOnline && !activeRide && pendingRequests.length > 0 && (
          <div
            className="fixed inset-0 pointer-events-none z-[1000] animate-pulse"
            style={{
              borderWidth: "clamp(3px, 1vw, 6px)",
              borderStyle: "solid",
              borderImage:
                "linear-gradient(45deg, #10b981, #3b82f6, #8b5cf6, #10b981) 1",
              boxShadow:
                "inset 0 0 25px rgba(16, 185, 129, 0.3), 0 0 15px rgba(59, 130, 246, 0.4)",
            }}
          ></div>
        )}
        {isChatOpen && activeRide && passenger && (
          <ChatPanel
            rideId={activeRide.id}
            currentUserId={driver.id}
            otherUserName={passenger.name}
            otherUserPhone={passenger.phone}
            onClose={() => setIsChatOpen(false)}
            isPassenger={false}
            passengerId={passenger.id}
          />
        )}
        <audio
          ref={audioRef}
          src={NOTIFICATION_SOUND_URL}
          preload="auto"
          playsInline
        />
        <audio
          ref={successAudioRef}
          src={SUCCESS_SOUND_URL}
          preload="auto"
          playsInline
        />
        <audio
          ref={ringAudioRef}
          src={NOTIFICATION_SOUND_URL}
          preload="auto"
          playsInline
          loop
        />

        {/* Free Trial Banner Popup */}
        {showTrialBannerPopup && trialRemaining && (
          <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none p-4">
            <div
              className={`mx-auto max-w-md ${trialRemaining.days < 3 ? "bg-gradient-to-r from-red-500 to-orange-500 shadow-red-500/50" : "bg-gradient-to-r from-blue-600 to-indigo-600 shadow-indigo-600/50"} rounded-2xl shadow-lg overflow-hidden pointer-events-auto border border-white/20 backdrop-blur-md relative`}
            >
              <button
                onClick={() => {
                  setShowTrialBannerPopup(false);
                  localStorage.setItem(`hasShownTrialBanner_${driver.id}`, "true");
                  localStorage.setItem("hasShownTrialBanner", "true");
                }}
                className="absolute top-2 right-2 z-20 text-white/70 hover:text-white p-2"
              >
                <i className="fas fa-times"></i>
              </button>
              <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
              <div className="p-4 flex flex-col items-center justify-center relative z-10 text-white">
                <div className="flex justify-center items-center gap-2 mb-2">
                  <i className="fas fa-gift text-xl animate-bounce"></i>
                  <span className="font-black text-sm uppercase tracking-wider">
                    {isRTL
                      ? "أنت تستمتع بفترة تجريبية 0٪ عمولة"
                      : "You are enjoying 0% commission free trial"}
                  </span>
                </div>
                <div
                  className="flex items-center justify-center gap-2 text-center"
                  dir="ltr"
                >
                  <div className="flex flex-col items-center">
                    <span
                      className={`text-2xl font-black ${trialRemaining.days < 3 ? "text-yellow-200" : "text-white"}`}
                    >
                      {String(trialRemaining.days).padStart(2, "0")}
                    </span>
                    <span className="text-[10px] font-bold uppercase opacity-80">
                      Days
                    </span>
                  </div>
                  <span className="text-xl font-black opacity-50 mb-3">:</span>
                  <div className="flex flex-col items-center">
                    <span className="text-2xl font-black">
                      {String(trialRemaining.hours).padStart(2, "0")}
                    </span>
                    <span className="text-[10px] font-bold uppercase opacity-80">
                      Hrs
                    </span>
                  </div>
                  <span className="text-xl font-black opacity-50 mb-3">:</span>
                  <div className="flex flex-col items-center">
                    <span className="text-2xl font-black">
                      {String(trialRemaining.mins).padStart(2, "0")}
                    </span>
                    <span className="text-[10px] font-bold uppercase opacity-80">
                      Min
                    </span>
                  </div>
                  <span className="text-xl font-black opacity-50 mb-3">:</span>
                  <div className="flex flex-col items-center w-8">
                    <span className="text-2xl font-black">
                      {String(trialRemaining.secs).padStart(2, "0")}
                    </span>
                    <span className="text-[10px] font-bold uppercase opacity-80">
                      Sec
                    </span>
                  </div>
                </div>
                <div className="mt-2 text-[10px] font-medium opacity-80 bg-black/20 rounded-full px-3 py-1">
                  {isRTL
                    ? `مجاني حتى ${new Date(currentDriverProfile.trialEndDate!).toLocaleString("ar-EG", { dateStyle: "long", timeStyle: "short" })}`
                    : `Free until ${new Date(currentDriverProfile.trialEndDate!).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}`}
                </div>
              </div>
            </div>
          </div>
        )}

        <Map
          pickup={isDriverHeadingToPickup ? (activeRide?.pickup?.coords || null) : null}
          dropoff={isDriverHeadingToDropoff ? (activeRide?.dropoff?.coords || null) : null}
          pickupAddress={isDriverHeadingToPickup ? activeRide?.pickup?.address : undefined}
          dropoffAddress={isDriverHeadingToDropoff ? activeRide?.dropoff?.address : undefined}
          drivers={drivers}
          showRoute={!!activeRide && !!navTargetCoords}
          routeStart={activeRide ? currentLocation : null}
          routeEnd={navTargetCoords}
          centerOn={currentLocation}
          topPadding={activeRide ? 96 : 0}
          bottomPadding={activeRide ? (isMinimized ? 115 : 335) : 0}
          showLocationPopup={false}
          currentAddress={undefined}
          heatPoints={showHeatmap && !activeRide ? heatPoints : undefined}
          isMapAutoFollowing={isMapAutoFollowing}
          navigationFollowMode={!!activeRide && isNavRouteMode}
          driverHeading={driverHeading}
          onMapDrag={() => setIsMapAutoFollowing(false)}
        />

        {currentDriverProfile.status === "pending" && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-md p-6 overflow-hidden">
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", damping: 20, stiffness: 200 }}
              className="bg-white rounded-[48px] p-10 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.3)] flex flex-col items-center justify-center text-center gap-6 border border-gray-100 relative group"
              style={{ width: "350px", height: "250px" }}
            >
              {/* Floating Decorative Elements */}
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-yellow-400/20 rounded-full blur-2xl animate-pulse"></div>
              <div className="absolute -bottom-10 -left-6 w-32 h-32 bg-blue-400/10 rounded-full blur-3xl"></div>

              <div className="w-20 h-20 bg-yellow-400 rounded-[28px] flex items-center justify-center mb-1 transform rotate-6 shadow-[0_12px_24px_-8px_rgba(255,201,14,0.6)] group-hover:rotate-0 transition-transform duration-500">
                <i className="fas fa-hourglass-half text-white text-3xl animate-spin-slow"></i>
              </div>

              <div className="space-y-3">
                <h3 className="text-2xl font-black text-gray-900 leading-none tracking-tight">
                  {t("account_pending_desc")}
                </h3>
                <p className="text-gray-400 text-xs font-black uppercase tracking-[0.2em] opacity-80">
                  {isRTL ? "مراجعة المستندات" : "Reviewing Documents"}
                </p>
              </div>

              <div className="h-1.5 w-32 bg-gray-100 rounded-full overflow-hidden mt-2">
                <motion.div
                  className="h-full bg-yellow-400"
                  animate={{ x: ["-100%", "100%"] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              </div>
            </motion.div>
          </div>
        )}

        {topNotification && (
          <div className="fixed top-safe mt-4 left-4 right-4 z-[1001] animate-fade-in-up">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] p-4 border-l-4 flex flex-col gap-2 ${
                topNotification.type === "message"
                  ? "border-blue-500"
                  : "border-green-500"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    topNotification.type === "message"
                      ? "bg-blue-100 text-blue-600"
                      : "bg-green-100 text-green-600"
                  }`}
                >
                  {topNotification.type === "message" ? (
                    <MessageSquare className="w-5 h-5" />
                  ) : (
                    <CheckCircle className="w-5 h-5" />
                  )}
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
                  onClick={clearTopNotification}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {topNotification.type === "message" && (
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => {
                      clearTopNotification();
                      setIsChatOpen(true);
                      setHasUnreadMessages(false);
                    }}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-xs font-bold shadow-md hover:bg-blue-700 transition-colors"
                  >
                    {t("view_chat")}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}

        {activeRide ? (
          <>
            <div
              className={`absolute top-safe ${currentDriverProfile.status === "pending" ? "mt-14" : "mt-4"} left-4 right-4 z-[49] flex items-center justify-center pointer-events-none`}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: -10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                className="bg-[#EFFFEC] border-2 border-green-400 px-6 py-2 rounded-full flex flex-col items-center justify-center relative overflow-hidden shadow-[0_4px_20px_rgba(34,197,94,0.3)] pointer-events-auto"
              >
                <div className="absolute top-0 left-0 right-0 h-1/2 bg-white/40 rounded-t-full pointer-events-none"></div>
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/80 to-transparent z-0 pointer-events-none"
                  animate={{ x: ["-200%", "200%"] }}
                  transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 2 }}
                />
                <span className="text-[10px] font-black text-green-700 uppercase tracking-widest relative z-10 drop-shadow-[0_1px_1px_rgba(255,255,255,1)]">
                  {isRTL ? "إجمالي الأرباح" : "Earnings"}
                </span>
                <div className="flex items-center gap-1.5 relative z-10 font-sans">
                  <span className="text-2xl font-black text-green-800 leading-none drop-shadow-sm">
                    {activeRide.driverNet
                      ? activeRide.driverNet.toFixed(2)
                      : activeRide.fare.toFixed(2)}
                  </span>
                  <span className="text-xs font-black text-green-700 mt-1">
                    {t("currency")}
                  </span>
                </div>
              </motion.div>
            </div>

            {/* Map Navigation Mode Toggle Bar (Switch between Live Movement Route & Overview + Google Maps) */}
            <div
              className={`absolute top-safe ${currentDriverProfile.status === "pending" ? "mt-32" : "mt-20"} left-4 right-4 z-[48] flex flex-wrap items-center justify-between gap-2 pointer-events-none`}
            >
              <div className="flex items-center gap-2 pointer-events-auto">
                <button
                  type="button"
                  onClick={() => {
                    HapticsService.light();
                    if (!isNavRouteMode) {
                      setIsNavRouteMode(true);
                      setIsMapAutoFollowing(true);
                    } else if (!isMapAutoFollowing) {
                      setIsMapAutoFollowing(true);
                    } else {
                      setIsNavRouteMode(false);
                      setIsMapAutoFollowing(true);
                    }
                  }}
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl shadow-lg border font-black text-xs transition-all active:scale-95 ${
                    isNavRouteMode
                      ? "bg-[#1f44df] text-white border-blue-400 shadow-blue-500/30"
                      : "bg-white/95 text-gray-900 border-gray-200 hover:bg-white"
                  }`}
                >
                  {isNavRouteMode ? (
                    <Navigation className="w-4 h-4 animate-pulse" />
                  ) : (
                    <Route className="w-4 h-4 text-[#1f44df]" />
                  )}
                  <div className="flex flex-col items-start leading-none">
                    <span>
                      {isNavRouteMode
                        ? isRTL ? "تتبع مسار التحرك" : "Live Route View"
                        : isRTL ? "تفعيل مسار التحرك" : "Switch to Route View"}
                    </span>
                    <span className={`text-[9px] font-bold mt-0.5 ${isNavRouteMode ? "text-blue-100" : "text-gray-500"}`}>
                      {rideStatus === RideStatus.IN_PROGRESS
                        ? isRTL ? "التوجه للوجهة" : "To Destination"
                        : isRTL ? "التوجه للراكب" : "To Passenger"}
                    </span>
                  </div>
                </button>

                {!isMapAutoFollowing && (
                  <button
                    type="button"
                    onClick={() => {
                      HapticsService.light();
                      setIsMapAutoFollowing(true);
                    }}
                    className="w-10 h-10 rounded-2xl bg-white/95 text-[#1f44df] border border-gray-200 shadow-lg flex items-center justify-center active:scale-95 transition-transform"
                    title={isRTL ? "إعادة التمركز" : "Recenter"}
                  >
                    <Compass className="w-5 h-5" />
                  </button>
                )}
              </div>

              {navTargetCoords && (
                <button
                  type="button"
                  onClick={() => {
                    HapticsService.medium();
                    openNavigation(navTargetCoords.lat, navTargetCoords.lng);
                  }}
                  className="pointer-events-auto flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white/95 hover:bg-white text-gray-900 border border-gray-200 shadow-lg font-black text-xs active:scale-95 transition-all"
                >
                  <i className="fas fa-map-marked-alt text-emerald-600 text-sm"></i>
                  <span>{isRTL ? "مسار خرائط جوجل" : "Google Maps Route"}</span>
                </button>
              )}
            </div>
          </>
        ) : (
          <div
            className={`absolute top-safe ${currentDriverProfile.status === "pending" ? "mt-14" : "mt-4"} left-4 right-4 z-50 flex items-center justify-between pointer-events-auto bg-white/90 backdrop-blur-md rounded-[30px] p-2 shadow-sm border border-gray-100 overflow-visible`}
            style={{
              paddingTop: "6px",
              marginLeft: "-14px",
              marginTop: "8px",
              marginBottom: "0px",
              marginRight: "-10px",
            }}
          >
            {/* Space for the hamburger menu from App.tsx */}
            <div className="w-10 h-10 flex-shrink-0"></div>

            <div className="flex-1 flex justify-center items-center">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <img
                    src={
                      currentDriverProfile?.avatar ||
                      "https://via.placeholder.com/150"
                    }
                    alt="Driver profile"
                    className={`w-9 h-9 rounded-full object-cover border-2 shadow-sm ${isOnline ? "border-green-500" : "border-red-500"}`}
                  />
                  <div
                    className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${isOnline ? "bg-green-500 animate-pulse" : "bg-red-500"}`}
                  ></div>
                </div>
                <div className="flex flex-col items-start justify-center">
                  <span className="font-bold text-sm text-gray-800 leading-tight">
                    {currentDriverProfile?.name || "Driver"}
                  </span>
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-gray-500">
                    <i className="fas fa-star text-yellow-500 text-[9px]"></i>
                    <span>
                      {(currentDriverProfile?.rating || 5.0).toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0 relative">
              {/* Fast Online / Offline small quick toggle button */}
              <button
                type="button"
                onClick={toggleOnline}
                title={isOnline ? (isRTL ? "متصل - اضغط للتحويل إلى غير متصل" : "Online - Tap to go Offline") : (isRTL ? "غير متصل - اضغط للتحويل إلى متصل" : "Offline - Tap to go Online")}
                aria-label={isOnline ? "Go Offline" : "Go Online"}
                className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 shadow-xs cursor-pointer ${
                  isOnline
                    ? "bg-emerald-500 hover:bg-emerald-600 text-white ring-2 ring-emerald-400/40"
                    : "bg-rose-500 hover:bg-rose-600 text-white ring-2 ring-rose-400/40"
                }`}
              >
                <i className={`fas fa-power-off text-[9px] ${isOnline ? "animate-pulse" : ""}`}></i>
              </button>

              <button
                type="button"
                onClick={() => setShowDriverScheduledModal(true)}
                className="px-2.5 h-9 rounded-full bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 flex items-center gap-1.5 text-indigo-700 font-black text-[11px] active:scale-95 transition-all"
                title={isRTL ? "الرحلات المجدولة" : "Scheduled Rides"}
              >
                <i className="fas fa-calendar-check text-indigo-600 text-xs"></i>
                <span className="hidden xs:inline">
                  {isRTL ? "المجدولة" : "Scheduled"}
                </span>
                {scheduledRequests.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-indigo-600 text-white text-[10px]">
                    {scheduledRequests.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setShowSettingsToolbar(true)}
                className="w-11 h-11 rounded-full bg-white shadow-[0_2px_10px_rgba(0,0,0,0.05)] border border-gray-100 flex items-center justify-center text-gray-700 hover:bg-gray-50 active:scale-95 transition-all"
                title={isRTL ? "إعدادات السائق" : "Driver Settings"}
              >
                <i className="fas fa-cog text-xl"></i>
              </button>

              {/* Keep radius slider here so it remains positioned properly when triggered */}
              {showRadiusSlider && (
                <div
                  className="bg-white/95 backdrop-blur-md p-4 shadow-2xl border border-gray-100 animate-slide-up w-64 absolute top-14 right-0 z-[100]"
                  style={{
                    marginLeft: "0px",
                    paddingTop: "15px",
                    marginTop: "0px",
                    marginBottom: "0px",
                    marginRight: "-250px",
                    borderRadius: "30px",
                  }}
                >
                  <div className="flex justify-between items-center mb-3 px-1">
                    <span
                      className="text-[10px] font-black text-gray-400 uppercase tracking-widest"
                      style={{ color: "#323435", fontSize: "14px" }}
                    >
                      {t("search_radius_label")}
                    </span>
                    <button
                      onClick={() => setShowRadiusSlider(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <i className="fas fa-times-circle text-lg"></i>
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between font-bold text-xs text-blue-600">
                      <span className="w-12">1 {t("km")}</span>
                      <span className="flex-1 text-center">
                        {searchRadius > 1 && searchRadius < 100 ? `${searchRadius} ${t("km")}` : ""}
                      </span>
                      <span className="w-12 text-end">∞</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={searchRadius}
                      onChange={(e) =>
                        handleUpdateRadius(Number(e.target.value))
                      }
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#FFC90E]"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- Settings Bottom Sheet Toolbar --- */}
        <AnimatePresence>
          {showSettingsToolbar && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 z-[200] backdrop-blur-sm pointer-events-auto"
                onClick={() => setShowSettingsToolbar(false)}
              />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl z-[201] rounded-t-[32px] p-6 pt-4 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] border-t border-gray-100 pointer-events-auto"
                dir={isRTL ? "rtl" : "ltr"}
                drag="y"
                dragConstraints={{ top: 0 }}
                dragElastic={0.2}
                onDragEnd={(_, info) => {
                  if (info.offset.y > 100) setShowSettingsToolbar(false);
                }}
              >
                {/* Drag Handle */}
                <div className="w-12 h-1.5 bg-gray-300/50 rounded-full mx-auto mb-6"></div>

                <div className="grid grid-cols-4 sm:grid-cols-5 gap-y-6 gap-x-4 mb-6">
                  {/* Search Radius Item */}
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={() => {
                        setShowSettingsToolbar(false);
                        setShowRadiusSlider(true);
                      }}
                      className="w-14 h-14 rounded-2xl bg-blue-50 text-red-600 flex flex-col items-center justify-center shadow-[0_4px_12px_rgba(59,130,246,0.1)] hover:bg-blue-100 transition-colors"
                    >
                      <span className="font-black text-lg leading-none">
                        {searchRadius === 100 ? "∞" : searchRadius}
                      </span>
                      {searchRadius !== 100 && (
                        <span className="text-[9px] font-bold mt-0.5">
                          {t("km")}
                        </span>
                      )}
                    </button>
                    <span className="text-[10px] font-bold text-gray-700 text-center leading-tight">
                      {isRTL ? "نطاق البحث" : "Search Radius"}
                    </span>
                  </div>

                  {/* Heatmap Item */}
                  {!activeRide && (
                    <div className="flex flex-col items-center gap-2">
                      <button
                        onClick={() => {
                          handleToggleHeatmap();
                          setShowSettingsToolbar(false);
                        }}
                        className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center transition-colors shadow-sm ${showHeatmap ? "bg-red-50 text-red-600 shadow-[0_4px_12px_rgba(239,68,68,0.1)]" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}
                      >
                        <i className="fas fa-fire-alt text-xl"></i>
                      </button>
                      <span className="text-[10px] font-bold text-gray-700 text-center leading-tight">
                        {isRTL ? "خريطة الطلب" : "Heatmap"}
                      </span>
                    </div>
                  )}

                  {/* Location View Item */}
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={() => {
                        setShowAddressBar((prev) => !prev);
                        setShowSettingsToolbar(false);
                      }}
                      className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-[0_4px_12px_rgba(99,102,241,0.1)] hover:bg-indigo-100 transition-colors"
                    >
                      <i className="fas fa-map-marker-alt text-xl"></i>
                    </button>
                    <span className="text-[10px] font-bold text-gray-700 text-center leading-tight">
                      {isRTL ? "الموقع" : "Location"}
                    </span>
                  </div>

                  {/* Wallet Item */}
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={() => {
                        setShowFinancialPanel(true);
                        setShowSettingsToolbar(false);
                      }}
                      className="w-14 h-14 rounded-2xl bg-yellow-50 text-yellow-600 flex items-center justify-center shadow-[0_4px_12px_rgba(234,179,8,0.1)] hover:bg-yellow-100 transition-colors"
                    >
                      <i className="fas fa-wallet text-xl"></i>
                    </button>
                    <span className="text-[10px] font-bold text-gray-700 text-center leading-tight">
                      {isRTL ? "المحفظة" : "Wallet"}
                    </span>
                  </div>

                  {/* Insights Item */}
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={() => {
                        setShowInsights(true);
                        setShowSettingsToolbar(false);
                      }}
                      className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shadow-[0_4px_12px_rgba(168,85,247,0.1)] hover:bg-purple-100 transition-colors"
                    >
                      <i className="fas fa-lightbulb text-xl"></i>
                    </button>
                    <span className="text-[10px] font-bold text-gray-700 text-center leading-tight">
                      {isRTL ? "رؤى ذكية" : "Insights"}
                    </span>
                  </div>

                  {/* Vehicle Management Item */}
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={() => {
                        setShowVehicleManager(true);
                        setShowSettingsToolbar(false);
                      }}
                      className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-[0_4px_12px_rgba(16,185,129,0.1)] hover:bg-emerald-100 transition-colors"
                    >
                      <i className="fas fa-car text-xl"></i>
                    </button>
                    <span className="text-[10px] font-bold text-gray-700 text-center leading-tight">
                      {isRTL ? "المركبة" : "Vehicle"}
                    </span>
                  </div>

                  {/* Rewards Item */}
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={() => {
                        setShowRewards(true);
                        setShowSettingsToolbar(false);
                      }}
                      className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center shadow-[0_4px_12px_rgba(249,115,22,0.1)] hover:bg-orange-100 transition-colors"
                    >
                      <i className="fas fa-gift text-xl"></i>
                    </button>
                    <span className="text-[10px] font-bold text-gray-700 text-center leading-tight">
                      {isRTL ? "المكافآت" : "Rewards"}
                    </span>
                  </div>

                  {/* Scheduled Rides Item */}
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={() => {
                        setShowDriverScheduledModal(true);
                        setShowSettingsToolbar(false);
                      }}
                      className="w-14 h-14 rounded-2xl bg-blue-50 text-[#1f44df] flex items-center justify-center shadow-[0_4px_12px_rgba(31,68,223,0.12)] hover:bg-blue-100 transition-colors relative"
                    >
                      <i className="fas fa-calendar-check text-xl"></i>
                      {scheduledRequests.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#FFC90E] text-black text-[10px] font-black flex items-center justify-center">
                          {scheduledRequests.length}
                        </span>
                      )}
                    </button>
                    <span className="text-[10px] font-bold text-gray-700 text-center leading-tight">
                      {isRTL ? "الرحلات المجدولة" : "Scheduled Rides"}
                    </span>
                  </div>
                </div>

                <div className="flex gap-4 mb-2">
                  {/* Refresh GPS Button */}
                  <button
                    onClick={() => {
                      forceRefreshLocation();
                      setIsMapAutoFollowing(true);
                      setShowSettingsToolbar(false);
                    }}
                    disabled={isRefreshingLocation}
                    className={`flex-1 h-14 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-all ${isMapAutoFollowing ? "bg-blue-50 text-blue-600 border border-blue-100" : "bg-gray-50 text-gray-600 border border-gray-200"}`}
                  >
                    <i
                      className={`fas ${isRefreshingLocation ? "fa-spinner fa-spin" : "fa-location-crosshairs"} text-lg`}
                    ></i>
                    <span>{isRTL ? "تحديث GPS" : "Refresh GPS"}</span>
                  </button>

                  {/* Online/Offline Button */}
                  <button
                    onClick={() => {
                      toggleOnline();
                      setShowSettingsToolbar(false);
                    }}
                    className={`flex-1 flex flex-col items-center justify-center rounded-xl h-14 transition-all font-bold text-sm border shadow-sm ${isOnline ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100" : "bg-green-50 text-green-600 border-green-200 hover:bg-green-100"}`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${isOnline ? "bg-red-500" : "bg-green-500 animate-pulse"}`}
                      ></div>
                      <span>{isOnline ? t("offline") : t("online")}</span>
                    </div>
                    {isOnline && currentDriverProfile?.autoOfflineTime && (
                      <span className="text-[9px] font-black opacity-80 uppercase tracking-tighter -mt-1">
                        {isRTL ? "متبقي: " : "Remaining: "}{" "}
                        {getRemainingTimeStr()}
                      </span>
                    )}
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Duty Schedule Modal */}
        <AnimatePresence>
          {showDutySchedule && (
            <div
              className="fixed inset-0 z-[150] flex items-center justify-center p-6"
              dir={isRTL ? "rtl" : "ltr"}
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-md"
                onClick={onCloseDutySchedule}
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl relative z-10 overflow-hidden"
              >
                <div className="text-center">
                  <div className="w-20 h-20 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-6 text-[#FFC90E] text-3xl shadow-inner border border-yellow-100">
                    <i className="fas fa-calendar-alt"></i>
                  </div>
                  <h2 className="text-2xl font-black text-gray-1000 mb-2">
                    {t("work_schedule")}
                  </h2>
                  <p className="text-gray-500 text-sm font-medium mb-8 leading-relaxed">
                    {isRTL
                      ? 'حدد عدد الساعات التي ترغب في العمل فيها، وسيتم تحويل حالتك تلقائياً إلى "غير متصل" عند انتهاء الوقت.'
                      : "Choose how many hours you want to work, and the system will automatically set you offline when the timer ends."}
                  </p>

                  {currentDriverProfile?.autoOfflineTime ? (
                    <div className="space-y-4 mb-4">
                      <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100 flex flex-col items-center">
                        <span className="text-xs font-black text-blue-400 uppercase tracking-widest mb-1">
                          {t("auto_offline_label")}
                        </span>
                        <span className="text-3xl font-black text-blue-600 tracking-tighter">
                          {new Date(
                            currentDriverProfile.autoOfflineTime,
                          ).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span className="text-[10px] font-bold text-blue-400 mt-2 uppercase">
                          {isRTL ? "باقي: " : "Remaining: "}{" "}
                          {getRemainingTimeStr()}
                        </span>
                      </div>
                      <Button
                        onClick={() => handleSetAutoOffline(null)}
                        className="w-full h-14 bg-red-50 text-red-500 rounded-3xl font-black border border-red-100 hover:bg-red-100 transition-colors shadow-sm"
                      >
                        {t("clear_schedule")}
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 mb-8">
                      {[1, 2, 4, 8, 10, 12].map((hours) => (
                        <button
                          key={hours}
                          onClick={() =>
                            handleSetAutoOffline(
                              Date.now() + hours * 60 * 60 * 1000,
                            )
                          }
                          className="h-16 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col items-center justify-center hover:bg-yellow-50 hover:border-yellow-200 transition-all group active:scale-95"
                        >
                          <span className="text-lg font-black text-gray-900 group-hover:text-yellow-600 leading-none">
                            {hours}
                          </span>
                          <span className="text-[10px] font-bold text-gray-400 group-hover:text-yellow-600/60 uppercase tracking-widest mt-1">
                            {isRTL ? "ساعة" : "Hours"}
                          </span>
                        </button>
                      ))}

                      <div className="col-span-2 mt-4">
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 text-center">
                          أو اختر وقت محدد
                        </div>
                        <input
                          type="time"
                          className="w-full h-14 bg-gray-50 border border-gray-100 rounded-2xl px-6 font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-app-yellow transition-shadow"
                          onChange={(e) => {
                            const [h, m] = e.target.value
                              .split(":")
                              .map(Number);
                            const d = new Date();
                            d.setHours(h);
                            d.setMinutes(m);
                            d.setSeconds(0);
                            if (d.getTime() < Date.now()) {
                              d.setDate(d.getDate() + 1);
                            }
                            handleSetAutoOffline(d.getTime());
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <button
                    onClick={onCloseDutySchedule}
                    className="w-full py-4 text-gray-400 font-black uppercase text-xs tracking-[0.2em] mt-2 active:opacity-60 transition-opacity"
                  >
                    {t("close")}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showHeatmapInfo && (
            <div className="absolute top-[80px] left-4 right-4 z-[55] pointer-events-none flex justify-center">
              <motion.div
                initial={{ y: -20, opacity: 0, scale: 0.9 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: -20, opacity: 0, scale: 0.9 }}
                className="bg-white px-5 py-4 rounded-3xl shadow-[0_12px_24px_-8px_rgba(0,0,0,0.2)] flex flex-col items-center gap-3 border border-red-100 pointer-events-auto max-w-sm w-full mx-6 text-center"
              >
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 mb-1">
                  <i className="fas fa-fire-alt text-2xl"></i>
                </div>
                <h4 className="font-black text-gray-900">
                  {t("heatmap_info_title" as any)}
                </h4>
                <p className="text-sm font-medium text-gray-600 leading-relaxed mb-2">
                  {t("heatmap_info_desc" as any)}
                </p>
                <Button
                  onClick={() => {
                    setShowHeatmapInfo(false);
                    localStorage.setItem("heatmap_info_seen", "true");
                    localStorage.setItem("heatmap_guide_dismissed", "true");
                  }}
                  className="w-full bg-red-50 text-red-600 hover:bg-red-100 h-10 rounded-xl font-bold"
                >
                  {t("ok_btn")}
                </Button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showAddressBar && currentAddress && (
            <div
              className={`absolute left-4 right-4 z-[55] pointer-events-none flex justify-center transition-all duration-500`}
              style={{
                top:
                  currentDriverProfile.status === "pending" ? "120px" : "80px",
              }}
              id="driver-address-popup-top"
            >
              <motion.div
                initial={{ y: -20, opacity: 0, scale: 0.9 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: -20, opacity: 0, scale: 0.9 }}
                className="bg-[#0eff4d] px-5 py-3 rounded-3xl shadow-[0_12px_24px_-8px_rgba(255,201,14,0.5)] flex items-center gap-3 border border-yellow-300 pointer-events-auto max-w-sm w-full ml-6 mr-6 mt-[1px]"
              >
                <div className="w-10 h-10 rounded-full bg-white/30 flex items-center justify-center text-gray-900 border border-white/40 flex-shrink-0 backdrop-blur-sm">
                  <i className="fas fa-location-dot text-lg"></i>
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-[10px] font-black text-gray-900/40 uppercase tracking-widest leading-none mb-1">
                    {t("current_location")}
                  </span>
                  <span className="text-sm font-bold text-gray-900 truncate tracking-tight">
                    {currentAddress}
                  </span>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isOnline &&
            pendingRequests.length === 0 &&
            !activeRide &&
            !selectedRequest && (
              <motion.div
                key="waiting-requests-card"
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "100%", opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="absolute bottom-6 left-4 right-4 z-40 pointer-events-auto"
              >
                <div className="bg-white rounded-3xl p-4 shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-gray-100 flex items-center gap-4 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-50/50 to-transparent absolute-center animate-[shimmer_2s_infinite]"></div>
                  
                  <div className="relative w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                    <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-20"></div>
                    <i className="fas fa-satellite-dish text-blue-500 text-lg animate-pulse"></i>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-black text-gray-900 mb-0.5 truncate">
                      {isRTL ? "في انتظار طلبات الركوب..." : "Waiting for ride requests..."}
                    </h3>
                    <p className="text-xs font-bold text-gray-400 truncate">
                      {isRTL ? "جاري البحث في المنطقة المجاورة" : "Searching nearby area"}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
        </AnimatePresence>

        {!activeRide &&
          isOnline &&
          pendingRequests.length > 0 &&
          !selectedRequest && (
            <DriverRequestsPopup
              requests={pendingRequests}
              onAccept={handleAcceptRide}
              onSelect={setSelectedRequest}
              onRemove={handleRejectRequest}
              onTogglePin={handleTogglePinRequest}
              pinnedIds={pinnedRequestIds}
              activeOfferIds={activeOffers.map((r) => r.id)}
              offerDurationSeconds={OFFER_WAIT_SECONDS}
            />
          )}

        {selectedRequest && (
          <TripDetailsSheet
            ride={selectedRequest}
            driver={driver}
            onClose={() => setSelectedRequest(null)}
            onAccept={handleAcceptRide}
            onReject={handleRejectRequest}
            onSendOffer={handleSendOffer}
          />
        )}

        {activeRide && passenger && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            className={`absolute bottom-0 left-0 right-0 z-50 bg-white rounded-t-[40px] shadow-2xl px-6 pt-6 pb-[10px] pb-safe transition-all duration-300 ${isMinimized ? "h-24" : "h-auto"}`}
          >
            <div
              className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6 cursor-pointer"
              onClick={() => setIsMinimized(!isMinimized)}
            ></div>

            {!isMinimized && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <img
                      src={passenger.avatar}
                      className="w-12 h-12 rounded-full object-cover border-4 border-gray-50 shadow-md"
                      alt="Passenger"
                    />
                    <div className="flex flex-col justify-center px-4 py-2 min-w-[145px] max-w-[190px] bg-white rounded-2xl shadow-md border border-gray-100 -mr-3.5">
                      {activeRide.bookingType === "FOR_OTHER" && (
                        <span className="inline-block w-fit px-2 py-0.5 mb-0.5 rounded-full bg-blue-600 text-white text-[9px] font-black">
                          {t("for_other_badge")}
                        </span>
                      )}
                      <span className="font-black text-gray-900 text-[16px] truncate block leading-tight">
                        {activeRide.bookingType === "FOR_OTHER" &&
                        activeRide.actualPassenger?.name
                          ? activeRide.actualPassenger.name
                          : passenger.name}
                      </span>
                      <span className="font-bold text-gray-600 text-[12px] flex items-center gap-1.5 opacity-90">
                        {activeRide.bookingType === "FOR_OTHER" ? (
                          <span className="text-[10px] font-black text-blue-700">
                            {t("actual_passenger")}
                          </span>
                        ) : (
                          <>
                            {Number(passenger.rating || 5).toFixed(1)}{" "}
                            <i className="fas fa-star text-[#FFC90E]"></i>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                  <div
                    className="flex gap-2 p-1 shadow-sm border border-gray-100"
                    style={{ backgroundColor: "#ffffff", borderRadius: "25px" }}
                  >
                    <button
                      onClick={() => {
                        const target = navTargetCoords || activeRide.dropoff.coords;
                        openNavigation(target.lat, target.lng);
                      }}
                      className="w-11 h-11 bg-blue-50 rounded-[20px] flex items-center justify-center text-blue-600 shadow-sm border border-blue-100 active:scale-95 transition-colors"
                      title={t("navigate")}
                    >
                      <i className="fas fa-location-arrow text-sm"></i>
                    </button>
                    <a
                      href={`tel:${
                        activeRide.bookingType === "FOR_OTHER" &&
                        activeRide.actualPassenger?.phone
                          ? activeRide.actualPassenger.phone
                          : passenger.phone
                      }`}
                      title={
                        activeRide.bookingType === "FOR_OTHER"
                          ? t("call_actual_passenger")
                          : undefined
                      }
                      className="w-11 h-11 shadow-sm flex items-center justify-center text-white transition-colors active:scale-95"
                      style={{
                        backgroundColor: "#72db72",
                        borderRadius: "20px",
                      }}
                    >
                      <i className="fas fa-phone text-sm"></i>
                    </a>
                    <button
                      onClick={() => {
                        setIsChatOpen(true);
                        setHasUnreadMessages(false);
                      }}
                      className="w-11 h-11 bg-blue-50/50 rounded-[20px] flex items-center justify-center text-blue-600 shadow-sm border border-blue-100/50 hover:bg-blue-50 active:scale-95 transition-colors relative"
                    >
                      <i className="fas fa-comment-dots text-sm"></i>
                      {hasUnreadMessages && (
                        <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></div>
                      )}
                    </button>
                  </div>
                </div>

                {/* PHASE 4: ACTUAL PASSENGER vs BOOKING OWNER DETAILS & NOTES */}
                {activeRide.bookingType === "FOR_OTHER" &&
                  activeRide.actualPassenger && (
                    <div className="mb-4 p-3 rounded-2xl bg-blue-50/90 border border-blue-200 text-xs space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="font-black text-blue-900">
                            {t("actual_passenger")}:{" "}
                          </span>
                          <span className="font-bold text-gray-900">
                            {activeRide.actualPassenger.name}
                          </span>
                          <span
                            className="font-mono font-bold text-blue-700 mx-1.5"
                            dir="ltr"
                          >
                            ({activeRide.actualPassenger.phone})
                          </span>
                        </div>
                        <a
                          href={`tel:${activeRide.bookedBy?.phone || passenger.phone}`}
                          className="px-2.5 py-1 rounded-xl bg-white border border-blue-200 text-[10px] font-black text-gray-700 hover:bg-blue-100 flex items-center gap-1 shrink-0"
                          title={t("call_booking_owner")}
                        >
                          <i className="fas fa-user-shield text-blue-600"></i>
                          <span>
                            {t("booking_owner")}:{" "}
                            {activeRide.bookedBy?.name || passenger.name}
                          </span>
                        </a>
                      </div>
                      {activeRide.actualPassenger.note && (
                        <div className="p-2 rounded-xl bg-white/90 border border-blue-100 text-[11px]">
                          <span className="font-black text-gray-600">
                            {t("driver_notes")}:{" "}
                          </span>
                          <span className="font-bold text-gray-900">
                            {activeRide.actualPassenger.note}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                <TripTimeline
                  pickup={activeRide.pickup.address}
                  dropoff={activeRide.dropoff.address}
                  duration={activeRide.durationText}
                  isRTL={isRTL}
                  status={rideStatus}
                />

                <div className="grid grid-cols-2 gap-3 mb-4">
                  {rideStatus === RideStatus.ACCEPTED && (
                    <Button
                      onClick={() => handleUpdateStatus(RideStatus.ARRIVED)}
                      isLoading={statusUpdating}
                      className="col-span-2 h-14 bg-blue-600 text-white shadow-lg shadow-blue-200"
                    >
                      {t("arrived_pickup")}
                    </Button>
                  )}

                  {rideStatus === RideStatus.ARRIVED && (
                    <Button
                      onClick={() => handleUpdateStatus(RideStatus.IN_PROGRESS)}
                      isLoading={statusUpdating}
                      className="col-span-2 h-14 bg-green-600 text-white shadow-lg shadow-green-200"
                    >
                      {t("start_trip")}
                    </Button>
                  )}

                  {rideStatus === RideStatus.IN_PROGRESS && (
                    <div className="col-span-2 flex flex-col gap-2">
                      {activeRide.paymentStatus ===
                        PaymentStatus.AWAITING_CONFIRMATION && (
                        <motion.div
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-4 mb-2 flex flex-col items-center gap-3"
                        >
                          <div className="flex items-center gap-3 w-full">
                            <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center text-black">
                              <i className="fas fa-money-bill-wave animate-bounce"></i>
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-black text-yellow-800 uppercase leading-none tracking-tight">
                                Payment Received?
                              </p>
                              <p className="text-[10px] font-bold text-yellow-600 mt-1 line-clamp-1">
                                Ref:{" "}
                                {activeRide.paymentReference || "No reference"}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-black text-gray-900">
                                {activeRide.fare}{" "}
                                <span className="text-[10px] uppercase">
                                  {t("currency")}
                                </span>
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2 w-full">
                            <button
                              disabled={statusUpdating}
                              onClick={async () => {
                                setStatusUpdating(true);
                                try {
                                  await confirmInstapayPayment(
                                    activeRide.id,
                                    driver.id,
                                  );
                                } catch (e) {
                                  alert("Failed to confirm payment");
                                } finally {
                                  setStatusUpdating(false);
                                }
                              }}
                              className="flex-1 h-12 bg-gray-900 text-white rounded-xl font-black text-sm active:scale-95 transition-transform"
                            >
                              Yes, Confirmed
                            </button>
                            <button
                              onClick={() =>
                                window.alert("Please contact support via the main menu.")
                              }
                              className="w-12 h-12 bg-white border border-gray-100 text-gray-400 rounded-xl flex items-center justify-center active:scale-95 transition-transform"
                            >
                              <i className="fas fa-question-circle"></i>
                            </button>
                          </div>
                        </motion.div>
                      )}
                      <Button
                        onClick={() => setShowPaymentChoice(true)}
                        className="w-full h-14 bg-[#FFC90E] text-black shadow-lg shadow-yellow-200"
                      >
                        {t("complete_trip")}
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
            {isMinimized && (
              <div className="text-center font-bold text-gray-400 text-sm">
                {t("trip_details_minimized_key")}
              </div>
            )}
          </motion.div>
        )}

        {showPaymentChoice && activeRide && (
          <div
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end justify-center p-0 sm:p-4"
            onClick={() => setShowPaymentChoice(false)}
          >
            <div
              className="bg-white w-full max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 pb-safe animate-slide-up"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-black text-center mb-6">
                {t("select_payment_title")}
              </h3>

              <div className="space-y-3 mb-6">
                <button
                  onClick={() => handleFinalizeTrip(PaymentMethod.CASH)}
                  className="w-full p-4 bg-green-50 rounded-2xl border border-green-100 flex items-center justify-between group active:scale-98 transition-transform"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-green-600 shadow-sm">
                      <i className="fas fa-money-bill-wave"></i>
                    </div>
                    <span className="font-bold text-gray-800">
                      {t("method_cash")}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-lg">
                      {activeRide.fare} {t("currency")}
                    </div>
                    <div className="text-[10px] font-bold text-green-700">
                      {isRTL ? "الصافي لك:" : "Your Net:"}{" "}
                      {(
                        activeRide.fare *
                        (1 -
                          (currentDriverProfile?.commissionPercentage ??
                            appSettings?.defaultCommissionPercentage ??
                            10) /
                            100)
                      ).toFixed(2)}
                    </div>
                  </div>
                </button>

                {appSettings?.isInstaPayEnabled && (
                  <button
                    onClick={() => handleFinalizeTrip(PaymentMethod.INSTAPAY)}
                    className="w-full p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-center justify-between group active:scale-98 transition-transform"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-blue-600 shadow-sm">
                        <i className="fas fa-bolt"></i>
                      </div>
                      <span className="font-bold text-gray-800">
                        {t("method_instapay")}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-lg">
                        {activeRide.fare} {t("currency")}
                      </div>
                      <div className="text-[10px] font-bold text-blue-700">
                        {isRTL ? "الصافي لك:" : "Your Net:"}{" "}
                        {(
                          activeRide.fare *
                          (1 -
                            (currentDriverProfile?.commissionPercentage ??
                              appSettings?.defaultCommissionPercentage ??
                              10) /
                              100)
                        ).toFixed(2)}
                      </div>
                    </div>
                  </button>
                )}
              </div>

              <button
                onClick={() => setShowPaymentChoice(false)}
                className="w-full py-4 text-gray-400 font-bold uppercase text-xs tracking-widest"
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        )}

        {/* PHASE 7: 4-DIGIT RIDE START VERIFICATION PIN MODAL */}
        {showVerificationPinModal && activeRide && (
          <div
            className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowVerificationPinModal(false)}
          >
            <div
              className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl space-y-4 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto border border-blue-100">
                <i className="fas fa-shield-alt text-2xl"></i>
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900">
                  {t("enter_verification_pin")}
                </h3>
                <p className="text-xs font-bold text-gray-500 mt-1">
                  {t("verification_pin_prompt")}
                </p>
              </div>
              <input
                type="tel"
                maxLength={4}
                value={verificationPinInput}
                onChange={(e) => {
                  setVerificationPinInput(e.target.value.replace(/\D/g, "").slice(0, 4));
                  if (verificationPinError) setVerificationPinError(null);
                }}
                placeholder="••••"
                className="w-full text-center text-3xl font-mono font-black tracking-[0.5em] py-3.5 bg-gray-50 border-2 border-gray-200 rounded-2xl outline-none focus:border-blue-600 text-gray-900"
                dir="ltr"
                autoFocus
              />
              {verificationPinError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-xs font-black p-2.5 rounded-xl">
                  {verificationPinError}
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowVerificationPinModal(false)}
                  className="flex-1 py-3.5 rounded-2xl bg-gray-100 text-gray-600 font-black text-sm"
                >
                  {t("cancel")}
                </button>
                <Button
                  onClick={handleConfirmRideStartPin}
                  isLoading={isVerifyingPin}
                  className="flex-[2] h-12 bg-green-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-green-200"
                >
                  {t("verify_and_start_trip")}
                </Button>
              </div>
            </div>
          </div>
        )}

        {showCancelApproval && (
          <div className="fixed inset-0 z-[120] bg-black/80 flex items-center justify-center p-6 animate-fade-in">
            <div className="bg-white w-full max-sm rounded-3xl p-6 text-center animate-bounce-short">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500 text-3xl">
                <i className="fas fa-exclamation-triangle"></i>
              </div>
              <h2 className="text-xl font-black text-gray-900 mb-2">
                {t("cancellation_request_title")}
              </h2>
              <p className="text-gray-500 mb-6 font-medium">
                {t("cancellation_request_msg")}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleResolveCancellation("rejected")}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold"
                >
                  {t("reject_request")}
                </button>
                <button
                  onClick={() => handleResolveCancellation("approved")}
                  className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold"
                >
                  {t("accept")}
                </button>
              </div>
            </div>
          </div>
        )}

        {showFeePopup && (
          <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in overflow-y-auto">
            <div className="bg-white w-full max-w-md my-auto rounded-[40px] p-8 text-center shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-red-500"></div>
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500 text-3xl shadow-inner">
                <i className="fas fa-hand-holding-dollar"></i>
              </div>
              <h2 className="text-xl font-black text-gray-900 mb-2">
                {t("account_settlement_title")}
              </h2>
              <p className="text-gray-600 mb-6 text-sm font-bold leading-relaxed">
                {t("account_settlement_desc")}
              </p>

              <div className="bg-blue-50 rounded-2xl p-4 mb-6 border border-blue-100">
                <p className="text-blue-800 font-black text-xs mb-1 uppercase tracking-wider">
                  {t("settlement_instapay_label")}
                </p>
                <p className="text-blue-600 font-black text-lg tracking-widest select-all">
                  +201024419931
                </p>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-4 mb-6 text-left">
                {driverSettlements.filter((s) => s.status !== "paid").length ===
                0 ? (
                  <p className="text-sm font-bold text-gray-500 text-center py-4">
                    {isRTL ? "لا توجد مستحقات" : "No unpaid settlements"}
                  </p>
                ) : (
                  driverSettlements
                    .filter((s) => s.status !== "paid")
                    .map((s) => (
                      <div
                        key={s.id}
                        className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex justify-between items-center"
                      >
                        <div>
                          <div className="font-bold text-xs">
                            INV-{s.id.slice(0, 8)}
                          </div>
                          <div className="text-red-600 font-black">
                            {Number(s.commissionOwed).toFixed(2)}{" "}
                            {t("currency")}
                          </div>
                          <div className="text-[10px] uppercase font-bold text-gray-500">
                            {s.status === "pending_review"
                              ? t("in_review")
                              : t("unpaid")}
                          </div>
                        </div>
                        <div>
                          {s.status === "unpaid" ? (
                            <div className="relative">
                              <input
                                type="file"
                                id={`upload-${s.id}`}
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => handleUploadReceipt(s.id, e)}
                              />
                              <label
                                htmlFor={`upload-${s.id}`}
                                className="px-4 py-2 bg-gray-900 text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-gray-800 transition-colors inline-block text-center mt-1"
                              >
                                {t("upload_receipt")}
                              </label>
                            </div>
                          ) : (
                            <span className="text-yellow-600 text-[10px] font-bold">
                              {t("in_review")}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                )}
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  onClick={() => setShowFeePopup(false)}
                  className="h-12 bg-gray-200 text-gray-800 rounded-xl shadow-none"
                >
                  {t("close")}
                </Button>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-2">
                  {t("restrictions_lifted_msg")}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Approval Greeting Modal */}
        <AnimatePresence>
          {showFinancialPanel && (
            <div
              className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowFinancialPanel(false)}
            >
              <motion.div
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "100%", opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="bg-white w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] p-6 pb-12 sm:pb-6 shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-black text-gray-900">
                    {t("financial_details")}
                  </h3>
                  <button
                    onClick={() => setShowFinancialPanel(false)}
                    className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>

                <div className="overflow-y-auto hide-scrollbar flex-1 -mx-2 px-2">
                  {trialRemaining && (
                    <div
                      className={`w-full mb-6 ${trialRemaining.days < 3 ? "bg-gradient-to-r from-red-500 to-orange-500 shadow-red-500/20" : "bg-gradient-to-r from-blue-600 to-indigo-600 shadow-indigo-600/20"} rounded-2xl shadow-lg overflow-hidden relative`}
                    >
                      <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                      <div className="p-5 flex flex-col items-center justify-center relative z-10 text-white">
                        <div className="flex justify-center items-center gap-2 mb-3">
                          <i className="fas fa-gift text-2xl animate-bounce"></i>
                          <span className="font-black text-sm uppercase tracking-wider">
                            {isRTL
                              ? "تستمتع بفترة تجريبية 0٪ عمولة"
                              : "Enjoying 0% commission free trial"}
                          </span>
                        </div>
                        <div
                          className="flex items-center justify-center gap-3 text-center"
                          dir="ltr"
                        >
                          <div className="flex flex-col items-center">
                            <span
                              className={`text-3xl font-black ${trialRemaining.days < 3 ? "text-yellow-200" : "text-white"}`}
                            >
                              {String(trialRemaining.days).padStart(2, "0")}
                            </span>
                            <span className="text-[10px] font-bold uppercase opacity-80">
                              Days
                            </span>
                          </div>
                          <span className="text-2xl font-black opacity-50 mb-3">
                            :
                          </span>
                          <div className="flex flex-col items-center">
                            <span className="text-3xl font-black">
                              {String(trialRemaining.hours).padStart(2, "0")}
                            </span>
                            <span className="text-[10px] font-bold uppercase opacity-80">
                              Hrs
                            </span>
                          </div>
                          <span className="text-2xl font-black opacity-50 mb-3">
                            :
                          </span>
                          <div className="flex flex-col items-center">
                            <span className="text-3xl font-black">
                              {String(trialRemaining.mins).padStart(2, "0")}
                            </span>
                            <span className="text-[10px] font-bold uppercase opacity-80">
                              Min
                            </span>
                          </div>
                          <span className="text-2xl font-black opacity-50 mb-3">
                            :
                          </span>
                          <div className="flex flex-col items-center w-8">
                            <span className="text-3xl font-black">
                              {String(trialRemaining.secs).padStart(2, "0")}
                            </span>
                            <span className="text-[10px] font-bold uppercase opacity-80">
                              Sec
                            </span>
                          </div>
                        </div>
                        <div className="mt-3 text-[10px] font-medium opacity-80 bg-black/20 rounded-full px-4 py-1.5">
                          {isRTL
                            ? `مجاني حتى ${new Date(currentDriverProfile.trialEndDate!).toLocaleString("ar-EG", { dateStyle: "long", timeStyle: "short" })}`
                            : `Free until ${new Date(currentDriverProfile.trialEndDate!).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}`}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
                      <span className="text-[10px] font-bold text-green-600 block mb-1 uppercase tracking-wider">
                        {t("total_earnings")}
                      </span>
                      <div className="text-xl sm:text-2xl font-black text-green-900 truncate">
                        {(currentDriverProfile.earnings || 0).toFixed(2)}{" "}
                        <span className="text-xs font-bold text-green-600">
                          {t("currency")}
                        </span>
                      </div>
                    </div>

                    <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                      <span className="text-[10px] font-bold text-red-600 block mb-1 uppercase tracking-wider">
                        {isRTL ? "مستحقات الإدارة" : "Admin Dues"}
                      </span>
                      <div className="text-xl sm:text-2xl font-black text-red-900 truncate">
                        {(currentDriverProfile.pendingFees || 0).toFixed(2)}{" "}
                        <span className="text-xs font-bold text-red-600">
                          {t("currency")}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 p-5 rounded-3xl border border-blue-100 flex items-center justify-between mb-8">
                    <div>
                      <span className="text-[10px] font-bold text-blue-600 block mb-1 uppercase tracking-wider">
                        {t("next_payment_date")}
                      </span>
                      <div className="text-lg font-black text-blue-900">
                        {currentDriverProfile.gracePeriodEndTime
                          ? new Date(
                              currentDriverProfile.gracePeriodEndTime,
                            ).toLocaleDateString()
                          : isRTL
                            ? "غير محدد"
                            : "N/A"}
                      </div>
                    </div>
                    <i className="fas fa-calendar-check text-3xl text-blue-300 opacity-50"></i>
                  </div>

                  <h4 className="font-black text-gray-900 mb-4">
                    {t("settlement_history")}
                  </h4>
                  <div className="space-y-3">
                    {settlements.map((s) => (
                      <div
                        key={s.id}
                        className="bg-gray-50 border border-gray-100 p-4 rounded-2xl flex justify-between items-center"
                      >
                        <div>
                          <div className="font-bold text-sm text-gray-900 mb-1">
                            {new Date(
                              s.createdAt?.toMillis
                                ? s.createdAt.toMillis()
                                : s.createdAt,
                            ).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-gray-500 font-medium">
                            {s.totalRides} {t("settlement_rides")} •{" "}
                            {s.status === "unpaid"
                              ? t("unpaid")
                              : isRTL
                                ? "مكتمل"
                                : "Paid"}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-black text-lg text-gray-900">
                            -{s.commissionOwed}
                          </div>
                          <div className="text-[10px] text-green-600 font-bold">
                            +{s.grossEarnings} {t("currency")}
                          </div>
                        </div>
                      </div>
                    ))}
                    {settlements.length === 0 && (
                      <div className="text-center py-8 text-gray-400">
                        <i className="fas fa-receipt text-3xl mb-3 opacity-20"></i>
                        <p className="font-bold text-sm">
                          {t("no_settlements")}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {currentDriverProfile?.isBanned && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 text-right rtl:text-right ltr:text-left"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white w-full max-w-sm rounded-[32px] p-8 text-center shadow-2xl relative"
              >
                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <i className="fas fa-ban text-red-600 text-4xl"></i>
                </div>
                <h3 className="text-xl font-black text-gray-900 mb-3 tracking-tighter">
                  {isRTL ? "تم حظر الحساب" : "Account Banned"}
                </h3>
                <p className="text-gray-500 text-sm font-bold leading-relaxed mb-4">
                  {isRTL
                    ? "عذراً، تم حظر حسابك بقرار من الإدارة. لا يمكنك تقديم المزيد من الرحلات."
                    : "Your account has been banned by administration. You can no longer provide rides."}
                </p>
                <div className="bg-red-50 p-4 rounded-xl border border-red-100 mb-8">
                  <span className="text-[10px] font-black uppercase text-red-400 block mb-1">
                    {isRTL ? "السبب" : "Reason"}
                  </span>
                  <span className="text-sm font-bold text-red-900">
                    {currentDriverProfile.banReason ||
                      (isRTL ? "مخالفة الشروط والاحكام" : "Terms violation")}
                  </span>
                </div>
                <button
                  onClick={onLogout}
                  className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-base shadow-lg active:scale-[0.98] transition-all"
                >
                  {isRTL ? "تسجيل الخروج" : "Log Out"}
                </button>
              </motion.div>
            </motion.div>
          )}

          {(currentDriverProfile?.suspendedUntil ?? 0) > Date.now() &&
            !currentDriverProfile?.isBanned && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 text-right rtl:text-right ltr:text-left"
              >
                <motion.div
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  className="bg-white w-full max-w-sm rounded-[32px] p-8 text-center shadow-2xl relative"
                >
                  <div className="w-20 h-20 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <i className="fas fa-clock text-yellow-600 text-4xl"></i>
                  </div>
                  <h3 className="text-xl font-black text-gray-900 mb-3 tracking-tighter">
                    {isRTL ? "إيقاف مؤقت" : "Account Suspended"}
                  </h3>
                  <p className="text-gray-500 text-sm font-bold leading-relaxed mb-6">
                    {isRTL
                      ? "تم إيقاف حسابك مؤقتاً لمراجعة نشاطك."
                      : "Your account has been temporarily suspended pending review."}
                  </p>
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-8 flex justify-between items-center text-sm font-bold">
                    <span className="text-gray-400">
                      {isRTL ? "ينتهي الإيقاف في" : "Suspension ends:"}
                    </span>
                    <span className="text-gray-900 font-black">
                      {new Date(
                        currentDriverProfile.suspendedUntil!,
                      ).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    onClick={onLogout}
                    className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-base shadow-lg active:scale-[0.98] transition-all"
                  >
                    {isRTL ? "تسجيل الخروج" : "Log Out"}
                  </button>
                </motion.div>
              </motion.div>
            )}

          {currentDriverProfile?.warningMessage &&
            !currentDriverProfile?.isBanned &&
            (currentDriverProfile?.suspendedUntil ?? 0) < Date.now() && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 text-right rtl:text-right ltr:text-left"
              >
                <motion.div
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  className="bg-white w-full max-w-sm rounded-[32px] p-8 text-center shadow-2xl relative"
                >
                  <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <i className="fas fa-exclamation-triangle text-blue-600 text-3xl"></i>
                  </div>
                  <h3 className="text-xl font-black text-gray-900 mb-3 tracking-tighter">
                    {isRTL ? "تنبيه إداري" : "Admin Warning"}
                  </h3>
                  <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 mb-8 max-h-[40vh] overflow-y-auto w-full text-center">
                    <span className="text-sm font-bold text-blue-900 leading-relaxed block">
                      {currentDriverProfile.warningMessage}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      updateDoc(doc(db, "users", currentDriverProfile.id), {
                        warningMessage: null,
                      }).catch(e => { if(String(e).includes('permission')) { console.log('Permission error caught:', e); } else { if(String(e).includes('permission')) { console.log('Permission error caught:', e); } else { console.error(e); }; } });
                    }}
                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-base shadow-lg shadow-blue-200 active:scale-[0.98] transition-all"
                  >
                    {isRTL ? "استلام ومتابعة" : "Acknowledge"}
                  </button>
                </motion.div>
              </motion.div>
            )}
        </AnimatePresence>

        <AnimatePresence>
          {showApprovalGreeting && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-[32px] p-8 max-w-sm w-full text-center shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-2 bg-green-500"></div>
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="text-green-600 w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-2">
                  {t("greeting_approved_title")}
                </h3>
                <p className="text-gray-500 font-medium mb-8 leading-relaxed italic">
                  {t("greeting_approved_body")}
                </p>
                <Button
                  onClick={() => setShowApprovalGreeting(false)}
                  className="w-full bg-[#FFC90E] hover:bg-[#E5B50D] text-black font-black py-4 rounded-xl shadow-lg border-2 border-black"
                >
                  {t("get_started")}
                </Button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showForceReload && !activeRide && driver?.role !== UserRole.ADMIN && !checkIsAdmin(auth.currentUser?.email || driver?.email, auth.currentUser?.phoneNumber || driver?.phone) && (
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
                <div className="absolute top-0 left-0 w-full h-2 bg-[#8B5CF6]"></div>
                <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <i className="fas fa-sync-alt text-[#8B5CF6] text-4xl animate-spin-slow"></i>
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
                  className="w-full py-4 bg-[#8B5CF6] text-white rounded-2xl font-black text-base shadow-lg shadow-purple-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <i className="fas fa-redo-alt"></i>
                  {t("refresh_now")}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showInsights && (
            <DriverInsightsPanel
              currentLocation={currentLocation}
              onClose={() => setShowInsights(false)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showVehicleManager && (
            <VehicleManagementPanel
              driver={currentDriverProfile}
              onClose={() => setShowVehicleManager(false)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showRewards && (
            <DriverRewardsPanel
              driver={currentDriverProfile}
              onClose={() => setShowRewards(false)}
            />
          )}
        </AnimatePresence>

        <DriverScheduledRidesView
          isOpen={showDriverScheduledModal}
          onClose={() => setShowDriverScheduledModal(false)}
          driver={currentDriverProfile}
          lang={language === "en" ? "en" : "ar"}
        />
      </div>
    </LocationGuard>
  );
}
