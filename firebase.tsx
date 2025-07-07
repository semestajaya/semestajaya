import { initializeApp } from 'firebase/app';
import { 
    getFirestore, 
    collection, 
    getDocs, 
    doc, 
    setDoc, 
    deleteDoc, 
    writeBatch, 
    query, 
    where 
} from 'firebase/firestore';

// --- DATA INTERFACES (salin dari index.tsx agar tetap sinkron) ---
interface Store {
  id: string;
  name: string;
  address?: string;
  itemCategories: any[];
  units: any[];
  assetCategories: any[];
  items: any[];
  inventory: any[];
  assets: any[];
  costs: any[];
}

interface OpnameSession {
  id: string;
  storeId: string;
  date: string;
  status: 'completed';
  items: any[];
  assetChanges: any[];
}

// --- KONFIGURASI FIREBASE ---
// TODO: Ganti dengan konfigurasi Firebase proyek Anda.
// 1. Buka Firebase Console (console.firebase.google.com)
// 2. Buka Project Settings > General
// 3. Di bagian "Your apps", klik ikon web (</>)
// 4. Salin objek firebaseConfig dan tempel di sini.
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Nama koleksi di Firestore
const STORES_COLLECTION = 'stores';
const HISTORY_COLLECTION = 'opnameHistory';

// --- FUNGSI INTERAKSI DATABASE ---

/**
 * Mengambil semua data toko dan riwayat opname dari Firestore.
 */
export const fetchStoresAndHistory = async (): Promise<{ stores: Store[], history: OpnameSession[] }> => {
    console.log("Fetching data from Firestore...");
    const storesSnapshot = await getDocs(collection(db, STORES_COLLECTION));
    const historySnapshot = await getDocs(collection(db, HISTORY_COLLECTION));

    const stores = storesSnapshot.docs.map(doc => doc.data() as Store);
    const history = historySnapshot.docs.map(doc => doc.data() as OpnameSession);

    console.log(`Fetched ${stores.length} stores and ${history.length} history records.`);
    return { stores, history };
};

/**
 * Menambah atau memperbarui satu dokumen toko di Firestore.
 * Menggunakan setDoc dengan ID kustom, sehingga berfungsi untuk menambah dan mengedit.
 */
export const writeStore = async (store: Store): Promise<void> => {
    console.log(`Writing store ${store.id} to Firestore...`);
    const storeRef = doc(db, STORES_COLLECTION, store.id);
    await setDoc(storeRef, store);
    console.log(`Store ${store.id} successfully written.`);
};

/**
 * Menghapus satu dokumen toko dari Firestore.
 */
export const deleteStore = async (storeId: string): Promise<void> => {
    console.log(`Deleting store ${storeId} from Firestore...`);
    const storeRef = doc(db, STORES_COLLECTION, storeId);
    await deleteDoc(storeRef);
    console.log(`Store ${storeId} successfully deleted.`);
};

/**
 * Menambah satu sesi opname baru ke Firestore.
 */
export const addOpnameSession = async (session: OpnameSession): Promise<void> => {
    console.log(`Adding opname session ${session.id} to Firestore...`);
    const sessionRef = doc(db, HISTORY_COLLECTION, session.id);
    await setDoc(sessionRef, session);
    console.log(`Opname session ${session.id} successfully added.`);
};

/**
 * Menghapus semua riwayat opname yang terkait dengan satu toko.
 * Menggunakan batch write untuk efisiensi.
 */
export const deleteOpnameHistoryForStore = async (storeId: string): Promise<void> => {
    console.log(`Deleting opname history for store ${storeId}...`);
    const q = query(collection(db, HISTORY_COLLECTION), where("storeId", "==", storeId));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
        console.log("No history to delete for this store.");
        return;
    }

    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`Successfully deleted ${snapshot.size} history records for store ${storeId}.`);
};
