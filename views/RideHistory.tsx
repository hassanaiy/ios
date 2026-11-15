
import React, { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Ride, RideStatus, User, Driver, PaymentMethod } from '../types';
import { getUserRides, getUserProfile, hideRideFromHistory } from '../services/firebaseBridge';
import { Button } from '../components/ui/Button';
import { ChatPanel } from '../components/ChatPanel';

interface RideHistoryProps {
  user: User | Driver;
  onBack: () => void;
  onRebook?: (ride: Ride, preferSameDriver: boolean) => void;
}

type Tab = 'ALL' | 'COMPLETED' | 'CANCELLED' | 'PENDING';

export default function RideHistory({ user, onBack, onRebook }: RideHistoryProps) {
  const { t, isRTL, language } = useLanguage();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('ALL');
  const [driversMap, setDriversMap] = useState<{[key:string]: Driver}>({});
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [isViewingChat, setIsViewingChat] = useState(false);

  const fetchHistory = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const history = await getUserRides(user.id, user.role);
      setRides(history);
      
      const driverIds = Array.from(new Set(history.map(r => r.driverId).filter((id): id is string => !!id))) as string[];
      if (driverIds.length > 0) {
          const promises = driverIds.map(async (did) => {
              const p = await getUserProfile(did);
              return { id: did, profile: p as Driver };
          });
          const results = await Promise.all(promises);
          const map: Record<string, Driver> = {};
          results.forEach(r => {
              if (r.id) map[r.id] = r.profile;
          });
          setDriversMap(map);
      }
    } catch (error) {
      console.error("Failed to fetch ride history", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [user]);

  const handleDelete = async (e: React.MouseEvent, rideId: string) => {
      e.stopPropagation();
      if (window.confirm(t('delete_ride_confirm'))) {
          try {
              // Fix: Soft-delete for users history only
              await hideRideFromHistory(rideId, user.role);
              setRides(prev => prev.filter(r => r.id !== rideId));
              if (selectedRide?.id === rideId) setSelectedRide(null);
          } catch (err) {
              console.error("Delete failed", err);
              alert(isRTL ? "فشل حذف الرحلة" : "Failed to delete ride");
          }
      }
  };

  const handleClearAll = async () => {
      if (window.confirm(t('clear_history_confirm'))) {
          setLoading(true);
          try {
              const visibleRides = filteredRides;
              // Parallel soft-deletion for better performance
              await Promise.all(visibleRides.map(r => hideRideFromHistory(r.id, user.role)));
              await fetchHistory();
          } catch (error) {
              console.error("Failed to clear history", error);
              alert(isRTL ? "حدث خطأ أثناء مسح السجل" : "Error clearing history");
              await fetchHistory();
          } finally {
              setLoading(false);
          }
      }
  };

  const getStatusLabel = (status: RideStatus) => {
    switch (status) {
      case RideStatus.SEARCHING: return t('status_searching');
      case RideStatus.OFFER_RECEIVED: return t('status_offer_received');
      case RideStatus.ACCEPTED: return t('status_accepted');
      case RideStatus.ARRIVED: return t('status_arrived');
      case RideStatus.IN_PROGRESS: return t('status_in_progress');
      case RideStatus.COMPLETED: return t('status_completed');
      case RideStatus.CANCELLED: return t('status_cancelled');
      case RideStatus.IDLE: return t('status_idle');
      default: return status;
    }
  };

  const filteredRides = rides.filter(ride => {
      if (activeTab === 'ALL') return true;
      if (activeTab === 'COMPLETED') return ride.status === RideStatus.COMPLETED;
      if (activeTab === 'CANCELLED') return ride.status === RideStatus.CANCELLED;
      if (activeTab === 'PENDING') {
          return [RideStatus.ACCEPTED, RideStatus.ARRIVED, RideStatus.IN_PROGRESS].includes(ride.status);
      }
      return true;
  });

  const TabButton = ({ id, label }: { id: Tab, label: string }) => (
      <button 
        onClick={() => setActiveTab(id)}
        className={`flex-1 py-4 text-xs font-black uppercase tracking-widest border-b-4 transition-all ${
            activeTab === id 
            ? 'border-[#FFC90E] text-black' 
            : 'border-transparent text-gray-300 hover:text-gray-50'
        }`}
      >
          {label}
      </button>
  );

  const isPassenger = user.role.toUpperCase() === 'PASSENGER';

  if (isViewingChat && selectedRide) {
      const driver = selectedRide.driverId ? driversMap[selectedRide.driverId] : null;
      return (
          <ChatPanel 
            rideId={selectedRide.id} 
            currentUserId={user.id} 
            otherUserName={driver?.name || t('driver')} 
            onClose={() => setIsViewingChat(false)} 
            isPassenger={isPassenger} 
            passengerId={isPassenger ? user.id : selectedRide.passengerId}
          />
      );
  }

  return (
    <div className="h-full w-full bg-[#F8F9FB] flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-white px-4 pt-safe shadow-sm z-10 shrink-0">
        <div className="flex items-center justify-between mb-4 mt-2">
            <div className="flex items-center gap-4">
                <button 
                  onClick={onBack} 
                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 bg-gray-50 text-gray-600 transition-all active:scale-90"
                  title={t('back')}
                >
                    <i className={`fas ${isRTL ? 'fa-arrow-right' : 'fa-arrow-left'} text-lg`}></i>
                </button>
                <h1 className="text-xl font-black text-gray-900 tracking-tight">{t('rides')}</h1>
            </div>
            {filteredRides.length > 0 && (
                <button 
                  onClick={handleClearAll} 
                  className="text-[10px] font-black tracking-widest uppercase text-red-500 hover:bg-red-50 px-4 py-2 rounded-xl transition-all flex items-center gap-2 active:scale-95 border border-transparent hover:border-red-100"
                >
                    <i className="fas fa-trash-alt text-[10px]"></i> {t('clear_history')}
                </button>
            )}
        </div>
        
        <div className="flex border-b border-gray-100 overflow-x-auto hide-scrollbar">
            <TabButton id="ALL" label={t('tab_all')} />
            <TabButton id="COMPLETED" label={t('tab_completed')} />
            <TabButton id="CANCELLED" label={t('tab_cancelled')} />
            <TabButton id="PENDING" label={t('tab_pending')} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-40 gap-4">
             <div className="w-10 h-10 border-4 border-gray-100 border-t-[#FFC90E] rounded-full animate-spin"></div>
            <span className="text-sm font-bold text-gray-400">{t('loading_trips', 'Loading your trips...', 'جاري تحميل رحلاتك...')}</span>
          </div>
        ) : filteredRides.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-300">
             <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-inner mb-6">
                <i className="fas fa-history text-4xl opacity-20"></i>
             </div>
             <p className="font-bold text-sm">{t('no_data_found')}</p>
          </div>
        ) : (
          filteredRides.map((ride, idx) => {
            const driver = ride.driverId ? driversMap[ride.driverId] : null;
            const isCancelled = ride.status === RideStatus.CANCELLED;
            
            return (
            <div 
                key={ride.id} 
                onClick={() => setSelectedRide(ride)}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md active:scale-[0.99] transition-all cursor-pointer group relative animate-fade-in-up"
                style={{ animationDelay: `${idx * 50}ms` }}
            >
              <button 
                  onClick={(e) => handleDelete(e, ride.id)}
                  className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all flex items-center justify-center z-10 shadow-md border border-gray-100 group-hover:scale-110 active:scale-90"
                  title={t('delete_ride_confirm')}
              >
                  <i className="fas fa-trash-alt text-sm"></i>
              </button>

              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                   <div className={`w-10 h-10 ${isCancelled ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-gray-500'} rounded-xl flex items-center justify-center shadow-sm`}>
                      <i className={`fas ${ride.rideType === 'PARCEL' ? 'fa-box-open' : 'fa-car'} text-sm`}></i>
                   </div>
                   <div>
                      <div className="font-black text-gray-900 leading-none mb-1 text-sm flex items-center gap-1.5 flex-wrap">
                         <span>{new Date(ride.scheduledPickupAt || ride.timestamp).toLocaleDateString()}</span>
                         {ride.isScheduled && (
                           <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-[9px] font-black">
                             {isRTL ? 'مجدولة' : 'Scheduled'}
                           </span>
                         )}
                         {ride.bookingType === 'FOR_OTHER' && (
                           <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[9px] font-black">
                             {t('for_other_badge')}
                           </span>
                         )}
                      </div>
                      <div className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">
                         {new Date(ride.scheduledPickupAt || ride.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                         {ride.bookingType === 'FOR_OTHER' && ride.actualPassenger?.name && (
                           <span className="text-blue-600 mx-1">
                             • {t('actual_passenger')}: {ride.actualPassenger.name}
                           </span>
                         )}
                      </div>
                   </div>
                </div>
                <div className="text-right">
                   <div className="font-black text-lg text-gray-900 leading-none mb-1" dir="ltr">
                       {ride.fare} <span className="text-[10px] font-bold text-gray-400">{t('currency')}</span>
                   </div>
                   <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-tighter shadow-sm border ${
                       ride.status === RideStatus.COMPLETED ? 'bg-green-50 text-green-700 border-green-100' : 
                       ride.status === RideStatus.CANCELLED || ride.scheduleStatus === 'NO_DRIVER_FOUND' ? 'bg-red-50 text-red-700 border-red-100' : 
                       ride.isScheduled ? 'bg-amber-50 text-amber-700 border-amber-100' :
                       'bg-blue-50 text-blue-700 border-blue-100'
                    }`}>
                      {getStatusLabel(ride.status)}
                   </span>
                </div>
              </div>

              <div className="relative mb-4">
                <div className={`absolute top-2 bottom-2 ${isRTL ? 'right-1.5' : 'left-1.5'} w-0.5 border-l-2 border-dashed border-gray-100`}></div>
                
                <div className="flex items-start gap-3 mb-3 relative">
                   <div className="w-2.5 h-2.5 bg-green-500 rounded-full ring-4 ring-white shadow-sm mt-1 z-10"></div>
                   <div className="flex-1 min-w-0">
                      <div className="text-[8px] text-gray-400 font-black uppercase tracking-widest mb-0.5">{t('pickup_loc')}</div>
                      <div className="text-xs font-bold text-gray-800 truncate" dir="auto">{ride.pickup.address}</div>
                   </div>
                </div>

                <div className="flex items-start gap-3 relative">
                   <div className="w-2.5 h-2.5 bg-red-500 rounded-none ring-4 ring-white shadow-sm mt-1 z-10"></div>
                   <div className="flex-1 min-w-0">
                      <div className="text-[8px] text-gray-400 font-black uppercase tracking-widest mb-0.5">{t('dropoff_loc')}</div>
                      <div className="text-xs font-bold text-gray-800 truncate" dir="auto">{ride.dropoff.address}</div>
                   </div>
                </div>
              </div>

              {user.role === 'PASSENGER' && (ride.status === RideStatus.COMPLETED || ride.status === RideStatus.CANCELLED) && (
                  <div className="flex gap-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); if (onRebook) onRebook(ride, false); }}
                        className="flex-1 h-9 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-black text-gray-700 hover:bg-gray-100 transition-colors flex items-center justify-center gap-1.5 uppercase tracking-wider active:scale-95"
                      >
                          <i className="fas fa-redo text-[9px]"></i> {t('book_again')}
                      </button>
                      {ride.driverId && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); if (onRebook) onRebook(ride, true); }}
                            className="flex-1 h-9 bg-[#FFC90E] rounded-xl text-[10px] font-black text-black hover:bg-orange-500 transition-colors flex items-center justify-center gap-1.5 uppercase tracking-wider shadow-lg shadow-yellow-100 active:scale-95"
                          >
                              <i className="fas fa-user-check text-[9px]"></i> {driver ? `${t('book_driver')} ${driver.name.split(' ')[0]}` : t('book_same_driver')}
                          </button>
                      )}
                  </div>
              )}
            </div>
          )})
        )}
      </div>

      {selectedRide && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end justify-center animate-fade-in" onClick={() => setSelectedRide(null)}>
              <div 
                className="bg-white w-full max-w-lg rounded-t-[32px] p-6 pb-safe animate-slide-up shadow-2xl" 
                onClick={e => e.stopPropagation()}
              >
                  <div className="w-10 h-1 bg-gray-100 rounded-full mx-auto mb-6 opacity-50"></div>
                  
                  <div className="flex justify-between items-start mb-6">
                      <div>
                          <h2 className="text-2xl font-black text-gray-900 leading-tight mb-1.5">{t('trip_details')}</h2>
                          <div className="bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100 flex items-center gap-2 w-fit">
                              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{t('ride_id_label')}</span>
                              <span className="text-[10px] font-mono font-bold text-gray-600">#{selectedRide.id.slice(0, 12)}</span>
                          </div>
                      </div>
                      <div className="text-right">
                          <div className="text-3xl font-black text-gray-900 mb-1" dir="ltr">{selectedRide.fare} <span className="text-xs font-bold text-gray-400">{t('currency')}</span></div>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider border ${
                               selectedRide.status === RideStatus.COMPLETED ? 'bg-green-50 text-green-700 border-green-100' : 
                               selectedRide.status === RideStatus.CANCELLED ? 'bg-red-50 text-red-700 border-red-100' : 
                               'bg-blue-50 text-blue-700 border-blue-100'
                            }`}>
                               {getStatusLabel(selectedRide.status)}
                            </span>
                      </div>
                  </div>

                  <div className="space-y-4 mb-8">
                      <div className="flex gap-3">
                          <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center shrink-0 shadow-sm text-sm"><i className="fas fa-calendar-alt"></i></div>
                          <div>
                              <div className="text-[9px] text-gray-400 font-black uppercase tracking-widest mb-0.5">{t('pickup_time')}</div>
                              <div className="font-bold text-gray-800 text-sm">{new Date(selectedRide.timestamp).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}</div>
                          </div>
                      </div>

                      {selectedRide.bookingType === 'FOR_OTHER' && selectedRide.actualPassenger && (
                          <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-xs space-y-1">
                              <div className="flex items-center justify-between">
                                  <span className="font-black text-blue-900">
                                      {t('actual_passenger')}: {selectedRide.actualPassenger.name}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[9px] font-black">
                                      {t('for_other_badge')}
                                  </span>
                              </div>
                              <div className="font-mono font-bold text-blue-700" dir="ltr">
                                  {selectedRide.actualPassenger.phone}
                              </div>
                              {selectedRide.actualPassenger.note && (
                                  <div className="text-gray-700 font-bold">
                                      {t('driver_notes')}: {selectedRide.actualPassenger.note}
                                  </div>
                              )}
                          </div>
                      )}

                      <div className="bg-gray-50/50 p-4 rounded-[24px] border border-gray-100 space-y-3">
                          <div className="flex items-start gap-3">
                              <div className="w-2.5 h-2.5 bg-green-500 rounded-full mt-1 shadow-sm"></div>
                              <div>
                                  <div className="text-[8px] text-gray-400 font-black uppercase tracking-widest mb-0.5">{t('pickup_loc')}</div>
                                  <div className="text-xs font-bold text-gray-800 leading-relaxed">{selectedRide.pickup.address}</div>
                              </div>
                          </div>
                          <div className="flex items-start gap-3">
                              <div className="w-2.5 h-2.5 bg-red-500 rounded-none mt-1 shadow-sm"></div>
                              <div>
                                  <div className="text-[8px] text-gray-400 font-black uppercase tracking-widest mb-0.5">{t('dropoff_loc')}</div>
                                  <div className="text-xs font-bold text-gray-800 leading-relaxed">{selectedRide.dropoff.address}</div>
                              </div>
                          </div>
                      </div>
                  </div>

                  {selectedRide.driverId && driversMap[selectedRide.driverId] && (
                       <div className="mb-6 p-3 bg-gray-50 rounded-2xl border border-gray-100 flex items-center gap-3">
                           <img src={driversMap[selectedRide.driverId].avatar} className="w-12 h-12 rounded-xl object-cover shadow-sm border-2 border-white" alt="driver" />
                           <div className="flex-1">
                               <div className="text-[8px] text-gray-400 font-black uppercase tracking-widest mb-0.5">{t('driver_details_label')}</div>
                               <div className="font-black text-gray-900 text-sm">{driversMap[selectedRide.driverId].name}</div>
                               <div className="text-[10px] text-gray-500 font-bold">{driversMap[selectedRide.driverId].vehicleBrand} {driversMap[selectedRide.driverId].vehicleModel}</div>
                           </div>
                           <div className="bg-white px-2 py-1 rounded-lg border border-gray-100 shadow-sm text-center">
                               <div className="text-[7px] text-gray-400 font-black uppercase mb-0.5">Rating</div>
                               <div className="text-xs font-black text-yellow-500"><i className="fas fa-star mr-0.5"></i> {Number(selectedRide.rating || driversMap[selectedRide.driverId].rating || 5).toFixed(1)}</div>
                           </div>
                       </div>
                  )}

                  <div className="grid grid-cols-1 gap-2">
                      <div className="flex gap-2">
                        <Button 
                            onClick={() => setIsViewingChat(true)} 
                            className="flex-1 h-12 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest shadow-lg shadow-blue-200 text-xs"
                        >
                            <i className="fas fa-comment-dots mr-1.5"></i> {t('view_chat')}
                        </Button>
                        <Button onClick={() => setSelectedRide(null)} className="flex-1 h-12 bg-gray-900 text-white rounded-xl font-black uppercase tracking-widest text-xs">{t('close')}</Button>
                      </div>
                      <button 
                          onClick={(e) => handleDelete(e, selectedRide.id)}
                          className="w-full h-10 mt-2 text-red-500 font-black uppercase tracking-widest text-xs hover:bg-red-50 rounded-xl transition-colors active:scale-95 flex items-center justify-center gap-2"
                      >
                          <i className="fas fa-trash-alt"></i>
                          {t('delete_ride_confirm').split('?')[0]}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
