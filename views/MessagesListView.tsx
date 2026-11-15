
import React, { useState, useEffect } from 'react';
import { User, Driver, Ride } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { subscribeToChatHistory, getUserProfile } from '../services/firebaseBridge';
import { ChatPanel } from '../components/ChatPanel';

interface MessagesListViewProps {
  user: User;
  onBack: () => void;
}

export default function MessagesListView({ user, onBack }: MessagesListViewProps) {
  const { t, isRTL } = useLanguage();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [driversMap, setDriversMap] = useState<{[key:string]: Driver}>({});

  useEffect(() => {
    const unsub = subscribeToChatHistory(user.id, user.role, async (chatRides) => {
        setRides(chatRides);
        setLoading(false);

        // Fetch driver profiles for the list
        const driverIds = Array.from(new Set(chatRides.map(r => r.driverId).filter(Boolean)));
        if (driverIds.length > 0) {
            const promises = driverIds.map(async (id) => {
                const profile = await getUserProfile(id!);
                return { id, profile: profile as Driver };
            });
            const results = await Promise.all(promises);
            const map: Record<string, Driver> = {};
            results.forEach(r => { 
                if(r.profile && r.id) map[r.id] = r.profile; 
            });
            setDriversMap(prev => ({ ...prev, ...map }));
        }
    });
    return () => unsub();
  }, [user.id, user.role]);

  const formatTime = (timestamp: any) => {
      if (!timestamp) return '';
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (selectedRide) {
      const driver = selectedRide.driverId ? driversMap[selectedRide.driverId] : null;
      return (
          <ChatPanel 
            rideId={selectedRide.id} 
            currentUserId={user.id} 
            otherUserName={driver?.name || t('driver')} 
            onClose={() => setSelectedRide(null)} 
            isPassenger={true} 
            passengerId={user.id}
          />
      );
  }

  return (
    <div className="h-full w-full bg-white flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="p-4 pt-safe flex items-center gap-4 border-b border-gray-50 shadow-sm z-10 bg-white">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition-colors">
            <i className={`fas ${isRTL ? 'fa-arrow-right' : 'fa-arrow-left'}`}></i>
        </button>
        <h1 className="font-black text-xl text-gray-900">{t('messages_label')}</h1>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
          {loading ? (
              <div className="p-10 text-center text-gray-400">
                  <i className="fas fa-spinner fa-spin text-2xl mb-2"></i>
                  <p className="font-bold">{isRTL ? "جاري التحميل..." : "Loading messages..."}</p>
              </div>
          ) : rides.length === 0 ? (
              <div className="p-10 flex flex-col items-center justify-center h-64 text-gray-400 text-center">
                  <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                      <i className="fas fa-comment-slash text-3xl opacity-20"></i>
                  </div>
                  <p className="font-black text-lg text-gray-300">{isRTL ? "لا توجد رسائل بعد" : "No messages yet"}</p>
                  <p className="text-sm mt-1">{isRTL ? "ستظهر محادثاتك مع السائقين هنا" : "Your chats with drivers will appear here"}</p>
              </div>
          ) : (
              <div className="p-4 space-y-3">
                  {rides.map(ride => {
                      const driver = ride.driverId ? driversMap[ride.driverId] : null;
                      return (
                          <div 
                            key={ride.id}
                            onClick={() => setSelectedRide(ride)}
                            className="bg-gray-50 p-4 rounded-[28px] border border-gray-100 flex items-center gap-4 active:scale-[0.98] transition-all cursor-pointer relative group overflow-hidden"
                          >
                              <div className="absolute top-0 left-0 w-1.5 h-full bg-[#FFC90E] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                              
                              <img 
                                src={driver?.avatar || `https://ui-avatars.com/api/?name=${driver?.name || 'Driver'}`} 
                                className="w-14 h-14 rounded-full border-2 border-white shadow-sm object-cover" 
                                alt="Driver"
                              />
                              
                              <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-center mb-0.5">
                                      <h3 className="font-black text-gray-900 truncate pr-2">{driver?.name || t('driver')}</h3>
                                      <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap">{formatTime(ride.lastMessageAt)}</span>
                                  </div>
                                  <p className="text-sm text-gray-500 font-medium truncate italic" dir="auto">
                                      "{ride.lastMessage}"
                                  </p>
                                  <div className="flex items-center gap-2 mt-1">
                                      <span className="text-[10px] bg-white border border-gray-200 px-2 py-0.5 rounded-md font-black text-gray-400">
                                          {new Date(ride.timestamp).toLocaleDateString()}
                                      </span>
                                      {ride.status === 'COMPLETED' ? (
                                          <span className="text-[10px] text-green-500 font-bold uppercase tracking-widest">{t('status_completed')}</span>
                                      ) : (
                                          <span className="text-[10px] text-blue-500 font-bold uppercase tracking-widest animate-pulse">{isRTL ? "نشطة" : "Active"}</span>
                                      )}
                                  </div>
                              </div>
                              
                              <i className={`fas ${isRTL ? 'fa-chevron-left' : 'fa-chevron-right'} text-gray-200`}></i>
                          </div>
                      );
                  })}
              </div>
          )}
      </div>
    </div>
  );
}
