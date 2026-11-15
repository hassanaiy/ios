import React, { useState, useCallback, useMemo } from 'react';
import { Driver } from '../types';
import { Button } from '../components/ui/Button';
import { doc, updateDoc } from 'firebase/firestore';
import { db, updateDriverApprovalStatus } from '../services/firebaseBridge';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';

export const DriverManagementModal = React.memo(({ 
    selectedDriver, 
    onClose, 
    onActionCompleted
}: { 
    selectedDriver: Driver; 
    onClose: () => void; 
    onActionCompleted: () => void;
}) => {
    const { t, isRTL } = useLanguage();
    const [loadingAction, setLoadingAction] = useState<string | null>(null);
    const [view, setView] = useState<'details' | 'moderation'>('details');
    const [adminNotes, setAdminNotes] = useState(selectedDriver.adminNotes || '');

    const executeAction = useCallback(async (actionId: string, actionFn: () => Promise<void>) => {
        if (loadingAction) return;
        setLoadingAction(actionId);
        try {
            await actionFn();
            toast.success(t('admin_status_updated_success'));
            onActionCompleted();
        } catch (e: any) {
            console.error(`Action ${actionId} failed:`, e);
            toast.error(t('admin_action_error'));
        } finally {
            setLoadingAction(null);
        }
    }, [loadingAction, t, onActionCompleted]);

    const handleBan = useCallback(() => {
        const reason = window.prompt(t('admin_ban_reason'));
        if (!reason) return;
        
        if (!window.confirm(t('admin_confirm_ban'))) return;

        executeAction('ban', async () => {
            await updateDoc(doc(db, 'users', selectedDriver.id), {
                isBanned: true,
                banReason: reason,
                isOnline: false,
                fcmToken: null
            });
        });
    }, [executeAction, selectedDriver.id, t]);

    const handleSuspend = useCallback(() => {
        const days = parseInt(window.prompt(t('admin_suspension_days')) || '0');
        if (days <= 0) return;
        
        executeAction('suspend', async () => {
            const suspendedUntil = Date.now() + (days * 24 * 60 * 60 * 1000);
            await updateDoc(doc(db, 'users', selectedDriver.id), {
                suspendedUntil,
                isOnline: false
            });
        });
    }, [executeAction, selectedDriver.id, t]);

    const handleSendWarning = useCallback(() => {
        const warning = window.prompt(isRTL ? 'اكتب رسالة التنبيه' : 'Write warning message:');
        if (!warning) return;
        
        executeAction('warning', async () => {
            await updateDoc(doc(db, 'users', selectedDriver.id), {
                warningMessage: warning
            });
        });
    }, [executeAction, isRTL, selectedDriver.id]);

    const handleUnban = useCallback(() => {
        executeAction('unban', async () => {
            await updateDoc(doc(db, 'users', selectedDriver.id), {
                isBanned: false,
                banReason: null,
                suspendedUntil: null
            });
        });
    }, [executeAction, selectedDriver.id]);

    const handleForceOffline = useCallback(() => {
        if (!window.confirm(t('admin_confirm_force_offline'))) return;
        
        executeAction('offline', async () => {
            await updateDoc(doc(db, 'users', selectedDriver.id), {
                isOnline: false
            });
        });
    }, [executeAction, selectedDriver.id, t]);

    const handleApprove = useCallback(() => {
        if (!window.confirm(t('admin_confirm_approve'))) return;

        executeAction('approve', async () => {
            await updateDriverApprovalStatus(selectedDriver.id, 'approved');
        });
    }, [executeAction, selectedDriver.id, t]);

    const handleReject = useCallback(() => {
        const reason = window.prompt(t('admin_rejection_reason'));
        if (!reason) return;

        if (!window.confirm(t('admin_confirm_reject'))) return;

        executeAction('reject', async () => {
            await updateDriverApprovalStatus(selectedDriver.id, 'rejected', reason);
        });
    }, [executeAction, selectedDriver.id, t]);

    const handleResetStatus = useCallback(() => {
        if (!window.confirm(t('admin_confirm_reset_status'))) return;
        
        executeAction('reset', async () => {
            await updateDoc(doc(db, 'users', selectedDriver.id), {
                status: 'pending',
                driverStatus: 'pending',
                kycStatus: 'PENDING_REVIEW',
                isApproved: false,
                rejectionReason: null,
                approvedNotice: null,
                rejectionNotice: null,
                approvalNoticeShown: false,
                rejectionNoticeShown: false,
                driverApplicationStatusChangedAt: Date.now()
            });
        });
    }, [executeAction, selectedDriver.id, t]);

    const handleClearDocs = useCallback(() => {
        if (!window.confirm(t('admin_confirm_clear_docs'))) return;
        
        executeAction('clearDocs', async () => {
            await updateDoc(doc(db, 'users', selectedDriver.id), {
                nationalIdUrl: null,
                nationalIdBackUrl: null,
                licenseUrl: null,
                criminalRecordUrl: null,
                documents: null
            });
        });
    }, [executeAction, selectedDriver.id, t]);

    const handleRemoveVehicle = useCallback(() => {
        if (!window.confirm(t('admin_confirm_remove_vehicle'))) return;
        
        executeAction('removeVehicle', async () => {
            await updateDoc(doc(db, 'users', selectedDriver.id), {
                vehicleBrand: null,
                vehicleModel: null,
                vehicleYear: null,
                vehicleColor: null,
                vehiclePlate: null,
                vehicleImageUrl: null,
                vehicleRegFrontUrl: null,
                vehicleRegBackUrl: null
            });
        });
    }, [executeAction, selectedDriver.id, t]);

    const handleSaveNotes = useCallback(() => {
        executeAction('saveNotes', async () => {
            await updateDoc(doc(db, 'users', selectedDriver.id), {
                adminNotes
            });
        });
    }, [executeAction, adminNotes, selectedDriver.id]);

    const DocPreview = useMemo(() => ({ label, url }: { label: string, url?: string }) => (
        <div className="flex flex-col gap-2">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
            {url ? (
                <a href={url} target="_blank" rel="noreferrer" className="block relative group overflow-hidden rounded-2xl aspect-[4/3] bg-gray-100 border-2 border-gray-100 focus-within:ring-2 focus-within:ring-blue-500">
                    <img src={url} alt={label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white text-[10px] font-black uppercase tracking-widest">Click to Expand</span>
                    </div>
                </a>
            ) : (
                <div className="aspect-[4/3] rounded-2xl bg-red-50 border-2 border-red-100 border-dashed flex items-center justify-center">
                    <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Missing Document</span>
                </div>
            )}
        </div>
    ), []);

    const DetailField = useMemo(() => ({ label, value, valueClass, isMono }: any) => (
        <div className="flex flex-col gap-1">
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
            <span className={`text-sm font-bold ${valueClass || 'text-gray-900'} ${isMono ? 'font-mono' : ''}`}>{value || '—'}</span>
        </div>
    ), []);

    const isButtonDisabled = !!loadingAction;

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
            <div className="bg-white w-full max-w-5xl h-[90vh] rounded-[40px] flex flex-col shadow-2xl overflow-hidden animate-slide-up" dir={isRTL ? 'rtl' : 'ltr'}>
                
                {/* Header */}
                <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div className="flex items-center gap-6">
                        <img src={selectedDriver.avatar || `https://ui-avatars.com/api/?name=${selectedDriver.name}`} alt={selectedDriver.name} className="w-16 h-16 rounded-2xl border-4 border-white shadow-md object-cover" />
                        <div className="text-left rtl:text-right">
                            <div className="flex items-center gap-3">
                                <h2 className="text-2xl font-black text-gray-900 tracking-tight">{selectedDriver.name}</h2>
                                {selectedDriver.isBanned && <span className="px-2 py-1 bg-red-100 text-red-700 text-[10px] font-black uppercase rounded-lg">Banned</span>}
                                {(selectedDriver.suspendedUntil ?? 0) > Date.now() && <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-[10px] font-black uppercase rounded-lg">Suspended</span>}
                            </div>
                            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">{selectedDriver.phone}</p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="flex bg-gray-100 p-1 rounded-2xl">
                            <button 
                                onClick={() => setView('details')}
                                className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${view === 'details' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                Details & Docs
                            </button>
                            <button 
                                onClick={() => setView('moderation')}
                                className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${view === 'moderation' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                Moderation
                            </button>
                        </div>
                        <button onClick={onClose} className="w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto bg-white p-10">
                    {view === 'details' ? (
                        <div className="space-y-8">
                            {/* Verification Documents Grid */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                                        <i className="fas fa-folder-open text-blue-600"></i>
                                        {isRTL ? "مستندات ووثائق السائق (8 مستندات)" : "Driver Verification Documents (8 Documents)"}
                                    </h3>
                                    <span className="text-xs font-bold text-gray-400">
                                        {isRTL ? "انقر على أي مستند لتكبيره بالحجم الكامل" : "Click any document to inspect full size"}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <DocPreview label={isRTL ? "بطاقة الرقم القومي (الوجه)" : "National ID (Front)"} url={selectedDriver.documents?.nationalIdFront || selectedDriver.nationalIdUrl} />
                                    <DocPreview label={isRTL ? "بطاقة الرقم القومي (الظهر)" : "National ID (Back)"} url={selectedDriver.documents?.nationalIdBack || selectedDriver.nationalIdBackUrl} />
                                    <DocPreview label={isRTL ? "رخصة القيادة" : "Driver License"} url={selectedDriver.documents?.licenseFront || selectedDriver.licenseUrl} />
                                    <DocPreview label={isRTL ? "رخصة المركبة (الوجه)" : "Registration (Front)"} url={selectedDriver.documents?.vehicleRegFront || selectedDriver.vehicleRegFrontUrl} />
                                    <DocPreview label={isRTL ? "رخصة المركبة (الظهر)" : "Registration (Back)"} url={selectedDriver.documents?.vehicleRegBack || selectedDriver.vehicleRegBackUrl} />
                                    <DocPreview label={isRTL ? "صورة المركبة" : "Vehicle Photo"} url={selectedDriver.documents?.vehiclePhotos?.[0] || selectedDriver.vehicleImageUrl} />
                                    <DocPreview label={isRTL ? "الصورة الشخصية" : "Personal Photo"} url={selectedDriver.personalPhotoUrl || selectedDriver.avatar} />
                                    <DocPreview label={isRTL ? "الفيش والتشبيه (صحيفة الحالة الجنائية)" : "Criminal Record"} url={selectedDriver.documents?.criminalRecord || (selectedDriver as any).criminalRecordUrl} />
                                </div>
                            </div>
                            
                            {/* Vehicle & Applicant Specifications */}
                            <div className="bg-gray-50 rounded-[32px] p-8 border border-gray-100">
                                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6">
                                    {isRTL ? "بيانات المركبة وحساب السائق" : "Vehicle & Driver Account Details"}
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                    <DetailField label={isRTL ? "نوع المركبة" : "Vehicle Type"} value={(selectedDriver as any).vehicleType || 'Car'} />
                                    <DetailField label={isRTL ? "الماركة والموديل" : "Brand / Model"} value={`${selectedDriver.vehicleBrand || ''} ${selectedDriver.vehicleModel || ''}`} />
                                    <DetailField label={isRTL ? "سنة الصنع" : "Year"} value={selectedDriver.vehicleYear} />
                                    <DetailField label={isRTL ? "اللون" : "Color"} value={selectedDriver.vehicleColor} />
                                    <DetailField label={isRTL ? "رقم اللوحة" : "Plate Number"} value={selectedDriver.vehiclePlate} isMono />
                                    <DetailField label={isRTL ? "حساب إنستاباي" : "InstaPay Number"} value={(selectedDriver as any).instapayNumber || '—'} isMono />
                                    <DetailField label={isRTL ? "تاريخ تقديم الطلب" : "Submitted Date"} value={(selectedDriver as any).submittedAt ? new Date((selectedDriver as any).submittedAt).toLocaleString() : '—'} />
                                    <DetailField label={isRTL ? "حالة الحساب" : "Account Status"} value={selectedDriver.status || 'pending'} valueClass={selectedDriver.status === 'approved' ? 'text-green-600 font-black' : selectedDriver.status === 'rejected' ? 'text-red-600 font-black' : 'text-amber-600 font-black'} />
                                </div>
                            </div>

                            {/* Quick Review Actions Bar in Details View */}
                            <div className="p-6 bg-blue-50/60 rounded-3xl border border-blue-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div>
                                    <h4 className="text-sm font-black text-blue-950">
                                        {isRTL ? "قرار فحص الوثائق والتفعيل" : "Document Review Decision"}
                                    </h4>
                                    <p className="text-xs text-blue-700/80 font-medium">
                                        {isRTL ? "يمكنك قبول السائق فوراً أو رفض الطلب مع توضيح السبب." : "Approve this driver to begin accepting trips or reject with a reason."}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                    <Button 
                                        isLoading={loadingAction === 'reject'} 
                                        disabled={isButtonDisabled}
                                        onClick={handleReject} 
                                        className="flex-1 sm:flex-none bg-white text-red-600 border border-red-200 hover:bg-red-50 rounded-xl px-6 h-12 text-xs font-black"
                                    >
                                        <i className="fas fa-times me-2"></i> {t('reject')}
                                    </Button>
                                    <Button 
                                        isLoading={loadingAction === 'approve'} 
                                        disabled={isButtonDisabled}
                                        onClick={handleApprove} 
                                        className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-8 h-12 text-xs font-black shadow-lg shadow-emerald-600/20"
                                    >
                                        <i className="fas fa-check me-2"></i> {t('approve')}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-12">
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Approval Block */}
                                <div className="bg-blue-50/50 p-8 rounded-[32px] border border-blue-100 flex flex-col gap-6">
                                    <div>
                                        <h3 className="text-lg font-black text-blue-900">Application Status</h3>
                                        <p className="text-xs font-medium text-blue-700/70 mt-1">Approve or reject the driver's documents.</p>
                                    </div>
                                    <div className="flex gap-4 mt-auto">
                                        <Button 
                                            isLoading={loadingAction === 'approve'} 
                                            disabled={isButtonDisabled}
                                            onClick={handleApprove} 
                                            className="flex-1 bg-blue-600 text-white rounded-xl h-12 text-xs font-black uppercase"
                                        >
                                            {t('approve')}
                                        </Button>
                                        <Button 
                                            isLoading={loadingAction === 'reject'} 
                                            disabled={isButtonDisabled}
                                            onClick={handleReject} 
                                            className="flex-1 bg-white text-red-600 border border-red-100 hover:bg-red-50 rounded-xl h-12 text-xs font-black uppercase"
                                        >
                                            {t('reject')}
                                        </Button>
                                    </div>
                                </div>

                                {/* Live Session Block */}
                                <div className="bg-orange-50/50 p-8 rounded-[32px] border border-orange-100 flex flex-col gap-6">
                                    <div>
                                        <h3 className="text-lg font-black text-orange-900">Session Controls</h3>
                                        <p className="text-xs font-medium text-orange-700/70 mt-1">Manage active driver session.</p>
                                    </div>
                                    <div className="flex gap-4 mt-auto">
                                        <Button 
                                            isLoading={loadingAction === 'offline'} 
                                            disabled={isButtonDisabled}
                                            onClick={handleForceOffline} 
                                            className="flex-1 bg-orange-600 text-white rounded-xl h-12 text-xs font-black uppercase"
                                        >
                                            {isRTL ? 'إخراج أوفلاين' : 'Force Offline'}
                                        </Button>
                                    </div>
                                </div>
                                {/* Control Block */}
                                <div className="bg-gray-50/50 p-8 rounded-[32px] border border-gray-100 flex flex-col gap-6 col-span-1 md:col-span-2 mt-4">
                                    <div>
                                        <h3 className="text-lg font-black text-gray-900">Data Controls</h3>
                                        <p className="text-xs font-medium text-gray-500 mt-1">Reset application state or clear user data.</p>
                                    </div>
                                    <div className="flex gap-4">
                                        <Button 
                                            isLoading={loadingAction === 'reset'} 
                                            disabled={isButtonDisabled}
                                            onClick={handleResetStatus} 
                                            className="flex-1 bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 rounded-xl h-12 text-[10px] font-black uppercase"
                                        >
                                            Reset Status & Reason
                                        </Button>
                                        <Button 
                                            isLoading={loadingAction === 'clearDocs'} 
                                            disabled={isButtonDisabled}
                                            onClick={handleClearDocs} 
                                            className="flex-1 bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 rounded-xl h-12 text-[10px] font-black uppercase"
                                        >
                                            Clear Documents
                                        </Button>
                                        <Button 
                                            isLoading={loadingAction === 'removeVehicle'} 
                                            disabled={isButtonDisabled}
                                            onClick={handleRemoveVehicle} 
                                            className="flex-1 bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 rounded-xl h-12 text-[10px] font-black uppercase"
                                        >
                                            Remove Vehicle details
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Moderation Block */}
                            <div>
                                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6">Enforcement & Moderation</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="border border-red-100 bg-red-50/30 p-6 rounded-3xl flex flex-col justify-between gap-6">
                                        <div>
                                            <div className="w-10 h-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4"><i className="fas fa-ban"></i></div>
                                            <h4 className="font-bold text-red-900">Permanent Ban</h4>
                                            <p className="text-[11px] text-red-700/70 mt-2 font-medium">Instantly log out driver and block all future access. Requires reason.</p>
                                        </div>
                                        {selectedDriver.isBanned ? (
                                            <Button 
                                                isLoading={loadingAction === 'unban'} 
                                                disabled={isButtonDisabled}
                                                onClick={handleUnban} 
                                                className="w-full bg-white text-gray-900 border border-gray-200 shadow-sm  rounded-xl h-12 text-xs font-black uppercase"
                                            >
                                                Unban Driver
                                            </Button>
                                        ) : (
                                            <Button 
                                                isLoading={loadingAction === 'ban'} 
                                                disabled={isButtonDisabled}
                                                onClick={handleBan} 
                                                className="w-full bg-red-600 text-white rounded-xl h-12 text-xs font-black uppercase shadow-lg shadow-red-200"
                                            >
                                                Issue Ban
                                            </Button>
                                        )}
                                    </div>

                                    <div className="border border-yellow-200 bg-yellow-50/50 p-6 rounded-3xl flex flex-col justify-between gap-6">
                                        <div>
                                            <div className="w-10 h-10 bg-yellow-200 text-yellow-700 rounded-full flex items-center justify-center mb-4"><i className="fas fa-clock"></i></div>
                                            <h4 className="font-bold text-yellow-900">Suspend Account</h4>
                                            <p className="text-[11px] text-yellow-800/70 mt-2 font-medium">Temporarily block driver for X days. Automatically expires.</p>
                                        </div>
                                        { (selectedDriver.suspendedUntil ?? 0) > Date.now() ? (
                                             <Button 
                                                isLoading={loadingAction === 'unban'} 
                                                disabled={isButtonDisabled}
                                                onClick={handleUnban} 
                                                className="w-full bg-white text-gray-900 border border-gray-200 shadow-sm  rounded-xl h-12 text-xs font-black uppercase"
                                             >
                                                Remove Suspension
                                             </Button>
                                        ) : (
                                            <Button 
                                                isLoading={loadingAction === 'suspend'} 
                                                disabled={isButtonDisabled}
                                                onClick={handleSuspend} 
                                                className="w-full bg-yellow-500 text-white rounded-xl h-12 text-xs font-black uppercase shadow-lg shadow-yellow-200"
                                            >
                                                Suspend Driver
                                            </Button>
                                        )}
                                    </div>

                                    <div className="border border-gray-200 bg-gray-50/50 p-6 rounded-3xl flex flex-col justify-between gap-6">
                                        <div>
                                            <div className="w-10 h-10 bg-gray-200 text-gray-700 rounded-full flex items-center justify-center mb-4"><i className="fas fa-exclamation-triangle"></i></div>
                                            <h4 className="font-bold text-gray-900">Send Warning</h4>
                                            <p className="text-[11px] text-gray-500 mt-2 font-medium">Push a warning modal to their app that they must acknowledge.</p>
                                        </div>
                                        <Button 
                                            isLoading={loadingAction === 'warning'} 
                                            disabled={isButtonDisabled}
                                            onClick={handleSendWarning} 
                                            className="w-full bg-gray-900 text-white rounded-xl h-12 text-xs font-black uppercase shadow-lg shadow-gray-200"
                                        >
                                            Issue Warning
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Admin Notes Block */}
                            <div>
                                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6">Internal Notes</h3>
                                <div className="bg-gray-50 rounded-[32px] p-8 border border-gray-100 flex flex-col gap-4">
                                    <textarea 
                                        value={adminNotes}
                                        onChange={(e) => setAdminNotes(e.target.value)}
                                        placeholder="Add private notes about this driver here... (Only visible to admins)"
                                        className="w-full h-32 bg-white border border-gray-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                    />
                                    <div className="flex justify-end">
                                        <Button 
                                            isLoading={loadingAction === 'saveNotes'} 
                                            disabled={isButtonDisabled}
                                            onClick={handleSaveNotes} 
                                            className="bg-gray-900 text-white rounded-xl px-6 py-3 text-xs font-black uppercase"
                                        >
                                            Save Notes
                                        </Button>
                                    </div>
                                </div>
                            </div>

                        </div>
                    )}
                </div>
                
            </div>
        </div>
    );
});
