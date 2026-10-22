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
  const type    = payload.data?.type || 'general';
  // 届出（todoke_*）だけは届出IDごとに別通知にする。
  // type だけだと、別々の届出のメッセージが1件に上書きされてしまうため。
  // それ以外の通知は従来どおり type 単位（挙動を変えない）。
  const isTodoke = type.indexOf('todoke_') === 0 && payload.data?.recordId;
  const options = {
    body:               payload.notification?.body || '',
    icon:               '/icon-192.png',
    badge:              '/icon-192.png',
    tag:                isTodoke ? type + '_' + payload.data.recordId : type,
    data:               payload.data || {},
    requireInteraction: false,
  };
  self.registration.showNotification(title, options);
});

// 通知をタップしたときの動作（アプリを開く・フォーカスする）
self.addEventListener('notificationclick', event => {
  event.notification.close();

  // 届出の通知は、申請アプリの該当届出を直接開く。
  // それ以外は従来どおり（開いているウィンドウにフォーカス）。
  const data = event.notification.data || {};
  if (String(data.type || '').indexOf('todoke_') === 0 && data.recordId) {
    const url = new URL('./apply-pwa/?todoke=' + encodeURIComponent(data.recordId),
                        self.registration.scope).href;
    event.waitUntil(clients.openWindow ? clients.openWindow(url) : Promise.resolve());
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
