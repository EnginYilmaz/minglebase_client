import { getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
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

function getDb() {
    return getFirestore(getApp());
}

/**
 * Handles sending a crush and checking for a mutual match.
 * @param {string} currentUid - The ID of the user sending the crush.
 * @param {string} targetUid  - The ID of the user receiving the crush.
 * @returns {Promise<boolean>} - Returns true if mutual, false if one-way.
 */
export { getDb };
export async function checkMatchAndCrush(currentUid, targetUid) {
  const db = getDb();
  const crushesRef = collection(db, "crushes");

  try {
    // 1. Check if the current user already sent a crush (prevents duplicates)
    const myCrushQuery = query(
      crushesRef,
      where("fromId", "==", currentUid),
      where("toId", "==", targetUid)
    );
    const myCrushSnap = await getDocs(myCrushQuery);

    // 2. If no crush sent yet, create one
    if (myCrushSnap.empty) {
      await addDoc(crushesRef, {
        fromId: currentUid,
        toId: targetUid,
        timestamp: serverTimestamp()
      });
    }

    // 3. Check if they crushed back (Mutual Check)
    const theirCrushQuery = query(
      crushesRef,
      where("fromId", "==", targetUid),
      where("toId", "==", currentUid)
    );
    const theirCrushSnap = await getDocs(theirCrushQuery);

    // 4. Handle UI / Match Logic
    if (!theirCrushSnap.empty) {
      return true; // Mutual match
    } else {
      return false; // One-way crush
    }

  } catch (error) {
    console.error("Error processing crush:", error);
    return false;
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
  
  const chatQuery = query(
    messagesRef,
    where("senderId", "in", [currentUid, targetUid]),
    where("receiverId", "in", [currentUid, targetUid]),
    orderBy("createdAt", "asc")
  );

  unsubscribeChat = onSnapshot(chatQuery, (snapshot) => {
    let messages = [];
    snapshot.forEach((docSnap) => {
      const msg = docSnap.data();
      const isRelevant = 
        (msg.senderId === currentUid && msg.receiverId === targetUid) ||
        (msg.senderId === targetUid && msg.receiverId === currentUid);

      if (isRelevant) {
        messages.push(msg);
      }
    });

    if (onMessageReceived) {
        onMessageReceived(messages);
    }
  }, (error) => {
      console.error("Firebase listenToMessages hatası: ", error);
  });
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
