
export enum UserRole {
  PASSENGER = 'PASSENGER',
  DRIVER = 'DRIVER',
  ADMIN = 'ADMIN'
}

export enum RideStatus {
  SEARCHING = 'SEARCHING',
  OFFER_RECEIVED = 'OFFER_RECEIVED',
  ACCEPTED = 'ACCEPTED',
  ARRIVED = 'ARRIVED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  SCHEDULED = 'SCHEDULED', 
  IDLE = 'IDLE',
  EXPIRED = 'EXPIRED'
}

export type ScheduleStatus =
  | 'SCHEDULED'
  | 'SEARCHING_DRIVER'
  | 'DRIVER_ASSIGNED'
  | 'DRIVER_EN_ROUTE'
  | 'DRIVER_ARRIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_DRIVER_FOUND';

export type AssignmentType = 'EARLY_ACCEPTANCE' | 'AUTOMATIC_DISPATCH' | null;

export type RecurringFrequency = 'ONE_TIME' | 'DAILY' | 'SELECTED_WEEKDAYS' | 'WEEKLY';

export type RecurringScheduleStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'COMPLETED';

export enum PaymentMethod {
  CASH = 'CASH',
  WALLET = 'WALLET',
  CARD = 'CARD',
  INSTAPAY = 'INSTAPAY'
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  AWAITING_CONFIRMATION = 'AWAITING_CONFIRMATION',
  PAID = 'PAID',
  DISPUTED = 'DISPUTED'
}

export enum VehicleType {
  STANDARD = 'STANDARD',
  COMFORT = 'COMFORT',
  MOTO = 'MOTO'
}

export enum ManualTopupStatus {
  PENDING = 'PENDING',
  AWAITING_CONFIRMATION = 'AWAITING_CONFIRMATION',
  PAID = 'PAID',
  REJECTED = 'REJECTED'
}

export interface Coordinates {
  lat: number;
  lng: number;
  heading?: number;
}

export interface Place {
  id: string;
  name: string;
  address: string;
  coords: Coordinates;
  type: 'history' | 'place' | 'home' | 'work';
  isGooglePlace?: boolean;
  isFavorite?: boolean;
  dist?: number;
  updatedAt?: number;
}

export interface Review {
  id?: string;
  reviewerId: string;
  reviewerName: string;
  rating: number;
  comment?: string;
  rideId: string;
  timestamp: any;
}

export interface SavedCard {
  id: string;
  brand: 'visa' | 'mastercard';
  last4: string;
  expiry: string;
}

export interface SafetyContact {
  id: string;
  name: string;
  phone: string;
}

export interface ManualTopup {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  referenceCode: string;
  status: ManualTopupStatus;
  createdAt: any;
  receiptUrl?: string;
  confirmedAt?: any;
  confirmedBy?: string; // Admin UID
  rejectionReason?: string;
}

export enum DriverLevel {
  BRONZE = 'BRONZE',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  VIP = 'VIP'
}

// "users" collection
export interface NotificationSettings {
  notificationsEnabled?: boolean;
  rideRequests?: boolean;
  rideUpdates?: boolean;
  offers?: boolean;
  adminAlerts?: boolean;
  soundEnabled?: boolean;
  vibrationEnabled?: boolean;

  enableAllSounds: boolean;
  enableAllVibrations: boolean;

  inAppSounds: boolean;
  pushSounds: boolean;

  // Passenger
  driverAcceptedSound: boolean;
  driverNearingAlert: boolean;
  rideCancelledAlert: boolean;
  passengerChatAlerts: boolean;
  generalAppNotifs: boolean;

  // Driver
  rideRequestSound: boolean;
  rideRequestVibration: boolean;
  driverChatAlerts: boolean;
  tripStatusAlerts: boolean;
  driverApproachingAlert: boolean;

  // Quiet Mode
  quietModeEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

export interface PrivacySettings {
  requirePinOnStartup?: boolean;
  autoLockTimeout?: 'immediate' | '1m' | '5m' | '15m' | 'never';
  biometricUnlockEnabled?: boolean;
  maskPhoneNumber?: boolean;
  shareLocationOnlyDuringRide?: boolean;
  hideWalletBalance?: boolean;
  loginAlertsEnabled?: boolean;
  rideVerificationPinEnabled?: boolean;
  rideVerificationPin?: string;
  incognitoRideHistory?: boolean;
}

export interface User {
  id: string;
  name: string;
  phone: string;
  email?: string; 
  role: UserRole;
  avatar?: string;
  rating?: number;
  totalRatings?: number;
  walletBalance?: number;
  fcmToken?: string;
  notificationSettings?: NotificationSettings;
  privacySettings?: PrivacySettings;
  profileCompleted?: boolean;
  onboardingCompleted?: boolean;
  rejectionReason?: string;
  
  // Rewards System
  rewardPoints?: number; // 5 points per trip
  
  // Security
  deviceFingerprint?: string;
  isBanned?: boolean;
  isBlockedByFees?: boolean;
  banReason?: string;
  suspendedUntil?: number;
  adminNotes?: string;
  warningMessage?: string;

  hasPasskey?: boolean;
  passcode?: string;
  driverStatus?: 'none' | 'pending' | 'approved' | 'rejected'; 
  isApproved?: boolean;
  status?: 'pending' | 'approved' | 'rejected' | 'deactivated';
  isAdmin?: boolean;
  
  // KYC 
  kycStatus?: 'NOT_STARTED' | 'UPLOADING' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  documents?: {
    licenseFront?: string;
    licenseBack?: string; // We might only have licenseFront in old data, but ok
    nationalIdFront?: string;
    nationalIdBack?: string;
    vehiclePhotos?: string[];
    criminalRecord?: string;
    vehicleRegFront?: string;
    vehicleRegBack?: string;
  };
  submittedAt?: any;

  defaultPaymentMethod?: PaymentMethod;
  savedCards?: SavedCard[];
  defaultCardId?: string;
  favoriteDrivers?: string[];
  safetyContacts?: SafetyContact[]; 
  
  createdAt?: any;
}

// Combined interface for UI
export interface Driver extends User {
  // Level System
  level?: DriverLevel;
  levelOverride?: boolean;
  cancellationRate?: number;
  
  // Personal Verification
  nationalId?: string;
  nationalIdUrl?: string;
  nationalIdBackUrl?: string;
  personalPhotoUrl?: string;
  
  // Vehicle Details
  vehicleBrand: string; 
  vehicleType: string; 
  vehicleModel: string; 
  vehicleYear: string;  
  vehiclePlate: string;
  vehicleColor: string;
  vehicleImageUrl: string;
  licenseNumber: string;
  licenseUrl?: string; 
  vehicleRegFrontUrl?: string;
  vehicleRegBackUrl?: string;
  
  // Stats
  earnings: number;
  totalRides: number;
  
  // Runtime
  isOnline?: boolean;
  currentLocation?: Coordinates;
  searchRadius?: number; 
  
  // Work Schedule
  autoOfflineTime?: number | null; 

  // InstaPay Integration
  instapayHandle?: string;
  instapayNumber?: string;
  
  // Approval Status
  status?: 'pending' | 'approved' | 'rejected' | 'deactivated';

  // Subscription Model
  subscriptionStatus?: 'active' | 'expired';
  subscriptionPlan?: 'weekly' | 'monthly';
  subscriptionExpiry?: number; 

  // Fee System
  pendingFees?: number; // Total unpaid commission
  financialStatus?: 'active' | 'warning' | 'soft_restricted' | 'blocked';
  lastSettlementDate?: number;
  gracePeriodEndTime?: number;
  lastFeeSaturday?: string; // Legacy/backward compatibility

  // New verification fields
  criminalRecordUrl?: string;
  isVerified?: boolean;
  hasCriminalRecord?: boolean;

  // Free Trial
  isTrialActive?: boolean;
  hasTrialExpired?: boolean;
  trialStartDate?: number;
  trialEndDate?: number;
  commissionPercentage?: number;
}

export interface Settlement {
  id: string;
  driverId: string;
  driverName: string;
  startDate: number;
  endDate: number;
  totalRides: number;
  grossEarnings: number;
  commissionOwed: number; // Amount driver owes the platform for this week
  status: 'unpaid' | 'pending_verification' | 'paid';
  receiptUrl?: string; // Uploaded InstaPay receipt
  createdAt: any;
  paidAt?: any;
}

export interface OfferDetails {
  id?: string;
  driverId: string;
  driverName: string;
  driverAvatar?: string;
  driverRating?: number;
  driverLevel?: DriverLevel;
  driverLocation?: Coordinates; 
  price: number;
  vehicleModel?: string;
  vehiclePlate?: string;
  isVerified?: boolean; 
  status?: 'pending' | 'accepted' | 'rejected' | 'countered';
  passengerCounterPrice?: number;
  timestamp?: any;
  createdAt?: number;
}

export type BookingType = 'SELF' | 'FOR_OTHER';

export interface BookedByInfo {
  userId: string;
  name: string;
  phone: string;
}

export interface ActualPassengerInfo {
  name: string;
  phone: string;
  note: string | null;
  userId: string | null;
}

export interface Ride {
  id: string;
  passengerId: string;
  passengerName?: string;
  passengerToken?: string;
  driverId?: string | null;
  driverLocation?: Coordinates;
  driverHeading?: number;
  pickup: {
    address: string;
    coords: Coordinates;
  };
  dropoff: {
    address: string;
    coords: Coordinates;
  };
  status: RideStatus;
  fare: number;
  price?: number;
  priceBoosted?: boolean;
  priceChanged?: boolean;
  priceDirection?: 'up' | 'down';
  lastPriceUpdate?: number;
  commission?: number;
  driverNet?: number;
  distanceValue: number;
  distanceText: string;
  durationText: string;
  timestamp: number;
  scheduledTime?: number; 
  createdAt: any;
  paymentMethod: PaymentMethod;
  requestedVehicleType: VehicleType;
  rating?: number;
  review?: string;
  currentOffer?: OfferDetails;
  preferredDriverIds?: string[];
  cancelledBy?: string;
  cancelReason?: string;
  acceptedAt?: number;
  cancellationRequest?: {
    requestedAt: number;
    status: 'pending' | 'rejected';
  };
  searchRadiusKm?: number; 
  notifiedDriverIds?: string[]; 
  offeringDriverIds?: string[];
  rejectedBy?: string[]; 
  lastActiveAt?: number;

  rideType?: 'RIDE' | 'PARCEL';
  parcelDetails?: string;
  recipient?: {
    name: string;
    phone: string;
  };
  deliveryProof?: {
    signatureUrl?: string;
    photoUrl?: string;
    confirmedAt?: any;
  };
  sosEvent?: {
    triggeredBy: string; 
    location: Coordinates;
    timestamp: any;
  };

  lastMessage?: string;
  lastMessageAt?: any;
  hasMessages?: boolean;

  isLargeGroup?: boolean;
  
  // Promo & Loyalty Points Info
  promoApplied?: boolean;
  promoAmount?: number;
  pointsRedeemed?: number;
  pointsDeductedUpfront?: boolean;
  pointsRefunded?: boolean;
  pointsEarned?: number;
  rewardsProcessed?: boolean;

  // Smart Pricing & Offers
  baseFareText?: string;
  baseFareAmount?: number;
  urgencyBoostLevel?: 'NORMAL' | 'FASTER' | 'URGENT';
  urgencyBoostAmount?: number;
  autoBoostAmount?: number;
  initialDriverSearchEndTime?: number; // timestamp when counter offers open
  isAutoBoosting?: boolean;
  
  // Live Tracking
  trackingToken?: string;
  trackingTokenExpiresAt?: number;

  // Book for Someone Else (حجز لشخص آخر) fields (backward-compatible)
  bookingType?: BookingType;
  bookedBy?: BookedByInfo;
  actualPassenger?: ActualPassengerInfo | null;

  // Optional Ride-Start Verification (OTP/PIN) fields
  rideVerificationEnabled?: boolean;
  verificationCodeHash?: string | null;
  verificationExpiresAt?: number | null;
  verificationAttempts?: number;
  verificationVerified?: boolean;
  verificationVerifiedAt?: number | null;

  // Payment Status
  paymentStatus?: PaymentStatus;
  paymentConfirmedAt?: any;
  paymentConfirmedBy?: string;
  paymentReference?: string;
  paymentProofUrl?: string;

  // Soft-delete flags for history management
  deletedByPassenger?: boolean;
  deletedByDriver?: boolean;
  isAirportRide?: boolean;
  airportFee?: number;

  // --- Scheduled & Recurring Rides System (backward-compatible) ---
  isScheduled?: boolean;
  scheduledPickupAt?: number; // UTC timestamp in ms
  scheduleStatus?: ScheduleStatus;
  dispatchStartedAt?: number | null;
  driverAssignedAt?: number | null;
  assignmentType?: AssignmentType;
  recurringScheduleId?: string | null;
  occurrenceKey?: string | null; // Deterministic key: `${scheduleId}_${YYYY-MM-DD}`
  bookingTimezone?: string; // Default: 'Africa/Cairo'
  passengerCount?: number;
  driverNote?: string | null;
  fareLocked?: boolean;
  lockedFare?: number | null;
  estimatedFare?: number | null;
  passengerReminderSentAt?: number | null;
  driverReminderSentAt?: number | null;
  driverEnRouteReminderSentAt?: number | null;
  lastReassignedAt?: number | null;
  reassignmentReason?: string | null;
  previousDriverIds?: string[];
  driverName?: string;
  driverPhone?: string;
  driverAvatar?: string;
  driverRating?: number;
  driverVehicleModel?: string;
  driverVehiclePlate?: string;
  driverVehicleColor?: string;
}

export interface RecurringSchedule {
  id: string;
  passengerId: string;
  passengerName: string;
  passengerPhone?: string;
  frequency: RecurringFrequency;
  weekdays: number[]; // 0 = Sunday ... 6 = Saturday
  startDate: string; // YYYY-MM-DD in booking timezone
  endDate?: string | null; // YYYY-MM-DD in booking timezone (optional)
  pickupTime: string; // HH:mm in booking timezone (e.g. "08:00")
  timezone: string; // e.g. 'Africa/Cairo'
  pickup: {
    address: string;
    coords: Coordinates;
  };
  dropoff: {
    address: string;
    coords: Coordinates;
  };
  category: VehicleType;
  paymentMethod: PaymentMethod;
  fareEstimate: number;
  distanceValue: number;
  distanceText: string;
  durationText: string;
  passengerCount?: number;
  bookingType?: BookingType;
  bookedBy?: BookedByInfo;
  actualPassenger?: ActualPassengerInfo | null;
  driverNote?: string | null;
  preferredDriverIds?: string[];
  status: RecurringScheduleStatus;
  nextGenerationAt: number;
  lastGeneratedWindowEnd: string; // YYYY-MM-DD
  generatedOccurrencesCount?: number;
  createdAt: number;
  updatedAt: number;
  cancelledAt?: number | null;
  pausedAt?: number | null;
}

export interface ScheduledRidesConfig {
  maxAdvanceBookingDays: number; // Default: 7
  minAdvanceBookingMinutes: number; // Default: 15
  autoDispatchLeadTimeMinutes: number; // Default: 30
  passengerReminderLeadTimeMinutes: number; // Default: 60
  driverReminderLeadTimeMinutes: number; // Default: 30
  driverConflictBufferMinutes: number; // Default: 30
  initialSearchRadiusKm: number; // Default: 5
  maxSearchRadiusKm: number; // Default: 25
  radiusExpansionStepKm: number; // Default: 5
  radiusExpansionIntervalSeconds: number; // Default: 60
  maxDispatchDurationMinutes: number; // Default: 30
  recurringRidesEnabled: boolean; // Default: true
  earlyAcceptanceEnabled: boolean; // Default: true
  autoDispatchEnabled: boolean; // Default: true
  driverReassignmentEnabled: boolean; // Default: true
  lockFareOnEarlyAcceptance: boolean; // Default: true
  freeCancellationWindowMinutes: number; // Default: 60
  lateCancellationFee: number; // Default: 15 EGP
  serviceTimezone: string; // Default: 'Africa/Cairo'
}

export interface DispatchLogEntry {
  id: string;
  rideId: string;
  recurringScheduleId?: string | null;
  eventType:
    | 'SCHEDULED_CREATED'
    | 'EARLY_DRIVER_NOTIFIED'
    | 'EARLY_ACCEPTED'
    | 'DRIVER_OFFER_SUBMITTED'
    | 'PASSENGER_REMINDER_SENT'
    | 'DRIVER_REMINDER_SENT'
    | 'AUTO_DISPATCH_STARTED'
    | 'SEARCH_RADIUS_EXPANDED'
    | 'DRIVER_RELEASED'
    | 'DRIVER_REASSIGNED'
    | 'ADMIN_OVERRIDE'
    | 'NO_DRIVER_FOUND'
    | 'CANCELLED'
    | 'RECURRING_GENERATED';
  actorId?: string | null;
  actorRole?: 'PASSENGER' | 'DRIVER' | 'ADMIN' | 'SYSTEM';
  previousDriverId?: string | null;
  newDriverId?: string | null;
  searchRadiusKm?: number | null;
  notifiedCount?: number | null;
  message: string;
  metadata?: Record<string, any>;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: any; 
  isSystem?: boolean; 
  audioUrl?: string;
}

// --- SUPPORT FEATURE ---
export interface SupportTicket {
  id: string;
  userId: string;
  userName?: string;
  userPhone?: string;
  userRole?: string;
  subject: string;
  status: 'open' | 'pending' | 'resolved' | 'closed';
  createdAt: any;
  lastMessageAt: any;
  lastMessage?: string;
  lastSenderId?: string;
  unreadByAdmin?: boolean;
  adminUnreadCount?: number;
  rideId?: string; 
}

export interface SupportMessage {
  id: string;
  text: string;
  senderId: string; 
  timestamp: any;
  isAdmin?: boolean;
  audioUrl?: string;
}

export interface PricingConfig {
  city: string; // 'default'
  baseFare: number;
  pricePerKm: number;
  pricePerMinute: number;
  minimumFare: number;
  driverCommissionPercent: number;
  autoBoostPercent: number;
  maxAutoBoostPercent: number;
  
  // Legacy fields for backwards compatibility (optional)
  minPricePerKm?: number;
  recommendedPricePerKm?: number;
  maxPricePerKm?: number;
  waitingPricePerMinute?: number;
  
  freeWaitingMinutes: number;
  nightSurchargeEnabled: boolean;
  nightSurchargeValue: number;
  nightSurchargeStartHour: number; 
  nightSurchargeEndHour: number;   
  airportFee: number;
  areaFees?: {
    [areaName: string]: number;
  };
  
  // Surge Pricing
  surgeMultiplier?: number;
  surgeReasonEn?: string;
  surgeReasonAr?: string;
  surgeEnabled?: boolean;

  // Smart Pricing Config
  maxCounterOfferPercentage?: number;
  autoBoostIntervalSeconds?: number;
  initialDriverMatchingPhaseSeconds?: number;
  counterOfferExpirySeconds?: number;
  offerExpirationSeconds?: number;

  lastUpdatedAt: any;
  subscriptionWeeklyFee?: number;
  subscriptionMonthlyFee?: number;
  cities?: {
    [cityName: string]: Omit<PricingConfig, 'city' | 'cities' | 'lastUpdatedAt'>;
  };
}

export interface Broadcast {
  id: string;
  title: string;
  message: string;
  titleEn?: string;
  titleAr?: string;
  messageEn?: string;
  messageAr?: string;
  type: 'maintenance' | 'warning' | 'update' | 'Forced Update' | 'promo' | 'alert';
  targetAudience: 'all' | 'drivers' | 'passengers';
  targetPlatform?: 'android' | 'all';
  targetVersion?: string;
  minBuildNumber?: number;
  playStoreUrl?: string;
  buttonText?: string;
  buttonLink?: string;
  forceClose?: boolean;
  createdAt: any;
  updatedAt?: any;
  expiresAt?: any;
  isActive: boolean;
  pushSent?: boolean;
  pushSentCount?: number;
}

export type HomeAdBannerActionType =
  | 'explainer_modal'
  | 'driver_registration'
  | 'support_chat'
  | 'whatsapp'
  | 'profile'
  | 'external_url'
  | 'none';

export interface HomeAdBannerConfig {
  isEnabled: boolean;
  isSectionHidden?: boolean;
  isQuickDestinationsEnabled?: boolean;
  topicAr: string;
  topicEn: string;
  subTopicAr?: string;
  subTopicEn?: string;
  titleAr: string;
  titleEn: string;
  textAr: string;
  textEn: string;
  badgeTextAr?: string;
  badgeTextEn?: string;
  imageUrl?: string;
  isButtonEnabled: boolean;
  buttonTextAr: string;
  buttonTextEn: string;
  buttonActionType: HomeAdBannerActionType;
  buttonActionUrl?: string;
  updatedAt?: number;
}

export interface SideMenuSocialLinksConfig {
  isSectionEnabled?: boolean;
  facebookUrl?: string;
  isFacebookEnabled?: boolean;
  websiteUrl?: string;
  isWebsiteEnabled?: boolean;
  tiktokUrl?: string;
  isTiktokEnabled?: boolean;
  instagramUrl?: string;
  isInstagramEnabled?: boolean;
  appVersion?: string;
  isVersionEnabled?: boolean;
}

// --- GLOBAL APP SETTINGS ---
export interface AppSettings {
  isPaymentsEnabled: boolean; // Allow hiding all financial features for deployment
  broadcastsEnabled?: boolean;
  forceUpdate?: {
    requiredVersion: string;
    minBuildNumber?: number;
    updateMode?: 'force' | 'flexible';
    isEnabled: boolean;
    titleEn: string;
    titleAr: string;
    messageEn: string;
    messageAr: string;
    playStoreUrl?: string;
    targetPlatform?: 'android' | 'all';
    updatedAt?: any;
  };
  maintenanceMode?: {
    isEnabled: boolean;
    messageEn: string;
    messageAr: string;
    targetPlatform?: 'android' | 'all';
    updatedAt?: any;
  };
  promoBanner: {
    isEnabled: boolean;
    textEn: string;
    textAr: string;
    backgroundColor?: string;
    textColor?: string;
  };
  homeAdBanner?: HomeAdBannerConfig;
  mapProvider?: 'google' | 'mapbox';
  mapboxPublicToken?: string;
  isRewardsEnabled: boolean;
  rewardPointsPerTrip: number;
  rewardThresholdPoints?: number;
  rewardDiscountAmount?: number;
  isInstaPayEnabled: boolean;
  forceReload?: {
    timestamp: number;
    messageEn: string;
    messageAr: string;
  };
  driverFreeTrialDays?: number; // Configurable default trial days
  defaultCommissionPercentage?: number; // E.g., 15
  supportWhatsappNumber?: string; // Dynamic WhatsApp support number (default +201024419931)
  welcomeOffer?: {
    isEnabled: boolean;
    image?: string;
    icon?: string;
    titleEn?: string;
    titleAr?: string;
    messageEn?: string;
    messageAr?: string;
    highlightTitleEn?: string;
    highlightTitleAr?: string;
    highlightMessageEn?: string;
    highlightMessageAr?: string;
    pushTimestamp?: number;
  };
  audioSettings?: AppAudioSettings;
  sideMenuConfig?: SideMenuSocialLinksConfig;
  scheduledRidesConfig?: ScheduledRidesConfig;
}

export type SoundKey =
  | 'trip_request'
  | 'driver_offer'
  | 'trip_accepted'
  | 'driver_arrived'
  | 'trip_completed'
  | 'trip_cancelled'
  | 'chat_message'
  | 'push_notification';

export interface AppAudioConfig {
  id: SoundKey;
  nameEn: string;
  nameAr: string;
  category: 'driver' | 'passenger' | 'common' | 'push';
  descriptionEn: string;
  descriptionAr: string;
  url: string; // custom URL or uploaded base64 dataUrl or storage URL
  presetKey: string; // preset key for acoustic engine
  isEnabled: boolean; // mute / remove sound
  volume: number; // 0 to 1
  isCustomUploaded?: boolean;
  uploadedFileName?: string;
  updatedAt?: number;
}

export interface AppAudioSettings {
  masterAudioEnabled: boolean; // Option to have full audio notifications on the app
  defaultVolume: number; // 0 to 1
  pushNotificationSoundName: string;
  sounds: Record<SoundKey, AppAudioConfig>;
  updatedAt?: number;
}

