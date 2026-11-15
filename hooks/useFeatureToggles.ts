import { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export function useFeatureToggles() {
  const [phoneAuthEnabled, setPhoneAuthEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'features'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPhoneAuthEnabled(data.phoneAuthEnabled !== false);
      } else {
        setPhoneAuthEnabled(true);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching feature flags:", error);
      setPhoneAuthEnabled(false);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return { phoneAuthEnabled, loading };
}
