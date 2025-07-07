import localforage from 'localforage';

// Konfigurasi penyimpanan lokal
const storage = localforage.createInstance({
  name: "manajemen-toko",
  storeName: "toko_data"
});

// Fungsi CRUD dasar
export const saveData = async (key: string, data: any) => {
  await storage.setItem(key, data);
};

export const getData = async (key: string) => {
  return await storage.getItem(key);
};

export const removeData = async (key: string) => {
  await storage.removeItem(key);
};

export const clearAll = async () => {
  await storage.clear();
};