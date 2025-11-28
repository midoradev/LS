import Constants from "expo-constants";
import { initializeApp, getApps, getApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getDatabase, ref, get, update, type Database } from "firebase/database";

type FirebaseExtra = {
  firebaseDbUrl?: string;
  firebaseAuthToken?: string;
  firebaseProjectId?: string;
  firebaseApiKey?: string;
  firebaseAuthDomain?: string;
  firebaseStorageBucket?: string;
  firebaseMessagingSenderId?: string;
  firebaseAppId?: string;
  firebaseMeasurementId?: string;
};

const getEnvValue = (key: string) => {
  const env =
    (typeof globalThis !== "undefined" &&
      (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env) ||
    undefined;
  return env?.[key];
};

export type FirebaseConfig = {
  dbUrl: string | null;
  authToken: string | null;
  projectId: string | null;
};

export type FirebaseSdkConfig = {
  apiKey: string | null;
  authDomain: string | null;
  databaseURL: string | null;
  projectId: string | null;
  storageBucket: string | null;
  messagingSenderId: string | null;
  appId: string | null;
  measurementId: string | null;
};

export const getFirebaseConfig = (): FirebaseConfig => {
  const extra = Constants?.expoConfig?.extra as FirebaseExtra | undefined;
  const projectId =
    getEnvValue("EXPO_PUBLIC_FIREBASE_PROJECT_ID") ||
    extra?.firebaseProjectId ||
    null;
  const derivedDbUrl = projectId ? `https://${projectId}-default-rtdb.firebaseio.com` : null;
  return {
    dbUrl:
      getEnvValue("EXPO_PUBLIC_FIREBASE_DB_URL") ||
      extra?.firebaseDbUrl ||
      derivedDbUrl,
    authToken:
      getEnvValue("EXPO_PUBLIC_FIREBASE_AUTH_TOKEN") ||
      extra?.firebaseAuthToken ||
      null,
    projectId,
  };
};

export const getFirebaseSdkConfig = (): FirebaseSdkConfig => {
  const extra = Constants?.expoConfig?.extra as FirebaseExtra | undefined;
  const baseDbUrl = getEnvValue("EXPO_PUBLIC_FIREBASE_DB_URL") || extra?.firebaseDbUrl || null;
  const projectId =
    getEnvValue("EXPO_PUBLIC_FIREBASE_PROJECT_ID") ||
    extra?.firebaseProjectId ||
    null;

  return {
    apiKey: getEnvValue("EXPO_PUBLIC_FIREBASE_API_KEY") || extra?.firebaseApiKey || null,
    authDomain:
      getEnvValue("EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN") || extra?.firebaseAuthDomain || null,
    databaseURL: baseDbUrl,
    projectId,
    storageBucket:
      getEnvValue("EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET") || extra?.firebaseStorageBucket || null,
    messagingSenderId:
      getEnvValue("EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID") ||
      extra?.firebaseMessagingSenderId ||
      null,
    appId: getEnvValue("EXPO_PUBLIC_FIREBASE_APP_ID") || extra?.firebaseAppId || null,
    measurementId:
      getEnvValue("EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID") || extra?.firebaseMeasurementId || null,
  };
};

const toFirebaseOptions = (): FirebaseOptions | null => {
  const sdk = getFirebaseSdkConfig();
  if (!sdk.apiKey || !sdk.projectId || !sdk.appId) return null;
  return {
    apiKey: sdk.apiKey,
    authDomain: sdk.authDomain || undefined,
    databaseURL: sdk.databaseURL || undefined,
    projectId: sdk.projectId,
    storageBucket: sdk.storageBucket || undefined,
    messagingSenderId: sdk.messagingSenderId || undefined,
    appId: sdk.appId,
    measurementId: sdk.measurementId || undefined,
  };
};

let firebaseApp: FirebaseApp | null = null;
let firebaseDb: Database | null = null;

const getFirebaseAppSafe = () => {
  if (firebaseApp) return firebaseApp;
  const options = toFirebaseOptions();
  if (!options) return null;
  try {
    firebaseApp = getApps().length ? getApp() : initializeApp(options);
    return firebaseApp;
  } catch (error) {
    console.warn("Không thể khởi tạo Firebase SDK:", error);
    return null;
  }
};

const getFirebaseDbSafe = () => {
  if (firebaseDb) return firebaseDb;
  const app = getFirebaseAppSafe();
  if (!app) return null;
  try {
    firebaseDb = getDatabase(app);
    return firebaseDb;
  } catch (error) {
    console.warn("Không thể khởi tạo Firebase Database:", error);
    return null;
  }
};

export const fetchFirebaseJson = async <T>(
  path: string,
  signal?: AbortSignal
): Promise<T | null> => {
  const db = getFirebaseDbSafe();
  if (!db) return null;
  try {
    const snapshot = await get(ref(db, path));
    if (signal?.aborted) return null;
    return snapshot.exists() ? (snapshot.val() as T) : null;
  } catch (error) {
    if (signal?.aborted) return null;
    console.warn(`Không thể lấy ${path} từ Firebase SDK:`, error);
    return null;
  }
};

export const patchFirebaseJson = async <T>(path: string, data: T) => {
  const db = getFirebaseDbSafe();
  if (!db) return false;
  try {
    await update(ref(db, path), data as Record<string, unknown>);
    return true;
  } catch (error) {
    console.warn(`Không thể ghi ${path} lên Firebase SDK:`, error);
    return false;
  }
};
