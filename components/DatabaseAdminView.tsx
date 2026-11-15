import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../services/firebaseBridge';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  getDocFromServer
} from 'firebase/firestore';
import firebaseAppletConfig from '../firebase-applet-config.json';

interface DatabaseConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId: string;
  storageBucket: string;
  messagingSenderId: string;
  measurementId: string;
}

interface DatabaseAdminViewProps {
  isRTL?: boolean;
  compact?: boolean;
  onOpenFull?: () => void;
}

const KNOWN_COLLECTIONS = [
  { id: 'users', labelEn: 'Users & Drivers', labelAr: 'المستخدمين والكباتن', icon: 'fa-users' },
  { id: 'rides', labelEn: 'Rides & Trips', labelAr: 'الرحلات والمشاوير', icon: 'fa-route' },
  { id: 'settings', labelEn: 'App Settings', labelAr: 'إعدادات النظام', icon: 'fa-Sliders' },
  { id: 'manual_topups', labelEn: 'Wallet Top-ups', labelAr: 'طلبات شحن المحفظة', icon: 'fa-wallet' },
  { id: 'support_tickets', labelEn: 'Support Tickets', labelAr: 'تذاكر الدعم الفني', icon: 'fa-headset' },
  { id: 'reward_campaigns', labelEn: 'Reward Campaigns', labelAr: 'حملات المكافآت', icon: 'fa-gift' },
  { id: 'settlements', labelEn: 'Financial Settlements', labelAr: 'التسويات المالية', icon: 'fa-file-invoice-dollar' },
  { id: 'blacklisted_devices', labelEn: 'Blacklisted Devices', labelAr: 'الأجهزة المحظورة', icon: 'fa-ban' }
];

const INVALID_DB_ID = 'ai-studio-waslny-f4f32e33-c8e0-4c8f-9906-38a6a367b48f';

const sanitizeDbId = (id?: string | null): string => {
  if (!id || !id.trim() || id.trim() === INVALID_DB_ID) return '(default)';
  return id.trim();
};

const KNOWN_DATABASE_INSTANCES = [
  { id: '(default)', labelEn: '(default) — Primary Production Database', labelAr: '(default) — قاعدة البيانات الأساسية الافتراضية' }
];

export const DatabaseAdminView: React.FC<DatabaseAdminViewProps> = ({
  isRTL = false,
  compact = false,
  onOpenFull
}) => {
  const [config, setConfig] = useState<DatabaseConfig>({
    projectId: firebaseAppletConfig.projectId || 'waslny-7791e',
    appId: firebaseAppletConfig.appId || '',
    apiKey: firebaseAppletConfig.apiKey || '',
    authDomain: firebaseAppletConfig.authDomain || '',
    firestoreDatabaseId: sanitizeDbId(
      (typeof window !== 'undefined' && localStorage.getItem('mowasla_override_firestore_db_id')) ||
        firebaseAppletConfig.firestoreDatabaseId
    ),
    storageBucket: firebaseAppletConfig.storageBucket || '',
    messagingSenderId: firebaseAppletConfig.messagingSenderId || '',
    measurementId: firebaseAppletConfig.measurementId || ''
  });

  const [customDbIdMode, setCustomDbIdMode] = useState(false);
  const [pingStatus, setPingStatus] = useState<'idle' | 'testing' | 'online' | 'error'>('idle');
  const [pingLatencyMs, setPingLatencyMs] = useState<number | null>(null);
  const [pingErrorMsg, setPingErrorMsg] = useState<string | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Explorer state
  const [selectedCollection, setSelectedCollection] = useState<string>('users');
  const [customCollectionInput, setCustomCollectionInput] = useState<string>('');
  const [documents, setDocuments] = useState<Array<{ id: string; data: Record<string, any> }>>([]);
  const [loadingDocs, setLoadingDocs] = useState<boolean>(false);
  const [docSearchQuery, setDocSearchQuery] = useState<string>('');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [jsonEditorValue, setJsonEditorValue] = useState<string>('');
  const [jsonEditorError, setJsonEditorError] = useState<string | null>(null);
  const [isCreatingNewDoc, setIsCreatingNewDoc] = useState<boolean>(false);
  const [newDocIdInput, setNewDocIdInput] = useState<string>('');
  const [savingDoc, setSavingDoc] = useState<boolean>(false);
  const [collectionCounts, setCollectionCounts] = useState<Record<string, number>>({});

  // Fetch server config & test connection on mount
  const fetchConfigAndTest = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/database-config');
      if (res.ok) {
        const resJson = await res.json();
        const serverCfg = resJson.config || resJson;
        const localOverride = localStorage.getItem('mowasla_override_firestore_db_id');
        setConfig((prev) => ({
          ...prev,
          ...serverCfg,
          firestoreDatabaseId: sanitizeDbId(localOverride || serverCfg.firestoreDatabaseId)
        }));
      }
    } catch {
      // Ignore if offline or static
    }

    // Ping Firestore
    setPingStatus('testing');
    setPingErrorMsg(null);
    const start = performance.now();
    try {
      await getDocFromServer(doc(db, 'settings', 'app'));
      const elapsed = Math.round(performance.now() - start);
      setPingLatencyMs(elapsed);
      setPingStatus('online');
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - start);
      setPingLatencyMs(elapsed);
      setPingStatus('error');
      setPingErrorMsg(err?.message || 'Connection test failed');
    }
  }, []);

  useEffect(() => {
    fetchConfigAndTest();
  }, [fetchConfigAndTest]);

  // Load collection counts for quick overview
  const loadCollectionCounts = useCallback(async () => {
    const counts: Record<string, number> = {};
    await Promise.all(
      KNOWN_COLLECTIONS.slice(0, 6).map(async (col) => {
        try {
          const snap = await getDocs(collection(db, col.id));
          counts[col.id] = snap.size;
        } catch {
          counts[col.id] = 0;
        }
      })
    );
    setCollectionCounts(counts);
  }, []);

  useEffect(() => {
    loadCollectionCounts();
  }, [loadCollectionCounts]);

  // Load documents for selectedCollection in full mode
  const loadCollectionDocs = useCallback(
    async (colName: string) => {
      if (compact || !colName.trim()) return;
      setLoadingDocs(true);
      setStatusBanner(null);
      try {
        const snap = await getDocs(collection(db, colName.trim()));
        const list: Array<{ id: string; data: Record<string, any> }> = [];
        snap.forEach((docSnap) => {
          list.push({ id: docSnap.id, data: docSnap.data() });
        });
        setDocuments(list);
        setCollectionCounts((prev) => ({ ...prev, [colName.trim()]: list.length }));
        if (list.length > 0 && !selectedDocId) {
          setSelectedDocId(list[0].id);
          setJsonEditorValue(JSON.stringify(list[0].data, null, 2));
        } else if (list.length === 0) {
          setSelectedDocId(null);
          setJsonEditorValue('');
        }
      } catch (err: any) {
        setStatusBanner({
          type: 'error',
          message: isRTL
            ? `فشل تحميل المجموعة (${colName}): ${err?.message || ''}`
            : `Failed to load collection (${colName}): ${err?.message || ''}`
        });
      } finally {
        setLoadingDocs(false);
      }
    },
    [compact, isRTL, selectedDocId]
  );

  useEffect(() => {
    if (!compact) {
      loadCollectionDocs(selectedCollection);
    }
  }, [compact, selectedCollection, loadCollectionDocs]);

  const handleSaveDatabaseConfig = async (reloadAfter = false) => {
    setSavingConfig(true);
    setStatusBanner(null);
    try {
      const targetDbId = (config.firestoreDatabaseId || '(default)').trim();
      localStorage.setItem('mowasla_override_firestore_db_id', targetDbId);

      const response = await fetch('/api/admin/database-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firestoreDatabaseId: targetDbId,
          projectId: config.projectId.trim(),
          authDomain: config.authDomain.trim(),
          storageBucket: config.storageBucket.trim()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to write config file on server');
      }

      setStatusBanner({
        type: 'success',
        message: isRTL
          ? `تم حفظ إعدادات قاعدة البيانات بنجاح (${targetDbId}).`
          : `Database configuration saved successfully (${targetDbId}).`
      });

      if (reloadAfter) {
        setTimeout(() => {
          window.location.reload();
        }, 600);
      } else {
        await fetchConfigAndTest();
      }
    } catch (err: any) {
      setStatusBanner({
        type: 'error',
        message: isRTL
          ? `حدث خطأ أثناء حفظ إعدادات قاعدة البيانات: ${err?.message || ''}`
          : `Error saving database settings: ${err?.message || ''}`
      });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleClearLocalCache = async () => {
    try {
      localStorage.removeItem('mowasla_override_firestore_db_id');
      if (window.indexedDB && window.indexedDB.databases) {
        const dbs = await window.indexedDB.databases();
        for (const dbInfo of dbs) {
          if (dbInfo.name && dbInfo.name.includes('firestore')) {
            window.indexedDB.deleteDatabase(dbInfo.name);
          }
        }
      }
      setStatusBanner({
        type: 'info',
        message: isRTL
          ? 'تم مسح الذاكرة المؤقتة لقاعدة البيانات. جاري إعادة تحميل النظام...'
          : 'Cleared local Firestore cache. Reloading application...'
      });
      setTimeout(() => window.location.reload(), 700);
    } catch (err: any) {
      setStatusBanner({
        type: 'error',
        message: err?.message || 'Failed to clear cache'
      });
    }
  };

  const handleSelectDoc = (docItem: { id: string; data: Record<string, any> }) => {
    setIsCreatingNewDoc(false);
    setSelectedDocId(docItem.id);
    setJsonEditorValue(JSON.stringify(docItem.data, null, 2));
    setJsonEditorError(null);
  };

  const handleStartNewDoc = () => {
    setIsCreatingNewDoc(true);
    setSelectedDocId(null);
    setNewDocIdInput(`doc_${Date.now()}`);
    setJsonEditorValue('{\n  "createdAt": ' + Date.now() + '\n}');
    setJsonEditorError(null);
  };

  const handleSaveDocument = async () => {
    const targetId = isCreatingNewDoc ? newDocIdInput.trim() : selectedDocId;
    if (!targetId) {
      setJsonEditorError(isRTL ? 'يرجى إدخال معرف المستند (Document ID)' : 'Please provide a Document ID');
      return;
    }

    let parsedData: Record<string, any>;
    try {
      parsedData = JSON.parse(jsonEditorValue);
      setJsonEditorError(null);
    } catch (err: any) {
      setJsonEditorError(
        isRTL ? `خطأ في صيغة JSON: ${err.message}` : `Invalid JSON syntax: ${err.message}`
      );
      return;
    }

    setSavingDoc(true);
    try {
      await setDoc(doc(db, selectedCollection, targetId), parsedData, { merge: false });
      setStatusBanner({
        type: 'success',
        message: isRTL
          ? `تم حفظ المستند (${targetId}) في (${selectedCollection}) بنجاح.`
          : `Saved document (${targetId}) in (${selectedCollection}) successfully.`
      });
      setIsCreatingNewDoc(false);
      setSelectedDocId(targetId);
      await loadCollectionDocs(selectedCollection);
    } catch (err: any) {
      setStatusBanner({
        type: 'error',
        message: isRTL
          ? `فشل حفظ المستند: ${err?.message || ''}`
          : `Failed to save document: ${err?.message || ''}`
      });
    } finally {
      setSavingDoc(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!docId) return;
    setSavingDoc(true);
    try {
      await deleteDoc(doc(db, selectedCollection, docId));
      setStatusBanner({
        type: 'info',
        message: isRTL
          ? `تم حذف المستند (${docId}) من (${selectedCollection}).`
          : `Deleted document (${docId}) from (${selectedCollection}).`
      });
      setSelectedDocId(null);
      setJsonEditorValue('');
      await loadCollectionDocs(selectedCollection);
    } catch (err: any) {
      setStatusBanner({
        type: 'error',
        message: isRTL
          ? `فشل حذف المستند: ${err?.message || ''}`
          : `Failed to delete document: ${err?.message || ''}`
      });
    } finally {
      setSavingDoc(false);
    }
  };

  const handleExportCollectionJson = () => {
    const exportObj: Record<string, any> = {};
    documents.forEach((d) => {
      exportObj[d.id] = d.data;
    });
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedCollection}_${config.firestoreDatabaseId}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredDocs = documents.filter((d) => {
    if (!docSearchQuery.trim()) return true;
    const q = docSearchQuery.toLowerCase();
    return (
      d.id.toLowerCase().includes(q) ||
      JSON.stringify(d.data).toLowerCase().includes(q)
    );
  });

  // COMPACT MODE FOR MAIN DASHBOARD OVERVIEW
  if (compact) {
    return (
      <div className="bg-[#1E293B] border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <i className="fas fa-database text-xl"></i>
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-base font-black text-white">
                  {isRTL ? 'مركز التحكم في قاعدة البيانات (Database Control)' : 'Database Connection & Instance Control'}
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                    pingStatus === 'online'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : pingStatus === 'testing'
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      pingStatus === 'online'
                        ? 'bg-emerald-400 animate-pulse'
                        : pingStatus === 'testing'
                        ? 'bg-amber-400 animate-ping'
                        : 'bg-rose-400'
                    }`}
                  ></span>
                  {pingStatus === 'online'
                    ? isRTL
                      ? `متصل (${pingLatencyMs}ms)`
                      : `ONLINE (${pingLatencyMs}ms)`
                    : pingStatus === 'testing'
                    ? isRTL
                      ? 'جاري الفحص...'
                      : 'TESTING...'
                    : isRTL
                    ? 'خطأ في الاتصال'
                    : 'CONNECTION ISSUE'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {isRTL
                  ? 'تحكم كامل في معرف قاعدة البيانات الفعالة (Default أو الفرعية) وفحص وتعديل البيانات مباشرة في حال وجود أي مشكلة.'
                  : 'View or switch the active Firestore Database ID, inspect live latency, and edit database records directly.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={fetchConfigAndTest}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center gap-2 border border-slate-700"
            >
              <i className="fas fa-sync-alt text-amber-400"></i>
              {isRTL ? 'فحص الاتصال' : 'Test Connection'}
            </button>
            {onOpenFull && (
              <button
                onClick={onOpenFull}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20"
              >
                <i className="fas fa-sliders-h"></i>
                {isRTL ? 'فتح محرر قاعدة البيانات الكامل' : 'Open Full Database Inspector'}
              </button>
            )}
          </div>
        </div>

        {statusBanner && (
          <div
            className={`mt-4 p-3 rounded-xl text-xs font-bold flex items-center justify-between ${
              statusBanner.type === 'success'
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : statusBanner.type === 'error'
                ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                : 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
            }`}
          >
            <span>{statusBanner.message}</span>
            <button onClick={() => setStatusBanner(null)} className="text-slate-400 hover:text-white">
              <i className="fas fa-times"></i>
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
          {/* Active Database Instance Selector */}
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
              {isRTL ? 'قاعدة البيانات الفعالة (Firestore Database ID)' : 'Active Firestore Database ID'}
            </label>
            <div className="flex items-center gap-2">
              <select
                value={
                  KNOWN_DATABASE_INSTANCES.some((d) => d.id === config.firestoreDatabaseId)
                    ? config.firestoreDatabaseId
                    : '__custom__'
                }
                onChange={(e) => {
                  if (e.target.value === '__custom__') {
                    setCustomDbIdMode(true);
                  } else {
                    setCustomDbIdMode(false);
                    setConfig({ ...config, firestoreDatabaseId: e.target.value });
                  }
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-amber-400 focus:outline-none focus:border-amber-500"
              >
                {KNOWN_DATABASE_INSTANCES.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {isRTL ? inst.labelAr : inst.labelEn}
                  </option>
                ))}
                <option value="__custom__">
                  {isRTL ? 'معرف مخصص آخر...' : 'Custom Database ID...'}
                </option>
              </select>
            </div>
            {customDbIdMode && (
              <input
                type="text"
                value={config.firestoreDatabaseId}
                onChange={(e) => setConfig({ ...config, firestoreDatabaseId: e.target.value })}
                placeholder="(default)"
                className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono text-white"
              />
            )}
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => handleSaveDatabaseConfig(true)}
                disabled={savingConfig}
                className="flex-1 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-black transition-all"
              >
                {savingConfig
                  ? isRTL
                    ? 'جاري الحفظ...'
                    : 'Saving...'
                  : isRTL
                  ? 'حفظ وتطبيق فوراً'
                  : 'Apply & Reload'}
              </button>
              <button
                onClick={handleClearLocalCache}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold transition-all"
                title={isRTL ? 'مسح الكاش المحلي' : 'Clear IndexedDB Cache'}
              >
                <i className="fas fa-broom"></i>
              </button>
            </div>
          </div>

          {/* Project & Connection Metadata */}
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-bold">{isRTL ? 'معرف المشروع (Project ID):' : 'Project ID:'}</span>
                <span className="font-mono font-bold text-white bg-slate-950 px-2.5 py-0.5 rounded-lg border border-slate-800">
                  {config.projectId}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-bold">{isRTL ? 'قاعدة البيانات الحالية:' : 'Current DB ID:'}</span>
                <span className="font-mono font-black text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-lg border border-amber-500/20">
                  {config.firestoreDatabaseId}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-bold">{isRTL ? 'التخزين السحابي:' : 'Storage Bucket:'}</span>
                <span className="font-mono text-[11px] text-slate-300 truncate max-w-[170px]">
                  {config.storageBucket}
                </span>
              </div>
            </div>
            {pingErrorMsg && (
              <p className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-2.5 py-1 mt-2 truncate">
                {pingErrorMsg}
              </p>
            )}
          </div>

          {/* Live Collections Snapshot */}
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2.5">
              {isRTL ? 'إحصائيات الجداول الحية (Live Collections)' : 'Live Collections Snapshot'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {KNOWN_COLLECTIONS.slice(0, 4).map((col) => (
                <div
                  key={col.id}
                  onClick={onOpenFull}
                  className="bg-slate-950/90 border border-slate-800 hover:border-amber-500/40 rounded-xl px-3 py-2 flex items-center justify-between cursor-pointer transition-all"
                >
                  <span className="text-[11px] font-bold text-slate-300 truncate">
                    {isRTL ? col.labelAr : col.id}
                  </span>
                  <span className="text-xs font-black text-amber-400 font-mono">
                    {collectionCounts[col.id] ?? '...'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // FULL DATABASE CONTROL & INSPECTOR TAB
  return (
    <div className="space-y-6 animate-slide-up">
      {/* Status Banner */}
      {statusBanner && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-lg ${
            statusBanner.type === 'success'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              : statusBanner.type === 'error'
              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
              : 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <i
              className={`fas ${
                statusBanner.type === 'success'
                  ? 'fa-check-circle text-emerald-400'
                  : statusBanner.type === 'error'
                  ? 'fa-exclamation-triangle text-rose-400'
                  : 'fa-info-circle text-sky-400'
              } text-base`}
            ></i>
            <span>{statusBanner.message}</span>
          </div>
          <button onClick={() => setStatusBanner(null)} className="text-slate-400 hover:text-white px-2">
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      {/* Top Section: Connection Settings & Instance Control */}
      <div className="bg-[#1E293B] border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <i className="fas fa-server text-2xl"></i>
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-lg font-black text-white">
                  {isRTL ? 'إعدادات الاتصال بقاعدة البيانات والتحكم الكامل' : 'Database Connection & Configuration Control'}
                </h2>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1.5 ${
                    pingStatus === 'online'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : pingStatus === 'testing'
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      pingStatus === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                    }`}
                  ></span>
                  {pingStatus === 'online'
                    ? isRTL
                      ? `متصل بنجاح (${pingLatencyMs}ms)`
                      : `Connected (${pingLatencyMs}ms)`
                    : pingStatus === 'testing'
                    ? isRTL
                      ? 'جاري الفحص...'
                      : 'Testing...'
                    : isRTL
                    ? 'غير متصل'
                    : 'Connection Error'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {isRTL
                  ? 'يمكنك التبديل بين قاعدة البيانات الافتراضية (default) أو أي قاعدة بيانات أخرى وتعديل بيانات الاتصال مباشرة.'
                  : 'Switch between the (default) database or custom instances, verify health, and update Firebase project parameters.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={fetchConfigAndTest}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all flex items-center gap-2 border border-slate-700"
            >
              <i className="fas fa-heartbeat text-emerald-400"></i>
              {isRTL ? 'فحص سرعة الاتصال' : 'Ping Database'}
            </button>
            <button
              onClick={handleClearLocalCache}
              className="px-4 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all flex items-center gap-2"
            >
              <i className="fas fa-broom"></i>
              {isRTL ? 'مسح الكاش وإعادة التشغيل' : 'Reset Cache & Reload'}
            </button>
          </div>
        </div>

        {/* Editable Connection Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div>
            <label className="block text-[11px] font-black text-slate-400 uppercase mb-2">
              {isRTL ? 'معرف قاعدة البيانات (Firestore Database ID)' : 'Firestore Database ID'}
            </label>
            <select
              value={
                KNOWN_DATABASE_INSTANCES.some((d) => d.id === config.firestoreDatabaseId)
                  ? config.firestoreDatabaseId
                  : '__custom__'
              }
              onChange={(e) => {
                if (e.target.value === '__custom__') {
                  setCustomDbIdMode(true);
                } else {
                  setCustomDbIdMode(false);
                  setConfig({ ...config, firestoreDatabaseId: e.target.value });
                }
              }}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-amber-400 focus:outline-none focus:border-amber-500"
            >
              {KNOWN_DATABASE_INSTANCES.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {isRTL ? inst.labelAr : inst.labelEn}
                </option>
              ))}
              <option value="__custom__">{isRTL ? 'إدخال معرف مخصص...' : 'Custom Database ID...'}</option>
            </select>
            {customDbIdMode && (
              <input
                type="text"
                value={config.firestoreDatabaseId}
                onChange={(e) => setConfig({ ...config, firestoreDatabaseId: e.target.value })}
                placeholder="(default)"
                className="mt-2 w-full bg-slate-950 border border-amber-500/50 rounded-xl px-3.5 py-2 text-xs font-mono text-white"
              />
            )}
          </div>

          <div>
            <label className="block text-[11px] font-black text-slate-400 uppercase mb-2">
              {isRTL ? 'معرف مشروع Firebase (Project ID)' : 'Firebase Project ID'}
            </label>
            <input
              type="text"
              value={config.projectId}
              onChange={(e) => setConfig({ ...config, projectId: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-black text-slate-400 uppercase mb-2">
              {isRTL ? 'نطاق المصادقة (Auth Domain)' : 'Auth Domain'}
            </label>
            <input
              type="text"
              value={config.authDomain}
              onChange={(e) => setConfig({ ...config, authDomain: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-black text-slate-400 uppercase mb-2">
              {isRTL ? 'حاوية التخزين (Storage Bucket)' : 'Storage Bucket'}
            </label>
            <input
              type="text"
              value={config.storageBucket}
              onChange={(e) => setConfig({ ...config, storageBucket: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <i className="fas fa-shield-alt text-amber-400"></i>
            <span>
              {isRTL
                ? 'يتم حفظ الإعدادات مباشرة في ملف النظام الرئيسي (firebase-applet-config.json) وفي المتصفح.'
                : 'Changes persist directly to firebase-applet-config.json and active client session.'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleSaveDatabaseConfig(false)}
              disabled={savingConfig}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all border border-slate-700"
            >
              {isRTL ? 'حفظ بدون إعادة تشغيل' : 'Save Config Only'}
            </button>
            <button
              onClick={() => handleSaveDatabaseConfig(true)}
              disabled={savingConfig}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2"
            >
              <i className="fas fa-check-double"></i>
              {isRTL ? 'حفظ وتطبيق وإعادة تحميل النظام' : 'Save, Apply & Reload App'}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Section: Full Collection & Document CRUD Explorer */}
      <div className="bg-[#1E293B] border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2.5">
              <i className="fas fa-table text-amber-400"></i>
              {isRTL
                ? 'مستكشف ومحرر سجلات قاعدة البيانات المباشر (Live Data Explorer & Editor)'
                : 'Live Database Collections & Document Editor'}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {isRTL
                ? 'تصفح جميع الجداول، ابحث عن أي سجل، وقم بتعديل أو إضافة أو حذف أي بيانات لحل أي مشكلة فوراً.'
                : 'Inspect collections, search records, and modify or repair any document JSON directly.'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => loadCollectionDocs(selectedCollection)}
              disabled={loadingDocs}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 border border-slate-700"
            >
              <i className={`fas fa-sync-alt ${loadingDocs ? 'animate-spin text-amber-400' : ''}`}></i>
              {isRTL ? 'تحديث البيانات' : 'Refresh Collection'}
            </button>
            <button
              onClick={handleStartNewDoc}
              className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-black flex items-center gap-2"
            >
              <i className="fas fa-plus"></i>
              {isRTL ? 'إضافة سجل جديد' : 'New Document'}
            </button>
            <button
              onClick={handleExportCollectionJson}
              disabled={documents.length === 0}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-2 border border-slate-700 disabled:opacity-40"
            >
              <i className="fas fa-download text-amber-400"></i>
              {isRTL ? 'تصدير JSON' : 'Export JSON'}
            </button>
          </div>
        </div>

        {/* Collection Pills + Custom Collection Input */}
        <div className="flex items-center gap-2 overflow-x-auto py-4 no-scrollbar border-b border-slate-800/70">
          {KNOWN_COLLECTIONS.map((col) => {
            const active = selectedCollection === col.id;
            return (
              <button
                key={col.id}
                onClick={() => {
                  setSelectedCollection(col.id);
                  setSelectedDocId(null);
                  setIsCreatingNewDoc(false);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-2 ${
                  active
                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                <span>{isRTL ? col.labelAr : col.labelEn}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
                    active ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-amber-400'
                  }`}
                >
                  {collectionCounts[col.id] ?? '...'}
                </span>
              </button>
            );
          })}

          <div className="flex items-center gap-1.5 min-w-[210px] ms-2">
            <input
              type="text"
              value={customCollectionInput}
              onChange={(e) => setCustomCollectionInput(e.target.value)}
              placeholder={isRTL ? 'اسم جدول مخصص...' : 'Custom collection...'}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono w-full"
            />
            <button
              onClick={() => {
                if (customCollectionInput.trim()) {
                  setSelectedCollection(customCollectionInput.trim());
                  setSelectedDocId(null);
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold"
            >
              {isRTL ? 'فتح' : 'Go'}
            </button>
          </div>
        </div>

        {/* Two-Column Explorer: Document List & JSON Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-5">
          {/* Left Column: Document List */}
          <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col h-[520px]">
            <div className="mb-3">
              <div className="relative">
                <i className="fas fa-search absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                <input
                  type="text"
                  value={docSearchQuery}
                  onChange={(e) => setDocSearchQuery(e.target.value)}
                  placeholder={
                    isRTL
                      ? `بحث في (${selectedCollection}) بالمعرف أو الاسم أو الهاتف...`
                      : `Search in (${selectedCollection}) by ID, phone, name...`
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl ps-9 pe-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 px-1">
                <span>
                  {isRTL ? 'الجدول الحالي:' : 'Collection:'}{' '}
                  <strong className="text-amber-400 font-mono">{selectedCollection}</strong>
                </span>
                <span>
                  {filteredDocs.length} / {documents.length} {isRTL ? 'سجل' : 'docs'}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pe-1">
              {loadingDocs ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                  <i className="fas fa-circle-notch animate-spin text-2xl text-amber-400"></i>
                  <span className="text-xs font-bold">
                    {isRTL ? 'جاري قراءة السجلات من قاعدة البيانات...' : 'Loading documents from Firestore...'}
                  </span>
                </div>
              ) : filteredDocs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2 text-center p-4">
                  <i className="fas fa-folder-open text-2xl"></i>
                  <span className="text-xs font-bold">
                    {isRTL ? 'لا توجد سجلات مطابقة في هذا الجدول' : 'No matching documents found in this collection'}
                  </span>
                </div>
              ) : (
                filteredDocs.map((docItem) => {
                  const isSelected = !isCreatingNewDoc && selectedDocId === docItem.id;
                  const titlePreview =
                    docItem.data.name ||
                    docItem.data.phone ||
                    docItem.data.email ||
                    docItem.data.status ||
                    docItem.data.role ||
                    '';
                  return (
                    <div
                      key={docItem.id}
                      onClick={() => handleSelectDoc(docItem)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-500/50 text-white'
                          : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-xs font-black truncate text-amber-400">
                          {docItem.id}
                        </div>
                        {titlePreview && (
                          <div className="text-[11px] text-slate-400 truncate mt-0.5">
                            {String(titlePreview)}
                            {docItem.data.role ? ` • ${docItem.data.role}` : ''}
                            {docItem.data.verificationStatus ? ` • ${docItem.data.verificationStatus}` : ''}
                          </div>
                        )}
                      </div>
                      <i className="fas fa-chevron-right text-[10px] text-slate-500"></i>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Document JSON Editor */}
          <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col h-[520px]">
            {!selectedDocId && !isCreatingNewDoc ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-3">
                <i className="fas fa-file-code text-3xl text-slate-600"></i>
                <p className="text-xs font-bold">
                  {isRTL
                    ? 'اختر سجلاً من القائمة لعرض وتعديل بياناته أو اضغط "إضافة سجل جديد"'
                    : 'Select a document on the left to inspect and edit its data, or click "New Document"'}
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                    <span className="text-xs font-bold text-slate-400">
                      {isCreatingNewDoc ? (isRTL ? 'معرف السجل الجديد:' : 'New Doc ID:') : 'Doc ID:'}
                    </span>
                    {isCreatingNewDoc ? (
                      <input
                        type="text"
                        value={newDocIdInput}
                        onChange={(e) => setNewDocIdInput(e.target.value)}
                        className="bg-slate-950 border border-amber-500/50 rounded-lg px-2.5 py-1 text-xs font-mono text-white flex-1"
                        placeholder="Document ID"
                      />
                    ) : (
                      <span className="font-mono text-xs font-black text-amber-400 bg-slate-950 px-3 py-1 rounded-lg border border-slate-800 truncate">
                        {selectedDocId}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {!isCreatingNewDoc && selectedDocId && (
                      <button
                        onClick={() => handleDeleteDocument(selectedDocId)}
                        disabled={savingDoc}
                        className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5"
                      >
                        <i className="fas fa-trash-alt"></i>
                        {isRTL ? 'حذف السجل' : 'Delete'}
                      </button>
                    )}
                    <button
                      onClick={handleSaveDocument}
                      disabled={savingDoc}
                      className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
                    >
                      <i className="fas fa-save"></i>
                      {savingDoc
                        ? isRTL
                          ? 'جاري الحفظ...'
                          : 'Saving...'
                        : isRTL
                        ? 'حفظ التعديلات في قاعدة البيانات'
                        : 'Save Changes to DB'}
                    </button>
                  </div>
                </div>

                {jsonEditorError && (
                  <div className="mt-2 p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-mono">
                    {jsonEditorError}
                  </div>
                )}

                <textarea
                  value={jsonEditorValue}
                  onChange={(e) => {
                    setJsonEditorValue(e.target.value);
                    setJsonEditorError(null);
                  }}
                  dir="ltr"
                  spellCheck={false}
                  className="mt-3 flex-1 w-full bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-emerald-300 focus:outline-none focus:border-amber-500 resize-none leading-relaxed"
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
