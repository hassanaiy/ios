import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ans.waslny',
  appName: 'Mowasla',
  webDir: 'dist',

  server: {
    allowNavigation: [
      'waslny-7791e.firebaseapp.com',
      'waslny-7791e.web.app',
      '*.google.com',
      '*.googleapis.com',
      '*.gstatic.com',
      '*.myfatoorah.com',
      '*.play.google.com'
    ]
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#FFFFFF',
      androidScaleType: 'CENTER_INSIDE',
      showSpinner: false
    },

    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com', 'phone']
    },

    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
