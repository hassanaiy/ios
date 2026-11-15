import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Navigation,
  Car,
  Phone,
  CheckCircle2,
  AlertTriangle,
  X,
  Repeat,
  Users,
  FileText,
  DollarSign,
  Play,
  ArrowRight,
  RotateCcw
} from 'lucide-react';
import { Driver, Ride, VehicleType } from '../types';
import {
  subscribeToDriverScheduledRides,
  acceptScheduledRideAtomic,
  submitScheduledRideOffer,
  releaseAndReassignScheduledRide,
  updateScheduledRideTripStage,
  formatInServiceTimezone,
  getScheduledStatusLabel,
  calculateHaversineDistanceKm
} from '../services/firebase';

interface DriverScheduledRidesViewProps {
  isOpen: boolean;
  onClose: () => void;
  driver: Driver;
  lang: 'ar' | 'en';
}

export const DriverScheduledRidesView: React.FC<DriverScheduledRidesViewProps> = ({
  isOpen,
  onClose,
  driver,
  lang
}) => {
  const isRtl = lang === 'ar';
  const [activeTab, setActiveTab] = useState<'available' | 'assigned'>('available');
  const [availableRides, setAvailableRides] = useState<Ride[]>([]);
  const [myAssignedRides, setMyAssignedRides] = useState<Ride[]>([]);
  const [busyRideId, setBusyRideId] = useState<string | null>(null);
  const [offerModalRide, setOfferModalRide] = useState<Ride | null>(null);
  const [customOfferAmount, setCustomOfferAmount] = useState<string>('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen || !driver?.id) return;
    const unsub = subscribeToDriverScheduledRides(
      driver.id,
      driver.vehicleType,
      ({ availableRides: avail, myAssignedRides: assigned }) => {
        setAvailableRides(avail);
        setMyAssignedRides(assigned);
      }
    );
    return () => unsub();
  }, [isOpen, driver?.id, driver?.vehicleType]);

  if (!isOpen) return null;

  const showToast = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4500);
  };

  const handleAcceptEarly = async (ride: Ride) => {
    setBusyRideId(ride.id);
    try {
      await acceptScheduledRideAtomic(ride.id, driver.id);
      showToast(
        'success',
        lang === 'ar'
          ? 'تم قبول الرحلة المجدولة وتعيينها لك بنجاح! سنذكرك قبل موعد الانطلاق.'
          : 'Scheduled ride accepted and assigned to you!'
      );
      setActiveTab('assigned');
    } catch (e: any) {
      showToast(
        'error',
        e?.message || (lang === 'ar' ? 'تعذر قبول الرحلة المجدولة' : 'Failed to accept scheduled ride')
      );
    } finally {
      setBusyRideId(null);
    }
  };

  const handleSubmitOffer = async () => {
    if (!offerModalRide) return;
    const price = Number(customOfferAmount);
    if (!price || price <= 0) return;

    setBusyRideId(offerModalRide.id);
    try {
      await submitScheduledRideOffer(offerModalRide.id, driver, price);
      setOfferModalRide(null);
      setCustomOfferAmount('');
      showToast(
        'success',
        lang === 'ar'
          ? 'تم إرسال عرض السعر للراكب بنجاح.'
          : 'Offer submitted to passenger.'
      );
    } catch (e: any) {
      showToast('error', e?.message || 'Failed to submit offer');
    } finally {
      setBusyRideId(null);
    }
  };

  const handleReleaseAssignment = async (ride: Ride) => {
    setBusyRideId(ride.id);
    try {
      await releaseAndReassignScheduledRide(
        ride.id,
        lang === 'ar' ? 'اعتذر السائق عن الرحلة المجدولة' : 'Driver released scheduled assignment',
        'DRIVER',
        driver.id
      );
      showToast(
        'success',
        lang === 'ar'
          ? 'تم إلغاء تعيينك وإعادة فتح الرحلة لتعيين سائق بديل.'
          : 'Assignment released and ride queued for reassignment.'
      );
    } catch (e: any) {
      showToast('error', e?.message || 'Error releasing ride');
    } finally {
      setBusyRideId(null);
    }
  };

  const handleStageUpdate = async (
    ride: Ride,
    stage: 'DRIVER_EN_ROUTE' | 'DRIVER_ARRIVED' | 'IN_PROGRESS' | 'COMPLETED'
  ) => {
    setBusyRideId(ride.id);
    try {
      await updateScheduledRideTripStage(ride.id, driver.id, stage);
      showToast(
        'success',
        lang === 'ar' ? 'تم تحديث حالة الرحلة المجدولة.' : 'Scheduled ride stage updated.'
      );
    } catch (e: any) {
      showToast('error', e?.message || 'Failed to update stage');
    } finally {
      setBusyRideId(null);
    }
  };

  const getCategoryName = (cat: VehicleType | string) => {
    if (cat === VehicleType.MOTO || cat === 'MOTO') return lang === 'ar' ? 'موتوسيكل' : 'Moto';
    if (cat === VehicleType.COMFORT || cat === 'COMFORT') return lang === 'ar' ? 'مكيفة' : 'Comfort';
    return lang === 'ar' ? 'اقتصادية' : 'Standard';
  };

  return (
    <div
      className="fixed inset-0 z-[120] bg-slate-950/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFC90E]/20 border border-[#FFC90E]/40 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-[#FFC90E]" />
            </div>
            <div>
              <h2 className="text-lg font-black">
                {lang === 'ar' ? 'الرحلات المجدولة للكباتن' : 'Scheduled Rides for Drivers'}
              </h2>
              <p className="text-xs text-slate-300">
                {lang === 'ar'
                  ? 'اقبل الرحلات المجدولة مسبقاً وخطط جدول عملك اليومي'
                  : 'Accept scheduled trips in advance & manage your assigned schedule'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast */}
        {feedback && (
          <div
            className={`px-4 py-2.5 text-xs font-bold flex items-center justify-between ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200'
                : 'bg-red-50 text-red-800 border-b border-red-200 dark:bg-red-950/60 dark:text-red-200'
            }`}
          >
            <span>{feedback.text}</span>
            <button onClick={() => setFeedback(null)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="px-4 pt-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('available')}
            className={`flex-1 py-2.5 text-xs sm:text-sm font-black border-b-2 transition flex items-center justify-center gap-2 ${
              activeTab === 'available'
                ? 'border-[#1f44df] text-[#1f44df] dark:border-[#FFC90E] dark:text-[#FFC90E]'
                : 'border-transparent text-slate-500'
            }`}
          >
            <span>{lang === 'ar' ? 'متاحة للسائقين' : 'Available to Accept'}</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-slate-800 text-blue-700 dark:text-blue-300 text-xs">
              {availableRides.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('assigned')}
            className={`flex-1 py-2.5 text-xs sm:text-sm font-black border-b-2 transition flex items-center justify-center gap-2 ${
              activeTab === 'assigned'
                ? 'border-[#1f44df] text-[#1f44df] dark:border-[#FFC90E] dark:text-[#FFC90E]'
                : 'border-transparent text-slate-500'
            }`}
          >
            <span>{lang === 'ar' ? 'رحلاتي المجدولة' : 'My Assigned Schedule'}</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 text-xs">
              {myAssignedRides.length}
            </span>
          </button>
        </div>

        {/* Ride List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {activeTab === 'available' && (
            <>
              {availableRides.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                    {lang === 'ar'
                      ? 'لا توجد رحلات مجدولة متاحة حالياً لفئة مركبتك'
                      : 'No available scheduled rides matching your vehicle right now'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {lang === 'ar'
                      ? 'ستصلك إشعارات فورية بمجرد قيام الركاب بجدولة رحلات جديدة.'
                      : 'You will be notified immediately when passengers schedule new rides.'}
                  </p>
                </div>
              ) : (
                availableRides.map((ride) => {
                  const pickupAt = ride.scheduledPickupAt || ride.scheduledTime || Date.now();
                  const tz = formatInServiceTimezone(pickupAt);
                  const badge = getScheduledStatusLabel(
                    ride.scheduleStatus || 'SCHEDULED',
                    lang,
                    'DRIVER',
                    pickupAt
                  );
                  const distFromDriver =
                    driver.currentLocation && ride.pickup?.coords
                      ? calculateHaversineDistanceKm(driver.currentLocation, ride.pickup.coords)
                      : null;

                  return (
                    <div
                      key={ride.id}
                      className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 rounded-xl bg-amber-400/20 text-amber-900 dark:text-amber-300 font-black text-xs flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            {lang === 'ar' ? tz.formattedAr : tz.formattedEn}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold border ${badge.badgeBg} ${badge.colorClass}`}
                          >
                            {badge.label}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                            {ride.fare} {lang === 'ar' ? 'ج.م' : 'EGP'}
                          </span>
                        </div>
                      </div>

                      {/* Route */}
                      <div className="space-y-1.5 text-xs bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl">
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                          <div>
                            <span className="text-slate-400 block text-[10px]">
                              {lang === 'ar' ? 'نقطة الانطلاق' : 'Pickup'}
                            </span>
                            <span className="font-bold text-slate-800 dark:text-white">
                              {ride.pickup?.address}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                          <div>
                            <span className="text-slate-400 block text-[10px]">
                              {lang === 'ar' ? 'الوجهة' : 'Destination'}
                            </span>
                            <span className="font-bold text-slate-800 dark:text-white">
                              {ride.dropoff?.address}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Trip Metrics */}
                      <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-3">
                          <span className="font-bold">
                            {ride.distanceText} • {ride.durationText}
                          </span>
                          <span>{getCategoryName(ride.requestedVehicleType)}</span>
                          {distFromDriver !== null && (
                            <span className="text-blue-600 dark:text-blue-400 font-bold">
                              {distFromDriver.toFixed(1)} {lang === 'ar' ? 'كم منك' : 'km away'}
                            </span>
                          )}
                        </div>
                        {ride.passengerCount && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" /> {ride.passengerCount}
                          </span>
                        )}
                      </div>

                      {ride.driverNote && (
                        <div className="text-xs bg-amber-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg text-slate-700 dark:text-slate-300">
                          📝 {ride.driverNote}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                        <button
                          disabled={busyRideId === ride.id}
                          onClick={() => handleAcceptEarly(ride)}
                          className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition disabled:opacity-50"
                        >
                          {busyRideId === ride.id
                            ? lang === 'ar'
                              ? 'جاري التأكيد...'
                              : 'Confirming...'
                            : lang === 'ar'
                            ? `قبول الرحلة مسبقاً (${ride.fare} ج.م)`
                            : `Accept Scheduled Ride (${ride.fare} EGP)`}
                        </button>
                        <button
                          onClick={() => {
                            setOfferModalRide(ride);
                            setCustomOfferAmount(String(ride.fare));
                          }}
                          className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold transition"
                        >
                          {lang === 'ar' ? 'تقديم عرض' : 'Submit Offer'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}

          {activeTab === 'assigned' && (
            <>
              {myAssignedRides.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  {lang === 'ar'
                    ? 'لم تقم بقبول أي رحلات مجدولة بعد. تصفح قسم (متاحة للسائقين) لقبول رحلات مسبقة.'
                    : 'You have no assigned scheduled rides yet.'}
                </div>
              ) : (
                myAssignedRides.map((ride) => {
                  const pickupAt = ride.scheduledPickupAt || ride.scheduledTime || Date.now();
                  const tz = formatInServiceTimezone(pickupAt);
                  const badge = getScheduledStatusLabel(
                    ride.scheduleStatus || 'DRIVER_ASSIGNED',
                    lang,
                    'DRIVER',
                    pickupAt
                  );
                  const isTerminal =
                    ride.status === 'COMPLETED' ||
                    ride.status === 'CANCELLED' ||
                    ride.scheduleStatus === 'COMPLETED' ||
                    ride.scheduleStatus === 'CANCELLED';

                  return (
                    <div
                      key={ride.id}
                      className="p-4 rounded-2xl border-2 border-emerald-500/30 bg-white dark:bg-slate-900 shadow-sm space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-black text-xs">
                          📅 {lang === 'ar' ? tz.formattedAr : tz.formattedEn}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${badge.badgeBg} ${badge.colorClass}`}
                        >
                          {badge.label}
                        </span>
                      </div>

                      <div className="space-y-1 text-xs bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl">
                        <p className="font-bold text-slate-800 dark:text-white">
                          🟢 {ride.pickup?.address}
                        </p>
                        <p className="font-bold text-slate-800 dark:text-white">
                          🔴 {ride.dropoff?.address}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-200">
                          👤 {ride.passengerName || (lang === 'ar' ? 'راكب مواصلة' : 'Passenger')}
                        </span>
                        <span className="font-black text-emerald-600 text-sm">
                          {ride.lockedFare || ride.fare} {lang === 'ar' ? 'ج.م' : 'EGP'}
                        </span>
                      </div>

                      {!isTerminal && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            {ride.scheduleStatus === 'DRIVER_ASSIGNED' && (
                              <button
                                disabled={busyRideId === ride.id}
                                onClick={() => handleStageUpdate(ride, 'DRIVER_EN_ROUTE')}
                                className="px-3.5 py-2 rounded-xl bg-[#1f44df] text-white text-xs font-black"
                              >
                                {lang === 'ar'
                                  ? '🚗 التحرك لنقطة الانطلاق'
                                  : 'Start Heading to Pickup'}
                              </button>
                            )}
                            {ride.scheduleStatus === 'DRIVER_EN_ROUTE' && (
                              <button
                                disabled={busyRideId === ride.id}
                                onClick={() => handleStageUpdate(ride, 'DRIVER_ARRIVED')}
                                className="px-3.5 py-2 rounded-xl bg-teal-600 text-white text-xs font-black"
                              >
                                {lang === 'ar' ? '📍 وصلت لنقطة الانطلاق' : 'Arrived at Pickup'}
                              </button>
                            )}
                            {ride.scheduleStatus === 'DRIVER_ARRIVED' && (
                              <button
                                disabled={busyRideId === ride.id}
                                onClick={() => handleStageUpdate(ride, 'IN_PROGRESS')}
                                className="px-3.5 py-2 rounded-xl bg-purple-600 text-white text-xs font-black"
                              >
                                {lang === 'ar' ? '🚀 بدء الرحلة الآن' : 'Start Trip'}
                              </button>
                            )}
                          </div>

                          {ride.scheduleStatus === 'DRIVER_ASSIGNED' && (
                            <button
                              disabled={busyRideId === ride.id}
                              onClick={() => handleReleaseAssignment(ride)}
                              className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-300 text-xs font-bold flex items-center gap-1"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>{lang === 'ar' ? 'اعتذار وإعادة تعيين' : 'Release Ride'}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>

        {/* Custom Offer Sub-Modal */}
        {offerModalRide && (
          <div className="p-4 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 dark:text-white">
                {lang === 'ar'
                  ? `تقديم عرض سعر للرحلة المجدولة (السعر المقترح: ${offerModalRide.fare} ج.م)`
                  : `Submit Offer (Suggested: ${offerModalRide.fare} EGP)`}
              </span>
              <button onClick={() => setOfferModalRide(null)} className="text-xs text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={customOfferAmount}
                onChange={(e) => setCustomOfferAmount(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-black"
              />
              <button
                onClick={handleSubmitOffer}
                className="px-4 py-2 rounded-xl bg-[#1f44df] text-white text-xs font-black"
              >
                {lang === 'ar' ? 'إرسال العرض' : 'Send Offer'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
