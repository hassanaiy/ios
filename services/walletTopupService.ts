
import { functions, db } from './firebaseBridge';
import { doc, onSnapshot } from 'firebase/firestore';
import * as FirebaseFunctions from 'firebase/functions';

export interface TopupRecord {
  id: string;
  userId: string;
  amountCents: number;
  status: 'pending' | 'paid' | 'failed';
  cashierUrl?: string;
  createdAt: any;
}

/**
 * Initiates a secure top-up intent on the server.
 * Returns the topupId and cashierUrl.
 * Browser redirection is now handled in the UI to ensure the listener is active first.
 */
export const createTopupIntent = async (amount: number): Promise<{ topupId: string; cashierUrl: string }> => {
  try {
    const createIntent = FirebaseFunctions.httpsCallable(functions, 'createTopupIntent');
    const result: any = await createIntent({ amount });
    
    const { topupId, cashierUrl } = result.data;

    if (!topupId || !cashierUrl) {
      throw new Error("Invalid response from server");
    }

    return { topupId, cashierUrl };
  } catch (error) {
    console.error("Create Topup Intent Error:", error);
    throw error;
  }
};

/**
 * Subscribes to a specific top-up document to detect when the status changes.
 */
export const subscribeToTopup = (topupId: string, callback: (topup: TopupRecord | null) => void) => {
  return onSnapshot(doc(db, 'topups', topupId), (snapshot) => {
    if (snapshot.exists()) {
      callback({ id: snapshot.id, ...snapshot.data() } as TopupRecord);
    } else {
      callback(null);
    }
  }, (error) => { console.warn("Topup listener error", error); });
};
