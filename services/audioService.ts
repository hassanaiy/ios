import { Capacitor } from '@capacitor/core';
import { NativeAudio } from '@capacitor-community/native-audio';
import { AppAudioConfig, AppAudioSettings, SoundKey } from '../types';

const isBrowser = typeof window !== 'undefined';
const isNative = Capacitor.isNativePlatform();

// Preset sound definitions with human-friendly descriptions
export interface SoundPresetDefinition {
  key: string;
  nameEn: string;
  nameAr: string;
  category: 'driver' | 'passenger' | 'common' | 'push';
  tag: string;
}

export const SOUND_PRESETS: SoundPresetDefinition[] = [
  { key: 'radar_ping', nameEn: 'Radar Pulse (Double Ping)', nameAr: 'رادار نبضات مزدوجة (منبه)', category: 'driver', tag: 'Fast & Urgent' },
  { key: 'marimba_chime', nameEn: 'Warm Marimba (Chime)', nameAr: 'رنين ماريمبا دافئ', category: 'passenger', tag: 'Melodic' },
  { key: 'fanfare_chord', nameEn: 'Harmonic Fanfare (Accepted)', nameAr: 'كورد احتفالي متناغم (قبول)', category: 'common', tag: 'Celebratory' },
  { key: 'car_horn_friendly', nameEn: 'Friendly Car Chime (Arrival)', nameAr: 'تنبيه وصول لطيف (سيارة)', category: 'passenger', tag: 'Attention' },
  { key: 'triumph_success', nameEn: 'Victory Ascent (Trip Done)', nameAr: 'نغمة إنجاز متصاعدة (اكتمال)', category: 'common', tag: 'Cheerful' },
  { key: 'gentle_drop', nameEn: 'Soft Two-Tone (Cancelled)', nameAr: 'نغمة هادئة (إلغاء)', category: 'common', tag: 'Muted' },
  { key: 'bubble_pop', nameEn: 'Bubble Pop (Chat Message)', nameAr: 'فقاعة ناعمة (رسالة محادثة)', category: 'common', tag: 'Crisp' },
  { key: 'crystal_harp', nameEn: 'Arabian Mystery Harp', nameAr: 'قيثارة عربية أصلية', category: 'push', tag: 'Acoustic' },
  { key: 'bell_ding', nameEn: 'Crystal Bell Ding', nameAr: 'جرس نقي وواضح', category: 'common', tag: 'Bright' },
  { key: 'tech_blip', nameEn: 'Digital Modern Ping', nameAr: 'نبضة رقمية حديثة', category: 'driver', tag: 'Modern' },
];

export const DEFAULT_APP_AUDIO_SETTINGS: AppAudioSettings = {
  masterAudioEnabled: true,
  defaultVolume: 1.0,
  pushNotificationSoundName: 'crystal_harp',
  sounds: {
    trip_request: {
      id: 'trip_request',
      nameEn: 'Driver Trip Request Alert',
      nameAr: 'تنبيه طلب رحلة جديد للكابتن',
      category: 'driver',
      descriptionEn: 'Distinct pulse tone played when a driver receives a new trip request alert.',
      descriptionAr: 'نغمة واضحة ومنبهة تعمل عند وصول طلب رحلة جديد للكابتن.',
      url: '',
      presetKey: 'radar_ping',
      isEnabled: true,
      volume: 1.0,
    },
    driver_offer: {
      id: 'driver_offer',
      nameEn: 'Driver Request / Offer Alert',
      nameAr: 'تنبيه عرض أو تفاوض من كابتن للراكب',
      category: 'passenger',
      descriptionEn: 'Pleasant warm chime when a passenger receives a price offer or counter-offer from a driver.',
      descriptionAr: 'نغمة مميزة ولطيفة عند استلام الراكب عرض سعر أو تفاوض من كابتن.',
      url: '',
      presetKey: 'marimba_chime',
      isEnabled: true,
      volume: 1.0,
    },
    trip_accepted: {
      id: 'trip_accepted',
      nameEn: 'Passenger Trip Accepted Audio',
      nameAr: 'نغمة قبول الرحلة للراكب والكابتن',
      category: 'common',
      descriptionEn: 'Celebratory melodic chord when a trip is accepted and driver starts moving.',
      descriptionAr: 'نغمة مبهجة تؤكد قبول الرحلة وبدء توجه الكابتن نحو الراكب.',
      url: '',
      presetKey: 'fanfare_chord',
      isEnabled: true,
      volume: 1.0,
    },
    driver_arrived: {
      id: 'driver_arrived',
      nameEn: 'Driver Arrived at Pickup Alert',
      nameAr: 'تنبيه وصول الكابتن لمكان الركوب',
      category: 'passenger',
      descriptionEn: 'Gentle two-tone car alert notifying passenger that the car is outside.',
      descriptionAr: 'نغمة تنبيه لطيفة للراكب تفيد بأن الكابتن وصل بالسيارة أمام الموقع.',
      url: '',
      presetKey: 'car_horn_friendly',
      isEnabled: true,
      volume: 1.0,
    },
    trip_completed: {
      id: 'trip_completed',
      nameEn: 'Trip Completed / Success Audio',
      nameAr: 'نغمة اكتمال الرحلة والنجاح',
      category: 'common',
      descriptionEn: 'Upbeat victory chime played upon successful ride completion.',
      descriptionAr: 'نغمة ختامية سعيدة عند إتمام الرحلة وتأكيد الدفع بنجاح.',
      url: '',
      presetKey: 'triumph_success',
      isEnabled: true,
      volume: 1.0,
    },
    trip_cancelled: {
      id: 'trip_cancelled',
      nameEn: 'Trip Cancelled Audio',
      nameAr: 'نغمة إلغاء الرحلة',
      category: 'common',
      descriptionEn: 'Soft descending tone when a trip or counter-offer is cancelled.',
      descriptionAr: 'نغمة هادئة تنبه بإلغاء الرحلة دون إزعاج أو رنين متكرر.',
      url: '',
      presetKey: 'gentle_drop',
      isEnabled: true,
      volume: 0.85,
    },
    chat_message: {
      id: 'chat_message',
      nameEn: 'Chat Message Alert',
      nameAr: 'تنبيه الرسائل والمحادثة',
      category: 'common',
      descriptionEn: 'Crisp bubble pop for in-trip and support messages.',
      descriptionAr: 'نغمة رسائل خفيفة وسريعة أثناء محادثة الرحلة أو الدعم.',
      url: '',
      presetKey: 'bubble_pop',
      isEnabled: true,
      volume: 0.8,
    },
    push_notification: {
      id: 'push_notification',
      nameEn: 'Push Notification Sound',
      nameAr: 'صوت إشعارات الدفع (Push)',
      category: 'push',
      descriptionEn: 'Clean sound played for background push notifications and system alerts.',
      descriptionAr: 'نغمة واضحة ومميزة لإشعارات الخلفية وإشعارات النظام.',
      url: '/mixkit-arabian-mystery-harp-notification-2489.wav',
      presetKey: 'crystal_harp',
      isEnabled: true,
      volume: 1.0,
    },
  },
};

// Aliases mapping old or shorthand keys to official sound keys
const SOUND_KEY_ALIASES: Record<string, SoundKey> = {
  trip_request: 'trip_request',
  incoming_ride: 'trip_request',
  ride_request: 'trip_request',
  request: 'trip_request',

  driver_offer: 'driver_offer',
  counter_offer: 'driver_offer',
  offer: 'driver_offer',
  offers: 'driver_offer',

  trip_accepted: 'trip_accepted',
  accepted: 'trip_accepted',
  accept: 'trip_accepted',
  ride_accepted: 'trip_accepted',

  driver_arrived: 'driver_arrived',
  arrival: 'driver_arrived',
  arrived: 'driver_arrived',

  trip_completed: 'trip_completed',
  completed: 'trip_completed',
  success: 'trip_completed',

  trip_cancelled: 'trip_cancelled',
  cancelled: 'trip_cancelled',
  cancel: 'trip_cancelled',

  chat_message: 'chat_message',
  chat: 'chat_message',
  message: 'chat_message',

  push_notification: 'push_notification',
  notification: 'push_notification',
  push: 'push_notification',
  alert: 'trip_request',
};

// Cached HTMLAudio elements for custom URLs and audio assets
const audioCache: Map<string, HTMLAudioElement> = new Map();
let currentAudioSettings: AppAudioSettings = { ...DEFAULT_APP_AUDIO_SETTINGS };
let audioContext: AudioContext | null = null;

type WindowWithWebkitAudio = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

// Audio unlock helper for mobile browsers (iOS Safari / Android Chrome autoplay policies)
if (isBrowser) {
  const unlockAudioContext = () => {
    try {
      if (!audioContext) {
        const win = window as WindowWithWebkitAudio;
        const AudioCtx = win.AudioContext || win.webkitAudioContext;
        if (AudioCtx) {
          audioContext = new AudioCtx();
        }
      }
      if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {
          /* ignore */
        });
      }
    } catch (e) {
      console.warn('Audio unlock warning:', e);
    }
    document.removeEventListener('click', unlockAudioContext);
    document.removeEventListener('touchstart', unlockAudioContext);
  };

  document.addEventListener('click', unlockAudioContext, { once: true });
  document.addEventListener('touchstart', unlockAudioContext, { once: true });
}

function getAudioContext(): AudioContext | null {
  if (!isBrowser) return null;
  if (!audioContext) {
    try {
      const win = window as WindowWithWebkitAudio;
      const AudioCtx = win.AudioContext || win.webkitAudioContext;
      if (AudioCtx) {
        audioContext = new AudioCtx();
      }
    } catch (e) {
      console.warn('Failed to create AudioContext', e);
    }
  }
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {
      /* ignore */
    });
  }
  return audioContext;
}

/**
 * Built-in acoustic synthesizer using Web Audio API.
 * Guarantees instant, zero-latency, beautiful, musically tuned sounds without 404s or CORS.
 */
function playSynthesizedPreset(presetKey: string, volumeMultiplier = 1.0): boolean {
  const ctx = getAudioContext();
  if (!ctx) return false;

  const masterVol = Math.max(0, Math.min(1, volumeMultiplier));
  const now = ctx.currentTime;

  try {
    switch (presetKey) {
      case 'radar_ping': {
        // Fast dual radar ping for incoming trip request
        const createPing = (delay: number, freqStart: number, freqEnd: number, dur: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freqStart, now + delay);
          osc.frequency.exponentialRampToValueAtTime(freqEnd, now + delay + dur);

          gain.gain.setValueAtTime(0.001, now + delay);
          gain.gain.exponentialRampToValueAtTime(0.7 * masterVol, now + delay + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + delay);
          osc.stop(now + delay + dur);
        };
        createPing(0, 950, 600, 0.12);
        createPing(0.14, 1350, 750, 0.16);
        return true;
      }

      case 'marimba_chime': {
        // Warm 3-note melodic marimba for driver offer / request
        const notes = [659.25, 830.61, 987.77]; // E5, G#5, B5
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);

          const start = now + idx * 0.08;
          gain.gain.setValueAtTime(0.001, start);
          gain.gain.exponentialRampToValueAtTime(0.6 * masterVol, start + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.36);
        });
        return true;
      }

      case 'fanfare_chord': {
        // Uplifting major triad arpeggio for trip accepted!
        const chord = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        chord.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.07);

          const start = now + idx * 0.07;
          gain.gain.setValueAtTime(0.001, start);
          gain.gain.exponentialRampToValueAtTime(0.55 * masterVol, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.55);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.56);
        });
        return true;
      }

      case 'car_horn_friendly': {
        // Friendly double honk chime for driver arrival
        const honk = (start: number, dur: number) => {
          [349.23, 440.0].forEach((freq) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1400, start);

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, start);

            gain.gain.setValueAtTime(0.001, start);
            gain.gain.linearRampToValueAtTime(0.3 * masterVol, start + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);

            osc.start(start);
            osc.stop(start + dur + 0.01);
          });
        };
        honk(now, 0.09);
        honk(now + 0.14, 0.12);
        return true;
      }

      case 'triumph_success': {
        // Ascending victory flourish for completed trip
        const notes = [783.99, 880.0, 1046.5, 1318.51]; // G5, A5, C6, E6
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);

          const start = now + idx * 0.08;
          gain.gain.setValueAtTime(0.001, start);
          gain.gain.exponentialRampToValueAtTime(0.6 * masterVol, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.62);
        });
        return true;
      }

      case 'gentle_drop': {
        // Soft descending two-tone for cancelled trip
        const notes = [739.99, 587.33]; // F#5, D5
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.16);

          const start = now + idx * 0.16;
          gain.gain.setValueAtTime(0.001, start);
          gain.gain.exponentialRampToValueAtTime(0.4 * masterVol, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.42);
        });
        return true;
      }

      case 'bubble_pop': {
        // Snappy bubble pop for chat messages
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(1250, now + 0.04);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.5 * masterVol, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.09);
        return true;
      }

      case 'crystal_harp': {
        // Melodic harp sequence
        const harpNotes = [493.88, 659.25, 783.99, 987.77, 1318.51];
        harpNotes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.06);

          const start = now + idx * 0.06;
          gain.gain.setValueAtTime(0.001, start);
          gain.gain.exponentialRampToValueAtTime(0.45 * masterVol, start + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.46);
        });
        return true;
      }

      case 'bell_ding': {
        // Clear bell chime with subtle overtone
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(1174.66, now); // D6
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(2349.32, now); // D7 overtone

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.6 * masterVol, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.82);
        osc2.stop(now + 0.82);
        return true;
      }

      case 'tech_blip': {
        // Clean futuristic tech blip
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(1600, now + 0.06);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.5 * masterVol, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.1);
        return true;
      }

      default:
        return false;
    }
  } catch (err) {
    console.warn('Audio synthesis failed:', err);
    return false;
  }
}

/**
 * Play an audio element from URL (supports base64 dataUrl, local path, or remote URL)
 */
async function playAudioUrl(url: string, volume = 1.0): Promise<boolean> {
  if (!isBrowser || !url) return false;
  try {
    let audio = audioCache.get(url);
    if (!audio) {
      audio = new Audio(url);
      audio.preload = 'auto';
      audioCache.set(url, audio);
    }
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.currentTime = 0;
    await audio.play();
    return true;
  } catch (e) {
    console.warn(`Failed to play audio from URL: ${url}`, e);
    return false;
  }
}

export const AudioService = {
  initialized: false,

  /**
   * Update the in-memory audio settings from Firestore or admin panel
   */
  updateSettings(settings: Partial<AppAudioSettings> | null | undefined) {
    if (!settings) return;
    currentAudioSettings = {
      ...DEFAULT_APP_AUDIO_SETTINGS,
      ...settings,
      sounds: {
        ...DEFAULT_APP_AUDIO_SETTINGS.sounds,
        ...(settings.sounds || {}),
      },
    };
  },

  /**
   * Get current audio settings
   */
  getSettings(): AppAudioSettings {
    return currentAudioSettings;
  },

  /**
   * Enable or disable full audio notifications across the app
   */
  setInAppSoundsEnabled(enabled: boolean) {
    currentAudioSettings.masterAudioEnabled = enabled;
  },

  /**
   * Preload native or browser audio assets
   */
  async preloadAll() {
    if (this.initialized) return;
    try {
      if (isNative) {
        try {
          await NativeAudio.preload({
            assetId: 'notification',
            assetPath: 'sounds/notification.wav',
            audioChannelNum: 1,
            volume: 1.0,
            isUrl: false,
          });
        } catch {
          /* ignore native preload error */
        }
      }
      this.initialized = true;
    } catch (error) {
      console.warn('Audio preload error:', error);
    }
  },

  /**
   * Resolve an incoming raw key or alias to official SoundKey
   */
  resolveSoundKey(rawKey: string): SoundKey {
    const normalized = (rawKey || '').toLowerCase().trim();
    return SOUND_KEY_ALIASES[normalized] || 'trip_request';
  },

  /**
   * Play the configured sound for an event
   */
  async play(rawKey: string, customVolume?: number) {
    // 1. Check master audio enable
    if (!currentAudioSettings.masterAudioEnabled) {
      return;
    }

    const soundKey = this.resolveSoundKey(rawKey);
    const soundConfig = currentAudioSettings.sounds?.[soundKey] || DEFAULT_APP_AUDIO_SETTINGS.sounds[soundKey];

    // 2. Check if this specific sound is enabled (not removed / muted)
    if (soundConfig && soundConfig.isEnabled === false) {
      return;
    }

    const effectiveVolume =
      (customVolume !== undefined ? customVolume : (soundConfig?.volume ?? 1.0)) *
      (currentAudioSettings.defaultVolume ?? 1.0);

    // 3. If a custom URL or uploaded file is set, play it first
    if (soundConfig?.url && soundConfig.url.trim() !== '') {
      const urlSuccess = await playAudioUrl(soundConfig.url, effectiveVolume);
      if (urlSuccess) return;
    }

    // 4. Otherwise play the configured preset tone acoustically
    const presetKey = soundConfig?.presetKey || 'radar_ping';
    const synthSuccess = playSynthesizedPreset(presetKey, effectiveVolume);
    if (synthSuccess) return;

    // 5. Native Audio platform fallback if native
    if (isNative) {
      try {
        await NativeAudio.play({ assetId: 'notification' });
        return;
      } catch {
        /* ignore native play error */
      }
    }

    // 6. Generic acoustic fallback
    this.playFallback(effectiveVolume);
  },

  /**
   * Preview a preset sound directly (used in Admin settings)
   */
  previewPreset(presetKey: string, volume = 1.0) {
    return playSynthesizedPreset(presetKey, volume);
  },

  /**
   * Preview an audio config (custom URL or preset)
   */
  async previewConfig(config: AppAudioConfig, volumeMultiplier = 1.0) {
    const vol = (config.volume ?? 1.0) * volumeMultiplier;
    if (config.url && config.url.trim()) {
      const success = await playAudioUrl(config.url, vol);
      if (success) return true;
    }
    return playSynthesizedPreset(config.presetKey || 'radar_ping', vol);
  },

  /**
   * Deliberately play once
   */
  async loop(assetId: string) {
    await this.play(assetId);
  },

  /**
   * Stop any currently playing cached audio
   */
  async stop(rawKey?: string) {
    try {
      if (rawKey) {
        const soundKey = this.resolveSoundKey(rawKey);
        const config = currentAudioSettings.sounds?.[soundKey];
        if (config?.url && audioCache.has(config.url)) {
          const audio = audioCache.get(config.url);
          if (audio) {
            audio.pause();
            audio.currentTime = 0;
          }
        }
      }
      // Pause all cached audios
      audioCache.forEach((audio) => {
        try {
          audio.pause();
          audio.currentTime = 0;
        } catch {
          /* ignore audio pause error */
        }
      });
    } catch (e) {
      console.warn('Failed to stop audio', e);
    }
  },

  /**
   * Simple musical fallback
   */
  playFallback(volume = 0.5) {
    if (!isBrowser) return;
    try {
      const ctx = getAudioContext();
      if (ctx) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1174, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.4 * volume, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.31);
      }
    } catch {
      /* ignore fallback error */
    }
  },
};
