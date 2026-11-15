
// استيراد مكتبات Firebase اللازمة للـ Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// تهيئة Firebase داخل الـ Service Worker بنفس بيانات مشروعك
firebase.initializeApp({
  apiKey: "AIzaSyCehtRJUKVVkXZYMLtv7dqFZOWItgxOlJE",
  authDomain: "waslny-7791e.firebaseapp.com",
  projectId: "waslny-7791e",
  storageBucket: "waslny-7791e.firebasestorage.app",
  messagingSenderId: "851969305124",
  appId: "1:851969305124:web:868643f9a848fefb2a86b1"
});

const messaging = firebase.messaging();

// التعامل مع الإشعارات عندما يكون التطبيق في الخلفية
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background message ', payload);
  
  const data = payload?.data || {};
  const notificationTitle = payload?.notification?.title || data?.title || "طلب رحلة جديد! 🚗";
  const notificationBody = payload?.notification?.body || data?.body || "لديك طلب جديد في منطقتك";

  const notificationOptions = {
    body: notificationBody,
    icon: '/favicon.ico', // Standard favicon or app logo
    badge: '/favicon.ico',
    data: data,
    tag: data.rideId ? `ride_${data.rideId}` : (data.eventId || data.type || 'general_notification'),
    renotify: true,
    vibrate: [200, 100, 200]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// التعامل مع النقر على الإشعار
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Focus existing window or open a new one
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus();
      }
      return clients.openWindow('/');
    })
  );
});
