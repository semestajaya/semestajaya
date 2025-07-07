import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Store, OpnameSession } from './types/data';
import { styles } from './styles';
import { HomePage } from './components/views/HomePage';
import { StoreDetailView } from './components/views/StoreDetailView';
import { StockOpnameView } from './components/views/StockOpnameView';
import { OpnameReportView } from './components/views/OpnameReportView';
import { Storage } from '../utils/storage';

// Kunci penyimpanan
const KUNCI_PENYIMPANAN = {
  TOKO: 'manajemen-toko-data-toko',
  RIWAYAT: 'manajemen-toko-riwayat-opname'
};

export const App = () => {
  // State untuk data aplikasi
  const [toko, setToko] = useState<Store[]>([]);
  const [riwayatOpname, setRiwayatOpname] = useState<OpnameSession[]>([]);
  const [tampilan, setTampilan] = useState<'beranda' | 'detail-toko' | 'opname' | 'laporan'>('beranda');
  const [tokoTerpilihId, setTokoTerpilihId] = useState<string | null>(null);
  const [laporanAktif, setLaporanAktif] = useState<OpnameSession | null>(null);
  const [sedangMemuat, setSedangMemuat] = useState(true);

  // Memuat data awal saat komponen pertama kali render
  useEffect(() => {
    const muatDataAwal = async () => {
      try {
        const [dataToko, dataRiwayat] = await Promise.all([
          Storage.get<Store[]>(KUNCI_PENYIMPANAN.TOKO),
          Storage.get<OpnameSession[]>(KUNCI_PENYIMPANAN.RIWAYAT)
        ]);
        
        setToko(dataToko || []);
        setRiwayatOpname(dataRiwayat || []);
      } catch (error) {
        console.error("Gagal memuat data awal:", error);
      } finally {
        setSedangMemuat(false);
      }
    };

    muatDataAwal();
  }, []);

  // Menyimpan data toko ke penyimpanan saat berubah
  useEffect(() => {
    if (!sedangMemuat) {
      Storage.set(KUNCI_PENYIMPANAN.TOKO, toko)
        .catch(error => console.error("Gagal menyimpan data toko:", error));
    }
  }, [toko, sedangMemuat]);

  // Menyimpan riwayat opname ke penyimpanan saat berubah
  useEffect(() => {
    if (!sedangMemuat) {
      Storage.set(KUNCI_PENYIMPANAN.RIWAYAT, riwayatOpname)
        .catch(error => console.error("Gagal menyimpan riwayat opname:", error));
    }
  }, [riwayatOpname, sedangMemuat]);

  // Cari toko yang sedang dipilih
  const tokoTerpilih = useMemo(() => 
    toko.find(t => t.id === tokoTerpilihId), 
    [toko, tokoTerpilihId]
  );

  // Fungsi-fungsi handler
  const pilihToko = useCallback((idToko: string) => { 
    setTokoTerpilihId(idToko); 
    setTampilan('detail-toko'); 
  }, []);

  const kembaliKeBeranda = useCallback(() => { 
    setTokoTerpilihId(null); 
    setTampilan('beranda'); 
    setLaporanAktif(null); 
  }, []);

  const mulaiOpname = useCallback(() => { 
    if (tokoTerpilih) setTampilan('opname'); 
  }, [tokoTerpilih]);

  const selesaikanOpname = useCallback((laporan: OpnameSession) => {
    setRiwayatOpname(prev => [laporan, ...prev]
      .sort((a,b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()));
    setLaporanAktif(laporan);
    setTampilan('laporan');
  }, []);

  const perbaruiToko = useCallback((tokoDiperbarui: Store) => {
    setToko(prev => prev.map(t => t.id === tokoDiperbarui.id ? tokoDiperbarui : t));
  }, []);

  const tambahToko = useCallback((tokoBaru: Store) => {
    setToko(prev => [...prev, tokoBaru]);
  }, []);

  const perbaruiInfoToko = useCallback((idToko: string, data: { nama: string, alamat: string }) => {
    setToko(prev => prev.map(t => 
      t.id === idToko ? { ...t, ...data } : t
    ));
  }, []);

  const batalkanOpname = useCallback(() => setTampilan('detail-toko'), []);
  const tutupLaporan = useCallback(() => { 
    setLaporanAktif(null); 
    setTampilan('detail-toko'); 
  }, []);

  const hapusToko = useCallback((idTokoHapus: string) => {
    setToko(prev => prev.filter(toko => toko.id !== idTokoHapus));
    setRiwayatOpname(prev => prev.filter(sesi => sesi.tokoId !== idTokoHapus));
    if (tokoTerpilihId === idTokoHapus) {
      kembaliKeBeranda();
    }
  }, [tokoTerpilihId, kembaliKeBeranda]);

  // Render konten berdasarkan tampilan saat ini
  const renderKonten = () => {
    if (sedangMemuat) return <div style={styles.memuat}>Memuat data...</div>;

    switch (tampilan) {
      case 'detail-toko':
        return tokoTerpilih ? (
          <StoreDetailView 
            toko={tokoTerpilih} 
            onPerbaruiToko={perbaruiToko} 
            onKembali={kembaliKeBeranda} 
            onMulaiOpname={mulaiOpname} 
          />
        ) : <p style={styles.error}>Toko tidak ditemukan.</p>;

      case 'opname':
        return tokoTerpilih ? (
          <StockOpnameView 
            toko={tokoTerpilih} 
            onPerbaruiToko={perbaruiToko} 
            onSelesai={selesaikanOpname} 
            onBatal={batalkanOpname} 
          />
        ) : <p style={styles.error}>Toko tidak ditemukan.</p>;

      case 'laporan':
        return laporanAktif ? (
          <OpnameReportView 
            laporan={laporanAktif} 
            daftarToko={toko} 
            onTutup={tutupLaporan} 
          />
        ) : <p style={styles.error}>Laporan tidak ditemukan.</p>;

      case 'beranda':
      default:
        return (
          <HomePage 
            daftarToko={toko} 
            onTambahToko={tambahToko} 
            onPerbaruiToko={perbaruiInfoToko} 
            onPilihToko={pilihToko} 
            onHapusToko={hapusToko} 
          />
        );
    }
  };

  return (
    <div style={styles.aplikasi}>
      <header style={styles.headerAplikasi} className="header-responsif no-print">
        <h1 style={styles.judulAplikasi}>Aplikasi Manajemen Toko</h1>
      </header>
      <main style={styles.kontenUtama} className="padding-responsif">
        {renderKonten()}
      </main>
    </div>
  );
};