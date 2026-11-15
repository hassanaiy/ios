import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User as UserIcon,
  Phone,
  MapPin,
  Navigation,
  ShieldCheck,
  Check,
  X,
  FileText,
  Sparkles,
  Plus,
  Minus,
  AlertCircle,
  BookOpen,
} from "lucide-react";
import { PaymentMethod, VehicleType } from "../types";
import {
  sanitizeEgyptianPhoneInput,
  validateAndNormalizePassengerPhone,
} from "../services/firebase";

export interface VehicleOptionItem {
  id: VehicleType;
  name: string;
  image?: string;
  icon?: string;
  seats?: number;
  desc?: string;
}

interface BookForOtherModalProps {
  isOpen: boolean;
  onClose: () => void;
  isRTL: boolean;
  t: (key: string, defaultEn?: string, defaultAr?: string) => string;
  userName: string;
  userPhone: string;
  otherPassengerName: string;
  setOtherPassengerName: (val: string) => void;
  otherPassengerPhone: string;
  setOtherPassengerPhone: (val: string) => void;
  otherPassengerNote: string;
  setOtherPassengerNote: (val: string) => void;
  rideVerificationEnabled: boolean;
  setRideVerificationEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  otherPassengerError: string | null;
  setOtherPassengerError: (val: string | null) => void;
  savedOtherContacts: Array<{ name: string; phone: string; note?: string | null }>;
  pickupAddress: string;
  dropoffAddress: string;
  hasDropoff: boolean;
  distanceKm: number;
  onOpenSearchPickup: () => void;
  onPickPickupFromMap: () => void;
  onOpenSearchDropoff: () => void;
  onPickDropoffFromMap: () => void;
  vehicleTypes: VehicleOptionItem[];
  selectedVehicleType: VehicleType;
  onSelectVehicleType: (type: VehicleType) => void;
  priceRanges: Record<string, { min: number; max: number; recommended: number } | undefined>;
  customFare: number;
  setCustomFare: (fare: number) => void;
  paymentMethod: PaymentMethod;
  setPaymentMethod: React.Dispatch<React.SetStateAction<PaymentMethod>>;
  isRequesting: boolean;
  onSubmitRide: () => void;
}

export const BookForOtherModal: React.FC<BookForOtherModalProps> = ({
  isOpen,
  onClose,
  isRTL,
  t,
  userName,
  userPhone,
  otherPassengerName,
  setOtherPassengerName,
  otherPassengerPhone,
  setOtherPassengerPhone,
  otherPassengerNote,
  setOtherPassengerNote,
  rideVerificationEnabled,
  setRideVerificationEnabled,
  otherPassengerError,
  setOtherPassengerError,
  savedOtherContacts,
  pickupAddress,
  dropoffAddress,
  hasDropoff,
  distanceKm,
  onOpenSearchPickup,
  onPickPickupFromMap,
  onOpenSearchDropoff,
  onPickDropoffFromMap,
  vehicleTypes,
  selectedVehicleType,
  onSelectVehicleType,
  priceRanges,
  customFare,
  setCustomFare,
  paymentMethod,
  setPaymentMethod,
  isRequesting,
  onSubmitRide,
}) => {
  const cleanPhone = sanitizeEgyptianPhoneInput(otherPassengerPhone);
  const phoneCheck = validateAndNormalizePassengerPhone(cleanPhone);
  const isPhoneValid = phoneCheck.isValid;

  const recFare =
    priceRanges[selectedVehicleType]?.recommended || customFare || 50;
  const minFare = priceRanges[selectedVehicleType]?.min || 15;
  const effectiveFare = customFare > 0 ? customFare : Math.round(recFare / 5) * 5;

  const handlePhoneInput = (rawVal: string) => {
    const sanitized = sanitizeEgyptianPhoneInput(rawVal);
    setOtherPassengerPhone(sanitized);
    if (otherPassengerError) setOtherPassengerError(null);
  };

  const handleConfirmRequest = () => {
    if (otherPassengerName.trim().length < 2) {
      setOtherPassengerError(
        isRTL
          ? "يرجى إدخال اسم الراكب بالكامل (حرفين على الأقل)"
          : "Please enter the passenger's full name"
      );
      return;
    }
    if (!isPhoneValid) {
      setOtherPassengerError(
        isRTL
          ? "يرجى إدخال رقم موبايل مصري صحيح مكون من 11 رقم يبدأ بـ 010 أو 011 أو 012 أو 015 (مثال: 01024419931)"
          : "Please enter a valid 11-digit Egyptian mobile number (e.g. 01024419931)"
      );
      return;
    }
    if (!hasDropoff || !dropoffAddress) {
      setOtherPassengerError(
        isRTL
          ? "يرجى تحديد وجهة وصول الراكب أولاً"
          : "Please select the passenger's destination first"
      );
      return;
    }
    setOtherPassengerError(null);
    onSubmitRide();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="book-for-other-modal"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[85] bg-slate-50 flex flex-col overflow-hidden"
          dir={isRTL ? "rtl" : "ltr"}
        >
          {/* Top Sticky App Bar */}
          <div className="bg-white border-b border-slate-200 px-4 pt-safe pb-3 flex items-center justify-between gap-3 shrink-0 shadow-2xs">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={onClose}
                className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 active:scale-95 transition-all"
                aria-label={isRTL ? "رجوع" : "Back"}
              >
                <X className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-black text-slate-900 truncate">
                  {isRTL ? "حجز رحلة لشخص آخر" : "Book a Ride for Someone Else"}
                </h2>
                <p className="text-[11px] font-bold text-slate-500 truncate">
                  {isRTL
                    ? "أدخل بيانات الراكب وحدد مسار الرحلة بسهولة"
                    : "Enter passenger details and choose pickup & destination"}
                </p>
              </div>
            </div>

            <span className="px-3 py-1 rounded-xl bg-blue-600 text-white text-[11px] font-black shrink-0">
              {t("for_other_badge", "For Someone Else", "حجز لشخص آخر")}
            </span>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 max-w-2xl w-full mx-auto">
            {/* CARD 1: PASSENGER DETAILS */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      {isRTL ? "بيانات الراكب الفعلي" : "Actual Passenger Details"}
                    </h3>
                    <p className="text-[11px] font-bold text-slate-400">
                      {isRTL
                        ? "الشخص الذي سيستقل المركبة مع الكابتن"
                        : "The person who will take the ride"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Saved Contacts Quick Bar */}
              {savedOtherContacts.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-500">
                    <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                    <span>
                      {isRTL ? "اختيار سريع من المحفوظين:" : "Quick pick from saved:"}
                    </span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                    {savedOtherContacts.map((c, idx) => {
                      const cPhone = sanitizeEgyptianPhoneInput(c.phone);
                      const isSelected =
                        otherPassengerName === c.name && cleanPhone === cPhone;
                      return (
                        <button
                          key={`${c.phone}_${idx}`}
                          type="button"
                          onClick={() => {
                            setOtherPassengerName(c.name);
                            setOtherPassengerPhone(cPhone);
                            if (c.note) setOtherPassengerNote(c.note);
                            setOtherPassengerError(null);
                          }}
                          className={`shrink-0 px-3 py-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 ${
                            isSelected
                              ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                              : "bg-slate-50 hover:bg-blue-50 text-slate-800 border-slate-200"
                          }`}
                        >
                          <span>{c.name}</span>
                          <span
                            className={`text-[11px] font-mono ${
                              isSelected ? "text-blue-100" : "text-slate-500"
                            }`}
                            dir="ltr"
                          >
                            {cPhone}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Passenger Full Name */}
              <div className="w-full min-w-0">
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  {t("other_passenger_name", "Passenger Name", "اسم الراكب")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <div className="relative w-full min-w-0">
                  <input
                    type="text"
                    value={otherPassengerName}
                    onChange={(e) => {
                      setOtherPassengerName(e.target.value);
                      if (otherPassengerError) setOtherPassengerError(null);
                    }}
                    placeholder={
                      isRTL ? "مثال: محمد أحمد علي" : "e.g. Mohamed Ahmed"
                    }
                    className="w-full min-w-0 box-border bg-slate-50 focus:bg-white px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-600 text-sm font-bold text-slate-900 outline-none transition-all"
                    dir="auto"
                  />
                </div>
              </div>

              {/* Passenger 11-Digit Egyptian Phone Number (NO Country Code Dropdown, Zero Overflow) */}
              <div className="w-full min-w-0 overflow-hidden">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label className="block text-xs font-black text-slate-700 truncate">
                    {t(
                      "other_passenger_phone",
                      "Passenger Mobile Number",
                      "رقم موبايل الراكب"
                    )}{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] font-bold text-slate-400 shrink-0">
                    {isRTL ? "11 رقم بدون كود الدولة" : "11 digits (Egypt)"}
                  </span>
                </div>

                <div
                  className={`w-full min-w-0 max-w-full overflow-hidden box-border flex items-center gap-2.5 bg-slate-50 focus-within:bg-white px-3.5 py-2.5 rounded-2xl border transition-all ${
                    cleanPhone.length > 0
                      ? isPhoneValid
                        ? "border-emerald-500 bg-emerald-50/20"
                        : "border-amber-400"
                      : "border-slate-200 focus-within:border-blue-600"
                  }`}
                  dir="ltr"
                >
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4" />
                  </div>

                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={11}
                    value={cleanPhone}
                    onChange={(e) => handlePhoneInput(e.target.value)}
                    placeholder="01024419931"
                    className="flex-1 w-full min-w-0 bg-transparent text-base font-black text-slate-900 outline-none tracking-wider font-mono tabular-nums placeholder:text-slate-300 placeholder:font-normal"
                    dir="ltr"
                  />

                  <div className="shrink-0 flex items-center gap-1">
                    {isPhoneValid ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-[11px] font-black">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>11/11</span>
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-lg bg-slate-200/70 text-slate-600 text-[11px] font-mono font-bold tabular-nums">
                        {cleanPhone.length}/11
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-[11px] font-bold text-slate-400 mt-1">
                  {isRTL
                    ? "يبدأ بـ 010 أو 011 أو 012 أو 015 — مثال: 01024419931"
                    : "Starts with 010, 011, 012, or 015 — Example: 01024419931"}
                </p>
              </div>

              {/* Optional Driver Note */}
              <div className="w-full min-w-0">
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  {t("driver_notes", "Notes for Driver (Optional)", "ملاحظات للسائق (اختياري)")}
                </label>
                <div className="relative w-full min-w-0">
                  <input
                    type="text"
                    value={otherPassengerNote}
                    onChange={(e) => setOtherPassengerNote(e.target.value)}
                    placeholder={
                      isRTL
                        ? "مثال: الراكب ينتظر أمام البوابة الرئيسية"
                        : "e.g. Waiting in front of the main gate"
                    }
                    className="w-full min-w-0 box-border bg-slate-50 focus:bg-white px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-600 text-xs font-bold text-slate-800 outline-none transition-all"
                    dir="auto"
                  />
                </div>
              </div>

              {/* Optional 4-Digit Security PIN Toggle */}
              <button
                type="button"
                onClick={() => setRideVerificationEnabled((prev) => !prev)}
                className={`w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl border text-left rtl:text-right transition-all ${
                  rideVerificationEnabled
                    ? "bg-amber-50/70 border-[#FFC90E]"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      rideVerificationEnabled
                        ? "bg-[#FFC90E] text-slate-900"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-black text-slate-900">
                      {t("enable_ride_verification")}
                    </div>
                    <div className="text-[11px] font-bold text-slate-500 leading-snug">
                      {t("ride_verification_desc")}
                    </div>
                  </div>
                </div>
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border ${
                    rideVerificationEnabled
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-white border-slate-300 text-transparent"
                  }`}
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
              </button>
            </div>

            {/* CARD 2: PICKUP & DESTINATION */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-3.5">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Navigation className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    {isRTL ? "مسار الرحلة (الاستلام والوجهة)" : "Ride Route (Pickup & Destination)"}
                  </h3>
                  <p className="text-[11px] font-bold text-slate-400">
                    {isRTL
                      ? "حدد مكان تواجد الراكب ووجهة الوصول"
                      : "Select where the captain will pick up the passenger"}
                  </p>
                </div>
              </div>

              {/* Pickup Box */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-black uppercase text-emerald-700 block">
                      {isRTL ? "موقع استلام الراكب" : "Passenger Pickup Location"}
                    </span>
                    <div
                      className="text-xs sm:text-sm font-black text-slate-900 break-words mt-0.5"
                      dir="auto"
                    >
                      {pickupAddress || t("current_location")}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={onOpenSearchPickup}
                    className="py-2 px-3 rounded-xl bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-black flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <i className="fas fa-search text-[11px]"></i>
                    <span>{isRTL ? "بحث عن عنوان" : "Search Address"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={onPickPickupFromMap}
                    className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <i className="fas fa-map-pin text-[11px]"></i>
                    <span>{isRTL ? "تحديد من الخريطة" : "Pick on Map"}</span>
                  </button>
                </div>
              </div>

              {/* Dropoff Box */}
              <div
                className={`p-3.5 rounded-2xl border space-y-2.5 ${
                  hasDropoff && dropoffAddress
                    ? "bg-rose-50/50 border-rose-200/80"
                    : "bg-slate-50 border-slate-200 border-dashed"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      hasDropoff && dropoffAddress
                        ? "bg-rose-600 text-white"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-black uppercase text-rose-600 block">
                      {isRTL ? "وجهة وصول الراكب *" : "Passenger Destination *"}
                    </span>
                    <div
                      className={`text-xs sm:text-sm font-black break-words mt-0.5 ${
                        hasDropoff && dropoffAddress
                          ? "text-slate-900"
                          : "text-slate-400"
                      }`}
                      dir="auto"
                    >
                      {hasDropoff && dropoffAddress
                        ? dropoffAddress
                        : isRTL
                          ? "لم يتم تحديد الوجهة بعد — اختر بالبحث أو الخريطة"
                          : "No destination selected yet — Search or pick on map"}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={onOpenSearchDropoff}
                    className="py-2 px-3 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs font-black flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <i className="fas fa-search text-[11px]"></i>
                    <span>{isRTL ? "بحث عن الوجهة" : "Search Destination"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={onPickDropoffFromMap}
                    className="py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <i className="fas fa-map-marked-alt text-[11px]"></i>
                    <span>{isRTL ? "تحديد من الخريطة" : "Pick on Map"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* CARD 3: VEHICLE, FARE & PAYMENT */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900">
                  {isRTL ? "نوع المركبة والسعر والدفع" : "Vehicle, Fare & Payment"}
                </h3>
                {distanceKm > 0 && (
                  <span className="text-xs font-black text-blue-600 tabular-nums">
                    {distanceKm.toFixed(1)} {t("km", "km", "كم")} • ~
                    {Math.ceil(distanceKm * 2.5)} {t("min", "min", "دقيقة")}
                  </span>
                )}
              </div>

              {/* Horizontal Scrolling Vehicle Selector */}
              <div className="flex gap-3 overflow-x-auto hide-scrollbar py-2 px-1 -mx-1 snap-x">
                {vehicleTypes.map((v) => {
                  const isSelected = selectedVehicleType === v.id;
                  const vPrice = priceRanges[v.id]?.recommended;
                  const imgSrc =
                    v.image ||
                    v.icon ||
                    (v.id === VehicleType.MOTO
                      ? "/assets/moto.png"
                      : v.id === VehicleType.COMFORT
                        ? "/assets/comf.png"
                        : "/assets/standard.png");
                  const estMinutes =
                    distanceKm > 0 ? Math.max(3, Math.ceil(distanceKm * 2.5)) : null;

                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => onSelectVehicleType(v.id)}
                      className={`snap-center shrink-0 min-w-[118px] h-[136px] p-3 rounded-2xl border transition-all flex flex-col items-center justify-between relative overflow-hidden ${
                        isSelected
                          ? "bg-gradient-to-b from-[#FFF9E5] to-white border-2 border-[#FFC90E] shadow-md scale-[1.02]"
                          : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <div className="w-full flex items-center justify-between gap-1">
                        <span
                          className={`text-[11px] font-black truncate ${
                            isSelected ? "text-amber-700" : "text-slate-700"
                          }`}
                        >
                          {v.name}
                        </span>
                        {v.seats ? (
                          <span className="text-[10px] font-bold text-slate-400 shrink-0">
                            <i className="fas fa-user text-[8px] mx-0.5"></i>
                            {v.seats}
                          </span>
                        ) : null}
                      </div>

                      <div className="w-full h-14 flex items-center justify-center my-1">
                        <img
                          src={imgSrc}
                          alt={v.name}
                          referrerPolicy="no-referrer"
                          className={`w-20 h-14 object-contain drop-shadow-md transition-transform duration-300 mix-blend-multiply ${
                            isSelected ? "scale-115 -translate-y-0.5" : "scale-100"
                          }`}
                        />
                      </div>

                      <div className="w-full text-center">
                        {estMinutes ? (
                          <div className="text-[10px] font-bold text-slate-400 leading-none mb-0.5">
                            {estMinutes} {t("min", "min", "دقيقة")}
                          </div>
                        ) : null}
                        <div
                          className="text-sm font-black text-slate-900 leading-tight tabular-nums"
                          dir="ltr"
                        >
                          {vPrice ? Math.round(vPrice / 5) * 5 : "--"}{" "}
                          <span className="text-[10px] font-bold text-slate-500">
                            {t("currency")}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Fare Adjuster */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-black text-slate-500 block">
                    {isRTL ? "سعر الرحلة المعروض للكابتن" : "Offered Fare"}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    {isRTL
                      ? `السعر المقترح: ${Math.round(recFare / 5) * 5} ${t("currency")}`
                      : `Recommended: ${Math.round(recFare / 5) * 5} ${t("currency")}`}
                  </span>
                </div>

                <div className="flex items-center gap-2" dir="ltr">
                  <button
                    type="button"
                    onClick={() =>
                      setCustomFare(Math.max(minFare, effectiveFare - 5))
                    }
                    className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 active:scale-95"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <div className="min-w-[80px] text-center">
                    <span className="text-lg font-black text-slate-900 font-mono tabular-nums">
                      {effectiveFare}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 ml-1">
                      {t("currency")}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCustomFare(effectiveFare + 5)}
                    className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Payment Method */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setPaymentMethod(PaymentMethod.CASH)}
                  className={`py-3 px-3.5 rounded-2xl border font-black text-xs flex items-center justify-center gap-2 transition-all ${
                    paymentMethod === PaymentMethod.CASH
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                      : "bg-slate-50 text-slate-700 border-slate-200"
                  }`}
                >
                  <i className="fas fa-money-bill-wave"></i>
                  <span>{t("cash", "Cash", "كاش")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod(PaymentMethod.INSTAPAY)}
                  className={`py-3 px-3.5 rounded-2xl border font-black text-xs flex items-center justify-center gap-2 transition-all ${
                    paymentMethod === PaymentMethod.INSTAPAY
                      ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                      : "bg-slate-50 text-slate-700 border-slate-200"
                  }`}
                >
                  <i className="fas fa-mobile-alt"></i>
                  <span>{isRTL ? "انستا باى" : "InstaPay"}</span>
                </button>
              </div>
            </div>

            {/* CARD 4: BOOKING SUMMARY */}
            <div className="bg-blue-50/80 rounded-3xl p-4 border border-blue-200 space-y-2.5">
              <div className="flex items-center justify-between border-b border-blue-200/60 pb-2">
                <span className="text-xs font-black text-blue-900">
                  {t("confirm_passenger_details", "Confirm Passenger Details", "تأكيد بيانات الراكب")}
                </span>
                <span className="text-[11px] font-black text-blue-700">
                  {effectiveFare} {t("currency")}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-slate-500 block">
                    {t("actual_passenger", "Actual Passenger", "الراكب الفعلي")}
                  </span>
                  <div className="font-black text-slate-900 truncate">
                    {otherPassengerName.trim() || (isRTL ? "لم يُدخل بعد" : "Not entered")}
                  </div>
                  <div
                    className="font-mono text-[11px] font-bold text-blue-700 truncate"
                    dir="ltr"
                  >
                    {cleanPhone || "010--------"}
                  </div>
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-slate-500 block">
                    {t("booking_owner", "Booking Owner", "صاحب الحجز")}
                  </span>
                  <div className="font-black text-slate-800 truncate">
                    {userName}
                  </div>
                  <div
                    className="font-mono text-[11px] font-bold text-slate-500 truncate"
                    dir="ltr"
                  >
                    {userPhone}
                  </div>
                </div>
              </div>
            </div>

            {/* Error Alert */}
            {otherPassengerError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-black p-3.5 rounded-2xl flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{otherPassengerError}</span>
              </div>
            )}
          </div>

          {/* Sticky Bottom Submit CTA */}
          <div className="bg-white border-t border-slate-200 p-4 pb-safe shrink-0">
            <div className="max-w-2xl w-full mx-auto flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 h-13 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs shrink-0 active:scale-95 transition-all"
              >
                {t("cancel", "Cancel", "إلغاء")}
              </button>
              <button
                type="button"
                disabled={isRequesting}
                onClick={handleConfirmRequest}
                className="flex-1 h-13 rounded-2xl bg-[#FFC90E] hover:bg-yellow-400 text-slate-900 font-black text-sm sm:text-base shadow-md flex items-center justify-center gap-2 active:scale-[0.99] transition-all disabled:opacity-50"
              >
                <i className="fas fa-paper-plane text-xs"></i>
                <span>
                  {isRequesting
                    ? isRTL
                      ? "جاري إرسال الطلب..."
                      : "Sending Request..."
                    : isRTL
                      ? `اطلب الرحلة للراكب الآن (${effectiveFare} ${t("currency")})`
                      : `Request Ride Now (${effectiveFare} ${t("currency")})`}
                </span>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
