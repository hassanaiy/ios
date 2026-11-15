import {
  Ride,
  ScheduleStatus,
  RecurringSchedule,
  ScheduledRidesConfig,
  VehicleType,
  Coordinates,
  BookingType,
  ActualPassengerInfo
} from '../types';

export const DEFAULT_SCHEDULED_RIDES_CONFIG: ScheduledRidesConfig = {
  maxAdvanceBookingDays: 7,
  minAdvanceBookingMinutes: 15,
  autoDispatchLeadTimeMinutes: 30,
  passengerReminderLeadTimeMinutes: 60,
  driverReminderLeadTimeMinutes: 30,
  driverConflictBufferMinutes: 30,
  initialSearchRadiusKm: 5,
  maxSearchRadiusKm: 25,
  radiusExpansionStepKm: 5,
  radiusExpansionIntervalSeconds: 60,
  maxDispatchDurationMinutes: 30,
  recurringRidesEnabled: true,
  earlyAcceptanceEnabled: true,
  autoDispatchEnabled: true,
  driverReassignmentEnabled: true,
  lockFareOnEarlyAcceptance: true,
  freeCancellationWindowMinutes: 60,
  lateCancellationFee: 15,
  serviceTimezone: 'Africa/Cairo'
};

export function formatInServiceTimezone(
  utcMs: number,
  timezone: string = 'Africa/Cairo'
): { dateStr: string; timeStr: string; weekday: number; formattedAr: string; formattedEn: string } {
  const d = new Date(utcMs);
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(d);

    const map: Record<string, string> = {};
    for (const p of parts) {
      map[p.type] = p.value;
    }
    const year = map.year || d.getUTCFullYear().toString();
    const month = map.month || String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = map.day || String(d.getUTCDate()).padStart(2, '0');
    const hour = map.hour === '24' ? '00' : (map.hour || '00');
    const minute = map.minute || '00';

    const dateStr = `${year}-${month}-${day}`;
    const timeStr = `${hour}:${minute}`;

    const weekdayParts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short'
    }).format(d);
    const weekdayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6
    };
    const weekday = weekdayMap[weekdayParts] ?? d.getDay();

    const formattedAr = new Intl.DateTimeFormat('ar-EG', {
      timeZone: timezone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(d);

    const formattedEn = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(d);

    return { dateStr, timeStr, weekday, formattedAr, formattedEn };
  } catch {
    const dateStr = d.toISOString().slice(0, 10);
    const timeStr = d.toISOString().slice(11, 16);
    return {
      dateStr,
      timeStr,
      weekday: d.getDay(),
      formattedAr: `${dateStr} ${timeStr}`,
      formattedEn: `${dateStr} ${timeStr}`
    };
  }
}

export function parseServiceLocalToUtcMs(
  dateStr: string,
  timeStr: string,
  timezone: string = 'Africa/Cairo'
): number {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  if (!year || !month || !day || isNaN(hour) || isNaN(minute)) {
    return NaN;
  }

  const guessUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).formatToParts(new Date(guessUtc));

    const map: Record<string, number> = {};
    for (const p of parts) {
      if (p.type !== 'literal') {
        map[p.type] = Number(p.value);
      }
    }
    const tzHour = map.hour === 24 ? 0 : map.hour;
    const tzAsUtc = Date.UTC(map.year, map.month - 1, map.day, tzHour, map.minute, map.second || 0, 0);
    const offsetMs = tzAsUtc - guessUtc;
    return guessUtc - offsetMs;
  } catch {
    return guessUtc - 2 * 60 * 60 * 1000;
  }
}

export interface ScheduledBookingValidationInput {
  scheduledPickupAt: number;
  nowMs?: number;
  pickup?: { address: string; coords: Coordinates } | null;
  dropoff?: { address: string; coords: Coordinates } | null;
  category?: VehicleType | string;
  fare?: number;
  passengerCount?: number;
  bookingType?: BookingType;
  actualPassenger?: ActualPassengerInfo | null;
  config?: Partial<ScheduledRidesConfig>;
}

export interface ValidationResult {
  valid: boolean;
  errorCode?: string;
  errorMessageAr?: string;
  errorMessageEn?: string;
}

export function validateScheduledBookingInput(input: ScheduledBookingValidationInput): ValidationResult {
  const cfg: ScheduledRidesConfig = { ...DEFAULT_SCHEDULED_RIDES_CONFIG, ...(input.config || {}) };
  const now = input.nowMs ?? Date.now();
  const pickupAt = Number(input.scheduledPickupAt);

  if (!pickupAt || isNaN(pickupAt)) {
    return {
      valid: false,
      errorCode: 'INVALID_TIMESTAMP',
      errorMessageAr: 'يرجى اختيار تاريخ ووقت صحيحين للرحلة المجدولة.',
      errorMessageEn: 'Please select a valid date and pickup time for the scheduled ride.'
    };
  }

  const minLeadMs = Math.max(0, (cfg.minAdvanceBookingMinutes ?? 15) * 60 * 1000);
  if (pickupAt < now - 60000) {
    return {
      valid: false,
      errorCode: 'PAST_DATETIME',
      errorMessageAr: 'لا يمكن جدولة رحلة في وقت مضى.',
      errorMessageEn: 'Cannot schedule a ride in the past.'
    };
  }

  if (pickupAt < now + minLeadMs - 60000) {
    return {
      valid: false,
      errorCode: 'TOO_SOON',
      errorMessageAr: `يجب جدولة الرحلة قبل ${cfg.minAdvanceBookingMinutes} دقيقة على الأقل من موعد الانطلاق.`,
      errorMessageEn: `Scheduled rides must be booked at least ${cfg.minAdvanceBookingMinutes} minutes in advance.`
    };
  }

  const maxAdvanceMs = (cfg.maxAdvanceBookingDays || 7) * 24 * 60 * 60 * 1000;
  if (pickupAt > now + maxAdvanceMs) {
    return {
      valid: false,
      errorCode: 'EXCEEDS_MAX_ADVANCE_WINDOW',
      errorMessageAr: `يمكنك جدولة الرحلات بحد أقصى ${cfg.maxAdvanceBookingDays} أيام مقدماً.`,
      errorMessageEn: `Rides can only be scheduled up to ${cfg.maxAdvanceBookingDays} days in advance.`
    };
  }

  if (
    !input.pickup ||
    !input.pickup.address?.trim() ||
    typeof input.pickup.coords?.lat !== 'number' ||
    typeof input.pickup.coords?.lng !== 'number'
  ) {
    return {
      valid: false,
      errorCode: 'INVALID_PICKUP',
      errorMessageAr: 'يرجى تحديد نقطة الانطلاق بشكل صحيح.',
      errorMessageEn: 'Please select a valid pickup location.'
    };
  }

  if (
    !input.dropoff ||
    !input.dropoff.address?.trim() ||
    typeof input.dropoff.coords?.lat !== 'number' ||
    typeof input.dropoff.coords?.lng !== 'number'
  ) {
    return {
      valid: false,
      errorCode: 'INVALID_DROPOFF',
      errorMessageAr: 'يرجى تحديد الوجهة بشكل صحيح.',
      errorMessageEn: 'Please select a valid destination.'
    };
  }

  const distKm = calculateHaversineDistanceKm(input.pickup.coords, input.dropoff.coords);
  if (distKm < 0.05) {
    return {
      valid: false,
      errorCode: 'SAME_PICKUP_DROPOFF',
      errorMessageAr: 'نقطة الانطلاق والوجهة متطابقتان تقريباً.',
      errorMessageEn: 'Pickup and destination cannot be the same location.'
    };
  }

  const allowedCategories = [VehicleType.MOTO, VehicleType.STANDARD, VehicleType.COMFORT, 'MOTO', 'STANDARD', 'COMFORT'];
  if (!input.category || !allowedCategories.includes(input.category)) {
    return {
      valid: false,
      errorCode: 'INVALID_CATEGORY',
      errorMessageAr: 'فئة المركبة غير صالحة (MOTO / STANDARD / COMFORT).',
      errorMessageEn: 'Invalid vehicle category (must be MOTO, STANDARD, or COMFORT).'
    };
  }

  if (input.passengerCount !== undefined) {
    const maxPassengers = input.category === VehicleType.MOTO ? 1 : 4;
    if (input.passengerCount < 1 || input.passengerCount > maxPassengers) {
      return {
        valid: false,
        errorCode: 'INVALID_PASSENGER_COUNT',
        errorMessageAr: `عدد الركاب المسموح لهذه الفئة من 1 إلى ${maxPassengers}.`,
        errorMessageEn: `Passenger count for ${input.category} must be between 1 and ${maxPassengers}.`
      };
    }
  }

  if (input.bookingType === 'FOR_OTHER') {
    const ap = input.actualPassenger;
    if (!ap || !ap.name || ap.name.trim().length < 2 || !ap.phone || ap.phone.trim().length < 10) {
      return {
        valid: false,
        errorCode: 'INVALID_ACTUAL_PASSENGER',
        errorMessageAr: 'يرجى إدخال اسم ورقم هاتف الراكب الفعلي بشكل صحيح.',
        errorMessageEn: 'Please enter a valid name and phone number for the passenger.'
      };
    }
  }

  if (input.fare !== undefined && (isNaN(input.fare) || input.fare <= 0)) {
    return {
      valid: false,
      errorCode: 'INVALID_FARE',
      errorMessageAr: 'قيمة الأجرة غير صالحة.',
      errorMessageEn: 'Invalid fare amount.'
    };
  }

  return { valid: true };
}

export function calculateHaversineDistanceKm(a: Coordinates, b: Coordinates): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const c =
    sinDLat * sinDLat +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinDLng * sinDLng;
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

export function estimateRideDurationMinutes(ride: Pick<Ride, 'durationText' | 'distanceValue'>): number {
  if (ride.durationText) {
    const match = ride.durationText.match(/(\d+)/);
    if (match) {
      const val = parseInt(match[1], 10);
      if (val > 0 && val <= 360) return val;
    }
  }
  if (ride.distanceValue && ride.distanceValue > 0) {
    const km = ride.distanceValue > 200 ? ride.distanceValue / 1000 : ride.distanceValue;
    return Math.max(15, Math.ceil((km / 30) * 60));
  }
  return 25;
}

export function checkDriverScheduleConflict(
  candidateRide: Pick<Ride, 'id' | 'scheduledPickupAt' | 'scheduledTime' | 'durationText' | 'distanceValue'>,
  existingDriverRides: Array<Pick<Ride, 'id' | 'status' | 'scheduleStatus' | 'scheduledPickupAt' | 'scheduledTime' | 'durationText' | 'distanceValue'>>,
  bufferMinutes: number = 30
): { hasConflict: boolean; conflictingRideId?: string; messageAr?: string; messageEn?: string } {
  const candidateStart = candidateRide.scheduledPickupAt || candidateRide.scheduledTime || 0;
  if (!candidateStart) return { hasConflict: false };

  const candidateDurationMs = estimateRideDurationMinutes(candidateRide) * 60 * 1000;
  const bufferMs = bufferMinutes * 60 * 1000;
  const candWindowStart = candidateStart - bufferMs;
  const candWindowEnd = candidateStart + candidateDurationMs + bufferMs;

  const terminalStatuses = new Set(['COMPLETED', 'CANCELLED', 'EXPIRED', 'NO_DRIVER_FOUND']);

  for (const r of existingDriverRides) {
    if (r.id === candidateRide.id) continue;
    if (r.status && terminalStatuses.has(r.status)) continue;
    if (r.scheduleStatus && terminalStatuses.has(r.scheduleStatus)) continue;

    const existingStart = r.scheduledPickupAt || r.scheduledTime || 0;
    if (!existingStart) continue;

    const existingDurationMs = estimateRideDurationMinutes(r) * 60 * 1000;
    const existWindowStart = existingStart - bufferMs;
    const existWindowEnd = existingStart + existingDurationMs + bufferMs;

    const overlaps = candWindowStart < existWindowEnd && existWindowStart < candWindowEnd;
    if (overlaps) {
      return {
        hasConflict: true,
        conflictingRideId: r.id,
        messageAr: 'لديك رحلة مجدولة أخرى متداخلة مع هذا التوقيت.',
        messageEn: 'You already have another scheduled ride overlapping with this time window.'
      };
    }
  }

  return { hasConflict: false };
}

export function computeRecurringWindowOccurrences(
  schedule: Pick<
    RecurringSchedule,
    'id' | 'frequency' | 'weekdays' | 'startDate' | 'endDate' | 'pickupTime' | 'timezone' | 'status'
  >,
  nowMs: number = Date.now(),
  maxAdvanceDays: number = 7
): Array<{ occurrenceKey: string; dateStr: string; scheduledPickupAt: number }> {
  if (schedule.status !== 'ACTIVE') return [];

  const tz = schedule.timezone || 'Africa/Cairo';
  const results: Array<{ occurrenceKey: string; dateStr: string; scheduledPickupAt: number }> = [];
  const maxUtcMs = nowMs + maxAdvanceDays * 24 * 60 * 60 * 1000;

  const startNoonUtc = parseServiceLocalToUtcMs(schedule.startDate, '12:00', tz);
  const startWeekday = !isNaN(startNoonUtc)
    ? formatInServiceTimezone(startNoonUtc, tz).weekday
    : 0;

  for (let offsetDays = 0; offsetDays <= maxAdvanceDays + 1; offsetDays++) {
    const sampleMs = nowMs + offsetDays * 24 * 60 * 60 * 1000;
    const { dateStr, weekday } = formatInServiceTimezone(sampleMs, tz);

    if (dateStr < schedule.startDate) continue;
    if (schedule.endDate && dateStr > schedule.endDate) continue;

    let matchesFrequency = false;
    if (schedule.frequency === 'ONE_TIME') {
      matchesFrequency = dateStr === schedule.startDate;
    } else if (schedule.frequency === 'DAILY') {
      matchesFrequency = true;
    } else if (schedule.frequency === 'SELECTED_WEEKDAYS') {
      matchesFrequency = Array.isArray(schedule.weekdays) && schedule.weekdays.includes(weekday);
    } else if (schedule.frequency === 'WEEKLY') {
      const targetDays =
        Array.isArray(schedule.weekdays) && schedule.weekdays.length > 0
          ? schedule.weekdays
          : [startWeekday];
      matchesFrequency = targetDays.includes(weekday);
    }

    if (!matchesFrequency) continue;

    const scheduledPickupAt = parseServiceLocalToUtcMs(dateStr, schedule.pickupTime, tz);
    if (isNaN(scheduledPickupAt)) continue;

    if (scheduledPickupAt <= nowMs) continue;
    if (scheduledPickupAt > maxUtcMs) continue;

    const occurrenceKey = `${schedule.id}_${dateStr}`;
    if (!results.some((r) => r.occurrenceKey === occurrenceKey)) {
      results.push({ occurrenceKey, dateStr, scheduledPickupAt });
    }
  }

  return results.sort((a, b) => a.scheduledPickupAt - b.scheduledPickupAt);
}

export function getScheduledStatusLabel(
  scheduleStatus: ScheduleStatus | undefined,
  lang: 'ar' | 'en' = 'ar',
  viewerRole: 'PASSENGER' | 'DRIVER' | 'ADMIN' = 'PASSENGER',
  scheduledPickupAt?: number
): { label: string; colorClass: string; badgeBg: string } {
  const isNearPickup =
    scheduledPickupAt &&
    scheduledPickupAt - Date.now() <= 45 * 60 * 1000 &&
    scheduledPickupAt - Date.now() > -15 * 60 * 1000;

  switch (scheduleStatus) {
    case 'SCHEDULED':
      if (viewerRole === 'DRIVER') {
        return {
          label: lang === 'ar' ? 'متاحة للسائقين' : 'Available for Drivers',
          colorClass: 'text-blue-700 dark:text-blue-300',
          badgeBg: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800'
        };
      }
      return {
        label: lang === 'ar' ? 'بانتظار قبول سائق' : 'Awaiting Driver Acceptance',
        colorClass: 'text-amber-700 dark:text-amber-300',
        badgeBg: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800'
      };
    case 'SEARCHING_DRIVER':
      return {
        label: lang === 'ar' ? 'جاري البحث التلقائي عن سائق' : 'Searching for Nearby Driver',
        colorClass: 'text-indigo-700 dark:text-indigo-300',
        badgeBg: 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800'
      };
    case 'DRIVER_ASSIGNED':
      if (isNearPickup) {
        return {
          label: lang === 'ar' ? 'اقترب موعد الرحلة' : 'Pickup Time Approaching',
          colorClass: 'text-orange-700 dark:text-orange-300',
          badgeBg: 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800'
        };
      }
      return {
        label: lang === 'ar' ? 'تم تعيين سائق' : 'Driver Assigned',
        colorClass: 'text-emerald-700 dark:text-emerald-300',
        badgeBg: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800'
      };
    case 'DRIVER_EN_ROUTE':
      return {
        label: lang === 'ar' ? 'السائق في الطريق' : 'Driver En Route',
        colorClass: 'text-blue-700 dark:text-blue-300',
        badgeBg: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800'
      };
    case 'DRIVER_ARRIVED':
      return {
        label: lang === 'ar' ? 'السائق وصل' : 'Driver Arrived',
        colorClass: 'text-teal-700 dark:text-teal-300',
        badgeBg: 'bg-teal-50 dark:bg-teal-900/30 border-teal-200 dark:border-teal-800'
      };
    case 'IN_PROGRESS':
      return {
        label: lang === 'ar' ? 'الرحلة بدأت' : 'Ride in Progress',
        colorClass: 'text-purple-700 dark:text-purple-300',
        badgeBg: 'bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800'
      };
    case 'COMPLETED':
      return {
        label: lang === 'ar' ? 'اكتملت الرحلة' : 'Completed',
        colorClass: 'text-green-700 dark:text-green-300',
        badgeBg: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800'
      };
    case 'CANCELLED':
      return {
        label: lang === 'ar' ? 'أُلغيت الرحلة' : 'Cancelled',
        colorClass: 'text-red-700 dark:text-red-300',
        badgeBg: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800'
      };
    case 'NO_DRIVER_FOUND':
      return {
        label: lang === 'ar' ? 'لم يتم العثور على سائق' : 'No Driver Found',
        colorClass: 'text-rose-700 dark:text-rose-300',
        badgeBg: 'bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800'
      };
    default:
      return {
        label: lang === 'ar' ? 'بانتظار قبول سائق' : 'Scheduled',
        colorClass: 'text-slate-700 dark:text-slate-300',
        badgeBg: 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
      };
  }
}

export function computeNextDispatchRadiusKm(
  currentRadiusKm: number | undefined,
  cfg: Partial<ScheduledRidesConfig> = DEFAULT_SCHEDULED_RIDES_CONFIG
): number {
  const initial = cfg.initialSearchRadiusKm ?? 5;
  const maxR = cfg.maxSearchRadiusKm ?? 25;
  const step = cfg.radiusExpansionStepKm ?? 5;
  const cur = currentRadiusKm ?? initial;
  return Math.min(maxR, cur + step);
}

export function evaluateCancellationEligibility(
  ride: Pick<Ride, 'scheduledPickupAt' | 'scheduledTime' | 'status' | 'scheduleStatus'>,
  nowMs: number = Date.now(),
  cfg: Partial<ScheduledRidesConfig> = DEFAULT_SCHEDULED_RIDES_CONFIG
): { allowed: boolean; isFreeCancellation: boolean; fee: number } {
  if (
    ride.status === 'COMPLETED' ||
    ride.status === 'CANCELLED' ||
    ride.scheduleStatus === 'COMPLETED' ||
    ride.scheduleStatus === 'CANCELLED' ||
    ride.scheduleStatus === 'IN_PROGRESS'
  ) {
    return { allowed: false, isFreeCancellation: false, fee: 0 };
  }
  const pickupAt = ride.scheduledPickupAt || ride.scheduledTime || 0;
  const freeWindowMs = (cfg.freeCancellationWindowMinutes ?? 60) * 60 * 1000;
  const isFreeCancellation = !pickupAt || pickupAt - nowMs >= freeWindowMs;
  const fee = isFreeCancellation ? 0 : (cfg.lateCancellationFee ?? 15);
  return { allowed: true, isFreeCancellation, fee };
}
