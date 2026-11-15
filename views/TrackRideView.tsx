import React, { useState, useEffect } from 'react';
import { DynamicMap as Map } from '../components/DynamicMap';
import { useLanguage } from '../contexts/LanguageContext';
import { Ride, RideStatus, Driver } from '../types';
import { subscribeToPublicTrackedRide, getUserProfile } from '../services/firebase';

interface Props {
    rideId: string;
    onClose: () => void;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

export default function TrackRideView({ rideId, onClose }: Props) {
    const { t, isRTL } = useLanguage();
    const [ride, setRide] = useState<Ride | null>(null);
    const [driver, setDriver] = useState<Driver | null>(null);
    const [eta, setEta] = useState<string>('');
    const [isExpired, setIsExpired] = useState<boolean>(false);
    const [isInvalidToken, setIsInvalidToken] = useState<boolean>(false);

    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const tokenParam = searchParams.get('token');
        const unsub = subscribeToPublicTrackedRide(rideId, tokenParam, async (updatedRide, meta) => {
            setIsExpired(Boolean(meta?.expired));
            setIsInvalidToken(Boolean(meta?.invalidToken));
            setRide(updatedRide);
            if (updatedRide?.driverId) {
                try {
                    const driverData = await getUserProfile(updatedRide.driverId);
                    if (driverData) {
                        setDriver(driverData as Driver);
                    }
                } catch (e) {
                    console.log('Driver profile restricted for public view, or error:', e);
                }
            }
        });
        return () => unsub();
    }, [rideId]);

    useEffect(() => {
        if (ride?.driverLocation && ride?.pickup?.coords && ride.status === RideStatus.ACCEPTED) {
            const dist = calculateDistance(
                ride.driverLocation.lat, ride.driverLocation.lng,
                ride.pickup.coords.lat, ride.pickup.coords.lng
            );
            const timeMins = Math.max(1, Math.ceil(dist * 3));
            setEta(`${timeMins} min`);
        } else if (ride?.driverLocation && ride?.dropoff?.coords && ride.status === RideStatus.IN_PROGRESS) {
            const dist = calculateDistance(
                ride.driverLocation.lat, ride.driverLocation.lng,
                ride.dropoff.coords.lat, ride.dropoff.coords.lng
            );
            const timeMins = Math.max(1, Math.ceil(dist * 3));
            setEta(`${timeMins} min`);
        } else {
            setEta('');
        }
    }, [ride]);

    const isTripActive = Boolean(
        ride &&
        !isExpired &&
        !isInvalidToken &&
        [RideStatus.ACCEPTED, RideStatus.ARRIVED, RideStatus.IN_PROGRESS].includes(ride.status)
    );
    
    const drivers = [];
    if (isTripActive && ride?.driverLocation) {
        drivers.push({
            id: driver?.id || ride.driverId || 'driver',
            lat: ride.driverLocation.lat,
            lng: ride.driverLocation.lng,
            heading: ride.driverHeading || 0
        });
    }

    const statusBadgeText = () => {
        if (!ride) return '';
        switch (ride.status) {
            case RideStatus.ACCEPTED:
                return isRTL ? 'الكابتن في الطريق للاستلام' : 'Captain on the way to pickup';
            case RideStatus.ARRIVED:
                return isRTL ? 'الكابتن وصل نقطة الاستلام' : 'Captain arrived at pickup';
            case RideStatus.IN_PROGRESS:
                return isRTL ? 'الرحلة جارية الآن' : 'Ride in progress';
            case RideStatus.COMPLETED:
                return isRTL ? 'وصل بأمان - اكتملت الرحلة' : 'Arrived safely - Ride completed';
            case RideStatus.CANCELLED:
                return isRTL ? 'تم إلغاء الرحلة' : 'Ride cancelled';
            default:
                return isRTL ? 'جاري البحث عن كابتن' : 'Searching for captain';
        }
    };

    if (isInvalidToken) {
        return (
            <div className="absolute inset-0 bg-white z-[60] flex flex-col items-center justify-center p-6 text-center font-sans">
                <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-4">
                    <i className="fas fa-shield-alt text-2xl"></i>
                </div>
                <h2 className="font-black text-xl text-gray-900 mb-2">
                    {isRTL ? 'رابط التتبع غير صالح' : 'Invalid Tracking Link'}
                </h2>
                <p className="text-gray-500 text-sm font-bold max-w-xs">
                    {isRTL ? 'يرجى التأكد من فتح الرابط الكامل المرسل من صاحب الحجز.' : 'Please make sure you opened the complete link shared by the booking owner.'}
                </p>
            </div>
        );
    }

    return (
        <div className="absolute inset-0 bg-white z-[60] flex flex-col font-sans" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="absolute top-safe left-4 z-10 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg active:scale-95 cursor-pointer" onClick={onClose}>
                <i className={`fas fa-arrow-${isRTL ? 'right' : 'left'} text-lg text-gray-700`}></i>
            </div>
            
            {/* Live Tracking Header Badge */}
            {isTripActive && (
               <div className="absolute top-safe right-4 z-10 bg-white/95 backdrop-blur-md px-4 py-2 rounded-full shadow-lg flex items-center gap-2 border border-green-100">
                   <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
                   <span className="text-xs font-black text-green-700 uppercase tracking-wider">{statusBadgeText()}</span>
               </div>
            )}

            {ride ? (
                <>
                    <div className="flex-1 relative">
                        <Map 
                            pickup={ride.pickup?.coords} 
                            dropoff={ride.dropoff?.coords} 
                            pickupAddress={ride.pickup?.address} 
                            dropoffAddress={ride.dropoff?.address}
                            drivers={drivers as any} 
                            showRoute={isTripActive}
                            mapHeight="100%"
                        />
                    </div>
                    {isTripActive ? (
                        <div className="bg-white rounded-t-[32px] p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-20 pb-safe relative">
                            {ride.bookingType === 'FOR_OTHER' && ride.actualPassenger && (
                                <div className="mb-4 px-3.5 py-2.5 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="px-2.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-black">
                                            {t('for_other_badge')}
                                        </span>
                                        <span className="text-xs font-black text-gray-900">
                                            {t('actual_passenger')}: {ride.actualPassenger.name}
                                        </span>
                                    </div>
                                    <span className="text-[11px] font-bold text-blue-700">
                                        {statusBadgeText()}
                                    </span>
                                </div>
                            )}

                            {driver && (
                                <div className="flex justify-between items-start mb-5">
                                    <div className="flex items-center gap-4">
                                        <div className="relative">
                                            <img src={driver.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(driver.name)}&background=random`} className="w-16 h-16 rounded-full border-2 border-gray-100 object-cover shadow-sm" alt={driver.name} />
                                            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#FFC90E] rounded-full flex items-center justify-center border-2 border-white">
                                                <i className="fas fa-star text-[10px] text-black"></i>
                                                <span className="text-[10px] font-black tracking-tighter ml-0.5">{driver.rating || '5.0'}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1.5">
                                                <h3 className="font-black text-xl text-gray-900">{driver.name.split(' ')[0]}</h3>
                                                <i className="fas fa-check-circle text-blue-500 text-sm" title={isRTL ? 'كابتن موثق' : 'Verified Captain'}></i>
                                            </div>
                                            <p className="text-gray-500 font-bold text-sm tracking-tight">{driver.vehicleBrand} {driver.vehicleModel} • {driver.vehicleColor}</p>
                                            <div className="mt-1 inline-block bg-[#FFC90E]/30 border border-[#FFC90E] px-2.5 py-0.5 rounded text-xs font-black font-mono tracking-widest text-gray-900">{driver.vehiclePlate}</div>
                                        </div>
                                    </div>
                                    {eta && (
                                        <div className="text-right flex flex-col items-end">
                                            <div className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-0.5">{isRTL ? 'الوقت المتبقي' : 'ETA'}</div>
                                            <div className="text-2xl font-black text-blue-600 leading-none">{eta.split(' ')[0]}</div>
                                            <div className="text-xs font-bold text-blue-500 uppercase">{eta.split(' ')[1]}</div>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            <div className="space-y-2">
                                <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                                        <i className="fas fa-dot-circle text-sm"></i>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[10px] font-black text-gray-400 tracking-widest uppercase">{t('pickup_location')}</div>
                                        <div className="text-sm font-bold text-gray-900 truncate" dir="auto">{ride.pickup?.address}</div>
                                    </div>
                                </div>
                                
                                {ride.dropoff && (
                                    <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                                        <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                                            <i className="fas fa-location-dot text-sm"></i>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[10px] font-black text-gray-400 tracking-widest uppercase">{t('dropoff_location')}</div>
                                            <div className="text-sm font-bold text-gray-900 truncate" dir="auto">{ride.dropoff?.address}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (ride.status === RideStatus.COMPLETED || isExpired) ? (
                        <div className="bg-white p-8 shadow-2xl z-20 pb-safe rounded-t-[32px] text-center">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <i className="fas fa-check text-3xl"></i>
                            </div>
                            <div className="font-black text-2xl text-gray-900 mb-2">{isRTL ? 'انتهت متابعة الرحلة' : 'Live Tracking Ended'}</div>
                            <p className="text-gray-500 font-medium">{isRTL ? 'اكتملت هذه الرحلة وتم إيقاف مشاركة الموقع المباشر حفاظاً على الخصوصية.' : 'This ride has ended and live location sharing is now disabled for privacy.'}</p>
                        </div>
                    ) : (ride.status === RideStatus.CANCELLED) ? (
                        <div className="bg-white p-8 shadow-2xl z-20 pb-safe rounded-t-[32px] text-center">
                            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <i className="fas fa-times text-3xl"></i>
                            </div>
                            <div className="font-black text-2xl text-gray-900 mb-2">{isRTL ? 'الرحلة ملغاة' : 'Ride Cancelled'}</div>
                        </div>
                    ) : (
                        <div className="bg-white p-8 shadow-2xl z-20 pb-safe rounded-t-[32px] text-center">
                            <i className="fas fa-search text-3xl text-gray-300 mb-4 inline-block animate-pulse"></i>
                            <div className="font-black text-xl text-gray-900 mb-2">{isRTL ? 'البحث عن كابتن' : 'Waiting for Captain'}</div>
                        </div>
                    )}
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-gray-50 z-50">
                    <div className="w-16 h-16 bg-white shadow-lg rounded-full flex items-center justify-center mb-6">
                        <i className="fas fa-map-marker-alt text-2xl text-blue-500 animate-bounce"></i>
                    </div>
                    <h2 className="font-black text-xl text-gray-900 mb-2">{isRTL ? 'جاري تأمين الرابط...' : 'Securing live link...'}</h2>
                    <p className="text-gray-500 font-medium">{isRTL ? 'لحظات ونعرض لك التتبع المباشر للرحلة' : 'Loading real-time ride tracking details'}</p>
                </div>
            )}
        </div>
    );
}

