import React, { useState, useEffect } from 'react';
import { User, Driver, UserRole, NotificationSettings } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '../components/ui/Button';
import { updateUserProfile } from '../services/firebase';
import { CapacitorService } from '../services/capacitorService';
import { AudioService } from '../services/audioService';
import { Capacitor } from '@capacitor/core';
import { ImpactStyle } from '@capacitor/haptics';

interface NotificationSettingsViewProps {
  user: User | Driver;
  onBack: () => void;
}

const defaultSettings: NotificationSettings = {
  notificationsEnabled: true,
  rideRequests: true,
  rideUpdates: true,
  offers: true,
  adminAlerts: true,
  soundEnabled: true,
  vibrationEnabled: true,

  enableAllSounds: true,
  enableAllVibrations: true,
  inAppSounds: true,
  pushSounds: true,
  
  // Passenger
  driverAcceptedSound: true,
  driverNearingAlert: true,
  rideCancelledAlert: true,
  passengerChatAlerts: true,
  generalAppNotifs: true,

  // Driver
  rideRequestSound: true,
  rideRequestVibration: true,
  driverChatAlerts: true,
  tripStatusAlerts: true,
  driverApproachingAlert: true,
  
  quietModeEnabled: false,
  quietHoursStart: '00:00',
  quietHoursEnd: '08:00',
};

export default function NotificationSettingsView({ user, onBack }: NotificationSettingsViewProps) {
  const { t, isRTL } = useLanguage();
  const isDriver = user.role === UserRole.DRIVER;
  const [settings, setSettings] = useState<NotificationSettings>(user.notificationSettings || defaultSettings);
  const [isSaving, setIsSaving] = useState(false);

  const toggle = (key: keyof NotificationSettings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateUserProfile(user.id, { notificationSettings: settings } as any);
      // Optional: save to local storage as fallback/quick read
      localStorage.setItem(`settings_${user.id}`, JSON.stringify(settings));
      if (Capacitor.isNativePlatform() && settings.enableAllVibrations) {
        CapacitorService.impact(ImpactStyle.Medium);
      }
      onBack();
    } catch (e) {
      if(String(e).includes('permission')) { console.log('Permission error caught:', e); } else { console.error(e); };
      alert("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const testSoundAndVibration = () => {
    if (settings.enableAllSounds && settings.inAppSounds) {
      AudioService.play(isDriver ? 'trip_request' : 'trip_accepted');
    }
    if (settings.enableAllVibrations && Capacitor.isNativePlatform()) {
      CapacitorService.impact(ImpactStyle.Heavy);
    } else if (settings.enableAllVibrations && navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
  };

  const ToggleSwitch = ({ label, desc, value, onChange, disabled = false }: any) => (
    <div className={`p-4 bg-white border border-gray-100 rounded-2xl flex items-center justify-between shadow-sm ${disabled ? 'opacity-50' : 'hover:bg-gray-50'} transition-all`}>
      <div className="flex-1 pr-4 rtl:pr-0 rtl:pl-4">
        <h4 className="font-bold text-gray-900 text-sm mb-1">{label}</h4>
        {desc && <p className="text-xs text-gray-500 font-medium leading-relaxed">{desc}</p>}
      </div>
      <div 
        onClick={() => !disabled && onChange()}
        className={`w-12 h-7 rounded-full p-1 cursor-pointer transition-colors duration-300 flex items-center shrink-0 ${value ? 'bg-green-500' : 'bg-gray-200'}`}
      >
        <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${value ? (isRTL ? '-translate-x-5' : 'translate-x-5') : ''}`}></div>
      </div>
    </div>
  );

  return (
    <div className="h-full w-full bg-[#f8f9fa] flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="p-4 pt-safe flex items-center justify-between bg-white shadow-sm z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 bg-gray-50 transition-colors">
            <i className={`fas ${isRTL ? 'fa-arrow-right' : 'fa-arrow-left'} text-sm text-gray-700`}></i>
          </button>
          <h1 className="text-lg font-black text-gray-900">{isRTL ? 'الإشعارات والأصوات' : 'Notifications & Sounds'}</h1>
        </div>
        <button 
          onClick={handleSave} 
          disabled={isSaving}
          className="text-white font-bold text-xs px-4 py-2 bg-black rounded-full hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          {isSaving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ' : 'Save')}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
        
        {/* Global Master Controls */}
        <section className="space-y-3">
          <h3 className="text-xs font-black uppercase text-gray-500 tracking-wider px-2">{isRTL ? 'التحكم العام' : 'Global Controls'}</h3>
          <ToggleSwitch 
            label={isRTL ? 'تفعيل جميع الأصوات' : 'Enable All Sounds'}
            desc={isRTL ? 'تشغيل أو إيقاف كافة أصوات التطبيق' : 'Master toggle for all app sounds'}
            value={settings.enableAllSounds}
            onChange={() => toggle('enableAllSounds')}
          />
          <ToggleSwitch 
            label={isRTL ? 'تفعيل الرجّاج' : 'Enable All Vibrations'}
            desc={isRTL ? 'التحكم باهتزاز الجهاز لجميع التنبيهات' : 'Master toggle for device vibration'}
            value={settings.enableAllVibrations}
            onChange={() => toggle('enableAllVibrations')}
          />
          
          <div className="pt-2">
            <button
              onClick={testSoundAndVibration}
              disabled={!settings.enableAllSounds && !settings.enableAllVibrations}
              className="w-full flex items-center justify-center gap-2 p-3 bg-blue-50 text-blue-600 font-bold rounded-xl border border-blue-100 hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:grayscale"
            >
              <i className="fas fa-play"></i> {isRTL ? 'اختبار الصوت والرجّاج' : 'Test Sound & Vibration'}
            </button>
          </div>
        </section>

        {/* Separated Settings */}
        <section className="space-y-3">
          <h3 className="text-xs font-black uppercase text-gray-500 tracking-wider px-2">{isRTL ? 'أنواع التنبيهات' : 'Alert Types'}</h3>
          <ToggleSwitch 
            label={isRTL ? 'أصوات داخل التطبيق' : 'In-App Sounds'}
            desc={isRTL ? 'تنبيهات أثناء استخدام التطبيق' : 'Sounds played while app is open'}
            value={settings.inAppSounds}
            onChange={() => toggle('inAppSounds')}
            disabled={!settings.enableAllSounds}
          />
          <ToggleSwitch 
            label={isRTL ? 'أصوات الإشعارات (Push)' : 'Push Notification Sounds'}
            desc={isRTL ? 'تنبيهات عند إغلاق التطبيق' : 'Sounds for background notifications'}
            value={settings.pushSounds}
            onChange={() => toggle('pushSounds')}
            disabled={!settings.enableAllSounds}
          />
        </section>

        {/* Quiet Mode */}
        <section className="space-y-3">
          <h3 className="text-xs font-black uppercase text-gray-500 tracking-wider px-2">{isRTL ? 'وضع السكون' : 'Quiet Mode'}</h3>
          <ToggleSwitch 
            label={isRTL ? 'تفعيل وضع السكون' : 'Enable Quiet Mode'}
            desc={isRTL ? 'إيقاف الأصوات تلقائياً في أوقات محددة' : 'Mute sounds during specific hours'}
            value={settings.quietModeEnabled}
            onChange={() => toggle('quietModeEnabled')}
          />
          {settings.quietModeEnabled && (
            <div className="flex items-center gap-3 p-4 bg-white border border-gray-100 rounded-2xl shadow-sm animate-fade-in-up">
              <div className="flex-1 flex flex-col">
                <label className="text-xs text-gray-500 font-bold mb-1">{isRTL ? 'من' : 'From'}</label>
                <input 
                  type="time" 
                  value={settings.quietHoursStart}
                  onChange={(e) => setSettings({...settings, quietHoursStart: e.target.value})}
                  className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm font-bold w-full"
                />
              </div>
              <div className="text-gray-300 font-bold mt-5"><i className="fas fa-arrow-right rtl:rotate-180"></i></div>
              <div className="flex-1 flex flex-col">
                <label className="text-xs text-gray-500 font-bold mb-1">{isRTL ? 'إلى' : 'To'}</label>
                <input 
                  type="time" 
                  value={settings.quietHoursEnd}
                  onChange={(e) => setSettings({...settings, quietHoursEnd: e.target.value})}
                  className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm font-bold w-full"
                />
              </div>
            </div>
          )}
        </section>

        {/* Role-Specific Controls */}
        {isDriver ? (
          <section className="space-y-3 animate-fade-in-up">
            <h3 className="text-xs font-black uppercase text-gray-500 tracking-wider px-2">{isRTL ? 'إعدادات الكابتن' : 'Driver Alerts'}</h3>
            <ToggleSwitch 
              label={isRTL ? 'صوت طلب الرحلة 🔔' : '🔔 Ride Request Sound'}
              value={settings.rideRequestSound}
              onChange={() => toggle('rideRequestSound')}
              disabled={!settings.enableAllSounds}
            />
            <ToggleSwitch 
              label={isRTL ? 'اهتزاز لطلبات الرحلة 📳' : '📳 Ride Request Vibration'}
              value={settings.rideRequestVibration}
              onChange={() => toggle('rideRequestVibration')}
              disabled={!settings.enableAllVibrations}
            />
            <ToggleSwitch 
              label={isRTL ? 'إشعارات رسائل الراكب' : 'Passenger Chat Alerts'}
              value={settings.driverChatAlerts}
              onChange={() => toggle('driverChatAlerts')}
            />
            <ToggleSwitch 
              label={isRTL ? 'تنبيهات حالة الرحلة' : 'Trip Status Alerts'}
              desc={isRTL ? '(إلغاء، بدء، أو إنهاء)' : 'Accepted, cancelled, started, completed'}
              value={settings.tripStatusAlerts}
              onChange={() => toggle('tripStatusAlerts')}
            />
            <ToggleSwitch 
              label={isRTL ? 'تنبيه الاقتراب من موقع الركوب' : 'Approaching Pickup Alert'}
              value={settings.driverApproachingAlert}
              onChange={() => toggle('driverApproachingAlert')}
            />
          </section>
        ) : (
          <section className="space-y-3 animate-fade-in-up">
            <h3 className="text-xs font-black uppercase text-gray-500 tracking-wider px-2">{isRTL ? 'إعدادات الراكب' : 'Passenger Alerts'}</h3>
            <ToggleSwitch 
              label={isRTL ? 'قبول الرحلة مـن الكابتن' : 'Driver Accepted Ride Sound'}
              value={settings.driverAcceptedSound}
              onChange={() => toggle('driverAcceptedSound')}
              disabled={!settings.enableAllSounds}
            />
            <ToggleSwitch 
              label={isRTL ? 'تنبيه الكابتن قريب مكاني 🚗' : '🚗 Driver Nearing Pickup Alert'}
              value={settings.driverNearingAlert}
              onChange={() => toggle('driverNearingAlert')}
            />
            <ToggleSwitch 
              label={isRTL ? 'إشعارات الإلغاء' : 'Ride Cancellation Alerts'}
              value={settings.rideCancelledAlert}
              onChange={() => toggle('rideCancelledAlert')}
            />
            <ToggleSwitch 
              label={isRTL ? 'تنبيهات رسائل الكابتن' : 'Driver Chat Alerts'}
              value={settings.passengerChatAlerts}
              onChange={() => toggle('passengerChatAlerts')}
            />
            <ToggleSwitch 
              label={isRTL ? 'إشعارات التطبيق العامة' : 'General App Notifications'}
              value={settings.generalAppNotifs}
              onChange={() => toggle('generalAppNotifs')}
            />
          </section>
        )}

      </div>
    </div>
  );
}
