
import React, { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { User, Driver, Ride, RideStatus } from '../types';
import { getUserRides, subscribeToScheduledRides, subscribeToDriverTasks, acceptRideRequest, acceptScheduledRide } from '../services/firebaseBridge';
import { Button } from '../components/ui/Button';
import { LocalNotifications } from '@capacitor/local-notifications';

interface DriverAnalyticsProps {
  user: User | Driver;
  initialTab: 'CHECKOUTS' | 'CANCELED' | 'PENDING' | 'TASKS' | 'SCHEDULED' | 'HISTORY';
  onBack: () => void;
  onNavigate?: (view: string) => void;
}

export default function DriverAnalytics({ user, initialTab, onBack, onNavigate }: DriverAnalyticsProps) {
  const { t, isRTL } = useLanguage();
  const [activeTab, setActiveTab] = useState<string>(initialTab || 'CHECKOUTS');
  const [rides, setRides] = useState<Ride[]>([]);
  const [openScheduledRides, setOpenScheduledRides] = useState<Ride[]>([]);
  const [myTasks, setMyTasks] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);

  // Load User History
  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return;
      try {
        const history = await getUserRides(user.id, user.role);
        setRides(history);
      } catch (error) {
        console.error("Failed to fetch ride history", error);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [user]);

  // Load Scheduled Rides (Both Open Market and My Tasks)
  useEffect(() => {
      if (activeTab === 'TASKS' && user.role === 'DRIVER') {
          // 1. Subscribe to Open Market
          const unsubOpen = subscribeToScheduledRides((rides) => {
              // Filter out rides that are in the past
              const validOpen = rides.filter(r => r.scheduledTime && r.scheduledTime > Date.now());
              setOpenScheduledRides(validOpen);
          });

          // 2. Subscribe to My Accepted Tasks
          const unsubTasks = subscribeToDriverTasks(user.id, (rides) => {
              const validTasks = rides.filter(r => r.scheduledTime && r.scheduledTime > Date.now());
              setMyTasks(validTasks);
          });

          return () => { unsubOpen(); unsubTasks(); };
      }
  }, [activeTab, user.role, user.id]);

  // Handle Accepting a Scheduled Ride (Commitment)
  const handleAcceptScheduled = async (ride: Ride) => {
      if (!ride.scheduledTime) return;
      
      const confirmMsg = t('confirm_task_accept');

      if (!confirm(confirmMsg)) return;

      try {
          // Use specific function for scheduled rides to keep status as SCHEDULED
          await acceptScheduledRide(ride.id, user.id);
          
          // --- SCHEDULE LOCAL NOTIFICATION (30 Mins Before) ---
          const reminderTime = new Date(ride.scheduledTime - 30 * 60 * 1000); // 30 mins before
          const now = new Date();

          if (reminderTime > now) {
              await LocalNotifications.schedule({
                  notifications: [{
                      title: isRTL ? "⏰ تذكير بمهمة قادمة" : "⏰ Upcoming Task Reminder",
                      body: isRTL 
                        ? `لديك رحلة مجدولة خلال 30 دقيقة من ${ride.pickup.address}` 
                        : `You have a scheduled ride in 30 mins from ${ride.pickup.address}`,
                      id: new Date().getTime(), // Unique ID based on timestamp
                      schedule: { at: reminderTime },
                      sound: 'beep.wav',
                      actionTypeId: "",
                      extra: { rideId: ride.id }
                  }]
              });
              alert(t('task_accepted'));
          } else {
              alert(t('task_accepted_soon'));
          }

      } catch (e) {
          alert(t('error_accept_task'));
      }
  };

  // Handle Starting a Task (Moves to Active Status)
  const handleStartTask = async (ride: Ride) => {
      const confirmMsg = t('confirm_task_start');
      
      if (confirm(confirmMsg)) {
          try {
              // This sets status to ACCEPTED, which moves it from Tasks -> Main Active Ride view
              await acceptRideRequest(ride.id, user.id);
              onBack(); // Go back to Home/Map to see the active ride
          } catch (e) {
              alert(t('error_start_task'));
          }
      }
  };

  // --- Derived Data ---
  const canceledTrips = rides.filter(r => r.status === RideStatus.CANCELLED);
  const completedTrips = rides.filter(r => r.status === RideStatus.COMPLETED);
  const pendingTrips = rides.filter(r => 
      [RideStatus.ACCEPTED, RideStatus.ARRIVED, RideStatus.IN_PROGRESS].includes(r.status)
  );

  const TabButton = ({ id, label, icon }: { id: string, label: string, icon: string }) => (
      <button 
        onClick={() => setActiveTab(id)}
        className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl transition-all ${
            activeTab === id ? 'bg-[#6C63FF] text-white shadow-md' : 'bg-white text-gray-400 hover:bg-gray-50'
        }`}
      >
          <i className={`fas ${icon} mb-1 text-lg`}></i>
          <span className="text-[10px] font-bold uppercase tracking-wider text-center leading-tight">{label}</span>
      </button>
  );

  return (
    <div className="h-full w-full bg-gray-50 flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-white p-4 pt-safe shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-4 mb-4">
            <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100">
            <i className={`fas ${isRTL ? 'fa-arrow-right' : 'fa-arrow-left'} text-lg`}></i>
            </button>
            <h1 className="text-xl font-bold">{t('dashboard')}</h1>
        </div>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
            <TabButton id="CHECKOUTS" label={t('menu_checkouts')} icon="fa-money-bill-transfer" />
            <TabButton id="TASKS" label={t('tasks_tab')} icon="fa-clipboard-list" />
            <TabButton id="HISTORY" label={t('menu_history')} icon="fa-list-check" />
            <TabButton id="CANCELED" label={t('menu_canceled_trips')} icon="fa-ban" />
            <TabButton id="PENDING" label={t('menu_pending_trips')} icon="fa-hourglass-half" />
            <TabButton id="INSIGHTS" label={isRTL ? "الإحصائيات" : "Insights"} icon="fa-chart-pie" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-40">
             <i className="fas fa-spinner fa-spin text-2xl text-gray-400"></i>
          </div>
        ) : (
          <div className="space-y-3 animate-fade-in-up">
            
            {/* INSIGHTS VIEW */}
            {activeTab === 'INSIGHTS' && (
                <div className="space-y-4 text-center pb-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center">
                             <div className="text-3xl text-blue-500 mb-2"><i className="fas fa-check-circle"></i></div>
                             <div className="text-sm text-gray-500 font-bold uppercase">{isRTL ? "معدل القبول" : "Acceptance Rate"}</div>
                             <div className="text-xl font-black text-gray-900 mt-1">
                                 {Math.round((((user as any).acceptances || 0) / Math.max(((user as any).acceptances || 0) + ((user as any).cancellations || 0), 1)) * 100)}%
                             </div>
                        </div>
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center">
                             <div className="text-3xl text-red-500 mb-2"><i className="fas fa-times-circle"></i></div>
                             <div className="text-sm text-gray-500 font-bold uppercase">{isRTL ? "الإلغاءات" : "Cancellations"}</div>
                             <div className="text-xl font-black text-gray-900 mt-1">
                                 {(user as any).cancellations || 0}
                             </div>
                        </div>
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center">
                             <div className="text-3xl text-green-500 mb-2"><i className="fas fa-car-side"></i></div>
                             <div className="text-sm text-gray-500 font-bold uppercase">{isRTL ? "رحلات مكتملة" : "Completed Rides"}</div>
                             <div className="text-xl font-black text-gray-900 mt-1">
                                 {(user as any).totalRides || completedTrips.length}
                             </div>
                        </div>
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center">
                             <div className="text-3xl text-yellow-500 mb-2"><i className="fas fa-star"></i></div>
                             <div className="text-sm text-gray-500 font-bold uppercase">{isRTL ? "التقييم" : "Rating"}</div>
                             <div className="text-xl font-black text-gray-900 mt-1">
                                 {(user as Driver).rating?.toFixed(1) || "5.0"}
                             </div>
                        </div>
                    </div>
                    
                    <div className="bg-blue-50 border border-blue-100 p-5 rounded-3xl mt-6 text-left rtl:text-right relative overflow-hidden">
                         <i className="fas fa-lightbulb absolute -right-4 -top-4 text-[80px] text-blue-500 opacity-10"></i>
                         <h3 className="font-black text-blue-900 mb-2 flex items-center gap-2">
                             <i className="fas fa-bolt text-yellow-500"></i>
                             {isRTL ? "نصائح ذكية لتحقيق أرباح أعلى" : "Smart Suggestions"}
                         </h3>
                         <ul className="space-y-3 mt-4 text-sm text-blue-800">
                             <li className="flex items-start gap-3">
                                 <i className="fas fa-arrow-trend-up mt-1 text-green-500"></i>
                                 <span>{isRTL ? "تكثر الطلبات بنسبة ٣٥٪ خلال ساعات المساء من ٥ إلى ٩ مساءً." : "You could earn 35% more working evening hours (5PM - 9PM)."}</span>
                             </li>
                             <li className="flex items-start gap-3">
                                 <i className="fas fa-map-location-dot mt-1 text-blue-500"></i>
                                 <span>{isRTL ? "منطقة وسط البلد تشهد طلباً عالياً الآن." : "Downtown area is currently experiencing high demand. Head there to get rides faster."}</span>
                             </li>
                             <li className="flex items-start gap-3">
                                 <i className="fas fa-check-double mt-1 text-purple-500"></i>
                                 <span>{isRTL ? "حافظ على معدل قبول أعلى من ٨٠٪ لتحصل على أولوية في الطلبات." : "Maintain an acceptance rate over 80% to receive priority ride requests."}</span>
                             </li>
                         </ul>
                    </div>
                </div>
            )}

            {/* CHECKOUTS VIEW */}
            {activeTab === 'CHECKOUTS' && (
                <div className="text-center py-6">
                    <div className="bg-[#FFC90E] text-gray-900 rounded-[32px] p-8 shadow-xl shadow-yellow-100 mb-8 inline-block w-full max-w-sm">
                        <div className="text-xs font-bold uppercase opacity-60 mb-2">{t('wallet_balance')}</div>
                        <div className="text-4xl font-black mb-4">{(user.walletBalance || 0).toLocaleString(undefined, {maximumFractionDigits: 2})} {t('currency')}</div>
                        <button onClick={() => onNavigate && onNavigate('ADMIN_CHAT')} className="bg-blue-600 text-white px-6 py-3 rounded-full text-sm font-bold shadow-lg w-full flex items-center justify-center gap-2">
                            <i className="fas fa-comments"></i> {t('chat_with_admin')}
                        </button>
                    </div>
                    
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-left rtl:text-right">
                        <h3 className="font-bold text-gray-900 uppercase text-xs mb-4">{t('total_earnings')}</h3>
                        <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                             <div className="text-gray-500 text-sm">{t('total_rides_count')}</div>
                             <div className="font-black text-xl">{rides.filter(r => r.status === RideStatus.COMPLETED).length}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* HISTORY VIEW (Trip Logs) */}
            {activeTab === 'HISTORY' && (
                completedTrips.length > 0 ? (
                    completedTrips.map(ride => (
                        <RideCard key={ride.id} ride={ride} t={t} isRTL={isRTL} type="completed" />
                    ))
                ) : (
                    <EmptyState icon="fa-route" msg={t('no_data_found')} />
                )
            )}

            {/* TASKS VIEW (Scheduled) */}
            {activeTab === 'TASKS' && (
                <div className="space-y-6">
                    {/* 1. My Commitments */}
                    <div>
                        <div className="flex items-center gap-2 mb-3 px-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <h3 className="font-black text-gray-900 uppercase text-xs tracking-widest">{t('my_tasks_title')}</h3>
                        </div>
                        
                        {myTasks.length === 0 ? (
                            <div className="bg-white rounded-xl p-6 text-center border border-dashed border-gray-300">
                                <p className="text-gray-400 text-sm font-bold">{t('no_upcoming_tasks')}</p>
                            </div>
                        ) : (
                            myTasks.map(ride => (
                                <div key={ride.id} className="bg-gradient-to-r from-green-50 to-white rounded-xl p-4 shadow-sm border border-green-200 mb-3 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">
                                        {t('committed_badge')}
                                    </div>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="bg-white/80 text-green-800 px-3 py-1 rounded-lg text-xs font-black shadow-sm">
                                            <i className="fas fa-clock mr-1"></i> 
                                            {new Date(ride.scheduledTime!).toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="space-y-2 pl-2 border-l-2 border-green-300 ml-1 mb-2">
                                        <div className="text-sm font-bold text-gray-800 truncate">{ride.pickup.address}</div>
                                        <div className="text-sm font-bold text-gray-800 truncate">{ride.dropoff.address}</div>
                                    </div>
                                    <div className="flex flex-col gap-2 mt-4">
                                        <div className="flex items-center gap-2 text-[10px] text-green-700 font-bold bg-green-100/50 p-2 rounded-lg">
                                            <i className="fas fa-bell"></i> {t('reminder_set_text')}
                                        </div>
                                        
                                        <Button 
                                            onClick={() => handleStartTask(ride)}
                                            className="w-full bg-green-600 text-white h-12 text-sm shadow-lg shadow-green-200 hover:bg-green-700"
                                        >
                                            <i className="fas fa-play mr-2"></i> {t('start_trip')}
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* 2. Market Place */}
                    <div>
                        <div className="flex items-center gap-2 mb-3 px-2 mt-6">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <h3 className="font-black text-gray-900 uppercase text-xs tracking-widest">{t('available_prebookings')}</h3>
                        </div>

                        {openScheduledRides.length === 0 ? (
                            <div className="bg-white rounded-xl p-6 text-center border border-dashed border-gray-300">
                                <p className="text-gray-400 text-sm font-bold">{t('no_scheduled_rides')}</p>
                            </div>
                        ) : (
                            openScheduledRides.map(ride => (
                                <div key={ride.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 mb-3">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-xs font-bold">
                                            <i className="fas fa-calendar-alt mr-1"></i> 
                                            {new Date(ride.scheduledTime!).toLocaleString()}
                                        </div>
                                        <div className="font-black text-lg">{ride.fare} {t('currency')}</div>
                                    </div>
                                    <div className="space-y-2 pl-2 border-l-2 border-blue-500 ml-1 mb-4">
                                        <div className="text-sm font-bold text-gray-800 truncate" dir="auto">{ride.pickup.address}</div>
                                        <div className="text-sm font-bold text-gray-800 truncate" dir="auto">{ride.dropoff.address}</div>
                                    </div>
                                    <Button onClick={() => handleAcceptScheduled(ride)} className="w-full bg-blue-600 text-white h-10 text-sm shadow-blue-200">
                                        {t('accept_ride')}
                                    </Button>
                                    <p className="text-[10px] text-center text-gray-400 mt-2">
                                        {t('accept_obligates')}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* CANCELED VIEW */}
            {activeTab === 'CANCELED' && (
                canceledTrips.length > 0 ? (
                    canceledTrips.map(ride => (
                        <RideCard key={ride.id} ride={ride} t={t} isRTL={isRTL} type="canceled" />
                    ))
                ) : (
                    <EmptyState icon="fa-check-circle" msg={t('no_data_found')} />
                )
            )}

            {/* PENDING VIEW */}
            {activeTab === 'PENDING' && (
                pendingTrips.length > 0 ? (
                    pendingTrips.map(ride => (
                        <RideCard key={ride.id} ride={ride} t={t} isRTL={isRTL} type="pending" />
                    ))
                ) : (
                    <EmptyState icon="fa-check-circle" msg={t('no_data_found')} />
                )
            )}

          </div>
        )}
      </div>
    </div>
  );
}

const RideCard = ({ ride, t, isRTL, type }: any) => (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex justify-between items-start mb-3">
            <div>
                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md ${
                    type === 'canceled' ? 'bg-red-50 text-red-500' : 
                    type === 'completed' ? 'bg-green-50 text-green-600' :
                    'bg-blue-50 text-blue-500'
                }`}>
                    {type === 'canceled' ? t('status_cancelled') : 
                     type === 'completed' ? t('status_completed') :
                     t('status_in_progress')}
                </span>
                <div className="text-xs text-gray-400 mt-1 font-mono">#{ride.id.slice(0,6)}</div>
            </div>
            <div className="font-bold">{ride.fare} {t('currency')}</div>
        </div>
        <div className="space-y-2 pl-2 border-l-2 border-gray-100 ml-1">
            <div className="text-sm font-bold text-gray-800 truncate" dir="auto">{ride.pickup.address}</div>
            <div className="text-sm font-bold text-gray-800 truncate" dir="auto">{ride.dropoff.address}</div>
        </div>
        <div className="mt-3 text-xs text-gray-400 flex justify-between">
            <span>{new Date(ride.timestamp).toLocaleDateString()}</span>
            <span>{new Date(ride.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
        </div>
    </div>
);

const EmptyState = ({ icon, msg }: any) => (
    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
            <i className={`fas ${icon} text-2xl opacity-50`}></i>
        </div>
        <p className="font-bold text-sm">{msg}</p>
    </div>
);
