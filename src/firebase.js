// ─── FIREBASE CONFIG ─────────────────────────────────────────────────────────
// Replace these values with your own Firebase project config.
// Instructions: https://console.firebase.google.com
// 1. Create a project → Add a web app → copy the firebaseConfig object here
// 2. Enable Firestore Database (Start in test mode is fine)

import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            "AIzaSyAmHsQ2CKZZ0nx3RrY6JNkA6cmobt4CqEk",
  authDomain:        "wc2026-betting-de6ab.firebaseapp.com",
  projectId:         "wc2026-betting-de6ab",
  storageBucket:     "wc2026-betting-de6ab.firebasestorage.app",
  messagingSenderId: "280084723911",
  appId:             "1:280084723911:web:45ea8f48be8d933a27a6e2",
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

const DOC_REF = doc(db, "wc2026", "sharedData");

export async function loadData() {
  try {
    const snap = await getDoc(DOC_REF);
    return snap.exists() ? snap.data().payload : null;
  } catch (e) {
    console.error("Firebase load error:", e);
    return null;
  }
}

export async function saveData(data) {
  try {
    await setDoc(DOC_REF, { payload: data });
  } catch (e) {
    console.error("Firebase save error:", e);
  }
}

export function subscribeToData(callback) {
  return onSnapshot(DOC_REF, (snap) => {
    if (snap.exists()) callback(snap.data().payload);
  });
}
