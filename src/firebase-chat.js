import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, 
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
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

function getDb() {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    return getFirestore(app);
}

/**
 * Handles sending a crush and checking for a mutual match.
 * @param {string} currentUid - The ID of the user sending the crush.
 * @param {string} targetUid  - The ID of the user receiving the crush.
 * @returns {Promise<boolean>} - Returns true if mutual, false if one-way.
 */
export { getDb };
export async function sendCrush(fromId, toId) {
  const db = getDb();
  const crushesRef = collection(db, "crushes");

  // Prevent users from crushing themselves
  if (fromId === toId) {
    console.warn("User tried to crush themselves.");
    return { status: "self_crush_not_allowed" };
  }

  const crushQuery = query(
    crushesRef,
    where("fromId", "==", fromId),
    where("toId", "==", toId)
  );

  try {
    const querySnapshot = await getDocs(crushQuery);

    if (querySnapshot.empty) {
      // No existing crush, so create one
      await addDoc(crushesRef, {
        fromId: fromId,
        toId: toId,
        timestamp: serverTimestamp(),
      });

      // Now, check if the other person has already crushed back
      const mutualCrushQuery = query(
        crushesRef,
        where("fromId", "==", toId),
        where("toId", "==", fromId)
      );
      const mutualCrushSnapshot = await getDocs(mutualCrushQuery);

      if (!mutualCrushSnapshot.empty) {
        return { status: "mutual" }; // It's a match!
      } else {
        return { status: "sent" }; // Crush sent, but not yet mutual
      }
    } else {
      // Crush already sent — still check if they crushed back
      const mutualCrushQuery = query(
        crushesRef,
        where("fromId", "==", toId),
        where("toId", "==", fromId)
      );
      const mutualCrushSnapshot = await getDocs(mutualCrushQuery);
      if (!mutualCrushSnapshot.empty) {
        return { status: "mutual" };
      }
      return { status: "already_sent" };
    }
  } catch (error) {
    console.error("Error sending crush:", error);
    throw error; // Re-throw the error to be handled by the caller
  }
}

/**
 * Validates active chat listeners to avoid duplicates
 */
let unsubscribeChat = null;

export function listenToMessages(currentUid, targetUid, onMessageReceived) {
  if (unsubscribeChat) unsubscribeChat();

  const db = getDb();
  const messagesRef = collection(db, "messages");

  let sentMsgs = [];
  let recvMsgs = [];

  const mergeAndNotify = () => {
    const all = [...sentMsgs, ...recvMsgs];
    all.sort((a, b) => {
      const ta = a.createdAt ? (a.createdAt.seconds || 0) : 0;
      const tb = b.createdAt ? (b.createdAt.seconds || 0) : 0;
      return ta - tb;
    });
    if (onMessageReceived) onMessageReceived(all);
  };

  // Query 1: Messages I sent to target
  const sentQuery = query(
    messagesRef,
    where("senderId", "==", currentUid),
    where("receiverId", "==", targetUid)
  );

  // Query 2: Messages target sent to me
  const recvQuery = query(
    messagesRef,
    where("senderId", "==", targetUid),
    where("receiverId", "==", currentUid)
  );

  const unsub1 = onSnapshot(sentQuery, (snapshot) => {
    sentMsgs = [];
    snapshot.forEach((docSnap) => sentMsgs.push(docSnap.data()));
    mergeAndNotify();
  }, (error) => {
    console.error("listenToMessages sent query hatası:", error);
  });

  const unsub2 = onSnapshot(recvQuery, (snapshot) => {
    recvMsgs = [];
    snapshot.forEach((docSnap) => recvMsgs.push(docSnap.data()));
    mergeAndNotify();
  }, (error) => {
    console.error("listenToMessages recv query hatası:", error);
  });

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
  const db = getDb();
  
  try {
    // 1. Add the message to the messages collection
    await addDoc(collection(db, "messages"), {
      senderId: currentUid,
      receiverId: targetUid,
      text: messageText,
      createdAt: serverTimestamp()
    });

    const currentUserRef = doc(db, "users", currentUid);
    const targetUserRef = doc(db, "users", targetUid);

    // Update timestamps silently (can fail if documents not yet generated from auth)
    try {
        await updateDoc(currentUserRef, { lastMessageAt: serverTimestamp() });
        await updateDoc(targetUserRef, { lastMessageAt: serverTimestamp() });
    } catch(err) {
        console.warn("User documents might not exist yet for updateDoc:", err);
    }

    // 2. Check the receiver's online status
    const targetUserSnap = await getDoc(targetUserRef);
    if (targetUserSnap.exists()) {
      const targetData = targetUserSnap.data();
      
      // 3. Offline Email trigger logic
      if (!targetData.isOnline && targetData.email) {
        const currentUserSnap = await getDoc(currentUserRef);
        const senderName = currentUserSnap.exists() ? currentUserSnap.data().name || "Someone" : "Someone";

        await addDoc(collection(db, "mail"), {
          to: targetData.email,
          message: {
            subject: `${senderName} sent you a message!`,
            text: `You just received a new message from ${senderName}: "${messageText}"`,
            html: `<h3>New message from ${senderName}!</h3><p><strong>Message:</strong> ${messageText}</p>`
          }
        });
      }
    }
    
  } catch (error) {
    console.error("Error sending message:", error);
  }
}
