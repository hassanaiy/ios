import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { AppSettings } from '../types';
import {
    subscribeToAppSettings,
    updateAppSettings,
    DEFAULT_APP_SETTINGS,
} from '../services/firebase';
import { toast } from 'sonner';

export const RewardCampaignsAdminView = () => {
    const { isRTL } = useLanguage();
    const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
    const [isSavingRewards, setIsSavingRewards] = useState(false);

    const [campaigns, setCampaigns] = useState([
        { id: '1', name: 'Weekend Sprint', targetRides: 50, rewardType: 'Priority', status: 'Active' },
        { id: '2', name: 'Gold Tier Boost', targetRides: 100, rewardType: 'Golden Badge + No Fees 1 day', status: 'Inactive' }
    ]);

    useEffect(() => {
        const unsub = subscribeToAppSettings((settings) => {
            if (settings) {
                setAppSettings(settings);
            }
        });
        return () => unsub();
    }, []);

    const isRewardsEnabled = appSettings.isRewardsEnabled !== false;
    const pointsPerTrip = Number(appSettings.rewardPointsPerTrip ?? 5);
    const thresholdPoints = Number(appSettings.rewardThresholdPoints ?? 50);
    const discountAmount = Number(appSettings.rewardDiscountAmount ?? 20);

    const handleTogglePassengerRewards = async () => {
        const nextEnabled = !isRewardsEnabled;
        const updated: AppSettings = {
            ...DEFAULT_APP_SETTINGS,
            ...appSettings,
            isRewardsEnabled: nextEnabled,
            rewardPointsPerTrip: pointsPerTrip,
            rewardThresholdPoints: thresholdPoints,
            rewardDiscountAmount: discountAmount,
        };
        setAppSettings(updated);
        setIsSavingRewards(true);
        try {
            await updateAppSettings(updated);
            toast.success(
                nextEnabled
                    ? (isRTL ? 'تم تفعيل نظام نقاط ومكافآت الركاب لجميع الركاب' : 'Passenger points system enabled for all passengers')
                    : (isRTL ? 'تم إغلاق نظام نقاط ومكافآت الركاب لجميع الركاب' : 'Passenger points system disabled for all passengers')
            );
        } catch (err) {
            console.error(err);
            toast.error(isRTL ? 'فشل تحديث إعدادات النقاط' : 'Failed to update points settings');
        } finally {
            setIsSavingRewards(false);
        }
    };

    const handleSavePassengerRewardsConfig = async () => {
        setIsSavingRewards(true);
        try {
            const updated: AppSettings = {
                ...DEFAULT_APP_SETTINGS,
                ...appSettings,
                isRewardsEnabled,
                rewardPointsPerTrip: Math.max(1, pointsPerTrip),
                rewardThresholdPoints: Math.max(5, thresholdPoints),
                rewardDiscountAmount: Math.max(5, discountAmount),
            };
            setAppSettings(updated);
            await updateAppSettings(updated);
            toast.success(
                isRTL
                    ? 'تم حفظ وتعميم إعدادات مركز المكافآت على جميع الركاب بنجاح!'
                    : 'Passenger rewards settings saved and applied to all passengers!'
            );
        } catch (err) {
            console.error(err);
            toast.error(isRTL ? 'حدث خطأ أثناء حفظ الإعدادات' : 'Error saving settings');
        } finally {
            setIsSavingRewards(false);
        }
    };

    const handleCreate = () => {
        toast.success(isRTL ? 'تم إنشاء الحملة بنجاح' : 'Campaign created successfully');
    };

    return (
        <div className="space-y-8 animate-fade-in" dir={isRTL ? 'rtl' : 'ltr'}>
            {/* PASSENGER LOYALTY POINTS MASTER CARD ("مركز المكافآت للركاب") */}
            <div className="bg-white rounded-[32px] p-6 sm:p-8 shadow-sm border border-gray-100 space-y-6 relative overflow-hidden">
                <div className="absolute -top-16 -left-16 w-48 h-48 bg-[#FFC90E]/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm ${isRewardsEnabled ? 'bg-[#FFC90E] text-gray-900' : 'bg-gray-100 text-gray-400'}`}>
                            <i className="fas fa-gift"></i>
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h2 className="text-xl sm:text-2xl font-black text-gray-900">
                                    {isRTL ? 'مركز المكافآت ونقاط الركاب' : 'Passenger Loyalty & Rewards Center'}
                                </h2>
                                <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase ${isRewardsEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                                    {isRewardsEnabled ? (isRTL ? 'مفعل للجميع' : 'Active for All') : (isRTL ? 'مغلق' : 'Disabled')}
                                </span>
                            </div>
                            <p className="text-gray-500 text-xs sm:text-sm font-bold mt-1">
                                {isRTL
                                    ? 'تحكم في تشغيل أو إيقاف نظام نقاط المكافآت لجميع الركاب وتحديد النقاط المكتسبة وقيمة الخصم.'
                                    : 'Turn passenger loyalty points ON or OFF for all passengers and configure trip points & discount value.'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                        <span className="text-xs font-black text-gray-600">
                            {isRewardsEnabled ? (isRTL ? 'مفعل (ON)' : 'Enabled (ON)') : (isRTL ? 'مغلق (OFF)' : 'Disabled (OFF)')}
                        </span>
                        <button
                            type="button"
                            disabled={isSavingRewards}
                            onClick={handleTogglePassengerRewards}
                            className={`w-16 h-9 rounded-full p-1 transition-colors duration-200 flex items-center cursor-pointer ${isRewardsEnabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
                        >
                            <div className={`w-7 h-7 bg-white rounded-full shadow-md transform transition-transform duration-200 ${isRewardsEnabled ? (isRTL ? '-translate-x-7' : 'translate-x-7') : ''}`}></div>
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col justify-between gap-2">
                        <div>
                            <label className="text-xs font-black text-gray-700 block">
                                {isRTL ? 'النقاط المكتسبة لكل رحلة مكتملة' : 'Points Earned Per Trip'}
                            </label>
                            <p className="text-[11px] text-gray-400 font-medium">
                                {isRTL ? 'تضاف تلقائياً لرصيد الراكب فور انتهاء الرحلة' : 'Added automatically when a trip completes'}
                            </p>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <input
                                type="number"
                                min={1}
                                max={500}
                                value={pointsPerTrip}
                                onChange={(e) =>
                                    setAppSettings({
                                        ...appSettings,
                                        rewardPointsPerTrip: Math.max(1, Number(e.target.value) || 0),
                                    })
                                }
                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl font-black text-lg text-gray-900 text-center outline-none focus:ring-2 focus:ring-[#FFC90E]"
                            />
                            <span className="text-xs font-black text-gray-500 shrink-0">{isRTL ? 'نقطة' : 'Pts'}</span>
                        </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col justify-between gap-2">
                        <div>
                            <label className="text-xs font-black text-gray-700 block">
                                {isRTL ? 'الحد المطلوب لتفعيل المكافأة' : 'Points Required for Discount'}
                            </label>
                            <p className="text-[11px] text-gray-400 font-medium">
                                {isRTL ? 'عدد النقاط التي يتم استبدالها للحصول على الخصم' : 'Points deducted when passenger redeems reward'}
                            </p>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <input
                                type="number"
                                min={5}
                                max={5000}
                                value={thresholdPoints}
                                onChange={(e) =>
                                    setAppSettings({
                                        ...appSettings,
                                        rewardThresholdPoints: Math.max(5, Number(e.target.value) || 0),
                                    })
                                }
                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl font-black text-lg text-gray-900 text-center outline-none focus:ring-2 focus:ring-[#FFC90E]"
                            />
                            <span className="text-xs font-black text-gray-500 shrink-0">{isRTL ? 'نقطة' : 'Pts'}</span>
                        </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col justify-between gap-2">
                        <div>
                            <label className="text-xs font-black text-gray-700 block">
                                {isRTL ? 'قيمة خصم المكافأة (ج.م)' : 'Reward Discount Amount (EGP)'}
                            </label>
                            <p className="text-[11px] text-gray-400 font-medium">
                                {isRTL ? 'قيمة الخصم الفوري من أجرة الرحلة' : 'Instant discount deducted from ride fare'}
                            </p>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <input
                                type="number"
                                min={5}
                                max={1000}
                                value={discountAmount}
                                onChange={(e) =>
                                    setAppSettings({
                                        ...appSettings,
                                        rewardDiscountAmount: Math.max(5, Number(e.target.value) || 0),
                                    })
                                }
                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl font-black text-lg text-gray-900 text-center outline-none focus:ring-2 focus:ring-[#FFC90E]"
                            />
                            <span className="text-xs font-black text-gray-500 shrink-0">{isRTL ? 'ج.م' : 'EGP'}</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                    <div className="text-xs font-bold text-gray-500 flex items-center gap-2">
                        <i className="fas fa-sync-alt text-emerald-600"></i>
                        <span>
                            {isRTL
                                ? `القاعدة الحالية: يكسب الراكب ${pointsPerTrip} نقطة لكل رحلة، وعند جمع ${thresholdPoints} نقطة يحصل على خصم ${discountAmount} ج.م.`
                                : `Current rule: Passengers earn ${pointsPerTrip} pts/trip, and redeem ${thresholdPoints} pts for ${discountAmount} EGP off.`}
                        </span>
                    </div>
                    <button
                        type="button"
                        disabled={isSavingRewards}
                        onClick={handleSavePassengerRewardsConfig}
                        className="w-full sm:w-auto px-8 py-3.5 bg-[#FFC90E] hover:bg-yellow-400 text-gray-900 font-black rounded-2xl shadow-lg shadow-yellow-200/60 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <i className={`fas ${isSavingRewards ? 'fa-spinner fa-spin' : 'fa-save'}`}></i>
                        <span>{isRTL ? 'حفظ وتعميم على جميع الركاب' : 'Save & Apply to All Passengers'}</span>
                    </button>
                </div>
            </div>

            {/* DRIVER CAMPAIGNS SECTION */}
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-black text-gray-800">{isRTL ? 'حملات ومكافآت الكباتن' : 'Driver Campaigns & Rewards'}</h2>
                    <p className="text-gray-500 mt-1">{isRTL ? 'أنشئ حملات لتشجيع السائقين على إكمال المزيد من الرحلات' : 'Create campaigns to encourage drivers to complete more rides'}</p>
                </div>
                <button onClick={handleCreate} className="px-6 py-3 bg-[#0F2B5B] text-white font-bold rounded-xl hover:bg-[#0c224a] transition-all flex items-center gap-2">
                    <i className="fas fa-plus"></i>
                    {isRTL ? 'إنشاء حملة جديدة' : 'Create Campaign'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {campaigns.map(camp => (
                    <div key={camp.id} className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100 relative overflow-hidden">
                        <div className={`absolute top-0 left-0 w-full h-1.5 ${camp.status === 'Active' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="font-bold text-xl text-gray-800">{camp.name}</h3>
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${camp.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{camp.status}</span>
                        </div>
                        <div className="space-y-3 mb-6">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">{isRTL ? 'الهدف' : 'Target'}</span>
                                <span className="font-bold text-gray-800">{camp.targetRides} {isRTL ? 'رحلة' : 'Rides'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">{isRTL ? 'المكافأة' : 'Reward'}</span>
                                <span className="font-bold text-[#D4AF37]">{camp.rewardType}</span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() =>
                                    setCampaigns(prev =>
                                        prev.map(c =>
                                            c.id === camp.id
                                                ? { ...c, status: c.status === 'Active' ? 'Inactive' : 'Active' }
                                                : c
                                        )
                                    )
                                }
                                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${
                                    camp.status === 'Active'
                                        ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                        : 'bg-green-50 text-green-600 hover:bg-green-100'
                                }`}
                            >
                                {camp.status === 'Active' ? (isRTL ? 'إيقاف' : 'Disable') : (isRTL ? 'تفعيل' : 'Enable')}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
