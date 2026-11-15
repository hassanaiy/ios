import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  RefreshCw,
  Settings,
  Search,
  Filter,
  UserCheck,
  AlertTriangle,
  Repeat,
  Play,
  XCircle,
  CheckCircle2,
  Activity,
  Shield,
  Sliders
} from 'lucide-react';
import {
  Ride,
  Driver,
  RecurringSchedule,
  DispatchLogEntry,
  ScheduledRidesConfig,
  ScheduleStatus,
  VehicleType
} from '../types';
import {
  subscribeToAdminScheduledRidesData,
  getScheduledRidesConfig,
  updateScheduledRidesConfig,
  runScheduledRidesLifecycleTick,
  releaseAndReassignScheduledRide,
  cancelScheduledRideByPassenger,
  adminAssignDriverToScheduledRide,
  updateRecurringScheduleStatus,
  formatInServiceTimezone,
  getScheduledStatusLabel,
  DEFAULT_SCHEDULED_RIDES_CONFIG
} from '../services/firebase';

interface ScheduledRidesAdminViewProps {
  adminId: string;
  drivers: Driver[];
  lang?: 'ar' | 'en';
}

export const ScheduledRidesAdminView: React.FC<ScheduledRidesAdminViewProps> = ({
  adminId,
  drivers,
  lang = 'ar'
}) => {
  const [subTab, setSubTab] = useState<
    | 'all'
    | 'awaiting'
    | 'early_accepted'
    | 'auto_dispatched'
    | 'recurring'
    | 'failed'
    | 'logs'
    | 'settings'
  >('all');

  const [scheduledRides, setScheduledRides] = useState<Ride[]>([]);
  const [recurringSchedules, setRecurringSchedules] = useState<RecurringSchedule[]>([]);
  const [dispatchLogs, setDispatchLogs] = useState<DispatchLogEntry[]>([]);
  const [config, setConfig] = useState<ScheduledRidesConfig>(DEFAULT_SCHEDULED_RIDES_CONFIG);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('');

  // Actions state
  const [assignModalRide, setAssignModalRide] = useState<Ride | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [isRunningTick, setIsRunningTick] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const unsub = subscribeToAdminScheduledRidesData((data) => {
      setScheduledRides(data.scheduledRides);
      setRecurringSchedules(data.recurringSchedules);
      setDispatchLogs(data.dispatchLogs);
    });
    getScheduledRidesConfig().then(setConfig).catch(() => {});
    return () => unsub();
  }, []);

  const notify = (type: 'success' | 'error', text: string) => {
    setBanner({ type, text });
    setTimeout(() => setBanner(null), 4500);
  };

  const handleRunLifecycleTick = async () => {
    setIsRunningTick(true);
    try {
      const res = await runScheduledRidesLifecycleTick(Date.now());
      notify(
        'success',
        `تم تشغيل دورة التوزيع بنجاح: تذكيرات الركاب (${res.passengerRemindersSent})، تذكيرات السائقين (${res.driverRemindersSent})، بدء بحث تلقائي (${res.autoDispatchesStarted})، توسيع نطاق (${res.radiusExpansions})، توليد رحلات متكررة (${res.recurringGenerated}).`
      );
    } catch (e: any) {
      notify('error', e?.message || 'فشل تشغيل دورة الفحص');
    } finally {
      setIsRunningTick(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    try {
      const saved = await updateScheduledRidesConfig(config, adminId);
      setConfig(saved);
      notify('success', 'تم حفظ إعدادات نظام الرحلات المجدولة والمتكررة بنجاح.');
    } catch (err: any) {
      notify('error', err?.message || 'تعذر حفظ الإعدادات');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleManualAssignDriver = async () => {
    if (!assignModalRide || !selectedDriverId) return;
    const drv = drivers.find((d) => d.id === selectedDriverId);
    if (!drv) return;
    try {
      await adminAssignDriverToScheduledRide(assignModalRide.id, drv, adminId);
      setAssignModalRide(null);
      setSelectedDriverId('');
      notify('success', `تم تعيين الكابتن ${drv.name} للرحلة المجدولة بنجاح.`);
    } catch (e: any) {
      notify('error', e?.message || 'فشل تعيين السائق');
    }
  };

  // Filtered rides based on subTab and filters
  const filteredRides = scheduledRides.filter((r) => {
    if (subTab === 'awaiting' && (r.driverId || r.scheduleStatus !== 'SCHEDULED')) return false;
    if (subTab === 'early_accepted' && r.assignmentType !== 'EARLY_ACCEPTANCE') return false;
    if (
      subTab === 'auto_dispatched' &&
      r.assignmentType !== 'AUTOMATIC_DISPATCH' &&
      r.scheduleStatus !== 'SEARCHING_DRIVER'
    ) {
      return false;
    }
    if (
      subTab === 'failed' &&
      r.scheduleStatus !== 'NO_DRIVER_FOUND' &&
      r.status !== 'EXPIRED'
    ) {
      return false;
    }

    if (categoryFilter !== 'ALL' && r.requestedVehicleType !== categoryFilter) return false;
    if (statusFilter !== 'ALL' && r.scheduleStatus !== statusFilter) return false;

    if (dateFilter) {
      const tz = formatInServiceTimezone(r.scheduledPickupAt || r.scheduledTime || r.timestamp);
      if (tz.dateStr !== dateFilter) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = r.id.toLowerCase().includes(q);
      const matchPax = (r.passengerName || '').toLowerCase().includes(q);
      const matchDrv = (r.driverName || '').toLowerCase().includes(q);
      const matchPick = (r.pickup?.address || '').toLowerCase().includes(q);
      const matchDrop = (r.dropoff?.address || '').toLowerCase().includes(q);
      if (!matchId && !matchPax && !matchDrv && !matchPick && !matchDrop) return false;
    }

    return true;
  });

  // KPI metrics
  const awaitingCount = scheduledRides.filter(
    (r) => !r.driverId && r.scheduleStatus === 'SCHEDULED'
  ).length;
  const earlyAcceptedCount = scheduledRides.filter(
    (r) => r.assignmentType === 'EARLY_ACCEPTANCE'
  ).length;
  const autoDispatchCount = scheduledRides.filter(
    (r) => r.scheduleStatus === 'SEARCHING_DRIVER' || r.assignmentType === 'AUTOMATIC_DISPATCH'
  ).length;
  const activeRecurringCount = recurringSchedules.filter((s) => s.status === 'ACTIVE').length;
  const failedCount = scheduledRides.filter(
    (r) => r.scheduleStatus === 'NO_DRIVER_FOUND' || r.status === 'EXPIRED'
  ).length;

  const approvedDrivers = drivers.filter(
    (d) => (d.status === 'approved' || d.isApproved) && !d.isBanned
  );

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header & Manual Dispatch Tick Trigger */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 text-[#1f44df]" />
            <span>إدارة الرحلات المجدولة والمتكررة (HYBRID Dispatch)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            مراقبة القبول المسبق للسائقين، البحث التلقائي قبل 30 دقيقة، الجداول المتكررة، وإعدادات التشغيل
          </p>
        </div>

        <button
          disabled={isRunningTick}
          onClick={handleRunLifecycleTick}
          className="px-4 py-2.5 rounded-xl bg-[#1f44df] hover:bg-blue-700 text-white text-xs font-black flex items-center gap-2 self-start sm:self-auto transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRunningTick ? 'animate-spin' : ''}`} />
          <span>تشغيل فحص الجدولة والتوزيع الآن</span>
        </button>
      </div>

      {banner && (
        <div
          className={`p-3.5 rounded-xl text-xs font-bold flex items-center justify-between ${
            banner.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <span>{banner.text}</span>
          <button onClick={() => setBanner(null)}>✕</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <span className="text-xs text-slate-500 block">إجمالي المجدولة</span>
          <span className="text-2xl font-black text-slate-900 dark:text-white">
            {scheduledRides.length}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
          <span className="text-xs text-amber-700 dark:text-amber-300 block">بانتظار قبول سائق</span>
          <span className="text-2xl font-black text-amber-800 dark:text-amber-200">
            {awaitingCount}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
          <span className="text-xs text-emerald-700 dark:text-emerald-300 block">مقبولة مسبقاً (Stage A)</span>
          <span className="text-2xl font-black text-emerald-800 dark:text-emerald-200">
            {earlyAcceptedCount}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900">
          <span className="text-xs text-indigo-700 dark:text-indigo-300 block">توزيع تلقائي (Stage B)</span>
          <span className="text-2xl font-black text-indigo-800 dark:text-indigo-200">
            {autoDispatchCount}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900">
          <span className="text-xs text-purple-700 dark:text-purple-300 block">جداول متكررة نشطة</span>
          <span className="text-2xl font-black text-purple-800 dark:text-purple-200">
            {activeRecurringCount}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900">
          <span className="text-xs text-rose-700 dark:text-rose-300 block">تعذر العثور على سائق</span>
          <span className="text-2xl font-black text-rose-800 dark:text-rose-200">
            {failedCount}
          </span>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'all', label: 'جميع الرحلات المجدولة' },
          { id: 'awaiting', label: 'بانتظار سائق' },
          { id: 'early_accepted', label: 'مقبولة مسبقاً' },
          { id: 'auto_dispatched', label: 'التوزيع التلقائي' },
          { id: 'recurring', label: 'الجداول المتكررة' },
          { id: 'failed', label: 'فشل التعيين' },
          { id: 'logs', label: 'سجل التوزيع والتنبيهات' },
          { id: 'settings', label: 'إعدادات الجدولة' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id as any)}
            className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap transition ${
              subTab === tab.id
                ? 'bg-[#1f44df] text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters Bar (for ride tabs) */}
      {['all', 'awaiting', 'early_accepted', 'auto_dispatched', 'failed'].includes(subTab) && (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالراكب، السائق، العنوان..."
              className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
            />
          </div>

          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
          />

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
          >
            <option value="ALL">كل الفئات (MOTO / STANDARD / COMFORT)</option>
            <option value="MOTO">MOTO - موتوسيكل</option>
            <option value="STANDARD">STANDARD - اقتصادية</option>
            <option value="COMFORT">COMFORT - مكيفة</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
          >
            <option value="ALL">كل حالات الجدولة</option>
            <option value="SCHEDULED">بانتظار قبول سائق</option>
            <option value="SEARCHING_DRIVER">بحث تلقائي عن سائق</option>
            <option value="DRIVER_ASSIGNED">تم تعيين سائق</option>
            <option value="DRIVER_EN_ROUTE">السائق في الطريق</option>
            <option value="DRIVER_ARRIVED">السائق وصل</option>
            <option value="IN_PROGRESS">الرحلة جارية</option>
            <option value="COMPLETED">مكتملة</option>
            <option value="CANCELLED">ملغاة</option>
            <option value="NO_DRIVER_FOUND">لم يتم العثور على سائق</option>
          </select>
        </div>
      )}

      {/* RIDES TABLE */}
      {['all', 'awaiting', 'early_accepted', 'auto_dispatched', 'failed'].includes(subTab) && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {filteredRides.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-400">
              لا توجد رحلات مجدولة مطابقة لمعايير الفلترة الحالية.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3">الموعد المجدول</th>
                    <th className="p-3">الراكب</th>
                    <th className="p-3">المسار</th>
                    <th className="p-3">الفئة والأجرة</th>
                    <th className="p-3">السائق وطريقة التعيين</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3">إجراءات الإدارة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredRides.map((ride) => {
                    const pickupAt = ride.scheduledPickupAt || ride.scheduledTime || ride.timestamp;
                    const tz = formatInServiceTimezone(pickupAt);
                    const badge = getScheduledStatusLabel(
                      ride.scheduleStatus || 'SCHEDULED',
                      'ar',
                      'ADMIN',
                      pickupAt
                    );
                    return (
                      <tr key={ride.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="p-3 whitespace-nowrap font-bold">
                          <div>{tz.formattedAr}</div>
                          <div className="text-[10px] text-slate-400">
                            {tz.dateStr} ({tz.timeStr})
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {ride.passengerName || 'راكب'}
                          </div>
                          {ride.recurringScheduleId && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-bold">
                              جدول متكرر
                            </span>
                          )}
                        </td>
                        <td className="p-3 max-w-xs">
                          <div className="truncate text-slate-700 dark:text-slate-200">
                            🟢 {ride.pickup?.address}
                          </div>
                          <div className="truncate text-slate-500">
                            🔴 {ride.dropoff?.address}
                          </div>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <div className="font-black text-emerald-600">{ride.fare} ج.م</div>
                          <div className="text-[10px] text-slate-400">
                            {ride.requestedVehicleType}
                          </div>
                        </td>
                        <td className="p-3">
                          {ride.driverId ? (
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white">
                                {ride.driverName || ride.driverId}
                              </div>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold">
                                {ride.assignmentType === 'EARLY_ACCEPTANCE'
                                  ? 'قبول مسبق (Stage A)'
                                  : 'توزيع تلقائي (Stage B)'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400">لم يعين بعد</span>
                          )}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${badge.badgeBg} ${badge.colorClass}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                setAssignModalRide(ride);
                                setSelectedDriverId(ride.driverId || '');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold"
                            >
                              {ride.driverId ? 'تغيير السائق' : 'تعيين سائق'}
                            </button>
                            {ride.driverId && (
                              <button
                                onClick={async () => {
                                  await releaseAndReassignScheduledRide(
                                    ride.id,
                                    'إلغاء تعيين السائق بواسطة الإدارة وإعادة البحث',
                                    'ADMIN',
                                    adminId
                                  );
                                  notify('success', 'تم فك ارتباط السائق وإعادة فتح البحث.');
                                }}
                                className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold"
                              >
                                إعادة بحث
                              </button>
                            )}
                            {ride.status !== 'CANCELLED' && ride.status !== 'COMPLETED' && (
                              <button
                                onClick={async () => {
                                  await cancelScheduledRideByPassenger(
                                    ride.id,
                                    ride.passengerId,
                                    'تم الإلغاء بواسطة الإدارة'
                                  );
                                  notify('success', 'تم إلغاء الرحلة المجدولة.');
                                }}
                                className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 font-bold"
                              >
                                إلغاء
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* RECURRING SCHEDULES TAB */}
      {subTab === 'recurring' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {recurringSchedules.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-400">
              لا توجد جداول رحلات متكررة مسجلة حالياً.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3">الراكب</th>
                    <th className="p-3">التكرار والوقت</th>
                    <th className="p-3">المسار</th>
                    <th className="p-3">الفترة</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recurringSchedules.map((sched) => (
                    <tr key={sched.id}>
                      <td className="p-3 font-bold">{sched.passengerName}</td>
                      <td className="p-3">
                        <span className="font-black text-purple-700">{sched.frequency}</span> •{' '}
                        {sched.pickupTime}
                      </td>
                      <td className="p-3 max-w-xs">
                        <div className="truncate">🟢 {sched.pickup?.address}</div>
                        <div className="truncate">🔴 {sched.dropoff?.address}</div>
                      </td>
                      <td className="p-3">
                        من {sched.startDate} {sched.endDate ? `إلى ${sched.endDate}` : '(مستمر)'}
                      </td>
                      <td className="p-3 font-bold">{sched.status}</td>
                      <td className="p-3">
                        {sched.status !== 'CANCELLED' && (
                          <button
                            onClick={async () => {
                              await updateRecurringScheduleStatus(
                                sched.id,
                                sched.passengerId,
                                'CANCELLED',
                                true,
                                true
                              );
                              notify('success', 'تم إلغاء الجدول المتكرر وجميع الرحلات المستقبلية.');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-red-50 text-red-600 font-bold"
                          >
                            إلغاء السلسلة
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* DISPATCH LOGS TAB */}
      {subTab === 'logs' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 max-h-[520px] overflow-y-auto">
          {dispatchLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              لا توجد سجلات توزيع حالياً.
            </div>
          ) : (
            dispatchLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-black text-[10px] ml-2">
                    {log.eventType}
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {log.message}
                  </span>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Ride ID: {log.rideId} • Actor: {log.actorRole || 'SYSTEM'}
                  </div>
                </div>
                <span className="text-[11px] text-slate-400 whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleString('ar-EG')}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* OPERATIONAL SETTINGS TAB */}
      {subTab === 'settings' && (
        <form
          onSubmit={handleSaveConfig}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5"
        >
          <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[#1f44df]" />
            <span>إعدادات التشغيل المعتمدة لنظام الرحلات المجدولة</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                الحد الأقصى للحجز المسبق (أيام)
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={config.maxAdvanceBookingDays}
                onChange={(e) =>
                  setConfig({ ...config, maxAdvanceBookingDays: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
              />
            </div>

            <div>
              <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                بدء البحث التلقائي قبل الموعد بـ (دقيقة)
              </label>
              <input
                type="number"
                min={5}
                max={120}
                value={config.autoDispatchLeadTimeMinutes}
                onChange={(e) =>
                  setConfig({ ...config, autoDispatchLeadTimeMinutes: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
              />
            </div>

            <div>
              <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                تذكير الراكب قبل الموعد بـ (دقيقة)
              </label>
              <input
                type="number"
                min={10}
                max={240}
                value={config.passengerReminderLeadTimeMinutes}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    passengerReminderLeadTimeMinutes: Number(e.target.value)
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
              />
            </div>

            <div>
              <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                تذكير السائق المعين قبل الموعد بـ (دقيقة)
              </label>
              <input
                type="number"
                min={10}
                max={120}
                value={config.driverReminderLeadTimeMinutes}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    driverReminderLeadTimeMinutes: Number(e.target.value)
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
              />
            </div>

            <div>
              <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                نطاق البحث الابتدائي (كم)
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={config.initialSearchRadiusKm}
                onChange={(e) =>
                  setConfig({ ...config, initialSearchRadiusKm: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
              />
            </div>

            <div>
              <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                نطاق البحث الأقصى (كم)
              </label>
              <input
                type="number"
                min={5}
                max={100}
                value={config.maxSearchRadiusKm}
                onChange={(e) =>
                  setConfig({ ...config, maxSearchRadiusKm: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
              />
            </div>

            <div>
              <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                مهلة الإلغاء المجاني قبل الانطلاق (دقيقة)
              </label>
              <input
                type="number"
                min={0}
                max={240}
                value={config.freeCancellationWindowMinutes}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    freeCancellationWindowMinutes: Number(e.target.value)
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
              />
            </div>

            <div>
              <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                رسوم الإلغاء المتأخر (ج.م)
              </label>
              <input
                type="number"
                min={0}
                max={200}
                value={config.lateCancellationFee}
                onChange={(e) =>
                  setConfig({ ...config, lateCancellationFee: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 text-xs">
            {[
              { key: 'earlyAcceptanceEnabled', label: 'تفعيل القبول المسبق للسائقين (Stage A)' },
              { key: 'autoDispatchEnabled', label: 'تفعيل البحث التلقائي (Stage B)' },
              { key: 'recurringRidesEnabled', label: 'تفعيل الرحلات المتكررة' },
              { key: 'driverReassignmentEnabled', label: 'تفعيل إعادة تعيين السائق تلقائياً' },
              { key: 'lockFareOnEarlyAcceptance', label: 'تثبيت الأجرة عند القبول المسبق' }
            ].map((item) => (
              <label
                key={item.key}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between cursor-pointer"
              >
                <span className="font-bold text-slate-700 dark:text-slate-200">{item.label}</span>
                <input
                  type="checkbox"
                  checked={Boolean((config as any)[item.key])}
                  onChange={(e) =>
                    setConfig({ ...config, [item.key]: e.target.checked })
                  }
                  className="w-4 h-4 accent-[#1f44df]"
                />
              </label>
            ))}
          </div>

          <div className="pt-3 flex justify-end">
            <button
              type="submit"
              disabled={isSavingConfig}
              className="px-6 py-2.5 rounded-xl bg-[#1f44df] hover:bg-blue-700 text-white text-xs font-black transition"
            >
              {isSavingConfig ? 'جاري الحفظ...' : 'حفظ إعدادات النظام'}
            </button>
          </div>
        </form>
      )}

      {/* Manual Driver Assignment Modal */}
      {assignModalRide && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 space-y-4 border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              تعيين / إعادة تعيين سائق للرحلة المجدولة
            </h3>
            <p className="text-xs text-slate-500">
              من {assignModalRide.pickup?.address} إلى {assignModalRide.dropoff?.address}
            </p>
            <select
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
            >
              <option value="">-- اختر كابتن معتمد --</option>
              {approvedDrivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.vehicleBrand} {d.vehicleModel} - {d.vehiclePlate})
                </option>
              ))}
            </select>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setAssignModalRide(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500"
              >
                إلغاء
              </button>
              <button
                disabled={!selectedDriverId}
                onClick={handleManualAssignDriver}
                className="px-4 py-2 rounded-xl bg-[#1f44df] text-white text-xs font-black disabled:opacity-50"
              >
                تأكيد التعيين
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
