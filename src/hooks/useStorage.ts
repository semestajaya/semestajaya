import { useEffect, useState } from 'react';
import localforage from 'localforage';

// Konfigurasi localforage
const storage = localforage.createInstance({
  name: 'manajemen-toko',
  storeName: 'app_storage',
  driver: [
    localforage.INDEXEDDB,
    localforage.LOCALSTORAGE,
    localforage.WEBSQL
  ]
});

/**
 * Custom hook untuk manajemen penyimpanan lokal
 * @template T - Tipe data yang disimpan
 * @param {string} key - Kunci penyimpanan
 * @param {T} initialValue - Nilai awal
 * @returns {[T, (value: T) => Promise<void>, boolean]} - [nilai, setter, isLoading]
 */
export const useStorage = <T,>(key: string, initialValue: T) => {
  const [value, setValue] = useState<T>(initialValue);
  const [isLoading, setIsLoading] = useState(true);

  // Load data dari penyimpanan saat komponen mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const storedValue = await storage.getItem<T>(key);
        if (storedValue !== null) {
          setValue(storedValue);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [key]);

  // Simpan data ke penyimpanan
  const setStorageValue = async (newValue: T) => {
    try {
      setValue(newValue);
      await storage.setItem(key, newValue);
    } catch (error) {
      console.error('Error saving data:', error);
    }
  };

  // Hapus data dari penyimpanan
  const removeValue = async () => {
    try {
      setValue(initialValue);
      await storage.removeItem(key);
    } catch (error) {
      console.error('Error removing data:', error);
    }
  };

  return {
    value,
    setValue: setStorageValue,
    removeValue,
    isLoading,
    /**
     * Fungsi untuk mengupdate sebagian data (berguna untuk object/array)
     * @param {(prev: T) => T} updater - Fungsi update
     */
    updateValue: async (updater: (prev: T) => T) => {
      try {
        setValue(prev => {
          const newValue = updater(prev);
          storage.setItem(key, newValue);
          return newValue;
        });
      } catch (error) {
        console.error('Error updating data:', error);
      }
    }
  };
};

/**
 * Hook khusus untuk menyimpan array
 * @template T - Tipe item array
 */
export const useArrayStorage = <T,>(key: string, initialValue: T[] = []) => {
  const { value, setValue, ...rest } = useStorage<T[]>(key, initialValue);

  // Tambah item ke array
  const addItem = async (item: T) => {
    await setValue([...value, item]);
  };

  // Hapus item dari array
  const removeItem = async (index: number) => {
    const newArray = value.filter((_, i) => i !== index);
    await setValue(newArray);
  };

  // Update item di array
  const updateItem = async (index: number, newItem: T) => {
    const newArray = [...value];
    newArray[index] = newItem;
    await setValue(newArray);
  };

  return {
    items: value,
    addItem,
    removeItem,
    updateItem,
    setItems: setValue,
    ...rest
  };
};