import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, collection, query, where, getDocs 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

function getDb() {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    return getFirestore(app);
}

export async function getMutualMatches(myUid) {
  const db = getDb();
  const crushesRef = collection(db, "crushes");
  
  // Who I crushed
  const myCrushQuery = query(crushesRef, where("fromId", "==", myUid));
  const myCrushSnap = await getDocs(myCrushQuery);
  const sentTo = new Set();
  myCrushSnap.forEach(doc => sentTo.add(doc.data().toId));
  
  // Who crushed me
  const theirCrushQuery = query(crushesRef, where("toId", "==", myUid));
  const theirCrushSnap = await getDocs(theirCrushQuery);
  const matchedUids = {};
  
  theirCrushSnap.forEach(doc => {
      const senderUid = doc.data().fromId;
      if (sentTo.has(senderUid)) {
          matchedUids[senderUid] = true;
      }
  });
  
  return matchedUids;
}
