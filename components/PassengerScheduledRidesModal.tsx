import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Navigation,
  Car,
  User as UserIcon,
  Phone,
  CheckCircle2,
  AlertCircle,
  X,
  Repeat,
  Pause,
  Play,
  Trash2,
  Edit3,
  ShieldCheck,
  Sparkles,
  ChevronRight,
  Info,
  Users,
  FileText
} from 'lucide-react';
import {
  Ride,
  RideStatus,
  RecurringSchedule,
  VehicleType,
  PaymentMethod,
  OfferDetails
} from '../types';
import {
  subscribeToPassengerScheduledRides,
  subscribeToPassengerRecurringSchedules,
  cancelScheduledRideByPassenger,
  updateRecurringScheduleStatus,
  updateRecurringScheduleDetails,
  formatInServiceTimezone,
  getScheduledStatusLabel,
  acceptRideOffer,
  rejectRideOffer,
  subscribeToRideOffers
} from '../services/firebase';

interface PassengerScheduledRidesModalProps {
  isOpen: boolean;
  onClose: () => void;
  passengerId: string;
  lang: 'ar' | 'en';
  initialConfirmedRide?: Ride | null;
  onClearConfirmedRide?: () => void;
  onScheduleNewRide?: () => void;
}

const WEEKDAY_LABELS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const WEEKDAY_LABELS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const PassengerScheduledRidesModal: React.FC<PassengerScheduledRidesModalProps> = ({
  isOpen,
  onClose,
  passengerId,
  lang,
  initialConfirmedRide,
  onClearConfirmedRide,
  onScheduleNewRide
}) => {
  const isRtl = lang === 'ar';
  const [activeTab, setActiveTab] = useState<'upcoming' | 'recurring' | 'past'>('upcoming');
  const [scheduledRides, setScheduledRides] = useState<Ride[]>([]);
  const [recurringSchedules, setRecurringSchedules] = useState<RecurringSchedule[]>([]);
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [rideOffers, setRideOffers] = useState<OfferDetails[]>([]);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [editPickupTime, setEditPickupTime] = useState<string>('08:00');
  const [editDriverNote, setEditDriverNote] = useState<string>('');
  const [feedbackBanner, setFeedbackBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen || !passengerId) return;
    const unsubRides = subscribeToPassengerScheduledRides(passengerId, (rides) => {
      setScheduledRides(rides);
    });
    const unsubRecurring = subscribeToPassengerRecurringSchedules(passengerId, (schedules) => {
      setRecurringSchedules(schedules);
    });
    return () => {
      unsubRides();
      unsubRecurring();
    };
  }, [isOpen, passengerId]);

  useEffect(() => {
    if (!selectedRide?.id) {
      setRideOffers([]);
      return;
    }
    const unsub = subscribeToRideOffers(selectedRide.id, (offers) => {
      setRideOffers(offers.filter((o) => o.status === 'pending' || o.status === 'countered'));
    });
    return () => unsub();
  }, [selectedRide?.id]);

  if (!isOpen) return null;

  const upcomingRides = scheduledRides.filter(
    (r) =>
      r.status !== RideStatus.COMPLETED &&
      r.status !== RideStatus.CANCELLED &&
      r.status !== RideStatus.EXPIRED &&
      r.scheduleStatus !== 'COMPLETED' &&
      r.scheduleStatus !== 'CANCELLED' &&
      r.scheduleStatus !== 'NO_DRIVER_FOUND'
  );

  const pastRides = scheduledRides.filter(
    (r) =>
      r.status === RideStatus.COMPLETED ||
      r.status === RideStatus.CANCELLED ||
      r.status === RideStatus.EXPIRED ||
      r.scheduleStatus === 'COMPLETED' ||
      r.scheduleStatus === 'CANCELLED' ||
      r.scheduleStatus === 'NO_DRIVER_FOUND'
  );

  const showToast = (type: 'success' | 'error', text: string) => {
    setFeedbackBanner({ type, text });
    setTimeout(() => setFeedbackBanner(null), 4000);
  };

  const handleCancelRide = async (ride: Ride) => {
    setActionLoadingId(ride.id);
    try {
      const { cancellationFeeApplied } = await cancelScheduledRideByPassenger(
        ride.id,
        passengerId,
        lang === 'ar' ? 'تم الإلغاء بواسطة الراكب' : 'Cancelled by passenger'
      );
      showToast(
        'success',
        cancellationFeeApplied > 0
          ? lang === 'ar'
            ? `تم إلغاء الرحلة المجدولة (تم تطبيق رسوم إلغاء متأخر ${cancellationFeeApplied} ج.م).`
            : `Scheduled ride cancelled (${cancellationFeeApplied} EGP late fee applied).`
          : lang === 'ar'
          ? 'تم إلغاء الرحلة المجدولة بنجاح مجاناً.'
          : 'Scheduled ride cancelled for free.'
      );
      if (selectedRide?.id === ride.id) setSelectedRide(null);
      if (initialConfirmedRide?.id === ride.id && onClearConfirmedRide) onClearConfirmedRide();
    } catch (e: any) {
      showToast('error', e?.message || (lang === 'ar' ? 'تعذر إلغاء الرحلة' : 'Failed to cancel ride'));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleRecurringStatus = async (
    schedule: RecurringSchedule,
    nextStatus: 'ACTIVE' | 'PAUSED' | 'CANCELLED',
    cancelFuture: boolean = false
  ) => {
    setActionLoadingId(schedule.id);
    try {
      await updateRecurringScheduleStatus(schedule.id, passengerId, nextStatus, cancelFuture);
      showToast(
        'success',
        nextStatus === 'PAUSED'
          ? lang === 'ar'
            ? 'تم إيقاف الجدول المتكرر مؤقتاً.'
            : 'Recurring schedule paused.'
          : nextStatus === 'ACTIVE'
          ? lang === 'ar'
            ? 'تم استئناف الجدول المتكرر.'
            : 'Recurring schedule resumed.'
          : lang === 'ar'
          ? 'تم إلغاء سلسلة الرحلات المتكررة وجميع الرحلات المستقبلية.'
          : 'Recurring schedule and future occurrences cancelled.'
      );
    } catch (e: any) {
      showToast('error', e?.message || 'Error updating schedule');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSaveScheduleEdit = async (scheduleId: string) => {
    setActionLoadingId(scheduleId);
    try {
      await updateRecurringScheduleDetails(scheduleId, passengerId, {
        pickupTime: editPickupTime,
        driverNote: editDriverNote || null
      });
      setEditingScheduleId(null);
      showToast(
        'success',
        lang === 'ar' ? 'تم حفظ تعديلات الجدول المتكرر.' : 'Recurring schedule updated.'
      );
    } catch (e: any) {
      showToast('error', e?.message || 'Failed to update schedule');
    } finally {
      setActionLoadingId(null);
    }
  };

  const getCategoryLabel = (cat: VehicleType | string) => {
    if (cat === VehicleType.MOTO || cat === 'MOTO') return lang === 'ar' ? 'موتوسيكل (MOTO)' : 'Moto';
    if (cat === VehicleType.COMFORT || cat === 'COMFORT') return lang === 'ar' ? 'مكيفة (COMFORT)' : 'Comfort';
    return lang === 'ar' ? 'اقتصادية (STANDARD)' : 'Standard';
  };

  const getFrequencyLabel = (freq: string) => {
    if (freq === 'DAILY') return lang === 'ar' ? 'يومياً' : 'Daily';
    if (freq === 'SELECTED_WEEKDAYS') return lang === 'ar' ? 'أيام محددة' : 'Selected Weekdays';
    if (freq === 'WEEKLY') return lang === 'ar' ? 'أسبوعياً' : 'Weekly';
    return lang === 'ar' ? 'مرة واحدة' : 'One-time';
  };

  return (
    <div
      className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-[#1f44df] to-blue-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-[#FFC90E]" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">
                {lang === 'ar' ? 'الرحلات المجدولة والمتكررة' : 'Scheduled & Recurring Rides'}
              </h2>
              <p className="text-xs text-blue-100">
                {lang === 'ar'
                  ? 'إدارة حجوزاتك المسبقة حتى 7 أيام والتنقلات اليومية'
                  : 'Manage advance bookings up to 7 days & recurring trips'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast Feedback */}
        {feedbackBanner && (
          <div
            className={`px-4 py-2.5 text-xs font-bold flex items-center justify-between ${
              feedbackBanner.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200'
                : 'bg-red-50 text-red-800 border-b border-red-200 dark:bg-red-950/60 dark:text-red-200'
            }`}
          >
            <span>{feedbackBanner.text}</span>
            <button onClick={() => setFeedbackBanner(null)} className="opacity-70 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Booking Confirmation Card (when a new scheduled ride was just created) */}
        {initialConfirmedRide && (
          <div className="m-4 p-4 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/40 border-2 border-emerald-500/40 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-emerald-950 dark:text-emerald-200">
                    {lang === 'ar' ? 'تم تأكيد جدولة رحلتك بنجاح!' : 'Scheduled Ride Confirmed!'}
                  </h3>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    {lang === 'ar'
                      ? 'تم إشعار السائقين المؤهلين للقبول المسبق، كما يعمل البحث التلقائي قبل الموعد بـ 30 دقيقة.'
                      : 'Eligible drivers have been notified for early acceptance; automatic dispatch starts 30 mins before pickup.'}
                  </p>
                </div>
              </div>
              {onClearConfirmedRide && (
                <button
                  onClick={onClearConfirmedRide}
                  className="text-xs font-bold text-emerald-700 dark:text-emerald-300 underline shrink-0"
                >
                  {lang === 'ar' ? 'إخفاء' : 'Dismiss'}
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-white dark:bg-slate-900 p-3 rounded-xl border border-emerald-200/70 dark:border-emerald-900">
              <div>
                <span className="text-slate-400 block">
                  {lang === 'ar' ? 'الموعد المجدول' : 'Scheduled Time'}
                </span>
                <span className="font-black text-slate-800 dark:text-white">
                  {
                    formatInServiceTimezone(
                      initialConfirmedRide.scheduledPickupAt ||
                        initialConfirmedRide.scheduledTime ||
                        Date.now()
                    )[lang === 'ar' ? 'formattedAr' : 'formattedEn']
                  }
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">
                  {lang === 'ar' ? 'فئة المركبة' : 'Category'}
                </span>
                <span className="font-bold text-slate-800 dark:text-white">
                  {getCategoryLabel(initialConfirmedRide.requestedVehicleType)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">
                  {lang === 'ar' ? 'الأجرة التقديرية' : 'Fare Estimate'}
                </span>
                <span className="font-black text-emerald-700 dark:text-emerald-400">
                  {initialConfirmedRide.fare} {lang === 'ar' ? 'ج.م' : 'EGP'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">
                  {lang === 'ar' ? 'حالة الحجز' : 'Booking Status'}
                </span>
                <span className="font-bold text-amber-600 dark:text-amber-400">
                  {lang === 'ar' ? 'بانتظار قبول سائق' : 'Awaiting Driver'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="px-4 pt-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`flex-1 py-2.5 text-xs sm:text-sm font-black border-b-2 transition flex items-center justify-center gap-1.5 ${
              activeTab === 'upcoming'
                ? 'border-[#1f44df] text-[#1f44df] dark:border-[#FFC90E] dark:text-[#FFC90E]'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>{lang === 'ar' ? 'القادمة' : 'Upcoming'}</span>
            <span className="px-1.5 py-0.5 text-[11px] rounded-md bg-blue-100 dark:bg-slate-800 text-blue-800 dark:text-blue-300">
              {upcomingRides.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('recurring')}
            className={`flex-1 py-2.5 text-xs sm:text-sm font-black border-b-2 transition flex items-center justify-center gap-1.5 ${
              activeTab === 'recurring'
                ? 'border-[#1f44df] text-[#1f44df] dark:border-[#FFC90E] dark:text-[#FFC90E]'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <Repeat className="w-4 h-4" />
            <span>{lang === 'ar' ? 'المتكررة' : 'Recurring'}</span>
            <span className="px-1.5 py-0.5 text-[11px] rounded-md bg-blue-100 dark:bg-slate-800 text-blue-800 dark:text-blue-300">
              {recurringSchedules.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('past')}
            className={`flex-1 py-2.5 text-xs sm:text-sm font-black border-b-2 transition flex items-center justify-center gap-1.5 ${
              activeTab === 'past'
                ? 'border-[#1f44df] text-[#1f44df] dark:border-[#FFC90E] dark:text-[#FFC90E]'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>{lang === 'ar' ? 'السابقة' : 'Past'}</span>
            <span className="px-1.5 py-0.5 text-[11px] rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {pastRides.length}
            </span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {/* TAB 1: UPCOMING SCHEDULED RIDES */}
          {activeTab === 'upcoming' && (
            <>
              {upcomingRides.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                    <Calendar className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">
                      {lang === 'ar'
                        ? 'لا توجد رحلات مجدولة قادمة حالياً'
                        : 'No upcoming scheduled rides'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {lang === 'ar'
                        ? 'يمكنك جدولة رحلتك القادمة حتى 7 أيام مقدماً أو إعداد جدول يومي متكرر.'
                        : 'Schedule your ride up to 7 days in advance or set up a recurring commute.'}
                    </p>
                  </div>
                  {onScheduleNewRide && (
                    <button
                      onClick={() => {
                        onClose();
                        onScheduleNewRide();
                      }}
                      className="px-5 py-2.5 rounded-xl bg-[#1f44df] text-white text-xs font-black hover:bg-blue-700 transition"
                    >
                      {lang === 'ar' ? '+ جدولة رحلة جديدة الآن' : '+ Schedule a Ride Now'}
                    </button>
                  )}
                </div>
              ) : (
                upcomingRides.map((ride) => {
                  const pickupAt = ride.scheduledPickupAt || ride.scheduledTime || Date.now();
                  const tz = formatInServiceTimezone(pickupAt);
                  const statusBadge = getScheduledStatusLabel(
                    ride.scheduleStatus || 'SCHEDULED',
                    lang,
                    'PASSENGER',
                    pickupAt
                  );

                  return (
                    <div
                      key={ride.id}
                      className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:border-blue-300 dark:hover:border-blue-800 transition space-y-3"
                    >
                      {/* Top row: Date/Time & Status Badge */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <div className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-[#1f44df] dark:text-blue-300 font-black text-xs flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{lang === 'ar' ? tz.formattedAr : tz.formattedEn}</span>
                          </div>
                          {ride.recurringScheduleId && (
                            <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-[11px] font-bold flex items-center gap-1">
                              <Repeat className="w-3 h-3" />
                              {lang === 'ar' ? 'رحلة متكررة' : 'Recurring'}
                            </span>
                          )}
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${statusBadge.badgeBg} ${statusBadge.colorClass}`}
                        >
                          {statusBadge.label}
                        </span>
                      </div>

                      {/* Route */}
                      <div className="space-y-1.5 text-xs bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl">
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                          <div className="flex-1">
                            <span className="text-slate-400 block text-[10px]">
                              {lang === 'ar' ? 'نقطة الانطلاق' : 'Pickup'}
                            </span>
                            <span className="font-bold text-slate-800 dark:text-slate-100">
                              {ride.pickup?.address}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                          <div className="flex-1">
                            <span className="text-slate-400 block text-[10px]">
                              {lang === 'ar' ? 'الوجهة' : 'Destination'}
                            </span>
                            <span className="font-bold text-slate-800 dark:text-slate-100">
                              {ride.dropoff?.address}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Meta Info: Category, Fare & Lock status, Passenger Count */}
                      <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                          <span className="flex items-center gap-1 font-bold">
                            <Car className="w-3.5 h-3.5 text-blue-600" />
                            {getCategoryLabel(ride.requestedVehicleType)}
                          </span>
                          {ride.passengerCount && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5 text-slate-400" />
                              {ride.passengerCount} {lang === 'ar' ? 'ركاب' : 'pax'}
                            </span>
                          )}
                          {ride.bookingType === 'FOR_OTHER' && ride.actualPassenger?.name && (
                            <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-bold">
                              {lang === 'ar'
                                ? `لـ ${ride.actualPassenger.name}`
                                : `For ${ride.actualPassenger.name}`}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900 dark:text-white">
                            {ride.lockedFare || ride.fare} {lang === 'ar' ? 'ج.م' : 'EGP'}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                              ride.fareLocked
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {ride.fareLocked
                              ? lang === 'ar'
                                ? 'سعر مثبت'
                                : 'Locked Fare'
                              : lang === 'ar'
                              ? 'سعر تقديري'
                              : 'Estimated Fare'}
                          </span>
                        </div>
                      </div>

                      {/* Driver Note if present */}
                      {ride.driverNote && (
                        <div className="text-xs text-slate-600 dark:text-slate-300 bg-amber-50/60 dark:bg-slate-800/40 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>
                            {lang === 'ar' ? 'ملاحظة للسائق: ' : 'Driver Note: '}
                            {ride.driverNote}
                          </span>
                        </div>
                      )}

                      {/* Assigned Driver Details Card */}
                      {ride.driverId ? (
                        <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-sm overflow-hidden shrink-0">
                              {ride.driverAvatar ? (
                                <img
                                  src={ride.driverAvatar}
                                  alt={ride.driverName || 'Driver'}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                (ride.driverName || 'D')[0]
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-black text-xs text-slate-900 dark:text-white">
                                  {ride.driverName || (lang === 'ar' ? 'كابتن مواصلة' : 'Mowasla Captain')}
                                </span>
                                <span className="text-[11px] font-bold text-amber-600">
                                  ★ {(ride.driverRating || 5.0).toFixed(1)}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                                {ride.driverVehicleModel || ''}{' '}
                                {ride.driverVehiclePlate ? `• ${ride.driverVehiclePlate}` : ''}
                              </p>
                            </div>
                          </div>
                          {ride.driverPhone && (
                            <a
                              href={`tel:${ride.driverPhone}`}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-1 hover:bg-emerald-700 transition"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span>{lang === 'ar' ? 'اتصال' : 'Call'}</span>
                            </a>
                          )}
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span>
                            {lang === 'ar'
                              ? 'الرحلة معروضة حالياً للسائقين للقبول المسبق، وسيبدأ البحث التلقائي المكثف قبل الموعد بـ 30 دقيقة.'
                              : 'Visible to drivers for early acceptance; automatic dispatch starts 30m before pickup.'}
                          </span>
                        </div>
                      )}

                      {/* Actions Row */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                        <button
                          onClick={() =>
                            setSelectedRide(selectedRide?.id === ride.id ? null : ride)
                          }
                          className="text-xs font-bold text-[#1f44df] dark:text-blue-400 hover:underline flex items-center gap-1"
                        >
                          <span>
                            {selectedRide?.id === ride.id
                              ? lang === 'ar'
                                ? 'إخفاء التفاصيل والعروض'
                                : 'Hide Details & Offers'
                              : lang === 'ar'
                              ? 'عرض التفاصيل والعروض'
                              : 'View Details & Offers'}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>

                        <button
                          disabled={actionLoadingId === ride.id}
                          onClick={() => handleCancelRide(ride)}
                          className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-300 text-xs font-bold transition disabled:opacity-50"
                        >
                          {actionLoadingId === ride.id
                            ? lang === 'ar'
                              ? 'جاري الإلغاء...'
                              : 'Cancelling...'
                            : lang === 'ar'
                            ? 'إلغاء الحجز'
                            : 'Cancel Ride'}
                        </button>
                      </div>

                      {/* Expanded Details & Incoming Driver Offers */}
                      {selectedRide?.id === ride.id && (
                        <div className="mt-2 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                          <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
                            <div>
                              <span className="text-slate-400 block text-[10px]">
                                {lang === 'ar' ? 'المسافة والمدة المقدرة' : 'Est. Distance & Time'}
                              </span>
                              <span className="font-bold">
                                {ride.distanceText} • {ride.durationText}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">
                                {lang === 'ar' ? 'طريقة الدفع' : 'Payment Method'}
                              </span>
                              <span className="font-bold">{ride.paymentMethod}</span>
                            </div>
                          </div>

                          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-[11px] text-slate-500">
                            {lang === 'ar'
                              ? 'سياسة الإلغاء: الإلغاء مجاني تماماً طالما لم يتم تعيين سائق أو قبل موعد الانطلاق بأكثر من 60 دقيقة.'
                              : 'Cancellation Policy: Free cancellation before driver assignment or at least 60 minutes before scheduled pickup.'}
                          </div>

                          {rideOffers.length > 0 && !ride.driverId && (
                            <div className="space-y-2 pt-1">
                              <p className="font-black text-slate-800 dark:text-white">
                                {lang === 'ar'
                                  ? `عروض السائقين المسبقة (${rideOffers.length})`
                                  : `Driver Offers (${rideOffers.length})`}
                              </p>
                              {rideOffers.map((offer) => (
                                <div
                                  key={offer.id || offer.driverId}
                                  className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 flex items-center justify-between gap-2"
                                >
                                  <div>
                                    <p className="font-bold text-slate-900 dark:text-white">
                                      {offer.driverName} ★ {(offer.driverRating || 5.0).toFixed(1)}
                                    </p>
                                    <p className="text-[11px] text-slate-500">
                                      {offer.vehicleModel} •{' '}
                                      <span className="font-black text-blue-700 dark:text-blue-300">
                                        {offer.price} {lang === 'ar' ? 'ج.م' : 'EGP'}
                                      </span>
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={async () => {
                                        await acceptRideOffer(ride.id, offer);
                                        showToast(
                                          'success',
                                          lang === 'ar'
                                            ? 'تم قبول عرض السائق وتعيينه للرحلة المجدولة.'
                                            : 'Driver offer accepted.'
                                        );
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold"
                                    >
                                      {lang === 'ar' ? 'قبول' : 'Accept'}
                                    </button>
                                    <button
                                      onClick={async () => {
                                        if (offer.id) await rejectRideOffer(ride.id, offer.id);
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold"
                                    >
                                      {lang === 'ar' ? 'رفض' : 'Decline'}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}

          {/* TAB 2: RECURRING SCHEDULES */}
          {activeTab === 'recurring' && (
            <>
              {recurringSchedules.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                    <Repeat className="w-7 h-7" />
                  </div>
                  <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">
                    {lang === 'ar'
                      ? 'لا توجد جداول رحلات متكررة حالياً'
                      : 'No recurring ride schedules yet'}
                  </p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    {lang === 'ar'
                      ? 'عند جدولة رحلة، اختر (يومياً / أيام العمل / أسبوعياً) ليقوم النظام بإنشاء رحلاتك تلقائياً خلال نافذة الـ 7 أيام المتجددة.'
                      : 'Select Daily, Selected Weekdays, or Weekly when scheduling a ride to automatically generate rides in a rolling 7-day window.'}
                  </p>
                </div>
              ) : (
                recurringSchedules.map((sched) => (
                  <div
                    key={sched.id}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-black text-xs flex items-center gap-1.5">
                          <Repeat className="w-3.5 h-3.5" />
                          {getFrequencyLabel(sched.frequency)} • {sched.pickupTime}
                        </span>
                        <span className="text-xs font-bold text-slate-500">
                          {getCategoryLabel(sched.category)}
                        </span>
                      </div>

                      <span
                        className={`px-2.5 py-0.5 rounded-lg text-xs font-bold ${
                          sched.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : sched.status === 'PAUSED'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                        }`}
                      >
                        {sched.status === 'ACTIVE'
                          ? lang === 'ar'
                            ? 'نشط'
                            : 'Active'
                          : sched.status === 'PAUSED'
                          ? lang === 'ar'
                            ? 'متوقف مؤقتاً'
                            : 'Paused'
                          : lang === 'ar'
                          ? 'ملغي'
                          : 'Cancelled'}
                      </span>
                    </div>

                    {/* Weekdays pills */}
                    {Array.isArray(sched.weekdays) && sched.weekdays.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {sched.weekdays.map((dayIdx) => (
                          <span
                            key={dayIdx}
                            className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold"
                          >
                            {lang === 'ar' ? WEEKDAY_LABELS_AR[dayIdx] : WEEKDAY_LABELS_EN[dayIdx]}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Route */}
                    <div className="text-xs space-y-1 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl">
                      <p className="font-bold text-slate-800 dark:text-slate-200">
                        🟢 {sched.pickup?.address}
                      </p>
                      <p className="font-bold text-slate-800 dark:text-slate-200">
                        🔴 {sched.dropoff?.address}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>
                        {lang === 'ar' ? 'تاريخ البدء: ' : 'Starts: '} {sched.startDate}
                        {sched.endDate
                          ? ` • ${lang === 'ar' ? 'ينتهي: ' : 'Ends: '}${sched.endDate}`
                          : ''}
                      </span>
                      <span className="font-black text-slate-900 dark:text-white">
                        {sched.fareEstimate} {lang === 'ar' ? 'ج.م / رحلة' : 'EGP / ride'}
                      </span>
                    </div>

                    {/* Edit Inline Form */}
                    {editingScheduleId === sched.id && (
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 space-y-2.5 border border-slate-200 dark:border-slate-700">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="text-[11px] font-bold text-slate-500 block mb-1">
                              {lang === 'ar' ? 'وقت الانطلاق الجديد' : 'New Pickup Time'}
                            </label>
                            <input
                              type="time"
                              value={editPickupTime}
                              onChange={(e) => setEditPickupTime(e.target.value)}
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-slate-500 block mb-1">
                              {lang === 'ar' ? 'ملاحظة للسائق' : 'Driver Note'}
                            </label>
                            <input
                              type="text"
                              value={editDriverNote}
                              onChange={(e) => setEditDriverNote(e.target.value)}
                              placeholder={lang === 'ar' ? 'ملاحظة اختيارية...' : 'Optional note...'}
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setEditingScheduleId(null)}
                            className="px-3 py-1 rounded-lg text-xs font-bold text-slate-500"
                          >
                            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                          </button>
                          <button
                            onClick={() => handleSaveScheduleEdit(sched.id)}
                            className="px-3 py-1 rounded-lg bg-[#1f44df] text-white text-xs font-bold"
                          >
                            {lang === 'ar' ? 'حفظ التعديلات' : 'Save Changes'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Controls */}
                    {sched.status !== 'CANCELLED' && (
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          {sched.status === 'ACTIVE' ? (
                            <button
                              disabled={actionLoadingId === sched.id}
                              onClick={() => handleToggleRecurringStatus(sched, 'PAUSED', false)}
                              className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center gap-1"
                            >
                              <Pause className="w-3.5 h-3.5" />
                              <span>{lang === 'ar' ? 'إيقاف مؤقت' : 'Pause'}</span>
                            </button>
                          ) : (
                            <button
                              disabled={actionLoadingId === sched.id}
                              onClick={() => handleToggleRecurringStatus(sched, 'ACTIVE', false)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>{lang === 'ar' ? 'استئناف' : 'Resume'}</span>
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setEditingScheduleId(sched.id);
                              setEditPickupTime(sched.pickupTime);
                              setEditDriverNote(sched.driverNote || '');
                            }}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>{lang === 'ar' ? 'تعديل الموعد' : 'Edit'}</span>
                          </button>
                        </div>

                        <button
                          disabled={actionLoadingId === sched.id}
                          onClick={() => handleToggleRecurringStatus(sched, 'CANCELLED', true)}
                          className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-300 text-xs font-bold flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{lang === 'ar' ? 'إلغاء السلسلة بالكامل' : 'Cancel Series'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </>
          )}

          {/* TAB 3: PAST SCHEDULED RIDES */}
          {activeTab === 'past' && (
            <>
              {pastRides.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  {lang === 'ar'
                    ? 'لا توجد رحلات مجدولة سابقة.'
                    : 'No past scheduled rides found.'}
                </div>
              ) : (
                pastRides.map((ride) => {
                  const pickupAt = ride.scheduledPickupAt || ride.scheduledTime || ride.timestamp;
                  const tz = formatInServiceTimezone(pickupAt);
                  const statusBadge = getScheduledStatusLabel(
                    ride.scheduleStatus ||
                      (ride.status === RideStatus.COMPLETED
                        ? 'COMPLETED'
                        : ride.status === RideStatus.EXPIRED
                        ? 'NO_DRIVER_FOUND'
                        : 'CANCELLED'),
                    lang,
                    'PASSENGER'
                  );

                  return (
                    <div
                      key={ride.id}
                      className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {lang === 'ar' ? tz.formattedAr : tz.formattedEn}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold border ${statusBadge.badgeBg} ${statusBadge.colorClass}`}
                        >
                          {statusBadge.label}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300">
                        {ride.pickup?.address} ← {ride.dropoff?.address}
                      </p>
                      <div className="flex items-center justify-between text-slate-500">
                        <span>{getCategoryLabel(ride.requestedVehicleType)}</span>
                        <span className="font-black text-slate-800 dark:text-white">
                          {ride.fare} {lang === 'ar' ? 'ج.م' : 'EGP'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
