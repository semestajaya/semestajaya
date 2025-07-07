
import React, { useState, useEffect, useMemo } from 'react';
import { Store, OpnameSession } from './types/data';
import { styles } from './styles';
import { HomePage } from './components/views/HomePage';
import { StoreDetailView } from './components/views/StoreDetailView';
import { StockOpnameView } from './components/views/StockOpnameView';
import { OpnameReportView } from './components/views/OpnameReportView';

// Kunci untuk menyimpan data di localStorage
const APP_STORAGE_KEY_STORES = 'manajemen-toko-app-stores';
const APP_STORAGE_KEY_HISTORY = 'manajemen-toko-app-history';

export const App = () => {
    // Memuat state dari localStorage saat komponen pertama kali dirender
    const [stores, setStores] = useState<Store[]>(() => {
        try {
            const savedStores = localStorage.getItem(APP_STORAGE_KEY_STORES);
            return savedStores ? JSON.parse(savedStores) : [];
        } catch (error) {
            console.error("Gagal memuat data toko dari localStorage:", error);
            return [];
        }
    });

    const [opnameHistory, setOpnameHistory] = useState<OpnameSession[]>(() => {
        try {
            const savedHistory = localStorage.getItem(APP_STORAGE_KEY_HISTORY);
            return savedHistory ? JSON.parse(savedHistory) : [];
        } catch (error) {
            console.error("Gagal memuat riwayat opname dari localStorage:", error);
            return [];
        }
    });

    const [view, setView] = useState<'home' | 'store-detail' | 'opname' | 'report'>('home');
    const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
    const [activeReport, setActiveReport] = useState<OpnameSession | null>(null);
    
    // Menyimpan data toko ke localStorage setiap kali ada perubahan
    useEffect(() => {
        try {
            localStorage.setItem(APP_STORAGE_KEY_STORES, JSON.stringify(stores));
        } catch (error) {
            console.error("Gagal menyimpan data toko ke localStorage:", error);
        }
    }, [stores]);

    // Menyimpan riwayat opname ke localStorage setiap kali ada perubahan
    useEffect(() => {
        try {
            localStorage.setItem(APP_STORAGE_KEY_HISTORY, JSON.stringify(opnameHistory));
        } catch (error) {
            console.error("Gagal menyimpan riwayat opname ke localStorage:", error);
        }
    }, [opnameHistory]);

    const selectedStore = useMemo(() => stores.find(s => s.id === selectedStoreId), [stores, selectedStoreId]);

    const handleSelectStore = (storeId: string) => { setSelectedStoreId(storeId); setView('store-detail'); };
    const handleBackToHome = () => { setSelectedStoreId(null); setView('home'); setActiveReport(null); };
    const handleStartOpname = () => { if (selectedStore) setView('opname'); };
    
    const handleOpnameComplete = (report: OpnameSession) => {
        setOpnameHistory(prev => [report, ...prev].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        setActiveReport(report);
        setView('report');
    };
    
    const handleStoreUpdate = (updatedStore: Store) => {
        setStores(prev => prev.map(s => s.id === updatedStore.id ? updatedStore : s));
    };

    const handleAddStore = (newStore: Store) => {
        setStores(prev => [...prev, newStore]);
    };

    const handleUpdateStoreInfo = (storeId: string, data: { name: string, address: string }) => {
        const storeToUpdate = stores.find(s => s.id === storeId);
        if(storeToUpdate) {
            const updatedStore = { ...storeToUpdate, ...data };
            setStores(prev => prev.map(s => s.id === storeId ? updatedStore : s));
        }
    };
    
    const handleOpnameCancel = () => setView('store-detail');
    const handleCloseReport = () => { setActiveReport(null); setView('store-detail'); };

    const handleDeleteStore = (storeIdToDelete: string) => {
        setStores(currentStores => currentStores.filter(store => store.id !== storeIdToDelete));
        setOpnameHistory(currentHistory => currentHistory.filter(session => session.storeId !== storeIdToDelete));
        if (selectedStoreId === storeIdToDelete) {
             handleBackToHome();
        }
    };

    const renderContent = () => {
        switch (view) {
            case 'store-detail':
                return selectedStore ? <StoreDetailView store={selectedStore} onStoreUpdate={handleStoreUpdate} onBack={handleBackToHome} onStartOpname={handleStartOpname} /> : <p>Toko tidak ditemukan.</p>;
            case 'opname':
                return selectedStore ? <StockOpnameView store={selectedStore} onStoreUpdate={handleStoreUpdate} onComplete={handleOpnameComplete} onCancel={handleOpnameCancel} /> : <p>Toko tidak ditemukan.</p>;
            case 'report':
                return activeReport ? <OpnameReportView report={activeReport} stores={stores} onClose={handleCloseReport} /> : <p>Laporan tidak ditemukan.</p>;
            case 'home':
            default:
                return <HomePage stores={stores} onAddStore={handleAddStore} onUpdateStore={handleUpdateStoreInfo} onSelectStore={handleSelectStore} onDeleteStore={handleDeleteStore} />;
        }
    };

    return (
        <div style={styles.app}>
            <header style={{...styles.appHeader}} className="responsive-header no-print">
                <h1 style={styles.appTitle} className="app-title-style">Aplikasi Manajemen Toko</h1>
            </header>
            <main style={styles.mainContent} className="responsive-padding">
                {renderContent()}
            </main>
        </div>
    );
};
