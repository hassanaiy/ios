import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  writeBatch,
  increment,
  arrayUnion
} from 'firebase/firestore';
import { db } from './firebase';
import {
  Ride,
  RideStatus,
  ScheduleStatus,
  AssignmentType,
  RecurringFrequency,
  RecurringSchedule,
  RecurringScheduleStatus,
  ScheduledRidesConfig,
  DispatchLogEntry,
  VehicleType,
  PaymentMethod,
  Coordinates,
  BookingType,
  BookedByInfo,
  ActualPassengerInfo,
  Driver,
  OfferDetails
} from '../types';

import {
  DEFAULT_SCHEDULED_RIDES_CONFIG,
  formatInServiceTimezone,
  parseServiceLocalToUtcMs,
  validateScheduledBookingInput,
  calculateHaversineDistanceKm,
  estimateRideDurationMinutes,
  checkDriverScheduleConflict,
  computeRecurringWindowOccurrences,
  getScheduledStatusLabel,
  computeNextDispatchRadiusKm,
  evaluateCancellationEligibility,
  type ScheduledBookingValidationInput,
  type ValidationResult
} from './scheduledRidesLogic';

export {
  DEFAULT_SCHEDULED_RIDES_CONFIG,
  formatInServiceTimezone,
  parseServiceLocalToUtcMs,
  validateScheduledBookingInput,
  calculateHaversineDistanceKm,
  estimateRideDurationMinutes,
  checkDriverScheduleConflict,
  computeRecurringWindowOccurrences,
  getScheduledStatusLabel,
  computeNextDispatchRadiusKm,
  evaluateCancellationEligibility,
  type ScheduledBookingValidationInput,
  type ValidationResult
};

// ============================================================================
// 4. FIRESTORE CONFIG & DISPATCH LOGGING
// ============================================================================

export async function getScheduledRidesConfig(): Promise<ScheduledRidesConfig> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'global'));
    if (snap.exists()) {
      const data = snap.data();
      if (data?.scheduledRidesConfig) {
        return { ...DEFAULT_SCHEDULED_RIDES_CONFIG, ...data.scheduledRidesConfig };
      }
    }
  } catch (e) {
    console.warn('Failed to fetch scheduledRidesConfig, using defaults:', e);
  }
  return DEFAULT_SCHEDULED_RIDES_CONFIG;
}

export async function updateScheduledRidesConfig(
  partialConfig: Partial<ScheduledRidesConfig>,
  adminId?: string
): Promise<ScheduledRidesConfig> {
  const current = await getScheduledRidesConfig();
  const merged: ScheduledRidesConfig = { ...current, ...partialConfig };
  await setDoc(
    doc(db, 'settings', 'global'),
    {
      scheduledRidesConfig: merged,
      updatedAt: Date.now()
    },
    { merge: true }
  );

  if (adminId) {
    await logDispatchEvent({
      rideId: 'GLOBAL_CONFIG',
      eventType: 'ADMIN_OVERRIDE',
      actorId: adminId,
      actorRole: 'ADMIN',
      message: 'Admin updated Scheduled Rides operational configuration',
      metadata: partialConfig
    });
  }
  return merged;
}

export async function logDispatchEvent(
  entry: Omit<DispatchLogEntry, 'id' | 'timestamp'>
): Promise<void> {
  try {
    const logRef = doc(collection(db, 'dispatchLogs'));
    await setDoc(logRef, {
      ...entry,
      id: logRef.id,
      timestamp: Date.now()
    });
  } catch (e) {
    console.warn('Failed to write dispatchLog:', e);
  }
}

export async function sendScheduledRideNotification(
  userId: string,
  title: string,
  message: string,
  type: string = 'SCHEDULED_RIDE',
  extraData: Record<string, any> = {}
): Promise<void> {
  if (!userId) return;
  try {
    const notifRef = doc(collection(db, 'users', userId, 'notifications'));
    await setDoc(notifRef, {
      id: notifRef.id,
      userId,
      title,
      message,
      type,
      isRead: false,
      read: false,
      createdAt: serverTimestamp(),
      timestamp: Date.now(),
      ...extraData
    });
  } catch (e) {
    console.warn('Failed to send scheduled notification to user:', userId, e);
  }
}

// ============================================================================
// 5. CREATE SCHEDULED RIDE & RECURRING SCHEDULE
// ============================================================================

export interface CreateScheduledRideInput {
  passengerId: string;
  passengerName: string;
  passengerPhone?: string;
  pickup: { address: string; coords: Coordinates };
  dropoff: { address: string; coords: Coordinates };
  scheduledPickupAt: number;
  category: VehicleType;
  paymentMethod: PaymentMethod;
  fare: number;
  distanceValue: number;
  distanceText: string;
  durationText: string;
  passengerCount?: number;
  driverNote?: string;
  bookingType?: BookingType;
  bookedBy?: BookedByInfo;
  actualPassenger?: ActualPassengerInfo | null;
  preferredDriverIds?: string[];
  isLargeGroup?: boolean;
  promoApplied?: boolean;
  promoAmount?: number;
  pointsRedeemed?: number;
  recurringScheduleId?: string | null;
  occurrenceKey?: string | null;
  frequency?: RecurringFrequency;
  weekdays?: number[];
  startDate?: string;
  endDate?: string | null;
  pickupTimeStr?: string;
}

export async function createScheduledRideBooking(
  input: CreateScheduledRideInput
): Promise<{ rideId: string; recurringScheduleId?: string; createdCount: number }> {
  const config = await getScheduledRidesConfig();

  // 1. Validate booking input
  const validation = validateScheduledBookingInput({
    scheduledPickupAt: input.scheduledPickupAt,
    pickup: input.pickup,
    dropoff: input.dropoff,
    category: input.category,
    fare: input.fare,
    passengerCount: input.passengerCount,
    bookingType: input.bookingType,
    actualPassenger: input.actualPassenger,
    config
  });

  if (!validation.valid) {
    throw new Error(validation.errorMessageAr || validation.errorMessageEn || 'Invalid scheduled ride');
  }

  // 2. Check for duplicate submission (same passenger, same pickup time within 2 minutes, still active)
  const existingSnap = await getDocs(
    query(collection(db, 'rides'), where('passengerId', '==', input.passengerId))
  );
  for (const d of existingSnap.docs) {
    const r = d.data() as Ride;
    if (
      r.isScheduled &&
      r.status !== RideStatus.CANCELLED &&
      r.status !== RideStatus.COMPLETED &&
      r.status !== RideStatus.EXPIRED &&
      r.scheduleStatus !== 'CANCELLED' &&
      r.scheduleStatus !== 'NO_DRIVER_FOUND'
    ) {
      const existingPickup = r.scheduledPickupAt || r.scheduledTime || 0;
      if (Math.abs(existingPickup - input.scheduledPickupAt) < 2 * 60 * 1000) {
        if (input.occurrenceKey && r.occurrenceKey === input.occurrenceKey) {
          return { rideId: d.id, recurringScheduleId: r.recurringScheduleId || undefined, createdCount: 0 };
        }
        throw new Error('لديك بالفعل رحلة مجدولة في نفس التوقيت تماماً.');
      }
    }
  }

  // 3. If recurring frequency is DAILY, SELECTED_WEEKDAYS, or WEEKLY, create master RecurringSchedule first
  let masterScheduleId = input.recurringScheduleId || null;
  let generatedIds: string[] = [];

  if (
    input.frequency &&
    input.frequency !== 'ONE_TIME' &&
    config.recurringRidesEnabled &&
    !masterScheduleId
  ) {
    const tzInfo = formatInServiceTimezone(input.scheduledPickupAt, config.serviceTimezone);
    const startDate = input.startDate || tzInfo.dateStr;
    const pickupTime = input.pickupTimeStr || tzInfo.timeStr;
    const weekdays =
      input.weekdays && input.weekdays.length > 0 ? input.weekdays : [tzInfo.weekday];

    const schedRef = doc(collection(db, 'recurringSchedules'));
    masterScheduleId = schedRef.id;

    const recurringRecord: RecurringSchedule = {
      id: masterScheduleId,
      passengerId: input.passengerId,
      passengerName: input.passengerName,
      passengerPhone: input.passengerPhone || '',
      frequency: input.frequency,
      weekdays,
      startDate,
      endDate: input.endDate || null,
      pickupTime,
      timezone: config.serviceTimezone,
      pickup: input.pickup,
      dropoff: input.dropoff,
      category: input.category,
      paymentMethod: input.paymentMethod,
      fareEstimate: input.fare,
      distanceValue: input.distanceValue,
      distanceText: input.distanceText,
      durationText: input.durationText,
      passengerCount: input.passengerCount || 1,
      bookingType: input.bookingType || 'SELF',
      bookedBy: input.bookedBy,
      actualPassenger: input.actualPassenger || null,
      driverNote: input.driverNote || null,
      preferredDriverIds: input.preferredDriverIds || [],
      status: 'ACTIVE',
      nextGenerationAt: Date.now() + 12 * 60 * 60 * 1000,
      lastGeneratedWindowEnd: formatInServiceTimezone(
        Date.now() + config.maxAdvanceBookingDays * 24 * 60 * 60 * 1000,
        config.serviceTimezone
      ).dateStr,
      generatedOccurrencesCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      cancelledAt: null,
      pausedAt: null
    };

    await setDoc(schedRef, recurringRecord);

    // Generate all occurrences within the 7-day rolling window
    const occurrences = computeRecurringWindowOccurrences(
      recurringRecord,
      Date.now(),
      config.maxAdvanceBookingDays
    );

    // Ensure the primary requested timestamp is included if not already matched
    const primaryTz = formatInServiceTimezone(input.scheduledPickupAt, config.serviceTimezone);
    const primaryKey = `${masterScheduleId}_${primaryTz.dateStr}`;
    if (!occurrences.some((o) => o.occurrenceKey === primaryKey)) {
      occurrences.unshift({
        occurrenceKey: primaryKey,
        dateStr: primaryTz.dateStr,
        scheduledPickupAt: input.scheduledPickupAt
      });
    }

    for (const occ of occurrences) {
      const occId = await createSingleScheduledRideDoc({
        ...input,
        scheduledPickupAt: occ.scheduledPickupAt,
        recurringScheduleId: masterScheduleId,
        occurrenceKey: occ.occurrenceKey
      });
      generatedIds.push(occId);
    }

    await updateDoc(schedRef, {
      generatedOccurrencesCount: generatedIds.length,
      updatedAt: Date.now()
    });

    await logDispatchEvent({
      rideId: generatedIds[0] || masterScheduleId,
      recurringScheduleId: masterScheduleId,
      eventType: 'RECURRING_GENERATED',
      actorId: input.passengerId,
      actorRole: 'PASSENGER',
      message: `Created recurring schedule (${input.frequency}) with ${generatedIds.length} occurrences in 7-day window.`
    });

    return {
      rideId: generatedIds[0],
      recurringScheduleId: masterScheduleId,
      createdCount: generatedIds.length
    };
  }

  // 4. Single One-Time Scheduled Ride
  const singleRideId = await createSingleScheduledRideDoc(input);
  return { rideId: singleRideId, createdCount: 1 };
}

async function createSingleScheduledRideDoc(input: CreateScheduledRideInput): Promise<string> {
  const config = await getScheduledRidesConfig();
  const rideRef = doc(collection(db, 'rides'));
  const trackingToken =
    Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

  const now = Date.now();
  const msUntilPickup = input.scheduledPickupAt - now;
  const shouldStartDispatchImmediately =
    config.autoDispatchEnabled &&
    msUntilPickup <= config.autoDispatchLeadTimeMinutes * 60 * 1000;

  const initialStatus = shouldStartDispatchImmediately
    ? RideStatus.SEARCHING
    : RideStatus.SCHEDULED;
  const initialScheduleStatus: ScheduleStatus = shouldStartDispatchImmediately
    ? 'SEARCHING_DRIVER'
    : 'SCHEDULED';

  const rideDoc: Partial<Ride> = {
    id: rideRef.id,
    passengerId: input.passengerId,
    passengerName: input.passengerName,
    driverId: null,
    pickup: input.pickup,
    dropoff: input.dropoff,
    status: initialStatus,
    isScheduled: true,
    scheduledTime: input.scheduledPickupAt,
    scheduledPickupAt: input.scheduledPickupAt,
    scheduleStatus: initialScheduleStatus,
    dispatchStartedAt: shouldStartDispatchImmediately ? now : null,
    driverAssignedAt: null,
    assignmentType: shouldStartDispatchImmediately ? 'AUTOMATIC_DISPATCH' : null,
    recurringScheduleId: input.recurringScheduleId || null,
    occurrenceKey: input.occurrenceKey || null,
    bookingTimezone: config.serviceTimezone,
    passengerCount: input.passengerCount || 1,
    driverNote: input.driverNote || null,
    fare: input.fare,
    estimatedFare: input.fare,
    lockedFare: null,
    fareLocked: false,
    distanceValue: input.distanceValue,
    distanceText: input.distanceText,
    durationText: input.durationText,
    paymentMethod: input.paymentMethod,
    requestedVehicleType: input.category,
    bookingType: input.bookingType || 'SELF',
    bookedBy: input.bookedBy || {
      userId: input.passengerId,
      name: input.passengerName,
      phone: input.passengerPhone || ''
    },
    actualPassenger: input.bookingType === 'FOR_OTHER' ? input.actualPassenger || null : null,
    preferredDriverIds: input.preferredDriverIds || [],
    isLargeGroup: input.isLargeGroup || false,
    promoApplied: input.promoApplied || false,
    promoAmount: input.promoAmount || 0,
    pointsRedeemed: input.pointsRedeemed || 0,
    searchRadiusKm: config.initialSearchRadiusKm,
    notifiedDriverIds: [],
    previousDriverIds: [],
    passengerReminderSentAt: null,
    driverReminderSentAt: null,
    trackingToken,
    trackingTokenExpiresAt: input.scheduledPickupAt + 24 * 60 * 60 * 1000,
    timestamp: now,
    createdAt: serverTimestamp()
  };

  await setDoc(rideRef, rideDoc);

  await logDispatchEvent({
    rideId: rideRef.id,
    recurringScheduleId: input.recurringScheduleId || null,
    eventType: 'SCHEDULED_CREATED',
    actorId: input.passengerId,
    actorRole: 'PASSENGER',
    message: `Scheduled ride created for ${formatInServiceTimezone(input.scheduledPickupAt).formattedEn}`
  });

  // Notify passenger of confirmation
  const tzFormatted = formatInServiceTimezone(input.scheduledPickupAt, config.serviceTimezone);
  await sendScheduledRideNotification(
    input.passengerId,
    'تم تأكيد جدولة رحلتك 📅',
    `تم جدولة رحلتك ليوم ${tzFormatted.formattedAr} من ${input.pickup.address} إلى ${input.dropoff.address}.`,
    'SCHEDULED_CONFIRMED',
    { rideId: rideRef.id }
  );

  // Stage A: Notify eligible drivers about the future scheduled ride
  if (config.earlyAcceptanceEnabled) {
    notifyEligibleDriversForEarlyAcceptance(rideRef.id, rideDoc as Ride).catch((err) =>
      console.warn('Early driver notification warning:', err)
    );
  }

  return rideRef.id;
}

/**
 * Stage A: Identifies eligible approved drivers and sends them an in-app notification
 * about the newly created scheduled ride so they can review and accept it early.
 */
export async function notifyEligibleDriversForEarlyAcceptance(
  rideId: string,
  ride: Ride
): Promise<number> {
  try {
    const driversSnap = await getDocs(
      query(
        collection(db, 'users'),
        where('role', '==', 'DRIVER'),
        where('status', '==', 'approved'),
        limit(40)
      )
    );

    const tzFormatted = formatInServiceTimezone(
      ride.scheduledPickupAt || ride.scheduledTime || Date.now()
    );
    const notifiedIds: string[] = [];

    for (const dDoc of driversSnap.docs) {
      const driver = dDoc.data() as Driver;
      if (driver.isBanned || driver.isBlockedByFees) continue;
      if (driver.id === ride.passengerId) continue;

      // Check vehicle category compatibility
      const dType = (driver.vehicleType || 'STANDARD').toUpperCase();
      if (ride.requestedVehicleType === VehicleType.MOTO && dType !== 'MOTO') continue;
      if (ride.requestedVehicleType !== VehicleType.MOTO && dType === 'MOTO') continue;
      if (ride.requestedVehicleType === VehicleType.COMFORT && dType !== 'COMFORT') continue;

      // If driver has currentLocation, prioritize drivers within 25km of pickup
      if (driver.currentLocation && ride.pickup?.coords) {
        const dist = calculateHaversineDistanceKm(driver.currentLocation, ride.pickup.coords);
        if (dist > 25) continue;
      }

      notifiedIds.push(dDoc.id);
      await sendScheduledRideNotification(
        dDoc.id,
        'رحلة مجدولة جديدة متاحة 📅',
        `رحلة مجدولة يوم ${tzFormatted.formattedAr} (${ride.fare} ج.م) من ${ride.pickup.address} إلى ${ride.dropoff.address}. يمكنك قبولها مسبقاً الآن!`,
        'NEW_SCHEDULED_RIDE',
        { rideId }
      );
    }

    if (notifiedIds.length > 0) {
      await updateDoc(doc(db, 'rides', rideId), {
        notifiedDriverIds: arrayUnion(...notifiedIds)
      });
      await logDispatchEvent({
        rideId,
        eventType: 'EARLY_DRIVER_NOTIFIED',
        actorRole: 'SYSTEM',
        notifiedCount: notifiedIds.length,
        message: `Notified ${notifiedIds.length} eligible drivers for Stage A Early Acceptance.`
      });
    }

    return notifiedIds.length;
  } catch (e) {
    console.warn('Error in notifyEligibleDriversForEarlyAcceptance:', e);
    return 0;
  }
}

// ============================================================================
// 6. STAGE A: ATOMIC EARLY DRIVER ACCEPTANCE & OFFER SUBMISSION
// ============================================================================

export async function acceptScheduledRideAtomic(
  rideId: string,
  driverId: string
): Promise<{ success: boolean; ride?: Ride }> {
  const config = await getScheduledRidesConfig();

  // 1. Validate driver eligibility and fetch driver's existing scheduled rides outside transaction for conflict check
  const driverSnap = await getDoc(doc(db, 'users', driverId));
  if (!driverSnap.exists()) {
    throw new Error('حساب السائق غير موجود.');
  }
  const driverData = driverSnap.data() as Driver;
  if (driverData.isBanned) {
    throw new Error('حسابك محظور ولا يمكنك قبول رحلات.');
  }
  if (driverData.isBlockedByFees || driverData.financialStatus === 'blocked') {
    throw new Error('حسابك موقوف مؤقتاً بسبب المستحقات المالية.');
  }
  if (driverData.status !== 'approved' && !driverData.isApproved) {
    throw new Error('يجب أن يكون حساب السائق معتمداً لقبول الرحلات المجدولة.');
  }

  // Fetch driver's existing assigned rides to check for schedule conflict
  const driverRidesSnap = await getDocs(
    query(collection(db, 'rides'), where('driverId', '==', driverId))
  );
  const existingDriverRides = driverRidesSnap.docs.map((d) => ({
    ...(d.data() as Ride),
    id: d.id
  }));

  let assignedRideData: Ride | undefined;

  // 2. Run atomic Firestore transaction to prevent two drivers from accepting the same scheduled ride
  await runTransaction(db, async (tx) => {
    const rideRef = doc(db, 'rides', rideId);
    const rideDoc = await tx.get(rideRef);
    if (!rideDoc.exists()) {
      throw new Error('الرحلة المجدولة غير موجودة.');
    }

    const ride = { ...(rideDoc.data() as Ride), id: rideDoc.id };

    if (ride.passengerId === driverId) {
      throw new Error('لا يمكنك قبول رحلتك الخاصة.');
    }

    if (
      ride.status === RideStatus.CANCELLED ||
      ride.status === RideStatus.COMPLETED ||
      ride.status === RideStatus.EXPIRED ||
      ride.scheduleStatus === 'CANCELLED' ||
      ride.scheduleStatus === 'NO_DRIVER_FOUND'
    ) {
      throw new Error('هذه الرحلة المجدولة لم تعد متاحة.');
    }

    // Prevent race condition: if another driver already accepted, reject immediately
    if (ride.driverId && ride.driverId !== '' && ride.driverId !== driverId) {
      throw new Error('عذراً، قام سائق آخر بقبول هذه الرحلة المجدولة للتو.');
    }

    if (ride.driverId === driverId && ride.scheduleStatus === 'DRIVER_ASSIGNED') {
      assignedRideData = ride;
      return;
    }

    // Check category eligibility
    const dType = (driverData.vehicleType || 'STANDARD').toUpperCase();
    if (ride.requestedVehicleType === VehicleType.MOTO && dType !== 'MOTO') {
      throw new Error('هذه الرحلة مخصصة للدراجات النارية (MOTO) فقط.');
    }
    if (ride.requestedVehicleType !== VehicleType.MOTO && dType === 'MOTO') {
      throw new Error('هذه الرحلة تتطلب سيارة وليست دراجة نارية.');
    }

    // Check overlapping scheduled rides conflict
    const conflict = checkDriverScheduleConflict(
      ride,
      existingDriverRides,
      config.driverConflictBufferMinutes
    );
    if (conflict.hasConflict) {
      throw new Error(conflict.messageAr || 'لديك رحلة مجدولة أخرى متداخلة مع هذا الموعد.');
    }

    const now = Date.now();
    const isAutoDispatchStage = ride.scheduleStatus === 'SEARCHING_DRIVER';
    const assignmentType: AssignmentType = isAutoDispatchStage
      ? 'AUTOMATIC_DISPATCH'
      : 'EARLY_ACCEPTANCE';

    const updates: Partial<Ride> = {
      driverId,
      driverName: driverData.name || 'سائق مواصلة',
      driverPhone: driverData.phone || '',
      driverAvatar: driverData.personalPhotoUrl || driverData.avatar || '',
      driverRating: driverData.rating || 5.0,
      driverVehicleModel: `${driverData.vehicleBrand || ''} ${driverData.vehicleModel || ''}`.trim(),
      driverVehiclePlate: driverData.vehiclePlate || '',
      driverVehicleColor: driverData.vehicleColor || '',
      scheduleStatus: 'DRIVER_ASSIGNED',
      status: isAutoDispatchStage ? RideStatus.ACCEPTED : RideStatus.SCHEDULED,
      driverAssignedAt: now,
      acceptedAt: now,
      assignmentType,
      fareLocked: config.lockFareOnEarlyAcceptance,
      lockedFare: config.lockFareOnEarlyAcceptance ? ride.fare : null,
      lastActiveAt: now
    };

    tx.update(rideRef, updates);
    assignedRideData = { ...ride, ...updates };
  });

  if (assignedRideData) {
    const tzFormatted = formatInServiceTimezone(
      assignedRideData.scheduledPickupAt || assignedRideData.scheduledTime || Date.now()
    );

    await sendScheduledRideNotification(
      assignedRideData.passengerId,
      'تم تعيين سائق لرحلتك المجدولة! 🚖',
      `قبل السائق ${driverData.name} رحلتك المجدولة ليوم ${tzFormatted.formattedAr}. المركبة: ${driverData.vehicleBrand || ''} ${driverData.vehicleModel || ''} (${driverData.vehiclePlate || ''}).`,
      'SCHEDULED_DRIVER_ASSIGNED',
      { rideId, driverId }
    );

    await logDispatchEvent({
      rideId,
      recurringScheduleId: assignedRideData.recurringScheduleId || null,
      eventType: 'EARLY_ACCEPTED',
      actorId: driverId,
      actorRole: 'DRIVER',
      newDriverId: driverId,
      message: `Driver ${driverData.name} (${driverId}) accepted scheduled ride via ${assignedRideData.assignmentType}.`
    });
  }

  return { success: true, ride: assignedRideData };
}

/**
 * Allows a driver to submit a custom price offer on a scheduled ride.
 */
export async function submitScheduledRideOffer(
  rideId: string,
  driver: Driver,
  offerPrice: number
): Promise<void> {
  if (!offerPrice || offerPrice <= 0) {
    throw new Error('يرجى إدخال سعر عرض صحيح.');
  }
  const rideSnap = await getDoc(doc(db, 'rides', rideId));
  if (!rideSnap.exists()) throw new Error('الرحلة غير موجودة.');
  const ride = rideSnap.data() as Ride;
  if (ride.driverId) throw new Error('تم تعيين سائق لهذه الرحلة بالفعل.');

  const offerData: OfferDetails = {
    id: `${driver.id}_${Date.now()}`,
    driverId: driver.id,
    driverName: driver.name,
    driverAvatar: driver.personalPhotoUrl || driver.avatar || '',
    driverRating: driver.rating || 5.0,
    driverLevel: driver.level,
    price: offerPrice,
    vehicleModel: `${driver.vehicleBrand || ''} ${driver.vehicleModel || ''}`.trim(),
    vehiclePlate: driver.vehiclePlate || '',
    isVerified: driver.isVerified || true,
    status: 'pending',
    createdAt: Date.now()
  };

  await setDoc(doc(db, 'rides', rideId, 'offers', driver.id), offerData);
  await updateDoc(doc(db, 'rides', rideId), {
    currentOffer: offerData,
    offeringDriverIds: arrayUnion(driver.id),
    lastActiveAt: Date.now()
  });

  await sendScheduledRideNotification(
    ride.passengerId,
    'عرض سعر جديد لرحلتك المجدولة 💬',
    `قدم الكابتن ${driver.name} عرضاً بقيمة ${offerPrice} ج.م لرحلتك المجدولة.`,
    'SCHEDULED_OFFER',
    { rideId, driverId: driver.id, offerPrice }
  );

  await logDispatchEvent({
    rideId,
    eventType: 'DRIVER_OFFER_SUBMITTED',
    actorId: driver.id,
    actorRole: 'DRIVER',
    message: `Driver ${driver.name} submitted offer of ${offerPrice} EGP for scheduled ride.`
  });
}

// ============================================================================
// 7. DRIVER RELEASE / REASSIGNMENT & TRIP PROGRESSION FOR SCHEDULED RIDES
// ============================================================================

/**
 * Releases an assigned driver from a scheduled ride (due to driver cancellation,
 * driver going offline/unavailable, or admin action) and automatically triggers reassignment.
 */
export async function releaseAndReassignScheduledRide(
  rideId: string,
  reason: string,
  actorRole: 'DRIVER' | 'ADMIN' | 'SYSTEM' = 'DRIVER',
  actorId?: string
): Promise<void> {
  const config = await getScheduledRidesConfig();
  let releasedDriverId: string | null = null;
  let passengerId: string = '';
  let enteredAutoDispatch = false;

  await runTransaction(db, async (tx) => {
    const rideRef = doc(db, 'rides', rideId);
    const snap = await tx.get(rideRef);
    if (!snap.exists()) throw new Error('الرحلة غير موجودة.');
    const ride = snap.data() as Ride;

    releasedDriverId = ride.driverId || null;
    passengerId = ride.passengerId;

    const now = Date.now();
    const pickupAt = ride.scheduledPickupAt || ride.scheduledTime || now;
    const msUntilPickup = pickupAt - now;
    const shouldImmediateAutoDispatch =
      config.autoDispatchEnabled &&
      msUntilPickup <= config.autoDispatchLeadTimeMinutes * 60 * 1000;

    enteredAutoDispatch = shouldImmediateAutoDispatch;

    const prevDrivers = Array.isArray(ride.previousDriverIds) ? [...ride.previousDriverIds] : [];
    if (releasedDriverId && !prevDrivers.includes(releasedDriverId)) {
      prevDrivers.push(releasedDriverId);
    }

    tx.update(rideRef, {
      driverId: null,
      driverName: null,
      driverPhone: null,
      driverAvatar: null,
      driverVehicleModel: null,
      driverVehiclePlate: null,
      scheduleStatus: shouldImmediateAutoDispatch ? 'SEARCHING_DRIVER' : 'SCHEDULED',
      status: shouldImmediateAutoDispatch ? RideStatus.SEARCHING : RideStatus.SCHEDULED,
      assignmentType: shouldImmediateAutoDispatch ? 'AUTOMATIC_DISPATCH' : null,
      dispatchStartedAt: shouldImmediateAutoDispatch ? now : ride.dispatchStartedAt || null,
      lastReassignedAt: now,
      reassignmentReason: reason,
      previousDriverIds: prevDrivers,
      fareLocked: false,
      lockedFare: null
    });
  });

  if (passengerId) {
    await sendScheduledRideNotification(
      passengerId,
      'تحديث بخصوص سائق رحلتك المجدولة 🔄',
      enteredAutoDispatch
        ? 'اعتذر السائق المعين عن الرحلة، وجارٍ الآن البحث التلقائي الفوري عن سائق بديل قريب منك.'
        : 'اعتذر السائق المعين عن الرحلة، وتم إعادة فتح الرحلة للسائقين المؤهلين لتعيين سائق بديل.',
      'SCHEDULED_REASSIGNING',
      { rideId, previousDriverId: releasedDriverId }
    );
  }

  await logDispatchEvent({
    rideId,
    eventType: 'DRIVER_REASSIGNED',
    actorId: actorId || releasedDriverId,
    actorRole,
    previousDriverId: releasedDriverId,
    message: `Driver assignment released (${reason}). Reassignment triggered (autoDispatch=${enteredAutoDispatch}).`
  });
}

/**
 * Transitions a scheduled ride through active pickup states:
 * DRIVER_ASSIGNED -> DRIVER_EN_ROUTE -> DRIVER_ARRIVED -> IN_PROGRESS -> COMPLETED
 */
export async function updateScheduledRideTripStage(
  rideId: string,
  driverId: string,
  nextStage: 'DRIVER_EN_ROUTE' | 'DRIVER_ARRIVED' | 'IN_PROGRESS' | 'COMPLETED'
): Promise<void> {
  const rideRef = doc(db, 'rides', rideId);
  const snap = await getDoc(rideRef);
  if (!snap.exists()) throw new Error('الرحلة غير موجودة.');
  const ride = snap.data() as Ride;

  if (ride.driverId !== driverId) {
    throw new Error('أنت غير معين لهذه الرحلة.');
  }

  const now = Date.now();
  const updates: Record<string, any> = {
    scheduleStatus: nextStage,
    lastActiveAt: now
  };

  if (nextStage === 'DRIVER_EN_ROUTE') {
    updates.status = RideStatus.ACCEPTED;
    await sendScheduledRideNotification(
      ride.passengerId,
      'السائق في الطريق إليك الآن 🚗',
      `الكابتن ${ride.driverName || ''} تحرك نحو نقطة الانطلاق لرحلتك المجدولة.`,
      'SCHEDULED_DRIVER_EN_ROUTE',
      { rideId }
    );
  } else if (nextStage === 'DRIVER_ARRIVED') {
    updates.status = RideStatus.ARRIVED;
    updates.arrivedAt = now;
    await sendScheduledRideNotification(
      ride.passengerId,
      'وصل السائق لنقطة الانطلاق 📍',
      `وصل الكابتن ${ride.driverName || ''} إلى موقع الانطلاق بانتظارك.`,
      'SCHEDULED_DRIVER_ARRIVED',
      { rideId }
    );
  } else if (nextStage === 'IN_PROGRESS') {
    updates.status = RideStatus.IN_PROGRESS;
    updates.startedAt = now;
  } else if (nextStage === 'COMPLETED') {
    updates.status = RideStatus.COMPLETED;
    updates.completedAt = now;
  }

  await updateDoc(rideRef, updates);
}

// ============================================================================
// 8. PASSENGER CANCELLATION & RECURRING SCHEDULE MANAGEMENT
// ============================================================================

export async function cancelScheduledRideByPassenger(
  rideId: string,
  passengerId: string,
  reason: string = 'تم الإلغاء بواسطة الراكب'
): Promise<{ cancellationFeeApplied: number }> {
  const config = await getScheduledRidesConfig();
  const rideRef = doc(db, 'rides', rideId);
  const snap = await getDoc(rideRef);
  if (!snap.exists()) throw new Error('الرحلة غير موجودة.');
  const ride = snap.data() as Ride;

  if (ride.passengerId !== passengerId && ride.bookedBy?.userId !== passengerId) {
    throw new Error('غير مصرح لك بإلغاء هذه الرحلة.');
  }

  const now = Date.now();
  const pickupAt = ride.scheduledPickupAt || ride.scheduledTime || now;
  const minsUntilPickup = (pickupAt - now) / (60 * 1000);

  // Apply late cancellation fee only if a driver was already assigned and pickup is within freeCancellationWindowMinutes
  const hasDriver = Boolean(ride.driverId);
  const isLateCancel = hasDriver && minsUntilPickup < config.freeCancellationWindowMinutes;
  const fee = isLateCancel ? config.lateCancellationFee : 0;

  await updateDoc(rideRef, {
    status: RideStatus.CANCELLED,
    scheduleStatus: 'CANCELLED',
    cancelledBy: 'PASSENGER',
    cancelReason: reason,
    cancelledAt: now,
    cancellationFee: fee
  });

  // Refund upfront loyalty points if applicable
  if (ride.pointsDeductedUpfront && !ride.pointsRefunded && (ride.pointsRedeemed || 0) > 0) {
    try {
      await updateDoc(doc(db, 'users', ride.passengerId), {
        rewardPoints: increment(ride.pointsRedeemed || 0)
      });
      await updateDoc(rideRef, { pointsRefunded: true });
    } catch (e) {
      console.warn('Failed to refund points on scheduled ride cancellation:', e);
    }
  }

  if (ride.driverId) {
    await sendScheduledRideNotification(
      ride.driverId,
      'تم إلغاء رحلة مجدولة ❌',
      `قام الراكب بإلغاء الرحلة المجدولة من ${ride.pickup.address} إلى ${ride.dropoff.address}.`,
      'SCHEDULED_CANCELLED_BY_PASSENGER',
      { rideId }
    );
  }

  await logDispatchEvent({
    rideId,
    recurringScheduleId: ride.recurringScheduleId || null,
    eventType: 'CANCELLED',
    actorId: passengerId,
    actorRole: 'PASSENGER',
    message: `Passenger cancelled scheduled ride (${reason}). Late fee: ${fee} EGP.`
  });

  return { cancellationFeeApplied: fee };
}

export async function updateRecurringScheduleStatus(
  scheduleId: string,
  passengerId: string,
  newStatus: RecurringScheduleStatus,
  cancelFutureOccurrences: boolean = false,
  isAdminOverride: boolean = false
): Promise<void> {
  const schedRef = doc(db, 'recurringSchedules', scheduleId);
  const snap = await getDoc(schedRef);
  if (!snap.exists()) throw new Error('الجدول المتكرر غير موجود.');
  const sched = snap.data() as RecurringSchedule;

  if (!isAdminOverride && sched.passengerId !== passengerId) {
    throw new Error('غير مصرح لك بتعديل هذا الجدول المتكرر.');
  }

  const now = Date.now();
  const updates: Partial<RecurringSchedule> = {
    status: newStatus,
    updatedAt: now
  };
  if (newStatus === 'PAUSED') updates.pausedAt = now;
  if (newStatus === 'CANCELLED') updates.cancelledAt = now;

  await updateDoc(schedRef, updates);

  if (cancelFutureOccurrences || newStatus === 'CANCELLED') {
    const occSnap = await getDocs(
      query(collection(db, 'rides'), where('recurringScheduleId', '==', scheduleId))
    );
    const batch = writeBatch(db);
    let count = 0;
    for (const d of occSnap.docs) {
      const r = d.data() as Ride;
      const pickupAt = r.scheduledPickupAt || r.scheduledTime || 0;
      if (
        pickupAt > now &&
        r.status !== RideStatus.COMPLETED &&
        r.status !== RideStatus.CANCELLED &&
        r.status !== RideStatus.IN_PROGRESS
      ) {
        batch.update(d.ref, {
          status: RideStatus.CANCELLED,
          scheduleStatus: 'CANCELLED',
          cancelledBy: isAdminOverride ? 'ADMIN' : 'PASSENGER',
          cancelReason: 'تم إلغاء سلسلة الرحلات المتكررة'
        });
        count++;
      }
    }
    if (count > 0) {
      await batch.commit();
    }
  }
}

export async function updateRecurringScheduleDetails(
  scheduleId: string,
  passengerId: string,
  updates: Partial<Pick<RecurringSchedule, 'pickupTime' | 'weekdays' | 'endDate' | 'driverNote' | 'fareEstimate'>>
): Promise<void> {
  const schedRef = doc(db, 'recurringSchedules', scheduleId);
  const snap = await getDoc(schedRef);
  if (!snap.exists()) throw new Error('الجدول المتكرر غير موجود.');
  const sched = snap.data() as RecurringSchedule;
  if (sched.passengerId !== passengerId) {
    throw new Error('غير مصرح لك بتعديل هذا الجدول.');
  }

  await updateDoc(schedRef, {
    ...updates,
    updatedAt: Date.now()
  });
}

// ============================================================================
// 9. STAGE B: AUTOMATED DISPATCH, REMINDERS & ROLLING RECURRING GENERATOR
// ============================================================================

/**
 * Executes a complete scheduled rides lifecycle tick (can be triggered by Cloud Functions,
 * server.ts background worker, or Admin manual trigger):
 * 1. Sends 1-hour passenger reminders.
 * 2. Sends 30-minute driver reminders for early-assigned rides.
 * 3. Starts Stage B Automatic Dispatch 30 minutes before pickup if unassigned.
 * 4. Expands search radius gradually for searching scheduled rides.
 * 5. Handles no-driver-found expiration past maxDispatchDurationMinutes.
 * 6. Replenishes rolling 7-day recurring ride occurrences.
 */
export async function runScheduledRidesLifecycleTick(nowMs: number = Date.now()): Promise<{
  passengerRemindersSent: number;
  driverRemindersSent: number;
  autoDispatchesStarted: number;
  radiusExpansions: number;
  expiredCount: number;
  recurringGenerated: number;
}> {
  const config = await getScheduledRidesConfig();
  let passengerRemindersSent = 0;
  let driverRemindersSent = 0;
  let autoDispatchesStarted = 0;
  let radiusExpansions = 0;
  let expiredCount = 0;
  let recurringGenerated = 0;

  // Query active scheduled rides
  const ridesSnap = await getDocs(
    query(collection(db, 'rides'), where('isScheduled', '==', true))
  );

  for (const d of ridesSnap.docs) {
    const ride = { ...(d.data() as Ride), id: d.id };
    if (
      ride.status === RideStatus.COMPLETED ||
      ride.status === RideStatus.CANCELLED ||
      ride.status === RideStatus.EXPIRED ||
      ride.scheduleStatus === 'COMPLETED' ||
      ride.scheduleStatus === 'CANCELLED' ||
      ride.scheduleStatus === 'NO_DRIVER_FOUND'
    ) {
      continue;
    }

    const pickupAt = ride.scheduledPickupAt || ride.scheduledTime || 0;
    if (!pickupAt) continue;

    const msUntilPickup = pickupAt - nowMs;
    const passengerReminderLeadMs = config.passengerReminderLeadTimeMinutes * 60 * 1000;
    const driverReminderLeadMs = config.driverReminderLeadTimeMinutes * 60 * 1000;
    const autoDispatchLeadMs = config.autoDispatchLeadTimeMinutes * 60 * 1000;
    const maxDispatchGraceMs = config.maxDispatchDurationMinutes * 60 * 1000;

    // A. Check if ride has expired without a driver past pickup + maxDispatchDurationMinutes
    if (!ride.driverId && nowMs > pickupAt + maxDispatchGraceMs) {
      await updateDoc(d.ref, {
        status: RideStatus.EXPIRED,
        scheduleStatus: 'NO_DRIVER_FOUND',
        lastActiveAt: nowMs
      });

      await sendScheduledRideNotification(
        ride.passengerId,
        'تعذر العثور على سائق لرحلتك المجدولة ⚠️',
        `نعتذر، لم يتم العثور على سائق متاح لرحلتك المجدولة من ${ride.pickup.address}. يمكنك إعادة المحاولة أو طلب رحلة فورية الآن.`,
        'SCHEDULED_NO_DRIVER_FOUND',
        { rideId: ride.id }
      );

      await logDispatchEvent({
        rideId: ride.id,
        recurringScheduleId: ride.recurringScheduleId || null,
        eventType: 'NO_DRIVER_FOUND',
        actorRole: 'SYSTEM',
        message: 'Scheduled ride expired with NO_DRIVER_FOUND after max dispatch window.'
      });

      expiredCount++;
      continue;
    }

    // B. 1-Hour Passenger Reminder
    if (
      !ride.passengerReminderSentAt &&
      msUntilPickup <= passengerReminderLeadMs &&
      msUntilPickup > 0
    ) {
      const tzFormatted = formatInServiceTimezone(pickupAt, config.serviceTimezone);
      await updateDoc(d.ref, { passengerReminderSentAt: nowMs });
      await sendScheduledRideNotification(
        ride.passengerId,
        'تذكير برحلتك المجدولة بعد ساعة ⏰',
        ride.driverId
          ? `رحلتك المجدولة (${tzFormatted.timeStr}) مع الكابتن ${ride.driverName || ''} ستبدأ قريباً.`
          : `رحلتك المجدولة (${tzFormatted.timeStr}) من ${ride.pickup.address} ستبدأ قريباً.`,
        'SCHEDULED_PASSENGER_REMINDER',
        { rideId: ride.id }
      );
      await logDispatchEvent({
        rideId: ride.id,
        eventType: 'PASSENGER_REMINDER_SENT',
        actorRole: 'SYSTEM',
        message: 'Sent 1-hour advance reminder to passenger.'
      });
      passengerRemindersSent++;
    }

    // C. Driver Reminder & Availability Check (30 mins before pickup for Early-Accepted rides)
    if (
      ride.driverId &&
      ride.scheduleStatus === 'DRIVER_ASSIGNED' &&
      !ride.driverReminderSentAt &&
      msUntilPickup <= driverReminderLeadMs &&
      msUntilPickup > -15 * 60 * 1000
    ) {
      // Verify assigned driver is still approved and not banned
      const drvSnap = await getDoc(doc(db, 'users', ride.driverId));
      const drv = drvSnap.exists() ? (drvSnap.data() as Driver) : null;
      if (!drv || drv.isBanned || drv.isBlockedByFees || drv.status === 'deactivated') {
        if (config.driverReassignmentEnabled) {
          await releaseAndReassignScheduledRide(
            ride.id,
            'Driver became unavailable/restricted prior to pickup',
            'SYSTEM'
          );
          autoDispatchesStarted++;
          continue;
        }
      } else {
        await updateDoc(d.ref, { driverReminderSentAt: nowMs });
        await sendScheduledRideNotification(
          ride.driverId,
          'تذكير: حان موعد التحرك للرحلة المجدولة 🚖',
          `يرجى التوجه إلى نقطة الانطلاق (${ride.pickup.address}) للراكب ${ride.passengerName || ''}.`,
          'SCHEDULED_DRIVER_REMINDER',
          { rideId: ride.id }
        );
        await logDispatchEvent({
          rideId: ride.id,
          eventType: 'DRIVER_REMINDER_SENT',
          actorRole: 'SYSTEM',
          newDriverId: ride.driverId,
          message: 'Sent pickup reminder to assigned driver.'
        });
        driverRemindersSent++;
      }
    }

    // D. Stage B: Start Automatic Dispatch 30 minutes before pickup if no driver confirmed
    if (
      config.autoDispatchEnabled &&
      !ride.driverId &&
      ride.scheduleStatus === 'SCHEDULED' &&
      msUntilPickup <= autoDispatchLeadMs
    ) {
      await updateDoc(d.ref, {
        status: RideStatus.SEARCHING,
        scheduleStatus: 'SEARCHING_DRIVER',
        assignmentType: 'AUTOMATIC_DISPATCH',
        dispatchStartedAt: nowMs,
        searchRadiusKm: config.initialSearchRadiusKm,
        lastActiveAt: nowMs
      });

      await sendScheduledRideNotification(
        ride.passengerId,
        'بدأ البحث التلقائي عن سائق لرحلتك المجدولة 🔍',
        `نبحث الآن عن أقرب سائق متاح لرحلتك المجدولة من ${ride.pickup.address}.`,
        'SCHEDULED_AUTO_DISPATCH_STARTED',
        { rideId: ride.id }
      );

      await logDispatchEvent({
        rideId: ride.id,
        recurringScheduleId: ride.recurringScheduleId || null,
        eventType: 'AUTO_DISPATCH_STARTED',
        actorRole: 'SYSTEM',
        searchRadiusKm: config.initialSearchRadiusKm,
        message: `Stage B automatic dispatch started (${Math.round(msUntilPickup / 60000)}m before pickup).`
      });

      autoDispatchesStarted++;
      continue;
    }

    // E. Gradual Radius Expansion during Stage B Automatic Dispatch
    if (
      !ride.driverId &&
      ride.scheduleStatus === 'SEARCHING_DRIVER' &&
      ride.dispatchStartedAt
    ) {
      const currentRadius = ride.searchRadiusKm || config.initialSearchRadiusKm;
      if (currentRadius < config.maxSearchRadiusKm) {
        const nextRadius = Math.min(
          config.maxSearchRadiusKm,
          currentRadius + config.radiusExpansionStepKm
        );
        await updateDoc(d.ref, {
          searchRadiusKm: nextRadius,
          lastActiveAt: nowMs
        });
        await logDispatchEvent({
          rideId: ride.id,
          eventType: 'SEARCH_RADIUS_EXPANDED',
          actorRole: 'SYSTEM',
          searchRadiusKm: nextRadius,
          message: `Expanded driver search radius from ${currentRadius}km to ${nextRadius}km.`
        });
        radiusExpansions++;
      }
    }
  }

  // F. Rolling 7-day Recurring Schedule Instance Generator
  if (config.recurringRidesEnabled) {
    const recSnap = await getDocs(
      query(collection(db, 'recurringSchedules'), where('status', '==', 'ACTIVE'))
    );

    for (const rDoc of recSnap.docs) {
      const sched = { ...(rDoc.data() as RecurringSchedule), id: rDoc.id };
      const occurrences = computeRecurringWindowOccurrences(
        sched,
        nowMs,
        config.maxAdvanceBookingDays
      );

      for (const occ of occurrences) {
        // Check if occurrenceKey already exists
        const existingOcc = await getDocs(
          query(collection(db, 'rides'), where('occurrenceKey', '==', occ.occurrenceKey))
        );
        if (!existingOcc.empty) continue;

        await createSingleScheduledRideDoc({
          passengerId: sched.passengerId,
          passengerName: sched.passengerName,
          passengerPhone: sched.passengerPhone,
          pickup: sched.pickup,
          dropoff: sched.dropoff,
          scheduledPickupAt: occ.scheduledPickupAt,
          category: sched.category,
          paymentMethod: sched.paymentMethod,
          fare: sched.fareEstimate,
          distanceValue: sched.distanceValue,
          distanceText: sched.distanceText,
          durationText: sched.durationText,
          passengerCount: sched.passengerCount,
          driverNote: sched.driverNote || undefined,
          bookingType: sched.bookingType,
          bookedBy: sched.bookedBy,
          actualPassenger: sched.actualPassenger,
          preferredDriverIds: sched.preferredDriverIds,
          recurringScheduleId: sched.id,
          occurrenceKey: occ.occurrenceKey
        });
        recurringGenerated++;
      }
    }
  }

  return {
    passengerRemindersSent,
    driverRemindersSent,
    autoDispatchesStarted,
    radiusExpansions,
    expiredCount,
    recurringGenerated
  };
}

// ============================================================================
// 10. REAL-TIME SUBSCRIPTIONS FOR PASSENGER, DRIVER & ADMIN UI
// ============================================================================

export function subscribeToPassengerScheduledRides(
  passengerId: string,
  callback: (rides: Ride[]) => void
): () => void {
  if (!passengerId) {
    callback([]);
    return () => {};
  }
  const q = query(collection(db, 'rides'), where('passengerId', '==', passengerId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ ...(d.data() as Ride), id: d.id }))
        .filter((r) => Boolean(r.isScheduled || r.scheduledTime || r.scheduledPickupAt))
        .sort(
          (a, b) =>
            (a.scheduledPickupAt || a.scheduledTime || 0) -
            (b.scheduledPickupAt || b.scheduledTime || 0)
        );
      callback(list);
    },
    (err) => {
      console.warn('Error subscribing to passenger scheduled rides:', err);
      callback([]);
    }
  );
}

export function subscribeToPassengerRecurringSchedules(
  passengerId: string,
  callback: (schedules: RecurringSchedule[]) => void
): () => void {
  if (!passengerId) {
    callback([]);
    return () => {};
  }
  const q = query(collection(db, 'recurringSchedules'), where('passengerId', '==', passengerId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ ...(d.data() as RecurringSchedule), id: d.id }))
        .sort((a, b) => b.createdAt - a.createdAt);
      callback(list);
    },
    (err) => {
      console.warn('Error subscribing to passenger recurring schedules:', err);
      callback([]);
    }
  );
}

/**
 * Subscribes to both:
 * - Available unassigned scheduled rides for Stage A Early Acceptance / Stage B Search
 * - Scheduled rides already assigned to this driver
 */
export function subscribeToDriverScheduledRides(
  driverId: string,
  driverCategory: string | undefined,
  callback: (data: { availableRides: Ride[]; myAssignedRides: Ride[] }) => void
): () => void {
  const q = query(collection(db, 'rides'), where('isScheduled', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      const now = Date.now();
      const all = snap.docs.map((d) => ({ ...(d.data() as Ride), id: d.id }));
      const dType = (driverCategory || 'STANDARD').toUpperCase();

      const availableRides = all
        .filter((r) => {
          if (r.driverId && r.driverId !== '') return false;
          if (r.passengerId === driverId) return false;
          if (
            r.status === RideStatus.CANCELLED ||
            r.status === RideStatus.COMPLETED ||
            r.status === RideStatus.EXPIRED ||
            r.scheduleStatus === 'CANCELLED' ||
            r.scheduleStatus === 'NO_DRIVER_FOUND'
          ) {
            return false;
          }
          const pickupAt = r.scheduledPickupAt || r.scheduledTime || 0;
          if (pickupAt < now - 30 * 60 * 1000) return false;

          // Vehicle category filter
          if (r.requestedVehicleType === VehicleType.MOTO && dType !== 'MOTO') return false;
          if (r.requestedVehicleType !== VehicleType.MOTO && dType === 'MOTO') return false;

          return true;
        })
        .sort(
          (a, b) =>
            (a.scheduledPickupAt || a.scheduledTime || 0) -
            (b.scheduledPickupAt || b.scheduledTime || 0)
        );

      const myAssignedRides = all
        .filter((r) => r.driverId === driverId)
        .sort(
          (a, b) =>
            (a.scheduledPickupAt || a.scheduledTime || 0) -
            (b.scheduledPickupAt || b.scheduledTime || 0)
        );

      callback({ availableRides, myAssignedRides });
    },
    (err) => {
      console.warn('Error subscribing to driver scheduled rides:', err);
      callback({ availableRides: [], myAssignedRides: [] });
    }
  );
}

export function subscribeToAdminScheduledRidesData(
  callback: (data: {
    scheduledRides: Ride[];
    recurringSchedules: RecurringSchedule[];
    dispatchLogs: DispatchLogEntry[];
  }) => void
): () => void {
  let latestRides: Ride[] = [];
  let latestSchedules: RecurringSchedule[] = [];
  let latestLogs: DispatchLogEntry[] = [];

  const emit = () => {
    callback({
      scheduledRides: latestRides,
      recurringSchedules: latestSchedules,
      dispatchLogs: latestLogs
    });
  };

  const unsubRides = onSnapshot(collection(db, 'rides'), (snap) => {
    latestRides = snap.docs
      .map((d) => ({ ...(d.data() as Ride), id: d.id }))
      .filter((r) => Boolean(r.isScheduled || r.scheduledTime || r.scheduledPickupAt))
      .sort(
        (a, b) =>
          (b.scheduledPickupAt || b.scheduledTime || b.timestamp || 0) -
          (a.scheduledPickupAt || a.scheduledTime || a.timestamp || 0)
      );
    emit();
  });

  const unsubSchedules = onSnapshot(collection(db, 'recurringSchedules'), (snap) => {
    latestSchedules = snap.docs
      .map((d) => ({ ...(d.data() as RecurringSchedule), id: d.id }))
      .sort((a, b) => b.createdAt - a.createdAt);
    emit();
  });

  const unsubLogs = onSnapshot(
    query(collection(db, 'dispatchLogs'), orderBy('timestamp', 'desc'), limit(150)),
    (snap) => {
      latestLogs = snap.docs.map((d) => ({ ...(d.data() as DispatchLogEntry), id: d.id }));
      emit();
    },
    () => {
      emit();
    }
  );

  return () => {
    unsubRides();
    unsubSchedules();
    unsubLogs();
  };
}

export async function adminAssignDriverToScheduledRide(
  rideId: string,
  driver: Driver,
  adminId: string
): Promise<void> {
  const now = Date.now();
  await updateDoc(doc(db, 'rides', rideId), {
    driverId: driver.id,
    driverName: driver.name,
    driverPhone: driver.phone || '',
    driverAvatar: driver.personalPhotoUrl || driver.avatar || '',
    driverRating: driver.rating || 5.0,
    driverVehicleModel: `${driver.vehicleBrand || ''} ${driver.vehicleModel || ''}`.trim(),
    driverVehiclePlate: driver.vehiclePlate || '',
    driverVehicleColor: driver.vehicleColor || '',
    scheduleStatus: 'DRIVER_ASSIGNED',
    driverAssignedAt: now,
    assignmentType: 'EARLY_ACCEPTANCE',
    lastReassignedAt: now,
    reassignmentReason: 'Admin manual assignment'
  });

  await sendScheduledRideNotification(
    driver.id,
    'تم تعيينك لرحلة مجدولة بواسطة الإدارة 📋',
    `قامت الإدارة بتعيينك لرحلة مجدولة. يرجى مراجعة قسم الرحلات المجدولة.`,
    'ADMIN_SCHEDULED_ASSIGNED',
    { rideId }
  );

  await logDispatchEvent({
    rideId,
    eventType: 'ADMIN_OVERRIDE',
    actorId: adminId,
    actorRole: 'ADMIN',
    newDriverId: driver.id,
    message: `Admin manually assigned driver ${driver.name} (${driver.id}) to scheduled ride.`
  });
}
