
import { functions } from './firebase';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
// Fix: Using namespace import for firebase/functions to resolve missing exported member error
import * as FirebaseFunctions from 'firebase/functions';

export const requestPayment = async (rideId: string, amount: number, user: any) => {
  try {
    // Call the Cloud Function securely
    // Fix: Access httpsCallable via namespace
    const createOrder = FirebaseFunctions.httpsCallable(functions, 'createOPayOrder');
    
    const payload = {
      amount: Number(amount),
      rideId: rideId,
      userId: user.id || 'unknown_user',
      userEmail: user.email || 'no-email@mowasla.com',
      userName: user.name || 'Mowasla User',
      userPhone: user.phone || '01000000000'
    };

    const result: any = await createOrder(payload);
    const cashierUrl = result.data.cashierUrl;

    if (cashierUrl) {
      if (Capacitor.isNativePlatform()) {
        // Open in-app browser for better UX on mobile
        await Browser.open({ 
            url: cashierUrl,
            presentationStyle: 'popover'
        });
      } else {
        // Standard redirect for web
        window.location.href = cashierUrl;
      }
    } else {
      throw new Error("No cashier URL returned from payment provider.");
    }
  } catch (error) {
    console.error("Payment Request Error:", error);
    throw error;
  }
};
