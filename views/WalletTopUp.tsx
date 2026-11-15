
import React, { useState, useEffect, useRef } from 'react';
import { User, Driver, ManualTopup, ManualTopupStatus } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '../components/ui/Button';
import { 
    db, 
    addDemoBalance, 
    createManualTopupRequest, 
    subscribeToUserManualTopups, 
    submitManualTopupProof,
    uploadFile
} from '../services/firebaseBridge';
import { doc, onSnapshot } from 'firebase/firestore';
import { createTopupIntent, subscribeToTopup } from '../services/walletTopupService';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';

interface WalletTopUpProps {
  user: User | Driver;
  onBack: () => void;
}

const TOPUP_AMOUNTS = [50, 100, 200, 500];

export default function WalletTopUp({ user, onBack }: WalletTopUpProps) {
  const { t, isRTL } = useLanguage();
  
  // View Management
  const [viewMode, setViewMode] = useState<'select_method' | 'opay' | 'fawry_amount' | 'fawry_instructions'>('select_method');

  // OPay State
  const [opayAmount, setOpayAmount] = useState('');
  const [isOpayLoading, setIsOpayLoading] = useState(false);
  const [pendingOpayId, setPendingOpayId] = useState<string | null>(null);
  const [isWaitingForWebhook, setIsWaitingForWebhook] = useState(false);
  const [isTimeoutReached, setIsTimeoutReached] = useState(false);
  
  // Manual Top-up State
  const [manualTopups, setManualTopups] = useState<ManualTopup[]>([]);
  const [activeManualTopup, setActiveManualTopup] = useState<ManualTopup | null>(null);
  const [isManualLoading, setIsManualLoading] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  // General State
  const [showSuccess, setShowSuccess] = useState(false);
  const [currentBalance, setCurrentBalance] = useState(user.walletBalance || 0);
  
  const timeoutRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Real-time Balance & Manual Topups Listener
  useEffect(() => {
    const unsubUser = onSnapshot(doc(db, 'users', user.id), (snap) => {
      if (snap.exists()) setCurrentBalance(snap.data().walletBalance || 0);
    }, (error) => { console.warn("User listener error", error); });
    const unsubManual = subscribeToUserManualTopups(user.id, setManualTopups);
    return () => { unsubUser(); unsubManual(); };
  }, [user.id]);

  useEffect(() => {
    if (pendingOpayId) {
      setIsTimeoutReached(false);
      timeoutRef.current = setTimeout(() => {
        setIsTimeoutReached(true);
        setIsWaitingForWebhook(false);
        setIsOpayLoading(false);
      }, 600000); // 10 minutes
    }
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [pendingOpayId]);

  useEffect(() => {
    if (!pendingOpayId) return;
    const unsub = subscribeToTopup(pendingOpayId, (topup) => {
      if (topup?.status === 'paid') {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setShowSuccess(true); setPendingOpayId(null); setIsWaitingForWebhook(false); setIsOpayLoading(false); setOpayAmount('');
      } else if (topup?.status === 'failed') {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        alert(t('payment_init_error')); setPendingOpayId(null); setIsWaitingForWebhook(false); setIsOpayLoading(false);
      }
    });
    return () => unsub();
  }, [pendingOpayId, t]);

  const handleOpayCharge = async () => {
    if (!opayAmount || Number(opayAmount) < 10) {
      alert(t('min_amount_error')); return;
    }
    setIsOpayLoading(true);
    setIsTimeoutReached(false);
    try {
      const { topupId, cashierUrl } = await createTopupIntent(Number(opayAmount));
      setPendingOpayId(topupId);
      setIsWaitingForWebhook(true);
      setTimeout(async () => {
        if (Capacitor.isNativePlatform()) {
          await Browser.open({ url: cashierUrl, presentationStyle: 'fullscreen' });
        } else {
          window.open(cashierUrl, "_blank");
        }
      }, 500);
    } catch (error) {
      console.error("Payment Intent Failed:", error);
      alert(t('payment_init_error'));
      setIsOpayLoading(false); setIsWaitingForWebhook(false);
    }
  };

  const handleCreateManualRequest = async (amount: number) => {
    setIsManualLoading(true);
    try {
        const newRequest = await createManualTopupRequest(user.id, user.name, amount);
        setActiveManualTopup(newRequest);
        setViewMode('fawry_instructions');
    } catch (e) {
        console.error("Failed to create manual request", e);
        alert("Error creating request.");
    } finally {
        setIsManualLoading(false);
    }
  };

  const handleManualSubmit = async () => {
      if (!activeManualTopup) return;
      setIsManualLoading(true);
      try {
          await submitManualTopupProof(activeManualTopup.id, user.id, receiptFile);
          alert(t('request_submitted'));
          setViewMode('select_method');
          setActiveManualTopup(null);
          setReceiptFile(null);
      } catch (e) {
          console.error("Failed to submit proof", e);
          alert("Error submitting proof.");
      } finally {
          setIsManualLoading(false);
      }
  };

  const handleCopy = (text: string) => {
      navigator.clipboard.writeText(text);
      alert(t('code_copied'));
  };

  const resetOpayRetry = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setPendingOpayId(null); setIsWaitingForWebhook(false); setIsOpayLoading(false);
  };

  const getStatusChip = (status: ManualTopupStatus) => {
      switch(status) {
          case ManualTopupStatus.PENDING: return <div className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{t('status_pending')}</div>;
          case ManualTopupStatus.AWAITING_CONFIRMATION: return <div className="text-[10px] font-bold text-yellow-600 bg-yellow-100 px-2 py-1 rounded-full animate-pulse">{t('status_awaiting_confirmation')}</div>;
          case ManualTopupStatus.PAID: return <div className="text-[10px] font-bold text-green-600 bg-green-100 px-2 py-1 rounded-full">{t('status_paid')}</div>;
          case ManualTopupStatus.REJECTED: return <div className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-1 rounded-full">{t('status_rejected')}</div>;
      }
  };

  return (
    <div className="h-full w-full bg-white flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="p-4 pt-safe flex items-center gap-4 z-10 shrink-0">
        <button onClick={() => viewMode === 'select_method' ? onBack() : setViewMode('select_method')} className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-gray-100 bg-white shadow-sm border border-gray-100">
          <i className={`fas ${isRTL ? 'fa-arrow-right' : 'fa-arrow-left'} text-lg`}></i>
        </button>
        <h1 className="text-xl font-bold">{t('wallet_topup')}</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-md mx-auto space-y-8">
            <div className="bg-gray-900 text-white rounded-[35px] p-8 shadow-2xl shadow-gray-200 relative overflow-hidden">
                <div className="relative z-10">
                    <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-2">{t('current_balance')}</p>
                    <h2 className="text-5xl font-black tracking-tight">{currentBalance.toLocaleString(undefined, {maximumFractionDigits: 2})} <span className="text-xl font-medium">{t('currency')}</span></h2>
                </div>
                <div className="absolute top-10 right-10 opacity-10 text-6xl"><i className="fas fa-wallet"></i></div>
            </div>

            {viewMode === 'select_method' && (
                <div className="space-y-4 animate-fade-in">
                    <MethodButton 
                        icon="fa-credit-card" 
                        label={t('topup_online')} 
                        subLabel="OPay, Visa, Mastercard" 
                        brandIcons={[
                            'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSpETVC08QEU7IFLEVpLsSjbmOEWZ6qIyFvfw&s',
                            'https://upload.wikimedia.org/wikipedia/commons/d/d6/Visa_2021.svg',
                            'https://upload.wikimedia.org/wikipedia/commons/a/a4/Mastercard_2019_logo.svg'
                        ]}
                        onClick={() => setViewMode('opay')} 
                    />
                    <MethodButton 
                        icon="fa-store" 
                        label={t('topup_with_code')} 
                        subLabel="Fawry, Aman, Masary" 
                        brandIcons={[
                            'https://www.eaefund.org/2020-Website/wp-content/uploads/2020/02/fawry.jpg',
                            'https://media.licdn.com/dms/image/v2/C560BAQHKXoh_cmE3Fg/company-logo_200_200/company-logo_200_200/0/1661425665852/liveaman_logo?e=2147483647&v=beta&t=a78qxnRFo1wwdIDDgDf12BzaY2t3qw1JMcRd7rzhqws',
                            'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSyFH2-lV3J-8I4yenlGo0hPSwZBzhDJ1rLPQ&s'
                        ]}
                        onClick={() => setViewMode('fawry_amount')} 
                    />
                    
                    {manualTopups.length > 0 && (
                        <div className="pt-6">
                            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 px-2">{t('your_requests')}</h3>
                            <div className="space-y-3">
                                {manualTopups.map(req => (
                                    <div key={req.id} className="bg-gray-50 p-4 rounded-2xl flex justify-between items-center border border-gray-100">
                                        <div>
                                            <div className="font-black text-lg text-gray-800">{req.amount} {t('currency')}</div>
                                            <div className="text-[10px] font-mono text-gray-400">{req.referenceCode}</div>
                                        </div>
                                        {getStatusChip(req.status)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            {viewMode === 'opay' && (
              !isWaitingForWebhook ? (
                <div className="space-y-4 animate-fade-in">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-tighter ml-1 rtl:mr-1">{t('enter_amount')}</label>
                  <div className="relative group">
                    <input type="number" placeholder="0.00" value={opayAmount} onChange={(e) => setOpayAmount(e.target.value)} className="w-full p-6 bg-gray-50 border-2 border-transparent rounded-[30px] text-4xl font-black outline-none focus:bg-white focus:border-[#FFC90E] transition-all" autoFocus />
                    <span className={`absolute ${isRTL ? 'left-8' : 'right-8'} top-1/2 -translate-y-1/2 text-xl font-bold text-gray-400`}>{t('currency')}</span>
                  </div>
                  <div className="flex gap-3 overflow-x-auto py-2 hide-scrollbar">{TOPUP_AMOUNTS.map(val => <button key={val} type="button" onClick={() => setOpayAmount(val.toString())} className="px-6 py-3 bg-gray-100 rounded-full font-bold text-sm hover:bg-gray-200 transition-all whitespace-nowrap">+ {val}</button>)}</div>
                  <div className="pt-4"><Button onClick={handleOpayCharge} isLoading={isOpayLoading} className="w-full h-16 rounded-[30px] text-xl font-black shadow-xl shadow-yellow-200">{isOpayLoading ? t('redirecting_opay') : t('charge_now')}</Button></div>
                </div>
              ) : (
                <div className="bg-yellow-50 p-8 rounded-[40px] border-2 border-dashed border-yellow-200 text-center space-y-4 animate-pulse">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto text-yellow-500 shadow-sm"><i className="fas fa-spinner fa-spin text-2xl"></i></div>
                  <div><h3 className="font-black text-gray-800">{isRTL ? 'بانتظار تأكيد الدفع...' : 'Waiting for payment...'}</h3><p className="text-xs text-gray-500 font-medium">{isRTL ? 'أكمل العملية في صفحة الدفع.' : 'Complete process in payment page.'}</p></div>
                  {isTimeoutReached && <button onClick={resetOpayRetry} className="text-blue-600 font-black text-xs uppercase tracking-widest underline pt-2">{t('try_again')}</button>}
                </div>
              )
            )}

            {viewMode === 'fawry_amount' && (
                <div className="animate-fade-in space-y-6">
                    <h3 className="text-center font-bold text-gray-800">{t('select_topup_amount')}</h3>
                    <div className="grid grid-cols-2 gap-4">
                        {TOPUP_AMOUNTS.map(amount => (
                            <button key={amount} onClick={() => handleCreateManualRequest(amount)} disabled={isManualLoading} className="p-8 bg-gray-50 rounded-2xl border border-gray-100 text-center font-black text-2xl text-gray-800 hover:bg-gray-100 hover:border-gray-900 transition-all">
                                {amount} <span className="text-sm font-bold text-gray-400">{t('currency')}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {viewMode === 'fawry_instructions' && activeManualTopup && (
                <div className="animate-fade-in space-y-6">
                    <div className="text-center"><h3 className="font-black text-xl text-gray-800">{t('topup_instructions_title')}</h3></div>
                    <div className="bg-blue-50 p-6 rounded-3xl border-2 border-dashed border-blue-200 space-y-4">
                        <div className="text-center">
                            <div className="text-xs font-bold text-blue-500 uppercase">{t('reference_code')}</div>
                            <div className="text-2xl font-mono font-black text-blue-900 tracking-widest my-2 select-all">{activeManualTopup.referenceCode}</div>
                            <button onClick={() => handleCopy(activeManualTopup.referenceCode)} className="bg-blue-500 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg"><i className="fas fa-copy mr-2"></i>{t('copy_code')}</button>
                        </div>
                        <p className="text-sm text-blue-800/80 font-medium text-center">{t('topup_instructions_body')}</p>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-2xl">
                        <div className="text-xs font-bold text-gray-400 uppercase">{t('amount')}</div>
                        <div className="text-2xl font-black text-gray-800">{activeManualTopup.amount} {t('currency')}</div>
                    </div>
                    <div className="space-y-4 pt-4">
                        <button onClick={() => fileInputRef.current?.click()} className="w-full h-14 bg-gray-100 text-gray-800 rounded-2xl font-bold border border-gray-200 flex items-center justify-center gap-2">
                            <i className="fas fa-receipt"></i> {receiptFile ? receiptFile.name : t('upload_receipt')}
                        </button>
                        <input type="file" ref={fileInputRef} onChange={e => setReceiptFile(e.target.files ? e.target.files[0] : null)} className="hidden" accept="image/*" />
                        <Button onClick={handleManualSubmit} isLoading={isManualLoading} className="w-full h-16 text-lg rounded-2xl">{t('i_have_paid')}</Button>
                    </div>
                </div>
            )}
        </div>
      </div>

      {showSuccess && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-8 text-center relative overflow-hidden">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-500 text-5xl"><i className="fas fa-check"></i></div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">{t('payment_success')}</h3>
            <p className="text-slate-500 mb-8">{t('payment_success_desc')}</p>
            <button onClick={() => setShowSuccess(false)} className="w-full py-4 bg-[#FFC90E] text-black rounded-2xl font-bold text-lg">{t('close')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

const MethodButton = ({ icon, label, subLabel, brandIcons, onClick }: { icon: string, label: string, subLabel?: string, brandIcons?: string[], onClick: () => void }) => (
    <button onClick={onClick} className="w-full p-5 bg-white rounded-[24px] border border-gray-100 flex items-center justify-between shadow-sm hover:shadow-md transition-all active:scale-[0.98] group relative overflow-hidden">
        <div className="flex items-center gap-5 relative z-10">
            <div className="w-14 h-14 bg-gray-50 text-blue-600 rounded-2xl flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-transform border border-gray-100">
                <i className={`fas ${icon}`}></i>
            </div>
            <div className="text-left rtl:text-right">
                <div className="font-black text-lg text-gray-900 mb-1.5 leading-none">{label}</div>
                
                {brandIcons && brandIcons.length > 0 ? (
                    <div className="flex items-center gap-2 mt-1.5">
                        {brandIcons.map((url, i) => (
                            <div key={i} className="h-6 px-1.5 bg-white border border-gray-100 rounded-md flex items-center justify-center shadow-sm">
                                <img src={url} className="h-3.5 w-auto object-contain mix-blend-multiply" alt="brand" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-xs font-bold text-gray-400">{subLabel}</div>
                )}
            </div>
        </div>
        <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-[#FFC90E] group-hover:text-black transition-colors relative z-10">
            <i className="fas fa-chevron-right text-sm rtl:rotate-180"></i>
        </div>
        
        {/* Background Decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50 rounded-full -mr-16 -mt-16 opacity-50 group-hover:scale-150 transition-transform duration-500"></div>
    </button>
);
