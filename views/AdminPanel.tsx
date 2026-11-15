
import React, { useEffect, useState, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { 
    subscribeToAllRides, subscribeToAllUsers, 
    subscribeToAllRides as _subscribeToAllRidesUnused, // for type import if needed or just remove
    deleteRide, 
    DEFAULT_COMMISSION_RATE,
    getPricingSettings, updatePricingSettings, subscribeToAppSettings, 
    updateAppSettings, sendGlobalNotification, db, subscribeToAllManualTopups,
    confirmManualTopupAdmin, rejectManualTopupAdmin,
    getAllSettlements, subscribeToAllSupportTickets, subscribeToAllAdminChats, approveSettlementPayment, generateWeeklySettlement,
    approveDriverFees, getOrCreateAdminSupportTicket, subscribeToSupportMessages, sendSupportMessage,
    auth, checkIsAdmin, updateDriverApprovalStatus, adminPurgeUserCompletely
} from '../services/firebaseBridge';
import { User, Driver, Ride, RideStatus, UserRole, PricingConfig, AppSettings, ManualTopup, ManualTopupStatus } from '../types';
import { Button } from '../components/ui/Button';
import { SupportAdminView } from './SupportAdminView';
import { DriverManagementModal } from '../components/DriverManagementModal';
import { BroadcastAdminView } from './BroadcastAdminView';
import { RewardCampaignsAdminView } from '../components/RewardCampaignsAdminView';
import { DatabaseAdminView } from '../components/DatabaseAdminView';
import { UsersDatabaseAdminView } from '../components/UsersDatabaseAdminView';
import { HomeAdBannerAdminEditor } from '../components/HomeAdBannerAdminEditor';
import { AudioSettingsAdminView } from '../components/AudioSettingsAdminView';
import { ScheduledRidesAdminView } from '../components/ScheduledRidesAdminView';
import { doc, updateDoc, onSnapshot, setDoc, collection, addDoc, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { PLAY_STORE_URL } from '../services/updateSystem';

const DEFAULT_PRICING: PricingConfig = {
    city: 'Qena',
    baseFare: 30,
    pricePerKm: 7,
    pricePerMinute: 1,
    minimumFare: 25,
    driverCommissionPercent: 10,
    autoBoostPercent: 5,
    maxAutoBoostPercent: 40,
    minPricePerKm: 3,
    recommendedPricePerKm: 5,
    maxPricePerKm: 7,
    waitingPricePerMinute: 1,
    freeWaitingMinutes: 5,
    nightSurchargeEnabled: false,
    nightSurchargeValue: 10,
    nightSurchargeStartHour: 0,
    nightSurchargeEndHour: 6,
    airportFee: 30,
    surgeEnabled: false,
    surgeMultiplier: 1.0,
    lastUpdatedAt: Date.now()
};

export default function AdminPanel({ onExitAdmin }: { onExitAdmin?: () => void } = {}) {
    const { t, isRTL } = useLanguage();

    const isCurrentAdmin = checkIsAdmin(auth.currentUser?.email, auth.currentUser?.phoneNumber);

    useEffect(() => {
        if (!isCurrentAdmin && onExitAdmin) {
            onExitAdmin();
        }
    }, [isCurrentAdmin, onExitAdmin]);

    if (!isCurrentAdmin) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 text-center" dir={isRTL ? 'rtl' : 'ltr'}>
                <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full border border-gray-100">
                    <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                        <i className="fas fa-lock"></i>
                    </div>
                    <h2 className="text-xl font-black text-gray-900 mb-2">
                        {isRTL ? "غير مصرح بالدخول" : "Access Denied"}
                    </h2>
                    <p className="text-gray-500 text-sm mb-6">
                        {isRTL ? "لوحة التحكم مخصصة لحساب المدير فقط." : "The Admin Dashboard is strictly restricted to administrator accounts."}
                    </p>
                    <Button
                        onClick={() => {
                            if (onExitAdmin) {
                                onExitAdmin();
                            } else {
                                window.location.href = '/';
                            }
                        }}
                        className="w-full h-12 bg-gray-900 text-white rounded-xl"
                    >
                        {isRTL ? "العودة للرئيسية" : "Go to Home"}
                    </Button>
                </div>
            </div>
        );
    }

    const [activeTab, setActiveTab] = useState<'dashboard' | 'drivers' | 'passengers' | 'users_db' | 'rides' | 'scheduled_rides' | 'financials' | 'pricing' | 'notifications' | 'settings' | 'manual_payments' | 'fee_payments' | 'support' | 'rewards' | 'broadcasts' | 'database'>('dashboard');
    const [activeSettingsTab, setActiveSettingsTab] = useState<'system'|'audio'|'features'|'offers'|'maintenance'>('system');
    const [isLoading, setIsLoading] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const [allUsersList, setAllUsersList] = useState<(User | Driver)[]>([]);
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [passengers, setPassengers] = useState<User[]>([]);
    const [rides, setRides] = useState<Ride[]>([]);
    const [pricingConfig, setPricingConfig] = useState<PricingConfig>(DEFAULT_PRICING);
    const [selectedCity, setSelectedCity] = useState<string>('default');
    const EGYPT_CITIES = [
        "Cairo", "Giza", "Alexandria", "Qalyubia", "Port Said", "Suez", "Gharbia", "Dakahlia", 
        "Asyut", "Fayoum", "Sharqia", "Ismailia", "Aswan", "Beheira", "Minya", "Damietta", 
        "Luxor", "Qena", "Beni Suef", "Sohag", "Monufia", "Red Sea", "South Sinai", "North Sinai", 
        "New Valley", "Matrouh", "Kafr El Sheikh"
    ];
    const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
    
    // UI State
    const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
    const [isDocModalOpen, setIsDocModalOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [isRejecting, setIsRejecting] = useState(false);
    const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
    const [isChatModalOpen, setIsChatModalOpen] = useState(false);
    
    // Notification State
    const [notifTitle, setNotifTitle] = useState('');
    const [notifBody, setNotifBody] = useState('');
    const [isSendingNotif, setIsSendingNotif] = useState(false);

    const [stats, setStats] = useState({
        totalRevenue: 0,
        platformFees: 0,
        activeDrivers: 0,
        onlineDrivers: 0,
        pendingApps: 0,
        completedRides: 0,
        totalUsers: 0
    });

    const [pendingManualPayments, setPendingManualPayments] = useState(0);
    const [pendingSupportTickets, setPendingSupportTickets] = useState(0);
    const [pendingAdminChats, setPendingAdminChats] = useState(0);
    const [appPhoneAuthEnabled, setAppPhoneAuthEnabled] = useState(true);
    const [driverFilter, setDriverFilter] = useState<'all' | 'pending' | 'active' | 'banned'>('all');
    const [driverSearch, setDriverSearch] = useState('');
    const [rideBookingTypeFilter, setRideBookingTypeFilter] = useState<'ALL' | 'SELF' | 'FOR_OTHER'>('ALL');
    const [rideSearchQuery, setRideSearchQuery] = useState('');
    const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);

    // Helpers to identify driver applicants and pending status
    const isDriverApplicant = (u: any) => {
        return (
            u.role === UserRole.DRIVER ||
            u.hasPendingDriverApplication === true ||
            u.driverStatus === 'pending' ||
            u.driverStatus === 'approved' ||
            u.status === 'pending' ||
            u.kycStatus === 'PENDING_REVIEW' ||
            Boolean(u.documents?.licenseFront || u.licenseUrl || u.vehiclePlate || u.nationalIdUrl)
        );
    };

    const isPendingDriver = (u: any) => {
        return (
            u.status === 'pending' ||
            u.driverStatus === 'pending' ||
            u.kycStatus === 'PENDING_REVIEW' ||
            u.hasPendingDriverApplication === true ||
            (Boolean(u.licenseUrl || u.documents?.licenseFront || u.vehiclePlate) && u.isApproved !== true && u.status !== 'approved')
        );
    };

    const getDriverDocsSummary = (d: any) => {
        const docs = [
            { key: 'nationalIdFront', label: 'ID Front', labelAr: 'البطاقة (وجه)', url: d.documents?.nationalIdFront || d.nationalIdUrl },
            { key: 'nationalIdBack', label: 'ID Back', labelAr: 'البطاقة (ظهر)', url: d.documents?.nationalIdBack || d.nationalIdBackUrl },
            { key: 'licenseFront', label: 'License', labelAr: 'رخصة القيادة', url: d.documents?.licenseFront || d.licenseUrl },
            { key: 'vehicleRegFront', label: 'Car Reg Front', labelAr: 'رخصة المركبة (وجه)', url: d.documents?.vehicleRegFront || d.vehicleRegFrontUrl },
            { key: 'vehicleRegBack', label: 'Car Reg Back', labelAr: 'رخصة المركبة (ظهر)', url: d.documents?.vehicleRegBack || d.vehicleRegBackUrl },
            { key: 'vehiclePhoto', label: 'Car Photo', labelAr: 'صورة المركبة', url: d.documents?.vehiclePhotos?.[0] || d.vehicleImageUrl },
            { key: 'personalPhoto', label: 'Personal Photo', labelAr: 'الصورة الشخصية', url: d.personalPhotoUrl || d.avatar },
            { key: 'criminalRecord', label: 'Criminal Record', labelAr: 'الفيش الجنائي', url: d.documents?.criminalRecord || d.criminalRecordUrl },
        ];
        const uploadedCount = docs.filter(x => Boolean(x.url)).length;
        return { docs, uploadedCount, totalCount: docs.length, isComplete: uploadedCount >= 7 };
    };

    const handleQuickApprove = async (driverId: string) => {
        if (!window.confirm(isRTL ? "هل أنت متأكد من قبول هذا السائق وتفعيله؟" : "Confirm approving this driver?")) return;
        setActionInProgressId(driverId);
        try {
            await updateDriverApprovalStatus(driverId, 'approved');
            alert(isRTL ? "تمت الموافقة على السائق بنجاح!" : "Driver approved successfully!");
        } catch (e) {
            console.error(e);
            alert("Failed to approve driver");
        } finally {
            setActionInProgressId(null);
        }
    };

    const handleQuickReject = async (driverId: string) => {
        const reason = window.prompt(isRTL ? "سبب الرفض (اختياري):" : "Rejection reason (optional):");
        if (reason === null) return;
        setActionInProgressId(driverId);
        try {
            await updateDriverApprovalStatus(driverId, 'rejected', reason || undefined);
            alert(isRTL ? "تم رفض الطلب." : "Driver application rejected.");
        } catch (e) {
            console.error(e);
            alert("Failed to reject driver");
        } finally {
            setActionInProgressId(null);
        }
    };

    useEffect(() => {
        setIsLoading(true);
        getPricingSettings().catch(() => null).then(pricing => {
            if (pricing) setPricingConfig(pricing);
        });

        const unsubUsers = subscribeToAllUsers((allUsers) => {
            setAllUsersList(allUsers as (User | Driver)[]);
            const paxs = allUsers.filter(u => u.role === UserRole.PASSENGER && !isDriverApplicant(u));
            const allAdminDrivers = allUsers.filter(isDriverApplicant) as Driver[];

            // Sort so that pending applications come FIRST, and most recently submitted first
            allAdminDrivers.sort((a: any, b: any) => {
                const aPending = isPendingDriver(a) ? 1 : 0;
                const bPending = isPendingDriver(b) ? 1 : 0;
                if (aPending !== bPending) return bPending - aPending;
                const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
                const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
                return bTime - aTime;
            });
            
            setDrivers(allAdminDrivers);
            setPassengers(paxs);
            
            setStats(prev => ({ 
                ...prev, 
                onlineDrivers: allAdminDrivers.filter(d => d.isOnline).length,
                pendingApps: allAdminDrivers.filter(isPendingDriver).length,
                totalUsers: allUsers.length
            }));
            setIsLoading(false);
        });

        const unsubRides = subscribeToAllRides((updatedRides) => {
            setRides(updatedRides);
            const completed = updatedRides.filter(r => r.status === RideStatus.COMPLETED);
            setStats(prev => ({
                ...prev,
                totalRevenue: Math.round(completed.reduce((acc, r) => acc + (r.fare || 0), 0)),
                platformFees: Math.round(completed.reduce((acc, r) => acc + (r.commission || (r.fare || 0) * DEFAULT_COMMISSION_RATE), 0)),
                completedRides: completed.length,
                activeDrivers: updatedRides.filter(r => [RideStatus.ACCEPTED, RideStatus.ARRIVED, RideStatus.IN_PROGRESS].includes(r.status)).length
            }));
        });
        const unsubSettings = subscribeToAppSettings(async (s) => {
            setAppSettings(s);
            if (
                s?.forceUpdate?.isEnabled &&
                (s.broadcastsEnabled === false || (s.forceUpdate as any)?.broadcastSyncedVersion !== s.forceUpdate.requiredVersion)
            ) {
                try {
                    const reqVer = String(s.forceUpdate.requiredVersion || '1.2.2').trim();
                    const tEn = s.forceUpdate.titleEn || 'Update Required';
                    const tAr = s.forceUpdate.titleAr || 'تحديث مطلوب';
                    const mEn = s.forceUpdate.messageEn || 'A new version of the app is available. Please update from Google Play.';
                    const mAr = s.forceUpdate.messageAr || 'يتوفر إصدار جديد من التطبيق على جوجل بلاي. يرجى التحديث الآن.';
                    await setDoc(doc(db, 'settings', 'app'), {
                        broadcastsEnabled: true,
                        forceUpdate: {
                            ...s.forceUpdate,
                            broadcastSyncedVersion: reqVer,
                        },
                    }, { merge: true });

                    const allSnap = await getDocs(collection(db, 'broadcasts'));
                    const batch = writeBatch(db);
                    let hasBatch = false;
                    allSnap.forEach((bDoc) => {
                        const bData = bDoc.data();
                        if (bData.isActive === true && (bData.type === 'update' || bData.type === 'Forced Update' || bData.title === 'fixed')) {
                            batch.update(doc(db, 'broadcasts', bDoc.id), { isActive: false, updatedAt: serverTimestamp() });
                            hasBatch = true;
                        }
                    });
                    if (hasBatch) await batch.commit();
                    await addDoc(collection(db, 'broadcasts'), {
                        title: tAr || tEn,
                        message: mAr || mEn,
                        titleEn: tEn,
                        titleAr: tAr,
                        messageEn: mEn,
                        messageAr: mAr,
                        type: 'update',
                        targetAudience: 'all',
                        targetPlatform: 'android',
                        targetVersion: reqVer,
                        minBuildNumber: Number(s.forceUpdate.minBuildNumber || 0),
                        playStoreUrl: PLAY_STORE_URL,
                        forceClose: s.forceUpdate.updateMode !== 'flexible',
                        isActive: true,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    });
                } catch (err) {
                    console.warn('Auto-sync forceUpdate broadcast warning:', err);
                }
            }
        });
        const unsubTopups = subscribeToAllManualTopups((topups) => {
            setPendingManualPayments(topups.filter(t => t.status === ManualTopupStatus.AWAITING_CONFIRMATION).length);
        });
        const unsubTickets = subscribeToAllSupportTickets((tickets) => {
            setPendingSupportTickets(
                tickets.filter(t => t.status !== 'resolved' && t.status !== 'closed').length
            );
        });
        const unsubAdminChats = subscribeToAllAdminChats((chats) => {
            setPendingAdminChats(
                chats.filter(c => c.status !== 'resolved' && c.status !== 'closed').length
            );
        });
        const unsubFeatures = onSnapshot(doc(db, 'settings', 'features'), (docSnap) => {
            if (docSnap.exists()) {
                setAppPhoneAuthEnabled(docSnap.data().phoneAuthEnabled !== false);
            } else {
                setAppPhoneAuthEnabled(false);
            }
        }, (error) => { console.warn("Settings listener error", error); });

        return () => { unsubUsers(); unsubRides(); unsubSettings(); unsubTopups(); unsubTickets(); unsubAdminChats(); unsubFeatures(); };
    }, []);

    const handleTogglePhoneAuth = async () => {
        try {
            await setDoc(doc(db, 'settings', 'features'), { phoneAuthEnabled: !appPhoneAuthEnabled }, { merge: true });
        } catch (error) {
            console.error("Failed to toggle phone auth", error);
        }
    };

    const handleUpdatePricing = async () => {
        setIsLoading(true);
        try {
            await updatePricingSettings(pricingConfig);
            alert(isRTL ? "تم تحديث الأسعار بنجاح!" : "Pricing updated successfully!");
        } finally {
            setIsLoading(false);
        }
    };

    const currentPricingObj = selectedCity === 'default' 
        ? pricingConfig 
        : (pricingConfig.cities?.[selectedCity] || pricingConfig);

    const updatePricingField = (field: string, value: number | boolean) => {
        if (selectedCity === 'default') {
            setPricingConfig({ ...pricingConfig, [field]: value });
        } else {
            setPricingConfig({
                ...pricingConfig,
                cities: {
                    ...pricingConfig.cities,
                    [selectedCity]: {
                        ...currentPricingObj,
                        [field]: value
                    } as any
                }
            });
        }
    };

    const handleTogglePayments = async () => {
        const currentSettings = appSettings || {
            isPaymentsEnabled: false,
            promoBanner: {
                isEnabled: true,
                textEn: "Safe & Fast Rides",
                textAr: "رحلات آمنة وسريعة"
            },
            mapProvider: 'google' as const,
            mapboxPublicToken: '',
            isRewardsEnabled: true,
            rewardPointsPerTrip: 5,
            isInstaPayEnabled: false
        };
        
        const updated = { ...currentSettings, isPaymentsEnabled: !currentSettings.isPaymentsEnabled };
        setAppSettings(updated); // Optimistic update
        
        try {
            await updateAppSettings(updated);
        } catch (e) {
            console.error("Failed to update settings", e);
            setAppSettings(appSettings); // Revert on failure
            alert("Failed to update settings.");
        }
    };

    const handleToggleRewards = async () => {
        const currentSettings: AppSettings = appSettings || {
            isPaymentsEnabled: false,
            promoBanner: {
                isEnabled: true,
                textEn: "Safe & Fast Rides",
                textAr: "رحلات آمنة وسريعة"
            },
            mapProvider: 'google' as const,
            mapboxPublicToken: '',
            isRewardsEnabled: true,
            rewardPointsPerTrip: 5,
            rewardThresholdPoints: 50,
            rewardDiscountAmount: 20,
            isInstaPayEnabled: false
        };
        const nextEnabled = !(currentSettings.isRewardsEnabled !== false);
        const updated: AppSettings = {
            ...currentSettings,
            isRewardsEnabled: nextEnabled,
            rewardPointsPerTrip: Number(currentSettings.rewardPointsPerTrip ?? 5),
            rewardThresholdPoints: Number(currentSettings.rewardThresholdPoints ?? 50),
            rewardDiscountAmount: Number(currentSettings.rewardDiscountAmount ?? 20),
        };
        setAppSettings(updated);
        try {
            await updateAppSettings(updated);
        } catch (e) {
            if(String(e).includes('permission')) { console.log('Permission error caught:', e); } else { console.error(e); }
            setAppSettings(appSettings);
            alert(isRTL ? "فشل تحديث إعدادات المكافآت" : "Failed to update rewards setting");
        }
    };

    const handleToggleInstaPay = async () => {
        if (!appSettings) return;
        const updated = { ...appSettings, isInstaPayEnabled: !appSettings.isInstaPayEnabled };
        setAppSettings(updated);
        try {
            await updateAppSettings(updated);
        } catch (e) {
            if(String(e).includes('permission')) { console.log('Permission error caught:', e); } else { console.error(e); };
            setAppSettings(appSettings);
            alert("Failed to update InstaPay setting");
        }
    };

    const handleUpdateMapSettings = async (mapProvider: 'google' | 'mapbox', token: string = '') => {
        if (!appSettings) return;
        const updated = { 
            ...appSettings, 
            mapProvider, 
            mapboxPublicToken: token,
            forceReload: {
                timestamp: Date.now(),
                messageEn: "The administrator has updated the system settings (Map Configuration). Please refresh the app.",
                messageAr: "قام المسؤول بتحديث إعدادات النظام (إعدادات الخريطة). يرجى تحديث التطبيق."
            }
        };
        setAppSettings(updated);
        try {
            await updateAppSettings(updated);
            alert("Map settings updated and reload signal sent to all users");
        } catch (e) {
            if(String(e).includes('permission')) { console.log('Permission error caught:', e); } else { console.error(e); };
            setAppSettings(appSettings);
            alert("Failed to update map settings");
        }
    };

    const handleSeedData = async () => {
        if (!window.confirm("Are you sure you want to seed mock data? This will add users and rides to the database.")) return;
        setIsLoading(true);
        try {
            const { collection, doc, setDoc, addDoc, serverTimestamp } = await import('firebase/firestore');
            
            // Create Users (Passengers)
            const passengers = [
                { id: 'pax1', name: 'Ahmed Ali', phone: '+201000000001', role: 'passenger', walletBalance: 150, rewardPoints: 20, profileCompleted: true },
                { id: 'pax2', name: 'Sara Mohamed', phone: '+201000000002', role: 'passenger', walletBalance: 50, rewardPoints: 5, profileCompleted: true },
                { id: 'pax3', name: 'Omar Hassan', phone: '+201000000003', role: 'passenger', walletBalance: 0, rewardPoints: 0, profileCompleted: true },
            ];

            for (const pax of passengers) {
                await setDoc(doc(db, 'users', pax.id), {
                    ...pax,
                    createdAt: serverTimestamp()
                });
            }

            // Create Drivers
            const drivers = [
                { 
                    id: 'drv1', name: 'Mahmoud Sayed', phone: '+201000000004', role: 'driver', 
                    walletBalance: 300, rating: 4.8, profileCompleted: true, status: 'approved',
                    isOnline: true, vehicleBrand: 'Hyundai', vehicleModel: 'Elantra', vehicleYear: '2020',
                    vehicleColor: 'Silver', vehiclePlate: 'ABC 123', totalRides: 150, earnings: 4500, pendingFees: 450,
                    currentLocation: { lat: 30.0444, lng: 31.2357 } // Cairo
                },
                { 
                    id: 'drv2', name: 'Khaled Ibrahim', phone: '+201000000005', role: 'driver', 
                    walletBalance: 120, rating: 4.5, profileCompleted: true, status: 'approved',
                    isOnline: false, vehicleBrand: 'Nissan', vehicleModel: 'Sunny', vehicleYear: '2019',
                    vehicleColor: 'White', vehiclePlate: 'XYZ 789', totalRides: 80, earnings: 2400, pendingFees: 240,
                    currentLocation: { lat: 30.0500, lng: 31.2400 }
                },
                { 
                    id: 'drv3', name: 'Tarek Nabil', phone: '+201000000006', role: 'driver', 
                    walletBalance: 0, rating: 0, profileCompleted: true, status: 'pending',
                    isOnline: false, vehicleBrand: 'Chevrolet', vehicleModel: 'Optra', vehicleYear: '2022',
                    vehicleColor: 'Black', vehiclePlate: 'LMN 456', totalRides: 0, earnings: 0, pendingFees: 0
                },
            ];

            for (const drv of drivers) {
                await setDoc(doc(db, 'users', drv.id), {
                    ...drv,
                    createdAt: serverTimestamp()
                });
            }

            // Create Rides
            const rides = [
                {
                    passengerId: 'pax1', passengerName: 'Ahmed Ali', passengerPhone: '+201000000001',
                    driverId: 'drv1', status: 'completed', fare: 80, driverNet: 72, commission: 8,
                    pickup: { address: 'Tahrir Square, Cairo', lat: 30.0444, lng: 31.2357 },
                    dropoff: { address: 'Cairo Festival City, New Cairo', lat: 30.0276, lng: 31.4015 },
                    requestedVehicleType: 'STANDARD', paymentMethod: 'cash',
                    timestamp: Date.now() - 86400000 * 2 // 2 days ago
                },
                {
                    passengerId: 'pax2', passengerName: 'Sara Mohamed', passengerPhone: '+201000000002',
                    driverId: 'drv2', status: 'completed', fare: 120, driverNet: 108, commission: 12,
                    pickup: { address: 'Maadi, Cairo', lat: 29.9602, lng: 31.2569 },
                    dropoff: { address: 'Zamalek, Cairo', lat: 30.0626, lng: 31.2200 },
                    requestedVehicleType: 'COMFORT', paymentMethod: 'wallet',
                    timestamp: Date.now() - 86400000 // 1 day ago
                },
                {
                    passengerId: 'pax1', passengerName: 'Ahmed Ali', passengerPhone: '+201000000001',
                    driverId: null, status: 'searching', fare: 0,
                    pickup: { address: 'Dokki, Giza', lat: 30.0384, lng: 31.2114 },
                    dropoff: { address: 'Mohandeseen, Giza', lat: 30.0553, lng: 31.1989 },
                    requestedVehicleType: 'STANDARD', paymentMethod: 'cash',
                    timestamp: Date.now() // Now
                }
            ];

            for (const ride of rides) {
                await addDoc(collection(db, 'rides'), {
                    ...ride,
                    createdAt: serverTimestamp(),
                    completedAt: ride.status === 'completed' ? serverTimestamp() : null
                });
            }

            alert("Data seeded successfully!");
        } catch (e) {
            console.error("Failed to seed data", e);
            alert("Failed to seed data. Make sure you have permission.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendBroadcast = async () => {
        if (!notifTitle.trim() || !notifBody.trim()) {
            toast.error(isRTL ? "يرجى إدخال العنوان والنص" : "Please enter both title and body.");
            return;
        }
        setIsSendingNotif(true);
        try {
            const isUpdateMsg = /update|تحديث/i.test(notifTitle) || /update|تحديث/i.test(notifBody);
            await setDoc(doc(db, 'settings', 'app'), { broadcastsEnabled: true }, { merge: true }).catch(() => {});
            await addDoc(collection(db, 'broadcasts'), {
                title: notifTitle.trim(),
                message: notifBody.trim(),
                titleEn: notifTitle.trim(),
                titleAr: notifTitle.trim(),
                messageEn: notifBody.trim(),
                messageAr: notifBody.trim(),
                type: isUpdateMsg ? 'update' : 'alert',
                targetAudience: 'all',
                targetPlatform: 'android',
                playStoreUrl: PLAY_STORE_URL,
                forceClose: isUpdateMsg,
                isActive: true,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            }).catch(() => {});

            const result: any = await sendGlobalNotification(notifTitle, notifBody);
            const sentCount = result?.data?.sentCount ?? 0;
            toast.success(isRTL 
                ? `تم إرسال الرسالة المنبثقة والإشعار لأجهزة أندرويد! عدد الأجهزة: ${sentCount}` 
                : `In-app sheet & push sent to Android devices! Delivered count: ${sentCount}`);
            setNotifTitle('');
            setNotifBody('');
        } catch (e) {
            toast.error(isRTL ? "فشل إرسال الإشعار العام." : "Failed to send broadcast.");
        } finally {
            setIsSendingNotif(false);
        }
    };

    const handleDeleteRide = async (rideId: string) => {
        if (window.confirm(isRTL ? "هل أنت متأكد من حذف هذه الرحلة؟" : "Are you sure you want to delete this ride?")) {
            try {
                await deleteRide(rideId);
            } catch (e) {
                alert("Failed to delete ride");
            }
        }
    };

    const formatDate = (ts: any) => {
        if (!ts) return '---';
        const date = ts.toDate ? ts.toDate() : new Date(ts);
        return date.toLocaleDateString();
    };

    const getStatusColor = (status: RideStatus) => {
        switch (status) {
            case RideStatus.COMPLETED: return 'bg-green-100 text-green-700 border-green-200';
            case RideStatus.CANCELLED: return 'bg-red-100 text-red-700 border-red-200';
            case RideStatus.SEARCHING: return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case RideStatus.IN_PROGRESS: return 'bg-blue-100 text-blue-700 border-blue-200';
            case RideStatus.ACCEPTED: return 'bg-purple-100 text-purple-700 border-purple-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    return (
        <div className="h-screen w-full flex bg-[#F0F2F5] text-gray-800 overflow-hidden font-sans" dir={isRTL ? 'rtl' : 'ltr'}>
            {/* Sidebar */}
            <aside className={`fixed inset-y-0 z-50 w-72 bg-gray-900 text-white transform transition-transform md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : (isRTL ? 'translate-x-full' : '-translate-x-full')}`}>
                <div className="p-8 flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#FFC90E] rounded-xl flex items-center justify-center text-gray-900 shadow-lg shadow-yellow-500/20">
                        <i className="fas fa-shield-alt"></i>
                    </div>
                    <h1 className="text-2xl font-black tracking-tighter uppercase">Mowasla<span className="text-[#FFC90E]">.</span></h1>
                </div>
                
                <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto">
                    {[
                        { id: 'dashboard', label: t('dashboard'), icon: 'fa-th-large' },
                        { id: 'users_db', label: isRTL ? 'قاعدة بيانات المستخدمين' : 'Users Database', icon: 'fa-users-cog' },
                        { id: 'drivers', label: t('drivers'), icon: 'fa-user-tie' },
                        { id: 'passengers', label: t('passengers'), icon: 'fa-users' },
                        { id: 'rides', label: t('rides'), icon: 'fa-route' },
                        { id: 'scheduled_rides', label: isRTL ? 'الرحلات المجدولة' : 'Scheduled Rides', icon: 'fa-calendar-check' },
                        { id: 'fee_payments', label: isRTL ? 'تحصيل الرسوم' : 'Fee Payments', icon: 'fa-hand-holding-dollar' },
                        { id: 'manual_payments', label: t('menu_manual_payments'), icon: 'fa-money-check-alt' },
                        { id: 'rewards', label: isRTL ? 'إدارة المكافآت' : 'Reward Campaigns', icon: 'fa-gift' },
                        { id: 'support', label: isRTL ? 'الدعم والمحادثات' : 'Support & Chats', icon: 'fa-headset' },
                        { id: 'financials', label: t('financial_reports'), icon: 'fa-file-invoice-dollar' },
                        { id: 'pricing', label: t('fare'), icon: 'fa-tags' },
                        { id: 'notifications', label: t('notifications_label'), icon: 'fa-bell' },
                        { id: 'broadcasts', label: isRTL ? 'إعلانات وحالة النظام' : 'System & Broadcasts', icon: 'fa-broadcast-tower' },
                        { id: 'database', label: isRTL ? 'قاعدة البيانات' : 'Database Control', icon: 'fa-database' },
                        { id: 'settings', label: t('settings'), icon: 'fa-cog' }
                    ].map((item: any) => {
                        const supportBadgeCount = pendingSupportTickets + pendingAdminChats;
                        const activeScheduledPending = rides.filter(
                            (r) => r.isScheduled && ['SCHEDULED', 'SEARCHING_DRIVER'].includes(r.scheduleStatus || '')
                        ).length;
                        const badgeCount =
                            item.id === 'manual_payments'
                                ? pendingManualPayments
                                : item.id === 'support'
                                ? supportBadgeCount
                                : item.id === 'drivers'
                                ? stats.pendingApps
                                : item.id === 'users_db'
                                ? stats.totalUsers
                                : item.id === 'scheduled_rides'
                                ? activeScheduledPending
                                : 0;

                        return (
                        <button 
                            key={item.id} 
                            onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }} 
                            className={`w-full text-left px-4 py-3.5 rounded-xl capitalize flex items-center justify-between transition-all duration-200 group ${activeTab === item.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                        >
                            <div className="flex items-center gap-4">
                                <i className={`fas ${item.icon} w-5 text-center ${activeTab === item.id ? 'text-white' : 'group-hover:text-white'}`}></i>
                                <span className="font-bold text-sm tracking-wide">{item.label}</span>
                            </div>
                            {badgeCount > 0 && (
                                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center shadow-[0_0_8px_rgba(239,68,68,0.5)]">
                                    {badgeCount}
                                </span>
                            )}
                        </button>
                    )})}
                </nav>
                
                <div className="p-6 border-t border-white/5">
                    <div className="bg-white/5 rounded-2xl p-4 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-black text-xs">AD</div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-black truncate">Admin Console</p>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">WondersCo</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-hidden flex flex-col h-full relative">
                {/* Top Navbar */}
                <header className="px-8 h-20 bg-white border-b flex justify-between items-center sticky top-0 z-20 shadow-sm shrink-0">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                            <i className="fas fa-bars"></i>
                        </button>
                        <div className="hidden sm:block">
                            <h2 className="text-xl font-black capitalize tracking-tight text-gray-900">{activeTab}</h2>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] -mt-1">Management Console</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setActiveTab('support')}
                            className="flex items-center gap-2 bg-gray-50 hover:bg-blue-50 px-3.5 py-2 rounded-xl border border-gray-100 transition-colors"
                        >
                            <i className="fas fa-headset text-blue-600 text-xs"></i>
                            <span className="text-xs font-black text-gray-700">
                                {isRTL ? 'خدمة العملاء' : 'Support'}
                            </span>
                            {(pendingSupportTickets + pendingAdminChats) > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-black animate-pulse">
                                    {pendingSupportTickets + pendingAdminChats}
                                </span>
                            )}
                        </button>
                        <div className="hidden lg:flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">System Online</span>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-8 bg-[#F8FAFC]">
                    {activeTab === 'dashboard' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <StatCard label="Total Revenue" value={`EGP ${stats.totalRevenue}`} icon="fa-money-bill-wave" color="bg-green-500" />
                                <StatCard label="Platform Fees" value={`EGP ${stats.platformFees}`} icon="fa-chart-pie" color="bg-blue-500" />
                                <StatCard label="Online Drivers" value={stats.onlineDrivers.toString()} icon="fa-toggle-on" color="bg-yellow-500" />
                                <StatCard 
                                    label={isRTL ? "طلبات التسجيل المعلقة" : "Pending Applications"} 
                                    value={stats.pendingApps.toString()} 
                                    icon="fa-id-card" 
                                    color="bg-red-500" 
                                    onClick={() => { setDriverFilter('pending'); setActiveTab('drivers'); }}
                                    highlight={stats.pendingApps > 0}
                                    badge={stats.pendingApps > 0 ? `${stats.pendingApps} ${isRTL ? 'معلق' : 'Pending'}` : undefined}
                                />
                            </div>

                            {/* DATABASE CONNECTION & CONTROL SECTION ON DASHBOARD */}
                            <DatabaseAdminView 
                                isRTL={isRTL} 
                                compact 
                                onOpenFull={() => setActiveTab('database')} 
                            />

                            {/* PENDING DRIVERS & DOCUMENTS SECTION ON DASHBOARD */}
                            <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 space-y-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-50 pb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center text-xl shadow-sm">
                                            <i className="fas fa-id-card-clip"></i>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-xl font-black text-gray-900 tracking-tight">
                                                    {isRTL ? "طلبات تسجيل السائقين ومراجعة الوثائق" : "Driver Registration & Document Verification"}
                                                </h3>
                                                {drivers.filter(isPendingDriver).length > 0 && (
                                                    <span className="px-2.5 py-0.5 bg-red-500 text-white text-xs font-black rounded-full animate-pulse">
                                                        {drivers.filter(isPendingDriver).length} {isRTL ? "جديد" : "New"}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs font-bold text-gray-400 mt-0.5">
                                                {isRTL 
                                                    ? "مراجعة واعتماد رخص القيادة، البطاقات، رخص المركبات، والصور الشخصية للسائقين الجدد" 
                                                    : "Review and approve driver licenses, national IDs, vehicle registrations, and photos"}
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        onClick={() => { setDriverFilter('pending'); setActiveTab('drivers'); }}
                                        variant="secondary"
                                        className="h-10 text-xs font-black rounded-xl"
                                    >
                                        <i className="fas fa-list-check me-2"></i>
                                        {isRTL ? "عرض كل السائقين" : "View All Drivers"}
                                    </Button>
                                </div>

                                {drivers.filter(isPendingDriver).length === 0 ? (
                                    <div className="text-center py-12 px-4 rounded-2xl bg-gray-50/60 border border-dashed border-gray-200">
                                        <div className="w-16 h-16 mx-auto bg-green-50 text-green-600 rounded-2xl flex items-center justify-center text-2xl mb-3">
                                            <i className="fas fa-check-double"></i>
                                        </div>
                                        <h4 className="font-black text-gray-900 text-base">
                                            {isRTL ? "لا توجد طلبات سائقين معلقة" : "All Driver Applications Reviewed"}
                                        </h4>
                                        <p className="text-xs text-gray-400 font-medium max-w-sm mx-auto mt-1">
                                            {isRTL 
                                                ? "تمت مراجعة واعتماد جميع مستندات السائقين. ستظهر أي طلبات تسجيل جديدة فور إرسالها هنا." 
                                                : "All driver documents and verification requests are up to date. New submissions will appear here instantly."}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        {drivers.filter(isPendingDriver).slice(0, 6).map((driver) => {
                                            const docSummary = getDriverDocsSummary(driver);
                                            return (
                                                <div 
                                                    key={driver.id} 
                                                    className="p-6 rounded-2xl bg-gray-50/70 border border-gray-200/80 hover:border-amber-400/80 hover:bg-white hover:shadow-lg transition-all flex flex-col justify-between gap-5 relative group"
                                                >
                                                    {/* Header: Driver Info & Photo */}
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className="relative">
                                                                <img 
                                                                    src={driver.avatar || driver.personalPhotoUrl || `https://ui-avatars.com/api/?name=${driver.name}&background=FFC90E&color=000`} 
                                                                    alt={driver.name} 
                                                                    className="w-14 h-14 rounded-2xl object-cover border-2 border-white shadow-md" 
                                                                />
                                                                <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-500 border-2 border-white"></span>
                                                            </div>
                                                            <div className="min-w-0">
                                                                <h4 className="font-black text-base text-gray-900 truncate flex items-center gap-2">
                                                                    {driver.name}
                                                                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold">
                                                                        {isRTL ? "قيد المراجعة" : "Pending"}
                                                                    </span>
                                                                </h4>
                                                                <p className="text-xs font-mono font-bold text-gray-500 mt-0.5" dir="ltr">
                                                                    <i className="fas fa-phone-alt text-[10px] text-gray-400 me-1"></i>
                                                                    {driver.phone}
                                                                </p>
                                                                <p className="text-[11px] text-gray-400 font-medium">
                                                                    {(driver as any).submittedAt ? new Date((driver as any).submittedAt).toLocaleString() : 'Recently submitted'}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* Vehicle Badge */}
                                                        <div className="text-right rtl:text-left shrink-0">
                                                            <span className="inline-block px-3 py-1 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 shadow-sm">
                                                                <i className="fas fa-car text-blue-500 me-1.5"></i>
                                                                {driver.vehicleBrand} {driver.vehicleModel || ''}
                                                            </span>
                                                            {driver.vehiclePlate && (
                                                                <div className="text-[10px] font-mono font-black text-gray-400 mt-1">
                                                                    {driver.vehiclePlate}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Documents Checklist Chips */}
                                                    <div className="bg-white p-3.5 rounded-xl border border-gray-100">
                                                        <div className="flex items-center justify-between text-xs mb-2.5">
                                                            <span className="font-black text-gray-700 flex items-center gap-1.5">
                                                                <i className="fas fa-folder-closed text-amber-500"></i>
                                                                {isRTL ? "المستندات المستلمة:" : "Received Documents:"}
                                                            </span>
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                                                docSummary.uploadedCount >= 6 
                                                                    ? 'bg-emerald-100 text-emerald-800' 
                                                                    : 'bg-amber-100 text-amber-800'
                                                            }`}>
                                                                {docSummary.uploadedCount} / {docSummary.totalCount} {isRTL ? "مستندات" : "docs"}
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {docSummary.docs.map(doc => (
                                                                <span 
                                                                    key={doc.key} 
                                                                    className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 ${
                                                                        doc.url 
                                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                                                            : 'bg-red-50 text-red-500 border border-red-100/60 opacity-60'
                                                                    }`}
                                                                >
                                                                    <i className={`fas ${doc.url ? 'fa-check text-emerald-500' : 'fa-times text-red-400'} text-[8px]`}></i>
                                                                    {isRTL ? doc.labelAr : doc.label}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex items-center gap-2 pt-1">
                                                        <button
                                                            onClick={() => { setSelectedDriver(driver); setIsDocModalOpen(true); }}
                                                            className="flex-1 h-10 px-4 bg-gray-900 hover:bg-blue-600 text-white rounded-xl text-xs font-black transition-all shadow-sm flex items-center justify-center gap-2"
                                                        >
                                                            <i className="fas fa-eye text-xs"></i>
                                                            {isRTL ? "فحص الوثائق كاملة" : "Review Documents"}
                                                        </button>
                                                        <button
                                                            onClick={() => handleQuickReject(driver.id)}
                                                            disabled={actionInProgressId === driver.id}
                                                            className="h-10 px-3.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-black transition-all"
                                                            title={isRTL ? "رفض الطلب" : "Reject"}
                                                        >
                                                            <i className="fas fa-times"></i>
                                                        </button>
                                                        <button
                                                            onClick={() => handleQuickApprove(driver.id)}
                                                            disabled={actionInProgressId === driver.id}
                                                            className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-sm flex items-center gap-1.5"
                                                        >
                                                            <i className="fas fa-check"></i>
                                                            {isRTL ? "قبول" : "Approve"}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-2 space-y-6">
                                    <h3 className="text-lg font-black text-gray-900">Recent Live Trips</h3>
                                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                                        <table className="w-full text-left rtl:text-right">
                                            <thead className="bg-gray-50/50 border-b border-gray-100">
                                                <tr>
                                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Passenger</th>
                                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Pickup</th>
                                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Fare</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {rides.slice(0, 8).map(ride => (
                                                    <tr key={ride.id} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-tighter ${
                                                                ride.status === RideStatus.COMPLETED ? 'bg-green-100 text-green-700' :
                                                                ride.status === RideStatus.CANCELLED ? 'bg-red-100 text-red-700' :
                                                                'bg-blue-100 text-blue-700'
                                                            }`}>
                                                                {ride.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm font-bold text-gray-800">
                                                            <div className="flex flex-col gap-0.5">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span>{ride.bookedBy?.name || ride.passengerName || 'Unknown'}</span>
                                                                    {ride.bookingType === 'FOR_OTHER' && (
                                                                        <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[9px] font-black">
                                                                            {t('for_other_badge')}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {ride.bookingType === 'FOR_OTHER' && ride.actualPassenger && (
                                                                    <span className="text-[11px] font-bold text-blue-700">
                                                                        {t('actual_passenger')}: {ride.actualPassenger.name} ({ride.actualPassenger.phone})
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-xs font-medium text-gray-500 max-w-[200px] truncate">{ride.pickup.address}</td>
                                                        <td className="px-6 py-4 text-sm font-black text-gray-900">{ride.fare} EGP</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                
                                <div className="space-y-6">
                                    <h3 className="text-lg font-black text-gray-900">System Metrics</h3>
                                    <div className="bg-gray-900 rounded-[32px] p-8 text-white relative overflow-hidden">
                                        <div className="relative z-10">
                                            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Users</div>
                                            <div className="text-4xl font-black mb-6">{stats.totalUsers}</div>
                                            <div className="space-y-4">
                                                <MetricBar label="Captains" value={drivers.length} max={stats.totalUsers} color="bg-[#FFC90E]" />
                                                <MetricBar label="Passengers" value={passengers.length} max={stats.totalUsers} color="bg-blue-500" />
                                            </div>
                                        </div>
                                        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {activeTab === 'manual_payments' && <ManualPaymentsView />}
                    
                    {activeTab === 'support' && <SupportAdminView />}

                    {activeTab === 'rewards' && <RewardCampaignsAdminView />}

                    {activeTab === 'fee_payments' && <FeePaymentsView drivers={drivers} onApprove={async (id) => {
                        await approveDriverFees(id);
                    }} onOpenChat={async (id, name) => {
                        const ticketId = await getOrCreateAdminSupportTicket(id, name);
                        setActiveTicketId(ticketId);
                        setIsChatModalOpen(true);
                    }} />}

                    {activeTab === 'rides' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="bg-white rounded-[32px] p-5 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        onClick={() => setRideBookingTypeFilter('ALL')}
                                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                                            rideBookingTypeFilter === 'ALL'
                                                ? 'bg-gray-900 text-white shadow-md'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        {isRTL ? 'جميع الرحلات' : 'All Bookings'} ({rides.length})
                                    </button>
                                    <button
                                        onClick={() => setRideBookingTypeFilter('SELF')}
                                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                                            rideBookingTypeFilter === 'SELF'
                                                ? 'bg-[#FFC90E] text-gray-900 shadow-md'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        {t('book_for_myself')} ({rides.filter(r => (r.bookingType || 'SELF') === 'SELF').length})
                                    </button>
                                    <button
                                        onClick={() => setRideBookingTypeFilter('FOR_OTHER')}
                                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                                            rideBookingTypeFilter === 'FOR_OTHER'
                                                ? 'bg-blue-600 text-white shadow-md'
                                                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                        }`}
                                    >
                                        <i className="fas fa-user-friends text-[10px]"></i>
                                        <span>{t('for_other_badge')} ({rides.filter(r => r.bookingType === 'FOR_OTHER').length})</span>
                                    </button>
                                </div>
                                <div className="relative w-full md:w-80">
                                    <i className={`fas fa-search absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-4' : 'left-4'} text-gray-400 text-xs`}></i>
                                    <input
                                        type="text"
                                        value={rideSearchQuery}
                                        onChange={(e) => setRideSearchQuery(e.target.value)}
                                        placeholder={
                                            isRTL
                                                ? 'ابحث بصاحب الحجز أو الراكب الفعلي أو الموبايل...'
                                                : 'Search by booking owner or actual passenger...'
                                        }
                                        className={`w-full py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:border-blue-500 ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'}`}
                                    />
                                </div>
                            </div>

                            <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
                                <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
                                    <h3 className="font-black text-gray-900 uppercase text-xs tracking-widest">Live Operations Registry</h3>
                                    <div className="flex gap-2">
                                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-black uppercase">
                                            {rides.filter(r => ![RideStatus.COMPLETED, RideStatus.CANCELLED, RideStatus.EXPIRED].includes(r.status)).length} Active
                                        </span>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left rtl:text-right">
                                        <thead className="bg-gray-50/50">
                                            <tr>
                                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Time / ID</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Parties</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Route</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Details</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {rides
                                                .filter(ride => {
                                                    const effectiveType = ride.bookingType === 'FOR_OTHER' ? 'FOR_OTHER' : 'SELF';
                                                    if (rideBookingTypeFilter !== 'ALL' && effectiveType !== rideBookingTypeFilter) {
                                                        return false;
                                                    }
                                                    const q = rideSearchQuery.trim().toLowerCase();
                                                    if (!q) return true;
                                                    const ownerName = (ride.bookedBy?.name || ride.passengerName || '').toLowerCase();
                                                    const ownerPhone = (ride.bookedBy?.phone || '').toLowerCase();
                                                    const actualName = (ride.actualPassenger?.name || '').toLowerCase();
                                                    const actualPhone = (ride.actualPassenger?.phone || '').toLowerCase();
                                                    const rideIdStr = (ride.id || '').toLowerCase();
                                                    return (
                                                        ownerName.includes(q) ||
                                                        ownerPhone.includes(q) ||
                                                        actualName.includes(q) ||
                                                        actualPhone.includes(q) ||
                                                        rideIdStr.includes(q)
                                                    );
                                                })
                                                .map(ride => (
                                                <tr key={ride.id} className="hover:bg-gray-50/50 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="text-xs font-black text-gray-900">{new Date(ride.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                                        <div className="text-[10px] font-mono text-gray-400">#{ride.id.slice(-8)}</div>
                                                        {ride.bookingType === 'FOR_OTHER' && (
                                                            <span className="mt-1 inline-block px-2 py-0.5 rounded-full bg-blue-600 text-white text-[9px] font-black">
                                                                {t('for_other_badge')}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-1">
                                                                <i className="fas fa-user text-[10px] text-blue-500"></i>
                                                                <span className="text-xs font-black text-gray-500">{t('booking_owner')}:</span>
                                                                <span className="text-sm font-bold text-gray-800">{ride.bookedBy?.name || ride.passengerName || 'N/A'}</span>
                                                                {ride.bookedBy?.phone && (
                                                                    <span className="text-[10px] font-mono text-gray-400" dir="ltr">({ride.bookedBy.phone})</span>
                                                                )}
                                                            </div>
                                                            {ride.bookingType === 'FOR_OTHER' && ride.actualPassenger && (
                                                                <div className="p-1.5 rounded-lg bg-blue-50 border border-blue-100 text-[11px]">
                                                                    <div className="font-black text-blue-900">
                                                                        {t('actual_passenger')}: {ride.actualPassenger.name}{' '}
                                                                        <span className="font-mono text-blue-700" dir="ltr">({ride.actualPassenger.phone})</span>
                                                                    </div>
                                                                    {ride.actualPassenger.note && (
                                                                        <div className="text-[10px] font-bold text-gray-600">
                                                                            {t('driver_notes')}: {ride.actualPassenger.note}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {ride.driverId && (
                                                                <div className="flex items-center gap-1">
                                                                    <i className="fas fa-user-tie text-[10px] text-green-500"></i>
                                                                    <span className="text-xs font-medium text-gray-500">{drivers.find(d => d.id === ride.driverId)?.name || 'Driver'}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 max-w-[200px]">
                                                        <div className="text-[10px] font-bold text-gray-400 truncate">From: {ride.pickup.address}</div>
                                                        <div className="text-[10px] font-bold text-gray-900 truncate mt-1">To: {ride.dropoff.address}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="text-sm font-black text-gray-900">{ride.fare} {t('currency')}</div>
                                                        <div className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">{ride.requestedVehicleType} • {ride.paymentMethod}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-tighter shadow-sm border ${getStatusColor(ride.status)}`}>
                                                            {ride.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <button 
                                                            onClick={() => handleDeleteRide(ride.id)}
                                                            className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all active:scale-90"
                                                        >
                                                            <i className="fas fa-trash-alt text-xs"></i>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'drivers' && (
                        <div className="space-y-6 animate-fade-in">
                            {/* Filter Bar & Search */}
                            <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        onClick={() => setDriverFilter('all')}
                                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                                            driverFilter === 'all' 
                                                ? 'bg-gray-900 text-white shadow-md' 
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        {isRTL ? "جميع السائقين" : "All Drivers"} ({drivers.length})
                                    </button>
                                    <button
                                        onClick={() => setDriverFilter('pending')}
                                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                                            driverFilter === 'pending' 
                                                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20' 
                                                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                                        }`}
                                    >
                                        <i className="fas fa-clock text-xs"></i>
                                        {isRTL ? "طلبات قيد المراجعة" : "Pending Documents"} 
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] ${driverFilter === 'pending' ? 'bg-white text-amber-700' : 'bg-amber-200 text-amber-900'}`}>
                                            {stats.pendingApps}
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => setDriverFilter('active')}
                                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                                            driverFilter === 'active' 
                                                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' 
                                                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                        }`}
                                    >
                                        {isRTL ? "المعتمدين والمفعلين" : "Active / Approved"} ({drivers.filter(d => d.status === 'approved' && !d.isBanned).length})
                                    </button>
                                    <button
                                        onClick={() => setDriverFilter('banned')}
                                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                                            driverFilter === 'banned' 
                                                ? 'bg-red-600 text-white shadow-md shadow-red-600/20' 
                                                : 'bg-red-50 text-red-800 hover:bg-red-100'
                                        }`}
                                    >
                                        {isRTL ? "المحظورين / الموقوفين" : "Banned / Suspended"} ({drivers.filter(d => d.isBanned || (d.suspendedUntil ?? 0) > Date.now()).length})
                                    </button>
                                </div>

                                <div className="relative min-w-[240px]">
                                    <i className="fas fa-search absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                                    <input
                                        type="text"
                                        value={driverSearch}
                                        onChange={(e) => setDriverSearch(e.target.value)}
                                        placeholder={isRTL ? "بحث بالاسم، الهاتف، أو اللوحة..." : "Search name, phone, or plate..."}
                                        className="w-full pl-9 pr-4 rtl:pl-4 rtl:pr-9 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 placeholder-gray-400 outline-none focus:border-blue-500 focus:bg-white transition-all"
                                    />
                                    {driverSearch && (
                                        <button onClick={() => setDriverSearch('')} className="absolute right-3 rtl:right-auto rtl:left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">
                                            <i className="fas fa-times"></i>
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
                                <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
                                    <h3 className="font-black text-gray-900 uppercase text-xs tracking-widest">
                                        {isRTL ? "سجل السائقين والوثائق" : "Driver Registry & Documents"}
                                    </h3>
                                    <div className="flex gap-2">
                                        <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-[10px] font-black uppercase">{stats.pendingApps} Pending</span>
                                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-black uppercase">{drivers.length - stats.pendingApps} Active</span>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left rtl:text-right">
                                        <thead className="bg-gray-50/50">
                                            <tr>
                                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">{isRTL ? "السائق" : "Captain"}</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">{isRTL ? "الحالة" : "Status"}</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">{isRTL ? "الوثائق المرفوعة" : "Uploaded Docs"}</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">{isRTL ? "المركبة" : "Vehicle"}</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">{isRTL ? "إجراءات" : "Actions"}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {drivers.filter(d => {
                                                if (driverFilter === 'pending' && !isPendingDriver(d)) return false;
                                                if (driverFilter === 'active' && (d.status !== 'approved' || d.isBanned)) return false;
                                                if (driverFilter === 'banned' && (!d.isBanned && (d.suspendedUntil ?? 0) <= Date.now())) return false;
                                                if (driverSearch.trim()) {
                                                    const q = driverSearch.toLowerCase();
                                                    const matchesName = (d.name || '').toLowerCase().includes(q);
                                                    const matchesPhone = (d.phone || '').toLowerCase().includes(q);
                                                    const matchesPlate = (d.vehiclePlate || '').toLowerCase().includes(q);
                                                    const matchesBrand = (d.vehicleBrand || '').toLowerCase().includes(q);
                                                    if (!matchesName && !matchesPhone && !matchesPlate && !matchesBrand) return false;
                                                }
                                                return true;
                                            }).map(d => {
                                                const docSummary = getDriverDocsSummary(d);
                                                const isPending = isPendingDriver(d);
                                                return (
                                                    <tr key={d.id} className="hover:bg-gray-50/50 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-4">
                                                                <div className="relative">
                                                                    <img src={d.avatar || d.personalPhotoUrl || `https://ui-avatars.com/api/?name=${d.name}&background=random`} className="w-11 h-11 rounded-2xl object-cover shadow-sm border border-gray-100" />
                                                                    {d.isOnline && (
                                                                        <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white"></span>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <div className="font-black text-sm text-gray-900 flex items-center gap-2">
                                                                        {d.name}
                                                                        {isPending && (
                                                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-800">
                                                                                {isRTL ? "مطلوب المراجعة" : "Needs Review"}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter" dir="ltr">{d.phone}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col gap-1 items-start">
                                                                <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-tighter shadow-sm border ${
                                                                    d.status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' : 
                                                                    d.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' : 
                                                                    'bg-amber-50 text-amber-700 border-amber-200'
                                                                }`}>
                                                                    {d.status || 'Pending'}
                                                                </span>
                                                                {d.isBanned && (
                                                                    <span className="px-2 py-0.5 bg-red-600 text-white rounded-md text-[9px] font-black uppercase tracking-tighter">Banned</span>
                                                                )}
                                                                {(d.suspendedUntil ?? 0) > Date.now() && (
                                                                    <span className="px-2 py-0.5 bg-orange-500 text-white rounded-md text-[9px] font-black uppercase tracking-tighter">Suspended</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`px-2.5 py-1 rounded-lg text-xs font-black flex items-center gap-1.5 ${
                                                                    docSummary.uploadedCount >= 6 
                                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                                                        : docSummary.uploadedCount > 0 
                                                                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                                            : 'bg-gray-100 text-gray-400'
                                                                }`}>
                                                                    <i className="fas fa-folder-closed text-xs"></i>
                                                                    {docSummary.uploadedCount} / {docSummary.totalCount} {isRTL ? "مستندات" : "docs"}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="text-xs font-bold text-gray-700">{d.vehicleBrand || '—'} {d.vehicleModel || ''}</div>
                                                            <div className="text-[10px] font-black text-gray-400 font-mono tracking-widest">{d.vehiclePlate || '—'}</div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <button 
                                                                    onClick={() => { setSelectedDriver(d); setIsDocModalOpen(true); }}
                                                                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 active:scale-95 ${
                                                                        isPending 
                                                                            ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20' 
                                                                            : 'bg-gray-900 text-white hover:bg-blue-600'
                                                                    }`}
                                                                >
                                                                    <i className="fas fa-file-shield text-xs"></i>
                                                                    {isPending ? (isRTL ? "فحص الوثائق" : "Review Docs") : (isRTL ? "إدارة" : "Manage")}
                                                                </button>
                                                                <button
                                                                    onClick={async () => {
                                                                        if (!window.confirm(isRTL ? `هل أنت متأكد من الحذف النهائي الكامل لحساب السائق (${d.name}) وجميع بياناته من قاعدة البيانات والمصادقة؟` : `Permanently delete driver (${d.name}) Auth & all database records?`)) return;
                                                                        setActionInProgressId(d.id);
                                                                        try {
                                                                            await adminPurgeUserCompletely(d.id, { purgeRelatedRecords: true });
                                                                        } catch (err: any) {
                                                                            console.error(err);
                                                                        } finally {
                                                                            setActionInProgressId(null);
                                                                        }
                                                                    }}
                                                                    disabled={actionInProgressId === d.id}
                                                                    title={isRTL ? "حذف الحساب والبيانات نهائياً" : "Total Delete User Auth & Data"}
                                                                    className="px-3 py-2 rounded-xl text-xs font-black bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200 transition-all flex items-center gap-1.5 active:scale-95"
                                                                >
                                                                    <i className="fas fa-user-slash text-xs"></i>
                                                                    {isRTL ? "حذف نهائي" : "Purge"}
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'passengers' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
                                <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
                                    <div className="flex items-center gap-3">
                                        <h3 className="font-black text-gray-900 uppercase text-xs tracking-widest">Passenger Registry</h3>
                                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-black uppercase">{passengers.length} Registered</span>
                                    </div>
                                    <button
                                        onClick={() => setActiveTab('users_db')}
                                        className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-blue-600 text-white text-xs font-black flex items-center gap-2 transition-colors"
                                    >
                                        <i className="fas fa-users-cog"></i>
                                        {isRTL ? "قاعدة بيانات المستخدمين الكاملة" : "Full Users Database & Purge"}
                                    </button>
                                </div>
                                <table className="w-full text-left rtl:text-right">
                                    <thead className="bg-gray-50/50">
                                        <tr>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">User</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Phone</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Join Date</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Balance</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">{isRTL ? "النقاط (مركز المكافآت)" : "Reward Points"}</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">{isRTL ? "إجراءات" : "Actions"}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {passengers.map(u => (
                                            <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-4">
                                                        <img src={u.avatar || `https://ui-avatars.com/api/?name=${u.name}&background=random`} className="w-10 h-10 rounded-full border border-gray-100" />
                                                        <div>
                                                            <span className="font-black text-sm text-gray-900 block">{u.name}</span>
                                                            <span className="font-mono text-[10px] text-gray-400">{u.id}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-xs font-bold text-gray-600 font-mono" dir="ltr">{u.phone}</td>
                                                <td className="px-6 py-4 text-xs font-medium text-gray-400">{formatDate(u.createdAt)}</td>
                                                <td className="px-6 py-4 text-sm font-black text-gray-900">{u.walletBalance || 0} EGP</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="px-2.5 py-1 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-900 font-black text-xs flex items-center gap-1.5">
                                                            <i className="fas fa-gift text-[#FFC90E]"></i>
                                                            {u.rewardPoints || 0}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                const raw = window.prompt(
                                                                    isRTL
                                                                        ? `تعديل رصيد النقاط للراكب (${u.name}):`
                                                                        : `Set reward points for (${u.name}):`,
                                                                    String(u.rewardPoints || 0)
                                                                );
                                                                if (raw === null) return;
                                                                const nextPts = Math.max(0, Number(raw) || 0);
                                                                try {
                                                                    await updateUserProfile(u.id, { rewardPoints: nextPts });
                                                                } catch (err) {
                                                                    console.error(err);
                                                                }
                                                            }}
                                                            className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-[#FFC90E] text-gray-600 hover:text-black flex items-center justify-center text-xs transition-colors"
                                                            title={isRTL ? "تعديل النقاط" : "Edit Points"}
                                                        >
                                                            <i className="fas fa-pen text-[10px]"></i>
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <button
                                                        onClick={async () => {
                                                            if (!window.confirm(isRTL ? `هل أنت متأكد من الحذف النهائي الكامل لحساب الراكب (${u.name}) وجميع بياناته من قاعدة البيانات والمصادقة؟` : `Permanently delete user (${u.name}) Auth & all database records?`)) return;
                                                            setActionInProgressId(u.id);
                                                            try {
                                                                await adminPurgeUserCompletely(u.id, { purgeRelatedRecords: true });
                                                            } catch (err) {
                                                                console.error(err);
                                                            } finally {
                                                                setActionInProgressId(null);
                                                            }
                                                        }}
                                                        disabled={actionInProgressId === u.id}
                                                        className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200 text-xs font-black transition-all flex items-center gap-1.5"
                                                    >
                                                        <i className="fas fa-user-slash text-[11px]"></i>
                                                        {isRTL ? "حذف الحساب والبيانات نهائياً" : "Total Delete Auth & Data"}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'pricing' && (
                        <div className="max-w-4xl animate-fade-in">
                            <div className="bg-white p-10 rounded-[40px] shadow-sm border border-gray-100 space-y-8 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-8 opacity-5"><i className="fas fa-tags text-9xl"></i></div>
                                
                                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <h3 className="text-2xl font-black text-gray-900 mb-2">{isRTL ? "استراتيجية التسعير" : "Pricing Strategy"}</h3>
                                        <p className="text-gray-400 font-medium text-sm">{isRTL ? "تحديث الأسعار الأساسية الافتراضية أو لمدينة معينة." : "Update the base fares globally or for a specific city."}</p>
                                    </div>
                                    <select 
                                        value={selectedCity} 
                                        onChange={(e) => setSelectedCity(e.target.value)}
                                        className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block p-3 font-bold cursor-pointer"
                                    >
                                        <option value="default">{isRTL ? "الافتراضي (كل المدن)" : "Default (All Cities)"}</option>
                                        {EGYPT_CITIES.map(city => (
                                            <option key={city} value={city}>{city}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10 border-b border-gray-50 pb-8">
                                    <PricingInput label={isRTL ? "بداية العداد" : "Base Fare"} value={currentPricingObj.baseFare} onChange={(v: any) => updatePricingField('baseFare', v)} prefix={isRTL ? "ج.م" : "EGP"} />
                                    <PricingInput label={isRTL ? "السعر لكل كم" : "Price / KM"} value={currentPricingObj.pricePerKm} onChange={(v: any) => updatePricingField('pricePerKm', v)} highlighted prefix={isRTL ? "ج.م" : "EGP"} />
                                    <PricingInput label={isRTL ? "السعر لكل دقيقة" : "Price / Min"} value={currentPricingObj.pricePerMinute} onChange={(v: any) => updatePricingField('pricePerMinute', v)} prefix={isRTL ? "ج.م" : "EGP"} />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10 border-b border-gray-50 pb-8">
                                    <PricingInput label={isRTL ? "الحد الأدنى للأجرة" : "Minimum Fare"} value={currentPricingObj.minimumFare} onChange={(v: any) => updatePricingField('minimumFare', v)} prefix={isRTL ? "ج.م" : "EGP"} />
                                    <PricingInput label={isRTL ? "رسوم المطار الإضافية" : "Airport Extra Fee"} value={currentPricingObj.airportFee || 0} onChange={(v: any) => updatePricingField('airportFee', v)} prefix={isRTL ? "ج.م" : "EGP"} />
                                    <PricingInput label={isRTL ? "نسبة العمولة" : "Driver Commission %"} value={currentPricingObj.driverCommissionPercent || 10} onChange={(v: any) => updatePricingField('driverCommissionPercent', v)} prefix="%" />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10 border-b border-gray-50 pb-8">
                                    <PricingInput label={isRTL ? "تعزيز السعر التلقائي %" : "Auto Boost %"} value={currentPricingObj.autoBoostPercent || 5} onChange={(v: any) => updatePricingField('autoBoostPercent', v)} prefix="%" />
                                    <PricingInput label={isRTL ? "أقصى تعزيز %" : "Max Boost %"} value={currentPricingObj.maxAutoBoostPercent || 40} onChange={(v: any) => updatePricingField('maxAutoBoostPercent', v)} prefix="%" />
                                    <PricingInput label={isRTL ? "التعزيز الذكي (الذروة)" : "Surge Multiplier"} value={currentPricingObj.surgeMultiplier || 1.0} onChange={(v: any) => updatePricingField('surgeMultiplier', v)} prefix="x" />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10 border-b border-gray-50 pb-8">
                                    <PricingInput label={isRTL ? "مهلة قبول العرض (ثواني)" : "Offer Expiry (Sec)"} value={currentPricingObj.offerExpirationSeconds || 12} onChange={(v: any) => updatePricingField('offerExpirationSeconds', v)} prefix="s" />
                                </div>

                                <div className="flex items-center gap-4 relative z-10 border-b border-gray-50 pb-8">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input type="checkbox" checked={currentPricingObj.surgeEnabled || false} onChange={e => updatePricingField('surgeEnabled', e.target.checked)} className="form-checkbox h-5 w-5 text-blue-600 rounded" />
                                        <span className="text-sm font-bold text-gray-700">{isRTL ? "تفعيل وقت الذروة (Surge)" : "Enable Surge Pricing"}</span>
                                    </label>
                                </div>

                                <div className="pt-6 border-t border-gray-50 relative z-10">
                                    <Button onClick={handleUpdatePricing} isLoading={isLoading} className="w-full h-16 bg-[#FFC90E] text-gray-900 rounded-2xl text-lg font-black shadow-xl shadow-yellow-200">
                                        {isRTL ? "تحديث إعدادات التسعير" : "Update Pricing Config"}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'financials' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
                                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Gross Volume</div>
                                    <div className="text-3xl font-black text-gray-900">EGP {stats.totalRevenue.toLocaleString()}</div>
                                    <div className="mt-4 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg w-fit">+12% from last month</div>
                                </div>
                                <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
                                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Platform Revenue (Fees)</div>
                                    <div className="text-3xl font-black text-blue-600">EGP {stats.platformFees.toLocaleString()}</div>
                                    <div className="mt-4 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg w-fit">10% Average Margin</div>
                                </div>
                                <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
                                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Completed Transactions</div>
                                    <div className="text-3xl font-black text-gray-900">{stats.completedRides}</div>
                                    <div className="mt-4 text-xs font-bold text-gray-400">Avg {stats.completedRides > 0 ? (stats.totalRevenue / stats.completedRides).toFixed(0) : 0} EGP / Ride</div>
                                </div>
                            </div>

                            <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
                                <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
                                    <h3 className="font-black text-gray-900 uppercase text-xs tracking-widest">Revenue Ledger</h3>
                                </div>
                                <table className="w-full text-left rtl:text-right">
                                    <thead className="bg-gray-50/50">
                                        <tr>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Ride ID</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Driver</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Gross</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">App Fee</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Driver Net</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {rides.filter(r => r.status === RideStatus.COMPLETED).map(ride => {
                                            const comm = ride.commission || (ride.fare * DEFAULT_COMMISSION_RATE);
                                            const net = ride.driverNet || (ride.fare - comm);
                                            return (
                                                <tr key={ride.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-4 font-mono text-[10px] text-gray-400">#{ride.id.slice(0, 10)}</td>
                                                    <td className="px-6 py-4 text-sm font-bold text-gray-800">{ride.driverId ? drivers.find(d => d.id === ride.driverId)?.name : 'N/A'}</td>
                                                    <td className="px-6 py-4 text-sm font-black text-gray-900">{ride.fare} EGP</td>
                                                    <td className="px-6 py-4 text-sm font-bold text-red-500">-{Math.round(comm)} EGP</td>
                                                    <td className="px-6 py-4 text-sm font-black text-green-600">{Math.round(net)} EGP</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'notifications' && (
                        <div className="max-w-5xl mx-auto py-8 space-y-10 animate-fade-in">
                            {/* Audio Notifications Quick Card */}
                            <div className="p-6 bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900 text-white rounded-[32px] flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl shadow-inner shrink-0">
                                        <i className="fas fa-volume-up text-yellow-300"></i>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-[10px] font-black uppercase tracking-wider">
                                            <span>{isRTL ? 'إعدادات الأصوات' : 'Audio Notifications Settings'}</span>
                                        </div>
                                        <h4 className="font-black text-lg text-white">
                                            {isRTL ? 'تخصيص كامل لأصوات طلبات الرحلات، العروض، وقبول الرحلات' : 'Full In-App & Push Audio Notifications Control'}
                                        </h4>
                                        <p className="text-xs text-white/80 font-medium">
                                            {isRTL ? 'تغيير الأصوات، رفع نغمات خاصة، أو كتم وإلغاء أي نغمة صوتية بنقرة واحدة دون أي تداخل.' : 'Change tones, upload custom audio, or mute specific sounds with zero mixing or audio clutter.'}
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => { setActiveTab('settings'); setActiveSettingsTab('audio'); }}
                                    className="px-6 py-3.5 bg-yellow-400 hover:bg-yellow-300 text-gray-900 rounded-2xl text-xs font-black shadow-lg transition-all flex items-center justify-center gap-2 whitespace-nowrap self-start md:self-center"
                                >
                                    <i className="fas fa-sliders-h"></i>
                                    <span>{isRTL ? 'فتح إعدادات الأصوات 🔊' : 'Configure Audio Sounds 🔊'}</span>
                                </button>
                            </div>

                            <HomeAdBannerAdminEditor />

                            <div className="bg-white p-10 rounded-[40px] shadow-sm border space-y-8 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-8 opacity-5 text-9xl"><i className="fas fa-bullhorn"></i></div>
                                
                                <div className="flex items-center gap-6 mb-2 relative z-10">
                                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-[24px] flex items-center justify-center text-3xl shadow-sm border border-blue-100">
                                        <i className="fas fa-bullhorn"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-gray-900 tracking-tight">System-Wide Broadcast</h3>
                                        <p className="text-sm text-gray-400 font-medium">Notify all Android passengers & captains instantly (Web & Admin accounts excluded).</p>
                                    </div>
                                </div>

                                <div className="space-y-6 relative z-10">
                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1 mb-2 block">Notification Title</label>
                                        <input 
                                            value={notifTitle}
                                            onChange={e => setNotifTitle(e.target.value)}
                                            className="w-full p-5 bg-gray-50 rounded-[20px] border-2 border-transparent focus:bg-white focus:border-blue-500 outline-none font-bold text-lg transition-all"
                                            placeholder="e.g., Happy New Year! 🚗"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1 mb-2 block">Message Content</label>
                                        <textarea 
                                            value={notifBody}
                                            onChange={e => setNotifBody(e.target.value)}
                                            className="w-full p-5 bg-gray-50 rounded-[20px] border-2 border-transparent focus:bg-white focus:border-blue-500 outline-none font-medium min-h-[160px] resize-none transition-all"
                                            placeholder="Write your message here..."
                                        />
                                    </div>

                                    <div className="pt-6">
                                        <Button 
                                            onClick={handleSendBroadcast}
                                            isLoading={isSendingNotif}
                                            className="w-full h-16 bg-blue-600 text-white shadow-xl shadow-blue-100 rounded-2xl text-lg font-black tracking-wide"
                                        >
                                            <i className="fas fa-paper-plane mr-3 rtl:ml-3"></i> Send Global Push
                                        </Button>
                                        <p className="text-[10px] text-center text-gray-400 font-bold mt-6 uppercase tracking-widest">
                                            Warning: This action cannot be undone.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'broadcasts' && <BroadcastAdminView />}

                    {activeTab === 'settings' && (
                         <div className="max-w-4xl mx-auto py-10 animate-fade-in">
                            <div className="bg-white p-10 rounded-[40px] shadow-sm border space-y-8">
                                <h3 className="text-2xl font-black text-gray-900 tracking-tight">System Deployment Settings</h3>
                                
                                <div className="flex bg-gray-50 p-1.5 rounded-2xl mb-8 overflow-x-auto hide-scrollbar border border-gray-100">
                                    <button onClick={() => setActiveSettingsTab('system')} className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${activeSettingsTab === 'system' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>{isRTL ? 'النظام والخرائط' : 'System & Maps'}</button>
                                    <button onClick={() => setActiveSettingsTab('audio')} className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold whitespace-nowrap transition-all flex items-center justify-center gap-1.5 ${activeSettingsTab === 'audio' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}>
                                        <i className="fas fa-volume-up text-xs"></i>
                                        <span>{isRTL ? 'الأصوات والإشعارات' : 'Audio & Sounds'}</span>
                                    </button>
                                    <button onClick={() => setActiveSettingsTab('features')} className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${activeSettingsTab === 'features' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>{isRTL ? 'الميزات والمالية' : 'Features & Finance'}</button>
                                    <button onClick={() => setActiveSettingsTab('offers')} className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${activeSettingsTab === 'offers' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>{isRTL ? 'العروض والنقاط' : 'Offers & Loyalty'}</button>
                                    <button onClick={() => setActiveSettingsTab('maintenance')} className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${activeSettingsTab === 'maintenance' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>{isRTL ? 'الصيانة والإنعاش' : 'Maintenance'}</button>
                                </div>

                                {activeSettingsTab === 'audio' && (
                                    <AudioSettingsAdminView 
                                        currentSettings={appSettings?.audioSettings}
                                        onSaved={(newAudio) => {
                                            if (appSettings) {
                                                setAppSettings({ ...appSettings, audioSettings: newAudio });
                                            }
                                        }}
                                    />
                                )}

                                {activeSettingsTab === 'system' && (
                                    <div className="space-y-6 animate-fade-in">
                                        {/* Side Menu Social Icons & App Version Control */}
                                        <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100 space-y-5">
                                            <div className="flex items-center justify-between border-b border-gray-200/70 pb-4">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-black text-gray-900 text-base">
                                                            {isRTL ? "أيقونات التواصل ورقم الإصدار (أسفل القائمة الجانبية)" : "Side Menu Social Links & App Version"}
                                                        </h4>
                                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${(appSettings?.sideMenuConfig?.isSectionEnabled !== false) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                                            {(appSettings?.sideMenuConfig?.isSectionEnabled !== false) ? (isRTL ? 'مفعل' : 'ON') : (isRTL ? 'مغلق' : 'OFF')}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 font-medium mt-0.5">
                                                        {isRTL
                                                            ? "تحكم في روابط وظهور أيقونات فيسبوك، الموقع الإلكتروني، تيك توك، إنستجرام ورقم إصدار التطبيق لجميع المستخدمين."
                                                            : "Control links and visibility for Facebook, Website, TikTok, Instagram icons and the App Version number at the bottom of the Side Menu."}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        const baseSettings: AppSettings = appSettings || {
                                                            isPaymentsEnabled: false,
                                                            promoBanner: { isEnabled: true, textEn: 'Safe & Fast Rides', textAr: 'رحلات آمنة وسريعة' },
                                                            isRewardsEnabled: true,
                                                            rewardPointsPerTrip: 5,
                                                            isInstaPayEnabled: false,
                                                        };
                                                        const currentCfg = baseSettings.sideMenuConfig || {
                                                            isSectionEnabled: true,
                                                            facebookUrl: 'https://facebook.com',
                                                            isFacebookEnabled: true,
                                                            websiteUrl: 'https://waslny.com',
                                                            isWebsiteEnabled: true,
                                                            tiktokUrl: 'https://tiktok.com',
                                                            isTiktokEnabled: true,
                                                            instagramUrl: 'https://instagram.com',
                                                            isInstagramEnabled: true,
                                                            appVersion: '1.0.2',
                                                            isVersionEnabled: true,
                                                        };
                                                        const nextEnabled = !(currentCfg.isSectionEnabled !== false);
                                                        const updated: AppSettings = {
                                                            ...baseSettings,
                                                            sideMenuConfig: {
                                                                ...currentCfg,
                                                                isSectionEnabled: nextEnabled,
                                                            },
                                                        };
                                                        setAppSettings(updated);
                                                        await updateAppSettings(updated);
                                                    }}
                                                    className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 flex items-center cursor-pointer shrink-0 ${(appSettings?.sideMenuConfig?.isSectionEnabled !== false) ? 'bg-green-500' : 'bg-gray-300'}`}
                                                >
                                                    <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 ${(appSettings?.sideMenuConfig?.isSectionEnabled !== false) ? (isRTL ? '-translate-x-6' : 'translate-x-6') : ''}`}></div>
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* Facebook */}
                                                <div className="bg-white p-4 rounded-2xl border border-gray-100 space-y-3 shadow-xs">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#1877F2] flex items-center justify-center text-sm">
                                                                <i className="fab fa-facebook-f"></i>
                                                            </div>
                                                            <span className="font-black text-xs text-gray-900">
                                                                {isRTL ? "فيسبوك (Facebook)" : "Facebook"}
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setAppSettings((prev) => {
                                                                    if (!prev) return prev;
                                                                    const cfg = prev.sideMenuConfig || {};
                                                                    return {
                                                                        ...prev,
                                                                        sideMenuConfig: {
                                                                            ...cfg,
                                                                            isFacebookEnabled: !(cfg.isFacebookEnabled !== false),
                                                                        },
                                                                    };
                                                                });
                                                            }}
                                                            className={`w-11 h-6 rounded-full p-0.5 transition-colors flex items-center cursor-pointer ${(appSettings?.sideMenuConfig?.isFacebookEnabled !== false) ? 'bg-green-500' : 'bg-gray-300'}`}
                                                        >
                                                            <div className={`w-5 h-5 bg-white rounded-full shadow-xs transform transition-transform ${(appSettings?.sideMenuConfig?.isFacebookEnabled !== false) ? (isRTL ? '-translate-x-5' : 'translate-x-5') : ''}`}></div>
                                                        </button>
                                                    </div>
                                                    <input
                                                        type="url"
                                                        dir="ltr"
                                                        value={appSettings?.sideMenuConfig?.facebookUrl ?? 'https://facebook.com'}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setAppSettings((prev) =>
                                                                prev
                                                                    ? {
                                                                          ...prev,
                                                                          sideMenuConfig: {
                                                                              ...(prev.sideMenuConfig || {}),
                                                                              facebookUrl: val,
                                                                          },
                                                                      }
                                                                    : prev
                                                            );
                                                        }}
                                                        placeholder="https://facebook.com/yourpage"
                                                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:bg-white focus:border-blue-500"
                                                    />
                                                </div>

                                                {/* Website */}
                                                <div className="bg-white p-4 rounded-2xl border border-gray-100 space-y-3 shadow-xs">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm">
                                                                <i className="fas fa-globe"></i>
                                                            </div>
                                                            <span className="font-black text-xs text-gray-900">
                                                                {isRTL ? "الموقع الإلكتروني (Website)" : "Website"}
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setAppSettings((prev) => {
                                                                    if (!prev) return prev;
                                                                    const cfg = prev.sideMenuConfig || {};
                                                                    return {
                                                                        ...prev,
                                                                        sideMenuConfig: {
                                                                            ...cfg,
                                                                            isWebsiteEnabled: !(cfg.isWebsiteEnabled !== false),
                                                                        },
                                                                    };
                                                                });
                                                            }}
                                                            className={`w-11 h-6 rounded-full p-0.5 transition-colors flex items-center cursor-pointer ${(appSettings?.sideMenuConfig?.isWebsiteEnabled !== false) ? 'bg-green-500' : 'bg-gray-300'}`}
                                                        >
                                                            <div className={`w-5 h-5 bg-white rounded-full shadow-xs transform transition-transform ${(appSettings?.sideMenuConfig?.isWebsiteEnabled !== false) ? (isRTL ? '-translate-x-5' : 'translate-x-5') : ''}`}></div>
                                                        </button>
                                                    </div>
                                                    <input
                                                        type="url"
                                                        dir="ltr"
                                                        value={appSettings?.sideMenuConfig?.websiteUrl ?? 'https://waslny.com'}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setAppSettings((prev) =>
                                                                prev
                                                                    ? {
                                                                          ...prev,
                                                                          sideMenuConfig: {
                                                                              ...(prev.sideMenuConfig || {}),
                                                                              websiteUrl: val,
                                                                          },
                                                                      }
                                                                    : prev
                                                            );
                                                        }}
                                                        placeholder="https://waslny.com"
                                                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:bg-white focus:border-emerald-500"
                                                    />
                                                </div>

                                                {/* TikTok */}
                                                <div className="bg-white p-4 rounded-2xl border border-gray-100 space-y-3 shadow-xs">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-8 h-8 rounded-xl bg-gray-100 text-gray-900 flex items-center justify-center text-sm">
                                                                <i className="fab fa-tiktok"></i>
                                                            </div>
                                                            <span className="font-black text-xs text-gray-900">
                                                                {isRTL ? "تيك توك (TikTok)" : "TikTok"}
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setAppSettings((prev) => {
                                                                    if (!prev) return prev;
                                                                    const cfg = prev.sideMenuConfig || {};
                                                                    return {
                                                                        ...prev,
                                                                        sideMenuConfig: {
                                                                            ...cfg,
                                                                            isTiktokEnabled: !(cfg.isTiktokEnabled !== false),
                                                                        },
                                                                    };
                                                                });
                                                            }}
                                                            className={`w-11 h-6 rounded-full p-0.5 transition-colors flex items-center cursor-pointer ${(appSettings?.sideMenuConfig?.isTiktokEnabled !== false) ? 'bg-green-500' : 'bg-gray-300'}`}
                                                        >
                                                            <div className={`w-5 h-5 bg-white rounded-full shadow-xs transform transition-transform ${(appSettings?.sideMenuConfig?.isTiktokEnabled !== false) ? (isRTL ? '-translate-x-5' : 'translate-x-5') : ''}`}></div>
                                                        </button>
                                                    </div>
                                                    <input
                                                        type="url"
                                                        dir="ltr"
                                                        value={appSettings?.sideMenuConfig?.tiktokUrl ?? 'https://tiktok.com'}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setAppSettings((prev) =>
                                                                prev
                                                                    ? {
                                                                          ...prev,
                                                                          sideMenuConfig: {
                                                                              ...(prev.sideMenuConfig || {}),
                                                                              tiktokUrl: val,
                                                                          },
                                                                      }
                                                                    : prev
                                                            );
                                                        }}
                                                        placeholder="https://tiktok.com/@yourhandle"
                                                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:bg-white focus:border-gray-900"
                                                    />
                                                </div>

                                                {/* Instagram */}
                                                <div className="bg-white p-4 rounded-2xl border border-gray-100 space-y-3 shadow-xs">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-8 h-8 rounded-xl bg-pink-50 text-[#E4405F] flex items-center justify-center text-sm">
                                                                <i className="fab fa-instagram"></i>
                                                            </div>
                                                            <span className="font-black text-xs text-gray-900">
                                                                {isRTL ? "إنستجرام (Instagram)" : "Instagram"}
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setAppSettings((prev) => {
                                                                    if (!prev) return prev;
                                                                    const cfg = prev.sideMenuConfig || {};
                                                                    return {
                                                                        ...prev,
                                                                        sideMenuConfig: {
                                                                            ...cfg,
                                                                            isInstagramEnabled: !(cfg.isInstagramEnabled !== false),
                                                                        },
                                                                    };
                                                                });
                                                            }}
                                                            className={`w-11 h-6 rounded-full p-0.5 transition-colors flex items-center cursor-pointer ${(appSettings?.sideMenuConfig?.isInstagramEnabled !== false) ? 'bg-green-500' : 'bg-gray-300'}`}
                                                        >
                                                            <div className={`w-5 h-5 bg-white rounded-full shadow-xs transform transition-transform ${(appSettings?.sideMenuConfig?.isInstagramEnabled !== false) ? (isRTL ? '-translate-x-5' : 'translate-x-5') : ''}`}></div>
                                                        </button>
                                                    </div>
                                                    <input
                                                        type="url"
                                                        dir="ltr"
                                                        value={appSettings?.sideMenuConfig?.instagramUrl ?? 'https://instagram.com'}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setAppSettings((prev) =>
                                                                prev
                                                                    ? {
                                                                          ...prev,
                                                                          sideMenuConfig: {
                                                                              ...(prev.sideMenuConfig || {}),
                                                                              instagramUrl: val,
                                                                          },
                                                                      }
                                                                    : prev
                                                            );
                                                        }}
                                                        placeholder="https://instagram.com/yourhandle"
                                                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:bg-white focus:border-pink-500"
                                                    />
                                                </div>
                                            </div>

                                            {/* App Version Number Control */}
                                            <div className="bg-white p-4 rounded-2xl border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-sm shrink-0">
                                                        <i className="fas fa-code-branch"></i>
                                                    </div>
                                                    <div>
                                                        <div className="font-black text-xs text-gray-900">
                                                            {isRTL ? "رقم إصدار التطبيق (App Version Number)" : "App Version Number"}
                                                        </div>
                                                        <div className="text-[10px] text-gray-400 font-bold">
                                                            {isRTL ? "يظهر في نهاية القائمة الجانبية لجميع المستخدمين" : "Displayed at the very bottom of the Side Menu for all users"}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="text"
                                                        dir="ltr"
                                                        value={appSettings?.sideMenuConfig?.appVersion ?? '1.0.2'}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setAppSettings((prev) =>
                                                                prev
                                                                    ? {
                                                                          ...prev,
                                                                          sideMenuConfig: {
                                                                              ...(prev.sideMenuConfig || {}),
                                                                              appVersion: val,
                                                                          },
                                                                      }
                                                                    : prev
                                                            );
                                                        }}
                                                        placeholder="1.0.2"
                                                        className="w-32 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-black text-center text-gray-900 outline-none focus:bg-white focus:border-amber-500"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setAppSettings((prev) => {
                                                                if (!prev) return prev;
                                                                const cfg = prev.sideMenuConfig || {};
                                                                return {
                                                                    ...prev,
                                                                    sideMenuConfig: {
                                                                        ...cfg,
                                                                        isVersionEnabled: !(cfg.isVersionEnabled !== false),
                                                                    },
                                                                };
                                                            });
                                                        }}
                                                        className={`w-11 h-6 rounded-full p-0.5 transition-colors flex items-center cursor-pointer shrink-0 ${(appSettings?.sideMenuConfig?.isVersionEnabled !== false) ? 'bg-green-500' : 'bg-gray-300'}`}
                                                    >
                                                        <div className={`w-5 h-5 bg-white rounded-full shadow-xs transform transition-transform ${(appSettings?.sideMenuConfig?.isVersionEnabled !== false) ? (isRTL ? '-translate-x-5' : 'translate-x-5') : ''}`}></div>
                                                    </button>
                                                </div>
                                            </div>

                                            <Button
                                                onClick={async () => {
                                                    if (!appSettings) return;
                                                    try {
                                                        await updateAppSettings(appSettings);
                                                        alert(
                                                            isRTL
                                                                ? "تم حفظ وتعميم روابط التواصل ورقم الإصدار على جميع المستخدمين بنجاح!"
                                                                : "Side Menu social links & app version saved for all users!"
                                                        );
                                                    } catch (err) {
                                                        console.error(err);
                                                        alert(isRTL ? "فشل حفظ الإعدادات" : "Failed to save settings");
                                                    }
                                                }}
                                                className="w-full bg-[#FFC90E] text-gray-900 rounded-xl py-3.5 font-black shadow-md hover:bg-yellow-400"
                                            >
                                                <i className="fas fa-save mr-2 rtl:ml-2"></i>
                                                {isRTL
                                                    ? "حفظ وتعميم روابط القائمة الجانبية ورقم الإصدار لجميع المستخدمين"
                                                    : "Save & Publish Side Menu Links & App Version to All Users"}
                                            </Button>
                                        </div>

                                        <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100 flex items-center justify-between">
                                            <div>
                                                <h4 className="font-bold text-gray-800">Enable Phone Authentication</h4>
                                                <p className="text-xs text-gray-400 font-medium max-w-xs">Enable or temporarily disable phone login and OTP flow.</p>
                                            </div>
                                            <button 
                                                onClick={handleTogglePhoneAuth}
                                                className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 flex items-center ${appPhoneAuthEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
                                            >
                                                <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 ${appPhoneAuthEnabled ? (isRTL ? '-translate-x-6' : 'translate-x-6') : ''}`}></div>
                                            </button>
                                        </div>

                                        <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100 flex flex-col gap-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h4 className="font-bold text-gray-800">Map Provider</h4>
                                                    <p className="text-xs text-gray-400 font-medium max-w-xs">Dynamically switch between Google Maps and Mapbox.</p>
                                                </div>
                                                <select 
                                                    value={appSettings?.mapProvider || 'google'}
                                                    onChange={(e) => handleUpdateMapSettings(e.target.value as 'google' | 'mapbox', appSettings?.mapboxPublicToken)}
                                                    className="bg-white border border-gray-200 rounded-xl px-4 py-2 font-bold text-gray-800 outline-none"
                                                >
                                                    <option value="google">Google Maps</option>
                                                    <option value="mapbox">Mapbox</option>
                                                </select>
                                            </div>
                                            {appSettings?.mapProvider === 'mapbox' && (
                                                <div>
                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Mapbox Public Token</label>
                                                    <input 
                                                        value={appSettings?.mapboxPublicToken || ''}
                                                        onChange={(e) => appSettings && setAppSettings({ ...appSettings, mapboxPublicToken: e.target.value })}
                                                        className="w-full p-4 bg-white border border-gray-100 rounded-2xl outline-none font-medium"
                                                        placeholder="pk.xxxx..."
                                                    />
                                                    <Button 
                                                        onClick={() => appSettings && handleUpdateMapSettings('mapbox', appSettings.mapboxPublicToken)}
                                                        className="mt-4 w-full bg-blue-600 text-white rounded-xl py-3 font-bold"
                                                    >
                                                        Save Token
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {activeSettingsTab === 'features' && (
                                    <div className="space-y-6 animate-fade-in">
                                        <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100 flex items-center justify-between">
                                            <div>
                                                <h4 className="font-bold text-gray-800">Enable Financial Features</h4>
                                                <p className="text-xs text-gray-400 font-medium max-w-xs">Hide wallet, payments, and rewards for App Store compliance during review.</p>
                                            </div>
                                            <button 
                                                onClick={handleTogglePayments}
                                                className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 flex items-center ${appSettings?.isPaymentsEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
                                            >
                                                <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 ${appSettings?.isPaymentsEnabled ? (isRTL ? '-translate-x-6' : 'translate-x-6') : ''}`}></div>
                                            </button>
                                        </div>

                                        <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100 flex items-center justify-between">
                                            <div>
                                                <h4 className="font-bold text-gray-800">Enable InstaPay Payment</h4>
                                                <p className="text-xs text-gray-400 font-medium max-w-xs">Enable/Disable InstaPay as a payment option for all users.</p>
                                            </div>
                                            <button 
                                                onClick={handleToggleInstaPay}
                                                className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 flex items-center ${appSettings?.isInstaPayEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
                                            >
                                                <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 ${appSettings?.isInstaPayEnabled ? (isRTL ? '-translate-x-6' : 'translate-x-6') : ''}`}></div>
                                            </button>
                                        </div>

                                        <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100 flex flex-col gap-4">
                                            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                                                <div>
                                                    <h4 className="font-bold text-gray-800">Driver Free Trial Settings</h4>
                                                    <p className="text-xs text-gray-400 font-medium max-w-xs">Set duration for automatic 0% commission trial for newly approved drivers.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h5 className="text-sm font-bold text-gray-700">Trial Duration</h5>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <input 
                                                        type="number"
                                                        value={appSettings?.driverFreeTrialDays ?? 30}
                                                        onChange={async (e) => {
                                                            if (!appSettings) return;
                                                            const val = Number(e.target.value);
                                                            const updated = { ...appSettings, driverFreeTrialDays: val };
                                                            setAppSettings(updated);
                                                            await updateAppSettings(updated);
                                                        }}
                                                        className="w-20 px-3 py-2 bg-white border border-gray-200 rounded-xl font-black text-center text-lg outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Days</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                                                <div>
                                                    <h5 className="text-sm font-bold text-gray-700">Default Commission</h5>
                                                    <p className="text-[10px] text-gray-400 font-medium">Applied after trial expires.</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <input 
                                                        type="number"
                                                        value={appSettings?.defaultCommissionPercentage ?? 15}
                                                        onChange={async (e) => {
                                                            if (!appSettings) return;
                                                            const val = Number(e.target.value);
                                                            const updated = { ...appSettings, defaultCommissionPercentage: val };
                                                            setAppSettings(updated);
                                                            await updateAppSettings(updated);
                                                        }}
                                                        className="w-20 px-3 py-2 bg-white border border-gray-200 rounded-xl font-black text-center text-lg outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest">%</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeSettingsTab === 'offers' && (
                                    <div className="space-y-6 animate-fade-in">
                                        <HomeAdBannerAdminEditor />

                                        <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-bold text-gray-800">
                                                            {isRTL ? "نظام مكافآت ونقاط الركاب (مركز المكافآت)" : "Passenger Loyalty Rewards"}
                                                        </h4>
                                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${(appSettings?.isRewardsEnabled !== false) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                                            {(appSettings?.isRewardsEnabled !== false) ? (isRTL ? 'مفعل' : 'ON') : (isRTL ? 'مغلق' : 'OFF')}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-400 font-medium max-w-md mt-0.5">
                                                        {isRTL
                                                            ? "تفعيل أو إيقاف نظام النقاط لجميع الركاب، وتحديد نقاط كل رحلة وقيمة الخصم."
                                                            : "Enable or disable loyalty points for all passengers, and configure trip points & discount."}
                                                    </p>
                                                </div>
                                                <button 
                                                    type="button"
                                                    onClick={handleToggleRewards}
                                                    className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 flex items-center cursor-pointer ${(appSettings?.isRewardsEnabled !== false) ? 'bg-green-500' : 'bg-gray-300'}`}
                                                >
                                                    <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 ${(appSettings?.isRewardsEnabled !== false) ? (isRTL ? '-translate-x-6' : 'translate-x-6') : ''}`}></div>
                                                </button>
                                            </div>
                                            {(appSettings?.isRewardsEnabled !== false) && (
                                                <div className="pt-4 border-t border-gray-100 space-y-4">
                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                        <div className="bg-white p-3.5 rounded-2xl border border-gray-100 flex flex-col justify-between gap-2">
                                                            <div>
                                                                <h5 className="text-xs font-black text-gray-700">{isRTL ? "النقاط لكل رحلة" : "Points Per Trip"}</h5>
                                                                <p className="text-[10px] text-gray-400 font-medium">{isRTL ? "تمنح بعد كل رحلة مكتملة" : "Awarded per completed ride"}</p>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <input 
                                                                    type="number"
                                                                    min={1}
                                                                    value={appSettings?.rewardPointsPerTrip ?? 5}
                                                                    onChange={(e) => {
                                                                        const val = Math.max(1, Number(e.target.value) || 0);
                                                                        setAppSettings(prev => prev ? { ...prev, rewardPointsPerTrip: val } : prev);
                                                                    }}
                                                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-black text-center text-base outline-none focus:ring-2 focus:ring-blue-500"
                                                                />
                                                                <span className="text-[10px] font-black text-gray-400 uppercase">{isRTL ? "نقطة" : "Pts"}</span>
                                                            </div>
                                                        </div>

                                                        <div className="bg-white p-3.5 rounded-2xl border border-gray-100 flex flex-col justify-between gap-2">
                                                            <div>
                                                                <h5 className="text-xs font-black text-gray-700">{isRTL ? "نقاط تفعيل الخصم" : "Points Required"}</h5>
                                                                <p className="text-[10px] text-gray-400 font-medium">{isRTL ? "الحد المطلوب لاستبدال المكافأة" : "Threshold to unlock discount"}</p>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <input 
                                                                    type="number"
                                                                    min={5}
                                                                    value={appSettings?.rewardThresholdPoints ?? 50}
                                                                    onChange={(e) => {
                                                                        const val = Math.max(5, Number(e.target.value) || 0);
                                                                        setAppSettings(prev => prev ? { ...prev, rewardThresholdPoints: val } : prev);
                                                                    }}
                                                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-black text-center text-base outline-none focus:ring-2 focus:ring-blue-500"
                                                                />
                                                                <span className="text-[10px] font-black text-gray-400 uppercase">{isRTL ? "نقطة" : "Pts"}</span>
                                                            </div>
                                                        </div>

                                                        <div className="bg-white p-3.5 rounded-2xl border border-gray-100 flex flex-col justify-between gap-2">
                                                            <div>
                                                                <h5 className="text-xs font-black text-gray-700">{isRTL ? "قيمة الخصم (ج.م)" : "Discount Value (EGP)"}</h5>
                                                                <p className="text-[10px] text-gray-400 font-medium">{isRTL ? "يخصم من سعر الرحلة" : "Deducted from ride fare"}</p>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <input 
                                                                    type="number"
                                                                    min={5}
                                                                    value={appSettings?.rewardDiscountAmount ?? 20}
                                                                    onChange={(e) => {
                                                                        const val = Math.max(5, Number(e.target.value) || 0);
                                                                        setAppSettings(prev => prev ? { ...prev, rewardDiscountAmount: val } : prev);
                                                                    }}
                                                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-black text-center text-base outline-none focus:ring-2 focus:ring-blue-500"
                                                                />
                                                                <span className="text-[10px] font-black text-gray-400 uppercase">{isRTL ? "ج.م" : "EGP"}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <Button
                                                        onClick={async () => {
                                                            if (!appSettings) return;
                                                            try {
                                                                await updateAppSettings(appSettings);
                                                                alert(isRTL ? "تم حفظ وتعميم إعدادات النقاط على جميع الركاب!" : "Rewards settings saved for all passengers!");
                                                            } catch (err) {
                                                                console.error(err);
                                                                alert(isRTL ? "فشل حفظ الإعدادات" : "Failed to save settings");
                                                            }
                                                        }}
                                                        className="w-full bg-[#FFC90E] text-gray-900 rounded-xl py-3 font-black shadow-md hover:bg-yellow-400"
                                                    >
                                                        {isRTL ? "حفظ وتعميم إعدادات النقاط على جميع الركاب" : "Save & Apply Rewards Config to All Passengers"}
                                                    </Button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100 flex flex-col gap-4">
                                            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                                                <div>
                                                    <h4 className="font-bold text-gray-800">Passenger Welcome Offer</h4>
                                                    <p className="text-xs text-gray-400 font-medium max-w-xs">Configure the welcome sheet content shown to passengers on first launch.</p>
                                                </div>
                                                <button 
                                                    onClick={async () => {
                                                        if (!appSettings) return;
                                                        const currentWelcomeOffer = appSettings.welcomeOffer || {
                                                            isEnabled: true,
                                                            icon: 'fas fa-gift',
                                                            titleEn: 'Welcome to Mowasla!',
                                                            titleAr: 'أهلاً بك في مواصلة!',
                                                            messageEn: 'Enjoy a faster and easier ride. Collect points with every trip and get exclusive discounts and special offers just for you.',
                                                            messageAr: 'استمتع بتجربة أسهل وأسرع. اجمع النقاط مع كل رحلة واحصل على خصومات حصرية وعروض مميزة خصيصاً لك.',
                                                            highlightTitleEn: 'Points & Rewards',
                                                            highlightTitleAr: 'برنامج النقاط والمكافآت',
                                                            highlightMessageEn: 'For every ride you earn points that can later be converted into instant discounts.',
                                                            highlightMessageAr: 'لكل رحلة تكتسب نقاطاً يمكنك تحويلها لاحقاً إلى خصومات فورية.',
                                                        };
                                                        const updated = {
                                                            ...appSettings,
                                                            welcomeOffer: { ...currentWelcomeOffer, isEnabled: !currentWelcomeOffer.isEnabled }
                                                        };
                                                        setAppSettings(updated);
                                                        await updateAppSettings(updated);
                                                    }}
                                                    className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 flex items-center ${(appSettings?.welcomeOffer?.isEnabled !== false) ? 'bg-green-500' : 'bg-gray-300'}`}
                                                >
                                                    <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 ${(appSettings?.welcomeOffer?.isEnabled !== false) ? (isRTL ? '-translate-x-6' : 'translate-x-6') : ''}`}></div>
                                                </button>
                                            </div>
                                            
                                            {(appSettings?.welcomeOffer?.isEnabled !== false) && (
                                                <div className="space-y-4 pt-4">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Title (English)</label>
                                                            <input 
                                                                value={appSettings?.welcomeOffer?.titleEn || 'Welcome to Mowasla!'}
                                                                onChange={(e) => setAppSettings({ ...appSettings!, welcomeOffer: { ...appSettings!.welcomeOffer!, ...{isEnabled: true}, titleEn: e.target.value }})}
                                                                className="w-full p-3 bg-white border border-gray-100 rounded-xl outline-none text-sm"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Title (Arabic)</label>
                                                            <input 
                                                                value={appSettings?.welcomeOffer?.titleAr || 'أهلاً بك في مواصلة!'}
                                                                onChange={(e) => setAppSettings({ ...appSettings!, welcomeOffer: { ...appSettings!.welcomeOffer!, ...{isEnabled: true}, titleAr: e.target.value }})}
                                                                className="w-full p-3 bg-white border border-gray-100 rounded-xl outline-none text-sm text-right"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Message (English)</label>
                                                            <textarea 
                                                                value={appSettings?.welcomeOffer?.messageEn || 'Enjoy a faster and easier ride. Collect points with every trip and get exclusive discounts and special offers just for you.'}
                                                                onChange={(e) => setAppSettings({ ...appSettings!, welcomeOffer: { ...appSettings!.welcomeOffer!, ...{isEnabled: true}, messageEn: e.target.value }})}
                                                                className="w-full p-3 bg-white border border-gray-100 rounded-xl outline-none text-sm h-24"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Message (Arabic)</label>
                                                            <textarea 
                                                                value={appSettings?.welcomeOffer?.messageAr || 'استمتع بتجربة أسهل وأسرع. اجمع النقاط مع كل رحلة واحصل على خصومات حصرية وعروض مميزة خصيصاً لك.'}
                                                                onChange={(e) => setAppSettings({ ...appSettings!, welcomeOffer: { ...appSettings!.welcomeOffer!, ...{isEnabled: true}, messageAr: e.target.value }})}
                                                                className="w-full p-3 bg-white border border-gray-100 rounded-xl outline-none text-sm h-24 text-right"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Highlight Title (English)</label>
                                                            <input 
                                                                value={appSettings?.welcomeOffer?.highlightTitleEn || 'Points & Rewards'}
                                                                onChange={(e) => setAppSettings({ ...appSettings!, welcomeOffer: { ...appSettings!.welcomeOffer!, ...{isEnabled: true}, highlightTitleEn: e.target.value }})}
                                                                className="w-full p-3 bg-white border border-gray-100 rounded-xl outline-none text-sm"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Highlight Title (Arabic)</label>
                                                            <input 
                                                                value={appSettings?.welcomeOffer?.highlightTitleAr || 'برنامج النقاط والمكافآت'}
                                                                onChange={(e) => setAppSettings({ ...appSettings!, welcomeOffer: { ...appSettings!.welcomeOffer!, ...{isEnabled: true}, highlightTitleAr: e.target.value }})}
                                                                className="w-full p-3 bg-white border border-gray-100 rounded-xl outline-none text-sm text-right"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Highlight Message (English)</label>
                                                            <textarea 
                                                                value={appSettings?.welcomeOffer?.highlightMessageEn || 'For every ride you earn points that can later be converted into instant discounts.'}
                                                                onChange={(e) => setAppSettings({ ...appSettings!, welcomeOffer: { ...appSettings!.welcomeOffer!, ...{isEnabled: true}, highlightMessageEn: e.target.value }})}
                                                                className="w-full p-3 bg-white border border-gray-100 rounded-xl outline-none text-sm h-24"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Highlight Message (Arabic)</label>
                                                            <textarea 
                                                                value={appSettings?.welcomeOffer?.highlightMessageAr || 'لكل رحلة تكتسب نقاطاً يمكنك تحويلها لاحقاً إلى خصومات فورية.'}
                                                                onChange={(e) => setAppSettings({ ...appSettings!, welcomeOffer: { ...appSettings!.welcomeOffer!, ...{isEnabled: true}, highlightMessageAr: e.target.value }})}
                                                                className="w-full p-3 bg-white border border-gray-100 rounded-xl outline-none text-sm h-24 text-right"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Icon Class (e.g. fas fa-gift)</label>
                                                            <input 
                                                                value={appSettings?.welcomeOffer?.icon || 'fas fa-gift'}
                                                                onChange={(e) => setAppSettings({ ...appSettings!, welcomeOffer: { ...appSettings!.welcomeOffer!, ...{isEnabled: true}, icon: e.target.value }})}
                                                                className="w-full p-3 bg-white border border-gray-100 rounded-xl outline-none text-sm font-mono"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Optional Image URL</label>
                                                            <input 
                                                                value={appSettings?.welcomeOffer?.image || ''}
                                                                onChange={(e) => setAppSettings({ ...appSettings!, welcomeOffer: { ...appSettings!.welcomeOffer!, ...{isEnabled: true}, image: e.target.value }})}
                                                                className="w-full p-3 bg-white border border-gray-100 rounded-xl outline-none text-sm"
                                                                placeholder="https://..."
                                                            />
                                                        </div>
                                                    </div>

                                                    <Button 
                                                        onClick={() => appSettings && updateAppSettings(appSettings)}
                                                        className="w-full bg-[#111] text-white rounded-xl py-3 mt-4"
                                                    >
                                                        Save Welcome Config
                                                    </Button>

                                                    <Button 
                                                        onClick={async () => {
                                                            if (window.confirm("Trigger welcome offer for ALL users? This will reset their 'seen' status.")) {
                                                                const updated = {
                                                                    ...appSettings!,
                                                                    welcomeOffer: appSettings?.welcomeOffer ? {
                                                                        ...appSettings.welcomeOffer,
                                                                        isEnabled: true,
                                                                        pushTimestamp: Date.now()
                                                                    } : { isEnabled: true, pushTimestamp: Date.now() },
                                                                    forceReload: {
                                                                        timestamp: Date.now(),
                                                                        messageEn: "System updated, welcome!",
                                                                        messageAr: "تم تحديث النظام، أهلاً بك!"
                                                                    }
                                                                };
                                                                setAppSettings(updated);
                                                                await updateAppSettings(updated);
                                                                alert("Push successful. Users will see it on reload.");
                                                            }
                                                        }}
                                                        className="w-full bg-[#FFC90E] text-black rounded-xl py-3 font-black"
                                                    >
                                                        Push to All Users Now
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {activeSettingsTab === 'maintenance' && (
                                    <div className="space-y-6 animate-fade-in">
                                        <div className="p-6 bg-red-50 rounded-3xl border border-red-100">
                                            <h4 className="font-bold text-red-800 mb-2">System Authority</h4>
                                            <p className="text-xs text-red-600 font-medium mb-4">Force all connected users (Passengers & Drivers) to refresh their app instantly. Use this after critical code changes or map updates.</p>
                                            <Button 
                                                onClick={async () => {
                                                    if (window.confirm("Trigger force reload for ALL users?")) {
                                                        const updated = {
                                                            ...appSettings!,
                                                            forceReload: {
                                                                timestamp: Date.now(),
                                                                messageEn: "System maintenance completed. Please refresh to apply updates.",
                                                                messageAr: "اكتملت صيانة النظام. يرجى التحديث لتطبيق التغييرات."
                                                            }
                                                        };
                                                        await updateAppSettings(updated);
                                                        alert("Global reload trigger sent!");
                                                    }
                                                }}
                                                className="w-full h-14 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black shadow-lg shadow-red-200"
                                            >
                                                <i className="fas fa-sync-alt mr-2"></i> Trigger Global App Refresh
                                            </Button>
                                        </div>

                                        <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100 flex items-center justify-between">
                                            <div>
                                                <h4 className="font-bold text-gray-800">Seed Mock Data</h4>
                                                <p className="text-xs text-gray-400 font-medium max-w-xs">Generate sample users, drivers, and rides for testing purposes.</p>
                                            </div>
                                            <Button 
                                                onClick={handleSeedData}
                                                isLoading={isLoading}
                                                className="bg-blue-600 text-white rounded-xl px-6 py-2 font-bold shadow-md hover:bg-blue-700 transition-colors"
                                            >
                                                Seed Data
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                         </div>
                    )}

                    {activeTab === 'users_db' && (
                        <UsersDatabaseAdminView
                            users={allUsersList}
                            isRTL={isRTL}
                            onInspectDriverDocs={(drv) => {
                                setSelectedDriver(drv);
                                setIsDocModalOpen(true);
                            }}
                        />
                    )}

                    {activeTab === 'database' && (
                        <DatabaseAdminView isRTL={isRTL} />
                    )}

                    {activeTab === 'scheduled_rides' && (
                        <ScheduledRidesAdminView
                            adminId={auth.currentUser?.uid || 'admin'}
                            drivers={drivers}
                            lang={isRTL ? 'ar' : 'en'}
                        />
                    )}
                </div>
            </main>

            {/* --- Driver Management Modal --- */}
            {isDocModalOpen && selectedDriver && (
                <DriverManagementModal 
                    selectedDriver={selectedDriver}
                    onClose={() => { setIsDocModalOpen(false); setSelectedDriver(null); }}
                    onActionCompleted={() => setIsDocModalOpen(false)}
                />
            )}

            {isChatModalOpen && activeTicketId && (
                <div className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
                    <div className="bg-white w-full max-w-2xl h-[80vh] rounded-[40px] flex flex-col shadow-2xl overflow-hidden animate-slide-up">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h2 className="text-xl font-black text-gray-900 tracking-tight">Fee Payment Conversation</h2>
                            <button onClick={() => { setIsChatModalOpen(false); setActiveTicketId(null); }} className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <AdminSupportChat ticketId={activeTicketId} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const AdminSupportChat = ({ ticketId }: { ticketId: string }) => {
    const [messages, setMessages] = useState<any[]>([]);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const unsub = subscribeToSupportMessages(ticketId, (msgs) => {
            setMessages(msgs);
            setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        });
        return () => unsub();
    }, [ticketId]);

    const handleSend = async () => {
        if (!text.trim() || sending) return;
        setSending(true);
        try {
            await sendSupportMessage(ticketId, text, 'admin', true);
            setText('');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-[#F0F2F5]">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.isAdmin ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${msg.isAdmin ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none border border-gray-100'}`}>
                            <p className="text-sm font-medium whitespace-pre-wrap">{msg.text}</p>
                            <p className={`text-[10px] mt-1 font-bold uppercase ${msg.isAdmin ? 'text-blue-100' : 'text-gray-400'}`}>
                                {msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleTimeString() : '...'}
                            </p>
                        </div>
                    </div>
                ))}
                <div ref={scrollRef} />
            </div>
            <div className="p-4 bg-white border-t border-gray-100 flex gap-3">
                <input 
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    placeholder="Type your reply..."
                    className="flex-1 bg-gray-100 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
                <button 
                    onClick={handleSend}
                    disabled={!text.trim() || sending}
                    className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-200 active:scale-90 transition-all disabled:opacity-50"
                >
                    <i className="fas fa-paper-plane"></i>
                </button>
            </div>
        </div>
    );
};

const FeePaymentsView = ({ drivers, onApprove, onOpenChat }: { drivers: Driver[], onApprove: (id: string) => Promise<void>, onOpenChat: (id: string, name: string) => void }) => {
    const { isRTL, t } = useLanguage();
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [settlements, setSettlements] = useState<any[]>([]);
    const [subTab, setSubTab] = useState<'current' | 'settlements'>('current');

    useEffect(() => {
        getAllSettlements().then(setSettlements).catch(e => { if(String(e).includes('permission')) { console.log('Permission error caught:', e); } else { if(String(e).includes('permission')) { console.log('Permission error caught:', e); } else { console.error(e); }; } });
    }, []);

    const driversWithFees = drivers.filter(d => (d.pendingFees || 0) > 0);

    const handleGenerateSettlements = async () => {
        if (!window.confirm("Generate weekly settlements for all drivers with pending commission?")) return;
        let generated = 0;
        for (const d of driversWithFees) {
            try {
                await generateWeeklySettlement(d.id, d.pendingFees || 0, Math.floor(Math.random() * 50) + 1, (d.pendingFees || 0) * 10);
                generated++;
            } catch (e) {
                console.error("Failed to generate for", d.name, e);
            }
        }
        alert(`Generated ${generated} settlements. Notifications sent.`);
        getAllSettlements().then(setSettlements);
    };

    const handleApproveSettlement = async (settlementId: string, driverId: string) => {
        if (!window.confirm("Approve this settlement payment via InstaPay and clear restrictions?")) return;
        setProcessingId(settlementId);
        try {
            await approveSettlementPayment(settlementId, driverId);
            setSettlements(s => s.map(x => x.id === settlementId ? { ...x, status: 'paid' } : x));
        } catch (e) {
            if(String(e).includes('permission')) { console.log('Permission error caught:', e); } else { console.error(e); };
            alert("Approval failed");
        }
        setProcessingId(null);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex gap-4 mb-4">
                <Button onClick={() => setSubTab('current')} variant={subTab === 'current' ? 'primary' : 'outline'}>Real-Time Earnings/Fees</Button>
                <Button onClick={() => setSubTab('settlements')} variant={subTab === 'settlements' ? 'primary' : 'outline'}>Generated Settlements Data</Button>
            </div>

            {subTab === 'current' && (
                <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
                        <h3 className="font-black text-gray-900 uppercase text-xs tracking-widest">{isRTL ? 'تحصيل رسوم السائقين' : 'Current Unsettled Fees'}</h3>
                        <div className="flex gap-4 items-center">
                            <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-[10px] font-black uppercase">
                                {driversWithFees.length} Pending
                            </span>
                            <Button onClick={handleGenerateSettlements} className="text-sm px-3 py-1.5 bg-purple-600 text-white rounded-xl">Generate Weekly Settlements</Button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left rtl:text-right">
                            <thead className="bg-gray-50/50">
                                <tr>
                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Driver</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Vehicle</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Pending Fees (Real-time)</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {driversWithFees.length === 0 ? (
                                    <tr><td colSpan={5} className="text-center p-8 text-gray-400 font-bold">{isRTL ? 'لا توجد رسوم مستحقة حالياً' : 'No pending fees at the moment'}</td></tr>
                                ) : (
                                    driversWithFees.map(d => (
                                        <tr key={d.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    <img src={d.avatar || `https://ui-avatars.com/api/?name=${d.name}&background=random`} className="w-10 h-10 rounded-full object-cover shadow-sm" />
                                                    <div>
                                                        <div className="font-black text-sm text-gray-900">{d.name}</div>
                                                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">{d.phone}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-xs font-bold text-gray-600">{d.vehicleBrand} {d.vehicleModel}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-lg font-black text-red-600">{Number(d.pendingFees || 0).toFixed(2)} {t('currency')}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-tighter bg-gray-100 text-gray-700 border border-gray-200">{d.financialStatus || 'active'}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <Button 
                                                    onClick={() => onOpenChat(d.id, d.name)}
                                                    className="h-8 px-4 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-blue-100"
                                                >
                                                    <i className="fas fa-comment-dots mr-2"></i> Chat/Warn
                                                </Button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {subTab === 'settlements' && (
                <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-50">
                        <h3 className="font-black text-gray-900 uppercase text-xs tracking-widest">Invoices & Settlements</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left rtl:text-right">
                            <thead className="bg-gray-50/50">
                                <tr>
                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date / ID</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Driver Name</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Amount Owed</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">InstaPay Receipt</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {settlements.map(s => (
                                    <tr key={s.id} className="hover:bg-gray-50/50">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-sm">{new Date(s.createdAt?.toMillis ? s.createdAt.toMillis() : s.createdAt).toLocaleDateString()}</div>
                                            <div className="text-[10px] text-gray-400 uppercase">INV-{s.id.slice(0, 8)}</div>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-sm text-gray-800">{s.driverName}</td>
                                        <td className="px-6 py-4 font-black text-red-600 text-lg">{Number(s.commissionOwed).toFixed(2)} EGP</td>
                                        <td className="px-6 py-4">
                                            {s.receiptUrl ? (
                                                <a href={s.receiptUrl} target="_blank" rel="noreferrer" className="text-blue-600 text-xs font-bold underline">View Receipt</a>
                                            ) : (
                                                <span className="text-xs text-gray-400">None uploaded</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-tighter ${s.status === 'paid' ? 'bg-green-100 text-green-700' : s.status === 'pending_verification' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                                {s.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {s.status === 'pending_verification' && (
                                                <Button 
                                                    onClick={() => handleApproveSettlement(s.id, s.driverId)}
                                                    isLoading={processingId === s.id}
                                                    className="h-8 px-4 bg-green-600 text-white rounded-xl text-[10px] font-black uppercase shadow-green-100 shadow-sm"
                                                >
                                                    Verify InstaPay
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

const ManualPaymentsView = () => {
    const { t } = useLanguage();
    const [topups, setTopups] = useState<ManualTopup[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [receiptModalUrl, setReceiptModalUrl] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [rejectingId, setRejectingId] = useState<string | null>(null); // To open reject modal
  
    useEffect(() => {
      const unsub = subscribeToAllManualTopups((data) => {
        setTopups(data);
        setLoading(false);
      });
      return () => unsub();
    }, []);
  
    const handleConfirm = async (id: string) => {
      setProcessingId(id);
      try {
        await confirmManualTopupAdmin(id);
      } catch (e) {
        alert("Failed to confirm payment.");
        if(String(e).includes('permission')) { console.log('Permission error caught:', e); } else { console.error(e); };
      } finally {
        setProcessingId(null);
      }
    };
  
    const handleReject = async () => {
      if (!rejectingId) return;
      setProcessingId(rejectingId);
      try {
        await rejectManualTopupAdmin(rejectingId, rejectionReason);
        setRejectingId(null);
        setRejectionReason('');
      } catch (e) {
        alert("Failed to reject payment.");
        if(String(e).includes('permission')) { console.log('Permission error caught:', e); } else { console.error(e); };
      } finally {
        setProcessingId(null);
      }
    };

    const getStatusChip = (status: ManualTopupStatus) => {
        switch(status) {
            case ManualTopupStatus.PENDING: return <span className="px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-tighter bg-gray-100 text-gray-500 border border-gray-200">{t('status_pending')}</span>;
            case ManualTopupStatus.AWAITING_CONFIRMATION: return <span className="px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-tighter bg-yellow-100 text-yellow-700 border border-yellow-200 animate-pulse">{t('status_awaiting_confirmation')}</span>;
            case ManualTopupStatus.PAID: return <span className="px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-tighter bg-green-100 text-green-700 border border-green-200">{t('status_paid')}</span>;
            case ManualTopupStatus.REJECTED: return <span className="px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-tighter bg-red-100 text-red-700 border border-red-200">{t('status_rejected')}</span>;
        }
    };
  
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
            <h3 className="font-black text-gray-900 uppercase text-xs tracking-widest">{t('menu_manual_payments')}</h3>
            <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-[10px] font-black uppercase">
                {topups.filter(t => t.status === ManualTopupStatus.AWAITING_CONFIRMATION).length} Pending
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">User</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Amount</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Reference</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Receipt</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                    <tr><td colSpan={6} className="text-center p-8 text-gray-400"><i className="fas fa-spinner fa-spin"></i></td></tr>
                ) : topups.length === 0 ? (
                    <tr><td colSpan={6} className="text-center p-8 text-gray-400 font-bold">{t('no_pending_manual_payments')}</td></tr>
                ) : (
                    topups.map(topup => (
                        <tr key={topup.id} className="hover:bg-gray-50/50">
                            <td className="px-6 py-4 font-bold text-sm">{topup.userName}</td>
                            <td className="px-6 py-4 font-black text-gray-900">{topup.amount} {t('currency')}</td>
                            <td className="px-6 py-4 font-mono text-xs text-gray-500">{topup.referenceCode}</td>
                            <td className="px-6 py-4">{getStatusChip(topup.status)}</td>
                            <td className="px-6 py-4">
                                {topup.receiptUrl ? (
                                    <button onClick={() => setReceiptModalUrl(topup.receiptUrl!)} className="text-blue-500 font-bold text-xs hover:underline">{t('view_receipt')}</button>
                                ) : '---'}
                            </td>
                            <td className="px-6 py-4">
                                {topup.status === 'AWAITING_CONFIRMATION' && (
                                    <div className="flex gap-2">
                                        <Button onClick={() => handleConfirm(topup.id)} isLoading={processingId === topup.id} className="h-9 px-3 text-xs bg-green-500 text-white shadow-sm">Confirm</Button>
                                        <Button onClick={() => setRejectingId(topup.id)} isLoading={processingId === topup.id} className="h-9 px-3 text-xs bg-red-500 text-white shadow-sm">Reject</Button>
                                    </div>
                                )}
                            </td>
                        </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {receiptModalUrl && (
            <div className="fixed inset-0 z-[110] bg-black/80 flex items-center justify-center p-4" onClick={() => setReceiptModalUrl(null)}>
                <img src={receiptModalUrl} className="max-w-full max-h-full object-contain rounded-lg" />
            </div>
        )}

        {rejectingId && (
            <div className="fixed inset-0 z-[110] bg-black/80 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
                    <h3 className="font-bold text-lg mb-4">{t('reject_payment')}</h3>
                    <textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} className="w-full p-2 bg-gray-100 rounded-lg border border-gray-200 mb-4" placeholder={t('reason_for_rejection')}></textarea>
                    <div className="flex gap-2">
                        <Button onClick={() => setRejectingId(null)} variant="secondary" className="flex-1">Cancel</Button>
                        <Button onClick={handleReject} isLoading={processingId === rejectingId} variant="danger" className="flex-1">Reject</Button>
                    </div>
                </div>
            </div>
        )}
      </div>
    );
  };

const StatCard = ({ label, value, icon, color, onClick, highlight, badge }: any) => (
    <div 
        onClick={onClick}
        className={`bg-white p-8 rounded-[32px] shadow-sm border transition-all group relative overflow-hidden ${
            onClick ? 'cursor-pointer hover:shadow-lg hover:border-blue-300 active:scale-[0.99]' : 'hover:shadow-md'
        } ${highlight ? 'border-amber-300 ring-2 ring-amber-100 bg-gradient-to-br from-white to-amber-50/30' : 'border-gray-100'}`}
    >
        <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
                <div className={`w-10 h-10 ${color} text-white rounded-2xl flex items-center justify-center text-xl shadow-lg group-hover:scale-110 transition-transform`}>
                    <i className={`fas ${icon}`}></i>
                </div>
                {badge !== undefined && (
                    <span className="px-2.5 py-1 bg-red-100 text-red-700 text-[10px] font-black uppercase rounded-full animate-pulse flex items-center gap-1">
                        <i className="fas fa-bell text-[8px]"></i>
                        {badge}
                    </span>
                )}
            </div>
            <div className="text-3xl font-black text-gray-900 mb-1">{value}</div>
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center justify-between">
                <span>{label}</span>
                {onClick && <i className="fas fa-arrow-right text-gray-300 group-hover:text-blue-500 transition-colors text-xs"></i>}
            </div>
        </div>
        <div className={`absolute top-0 right-0 w-32 h-32 ${color} opacity-[0.03] rounded-bl-full`}></div>
    </div>
);

const MetricBar = ({ label, value, max, color }: any) => {
    const percentage = Math.round((value / max) * 100) || 0;
    return (
        <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                <span className="text-gray-400">{label}</span>
                <span className="text-white">{percentage}%</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full ${color} transition-all duration-1000`} style={{ width: `${percentage}%` }}></div>
            </div>
        </div>
    );
};

const PricingInput = ({ label, value, onChange, prefix, highlighted }: any) => {
    const { isRTL } = useLanguage();
    return (
    <div className={`p-6 rounded-3xl border transition-all ${highlighted ? 'bg-blue-50 border-blue-100 shadow-sm ring-4 ring-blue-50' : 'bg-gray-50 border-gray-100'}`}>
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">{label}</label>
        <div className="relative">
            <input 
                type="number" 
                value={value} 
                onChange={e => onChange(Number(e.target.value))} 
                className={`w-full bg-white p-4 rounded-xl font-black text-2xl outline-none focus:ring-2 focus:ring-[#FFC90E] transition-all border border-gray-100 ${highlighted ? 'text-blue-600' : 'text-gray-900'} ${isRTL ? 'pl-16' : 'pr-16'}`}
            />
            <span className={`absolute top-1/2 -translate-y-1/2 text-xs font-bold text-gray-300 ${isRTL ? 'left-4' : 'right-4'}`}>{prefix || 'EGP'}</span>
        </div>
    </div>
)};

const DocPreview = ({ label, url }: { label: string, url?: string }) => (
    <div className="group cursor-zoom-in">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">{label}</p>
        <div className="relative aspect-[4/3] rounded-[24px] bg-gray-100 border-2 border-dashed border-gray-200 overflow-hidden group-hover:border-blue-400 transition-colors">
            {url ? (
                <>
                    <img src={url} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-gray-900 shadow-xl"><i className="fas fa-search-plus"></i></div>
                    </div>
                </>
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-2">
                    <i className="fas fa-image text-3xl opacity-20"></i>
                    <span className="text-[10px] font-black uppercase">Not Provided</span>
                </div>
            )}
        </div>
    </div>
);

const DetailField = ({ label, value, isMono, valueClass }: any) => (
    <div>
        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</div>
        <div className={`font-black text-sm truncate ${isMono ? 'font-mono tracking-widest' : ''} ${valueClass || 'text-gray-800'}`}>{value || '---'}</div>
    </div>
);
