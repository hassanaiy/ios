import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { AppAudioConfig, AppAudioSettings, SoundKey } from '../types';
import { AudioService, SOUND_PRESETS, DEFAULT_APP_AUDIO_SETTINGS } from '../services/audioService';
import { updateAppAudioSettings, uploadFile } from '../services/firebase';

interface AudioSettingsAdminViewProps {
  currentSettings?: AppAudioSettings;
  onSaved?: (settings: AppAudioSettings) => void;
}

export const AudioSettingsAdminView: React.FC<AudioSettingsAdminViewProps> = ({
  currentSettings,
  onSaved,
}) => {
  const { isRTL } = useLanguage();

  const [settings, setSettings] = useState<AppAudioSettings>(() => {
    return {
      ...DEFAULT_APP_AUDIO_SETTINGS,
      ...(currentSettings || {}),
      sounds: {
        ...DEFAULT_APP_AUDIO_SETTINGS.sounds,
        ...(currentSettings?.sounds || {}),
      },
    };
  });

  const [activeSoundKey, setActiveSoundKey] = useState<SoundKey>('trip_request');
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<'all' | 'driver' | 'passenger' | 'common' | 'push'>('all');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync settings if currentSettings updates from outside
  useEffect(() => {
    if (currentSettings) {
      setSettings({
        ...DEFAULT_APP_AUDIO_SETTINGS,
        ...currentSettings,
        sounds: {
          ...DEFAULT_APP_AUDIO_SETTINGS.sounds,
          ...(currentSettings.sounds || {}),
        },
      });
      AudioService.updateSettings(currentSettings);
    }
  }, [currentSettings]);

  const soundList: AppAudioConfig[] = Object.values(settings.sounds);

  const filteredSounds = soundList.filter((s) => {
    if (filterCategory === 'all') return true;
    return s.category === filterCategory;
  });

  // Handle Master Audio Toggle
  const handleToggleMasterAudio = () => {
    const nextVal = !settings.masterAudioEnabled;
    const updated = {
      ...settings,
      masterAudioEnabled: nextVal,
    };
    setSettings(updated);
    AudioService.setMasterAudioEnabled(nextVal);
  };

  // Master Volume Change
  const handleMasterVolumeChange = (vol: number) => {
    setSettings((prev) => ({
      ...prev,
      defaultVolume: vol,
    }));
  };

  // Sound Config Modification
  const updateSoundConfig = (key: SoundKey, patch: Partial<AppAudioConfig>) => {
    setSettings((prev) => {
      const existing = prev.sounds[key] || DEFAULT_APP_AUDIO_SETTINGS.sounds[key];
      const updatedSounds = {
        ...prev.sounds,
        [key]: {
          ...existing,
          ...patch,
          updatedAt: Date.now(),
        },
      };
      const updated = {
        ...prev,
        sounds: updatedSounds,
      };
      AudioService.updateSettings(updated);
      return updated;
    });
  };

  // Play / Test Sound
  const handleTestSound = async (config: AppAudioConfig) => {
    if (playingKey === config.id) {
      AudioService.stop();
      setPlayingKey(null);
      return;
    }

    setPlayingKey(config.id);
    try {
      await AudioService.previewConfig(config, settings.defaultVolume);
    } catch (err) {
      console.warn('Preview error', err);
    } finally {
      setTimeout(() => {
        setPlayingKey((curr) => (curr === config.id ? null : curr));
      }, 1200);
    }
  };

  // Test single preset
  const handleTestPreset = (presetKey: string) => {
    setPlayingKey(presetKey);
    AudioService.previewPreset(presetKey, settings.defaultVolume);
    setTimeout(() => {
      setPlayingKey((curr) => (curr === presetKey ? null : curr));
    }, 800);
  };

  // Upload Audio File
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, soundKey: SoundKey) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|ogg|m4a|aac)$/i)) {
      alert(isRTL ? 'يرجى اختيار ملف صوتي صالح (.mp3, .wav, .ogg, .m4a)' : 'Please select a valid audio file (.mp3, .wav, .ogg, .m4a)');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      alert(isRTL ? 'حجم الملف الصوتي كبير جداً (الحد الأقصى 8 ميجابايت)' : 'Audio file is too large (maximum 8MB)');
      return;
    }

    setUploadingFor(soundKey);

    try {
      // Convert file to Base64 dataUrl or upload to storage
      let audioUrl = '';
      try {
        const storagePath = `admin/audio_notifications/${soundKey}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;
        audioUrl = await uploadFile(file, storagePath);
      } catch (uploadErr) {
        console.warn('Storage upload fallback to DataURL', uploadErr);
        audioUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      updateSoundConfig(soundKey, {
        url: audioUrl,
        isCustomUploaded: true,
        uploadedFileName: file.name,
        isEnabled: true,
      });

      // Play test
      AudioService.previewConfig({
        ...settings.sounds[soundKey],
        url: audioUrl,
      });
    } catch (err) {
      console.error('Failed to read audio file', err);
      alert(isRTL ? 'فشل تحميل الملف الصوتي' : 'Failed to upload audio file');
    } finally {
      setUploadingFor(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Remove / Mute Sound
  const handleRemoveSound = (soundKey: SoundKey) => {
    updateSoundConfig(soundKey, {
      isEnabled: false,
    });
  };

  // Restore Default Tone
  const handleRestoreDefaultSound = (soundKey: SoundKey) => {
    const def = DEFAULT_APP_AUDIO_SETTINGS.sounds[soundKey];
    updateSoundConfig(soundKey, {
      ...def,
      url: def.url || '',
      isCustomUploaded: false,
      uploadedFileName: undefined,
      isEnabled: true,
    });
  };

  // Reset All to Defaults
  const handleResetAllToDefaults = () => {
    const confirmMsg = isRTL
      ? 'هل أنت متأكد من استعادة كافة إعدادات الأصوات الافتراضية للتطبيق؟'
      : 'Are you sure you want to reset all app audio notifications to factory defaults?';
    if (!window.confirm(confirmMsg)) return;

    setSettings({ ...DEFAULT_APP_AUDIO_SETTINGS });
    AudioService.updateSettings(DEFAULT_APP_AUDIO_SETTINGS);
  };

  // Save Settings to Firebase
  const handleSaveSettings = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const payload: AppAudioSettings = {
        ...settings,
        updatedAt: Date.now(),
      };
      await updateAppAudioSettings(payload);
      AudioService.updateSettings(payload);
      if (onSaved) onSaved(payload);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      console.error('Failed to save audio settings', err);
      alert(isRTL ? 'فشل حفظ إعدادات الصوت في الخادم' : 'Failed to save audio settings to server');
    } finally {
      setIsSaving(false);
    }
  };

  // Showcase All Sounds in sequence
  const handleShowcaseAllSounds = async () => {
    const keys: SoundKey[] = [
      'trip_request',
      'driver_offer',
      'trip_accepted',
      'driver_arrived',
      'trip_completed',
      'push_notification',
    ];

    for (const k of keys) {
      const cfg = settings.sounds[k];
      if (cfg && cfg.isEnabled) {
        setPlayingKey(cfg.id);
        await AudioService.previewConfig(cfg, settings.defaultVolume);
        await new Promise((r) => setTimeout(r, 900));
      }
    }
    setPlayingKey(null);
  };

  return (
    <div className="space-y-8 animate-fade-in text-gray-900" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac"
        onChange={(e) => activeSoundKey && handleFileUpload(e, activeSoundKey)}
      />

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 p-8 rounded-[36px] text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-black tracking-wider uppercase">
              <i className="fas fa-volume-up animate-pulse"></i>
              <span>{isRTL ? 'نظام التنبيهات الصوتية المتقدم' : 'App-Wide Audio Engine'}</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight">
              {isRTL ? 'إدارة أصوات وإشعارات التطبيق بالكامل' : 'Full Audio Notifications Management'}
            </h2>
            <p className="text-white/80 text-sm max-w-xl font-medium leading-relaxed">
              {isRTL
                ? 'تخصيص كامل لأصوات طلبات الرحلات، عروض السائقين، قبول الرحلة، وتنبيهات الإشعارات (Push). تغيير النغمات، رفع ملفات صوتية مخصصة، أو إيقاف أي صوت بكل سهولة.'
                : 'Fully customize trip request sounds, driver counter-offers, passenger acceptance, arrival alerts, and push notifications. Change tones, upload custom audio files, or mute sounds without breaking codes.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={handleShowcaseAllSounds}
              className="w-full sm:w-auto px-5 py-3.5 bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 text-white rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-sm"
              title="Play each sound sequentially"
            >
              <i className="fas fa-play-circle text-base text-yellow-300"></i>
              <span>{isRTL ? 'استماع لجميع الأصوات بالتتابع' : 'Listen to All Sounds'}</span>
            </button>

            <button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="w-full sm:w-auto px-7 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-sm font-black transition-all shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <i className={`fas ${isSaving ? 'fa-spinner fa-spin' : 'fa-check-circle'}`}></i>
              <span>{isSaving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : isRTL ? 'حفظ التغييرات' : 'Save Settings'}</span>
            </button>
          </div>
        </div>

        {saveSuccess && (
          <div className="mt-4 p-3 bg-emerald-500/20 border border-emerald-400/40 rounded-xl text-xs font-bold text-white flex items-center gap-2 animate-fade-in">
            <i className="fas fa-check-circle text-emerald-300"></i>
            <span>{isRTL ? 'تم حفظ وتطبيق كافة إعدادات الأصوات بنجاح على جميع مستخدمي التطبيق!' : 'Audio notifications successfully saved & synced in real-time across the app!'}</span>
          </div>
        )}
      </div>

      {/* Global Controls Card */}
      <div className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-gray-900 tracking-tight">
                {isRTL ? 'تفعيل أصوات التطبيق العامة' : 'Master App Audio Notifications'}
              </h3>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${settings.masterAudioEnabled ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                {settings.masterAudioEnabled ? (isRTL ? 'مفعل' : 'Enabled') : isRTL ? 'معطل' : 'Disabled'}
              </span>
            </div>
            <p className="text-xs text-gray-500 font-medium mt-1">
              {isRTL
                ? 'مفتاح التشغيل الرئيسي لكافة التنبيهات الصوتية للركاب والكباتن والإشعارات.'
                : 'Master switch to turn all in-app audio alerts and notification sounds on or off.'}
            </p>
          </div>

          <div className="flex items-center gap-6">
            {/* Master Toggle */}
            <button
              onClick={handleToggleMasterAudio}
              className={`w-16 h-9 rounded-full p-1 transition-colors duration-300 flex items-center ${settings.masterAudioEnabled ? 'bg-emerald-500 shadow-emerald-500/20 shadow-md' : 'bg-gray-200'}`}
            >
              <div
                className={`w-7 h-7 bg-white rounded-full shadow-md transform transition-transform duration-300 flex items-center justify-center text-[10px] ${
                  settings.masterAudioEnabled
                    ? isRTL
                      ? '-translate-x-7 text-emerald-600'
                      : 'translate-x-7 text-emerald-600'
                    : 'text-gray-400'
                }`}
              >
                <i className={`fas ${settings.masterAudioEnabled ? 'fa-volume-up' : 'fa-volume-mute'}`}></i>
              </div>
            </button>
          </div>
        </div>

        {/* Master Volume Slider & Push Sound Quick Bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Master Volume */}
          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-2">
            <div className="flex items-center justify-between text-xs font-black text-gray-700">
              <span className="flex items-center gap-2">
                <i className="fas fa-sliders-h text-blue-600"></i>
                {isRTL ? 'مستوى الصوت الافتراضي العام' : 'Master Default Volume'}
              </span>
              <span className="px-2 py-0.5 bg-white rounded-md border text-blue-600 font-mono">
                {Math.round((settings.defaultVolume ?? 1.0) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.defaultVolume ?? 1.0}
              onChange={(e) => handleMasterVolumeChange(parseFloat(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer h-2 bg-gray-200 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-gray-400 font-bold uppercase tracking-wider">
              <span>0% (Mute)</span>
              <span>50%</span>
              <span>100% (Full)</span>
            </div>
          </div>

          {/* Quick Push Notification Sound selector */}
          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-2">
            <div className="flex items-center justify-between text-xs font-black text-gray-700">
              <span className="flex items-center gap-2">
                <i className="fas fa-bell text-indigo-600"></i>
                {isRTL ? 'نغمة إشعارات الخلفية الافتراضية' : 'Default Push Alert Preset'}
              </span>
              <button
                onClick={() => handleTestPreset(settings.pushNotificationSoundName || 'crystal_harp')}
                className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md border border-indigo-200 hover:bg-indigo-100 transition-colors flex items-center gap-1 font-bold text-[10px]"
              >
                <i className="fas fa-play text-[8px]"></i>
                {isRTL ? 'اختبار' : 'Test'}
              </button>
            </div>
            <select
              value={settings.pushNotificationSoundName || 'crystal_harp'}
              onChange={(e) => {
                const val = e.target.value;
                setSettings((prev) => ({
                  ...prev,
                  pushNotificationSoundName: val,
                }));
                updateSoundConfig('push_notification', { presetKey: val });
              }}
              className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {SOUND_PRESETS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.nameEn} ({p.nameAr})
                </option>
              ))}
            </select>
            <p className="text-[10px] text-gray-400 font-medium">
              {isRTL ? 'النغمة المستخدمة لإشعارات Push وإشعارات النظام عند إغلاق التطبيق.' : 'Used for background push notifications and system alert sounds.'}
            </p>
          </div>
        </div>
      </div>

      {/* Preset Library Quick Audition Bar */}
      <div className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-black">
              <i className="fas fa-music text-xs"></i>
            </div>
            <div>
              <h3 className="text-sm font-black text-gray-900 tracking-tight">
                {isRTL ? 'مكتبة النغمات الجاهزة النقية (Zero-Overlap)' : 'Curated Distinct Sound Library'}
              </h3>
              <p className="text-[11px] text-gray-500 font-medium">
                {isRTL
                  ? 'نغمات صوتية مميزة ومفصولة بنقاء عالي لمنع تداخل الأصوات في التطبيق.'
                  : 'Acoustically distinct musical tones designed so sounds never clash or sound the same.'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {SOUND_PRESETS.map((p) => {
            const isPlayingThis = playingKey === p.key;
            return (
              <button
                key={p.key}
                onClick={() => handleTestPreset(p.key)}
                className={`p-3 rounded-2xl border text-left rtl:text-right transition-all flex flex-col justify-between h-24 ${
                  isPlayingThis
                    ? 'bg-purple-600 text-white border-purple-600 shadow-md scale-[1.02]'
                    : 'bg-gray-50 hover:bg-gray-100/80 border-gray-200/80 text-gray-800'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${isPlayingThis ? 'bg-white/20 text-white' : 'bg-gray-200/60 text-gray-500'}`}>
                    {p.tag}
                  </span>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${isPlayingThis ? 'bg-white text-purple-600' : 'bg-white text-gray-600 shadow-xs'}`}>
                    <i className={`fas ${isPlayingThis ? 'fa-volume-up animate-pulse' : 'fa-play'}`}></i>
                  </div>
                </div>
                <div>
                  <div className="font-bold text-xs truncate">{isRTL ? p.nameAr : p.nameEn}</div>
                  <div className={`text-[10px] truncate ${isPlayingThis ? 'text-white/80' : 'text-gray-400'}`}>
                    {isRTL ? p.nameEn : p.nameAr}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sound Cards & Categories Filter */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex bg-gray-100 p-1 rounded-2xl overflow-x-auto hide-scrollbar">
            {(
              [
                { id: 'all', labelEn: 'All Sounds', labelAr: 'كافة الأصوات' },
                { id: 'driver', labelEn: 'Driver Sounds 🚗', labelAr: 'أصوات الكابتن 🚗' },
                { id: 'passenger', labelEn: 'Passenger Sounds 👤', labelAr: 'أصوات الراكب 👤' },
                { id: 'common', labelEn: 'Trip Status & Chat 💬', labelAr: 'الحالات والمحادثة 💬' },
                { id: 'push', labelEn: 'Push Notifications 🔔', labelAr: 'إشعارات Push 🔔' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterCategory(tab.id)}
                className={`py-2 px-3.5 rounded-xl text-xs font-black whitespace-nowrap transition-all ${
                  filterCategory === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {isRTL ? tab.labelAr : tab.labelEn}
              </button>
            ))}
          </div>

          <button
            onClick={handleResetAllToDefaults}
            className="text-xs font-bold text-gray-500 hover:text-red-600 transition-colors flex items-center gap-1.5 self-end sm:self-center"
          >
            <i className="fas fa-undo"></i>
            <span>{isRTL ? 'استعادة الإعدادات الافتراضية للجميع' : 'Reset All to Defaults'}</span>
          </button>
        </div>

        {/* Detailed Individual Sound Cards */}
        <div className="space-y-4">
          {filteredSounds.map((config) => {
            const isPlaying = playingKey === config.id;
            const isCustom = Boolean(config.url && config.url.trim() !== '');
            const isMuted = !config.isEnabled;

            return (
              <div
                key={config.id}
                className={`p-6 bg-white rounded-3xl border transition-all ${
                  isMuted
                    ? 'border-red-100 bg-red-50/20 opacity-80'
                    : isPlaying
                    ? 'border-blue-400 shadow-md ring-2 ring-blue-100'
                    : 'border-gray-100 hover:border-gray-200 shadow-sm'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  {/* Info Header */}
                  <div className="flex items-start gap-4 flex-1">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-lg transition-transform ${
                        isMuted
                          ? 'bg-red-100 text-red-600'
                          : isPlaying
                          ? 'bg-blue-600 text-white scale-110 shadow-md'
                          : config.category === 'driver'
                          ? 'bg-amber-100 text-amber-700'
                          : config.category === 'passenger'
                          ? 'bg-emerald-100 text-emerald-700'
                          : config.category === 'push'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      <i
                        className={`fas ${
                          isMuted
                            ? 'fa-volume-mute'
                            : isPlaying
                            ? 'fa-wave-square animate-pulse'
                            : config.category === 'driver'
                            ? 'fa-taxi'
                            : config.category === 'passenger'
                            ? 'fa-user'
                            : config.category === 'push'
                            ? 'fa-bell'
                            : 'fa-check-circle'
                        }`}
                      ></i>
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-black text-gray-900 text-base">
                          {isRTL ? config.nameAr : config.nameEn}
                        </h4>
                        <span className="text-xs text-gray-400 font-bold">
                          ({isRTL ? config.nameEn : config.nameAr})
                        </span>

                        {/* Status Badges */}
                        {isMuted ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-100 text-red-700 border border-red-200">
                            {isRTL ? 'الصوت ملغي / صامت' : 'Sound Muted / Removed'}
                          </span>
                        ) : isCustom ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-100 text-purple-700 border border-purple-200">
                            <i className="fas fa-file-audio mr-1"></i>
                            {isRTL ? 'صوت مخصص مرفوع' : 'Custom Uploaded Audio'}
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-100 text-blue-700 border border-blue-200">
                            <i className="fas fa-music mr-1"></i>
                            {SOUND_PRESETS.find((p) => p.key === config.presetKey)?.nameEn || config.presetKey}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-gray-500 font-medium">
                        {isRTL ? config.descriptionAr : config.descriptionEn}
                      </p>

                      {config.uploadedFileName && (
                        <div className="text-[11px] text-purple-600 font-bold flex items-center gap-1.5 pt-1">
                          <i className="fas fa-check text-xs"></i>
                          <span>{config.uploadedFileName}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions & Player Controls */}
                  <div className="flex flex-wrap items-center gap-3 self-start lg:self-center">
                    {/* Test / Play Button */}
                    <button
                      onClick={() => handleTestSound(config)}
                      className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 shadow-sm ${
                        isPlaying
                          ? 'bg-blue-600 text-white animate-pulse shadow-blue-500/30'
                          : isMuted
                          ? 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                          : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200'
                      }`}
                      title="Play / Test Sound"
                    >
                      <i className={`fas ${isPlaying ? 'fa-stop' : 'fa-play'}`}></i>
                      <span>{isPlaying ? (isRTL ? 'إيقاف' : 'Stop') : isRTL ? 'تشغيل وتجربة' : 'Play / Test'}</span>
                    </button>

                    {/* Upload Audio Button */}
                    <button
                      onClick={() => {
                        setActiveSoundKey(config.id);
                        fileInputRef.current?.click();
                      }}
                      disabled={uploadingFor === config.id}
                      className="px-3.5 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5"
                      title="Upload MP3, WAV, OGG file"
                    >
                      <i className={`fas ${uploadingFor === config.id ? 'fa-spinner fa-spin' : 'fa-cloud-upload-alt'} text-purple-600`}></i>
                      <span>{uploadingFor === config.id ? (isRTL ? 'جاري التحميل...' : 'Uploading...') : isRTL ? 'رفع ملف صوت' : 'Upload Audio'}</span>
                    </button>

                    {/* Remove Sound / Mute Toggle Button */}
                    {isMuted ? (
                      <button
                        onClick={() => handleRestoreDefaultSound(config.id)}
                        className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5"
                      >
                        <i className="fas fa-volume-up"></i>
                        <span>{isRTL ? 'تفعيل الصوت' : 'Enable Sound'}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRemoveSound(config.id)}
                        className="px-3.5 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5"
                        title="Remove / Mute this specific sound"
                      >
                        <i className="fas fa-trash-alt"></i>
                        <span>{isRTL ? 'إزالة الصوت / كتم' : 'Remove / Mute'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Sub-controls: Preset Selector, Custom URL & Volume */}
                <div className="mt-5 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {/* Preset Selector */}
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1 block">
                      {isRTL ? 'اختيار نغمة من المكتبة' : 'Select Sound Preset'}
                    </label>
                    <select
                      value={config.presetKey || 'radar_ping'}
                      onChange={(e) => {
                        updateSoundConfig(config.id, {
                          presetKey: e.target.value,
                          url: '',
                          isCustomUploaded: false,
                          uploadedFileName: undefined,
                          isEnabled: true,
                        });
                        handleTestPreset(e.target.value);
                      }}
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {SOUND_PRESETS.map((p) => (
                        <option key={p.key} value={p.key}>
                          {p.nameEn} ({p.nameAr})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Custom URL or Direct Audio link */}
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1 block">
                      {isRTL ? 'رابط ملف صوتي مخصص (اختياري)' : 'Custom Audio URL (Optional)'}
                    </label>
                    <input
                      type="text"
                      value={config.isCustomUploaded ? (config.uploadedFileName || 'Uploaded file') : config.url || ''}
                      placeholder="https://example.com/sound.mp3"
                      disabled={Boolean(config.isCustomUploaded)}
                      onChange={(e) => {
                        updateSoundConfig(config.id, {
                          url: e.target.value,
                          isEnabled: true,
                        });
                      }}
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Volume Slider */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
                        {isRTL ? 'مستوى صوت هذا التنبيه' : 'Alert Volume'}
                      </label>
                      <span className="font-mono text-gray-700 font-bold">
                        {Math.round((config.volume ?? 1.0) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={config.volume ?? 1.0}
                      onChange={(e) => updateSoundConfig(config.id, { volume: parseFloat(e.target.value) })}
                      className="w-full accent-blue-600 cursor-pointer h-2 bg-gray-200 rounded-lg mt-2"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Save Actions */}
      <div className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="font-black text-gray-900 text-sm">
            {isRTL ? 'تطبيق التغييرات لجميع المستخدمين' : 'Apply Changes App-Wide'}
          </h4>
          <p className="text-xs text-gray-500 font-medium">
            {isRTL
              ? 'يتم تطبيق الإعدادات وحفظها في قاعدة البيانات وتحديثها فورياً على هواتف الركاب والكباتن.'
              : 'Settings will be saved to Firestore and immediately synchronized live with all drivers and passengers.'}
          </p>
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={isSaving}
          className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-black transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <i className={`fas ${isSaving ? 'fa-spinner fa-spin' : 'fa-save'}`}></i>
          <span>{isSaving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : isRTL ? 'حفظ إعدادات الأصوات' : 'Save All Audio Settings'}</span>
        </button>
      </div>
    </div>
  );
};
