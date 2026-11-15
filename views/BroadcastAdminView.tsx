import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { db, sendSystemBroadcastPush, sendGlobalNotification } from '../services/firebase';
import { PLAY_STORE_URL } from '../services/updateSystem';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { Broadcast } from '../types';
import { Button } from '../components/ui/Button';
import { HomeAdBannerAdminEditor } from '../components/HomeAdBannerAdminEditor';
import { toast } from 'sonner';

export const BroadcastAdminView = () => {
    const { language } = useLanguage();
    const isRTL = language === 'ar';
    
    // Maintenance Mode State
    const [isSavingMaintenance, setIsSavingMaintenance] = useState(false);
    const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
    const [maintenanceMsgEn, setMaintenanceMsgEn] = useState('We are currently improving the app experience. Please try again later.');
    const [maintenanceMsgAr, setMaintenanceMsgAr] = useState('نحن نقوم حالياً بتحديث النظام. يرجى المحاولة لاحقاً.');
    
    // Smart Force / Recommended Update State
    const [isSavingForceUpdate, setIsSavingForceUpdate] = useState(false);
    const [forceUpdateEnabled, setForceUpdateEnabled] = useState(false);
    const [forceUpdateMode, setForceUpdateMode] = useState<'force' | 'flexible'>('force');
    const [forceUpdateVersion, setForceUpdateVersion] = useState('1.2.2');
    const [forceUpdateMinBuild, setForceUpdateMinBuild] = useState('');
    const [forceUpdatePlayStoreUrl, setForceUpdatePlayStoreUrl] = useState(PLAY_STORE_URL);
    const [forceUpdateTitleEn, setForceUpdateTitleEn] = useState('Update Required');
    const [forceUpdateTitleAr, setForceUpdateTitleAr] = useState('تحديث مطلوب');
    const [forceUpdateMsgEn, setForceUpdateMsgEn] = useState('A new version of the app is available with new features and improvements. Please update to continue using Mowasla.');
    const [forceUpdateMsgAr, setForceUpdateMsgAr] = useState('يتوفر إصدار جديد من التطبيق بمميزات وتحسينات جديدة. يرجى التحديث للمتابعة.');
    const [sendPushOnUpdateSave, setSendPushOnUpdateSave] = useState(true);
    
    // Broadcast State
    const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);
    const [isTogglingBroadcastFeature, setIsTogglingBroadcastFeature] = useState(false);
    const [isDisablingAll, setIsDisablingAll] = useState(false);
    const [confirmBroadcastStep, setConfirmBroadcastStep] = useState(false);
    const [broadcastsEnabled, setBroadcastsEnabled] = useState(true);
    
    const [bTitle, setBTitle] = useState('');
    const [bTitleAr, setBTitleAr] = useState('');
    const [bMessage, setBMessage] = useState('');
    const [bMessageAr, setBMessageAr] = useState('');
    const [bType, setBType] = useState<'maintenance' | 'warning' | 'update' | 'promo' | 'alert'>('alert');
    const [bAudience, setBAudience] = useState<'all' | 'drivers' | 'passengers'>('all');
    const [bTargetVersion, setBTargetVersion] = useState('');
    const [bForceClose, setBForceClose] = useState(false);
    const [bSendPush, setBSendPush] = useState(true);
    
    const [recentBroadcasts, setRecentBroadcasts] = useState<Broadcast[]>([]);

    useEffect(() => {
        fetchSettings();
        fetchBroadcasts();
    }, []);

    const fetchSettings = async () => {
        try {
            const snap = await getDoc(doc(db, 'settings', 'app'));
            if (snap.exists()) {
                const data = snap.data();
                if (data.maintenanceMode) {
                    setMaintenanceEnabled(Boolean(data.maintenanceMode.isEnabled));
                    setMaintenanceMsgEn(data.maintenanceMode.messageEn || 'We are currently improving the app experience. Please try again later.');
                    setMaintenanceMsgAr(data.maintenanceMode.messageAr || 'نحن نقوم حالياً بتحديث النظام. يرجى المحاولة لاحقاً.');
                }
                if (data.forceUpdate) {
                    setForceUpdateEnabled(Boolean(data.forceUpdate.isEnabled));
                    setForceUpdateMode(data.forceUpdate.updateMode === 'flexible' ? 'flexible' : 'force');
                    setForceUpdateVersion(data.forceUpdate.requiredVersion || '1.2.2');
                    setForceUpdateMinBuild(data.forceUpdate.minBuildNumber ? String(data.forceUpdate.minBuildNumber) : '');
                    setForceUpdatePlayStoreUrl(
                      data.forceUpdate.playStoreUrl && !String(data.forceUpdate.playStoreUrl).includes('utm_source=chatgpt.com')
                        ? data.forceUpdate.playStoreUrl
                        : PLAY_STORE_URL
                    );
                    setForceUpdateTitleEn(data.forceUpdate.titleEn || 'Update Required');
                    setForceUpdateTitleAr(data.forceUpdate.titleAr || 'تحديث مطلوب');
                    setForceUpdateMsgEn(data.forceUpdate.messageEn || 'A new version of the app is available with new features and improvements. Please update to continue using Mowasla.');
                    setForceUpdateMsgAr(data.forceUpdate.messageAr || 'يتوفر إصدار جديد من التطبيق بمميزات وتحسينات جديدة. يرجى التحديث للمتابعة.');
                }
                if (data.broadcastsEnabled !== undefined) {
                    setBroadcastsEnabled(Boolean(data.broadcastsEnabled));
                } else {
                    setBroadcastsEnabled(true);
                }

                // Auto-repair if forceUpdate is enabled but broadcastsEnabled was false or not yet synced to broadcasts collection
                if (
                    data.forceUpdate?.isEnabled &&
                    (data.broadcastsEnabled === false || data.forceUpdate?.broadcastSyncedVersion !== data.forceUpdate?.requiredVersion)
                ) {
                    const reqVer = String(data.forceUpdate.requiredVersion || '1.2.2').trim();
                    const tEn = data.forceUpdate.titleEn || 'Update Required';
                    const tAr = data.forceUpdate.titleAr || 'تحديث مطلوب';
                    const mEn = data.forceUpdate.messageEn || 'A new version of the app is available. Please update from Google Play.';
                    const mAr = data.forceUpdate.messageAr || 'يتوفر إصدار جديد من التطبيق على جوجل بلاي. يرجى التحديث الآن.';
                    setBroadcastsEnabled(true);
                    await setDoc(doc(db, 'settings', 'app'), {
                        broadcastsEnabled: true,
                        forceUpdate: {
                            ...data.forceUpdate,
                            broadcastSyncedVersion: reqVer,
                        },
                    }, { merge: true }).catch(() => {});

                    const allSnap = await getDocs(collection(db, 'broadcasts')).catch(() => null);
                    if (allSnap) {
                        const batch = writeBatch(db);
                        let hasBatch = false;
                        allSnap.forEach((bDoc) => {
                            const bData = bDoc.data();
                            if (bData.isActive === true && (bData.type === 'update' || bData.type === 'Forced Update' || bData.title === 'fixed')) {
                                batch.update(doc(db, 'broadcasts', bDoc.id), { isActive: false, updatedAt: serverTimestamp() });
                                hasBatch = true;
                            }
                        });
                        if (hasBatch) await batch.commit().catch(() => {});
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
                            minBuildNumber: Number(data.forceUpdate.minBuildNumber || 0),
                            playStoreUrl: PLAY_STORE_URL,
                            forceClose: data.forceUpdate.updateMode !== 'flexible',
                            isActive: true,
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp(),
                        }).catch(() => {});
                        fetchBroadcasts();
                    }
                }
            }
        } catch (e: unknown) {
            console.error('Error fetching settings:', e);
        }
    };

    const fetchBroadcasts = async () => {
        try {
            const q = query(collection(db, 'broadcasts'), orderBy('createdAt', 'desc'), limit(20));
            const snap = await getDocs(q);
            const items: Broadcast[] = [];
            snap.forEach(d => {
                items.push({ id: d.id, ...d.data() } as Broadcast);
            });
            setRecentBroadcasts(items);
        } catch (e: unknown) {
            console.error('Error fetching broadcasts:', e);
        }
    };

    const triggerAndroidSystemPush = async (payload: {
        title: string;
        body: string;
        titleAr?: string;
        bodyAr?: string;
        type?: string;
        audience?: 'all' | 'drivers' | 'passengers';
        playStoreUrl?: string;
        broadcastId?: string;
        requiredVersion?: string;
    }) => {
        try {
            const res: any = await sendSystemBroadcastPush({
                ...payload,
                targetPlatform: 'android',
            });
            return Number(res?.data?.sentCount || 0);
        } catch {
            // Fallback to legacy callable if new function isn't deployed yet
            const fallbackRes: any = await sendGlobalNotification(payload.title, payload.body);
            return Number(fallbackRes?.data?.sentCount || 0);
        }
    };

    const handleSaveMaintenance = async (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        setIsSavingMaintenance(true);
        try {
            await setDoc(doc(db, 'settings', 'app'), {
                maintenanceMode: {
                    isEnabled: maintenanceEnabled,
                    messageEn: maintenanceMsgEn.trim() || 'We are currently improving the app experience. Please try again later.',
                    messageAr: maintenanceMsgAr.trim() || 'نحن نقوم حالياً بتحديث النظام. يرجى المحاولة لاحقاً.',
                    targetPlatform: 'android',
                    updatedAt: serverTimestamp()
                }
            }, { merge: true });
            
            toast.success(isRTL ? 'تم حفظ إعدادات الصيانة (تطبيق أندرويد فقط)' : 'Maintenance settings saved (Android Native only).');
        } catch (e: unknown) {
            console.error('Error updating maintenance mode:', e);
            toast.error(isRTL ? 'فشل تحديث وضع الصيانة' : 'Error updating maintenance mode.');
        } finally {
            setIsSavingMaintenance(false);
        }
    };

    const handleSaveForceUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const cleanVersion = forceUpdateVersion.trim().replace(/^v/i, '');
        const parsedMinBuild = forceUpdateMinBuild.trim() ? parseInt(forceUpdateMinBuild.trim(), 10) : 0;

        if (forceUpdateEnabled && !cleanVersion && (!Number.isFinite(parsedMinBuild) || parsedMinBuild <= 0)) {
            toast.error(isRTL ? 'يرجى تحديد رقم الإصدار أو رقم البناء المطلوب' : 'Please enter a required version (e.g. 1.2.2) or minimum build number.');
            return;
        }
            
        setIsSavingForceUpdate(true);
        try {
            const cleanPlayUrl = forceUpdatePlayStoreUrl.trim() || PLAY_STORE_URL;
            const resolvedTitleEn = forceUpdateTitleEn.trim() || 'Update Required';
            const resolvedTitleAr = forceUpdateTitleAr.trim() || 'تحديث مطلوب';
            const resolvedMsgEn = forceUpdateMsgEn.trim() || 'A new version of the app is available. Please update from Google Play.';
            const resolvedMsgAr = forceUpdateMsgAr.trim() || 'يتوفر إصدار جديد من التطبيق على جوجل بلاي. يرجى التحديث الآن.';

            await setDoc(doc(db, 'settings', 'app'), {
                ...(forceUpdateEnabled ? { broadcastsEnabled: true } : {}),
                forceUpdate: {
                    isEnabled: forceUpdateEnabled,
                    updateMode: forceUpdateMode,
                    requiredVersion: cleanVersion,
                    minBuildNumber: Number.isFinite(parsedMinBuild) && parsedMinBuild > 0 ? parsedMinBuild : 0,
                    playStoreUrl: cleanPlayUrl,
                    targetPlatform: 'android',
                    titleEn: resolvedTitleEn,
                    titleAr: resolvedTitleAr,
                    messageEn: resolvedMsgEn,
                    messageAr: resolvedMsgAr,
                    broadcastSyncedVersion: cleanVersion,
                    updatedAt: serverTimestamp()
                }
            }, { merge: true });

            if (forceUpdateEnabled) {
                setBroadcastsEnabled(true);
            }

            // Also sync to 'broadcasts' collection with a fresh document ID so both
            // newly built apps and already-installed APKs on phones immediately show the update bottom sheet.
            try {
                const allSnap = await getDocs(collection(db, 'broadcasts'));
                const batch = writeBatch(db);
                let hasBatchOps = false;
                allSnap.forEach((bDoc) => {
                    const bData = bDoc.data();
                    if (
                        bData.isActive === true &&
                        (bData.type === 'update' || bData.type === 'Forced Update' || bData.title === 'fixed')
                    ) {
                        batch.update(doc(db, 'broadcasts', bDoc.id), {
                            isActive: false,
                            updatedAt: serverTimestamp(),
                        });
                        hasBatchOps = true;
                    }
                });
                if (hasBatchOps) {
                    await batch.commit();
                }

                if (forceUpdateEnabled) {
                    await addDoc(collection(db, 'broadcasts'), {
                        title: resolvedTitleAr || resolvedTitleEn,
                        message: resolvedMsgAr || resolvedMsgEn,
                        titleEn: resolvedTitleEn,
                        titleAr: resolvedTitleAr,
                        messageEn: resolvedMsgEn,
                        messageAr: resolvedMsgAr,
                        type: 'update',
                        targetAudience: 'all',
                        targetPlatform: 'android',
                        targetVersion: cleanVersion,
                        minBuildNumber: Number.isFinite(parsedMinBuild) && parsedMinBuild > 0 ? parsedMinBuild : 0,
                        playStoreUrl: cleanPlayUrl,
                        forceClose: forceUpdateMode === 'force',
                        isActive: true,
                        pushSent: Boolean(sendPushOnUpdateSave),
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    });
                }
                fetchBroadcasts();
            } catch (syncErr) {
                console.warn('Broadcast collection sync warning:', syncErr);
            }

            if (forceUpdateEnabled && sendPushOnUpdateSave) {
                try {
                    const sentCount = await triggerAndroidSystemPush({
                        title: resolvedTitleAr || resolvedTitleEn,
                        body: resolvedMsgAr || resolvedMsgEn,
                        titleAr: resolvedTitleAr,
                        bodyAr: resolvedMsgAr,
                        type: 'SYSTEM_UPDATE',
                        audience: 'all',
                        playStoreUrl: cleanPlayUrl,
                        requiredVersion: cleanVersion,
                    });
                    toast.success(
                        isRTL
                          ? `تم حفظ التحديث وإظهار الرسالة وإرسال إشعار لـ ${sentCount} جهاز أندرويد`
                          : `Update sheet activated & pushed to ${sentCount} Android device(s).`
                    );
                } catch (pushErr) {
                    console.warn('Update push notification warning:', pushErr);
                    toast.success(isRTL ? 'تم حفظ وتفعيل نافذة التحديث بنجاح' : 'Update sheet settings saved successfully.');
                }
            } else {
                toast.success(isRTL ? 'تم حفظ إعدادات التحديث بنجاح' : 'Update settings saved successfully.');
            }
        } catch (e: unknown) {
            console.error('Error updating force update settings:', e);
            toast.error(isRTL ? 'فشل حفظ إعدادات التحديث' : 'Error updating force update settings.');
        } finally {
            setIsSavingForceUpdate(false);
        }
    };

    const handleToggleBroadcastSystem = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const isEnabled = e.target.checked;
        setIsTogglingBroadcastFeature(true);
        try {
            await setDoc(doc(db, 'settings', 'app'), {
                broadcastsEnabled: isEnabled
            }, { merge: true });
            setBroadcastsEnabled(isEnabled);
            toast.success(isEnabled ? 'System broadcasts enabled' : 'System broadcasts disabled');
        } catch (e: unknown) {
            console.error('Error updating broadcast settings:', e);
            toast.error('Error updating broadcast settings.');
            setBroadcastsEnabled(!isEnabled);
        } finally {
            setIsTogglingBroadcastFeature(false);
        }
    };

    const handleSendBroadcast = async (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!broadcastsEnabled) {
            try {
                await setDoc(doc(db, 'settings', 'app'), { broadcastsEnabled: true }, { merge: true });
                setBroadcastsEnabled(true);
            } catch {}
        }

        const primaryTitle = bTitle.trim() || bTitleAr.trim();
        const primaryMessage = bMessage.trim() || bMessageAr.trim();

        if (!primaryTitle || !primaryMessage) {
            toast.error(isRTL ? 'العنوان والمحتوى مطلوبان' : 'Title and Message are required.');
            return;
        }

        if (!confirmBroadcastStep) {
            setConfirmBroadcastStep(true);
            return;
        }

        setIsSendingBroadcast(true);
        try {
            const cleanTargetVersion = bTargetVersion.trim().replace(/^v/i, '');
            const docRef = await addDoc(collection(db, 'broadcasts'), {
                title: primaryTitle,
                message: primaryMessage,
                titleEn: bTitle.trim() || primaryTitle,
                titleAr: bTitleAr.trim() || primaryTitle,
                messageEn: bMessage.trim() || primaryMessage,
                messageAr: bMessageAr.trim() || primaryMessage,
                type: bType,
                targetAudience: bAudience,
                targetPlatform: 'android',
                targetVersion: bType === 'update' && cleanTargetVersion ? cleanTargetVersion : '',
                playStoreUrl: PLAY_STORE_URL,
                forceClose: bForceClose,
                isActive: true,
                pushSent: false,
                pushSentCount: 0,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            let sentCount = 0;
            if (bSendPush) {
                try {
                    sentCount = await triggerAndroidSystemPush({
                        title: bTitleAr.trim() || primaryTitle,
                        body: bMessageAr.trim() || primaryMessage,
                        titleAr: bTitleAr.trim() || primaryTitle,
                        bodyAr: bMessageAr.trim() || primaryMessage,
                        type: bType,
                        audience: bAudience,
                        playStoreUrl: PLAY_STORE_URL,
                        broadcastId: docRef.id,
                        requiredVersion: cleanTargetVersion,
                    });
                    await setDoc(docRef, { pushSent: true, pushSentCount: sentCount }, { merge: true });
                } catch (pushErr) {
                    console.warn('Broadcast push warning:', pushErr);
                }
            }

            toast.success(
                bSendPush
                  ? (isRTL ? `تم إرسال الرسالة وإشعار ${sentCount} جهاز أندرويد` : `Broadcast live & pushed to ${sentCount} Android device(s).`)
                  : (isRTL ? 'تم نشر رسالة النظام بنجاح' : 'System broadcast published.')
            );
            setBTitle('');
            setBTitleAr('');
            setBMessage('');
            setBMessageAr('');
            setBTargetVersion('');
            setConfirmBroadcastStep(false);
            fetchBroadcasts();
        } catch (e: unknown) {
            console.error('Error sending broadcast:', e);
            toast.error('Error sending broadcast.');
        } finally {
            setIsSendingBroadcast(false);
        }
    };

    const handleToggleBroadcast = async (broadcastId: string, currentStatus: boolean) => {
        try {
            await setDoc(doc(db, 'broadcasts', broadcastId), {
                isActive: !currentStatus,
                updatedAt: serverTimestamp(),
            }, { merge: true });
            fetchBroadcasts();
            toast.success(!currentStatus ? 'Broadcast reactivated' : 'Broadcast deactivated');
        } catch (e: unknown) {
            console.error('Error updating broadcast:', e);
            toast.error('Error updating broadcast.');
        }
    };

    const handleDeleteBroadcast = async (broadcastId: string) => {
        try {
            await deleteDoc(doc(db, 'broadcasts', broadcastId));
            setRecentBroadcasts(prev => prev.filter(b => b.id !== broadcastId));
            toast.success('Broadcast deleted.');
        } catch (e) {
            console.error('Error deleting broadcast:', e);
            toast.error('Failed to delete broadcast.');
        }
    };

    const handleRepushBroadcast = async (b: Broadcast) => {
        try {
            const sentCount = await triggerAndroidSystemPush({
                title: b.titleAr || b.title,
                body: b.messageAr || b.message,
                titleAr: b.titleAr || b.title,
                bodyAr: b.messageAr || b.message,
                type: b.type,
                audience: b.targetAudience || 'all',
                playStoreUrl: b.playStoreUrl || PLAY_STORE_URL,
                broadcastId: b.id,
                requiredVersion: b.targetVersion || '',
            });
            await setDoc(doc(db, 'broadcasts', b.id), {
                pushSent: true,
                pushSentCount: sentCount,
                updatedAt: serverTimestamp(),
            }, { merge: true });
            fetchBroadcasts();
            toast.success(`Push notification sent to ${sentCount} Android device(s).`);
        } catch (e) {
            console.error('Repush error:', e);
            toast.error('Failed to send push notification.');
        }
    };

    const handleDeactivateAllActive = async () => {
        const activeItems = recentBroadcasts.filter(b => b.isActive);
        if (activeItems.length === 0) return;
        setIsDisablingAll(true);
        try {
            const batch = writeBatch(db);
            activeItems.forEach((b) => {
                batch.set(doc(db, 'broadcasts', b.id), { isActive: false, updatedAt: serverTimestamp() }, { merge: true });
            });
            await batch.commit();
            await fetchBroadcasts();
            toast.success(`Deactivated ${activeItems.length} active broadcast(s).`);
        } catch (e) {
            console.error('Deactivate all error:', e);
            toast.error('Failed to deactivate broadcasts.');
        } finally {
            setIsDisablingAll(false);
        }
    };

    const activeCount = recentBroadcasts.filter(b => b.isActive).length;

    return (
        <div className="space-y-6 animate-fade-in" dir={isRTL ? "rtl" : "ltr"}>
            {/* Platform & Admin Isolation Notice */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-[24px] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-lg shrink-0 shadow-sm">
                        <i className="fab fa-android"></i>
                    </div>
                    <div>
                        <h4 className="font-black text-emerald-950 text-sm">
                            {isRTL ? 'نظام الرسائل والتحديثات الذكي (أندرويد فقط)' : 'Smart Android Update & System Messaging'}
                        </h4>
                        <p className="text-xs font-semibold text-emerald-800/80 mt-0.5 leading-relaxed">
                            {isRTL
                              ? 'تظهر رسائل التحديث، الصيانة، والتنبيهات الطارئة على تطبيق الأندرويد الأصلي فقط. يتم استثناء الويب وحسابات الإدارة تلقائياً.'
                              : 'Update popups, maintenance locks, and emergency system alerts target Android Native App users only. Web App & Admin accounts are automatically exempt.'}
                        </p>
                    </div>
                </div>
                {activeCount > 0 && (
                    <Button
                        type="button"
                        onClick={handleDeactivateAllActive}
                        isLoading={isDisablingAll}
                        className="bg-red-600 hover:bg-red-700 text-white rounded-xl px-4 py-2.5 text-xs font-black whitespace-nowrap shrink-0"
                    >
                        <i className="fas fa-power-off mr-1.5 rtl:ml-1.5"></i>
                        {isRTL ? `إيقاف الكل (${activeCount})` : `Deactivate All (${activeCount})`}
                    </Button>
                )}
            </div>

            <HomeAdBannerAdminEditor />

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                
                {/* Smart Force / Flexible Update Form */}
                <form onSubmit={handleSaveForceUpdate} className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 overflow-hidden relative flex flex-col xl:col-span-2">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-teal-500"></div>
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-lg transition-colors duration-300 ${forceUpdateEnabled ? 'bg-green-100 text-green-600 shadow-green-100' : 'bg-gray-100 text-gray-500'}`}>
                                <i className="fas fa-download"></i>
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-gray-900">Smart App Update (Google Play)</h3>
                                <p className="text-sm font-medium text-gray-500">Prompt or require Android Native users to update via Google Play</p>
                            </div>
                        </div>
                        <span className="px-3 py-1.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-bold">
                            Android Native Only • Admin Exempt
                        </span>
                    </div>

                    <div className="space-y-6 flex-grow flex flex-col">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors focus-within:ring-2 focus-within:ring-green-500">
                                <span className="font-bold text-gray-900 text-sm">Enable App Update</span>
                                <div className={`w-12 h-6 rounded-full p-1 transition-colors shrink-0 ${forceUpdateEnabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${forceUpdateEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                                </div>
                                <input type="checkbox" className="hidden" checked={forceUpdateEnabled} onChange={e => setForceUpdateEnabled(e.target.checked)} />
                            </label>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Update Mode</label>
                                <select
                                    value={forceUpdateMode}
                                    onChange={(e) => setForceUpdateMode(e.target.value as 'force' | 'flexible')}
                                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3.5 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-green-500 focus:outline-none"
                                >
                                    <option value="force">Mandatory (Force Update)</option>
                                    <option value="flexible">Recommended (Dismissible)</option>
                                </select>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Required Version (e.g. 1.2.2)</label>
                                <input 
                                    type="text"
                                    value={forceUpdateVersion} 
                                    onChange={e => setForceUpdateVersion(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3.5 text-sm font-bold focus:ring-2 focus:ring-green-500 focus:outline-none"
                                    placeholder="1.2.2"
                                    dir="ltr"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Min Build Code (Optional)</label>
                                <input 
                                    type="number"
                                    min="0"
                                    value={forceUpdateMinBuild} 
                                    onChange={e => setForceUpdateMinBuild(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3.5 text-sm font-bold focus:ring-2 focus:ring-green-500 focus:outline-none"
                                    placeholder="e.g. 2"
                                    dir="ltr"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Google Play Store Update Link</label>
                            <input
                                type="url"
                                value={forceUpdatePlayStoreUrl}
                                onChange={e => setForceUpdatePlayStoreUrl(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold text-blue-700 focus:ring-2 focus:ring-green-500 focus:outline-none"
                                dir="ltr"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Title (English)</label>
                                    <input 
                                        type="text"
                                        value={forceUpdateTitleEn} 
                                        onChange={e => setForceUpdateTitleEn(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-green-500 focus:outline-none"
                                        dir="ltr"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Message (English)</label>
                                    <textarea 
                                        value={forceUpdateMsgEn} 
                                        onChange={e => setForceUpdateMsgEn(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-green-500 focus:outline-none min-h-[80px]"
                                        dir="ltr"
                                    />
                                </div>
                            </div>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Title (Arabic)</label>
                                    <input 
                                        type="text"
                                        value={forceUpdateTitleAr} 
                                        onChange={e => setForceUpdateTitleAr(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-green-500 focus:outline-none"
                                        dir="rtl"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Message (Arabic)</label>
                                    <textarea 
                                        value={forceUpdateMsgAr} 
                                        onChange={e => setForceUpdateMsgAr(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-green-500 focus:outline-none min-h-[80px]"
                                        dir="rtl"
                                    />
                                </div>
                            </div>
                        </div>

                        <label className="flex items-center gap-3 p-3.5 bg-green-50/70 border border-green-100 rounded-2xl cursor-pointer">
                            <input
                                type="checkbox"
                                checked={sendPushOnUpdateSave}
                                onChange={(e) => setSendPushOnUpdateSave(e.target.checked)}
                                className="w-5 h-5 rounded text-green-600 border-gray-300 focus:ring-green-500"
                            />
                            <span className="text-sm font-bold text-green-950">
                                Also send immediate Push Notification (FCM) to all Android users when enabling update
                            </span>
                        </label>

                        <Button 
                            type="submit" 
                            disabled={isSavingForceUpdate}
                            isLoading={isSavingForceUpdate} 
                            className="w-full py-4 rounded-xl font-black text-base bg-gray-900 text-white hover:bg-black shadow-xl shadow-gray-200 transition-all hover:-translate-y-0.5 active:translate-y-0 mt-auto">
                            Save Smart Update Settings
                        </Button>
                    </div>
                </form>

                {/* Maintenance Mode Form */}
                <form onSubmit={handleSaveMaintenance} className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 overflow-hidden relative flex flex-col">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500"></div>
                    <div className="flex items-center gap-4 mb-6">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-lg transition-colors duration-300 ${maintenanceEnabled ? 'bg-red-100 text-red-600 shadow-red-100' : 'bg-gray-100 text-gray-500'}`}>
                            <i className="fas fa-tools"></i>
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-gray-900">Maintenance Mode</h3>
                            <p className="text-sm font-medium text-gray-500">Block Android Native app usage during maintenance (Admin exempt)</p>
                        </div>
                    </div>

                    <div className="space-y-6 flex-grow flex flex-col">
                        <label className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors focus-within:ring-2 focus-within:ring-red-500">
                            <span className="font-bold text-gray-900">Enable Maintenance Mode</span>
                            <div className={`w-12 h-6 rounded-full p-1 transition-colors ${maintenanceEnabled ? 'bg-red-500' : 'bg-gray-300'}`}>
                                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${maintenanceEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                            </div>
                            <input type="checkbox" className="hidden" checked={maintenanceEnabled} onChange={e => setMaintenanceEnabled(e.target.checked)} />
                        </label>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Message (English)</label>
                            <textarea 
                                value={maintenanceMsgEn} 
                                onChange={e => setMaintenanceMsgEn(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-red-500 focus:outline-none min-h-[80px]"
                                dir="ltr"
                            />
                        </div>
                        <div className="flex-grow">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Message (Arabic)</label>
                            <textarea 
                                value={maintenanceMsgAr} 
                                onChange={e => setMaintenanceMsgAr(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-red-500 focus:outline-none min-h-[80px]"
                                dir="rtl"
                            />
                        </div>

                        <Button 
                            type="submit" 
                            disabled={isSavingMaintenance}
                            isLoading={isSavingMaintenance} 
                            className="w-full py-4 rounded-xl font-black text-base bg-gray-900 text-white hover:bg-black shadow-xl shadow-gray-200 transition-all hover:-translate-y-0.5 active:translate-y-0 mt-auto">
                            Save Maintenance Settings
                        </Button>
                    </div>
                </form>

                {/* Emergency & System Broadcasts Form */}
                <form onSubmit={handleSendBroadcast} className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 overflow-hidden relative flex flex-col">
                    <div className={`absolute top-0 left-0 w-full h-1 transition-colors ${broadcastsEnabled ? 'bg-gradient-to-r from-blue-500 to-indigo-500' : 'bg-gray-300'}`}></div>
                    
                    <div className="flex items-start justify-between mb-6 gap-4">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-lg transition-colors ${broadcastsEnabled ? 'bg-blue-100 text-blue-600 shadow-blue-100' : 'bg-gray-100 text-gray-400'}`}>
                                <i className="fas fa-bullhorn"></i>
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-gray-900">Emergency & System Broadcast</h3>
                                <p className="text-sm font-medium text-gray-500">Instant Android popup + push alert (Web & Admin excluded)</p>
                            </div>
                        </div>

                        {!broadcastsEnabled && (
                            <span className="bg-red-50 text-red-600 border border-red-100 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded">
                                Disabled
                            </span>
                        )}
                    </div>

                    <div className="space-y-4 flex-grow flex flex-col">
                        <label className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors focus-within:ring-2 focus-within:ring-blue-500 mb-1">
                            <span className="font-bold text-gray-900">Enable System Broadcasts</span>
                            <div className={`w-12 h-6 rounded-full p-1 transition-colors ${broadcastsEnabled ? 'bg-blue-500' : 'bg-gray-300'}`}>
                                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${broadcastsEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                            </div>
                            <input disabled={isTogglingBroadcastFeature} type="checkbox" className="hidden" checked={broadcastsEnabled} onChange={handleToggleBroadcastSystem} />
                        </label>
                        
                        <div className={`space-y-4 transition-all duration-300 flex-grow flex flex-col ${!broadcastsEnabled ? 'opacity-50 pointer-events-none grayscale-[50%]' : ''}`}>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Audience</label>
                                    <select 
                                        disabled={!broadcastsEnabled}
                                        value={bAudience} 
                                        onChange={(e) => { setBAudience(e.target.value as any); setConfirmBroadcastStep(false); }}
                                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    >
                                        <option value="all">Everyone (Android)</option>
                                        <option value="drivers">Drivers Only</option>
                                        <option value="passengers">Passengers Only</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Message Type</label>
                                    <select 
                                        disabled={!broadcastsEnabled}
                                        value={bType} 
                                        onChange={(e) => { setBType(e.target.value as any); setConfirmBroadcastStep(false); }}
                                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    >
                                        <option value="alert">Critical Emergency</option>
                                        <option value="warning">Warning</option>
                                        <option value="update">App Update (Google Play)</option>
                                        <option value="maintenance">Maintenance Notice</option>
                                        <option value="promo">Info / Announcement</option>
                                    </select>
                                </div>
                            </div>

                            {bType === 'update' && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                                        Target Version (Auto-hides once updated, e.g. 1.2.2)
                                    </label>
                                    <input
                                        disabled={!broadcastsEnabled}
                                        type="text"
                                        value={bTargetVersion}
                                        onChange={(e) => setBTargetVersion(e.target.value)}
                                        className="w-full bg-blue-50/50 border border-blue-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                        placeholder="e.g. 1.2.2"
                                        dir="ltr"
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Title (English)</label>
                                    <input 
                                        disabled={!broadcastsEnabled}
                                        type="text"
                                        value={bTitle} 
                                        onChange={e => { setBTitle(e.target.value); setConfirmBroadcastStep(false); }}
                                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                        placeholder="e.g. Mandatory App Update"
                                        dir="ltr"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Title (Arabic)</label>
                                    <input 
                                        disabled={!broadcastsEnabled}
                                        type="text"
                                        value={bTitleAr} 
                                        onChange={e => { setBTitleAr(e.target.value); setConfirmBroadcastStep(false); }}
                                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                        placeholder="مثال: تحديث جديد للتطبيق"
                                        dir="rtl"
                                    />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-grow">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Message (English)</label>
                                    <textarea 
                                        disabled={!broadcastsEnabled}
                                        value={bMessage} 
                                        onChange={e => { setBMessage(e.target.value); setConfirmBroadcastStep(false); }}
                                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none min-h-[80px]"
                                        placeholder="Details in English..."
                                        dir="ltr"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Message (Arabic)</label>
                                    <textarea 
                                        disabled={!broadcastsEnabled}
                                        value={bMessageAr} 
                                        onChange={e => { setBMessageAr(e.target.value); setConfirmBroadcastStep(false); }}
                                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none min-h-[80px]"
                                        placeholder="التفاصيل بالعربية..."
                                        dir="rtl"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2 pt-1">
                                <label className="flex items-center gap-3 cursor-pointer focus-within:ring-2 focus-within:ring-blue-500 rounded p-1">
                                    <input disabled={!broadcastsEnabled} type="checkbox" checked={bForceClose} onChange={e => setBForceClose(e.target.checked)} className="w-5 h-5 rounded text-blue-600 border-gray-300 focus:ring-blue-500" />
                                    <span className="text-sm font-bold text-gray-700">Mandatory / Cannot skip (Force Action)</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer focus-within:ring-2 focus-within:ring-blue-500 rounded p-1">
                                    <input disabled={!broadcastsEnabled} type="checkbox" checked={bSendPush} onChange={e => setBSendPush(e.target.checked)} className="w-5 h-5 rounded text-blue-600 border-gray-300 focus:ring-blue-500" />
                                    <span className="text-sm font-bold text-blue-800">Also send Android Push Notification (FCM) immediately</span>
                                </label>
                            </div>

                            {confirmBroadcastStep ? (
                                <div className="flex gap-2 mt-auto">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setConfirmBroadcastStep(false)}
                                        className="flex-1 py-4 rounded-xl font-bold text-sm"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={!broadcastsEnabled || isSendingBroadcast}
                                        isLoading={isSendingBroadcast}
                                        className="flex-[2] py-4 rounded-xl font-black text-base bg-red-600 text-white hover:bg-red-700 shadow-xl shadow-red-200"
                                    >
                                        Confirm & Send Now <i className="fas fa-paper-plane ml-2"></i>
                                    </Button>
                                </div>
                            ) : (
                                <Button 
                                    type="submit" 
                                    disabled={!broadcastsEnabled || isSendingBroadcast}
                                    isLoading={isSendingBroadcast} 
                                    className="w-full py-4 rounded-xl font-black text-base bg-blue-600 text-white hover:bg-blue-700 shadow-xl shadow-blue-200 mt-auto transition-all hover:-translate-y-0.5 active:translate-y-0">
                                    Send System Broadcast <i className="fas fa-paper-plane ml-2"></i>
                                </Button>
                            )}
                        </div>
                    </div>
                </form>
            </div>

            {/* Active/Recent Broadcasts */}
            <div className={`bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 transition-colors ${!broadcastsEnabled ? 'opacity-75 bg-gray-50' : ''}`}>
                <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
                     <div className="flex items-center gap-3">
                        <h3 className="text-base font-black text-gray-900 uppercase tracking-widest">Recent Broadcasts</h3>
                        {!broadcastsEnabled && (
                            <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded border border-red-100">Global System Disabled</span>
                        )}
                     </div>
                     <span className="text-xs font-bold text-gray-400">Showing latest 20</span>
                </div>
                
                <div className="space-y-3">
                    {recentBroadcasts.length === 0 ? (
                        <div className="text-center py-6 text-gray-400 font-medium">No recent broadcasts.</div>
                    ) : (
                        recentBroadcasts.map(b => (
                            <div key={b.id} className={`p-4 rounded-2xl border ${b.isActive ? 'border-blue-100 bg-blue-50/70' : 'border-gray-100 bg-gray-50'} flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors`}>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                            b.type === 'alert' ? 'bg-red-100 text-red-600' :
                                            b.type === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                                            b.type === 'promo' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                                        }`}>{b.type}</span>
                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">• {b.targetAudience}</span>
                                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Android Native</span>
                                        {b.targetVersion && (
                                            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">Target &lt; v{b.targetVersion}</span>
                                        )}
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${b.isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-500'}`}>{b.isActive ? 'Active' : 'Inactive'}</span>
                                        {b.pushSent && (
                                            <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">Push: {b.pushSentCount || 0}</span>
                                        )}
                                    </div>
                                    <h4 className="font-bold text-sm text-gray-900" dir="auto">{b.titleAr || b.title}</h4>
                                    <p className="text-xs text-gray-500 mt-1 line-clamp-1" dir="auto">{b.messageAr || b.message}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => handleRepushBroadcast(b)}
                                        className="px-3 py-1.5 rounded-full shadow-none text-xs font-bold"
                                        title="Re-send Push Notification"
                                    >
                                        <i className="fas fa-bell mr-1"></i> Push
                                    </Button>
                                    <Button 
                                        type="button"
                                        variant={b.isActive ? 'danger' : 'outline'} 
                                        onClick={() => handleToggleBroadcast(b.id, b.isActive)}
                                        className="px-3 py-1.5 rounded-full shadow-none text-xs font-bold"
                                    >
                                        {b.isActive ? 'Deactivate' : 'Reactivate'}
                                    </Button>
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteBroadcast(b.id)}
                                        className="w-8 h-8 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-200 flex items-center justify-center transition-colors"
                                        title="Delete Broadcast"
                                    >
                                        <i className="fas fa-trash text-xs"></i>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
