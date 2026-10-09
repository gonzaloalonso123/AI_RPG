import { initializeApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import {
  getFunctions,
  connectFunctionsEmulator,
  httpsCallable,
} from "firebase/functions";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import {
  getDatabase,
  connectDatabaseEmulator,
  ref,
  onValue,
  onDisconnect,
  set,
  serverTimestamp,
} from "firebase/database";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import type { Command } from "@story/contracts";
export const isDemo =
  import.meta.env.VITE_MODE === "emulator" ||
  (!import.meta.env.PROD && !import.meta.env.VITE_FIREBASE_PROJECT_ID);
if (import.meta.env.PROD && isDemo)
  throw new Error("Production refuses emulator mode");
const projectId = isDemo
  ? "demo-story-master"
  : import.meta.env.VITE_FIREBASE_PROJECT_ID;
export const configured = !!projectId;
const app = initializeApp({
  projectId: projectId || "unconfigured",
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "localhost",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
  databaseURL: isDemo
    ? `http://127.0.0.1:9000?ns=${projectId}-default-rtdb`
    : import.meta.env.VITE_FIREBASE_DATABASE_URL,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "demo-app",
});
export const auth = getAuth(app),
  db = getFirestore(app),
  fn = getFunctions(
    app,
    import.meta.env.VITE_FIREBASE_REGION || "europe-west1",
  ),
  storage = getStorage(app),
  presence = getDatabase(app);
if (isDemo) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(fn, "127.0.0.1", 5001);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  connectDatabaseEmulator(presence, "127.0.0.1", 9000);
} else if (import.meta.env.VITE_APPCHECK_SITE_KEY)
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(import.meta.env.VITE_APPCHECK_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
export async function send(command: Command, requestId?: string) {
  const key = `pending-command-${auth.currentUser?.uid}-${JSON.stringify(command)}`;
  const stableId =
    requestId ?? sessionStorage.getItem(key) ?? crypto.randomUUID();
  sessionStorage.setItem(key, stableId);
  const call = httpsCallable<
    { command: Command; requestId: string },
    { campaignId: string; code?: string }
  >(fn, "command");
  try {
    const result = await call({ command, requestId: stableId });
    sessionStorage.removeItem(key);
    return result.data;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (
      code &&
      ![
        "functions/internal",
        "functions/unavailable",
        "functions/deadline-exceeded",
      ].includes(code)
    )
      sessionStorage.removeItem(key);
    throw error;
  }
}
export function trackPresence(uid: string) {
  const connection = ref(presence, `presence/${uid}/${crypto.randomUUID()}`);
  const off = onValue(ref(presence, ".info/connected"), async (s) => {
    if (s.val()) {
      await onDisconnect(connection).remove();
      await set(connection, { online: true, at: serverTimestamp() });
    }
  });
  return () => {
    off();
    void set(connection, null);
  };
}
export {
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
};
