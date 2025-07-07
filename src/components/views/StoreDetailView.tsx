
import React, { useState, useCallback, useRef } from 'react';
import { Store } from '../../types/data';
import { styles } from '../../styles';
import { Dropdown } from '../common/Dropdown';
import { InfoModal } from '../common/Modals';
import { StoreItemsView } from '../store/StoreItemsView';
import { StoreAssetsView } from '../store/StoreAssetsView';
import { StoreCostsView } from '../store/StoreCostsView';
import { MoreVertIcon, PlayIcon, ImportIcon, ExportIcon } from '../common/Icons';

declare const XLSX: any;

const sanitizeFilename = (name: string): string => name.replace(/[/\\?%*:|"<>]/g, '-').trim();

interface StoreDetailViewProps {
    store: Store;
    onStoreUpdate: (store: Store) => void;
    onBack: () => void;
    onStartOpname: () => void;
}

export const StoreDetailView: React.FC<StoreDetailViewProps> = ({ store, onStoreUpdate, onBack, onStartOpname }) => {
    const [activeTab, setActiveTab] = useState('items');
    const [isImporting, setIsImporting] = useState(false);
    const [infoModal, setInfoModal] = useState({ isOpen: false, title: '', message: '' });
    const importFileRef = useRef<HTMLInputElement>(null);


    const handleExport = useCallback((type: 'current' | 'all') => {
        const sanitizedStoreName = sanitizeFilename(store.name);
        const wb = XLSX.utils.book_new();

        const createSheet = (dataType) => {
            let rawData, sheetName, headers;
            switch(dataType) {
                case 'items':
                    rawData = store.items.map(item => ({ 
                        'SKU': item.sku,
                        'Nama Barang': item.name, 
                        'Keterangan': item.description,
                        'Kategori': store.itemCategories.find(c=>c.id === item.categoryId)?.name ?? '',
                        'Satuan': store.units.find(u=>u.id === item.unitId)?.name ?? '',
                        'Stok Tercatat': store.inventory.find(inv => inv.itemId === item.id)?.recordedStock ?? 0,
                        'Harga Beli': item.purchasePrice,
                        'Harga Jual': item.sellingPrice
                    }));
                    sheetName = "Barang";
                    break;
                case 'assets':
                     rawData = store.assets.map(asset => ({
                        'Kode': asset.code,
                        'Nama Aset': asset.name,
                        'Keterangan': asset.description,
                        'Kategori': store.assetCategories.find(c => c.id === asset.categoryId)?.name ?? '',
                        'Kondisi': asset.condition,
                        'Tgl Perolehan': asset.purchaseDate, 
                        'Nilai': asset.value
                     }));
                    sheetName = "Aset";
                    break;
                case 'costs':
                    rawData = store.costs.map(c => ({ 
                        'Nama Biaya': c.name, 
                        'Keterangan': c.description, 
                        'Jumlah': c.amount, 
                        'Frekuensi': c.frequency 
                    }));
                    sheetName = "Biaya";
                    break;
                default: return;
            }

            if (rawData.length === 0) return;
            headers = Object.keys(rawData[0]);
            const activeColumns = headers.filter(header => rawData.some(row => row[header] !== null && row[header] !== undefined && row[header] !== ''));
            const dataToExport = rawData.map(row => {
                const newRow = {};
                activeColumns.forEach(header => { newRow[header] = row[header]; });
                return newRow;
            });
            
            return { ws: XLSX.utils.json_to_sheet(dataToExport, { header: activeColumns }), sheetName };
        };
        
        const exportOptions = { bookType: 'xlsx' as const, bookSST: false };

        if (type === 'all') {
            ['items', 'assets', 'costs'].forEach(tab => {
                const sheet = createSheet(tab);
                if(sheet) XLSX.utils.book_append_sheet(wb, sheet.ws, sheet.sheetName);
            });
            if (wb.SheetNames.length > 0) {
                 XLSX.writeFile(wb, `${sanitizedStoreName}-Semua Data.xlsx`, exportOptions);
            }
        } else {
            const currentSheet = createSheet(activeTab);
            if(currentSheet){
                XLSX.utils.book_append_sheet(wb, currentSheet.ws, currentSheet.sheetName);
                XLSX.writeFile(wb, `${sanitizedStoreName}-${currentSheet.sheetName}.xlsx`, exportOptions);
            }
        }
    }, [store, activeTab]);

    const handleFileImport = useCallback((event: React.ChangeEvent<HTMLInputElement>, type: 'current' | 'all') => {
        const file = event.target.files?.[0];
        if (!file) return;
        setIsImporting(true);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                
                let updated = 0;
                let added = 0;
                const targetStore = { ...store };

                const validConditions: Store['assets'][0]['condition'][] = ['Bagus', 'Normal', 'Rusak'];
                const validateCondition = (condStr: any): Store['assets'][0]['condition'] => {
                    const str = String(condStr || '').trim();
                    const found = validConditions.find(c => c.toLowerCase() === str.toLowerCase());
                    return found || 'Normal';
                };
                
                const generateId = (prefix: string) => `${prefix}${Date.now()}${Math.random().toString(36).substring(2, 6)}`;


                const processSheet = (sheetName: string) => {
                    const ws = workbook.Sheets[sheetName];
                    if (!ws) return;
                    const jsonData = XLSX.utils.sheet_to_json(ws, { cellDates: true });

                    if(sheetName.toLowerCase().includes('barang')) {
                        jsonData.forEach(row => {
                            let category = targetStore.itemCategories.find(c => c.name.toLowerCase() === (row['Kategori'] || '').toLowerCase());
                            if (!category && row['Kategori']) {
                                const prefix = row['Kategori'].substring(0,3).toUpperCase();
                                category = { id: generateId('IC'), name: row['Kategori'], prefix };
                                targetStore.itemCategories.push(category);
                            }
                            let unit = targetStore.units.find(u => u.name.toLowerCase() === (row['Satuan'] || '').toLowerCase());
                            if (!unit && row['Satuan']) {
                                unit = { id: generateId('U'), name: row['Satuan'] };
                                targetStore.units.push(unit);
                            }
                            
                            const existingItemIndex = targetStore.items.findIndex(i => i.sku === row['SKU']);
                            const itemData = {
                                name: row['Nama Barang'],
                                description: row['Keterangan'] || '',
                                categoryId: category?.id,
                                unitId: unit?.id,
                                purchasePrice: parseFloat(row['Harga Beli']) || 0,
                                sellingPrice: parseFloat(row['Harga Jual']) || 0,
                            };
                            
                            if (existingItemIndex > -1) {
                                const existingItem = targetStore.items[existingItemIndex];
                                targetStore.items[existingItemIndex] = { ...existingItem, ...itemData };
                                const invIndex = targetStore.inventory.findIndex(inv => inv.itemId === existingItem.id);
                                if (invIndex > -1) targetStore.inventory[invIndex].recordedStock = parseInt(row['Stok Tercatat']) || targetStore.inventory[invIndex].recordedStock;
                                updated++;
                            } else {
                                const newItem = {
                                    ...itemData,
                                    id: generateId(`${targetStore.id}-ITM`),
                                    sku: row['SKU'] || `${category?.prefix || 'BRG'}-${String(targetStore.items.length + 1).padStart(3, '0')}`
                                };
                                targetStore.items.push(newItem);
                                targetStore.inventory.push({ itemId: newItem.id, recordedStock: parseInt(row['Stok Tercatat']) || 0 });
                                added++;
                            }
                        });
                    } else if(sheetName.toLowerCase().includes('aset')) {
                         jsonData.forEach(row => {
                            let category = targetStore.assetCategories.find(c => c.name.toLowerCase() === (row['Kategori'] || '').toLowerCase());
                            if (!category && row['Kategori']) {
                                const prefix = row['Kategori'].substring(0,3).toUpperCase();
                                category = { id: generateId('AC'), name: row['Kategori'], prefix };
                                targetStore.assetCategories.push(category);
                            }

                            const purchaseDateValue = row['Tgl Perolehan'];
                            let formattedDate = new Date().toISOString().split('T')[0];
                            if (purchaseDateValue instanceof Date && !isNaN(purchaseDateValue.getTime())) {
                                formattedDate = purchaseDateValue.toISOString().split('T')[0];
                            } else if (typeof purchaseDateValue === 'string' && !isNaN(Date.parse(purchaseDateValue))) {
                                formattedDate = new Date(purchaseDateValue).toISOString().split('T')[0];
                            }

                            const existingAssetIndex = targetStore.assets.findIndex(a => a.code === row['Kode']);
                            const assetData = {
                                name: row['Nama Aset'],
                                description: row['Keterangan'] || '',
                                categoryId: category?.id,
                                purchaseDate: formattedDate,
                                value: parseFloat(row['Nilai']) || 0,
                                condition: validateCondition(row['Kondisi'])
                            };
                            if(existingAssetIndex > -1) {
                                targetStore.assets[existingAssetIndex] = { ...targetStore.assets[existingAssetIndex], ...assetData };
                                updated++;
                            } else {
                                targetStore.assets.push({ ...assetData, id: generateId(`${targetStore.id}-AST`), code: row['Kode'] || `${category?.prefix || 'AST'}-${String(targetStore.assets.length + 1).padStart(3, '0')}` });
                                added++;
                            }
                         });
                    } else if(sheetName.toLowerCase().includes('biaya')) {
                         jsonData.forEach(row => {
                            const existingCostIndex = targetStore.costs.findIndex(c => c.name.toLowerCase() === (row['Nama Biaya'] || '').toLowerCase());
                            const costData = {
                                name: row['Nama Biaya'],
                                description: row['Keterangan'] || '',
                                amount: parseFloat(row['Jumlah']) || 0,
                                frequency: (row['Frekuensi'] || 'bulanan').toLowerCase()
                            };
                            if (existingCostIndex > -1) {
                                targetStore.costs[existingCostIndex] = { ...targetStore.costs[existingCostIndex], ...costData };
                                updated++;
                            } else {
                                targetStore.costs.push({ ...costData, id: generateId(`${targetStore.id}-CST`) });
                                added++;
                            }
                         });
                    }
                };

                if(type === 'all') {
                    workbook.SheetNames.forEach(sheetName => processSheet(sheetName));
                } else {
                    const sheetMap = { items: 'barang', assets: 'aset', costs: 'biaya' };
                    const targetSheetName = sheetMap[activeTab];
                    const foundSheet = workbook.SheetNames.find(name => name.toLowerCase().includes(targetSheetName));
                    if(foundSheet) processSheet(foundSheet);
                }
                
                onStoreUpdate(targetStore);
                setInfoModal({ isOpen: true, title: 'Impor Berhasil', message: `${added} data ditambahkan, ${updated} data diperbarui.` });

            } catch (error) {
                console.error("Error importing file:", error);
                setInfoModal({ isOpen: true, title: 'Impor Gagal', message: 'Terjadi kesalahan saat memproses file Anda. Pastikan format file benar.' });
            } finally {
                setIsImporting(false);
                if (importFileRef.current) importFileRef.current.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    }, [store, onStoreUpdate, activeTab]);

    const triggerImport = (type: 'current' | 'all') => {
        if (importFileRef.current) {
            importFileRef.current.onchange = (e) => handleFileImport(e as any, type);
            importFileRef.current.click();
        }
    };

    const importMenuItems = [ 
        { label: 'Impor Tab Saat Ini', onClick: () => triggerImport('current') }, 
        { label: 'Impor Semua Data', onClick: () => triggerImport('all') },
    ];
    const exportMenuItems = [ 
        { label: 'Ekspor Tab Saat Ini', onClick: () => handleExport('current') }, 
        { label: 'Ekspor Semua Data', onClick: () => handleExport('all') }, 
    ];
    
    const mobileMenuItems = [
        { label: 'Mulai Cek', icon: <PlayIcon />, onClick: onStartOpname },
        { isSeparator: true },
        { label: 'Impor Tab Saat Ini', icon: <ImportIcon />, onClick: () => triggerImport('current') },
        { label: 'Ekspor Tab Saat Ini', icon: <ExportIcon />, onClick: () => handleExport('current') },
        { isSeparator: true },
        { label: 'Impor Semua Data', icon: <ImportIcon />, onClick: () => triggerImport('all') },
        { label: 'Ekspor Semua Data', icon: <ExportIcon />, onClick: () => handleExport('all') },
    ];

    const TABS = {
        items: { label: "Master Barang", component: <StoreItemsView store={store} onStoreUpdate={onStoreUpdate} /> },
        assets: { label: "Master Aset", component: <StoreAssetsView store={store} onStoreUpdate={onStoreUpdate} /> },
        costs: { label: "Master Biaya", component: <StoreCostsView store={store} onStoreUpdate={onStoreUpdate} /> },
    }

    return <>
        <InfoModal isOpen={infoModal.isOpen} onClose={() => setInfoModal({ ...infoModal, isOpen: false })} title={infoModal.title}>
            <p>{infoModal.message}</p>
        </InfoModal>

        <input type="file" ref={importFileRef} style={{ display: 'none' }} accept=".xlsx, .xls, .csv" />

        <div style={styles.headerActions} className="responsive-header-actions">
            <div>
                <button onClick={onBack} style={{...styles.button, ...styles.buttonOutline, marginBottom: '16px'}}>&#8592; Kembali ke Daftar Toko</button>
                <h2 style={{...styles.header, margin: 0}} className="header-style">{store.name}</h2>
                <p style={{...styles.pageDescription, margin: '4px 0 0 0'}} className="page-description-style">Kelola data master atau mulai stock opname.</p>
            </div>
        </div>
        
        <div className="tabs">
            {Object.entries(TABS).map(([key, {label}]) => (
                 <button key={key} className={`tab-button ${activeTab === key ? 'active' : ''}`} onClick={() => setActiveTab(key)}>
                    {label}
                </button>
            ))}
        </div>

        <div style={{ marginTop: '24px' }}>
            {TABS[activeTab].component}
        </div>
        
        <div style={{ ...styles.card, marginTop: '40px', padding: '20px', display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center' }} className="button-group-footer">
            <span style={{marginRight: 'auto', color: 'var(--text-secondary)', fontWeight: 600}}>Menu Aksi</span>
            {isImporting && <div className="spinner"></div>}
            <Dropdown trigger={<button style={{...styles.button, ...styles.buttonOutline}} disabled={isImporting}>Impor Data &#9662;</button>} menuItems={importMenuItems} />
            <Dropdown trigger={<button style={{...styles.button, ...styles.buttonOutline}}>Ekspor Data &#9662;</button>} menuItems={exportMenuItems} />
            <button onClick={onStartOpname} style={{...styles.button, ...styles.buttonSuccess}}>Mulai Cek</button>
        </div>
        
        <div className="fab-dropdown-container">
            <Dropdown
                trigger={
                    <button
                        style={{ ...styles.button, ...styles.buttonPrimary, borderRadius: '50%', width: '60px', height: '60px', padding: 0, justifyContent: 'center', boxShadow: 'var(--shadow-md)' }}
                        title="Menu Aksi"
                    >
                        <MoreVertIcon color="white" />
                    </button>
                }
                menuItems={mobileMenuItems}
                menuPositionStyle={{ bottom: 'calc(100% + 12px)', top: 'auto', right: 0 }}
            />
        </div>
    </>;
};
