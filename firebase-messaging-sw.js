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
messaging.onBackgroundMessage(async payload => {
  const title   = payload.notification?.title || 'スケジュール通知';
  const type    = payload.data?.type || 'general';
  // 届出（todoke_*）だけは届出IDごとに別通知にする。
  // type だけだと、別々の届出のメッセージが1件に上書きされてしまうため。
  // それ以外の通知は従来どおり type 単位（挙動を変えない）。
  const isTodoke = type.indexOf('todoke_') === 0 && payload.data?.recordId;
  const options = {
    body:               payload.notification?.body || '',
    // アイコンはこのファイルと同じ場所（/schedule-pwa/）。前は '/icon-192.png'（サイトの一番上）を見ていて 404 だった（2026-11-06）
    icon:               new URL('icon-192.png', self.registration.scope).href,
    badge:              new URL('icon-192.png', self.registration.scope).href,
    tag:                isTodoke ? type + '_' + payload.data.recordId : type,
    data:               payload.data || {},
    requireInteraction: false,
  };
  await self.registration.showNotification(title, options);

  // 同じ通知が2つ出ないようにする（2026-11-06）。
  // 送る側（Worker・GAS）は notification 付きで送っているので、Firebase は自分でも1つ表示してから、ここを呼ぶ。
  // 押したときの動き（届出なら申請アプリを開く）はこのファイルの notificationclick で作ってあるので、
  // こちらで出した方を残し、Firebase が出した方（data に FCM_MSG を持つもの）を閉じる。
  // 上の表示に失敗したときは、ここまで来ないので Firebase の方が残る（通知が0になることはない）。
  const shown = await self.registration.getNotifications();
  shown.forEach(n => { if (n.data && n.data.FCM_MSG) n.close(); });
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
      // HALO を開いていないときは HALO の画面を開く（前は '/'＝サイトの一番上で 404 だった。2026-11-06）
      if (clients.openWindow) return clients.openWindow(self.registration.scope);
    })
  );
});
