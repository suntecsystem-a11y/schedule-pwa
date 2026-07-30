// ============================================================
// Firebase Cloud Messaging サービスワーカー
// このファイルは Netlify のルートに index.html と一緒に配置してください
// ============================================================

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// ★ index.html の FIREBASE_CONFIG と同じ値を入力してください
const firebaseConfig = {
  apiKey: "AIzaSyB87kKVgi-MADbg5vzijiEv5H8jhJpb1mg",
  authDomain: "schedule-tsuchi0.firebaseapp.com",
  projectId: "schedule-tsuchi0",
  storageBucket: "schedule-tsuchi0.firebasestorage.app",
  messagingSenderId: "469856571712",
  appId: "1:469856571712:web:8a41974c196994b642aaa5",
  measurementId: "G-58RVVHY50P"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// バックグラウンド通知の受信（アプリが閉じているとき）
messaging.onBackgroundMessage(payload => {
  const title   = payload.notification?.title || 'スケジュール通知';
  const options = {
    body:               payload.notification?.body || '',
    icon:               '/icon-192.png',
    badge:              '/icon-192.png',
    tag:                payload.data?.type || 'general',
    data:               payload.data || {},
    requireInteraction: false,
  };
  self.registration.showNotification(title, options);
});

// 通知をタップしたときの動作（アプリを開く・フォーカスする）
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
