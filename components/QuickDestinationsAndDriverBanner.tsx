import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Car,
  ShieldCheck,
  Zap,
  DollarSign,
  Clock,
  Sparkles,
  Info,
  CheckCircle2,
  FileText,
  Bike,
  Check,
  X,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { Place } from "../types";

interface QuickDestinationsAndDriverBannerProps {
  quickAccessPlaces: Place[];
  onSelectPlace: (place: Place) => void;
  getLocationIcon: (name: string, type: string) => string;
  onNavigate: (view: string) => void;
  isRTL: boolean;
  t?: (key: string) => string;
}

export const QuickDestinationsAndDriverBanner: React.FC<
  QuickDestinationsAndDriverBannerProps
> = ({
  quickAccessPlaces,
  onSelectPlace,
  getLocationIcon,
  onNavigate,
  isRTL,
}) => {
  const [activeTab, setActiveTab] = useState<"destinations" | "driver_banner">(
    "destinations",
  );
  const [secondsLeft, setSecondsLeft] = useState<number>(10);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);
  const hasAutoSwitchedRef = useRef<boolean>(false);

  // 10-Second Countdown Timer to auto-switch from destinations to driver banner
  useEffect(() => {
    if (activeTab !== "destinations" || isPaused || hasAutoSwitchedRef.current) {
      return;
    }

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          hasAutoSwitchedRef.current = true;
          setActiveTab("driver_banner");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTab, isPaused]);

  const handleApplyAsDriver = () => {
    setShowDetailsModal(false);
    onNavigate("DRIVER_REGISTRATION");
  };

  const handleSwitchTab = (tab: "destinations" | "driver_banner") => {
    setActiveTab(tab);
    if (tab === "destinations") {
      setIsPaused(true); // Don't suddenly kick them out if they deliberately came back
    }
  };

  return (
    <div className="w-full select-none" dir={isRTL ? "rtl" : "ltr"}>
      {/* Top Switcher Navigation Pills */}
      <div className="flex items-center justify-between gap-2 mb-2 px-1">
        <div className="inline-flex items-center bg-gray-100/90 backdrop-blur-md p-1 rounded-2xl shadow-inner border border-gray-200/60">
          <button
            type="button"
            onClick={() => handleSwitchTab("destinations")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 ${
              activeTab === "destinations"
                ? "bg-white text-gray-900 shadow-sm font-black"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            <span className="text-sm">📍</span>
            <span>{isRTL ? "الوجهات السريعة" : "Quick Destinations"}</span>
            {activeTab === "destinations" && !hasAutoSwitchedRef.current && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                  secondsLeft <= 3
                    ? "bg-red-500 text-white animate-pulse"
                    : "bg-[#FFC90E] text-gray-900"
                }`}
                title={
                  isRTL
                    ? `ينتقل تلقائياً بعد ${secondsLeft} ثوانٍ`
                    : `Auto switch in ${secondsLeft}s`
                }
              >
                {secondsLeft}s
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleSwitchTab("driver_banner")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 ${
              activeTab === "driver_banner"
                ? "bg-[#FFC90E] text-gray-950 shadow-sm font-black"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <span className="text-sm">🚖</span>
            <span>{isRTL ? "انضم ككابتن" : "Drive with Us"}</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-black text-[#FFC90E] rounded-full font-black tracking-wider">
              {isRTL ? "0% عمولة" : "0% Fee"}
            </span>
          </button>
        </div>

        {/* Status / Quick hint */}
        {activeTab === "destinations" && !hasAutoSwitchedRef.current && (
          <button
            type="button"
            onClick={() => setIsPaused((prev) => !prev)}
            className="text-[11px] font-semibold text-gray-500 hover:text-gray-800 flex items-center gap-1 bg-white/80 px-2 py-1 rounded-lg border border-gray-200"
          >
            <Clock className="w-3 h-3 text-[#FFC90E]" />
            <span>
              {isPaused
                ? isRTL
                  ? "المؤقت متوقف"
                  : "Paused"
                : `${secondsLeft} ${isRTL ? "ثانية" : "sec"}`}
            </span>
          </button>
        )}
      </div>

      {/* Main Animated Container */}
      <AnimatePresence mode="wait">
        {activeTab === "destinations" ? (
          /* ========================================================
             1. QUICK DESTINATIONS (Matches user's exact screenshot)
             ======================================================== */
          <motion.div
            key="destinations-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{
              opacity: 0,
              y: -20,
              scale: 0.96,
              transition: { duration: 0.35, ease: "easeInOut" },
            }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onTouchStart={() => setIsPaused(true)}
            className="space-y-2"
          >
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-6 px-6 hide-scrollbar snap-x snap-mandatory">
              {quickAccessPlaces.slice(0, 10).map((place, idx) => (
                <button
                  key={`${place.id}-${idx}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPlace({ ...place, coords: place.coords });
                  }}
                  className="min-w-[70%] sm:min-w-[280px] snap-center flex items-center p-4 bg-white hover:bg-gray-50 rounded-[24px] transition-all duration-300 shadow-[0_2px_15px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_25px_rgba(0,0,0,0.08)] border border-gray-100 gap-4 group active:scale-95 text-left rtl:text-right"
                >
                  <div className="w-14 h-14 rounded-full bg-[#FFC90E]/10 flex items-center justify-center shrink-0 transition-transform duration-500 group-hover:rotate-12">
                    <div className="w-10 h-10 rounded-full bg-[#FFC90E] flex items-center justify-center shadow-md shadow-yellow-200">
                      <i
                        className={`fas ${getLocationIcon(place.name, place.type)} text-gray-900 text-lg`}
                      ></i>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-black text-gray-900 text-lg truncate leading-tight group-hover:text-[#FFC90E] transition-colors"
                      dir="auto"
                    >
                      {place.name}
                    </div>
                    <div
                      className="text-xs text-gray-400 truncate mt-1.5 font-bold flex items-center gap-1"
                      dir="auto"
                    >
                      <i className="fas fa-location-arrow text-[10px] opacity-50"></i>
                      {place.address}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Countdown progress line */}
            {!hasAutoSwitchedRef.current && (
              <div className="px-1">
                <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                  <motion.div
                    className="bg-[#FFC90E] h-full"
                    initial={{ width: "100%" }}
                    animate={{ width: `${(secondsLeft / 10) * 100}%` }}
                    transition={{ duration: 1, ease: "linear" }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-gray-400 font-medium mt-1">
                  <span>
                    {isRTL
                      ? `سيتم عرض عروض وفرص الكباتن بعد ${secondsLeft} ثانية`
                      : `Captain recruitment banner in ${secondsLeft}s`}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      hasAutoSwitchedRef.current = true;
                      setActiveTab("driver_banner");
                    }}
                    className="text-[#D4A000] hover:text-[#9E7700] font-bold flex items-center gap-0.5"
                  >
                    <span>{isRTL ? "انتقل الآن" : "Skip"}</span>
                    {isRTL ? (
                      <ArrowLeft className="w-3 h-3" />
                    ) : (
                      <ArrowRight className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          /* ========================================================
             2. MODERN DRIVER ADVERTISE BANNER
             ======================================================== */
          <motion.div
            key="driver-banner-view"
            initial={{ opacity: 0, y: 25, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              y: -20,
              scale: 0.96,
              transition: { duration: 0.35 },
            }}
            transition={{
              type: "spring",
              damping: 24,
              stiffness: 260,
            }}
            className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-gray-900 via-gray-950 to-black text-white shadow-xl shadow-yellow-900/10 border border-yellow-400/25 p-4 sm:p-5"
          >
            {/* Glow Accents */}
            <div className="absolute -top-16 -right-16 w-48 h-48 bg-[#FFC90E]/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col gap-4">
              {/* Header Badge & Switch back link */}
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-[#FFC90E] to-amber-400 text-gray-950 text-xs font-black shadow-md shadow-yellow-500/20">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isRTL ? "فرصة للكباتن" : "Drive with Waslny"}</span>
                  <span className="bg-black/20 px-1.5 py-0.2 rounded-full text-[10px]">
                    0% {isRTL ? "عمولة" : "Fee"}
                  </span>
                </span>

                <button
                  type="button"
                  onClick={() => handleSwitchTab("destinations")}
                  className="text-xs text-gray-300 hover:text-white flex items-center gap-1 transition-colors px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15"
                >
                  <span>{isRTL ? "عرض الوجهات" : "Destinations"}</span>
                  {isRTL ? (
                    <ArrowLeft className="w-3 h-3 text-[#FFC90E]" />
                  ) : (
                    <ArrowRight className="w-3 h-3 text-[#FFC90E]" />
                  )}
                </button>
              </div>

              {/* Main Content: Hero Banner + Illustration */}
              <div className="flex flex-col sm:flex-row items-center gap-4">
                {/* Hero Graphic / Image */}
                <div className="relative w-full sm:w-44 h-36 sm:h-36 rounded-2xl overflow-hidden shrink-0 border border-white/15 bg-gradient-to-tr from-yellow-500/20 to-gray-800 shadow-md">
                  <img
                    src="/assets/driver_banner_hero.jpg"
                    alt="Waslny Captain"
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      // Fallback if image fails
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-black text-amber-300">
                      <Car className="w-3.5 h-3.5 text-[#FFC90E]" />
                      <span>{isRTL ? "سيارات وسكوتر" : "Cars & Scooters"}</span>
                    </div>
                  </div>
                </div>

                {/* Pitch / Title & Value Proposition */}
                <div className="flex-1 text-right rtl:text-right ltr:text-left">
                  <h3 className="text-lg sm:text-xl font-black text-white leading-tight tracking-tight">
                    {isRTL ? (
                      <>
                        كن كابتن مع <span className="text-[#FFC90E]">وصلني</span>{" "}
                        وضاعف دخلك اليومي!
                      </>
                    ) : (
                      <>
                        Drive with <span className="text-[#FFC90E]">Waslny</span>{" "}
                        & Boost Your Income!
                      </>
                    )}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-300 mt-1 font-medium leading-relaxed">
                    {isRTL
                      ? "عمولة 0% لأول شهر، سحب فوري لأرباحك عبر إنستاباي، وحرية كاملة في اختيار أوقات ومناطق عملك."
                      : "0% commission first month, instant cashouts via InstaPay, and complete freedom over your work schedule."}
                  </p>

                  {/* Highlights Grid */}
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <div className="flex items-center gap-2 bg-white/5 rounded-xl p-2 border border-white/5">
                      <div className="w-7 h-7 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center shrink-0">
                        <DollarSign className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-white truncate">
                          {isRTL ? "0% عمولة" : "0% Commission"}
                        </div>
                        <div className="text-[9px] text-gray-400 truncate">
                          {isRTL ? "أرباحك كاملة لك" : "Keep 100% earnings"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-white/5 rounded-xl p-2 border border-white/5">
                      <div className="w-7 h-7 rounded-lg bg-yellow-500/20 text-[#FFC90E] flex items-center justify-center shrink-0">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-white truncate">
                          {isRTL ? "سحب فوري إنستاباي" : "Instant Cashout"}
                        </div>
                        <div className="text-[9px] text-gray-400 truncate">
                          {isRTL ? "أرباح يومية كاش" : "Daily bank payout"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleApplyAsDriver}
                  className="flex-1 bg-gradient-to-r from-[#FFC90E] via-yellow-400 to-[#FFC90E] text-gray-950 font-black py-3 px-5 rounded-2xl shadow-lg shadow-yellow-500/25 hover:shadow-yellow-500/40 hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <Car className="w-4 h-4 text-black" />
                  <span>{isRTL ? "سجّل الآن ككابتن" : "Apply as Captain"}</span>
                  {isRTL ? (
                    <ArrowLeft className="w-4 h-4" />
                  ) : (
                    <ArrowRight className="w-4 h-4" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowDetailsModal(true)}
                  className="bg-white/10 hover:bg-white/15 text-white font-bold py-3 px-4 rounded-2xl border border-white/10 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 text-xs text-gray-200"
                >
                  <Info className="w-4 h-4 text-[#FFC90E]" />
                  <span>
                    {isRTL ? "الشروط والمميزات" : "Requirements & Perks"}
                  </span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================
         3. DRIVER INFORMATION & REQUIREMENTS MODAL
         ======================================================== */}
      <AnimatePresence>
        {showDetailsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setShowDetailsModal(false)}
          >
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white text-gray-900 rounded-t-[32px] sm:rounded-[32px] w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative"
              dir={isRTL ? "rtl" : "ltr"}
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowDetailsModal(false)}
                className="absolute top-5 left-5 rtl:left-5 rtl:right-auto ltr:right-5 ltr:left-auto w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Modal Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-[#FFC90E]/20 text-[#D4A000] flex items-center justify-center font-black">
                  <Car className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900">
                    {isRTL
                      ? "دليل الانضمام لكباتن وصلني"
                      : "Waslny Captain Guide"}
                  </h3>
                  <p className="text-xs text-gray-500 font-medium">
                    {isRTL
                      ? "كل ما تحتاج معرفته لبدء القيادة وزيادة أرباحك"
                      : "Everything you need to start driving and earning"}
                  </p>
                </div>
              </div>

              {/* Banner visual */}
              <div className="rounded-2xl overflow-hidden mb-5 border border-yellow-200 bg-yellow-50 relative p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#FFC90E] flex items-center justify-center text-gray-950 font-black shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-black text-gray-900 text-sm">
                    {isRTL
                      ? "عرض خاص: 0% عمولة لأول شهر"
                      : "Special: 0% Commission for 30 Days"}
                  </div>
                  <div className="text-xs text-gray-600">
                    {isRTL
                      ? "ابدأ واحتفظ بكل ما تجنيه، مع مكافآت أسبوعية عند إتمام عدد رحلات محدد."
                      : "Keep all your earnings plus weekly bonus incentives upon completing rides."}
                  </div>
                </div>
              </div>

              {/* Steps To Join */}
              <div className="space-y-4 mb-6">
                <h4 className="text-sm font-black text-gray-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span>
                    {isRTL
                      ? "خطوات التسجيل البسيطة (3 خطوات)"
                      : "3 Simple Steps to Start"}
                  </span>
                </h4>

                <div className="grid grid-cols-1 gap-2.5">
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="w-7 h-7 rounded-full bg-yellow-400 text-black font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-900">
                        {isRTL ? "سجل بياناتك ومستنداتك" : "Submit Documents"}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {isRTL
                          ? "ارفع صور رخصة القيادة، رخصة السيارة، والبطاقة الشخصية مباشرة من التطبيق."
                          : "Upload your driver license, vehicle license, and national ID directly."}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="w-7 h-7 rounded-full bg-yellow-400 text-black font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-900">
                        {isRTL ? "مراجعة وتفعيل فوري" : "Fast Verification"}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {isRTL
                          ? "يقوم فريق العمل بمراجعة المستندات وتفعيل حسابك خلال أقل من 24 ساعة."
                          : "Our team verifies your documents and activates your account within 24 hours."}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="w-7 h-7 rounded-full bg-yellow-400 text-black font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-900">
                        {isRTL ? "افتح التطبيق واستقبل الرحلات" : "Go Online & Earn"}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {isRTL
                          ? "حول وضعك إلى كابتن وابدأ في استقبال طلبات الركاب في منطقتك فوراً!"
                          : "Switch to Driver mode and start accepting ride requests instantly!"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Requirements & Supported Vehicles */}
              <div className="space-y-3 mb-6">
                <h4 className="text-sm font-black text-gray-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>
                    {isRTL ? "المستندات المطلوبة" : "Required Documents"}
                  </span>
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="font-bold text-gray-700">
                      {isRTL ? "بطاقة الرقم القومي" : "National ID"}
                    </span>
                  </div>
                  <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="font-bold text-gray-700">
                      {isRTL ? "رخصة قيادة سارية" : "Valid Driver License"}
                    </span>
                  </div>
                  <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="font-bold text-gray-700">
                      {isRTL ? "رخصة السيارة / السكوتر" : "Vehicle License"}
                    </span>
                  </div>
                  <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="font-bold text-gray-700">
                      {isRTL ? "فيش وتشبيه حديث" : "Criminal Record (Fesh)"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Vehicles Supported */}
              <div className="p-3 bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-2xl mb-6">
                <div className="text-xs font-black text-[#FFC90E] mb-1">
                  {isRTL ? "المركبات المقبولة" : "Accepted Vehicles"}
                </div>
                <div className="flex items-center justify-between text-xs text-gray-300">
                  <div className="flex items-center gap-1.5">
                    <Car className="w-4 h-4 text-white" />
                    <span>{isRTL ? "ملاكي وتاكسي" : "Cars & Taxi"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Bike className="w-4 h-4 text-white" />
                    <span>{isRTL ? "سكوتر وموتوسيكل" : "Scooters & Moto"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-green-400" />
                    <span>{isRTL ? "حالة جيدة" : "Good condition"}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleApplyAsDriver}
                  className="flex-1 bg-[#FFC90E] hover:bg-yellow-400 text-gray-950 font-black py-3.5 px-6 rounded-2xl shadow-lg shadow-yellow-500/25 transition active:scale-[0.98] text-sm flex items-center justify-center gap-2"
                >
                  <Car className="w-4 h-4" />
                  <span>{isRTL ? "ابدأ التسجيل الآن" : "Start Registration"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDetailsModal(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3.5 px-5 rounded-2xl transition text-xs"
                >
                  {isRTL ? "إغلاق" : "Close"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default QuickDestinationsAndDriverBanner;
