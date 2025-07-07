import localforage from 'localforage';

class Penyimpanan {
  private static instance: localforage.LocalForage;

  static async init(): Promise<void> {
    this.instance = localforage.createInstance({
      name: 'manajemen-toko',
      storeName: 'data_aplikasi',
      driver: [
        localforage.INDEXEDDB,
        localforage.LOCALSTORAGE,
        localforage.WEBSQL
      ]
    });
    await this.instance.ready();
  }

  static async ambil<T>(kunci: string): Promise<T | null> {
    try {
      return await this.instance.getItem<T>(kunci);
    } catch (error) {
      console.error(`Gagal mengambil ${kunci}:`, error);
      return null;
    }
  }

  static async simpan<T>(kunci: string, nilai: T): Promise<boolean> {
    try {
      await this.instance.setItem(kunci, nilai);
      return true;
    } catch (error) {
      console.error(`Gagal menyimpan ${kunci}:`, error);
      return false;
    }
  }

  static async hapus(kunci: string): Promise<void> {
    await this.instance.removeItem(kunci);
  }

  static async bersihkan(): Promise<void> {
    await this.instance.clear();
  }
}

// Inisialisasi saat pertama kali diimpor
Penyimpanan.init();

export const Storage = Penyimpanan;