import {
  getApp,
  getApps,
  initializeApp,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore,
  initializeFirestore,
  collection,
  doc,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { enableNetwork } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
let _db = null;
async function getDb() {
  if (_db) return _db;

  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

  try {
    _db = initializeFirestore(app, {
      experimentalForceLongPolling: true,
      useFetchStreams: false,
    });
  } catch (e) {
    console.warn(
      "initializeFirestore already called, falling back to getFirestore:",
      e.message,
    );
    _db = getFirestore(app);
  }
  // enableNetwork'ü bloklamadan ateşle — iOS Capacitor'da takılmasını engelle
  enableNetwork(_db)
    .then(() => console.log("Firestore ağ bağlantısı zorla açıldı."))
    .catch((e) => console.error("Ağ açma hatası:", e));
  return _db;
}

/**
 * Handles sending a crush and checking for a mutual match.
 * @param {string} currentUid - The ID of the user sending the crush.
 * @param {string} targetUid  - The ID of the user receiving the crush.
 * @returns {Promise<boolean>} - Returns true if mutual, false if one-way.
 */
export { getDb };

function isIOSNative() {
  return window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.sendCrush;
}

function sendCrushNative(fromId, toId) {
  return new Promise((resolve, reject) => {
    const callbackId = "crushCb_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);

    const timeout = setTimeout(() => {
      delete window[callbackId];
      reject(new Error("iOS native crush isteği zaman aşımına uğradı."));
    }, 15000);

    window[callbackId] = (result) => {
      clearTimeout(timeout);
      delete window[callbackId];
      if (result.error) {
        reject(new Error(result.error));
      } else {
        resolve({ status: result.status });
      }
    };

    window.webkit.messageHandlers.sendCrush.postMessage({
      fromId: fromId,
      toId: toId,
      callbackId: callbackId
    });
  });
}

// Kilit değişkenini dosya seviyesinde tutalım
let isProcessingCrush = false;

export async function sendCrush(fromId, toId) {
  // 1. GÜVENLİK KONTROLLERİ
  if (isProcessingCrush) {
    console.warn("[sendCrush] Zaten bir işlem sürüyor, sakin ol aşkım.");
    return { status: "processing" };
  }
  
  if (fromId === toId) {
    return { status: "self_crush_not_allowed" };
  }

  console.log(`[sendCrush] İşlem başlıyor: ${fromId} -> ${toId}`);
  isProcessingCrush = true; // KİLİDİ KAPAT

  try {
    const db = await getDb();
    const crushesRef = collection(db, "crushes");

    // 2. ZAMAN AŞIMI KONTROLÜ (15 Saniye)
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Firestore bağlantısı zaman aşımına uğradı.")), 15000)
    );

    // 3. ASIL FİRESTORE İŞLEMİ
    const firestoreWork = (async () => {
      // Önce daha önce atılmış mı bak (Query)
      const q = query(crushesRef, where("fromId", "==", fromId), where("toId", "==", toId));
      const snap = await getDocs(q);

      if (snap.empty) {
        // Yeni Crush ekle
        await addDoc(crushesRef, {
          fromId: fromId,
          toId: toId,
          timestamp: serverTimestamp()
        });
        console.log("[sendCrush] Yeni belge oluşturuldu.");

        // Karşılıklı mı bak (Match kontrolü)
        const mq = query(crushesRef, where("fromId", "==", toId), where("toId", "==", fromId));
        const mSnap = await getDocs(mq);
        
        return !mSnap.empty ? { status: "mutual" } : { status: "sent" };
      } else {
        // Zaten varmış, karşılık gelmiş mi ona bak
        const mq = query(crushesRef, where("fromId", "==", toId), where("toId", "==", fromId));
        const mSnap = await getDocs(mq);
        return !mSnap.empty ? { status: "mutual" } : { status: "already_sent" };
      }
    })();

    // Yarıştır bakalım!
    const result = await Promise.race([firestoreWork, timeoutPromise]);
    return result;

  } catch (error) {
    console.error("[sendCrush] KRİTİK HATA:", error.message);
    throw error;
  } finally {
    // NE OLURSA OLSUN KİLİDİ AÇ (Yoksa uygulama bir daha crush atamaz)
    isProcessingCrush = false;
    console.log("[sendCrush] İşlem bitti, kilit açıldı.");
  }
}

/**
 * Validates active chat listeners to avoid duplicates
 */
let unsubscribeChat = null;

export async function listenToMessages(currentUid, targetUid, onMessageReceived) {
  if (unsubscribeChat) unsubscribeChat();

  const db = await getDb();
  const messagesRef = collection(db, "messages");

  let sentMsgs = [];
  let recvMsgs = [];

  const mergeAndNotify = () => {
    const all = [...sentMsgs, ...recvMsgs];
    all.sort((a, b) => {
      const ta = a.createdAt ? a.createdAt.seconds || 0 : 0;
      const tb = b.createdAt ? b.createdAt.seconds || 0 : 0;
      return ta - tb;
    });
    if (onMessageReceived) onMessageReceived(all);
  };

  // Query 1: Messages I sent to target
  const sentQuery = query(
    messagesRef,
    where("senderId", "==", currentUid),
    where("receiverId", "==", targetUid),
  );

  // Query 2: Messages target sent to me
  const recvQuery = query(
    messagesRef,
    where("senderId", "==", targetUid),
    where("receiverId", "==", currentUid),
  );

  const unsub1 = onSnapshot(
    sentQuery,
    (snapshot) => {
      sentMsgs = [];
      snapshot.forEach((docSnap) => sentMsgs.push(docSnap.data()));
      mergeAndNotify();
    },
    (error) => {
      console.error("listenToMessages sent query hatası:", error);
    },
  );

  const unsub2 = onSnapshot(
    recvQuery,
    (snapshot) => {
      recvMsgs = [];
      snapshot.forEach((docSnap) => recvMsgs.push(docSnap.data()));
      mergeAndNotify();
    },
    (error) => {
      console.error("listenToMessages recv query hatası:", error);
    },
  );

  unsubscribeChat = () => {
    unsub1();
    unsub2();
  };
}

/**
 * Sends a message, updates timestamps, and triggers an offline email if needed.
 * @param {string} currentUid  - The ID of the user sending the message.
 * @param {string} targetUid   - The ID of the user receiving the message.
 * @param {string} messageText - The content of the message.
 */
export async function sendSimsMessage(currentUid, targetUid, messageText) {
  const db = await getDb();

  try {
    // 1. Add the message to the messages collection
    await addDoc(collection(db, "messages"), {
      senderId: currentUid,
      receiverId: targetUid,
      text: messageText,
      createdAt: serverTimestamp(),
    });

    const currentUserRef = doc(db, "users", currentUid);
    const targetUserRef = doc(db, "users", targetUid);

    // Update timestamps silently (can fail if documents not yet generated from auth)
    try {
      await updateDoc(currentUserRef, { lastMessageAt: serverTimestamp() });
      await updateDoc(targetUserRef, { lastMessageAt: serverTimestamp() });
    } catch (err) {
      console.warn("User documents might not exist yet for updateDoc:", err);
    }

    // 2. Check the receiver's online status
    const targetUserSnap = await getDoc(targetUserRef);
    if (targetUserSnap.exists()) {
      const targetData = targetUserSnap.data();

      // 3. Offline Email trigger logic
      if (!targetData.isOnline && targetData.email) {
        const currentUserSnap = await getDoc(currentUserRef);
        const senderName = currentUserSnap.exists()
          ? currentUserSnap.data().name || "Someone"
          : "Someone";

        await addDoc(collection(db, "mail"), {
          to: targetData.email,
          message: {
            subject: `${senderName} sent you a message!`,
            text: `You just received a new message from ${senderName}: "${messageText}"`,
            html: `<h3>New message from ${senderName}!</h3><p><strong>Message:</strong> ${messageText}</p>`,
          },
        });
      }
    }
  } catch (error) {
    console.error("Error sending message:", error);
  }
}
