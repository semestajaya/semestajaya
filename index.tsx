import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import * as db from './firebase'; // <-- Mengimpor fungsi database Firebase

declare const XLSX: any;
declare const html2canvas: any;
declare const jspdf: any;

// --- DATA INTERFACES ---
interface ItemCategory { id: string; name: string; prefix: string; }
interface Unit { id: string; name: string; }
interface AssetCategory { id: string; name: string; prefix: string; }

interface Item {
  id: string;
  name: string;
  sku: string;
  categoryId: string;
  unitId: string;
  purchasePrice: number;
  sellingPrice: number;
  description: string;
}

interface StoreInventory {
  itemId: string;
  recordedStock: number;
}

interface Asset {
    id: string;
    code: string;
    name: string;
    purchaseDate: string;
    value: number;
    categoryId: string;
    description: string;
    condition: 'Bagus' | 'Normal' | 'Rusak';
}

interface OperationalCost {
    id: string;
    name: string;
    amount: number;
    frequency: 'harian' | 'mingguan' | 'bulanan' | 'tahunan';
    description: string;
}

interface Store {
  id: string;
  name: string;
  address?: string;
  itemCategories: ItemCategory[];
  units: Unit[];
  assetCategories: AssetCategory[];
  items: Item[];
  inventory: StoreInventory[];
  assets: Asset[];
  costs: OperationalCost[];
}

interface OpnameSession {
  id: string;
  storeId: string;
  date: string;
  status: 'completed';
  items: {
    itemId: string;
    itemName: string;
    unit: string;
    initialStock: number;
    physicalCount: number;
    discrepancy: number;
  }[];
  assetChanges: {
    assetId: string;
    assetName: string;
    oldCondition: Asset['condition'];
    newCondition: Asset['condition'];
  }[];
}

// --- UTILITY FUNCTIONS ---
const generateId = (prefix: string) => `${prefix}${Date.now()}${Math.random().toString(36).substring(2, 6)}`;
const sanitizeFilename = (name: string): string => name.replace(/[/\\?%*:|"<>]/g, '-').trim();

// --- STYLES ---
const styles: { [key: string]: React.CSSProperties } = {
    app: { backgroundColor: 'var(--bg-main)', minHeight: '100vh' },
    appHeader: { backgroundColor: 'var(--bg-content)', padding: '16px 40px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    appTitle: { margin: 0, fontSize: '1.75rem', fontWeight: 800, color: 'var(--primary-color)' },
    mainContent: { padding: '40px' },
    header: { fontSize: '2.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px'},
    pageDescription: { fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '32px', maxWidth: '800px' },
    headerActions: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
    card: { backgroundColor: 'var(--bg-content)', padding: '24px', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', marginBottom: '24px' },
    storeGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' },
    storeCardTitle: { margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' },
    storeCardAddress: { margin: '4px 0 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { backgroundColor: '#f9fafb', padding: '12px 16px', borderBottom: '1px solid var(--border-color)', textAlign: 'left', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' },
    td: { padding: '16px', borderBottom: '1px solid var(--border-color)', verticalAlign: 'middle', color: 'var(--text-primary)' },
    button: { cursor: 'pointer', padding: '10px 20px', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '0.95rem', fontWeight: 600, transition: 'background-color 0.2s, box-shadow 0.2s', display: 'inline-flex', alignItems: 'center', gap: '8px' },
    buttonPrimary: { backgroundColor: 'var(--primary-color)', color: 'white' },
    buttonSecondary: { backgroundColor: 'var(--secondary-color)', color: 'white' },
    buttonDanger: { backgroundColor: 'var(--danger-color)', color: 'white' },
    buttonSuccess: { backgroundColor: 'var(--success-color)', color: 'white' },
    buttonOutline: { backgroundColor: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)'},
    buttonIcon: { padding: '10px', lineHeight: 1, gap: 0 },
    buttonIconSmall: { padding: '8px', lineHeight: 1, gap: 0 },
    input: { width: 'calc(100% - 24px)', padding: '12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: '1rem', transition: 'border-color 0.2s, box-shadow 0.2s' },
    select: { width: '100%', padding: '12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: '1rem', backgroundColor: 'white' },
    formGroup: { marginBottom: '20px' },
    formLabel: { display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--text-primary)' },
    inlineFlex: { display: 'flex', gap: '12px', alignItems: 'center' },
    opnameInput: { width: '80px', textAlign: 'center' },
    discrepancyPositive: { color: 'var(--success-color)', fontWeight: 'bold' },
    discrepancyNegative: { color: 'var(--danger-color)', fontWeight: 'bold' },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(17, 24, 39, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
    modalContent: { backgroundColor: 'var(--bg-content)', padding: '32px', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', width: '90%', maxWidth: '500px', overflowY: 'auto', maxHeight: '90vh' },
    modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
    modalTitle: { margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' },
    modalCloseButton: { background: 'none', border: 'none', fontSize: '1.75rem', cursor: 'pointer', color: 'var(--text-secondary)' },
    modalFooter: { marginTop: '32px', display: 'flex', justifyContent: 'flex-end', gap: '12px' },
};

// --- GENERIC COMPONENTS ---
const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div style={styles.modalOverlay} onClick={onClose}>
            <div style={{...styles.modalContent, width:'90%', maxWidth: '700px'}} onClick={e => e.stopPropagation()} className="modal-content-style">
                <div style={styles.modalHeader}>
                    <h3 style={styles.modalTitle} className="modal-title">{title}</h3>
                    <button onClick={onClose} style={styles.modalCloseButton}>&times;</button>
                </div>
                {children}
            </div>
        </div>
    );
};

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, children, confirmText = 'Hapus', confirmButtonStyle = styles.buttonDanger }) => {
    if (!isOpen) return null;
    return (
        <div style={styles.modalOverlay} onClick={onClose}>
            <div style={styles.modalContent} onClick={e => e.stopPropagation()} className="modal-content-style">
                <div style={styles.modalHeader}>
                    <h3 style={styles.modalTitle} className="modal-title">{title}</h3>
                    <button onClick={onClose} style={styles.modalCloseButton}>&times;</button>
                </div>
                <div style={{color: 'var(--text-secondary)'}}>{children}</div>
                <div style={styles.modalFooter} className="modal-footer-style">
                    <button onClick={onClose} style={{...styles.button, ...styles.buttonOutline}}>Batal</button>
                    <button onClick={onConfirm} style={{...styles.button, ...confirmButtonStyle}}>{confirmText}</button>
                </div>
            </div>
        </div>
    );
};

const InfoModal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
     return (
        <div style={styles.modalOverlay} onClick={onClose}>
            <div style={styles.modalContent} onClick={e => e.stopPropagation()} className="modal-content-style">
                <div style={styles.modalHeader}>
                    <h3 style={styles.modalTitle} className="modal-title">{title}</h3>
                    <button onClick={onClose} style={styles.modalCloseButton}>&times;</button>
                </div>
                 <div style={{color: 'var(--text-secondary)'}}>{children}</div>
                <div style={styles.modalFooter} className="modal-footer-style">
                    <button onClick={onClose} style={{...styles.button, ...styles.buttonPrimary}}>OK</button>
                </div>
            </div>
        </div>
    );
};

const Dropdown = ({ trigger, menuItems, menuPositionStyle = {} }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const handleTriggerClick = (e) => { e.stopPropagation(); setIsOpen(prev => !prev); };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) { setIsOpen(false); }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const menuBaseStyle: React.CSSProperties = {
        position: 'absolute',
        right: 0,
        top: 'calc(100% + 8px)',
        backgroundColor: 'var(--bg-content)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-md)',
        zIndex: 10,
        minWidth: '240px',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
        listStyle: 'none',
        padding: '8px 0',
        margin: 0,
    };

    return (
        <div style={{ position: 'relative' }} ref={dropdownRef}>
            {React.cloneElement(trigger, { onClick: handleTriggerClick, 'aria-haspopup': true, 'aria-expanded': isOpen })}
            {isOpen && (
                <ul style={{ ...menuBaseStyle, ...menuPositionStyle }}>
                    {menuItems.map((item, index) => {
                         if (item.isSeparator) {
                            return <li key={`sep-${index}`}><hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '8px 0' }} /></li>;
                        }
                        return (
                        <li key={index}>
                            <button
                              onClick={() => { if(item.onClick) item.onClick(); setIsOpen(false); }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                width: '100%',
                                padding: '10px 16px',
                                textAlign: 'left',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '0.95rem',
                                color: 'var(--text-primary)',
                              }}
                              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                {item.icon && <span style={{ marginRight: '12px', display: 'flex', alignItems: 'center' }}>{item.icon}</span>}
                                {item.label}
                            </button>
                        </li>
                    )})}
                </ul>
            )}
        </div>
    );
};

// --- ICON COMPONENTS ---
const PlusIcon = ({ size = 20 }) => (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
);

const PencilIcon = ({ size = 18 }) => (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
    </svg>
);

const TrashIcon = ({ size = 18 }) => (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        <line x1="10" y1="11" x2="10" y2="17"></line>
        <line x1="14" y1="11" x2="14" y2="17"></line>
    </svg>
);

const MoreVertIcon = ({ size = 24, color = 'white' }) => (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"></path>
    </svg>
);

const ImportIcon = ({ size = 18 }) => (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
);

const ExportIcon = ({ size = 18 }) => (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="17 8 12 3 7 8"></polyline>
        <line x1="12" y1="3" x2="12" y2="15"></line>
    </svg>
);

const PlayIcon = ({ size = 18 }) => (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
    </svg>
);


// --- HOME PAGE ---
const HomePage = ({ stores, onSelectStore, onAddStore, onUpdateStore, onDeleteStore }) => {
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingStore, setEditingStore] = useState<Store | null>(null);
    const [formData, setFormData] = useState({ name: '', address: '' });
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    
    const [confirmDelete, setConfirmDelete] = useState<Store | null>(null);

    useEffect(() => {
        if (isFormModalOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isFormModalOpen]);

    const handleOpenAddModal = () => {
        setEditingStore(null);
        setFormData({ name: '', address: '' });
        setIsFormModalOpen(true);
    };

    const handleOpenEditModal = (store: Store) => {
        setEditingStore(store);
        setFormData({ name: store.name, address: store.address || '' });
        setIsFormModalOpen(true);
    };

    const handleCloseModal = () => {
        if (isSaving) return;
        setIsFormModalOpen(false);
        setEditingStore(null);
        setFormData({ name: '', address: '' });
        setError('');
    };

    const handleSaveStore = async () => {
        if (!formData.name.trim()) {
            setError('Nama toko tidak boleh kosong.');
            return;
        }
        setIsSaving(true);

        try {
            if (editingStore) {
                await onUpdateStore(editingStore.id, { name: formData.name.trim(), address: formData.address.trim() || '' });
            } else {
                const newStore: Store = { 
                    id: generateId('TKO'), 
                    name: formData.name.trim(),
                    address: formData.address.trim() || '',
                    items: [], inventory: [], assets: [], costs: [],
                    itemCategories: [], units: [], assetCategories: []
                };
                await onAddStore(newStore);
            }
            handleCloseModal();
        } catch (err) {
            console.error("Failed to save store:", err);
            setError("Gagal menyimpan toko. Periksa koneksi Anda.");
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleConfirmDelete = async () => {
        if(confirmDelete) {
            await onDeleteStore(confirmDelete.id);
            setConfirmDelete(null);
        }
    };


    return (
        <>
            <ConfirmModal 
                isOpen={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={handleConfirmDelete}
                title={`Hapus Toko "${confirmDelete?.name}"?`}
            >
                <p>Yakin ingin menghapus toko ini? Semua data barang, aset, biaya, dan riwayat opname terkait akan hilang selamanya.</p>
            </ConfirmModal>

            <Modal isOpen={isFormModalOpen} onClose={handleCloseModal} title={editingStore ? 'Edit Toko' : 'Tambah Toko Baru'}>
                <div style={styles.formGroup}>
                    <label htmlFor="store-name" style={styles.formLabel}>Nama Toko</label>
                    <input 
                        ref={inputRef} 
                        style={styles.input} 
                        type="text" 
                        id="store-name" 
                        value={formData.name} 
                        onChange={e => setFormData({ ...formData, name: e.target.value })} 
                        placeholder="cth: Toko Sejahtera Abadi" 
                        disabled={isSaving}
                    />
                    {error && <p style={{color: 'var(--danger-color)', fontSize: '0.875rem', marginTop: '8px'}}>{error}</p>}
                </div>
                 <div style={styles.formGroup}>
                    <label htmlFor="store-address" style={styles.formLabel}>Alamat</label>
                    <textarea 
                        id="store-address" 
                        style={{...styles.input, height: '80px', resize: 'vertical'}} 
                        value={formData.address} 
                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                        placeholder="cth: Jl. Merdeka No. 45, Bandung"
                        disabled={isSaving}
                    />
                </div>
                <div style={styles.modalFooter} className="modal-footer-style">
                    <button onClick={handleCloseModal} style={{...styles.button, ...styles.buttonOutline}} disabled={isSaving}>Batal</button>
                    <button onClick={handleSaveStore} style={{...styles.button, ...styles.buttonPrimary}} disabled={isSaving}>
                         {isSaving && <div className="spinner"></div>}
                        {isSaving ? 'Menyimpan...' : (editingStore ? 'Simpan Perubahan' : 'Simpan Toko')}
                    </button>
                </div>
            </Modal>

            <div style={styles.headerActions} className="responsive-header-actions">
                <div>
                    <h2 style={{...styles.header, margin: 0}} className="header-style">Daftar Toko</h2>
                    <p style={{...styles.pageDescription, margin: '4px 0 0 0'}} className="page-description-style">Pilih toko untuk mengelola data atau memulai stock opname.</p>
                </div>
                <button onClick={handleOpenAddModal} style={{...styles.button, ...styles.buttonPrimary, ...styles.buttonIcon}} title="Tambah Toko Baru">
                    <PlusIcon />
                </button>
            </div>
            <div style={styles.storeGrid}>
                {stores.length > 0 ? stores.map(store => {
                     const menuItems = [
                        { label: 'Edit Toko', icon: <PencilIcon size={16} />, onClick: () => handleOpenEditModal(store) },
                        { label: 'Hapus Toko', icon: <TrashIcon size={16} />, onClick: () => setConfirmDelete(store) },
                     ];
                    return (
                     <div
                        key={store.id}
                        className="store-card"
                     >
                        <div style={{ flexGrow: 1, paddingRight: '16px', cursor: 'pointer' }} onClick={() => onSelectStore(store.id)}>
                            <h3 style={styles.storeCardTitle}>{store.name}</h3>
                            {store.address && <p style={styles.storeCardAddress}>{store.address}</p>}
                        </div>
                         <Dropdown 
                            trigger={
                                <button
                                    style={{
                                        ...styles.button,
                                        ...styles.buttonOutline,
                                        ...styles.buttonIconSmall,
                                        alignSelf: 'center',
                                        borderColor: 'transparent',
                                        background: 'transparent'
                                    }}
                                    title="Opsi"
                                >
                                    <MoreVertIcon size={20} color="var(--text-secondary)" />
                                </button>
                            }
                            menuItems={menuItems}
                            menuPositionStyle={{ minWidth: '180px' }}
                         />
                    </div>
                )}) : <p>Belum ada toko. Silakan tambahkan toko baru.</p>}
            </div>
        </>
    );
};

// --- GENERIC MASTER DATA VIEW ---
const MasterDataView = ({ title, data, columns, onSave, onDelete, formInputs, emptyForm, usageCheck, itemType }) => {
    const [editingItem, setEditingItem] = useState(null);
    const [isAdding, setIsAdding] = useState(false);
    const [formData, setFormData] = useState(emptyForm);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [infoMessage, setInfoMessage] = useState('');
    const formRef = useRef<HTMLDivElement>(null);
    const firstInputRef = useRef<HTMLInputElement>(null);

    const showForm = isAdding || editingItem !== null;

    useEffect(() => { if (editingItem) { setFormData(editingItem); setIsAdding(false); } }, [editingItem]);
    useEffect(() => { if (showForm) { formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => firstInputRef.current?.focus(), 300); } }, [showForm]);

    const handleCancel = () => { setIsAdding(false); setEditingItem(null); setFormData(emptyForm); };
    const handleSave = (e) => { e.preventDefault(); onSave(formData, editingItem); handleCancel(); };
    
    const handleDeleteClick = (itemId: string) => {
        if (usageCheck && usageCheck(itemId)) {
             setInfoMessage(`Tidak bisa menghapus. ${itemType} ini sedang digunakan oleh data lain.`);
             return;
        }
        setDeletingId(itemId);
        setIsConfirmOpen(true);
    };

    const handleConfirmDelete = () => {
        if(deletingId) onDelete(deletingId);
        setIsConfirmOpen(false);
        setDeletingId(null);
    };

    return <>
        <InfoModal isOpen={!!infoMessage} onClose={() => setInfoMessage('')} title="Operasi Ditolak">{infoMessage}</InfoModal>
        <ConfirmModal isOpen={isConfirmOpen} onClose={() => setIsConfirmOpen(false)} onConfirm={handleConfirmDelete} title={`Hapus ${itemType}?`}>
            <p>Apakah Anda yakin ingin menghapus {itemType} ini? Tindakan ini tidak dapat diurungkan.</p>
        </ConfirmModal>

        <div style={{ ...styles.headerActions, marginBottom: '16px' }} className="responsive-header-actions">
            <h3 style={{ marginTop: 0, marginBottom: 0, fontSize: '1.25rem' }}>{title}</h3>
            {!showForm && 
                <button onClick={() => setIsAdding(true)} style={{ ...styles.button, ...styles.buttonPrimary, ...styles.buttonIcon }} title={`Tambah ${itemType} Baru`}>
                    <PlusIcon />
                </button>
            }
        </div>
        {showForm &&
            <div ref={formRef} style={styles.card}>
                <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '1.25rem' }}>{editingItem ? `Edit ${itemType}` : `Tambah ${itemType} Baru`}</h3>
                <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: `repeat(${formInputs.length}, 1fr) auto auto`, gap: '16px', alignItems: 'flex-end' }} className="responsive-form-grid">
                    {formInputs.map((input, index) => {
                        const inputId = `form-${input.key}-${editingItem?.id || 'new'}`;
                        return (
                            <div key={input.key}>
                                <label htmlFor={inputId} style={styles.formLabel}>{input.label}</label>
                                <input id={inputId} ref={index === 0 ? firstInputRef : null} style={styles.input} type={input.type || 'text'} value={formData[input.key] || ''} onChange={e => setFormData({ ...formData, [input.key]: e.target.value })} required />
                            </div>
                        )
                    })}
                    <div><button type="submit" style={{ ...styles.button, ...styles.buttonPrimary }}>{editingItem ? 'Simpan' : 'Tambah'}</button></div>
                    <div><button type="button" onClick={handleCancel} style={{ ...styles.button, ...styles.buttonOutline }}>Batal</button></div>
                </form>
            </div>
        }
        <div className="responsive-table-wrapper">
            <table style={styles.table}>
                <thead><tr>{columns.map(c => <th key={c.key} style={styles.th}>{c.label}</th>)}<th style={styles.th}>Aksi</th></tr></thead>
                <tbody>
                    {data.map(item => (
                        <tr key={item.id}>
                            {columns.map(c => <td key={c.key} style={styles.td}>{item[c.key]}</td>)}
                            <td style={styles.td}><div style={styles.inlineFlex} className="responsive-inline-flex">
                                <button onClick={() => setEditingItem(item)} style={{ ...styles.button, ...styles.buttonPrimary, ...styles.buttonIconSmall }} title={`Edit ${itemType}`}>
                                    <PencilIcon />
                                </button>
                                <button onClick={() => handleDeleteClick(item.id)} style={{ ...styles.button, ...styles.buttonDanger, ...styles.buttonIconSmall }} title={`Hapus ${itemType}`}>
                                    <TrashIcon />
                                </button>
                            </div></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </>;
};

// --- STORE DETAIL SUB-VIEWS ---
const StoreItemsView = ({ store, onStoreUpdate }) => {
    const emptyForm = { name: '', categoryId: '', unitId: '', purchasePrice: '', sellingPrice: '', description: '', initialStock: '' };
    const [editingItem, setEditingItem] = useState<Item | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [formData, setFormData] = useState(emptyForm);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const formRef = useRef<HTMLDivElement>(null);
    const firstInputRef = useRef<HTMLInputElement>(null);

    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);

    const showForm = isAdding || editingItem !== null;

    useEffect(() => {
        if (editingItem) { 
            setFormData({ 
                ...editingItem, 
                purchasePrice: String(editingItem.purchasePrice), 
                sellingPrice: String(editingItem.sellingPrice),
                description: editingItem.description || '',
                initialStock: ''
            }); 
            setIsAdding(false); 
        }
    }, [editingItem]);
    
    useEffect(() => {
        if (showForm) {
            formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => firstInputRef.current?.focus(), 300);
        }
    }, [showForm, editingItem]);
    
    const handleCancel = () => { setIsAdding(false); setEditingItem(null); setFormData(emptyForm); };

    const handleSave = (e) => {
        e.preventDefault();
        const { name, categoryId, unitId, purchasePrice, sellingPrice, description, initialStock } = formData;
        const pp = parseFloat(purchasePrice);
        const sp = parseFloat(sellingPrice);
        
        if (!name || !categoryId || !unitId || isNaN(pp) || isNaN(sp)) return alert('Semua field harus diisi dengan benar.');

        const itemData = { name, categoryId, unitId, purchasePrice: pp, sellingPrice: sp, description };
        let updatedStore = { ...store };

        if (editingItem) {
            const updatedItems = store.items.map(item => item.id === editingItem.id ? { ...item, ...itemData } : item);
            updatedStore.items = updatedItems;
        } else {
            const stock = parseInt(initialStock, 10) || 0;
            const category = store.itemCategories.find(c => c.id === categoryId);
            const prefix = category?.prefix || 'BRG';
            const count = store.items.filter(i => i.categoryId === categoryId).length + 1;
            const sku = `${prefix}-${String(count).padStart(3, '0')}`;
            
            const newItem = { ...itemData, id: generateId(`${store.id}-ITM`), sku };
            updatedStore.items = [...store.items, newItem];
            updatedStore.inventory = [...store.inventory, { itemId: newItem.id, recordedStock: stock }];
        }
        onStoreUpdate(updatedStore);
        handleCancel();
    };

    const handleDeleteClick = (itemId: string) => {
        setDeletingId(itemId);
        setIsConfirmOpen(true);
    };

    const handleConfirmDelete = () => {
        if (!deletingId) return;
        const updatedItems = store.items.filter(item => item.id !== deletingId);
        const updatedInventory = store.inventory.filter(inv => inv.itemId !== deletingId);
        onStoreUpdate({ ...store, items: updatedItems, inventory: updatedInventory });
        setIsConfirmOpen(false);
        setDeletingId(null);
    };

    const handleSaveCategory = (formData, editingItem) => {
        if (!formData.name || !formData.prefix) return alert('Nama dan Prefix harus diisi.');
        const updatedCategories = editingItem
            ? store.itemCategories.map(c => c.id === editingItem.id ? { ...c, ...formData } : c)
            : [...store.itemCategories, { ...formData, id: generateId('IC') }];
        onStoreUpdate({ ...store, itemCategories: updatedCategories });
    };
    const handleDeleteCategory = (id) => {
        const updatedCategories = store.itemCategories.filter(c => c.id !== id);
        onStoreUpdate({ ...store, itemCategories: updatedCategories });
    };

    const handleSaveUnit = (formData, editingItem) => {
        if (!formData.name) return alert('Nama Satuan harus diisi.');
        const updatedUnits = editingItem
            ? store.units.map(u => u.id === editingItem.id ? { ...u, ...formData } : u)
            : [...store.units, { ...formData, id: generateId('U') }];
        onStoreUpdate({ ...store, units: updatedUnits });
    };
    const handleDeleteUnit = (id) => {
        const updatedUnits = store.units.filter(u => u.id !== id);
        onStoreUpdate({ ...store, units: updatedUnits });
    };

    const itemsWithDetails = useMemo(() => {
        return store.items.map(item => ({
            ...item,
            categoryName: store.itemCategories.find(c => c.id === item.categoryId)?.name ?? 'N/A',
            unitName: store.units.find(u => u.id === item.unitId)?.name ?? 'N/A',
            recordedStock: store.inventory.find(inv => inv.itemId === item.id)?.recordedStock ?? 0
        })).sort((a,b) => a.sku.localeCompare(b.sku));
    }, [store]);

    return <>
        <ConfirmModal isOpen={isConfirmOpen} onClose={() => setIsConfirmOpen(false)} onConfirm={handleConfirmDelete} title="Hapus Barang?">
            <p>Yakin ingin menghapus barang ini? Stok terkait juga akan dihapus. Tindakan ini tidak dapat diurungkan.</p>
        </ConfirmModal>

        <Modal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} title="Kelola Kategori Barang">
            <MasterDataView title="" itemType="Kategori Barang" data={store.itemCategories}
                columns={[{ key: 'name', label: 'Nama Kategori' }, { key: 'prefix', label: 'Prefix SKU' }]}
                onSave={handleSaveCategory} onDelete={handleDeleteCategory}
                formInputs={[{ key: 'name', label: 'Nama Kategori' }, { key: 'prefix', label: 'Prefix SKU (3 Huruf)' }]}
                emptyForm={{ name: '', prefix: '' }}
                usageCheck={(id) => store.items.some(item => item.categoryId === id)}
            />
        </Modal>

        <Modal isOpen={isUnitModalOpen} onClose={() => setIsUnitModalOpen(false)} title="Kelola Satuan Barang">
            <MasterDataView title="" itemType="Satuan" data={store.units}
                columns={[{ key: 'name', label: 'Nama Satuan' }]}
                onSave={handleSaveUnit} onDelete={handleDeleteUnit}
                formInputs={[{ key: 'name', label: 'Nama Satuan' }]}
                emptyForm={{ name: '' }}
                usageCheck={(id) => store.items.some(item => item.unitId === id)}
            />
        </Modal>

        <div style={{...styles.headerActions, marginBottom: '16px'}} className="responsive-header-actions">
            <h3 style={{marginTop: 0, marginBottom: 0, fontSize: '1.25rem'}}>Daftar Barang</h3>
            {!showForm && 
                <button onClick={() => setIsAdding(true)} style={{...styles.button, ...styles.buttonPrimary, ...styles.buttonIcon}} title="Tambah Barang Baru">
                    <PlusIcon />
                </button>
            }
        </div>

        {showForm &&
            <div ref={formRef} style={styles.card}>
                <h3 style={{marginTop: 0, marginBottom: '20px', fontSize: '1.25rem'}}>{editingItem ? 'Edit Barang' : 'Tambah Barang Baru'}</h3>
                <form onSubmit={handleSave}>
                    <div style={{display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px', marginBottom: '16px'}} className="responsive-form-grid">
                        <div>
                            <label htmlFor="item-name" style={styles.formLabel}>Nama Barang</label>
                            <input id="item-name" ref={firstInputRef} style={styles.input} type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                        </div>
                        <div>
                            <div style={{...styles.inlineFlex, justifyContent: 'space-between', marginBottom: '8px'}}>
                                <label htmlFor="item-category" style={{...styles.formLabel, marginBottom: 0}}>Kategori</label>
                                <button type="button" onClick={() => setIsCategoryModalOpen(true)} style={{...styles.button, ...styles.buttonOutline, padding: '4px 10px', fontSize: '0.8rem'}}>Kelola</button>
                            </div>
                            <select id="item-category" style={styles.select} value={formData.categoryId} onChange={e => setFormData({ ...formData, categoryId: e.target.value })} required><option value="" disabled>Pilih Kategori</option>{store.itemCategories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
                        </div>
                        <div>
                             <div style={{...styles.inlineFlex, justifyContent: 'space-between', marginBottom: '8px'}}>
                                <label htmlFor="item-unit" style={{...styles.formLabel, marginBottom: 0}}>Satuan</label>
                                <button type="button" onClick={() => setIsUnitModalOpen(true)} style={{...styles.button, ...styles.buttonOutline, padding: '4px 10px', fontSize: '0.8rem'}}>Kelola</button>
                            </div>
                            <select id="item-unit" style={styles.select} value={formData.unitId} onChange={e => setFormData({ ...formData, unitId: e.target.value })} required><option value="" disabled>Pilih Satuan</option>{store.units.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select>
                        </div>
                    </div>
                    <div style={{display: 'grid', gridTemplateColumns: editingItem ? '1fr 1fr' : '1fr 1fr 1fr', gap: '16px', marginBottom: '16px'}} className="responsive-form-grid">
                        <div><label htmlFor="item-purchase-price" style={styles.formLabel}>Harga Beli (Rp)</label><input id="item-purchase-price" style={styles.input} type="number" value={formData.purchasePrice} onChange={e => setFormData({ ...formData, purchasePrice: e.target.value })} required /></div>
                        <div><label htmlFor="item-selling-price" style={styles.formLabel}>Harga Jual (Rp)</label><input id="item-selling-price" style={styles.input} type="number" value={formData.sellingPrice} onChange={e => setFormData({ ...formData, sellingPrice: e.target.value })} required /></div>
                        {!editingItem && (
                            <div>
                                <label htmlFor="item-initial-stock" style={styles.formLabel}>Stok Awal</label>
                                <input id="item-initial-stock" style={styles.input} type="number" value={formData.initialStock} onChange={e => setFormData({ ...formData, initialStock: e.target.value })} required min="0" />
                            </div>
                        )}
                    </div>
                    <div style={{marginBottom: '24px'}}>
                        <label htmlFor="item-description" style={styles.formLabel}>Keterangan</label>
                        <textarea id="item-description" style={{...styles.input, height: '80px', resize: 'vertical'}} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                    </div>
                    <div style={{display: 'flex', justifyContent: 'flex-end', gap: '12px'}} className="responsive-inline-flex">
                        <button type="submit" style={{...styles.button, ...styles.buttonPrimary}}>{editingItem ? 'Simpan' : 'Tambah'}</button>
                        <button type="button" onClick={handleCancel} style={{ ...styles.button, ...styles.buttonOutline }}>Batal</button>
                    </div>
                </form>
            </div>
        }
        <div className="responsive-table-wrapper">
            <table style={styles.table}>
                <thead><tr><th style={styles.th}>SKU</th><th style={styles.th}>Nama Barang</th><th style={styles.th}>Keterangan</th><th style={styles.th}>Kategori</th><th style={styles.th}>Stok</th><th style={styles.th}>Satuan</th><th style={styles.th}>Harga Beli</th><th style={styles.th}>Harga Jual</th><th style={styles.th}>Aksi</th></tr></thead>
                <tbody>
                    {itemsWithDetails.map(item => (
                        <tr key={item.id}>
                            <td style={styles.td}>{item.sku}</td>
                            <td style={styles.td}>{item.name}</td>
                            <td style={styles.td}>{item.description}</td>
                            <td style={styles.td}>{item.categoryName}</td>
                            <td style={styles.td}>{item.recordedStock}</td>
                            <td style={styles.td}>{item.unitName}</td>
                            <td style={styles.td}>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(item.purchasePrice)}</td>
                            <td style={styles.td}>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(item.sellingPrice)}</td>
                            <td style={styles.td}><div style={styles.inlineFlex} className="responsive-inline-flex">
                                <button onClick={() => setEditingItem(item)} style={{...styles.button, ...styles.buttonPrimary, ...styles.buttonIconSmall}} title="Edit Barang">
                                    <PencilIcon />
                                </button>
                                <button onClick={() => handleDeleteClick(item.id)} style={{...styles.button, ...styles.buttonDanger, ...styles.buttonIconSmall}} title="Hapus Barang">
                                    <TrashIcon />
                                </button>
                            </div></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </>;
};

const StoreAssetsView = ({ store, onStoreUpdate }) => {
    const emptyForm: { [key: string]: any } = { name: '', purchaseDate: '', value: '', categoryId: '', description: '', condition: 'Normal' as Asset['condition'] };
    const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [formData, setFormData] = useState(emptyForm);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const formRef = useRef<HTMLDivElement>(null);
    const firstInputRef = useRef<HTMLInputElement>(null);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

    const showForm = isAdding || editingAsset !== null;

    useEffect(() => {
        if (editingAsset) { 
            setFormData({ ...editingAsset, value: String(editingAsset.value), description: editingAsset.description || '', condition: editingAsset.condition || 'Normal' }); 
            setIsAdding(false); 
        }
    }, [editingAsset]);

    useEffect(() => {
        if (showForm) {
            formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => firstInputRef.current?.focus(), 300);
        }
    }, [showForm]);

    const handleCancel = () => { setIsAdding(false); setEditingAsset(null); setFormData(emptyForm); };

    const handleSave = (e) => {
        e.preventDefault();
        const valueNum = parseFloat(formData.value);
        if (!formData.name || !formData.purchaseDate || !formData.categoryId || isNaN(valueNum)) return alert('Semua field harus diisi dengan benar.');
        
        const assetData = { 
            name: formData.name, 
            purchaseDate: formData.purchaseDate, 
            value: valueNum, 
            categoryId: formData.categoryId, 
            description: formData.description,
            condition: formData.condition
        };
        let updatedStore = { ...store };
            
        if (editingAsset) {
            const updatedAssets = store.assets.map(a => a.id === editingAsset.id ? { ...a, ...assetData } : a);
            updatedStore.assets = updatedAssets;
        } else {
            const category = store.assetCategories.find(c => c.id === formData.categoryId);
            const prefix = category?.prefix || 'AST';
            const count = store.assets.filter(i => i.categoryId === formData.categoryId).length + 1;
            const code = `${prefix}-${String(count).padStart(3, '0')}`;
            updatedStore.assets = [...store.assets, { ...assetData, id: generateId(`${store.id}-AST`), code }];
        }
        onStoreUpdate(updatedStore);
        handleCancel();
    };

    const handleDeleteClick = (assetId: string) => {
        setDeletingId(assetId);
        setIsConfirmOpen(true);
    };

    const handleConfirmDelete = () => {
        if (!deletingId) return;
        const updatedAssets = store.assets.filter(a => a.id !== deletingId);
        onStoreUpdate({ ...store, assets: updatedAssets });
        setIsConfirmOpen(false);
        setDeletingId(null);
    };

    const handleSaveAssetCategory = (formData, editingItem) => {
        if (!formData.name || !formData.prefix) return alert('Nama dan Prefix harus diisi.');
        const updatedCategories = editingItem
            ? store.assetCategories.map(c => c.id === editingItem.id ? { ...c, ...formData } : c)
            : [...store.assetCategories, { ...formData, id: generateId('AC') }];
        onStoreUpdate({ ...store, assetCategories: updatedCategories });
    };

    const handleDeleteAssetCategory = (id) => {
        const updatedCategories = store.assetCategories.filter(c => c.id !== id);
        onStoreUpdate({ ...store, assetCategories: updatedCategories });
    };

    const assetsWithDetails = useMemo(() => {
        return store.assets.map(asset => ({
            ...asset,
            categoryName: store.assetCategories.find(c => c.id === asset.categoryId)?.name ?? 'N/A',
        })).sort((a,b) => a.code.localeCompare(b.code));
    }, [store]);
    
    return <>
        <ConfirmModal isOpen={isConfirmOpen} onClose={() => setIsConfirmOpen(false)} onConfirm={handleConfirmDelete} title="Hapus Aset?">
            <p>Yakin ingin menghapus aset ini? Tindakan ini tidak dapat diurungkan.</p>
        </ConfirmModal>

        <Modal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} title="Kelola Kategori Aset">
            <MasterDataView title="" itemType="Kategori Aset" data={store.assetCategories}
                columns={[{ key: 'name', label: 'Nama Kategori' }, { key: 'prefix', label: 'Prefix Kode' }]}
                onSave={handleSaveAssetCategory} onDelete={handleDeleteAssetCategory}
                formInputs={[{ key: 'name', label: 'Nama Kategori' }, { key: 'prefix', label: 'Prefix Kode (2-3 Huruf)' }]}
                emptyForm={{ name: '', prefix: '' }}
                usageCheck={(id) => store.assets.some(asset => asset.categoryId === id)}
            />
        </Modal>

        <div style={{...styles.headerActions, marginBottom: '16px'}} className="responsive-header-actions">
            <h3 style={{marginTop: 0, marginBottom: 0, fontSize: '1.25rem'}}>Daftar Aset</h3>
            {!showForm && 
                <button onClick={() => setIsAdding(true)} style={{...styles.button, ...styles.buttonPrimary, ...styles.buttonIcon}} title="Tambah Aset Baru">
                    <PlusIcon />
                </button>
            }
        </div>

        {showForm &&
            <div ref={formRef} style={styles.card}>
                <h3 style={{marginTop: 0, marginBottom: '20px', fontSize: '1.25rem'}}>{editingAsset ? 'Edit Aset' : 'Tambah Aset Baru'}</h3>
                <form onSubmit={handleSave}>
                    <div style={{display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '16px'}} className="responsive-form-grid">
                        <div>
                            <label htmlFor="asset-name" style={styles.formLabel}>Nama Aset</label>
                            <input id="asset-name" ref={firstInputRef} style={styles.input} type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                        </div>
                        <div>
                             <div style={{...styles.inlineFlex, justifyContent: 'space-between', marginBottom: '8px'}}>
                                <label htmlFor="asset-category" style={{...styles.formLabel, marginBottom: 0}}>Kategori</label>
                                <button type="button" onClick={() => setIsCategoryModalOpen(true)} style={{...styles.button, ...styles.buttonOutline, padding: '4px 10px', fontSize: '0.8rem'}}>Kelola</button>
                            </div>
                            <select id="asset-category" style={styles.select} value={formData.categoryId} onChange={e => setFormData({ ...formData, categoryId: e.target.value })} required><option value="" disabled>Pilih Kategori</option>{store.assetCategories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
                        </div>
                    </div>
                     <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px'}} className="responsive-form-grid">
                        <div><label htmlFor="asset-purchase-date" style={styles.formLabel}>Tgl. Perolehan</label><input id="asset-purchase-date" style={styles.input} type="date" value={formData.purchaseDate} onChange={e => setFormData({ ...formData, purchaseDate: e.target.value })} required /></div>
                        <div><label htmlFor="asset-value" style={styles.formLabel}>Nilai (Rp)</label><input id="asset-value" style={styles.input} type="number" value={formData.value} onChange={e => setFormData({ ...formData, value: e.target.value })} required /></div>
                        <div>
                            <label htmlFor="asset-condition" style={styles.formLabel}>Kondisi</label>
                            <select id="asset-condition" style={styles.select} value={formData.condition} onChange={e => setFormData({ ...formData, condition: e.target.value as Asset['condition'] })}>
                                <option value="Bagus">Bagus</option>
                                <option value="Normal">Normal</option>
                                <option value="Rusak">Rusak</option>
                            </select>
                        </div>
                    </div>
                    <div style={{marginBottom: '24px'}}>
                         <label htmlFor="asset-description" style={styles.formLabel}>Keterangan</label>
                         <textarea id="asset-description" style={{...styles.input, height: '80px', resize: 'vertical'}} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                    </div>
                    <div style={{display: 'flex', justifyContent: 'flex-end', gap: '12px'}} className="responsive-inline-flex">
                        <button type="submit" style={{...styles.button, ...styles.buttonPrimary}}>{editingAsset ? 'Simpan' : 'Tambah'}</button>
                        <button type="button" onClick={handleCancel} style={{ ...styles.button, ...styles.buttonOutline }}>Batal</button>
                    </div>
                </form>
            </div>
        }
        <div className="responsive-table-wrapper">
            <table style={styles.table}>
                <thead><tr><th style={styles.th}>Kode</th><th style={styles.th}>Nama Aset</th><th style={styles.th}>Keterangan</th><th style={styles.th}>Kategori</th><th style={styles.th}>Kondisi</th><th style={styles.th}>Tgl. Perolehan</th><th style={styles.th}>Nilai</th><th style={styles.th}>Aksi</th></tr></thead>
                <tbody>
                    {assetsWithDetails.map(asset => (
                        <tr key={asset.id}>
                            <td style={styles.td}>{asset.code}</td>
                            <td style={styles.td}>{asset.name}</td>
                            <td style={styles.td}>{asset.description}</td>
                            <td style={styles.td}>{asset.categoryName}</td>
                            <td style={styles.td}>{asset.condition}</td>
                            <td style={styles.td}>{new Date(asset.purchaseDate).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                            <td style={styles.td}>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(asset.value)}</td>
                            <td style={styles.td}><div style={styles.inlineFlex} className="responsive-inline-flex">
                                <button onClick={() => setEditingAsset(asset)} style={{...styles.button, ...styles.buttonPrimary, ...styles.buttonIconSmall}} title="Edit Aset">
                                    <PencilIcon />
                                </button>
                                <button onClick={() => handleDeleteClick(asset.id)} style={{...styles.button, ...styles.buttonDanger, ...styles.buttonIconSmall}} title="Hapus Aset">
                                    <TrashIcon />
                                </button>
                            </div></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </>;
};

const StoreCostsView = ({ store, onStoreUpdate }) => {
    const emptyForm = { name: '', amount: '', frequency: 'bulanan' as OperationalCost['frequency'], description: '' };
    const [editingCost, setEditingCost] = useState<OperationalCost | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [formData, setFormData] = useState(emptyForm);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const formRef = useRef<HTMLDivElement>(null);
    const firstInputRef = useRef<HTMLInputElement>(null);

    const showForm = isAdding || editingCost !== null;

    useEffect(() => {
        if (editingCost) { 
            setFormData({ 
                name: editingCost.name, 
                amount: String(editingCost.amount), 
                frequency: editingCost.frequency, 
                description: editingCost.description || '' 
            }); 
            setIsAdding(false); 
        }
    }, [editingCost]);

    useEffect(() => {
        if (showForm) { formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => firstInputRef.current?.focus(), 300); }
    }, [showForm]);

    const handleCancel = () => { setIsAdding(false); setEditingCost(null); setFormData(emptyForm); };

    const handleSave = (e) => {
        e.preventDefault();
        const amountNum = parseFloat(formData.amount);
        if (!formData.name || isNaN(amountNum)) return alert('Nama dan Jumlah biaya harus diisi dengan benar.');
        const costData = { name: formData.name, amount: amountNum, frequency: formData.frequency, description: formData.description };
        let updatedStore = { ...store };

        if (editingCost) {
            const updatedCosts = store.costs.map(c => c.id === editingCost.id ? { ...c, ...costData } : c);
            updatedStore.costs = updatedCosts;
        } else {
            updatedStore.costs = [...store.costs, { ...costData, id: generateId(`${store.id}-CST`) }];
        }
        onStoreUpdate(updatedStore);
        handleCancel();
    };

    const handleDeleteClick = (costId: string) => {
        setDeletingId(costId);
        setIsConfirmOpen(true);
    };

    const handleConfirmDelete = () => {
        if (!deletingId) return;
        const updatedCosts = store.costs.filter(c => c.id !== deletingId);
        onStoreUpdate({ ...store, costs: updatedCosts });
        setIsConfirmOpen(false);
        setDeletingId(null);
    };
    
    return <>
        <ConfirmModal isOpen={isConfirmOpen} onClose={() => setIsConfirmOpen(false)} onConfirm={handleConfirmDelete} title="Hapus Biaya?">
            <p>Yakin ingin menghapus biaya ini? Tindakan ini tidak dapat diurungkan.</p>
        </ConfirmModal>

        <div style={{...styles.headerActions, marginBottom: '16px'}} className="responsive-header-actions">
            <h3 style={{marginTop: 0, marginBottom: 0, fontSize: '1.25rem'}}>Daftar Biaya Operasional</h3>
            {!showForm && 
                <button onClick={() => setIsAdding(true)} style={{...styles.button, ...styles.buttonPrimary, ...styles.buttonIcon}} title="Tambah Biaya Baru">
                    <PlusIcon />
                </button>
            }
        </div>
        {showForm && 
            <div ref={formRef} style={styles.card}>
                <h3 style={{marginTop: 0, marginBottom: '20px', fontSize: '1.25rem'}}>{editingCost ? 'Edit Biaya' : 'Tambah Biaya Baru'}</h3>
                <form onSubmit={handleSave}>
                    <div style={{display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px', alignItems: 'flex-end', marginBottom: '16px'}} className="responsive-form-grid">
                        <div><label htmlFor="cost-name" style={styles.formLabel}>Nama Biaya</label><input id="cost-name" ref={firstInputRef} style={styles.input} type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}/></div>
                        <div><label htmlFor="cost-amount" style={styles.formLabel}>Jumlah (Rp)</label><input id="cost-amount" style={styles.input} type="number" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })}/></div>
                        <div><label htmlFor="cost-frequency" style={styles.formLabel}>Frekuensi</label>
                            <select id="cost-frequency" style={styles.select} value={formData.frequency} onChange={e => setFormData({ ...formData, frequency: e.target.value as OperationalCost['frequency'] })}>
                                <option value="harian">Harian</option><option value="mingguan">Mingguan</option><option value="bulanan">Bulanan</option><option value="tahunan">Tahunan</option>
                            </select>
                        </div>
                    </div>
                     <div style={{marginBottom: '24px'}}>
                        <label htmlFor="cost-description" style={styles.formLabel}>Keterangan</label>
                        <textarea id="cost-description" style={{...styles.input, height: '80px', resize: 'vertical'}} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                    </div>
                    <div style={{display: 'flex', justifyContent: 'flex-end', gap: '12px'}} className="responsive-inline-flex">
                        <button type="submit" style={{...styles.button, ...styles.buttonPrimary}}>{editingCost ? 'Simpan' : 'Tambah'}</button>
                        <button type="button" onClick={handleCancel} style={{ ...styles.button, ...styles.buttonOutline }}>Batal</button>
                    </div>
                </form>
            </div>
        }
        <div className="responsive-table-wrapper">
            <table style={styles.table}>
                <thead><tr><th style={styles.th}>Nama Biaya</th><th style={styles.th}>Keterangan</th><th style={styles.th}>Jumlah</th><th style={styles.th}>Frekuensi</th><th style={styles.th}>Aksi</th></tr></thead>
                <tbody>
                    {store.costs.map(cost => (
                        <tr key={cost.id}>
                            <td style={styles.td}>{cost.name}</td>
                            <td style={styles.td}>{cost.description}</td>
                            <td style={styles.td}>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(cost.amount)}</td>
                            <td style={styles.td}>{cost.frequency}</td>
                            <td style={styles.td}><div style={styles.inlineFlex} className="responsive-inline-flex">
                                <button onClick={() => setEditingCost(cost)} style={{...styles.button, ...styles.buttonPrimary, ...styles.buttonIconSmall}} title="Edit Biaya">
                                    <PencilIcon />
                                </button>
                                <button onClick={() => handleDeleteClick(cost.id)} style={{...styles.button, ...styles.buttonDanger, ...styles.buttonIconSmall}} title="Hapus Biaya">
                                    <TrashIcon />
                                </button>
                            </div></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </>;
};

// --- CORE VIEWS ---
const StoreDetailView = ({ store, onStoreUpdate, onBack, onStartOpname }) => {
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

                const validConditions: Asset['condition'][] = ['Bagus', 'Normal', 'Rusak'];
                const validateCondition = (condStr: any): Asset['condition'] => {
                    const str = String(condStr || '').trim();
                    const found = validConditions.find(c => c.toLowerCase() === str.toLowerCase());
                    return found || 'Normal';
                };

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
                        <MoreVertIcon />
                    </button>
                }
                menuItems={mobileMenuItems}
                menuPositionStyle={{ bottom: 'calc(100% + 12px)', top: 'auto', right: 0 }}
            />
        </div>
    </>;
};

const StockOpnameView = ({ store, onStoreUpdate, onComplete, onCancel }) => {
    const [opnameData, setOpnameData] = useState<{ [itemId: string]: number | '' }>({});
    const [assetConditions, setAssetConditions] = useState<{ [assetId: string]: Asset['condition'] }>({});
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const opnameFormRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const initialItemData = {};
        store.items.forEach(item => { initialItemData[item.id] = ''; });
        setOpnameData(initialItemData);

        const initialAssetConditions = {};
        store.assets.forEach(asset => { initialAssetConditions[asset.id] = asset.condition; });
        setAssetConditions(initialAssetConditions);
    }, [store]);

    const handleCountChange = (itemId: string, value: string) => {
        const numValue = parseInt(value, 10);
        setOpnameData(prev => ({ ...prev, [itemId]: value === '' ? '' : (!isNaN(numValue) && numValue >= 0 ? numValue : prev[itemId]) }));
    };
    
    const handleConditionChange = (assetId: string, value: Asset['condition']) => {
        setAssetConditions(prev => ({ ...prev, [assetId]: value }));
    };

    const handleSubmitClick = () => {
        if (Object.values(opnameData).some(v => v === '')) {
            alert('Harap isi semua jumlah hitungan fisik. Isi dengan 0 jika barang kosong.');
            return;
        }
        setIsConfirmOpen(true);
    };

    const handleConfirmSubmit = () => {
        const reportItems = store.items.map(item => {
            const initialStock = store.inventory.find(inv => inv.itemId === item.id)?.recordedStock ?? 0;
            const physicalCount = Number(opnameData[item.id] ?? 0);
            const unitName = store.units.find(u => u.id === item.unitId)?.name ?? 'N/A';
            return { itemId: item.id, itemName: item.name, unit: unitName, initialStock, physicalCount, discrepancy: physicalCount - initialStock };
        });
        
        const reportAssetChanges = store.assets
            .map(asset => ({ assetId: asset.id, assetName: asset.name, oldCondition: asset.condition, newCondition: assetConditions[asset.id] }))
            .filter(change => change.oldCondition !== change.newCondition);

        const newOpnameSession: OpnameSession = { 
            id: generateId('OPN'), storeId: store.id, date: new Date().toISOString(), status: 'completed', items: reportItems, assetChanges: reportAssetChanges
        };
        
        const newInventory = store.items.map(item => ({ itemId: item.id, recordedStock: Number(opnameData[item.id] ?? 0) }));
        const updatedAssets = store.assets.map(asset => ({ ...asset, condition: assetConditions[asset.id] || asset.condition }));

        const updatedStore = { ...store, inventory: newInventory, assets: updatedAssets };
        onStoreUpdate(updatedStore);
        
        onComplete(newOpnameSession);
        setIsConfirmOpen(false);
    };

    const itemsWithDetails = useMemo(() => store.items.map(item => ({
        ...item,
        unitName: store.units.find(u => u.id === item.unitId)?.name ?? 'N/A',
        recordedStock: store.inventory.find(inv => inv.itemId === item.id)?.recordedStock ?? 0
    })).sort((a,b) => a.name.localeCompare(b.name)), [store]);
    
    const handleExportForOpnameExcel = useCallback(() => {
        const sanitizedStoreName = sanitizeFilename(store.name);
        const itemsToExport = itemsWithDetails.map(item => ({ 'Nama Barang': item.name, 'Satuan': item.unitName, 'Stok Awal': item.recordedStock, 'Stok Terkini (Isi di sini)': '', 'Selisih': '' }));
        const assetsToExport = store.assets.map(asset => ({ 'Nama Aset': asset.name, 'Kondisi (Isi: Bagus/Normal/Rusak)': '' }));
        const wb = XLSX.utils.book_new();
        const wsItems = XLSX.utils.json_to_sheet(itemsToExport);
        const wsAssets = XLSX.utils.json_to_sheet(assetsToExport);
        XLSX.utils.book_append_sheet(wb, wsItems, "Pemeriksaan Barang");
        XLSX.utils.book_append_sheet(wb, wsAssets, "Pemeriksaan Aset");
        XLSX.writeFile(wb, `${sanitizedStoreName}-Opname Offline.xlsx`, { bookSST: false });
    }, [store.name, store.assets, itemsWithDetails]);
    
    const handleExportForOpnamePdf = useCallback(() => {
        if (!opnameFormRef.current) return;
        setIsGeneratingPdf(true);
        const formElement = opnameFormRef.current;
        formElement.classList.add('exporting-to-pdf');
        html2canvas(formElement, { scale: 2, useCORS: true })
            .then(canvas => {
                const imgData = canvas.toDataURL('image/png');
                const { jsPDF } = jspdf;
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                const canvasWidth = canvas.width;
                const canvasHeight = canvas.height;
                const ratio = canvasWidth / canvasHeight;
                const imgHeight = pdfWidth / ratio;
                let heightLeft = imgHeight;
                let position = 0;
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pdfHeight;
                while (heightLeft > 0) {
                    position -= pdfHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                    heightLeft -= pdfHeight;
                }
                const fileName = `${sanitizeFilename(store.name)}-Form_Opname_Offline.pdf`;
                pdf.save(fileName);
            })
            .catch(err => { console.error("Error generating PDF:", err); alert("Gagal membuat PDF. Silakan coba lagi."); })
            .finally(() => { formElement.classList.remove('exporting-to-pdf'); setIsGeneratingPdf(false); });
    }, [store.name]);

    const exportMenuItems = [
        { label: 'Ekspor ke Excel', onClick: handleExportForOpnameExcel },
        { label: 'Ekspor ke PDF', onClick: handleExportForOpnamePdf },
    ];

    return <>
        <ConfirmModal 
            isOpen={isConfirmOpen} 
            onClose={() => setIsConfirmOpen(false)} 
            onConfirm={handleConfirmSubmit} 
            title="Selesaikan Stock Opname?"
            confirmText="Ok"
            confirmButtonStyle={styles.buttonSuccess}
        >
            <p>Selisih stok akan ditampilkan sesuai dengan hasil hitungan fisik Anda. Pastikan semua data sudah benar sebelum melanjutkan.</p>
        </ConfirmModal>

        <div style={{...styles.headerActions, justifyContent: 'space-between', alignItems: 'center' }} className="responsive-header-actions">
            <div>
                <h2 style={{...styles.header, marginBottom: '8px'}} className="header-style">Stock Opname: {store.name}</h2>
                <p style={{...styles.pageDescription, margin: 0}} className="page-description-style">Masukkan jumlah fisik setiap barang atau ekspor data untuk opname offline.</p>
            </div>
             <Dropdown 
                trigger={
                    <button style={{...styles.button, ...styles.buttonOutline}} disabled={isGeneratingPdf}>
                        {isGeneratingPdf && <div className="spinner" style={{width: '16px', height: '16px', borderTopColor: 'var(--text-secondary)'}}></div>}
                        {isGeneratingPdf ? 'Membuat PDF...' : 'Cetak Cek Offline'} &#9662;
                    </button>
                }
                menuItems={exportMenuItems} 
            />
        </div>

        <div style={styles.card} ref={opnameFormRef}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '1.25rem' }}>Pemeriksaan Barang</h3>
            <div className="responsive-table-wrapper">
                <table style={styles.table}>
                    <thead><tr><th style={styles.th}>Nama Barang</th><th style={styles.th}>STOK AWAL</th><th style={styles.th}>STOK TERKINI</th><th style={styles.th}>Selisih</th><th style={styles.th}>Satuan</th></tr></thead>
                    <tbody>
                        {itemsWithDetails.map(item => (
                            <tr key={item.id}>
                                <td style={styles.td}>{item.name}</td>
                                <td style={styles.td}>{item.recordedStock}</td>
                                <td style={styles.td}><input type="number" style={{...styles.input, ...styles.opnameInput}} className="opname-input-style" value={opnameData[item.id] ?? ''} onChange={e => handleCountChange(item.id, e.target.value)} min="0" /></td>
                                <td style={styles.td}></td>
                                <td style={styles.td}>{item.unitName}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <h3 style={{ marginTop: '32px', marginBottom: '16px', fontSize: '1.25rem' }}>Pemeriksaan Aset</h3>
            <div className="responsive-table-wrapper">
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>Nama Aset</th>
                            <th style={styles.th}>Kondisi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {store.assets.sort((a,b) => a.name.localeCompare(b.name)).map(asset => (
                            <tr key={asset.id}>
                                <td style={styles.td}>{asset.name}</td>
                                <td style={styles.td}>
                                    <select
                                        style={{...styles.select, maxWidth: '200px'}}
                                        className="asset-condition-select"
                                        value={assetConditions[asset.id] || 'Normal'}
                                        onChange={e => handleConditionChange(asset.id, e.target.value as Asset['condition'])}
                                    >
                                        <option value="Bagus">Bagus</option>
                                        <option value="Normal">Normal</option>
                                        <option value="Rusak">Rusak</option>
                                    </select>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div style={{...styles.inlineFlex, marginTop: '24px', justifyContent: 'flex-end', gap: '12px' }} className="responsive-header-actions opname-actions-footer">
                <button onClick={onCancel} style={{...styles.button, ...styles.buttonOutline}}>Batal</button>
                <button onClick={handleSubmitClick} style={{...styles.button, ...styles.buttonSuccess}}>Cek Sekarang</button>
            </div>
        </div>
    </>;
};

const OpnameReportView = ({ report, stores, onClose }) => {
    const reportRef = useRef<HTMLDivElement>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const storeName = stores.find(s => s.id === report.storeId)?.name || 'Toko tidak ditemukan';
    
    const renderDiscrepancy = (d: number) => d > 0 ? <span style={styles.discrepancyPositive}>+{d}</span> : (d < 0 ? <span style={styles.discrepancyNegative}>{d}</span> : <span>0</span>);
    
    const itemSummary = useMemo(() => {
        const total = report.items.length;
        const surplus = report.items.filter(i => i.discrepancy > 0).length;
        const shortage = report.items.filter(i => i.discrepancy < 0).length;
        return { total, surplus, shortage, match: total - surplus - shortage };
    }, [report.items]);
    
    const assetSummary = useMemo(() => {
        const totalChecked = stores.find(s => s.id === report.storeId)?.assets.length ?? 0;
        const changed = report.assetChanges.length;
        const becameRusak = report.assetChanges.filter(c => c.newCondition === 'Rusak').length;
        return { totalChecked, changed, becameRusak };
    }, [report.assetChanges, report.storeId, stores]);

    const handleExportToExcel = useCallback(() => {
        const wb = XLSX.utils.book_new();
        const sanitizedStoreName = sanitizeFilename(storeName);

        const itemsData = report.items.map(item => ({ 'Nama Barang': item.itemName, 'Stok Awal': item.initialStock, 'Hitungan Fisik': item.physicalCount, 'Selisih': item.discrepancy, 'Satuan': item.unit }));
        const wsItems = XLSX.utils.json_to_sheet(itemsData);
        XLSX.utils.book_append_sheet(wb, wsItems, "Hasil Cek Barang");

        if (report.assetChanges.length > 0) {
            const assetsData = report.assetChanges.map(change => ({ 'Nama Aset': change.assetName, 'Kondisi Awal': change.oldCondition, 'Kondisi Baru': change.newCondition }));
            const wsAssets = XLSX.utils.json_to_sheet(assetsData);
            XLSX.utils.book_append_sheet(wb, wsAssets, "Hasil Cek Aset");
        }
        
        const fileName = `${sanitizedStoreName}-Laporan_Stock_Opname.xlsx`;
        XLSX.writeFile(wb, fileName);
    }, [report, storeName]);


    const handlePrintToPdf = useCallback(() => {
        if (!reportRef.current) return;
        setIsGeneratingPdf(true);
        const reportElement = reportRef.current;
        
        html2canvas(reportElement, { scale: 2, useCORS: true })
            .then(canvas => {
                const imgData = canvas.toDataURL('image/png');
                const { jsPDF } = jspdf;
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                const canvasWidth = canvas.width;
                const canvasHeight = canvas.height;
                const ratio = canvasWidth / canvasHeight;
                let imgWidth = pdfWidth - 20;
                let imgHeight = imgWidth / ratio;

                if (imgHeight > pdfHeight - 20) {
                    imgHeight = pdfHeight - 20;
                    imgWidth = imgHeight * ratio;
                }
                
                const x = (pdfWidth - imgWidth) / 2;
                const y = 10;
                
                pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
                const fileName = `${sanitizeFilename(storeName)}-Laporan_Stock_Opname.pdf`;
                pdf.save(fileName);
            })
            .catch(err => { console.error("Error generating PDF:", err); alert("Gagal membuat PDF. Silakan coba lagi."); })
            .finally(() => { setIsGeneratingPdf(false); });
    }, [storeName]);

    const printMenuItems = [
        { label: 'Cetak ke Printer', onClick: () => window.print() },
        { label: 'Ekspor ke PDF', onClick: handlePrintToPdf },
        { label: 'Ekspor ke Excel', onClick: handleExportToExcel },
    ];

    return <>
        <div style={styles.headerActions} className="responsive-header-actions">
             <h2 style={styles.header} className="header-style">Laporan Stock Opname</h2>
             <div style={{...styles.inlineFlex}} className="no-print button-group">
                <Dropdown 
                    trigger={
                        <button style={{...styles.button, ...styles.buttonOutline}} disabled={isGeneratingPdf}>
                            {isGeneratingPdf && <div className="spinner" style={{width: '16px', height: '16px', borderTopColor: 'var(--text-secondary)'}}></div>}
                            {isGeneratingPdf ? 'Membuat PDF...' : 'Ekspor & Cetak'} &#9662;
                        </button>
                    }
                    menuItems={printMenuItems} 
                />
                <button onClick={onClose} style={{...styles.button, ...styles.buttonPrimary}}>Kembali</button>
            </div>
        </div>
        <div style={styles.card} ref={reportRef}>
            <div>
                <h3 style={{margin: 0, fontSize: '1.25rem'}}>Laporan untuk {storeName}</h3>
                <p style={{margin: '4px 0 0 0', color: 'var(--text-secondary)'}}>Tanggal Opname: {new Date(report.date).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}</p>
            </div>
            
            <h4 style={{ fontSize: '1.1rem', marginTop: '24px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Hasil Pemeriksaan Barang</h4>
            <div style={{display: 'flex', gap: '16px', marginBottom: '16px', padding: '20px', backgroundColor: '#f9fafb', borderRadius: 'var(--radius-md)' }} className="summary-flex">
                <div style={{flex: 1}}><strong>Total Barang:</strong> {itemSummary.total}</div>
                <div style={{flex: 1, fontWeight: 'bold'}}><strong>Sesuai:</strong> {itemSummary.match}</div>
                <div style={{flex: 1, ...styles.discrepancyPositive}}><strong>Lebih:</strong> {itemSummary.surplus}</div>
                <div style={{flex: 1, ...styles.discrepancyNegative}}><strong>Kurang:</strong> {itemSummary.shortage}</div>
            </div>
             <div className="responsive-table-wrapper">
                 <table style={styles.table}>
                    <thead><tr><th style={styles.th}>Nama Barang</th><th style={styles.th}>Stok Awal</th><th style={styles.th}>Hitungan Fisik</th><th style={styles.th}>Selisih</th><th style={styles.th}>Satuan</th></tr></thead>
                    <tbody>
                        {report.items.map(item => (
                            <tr key={item.itemId}>
                                <td style={styles.td}>{item.itemName}</td>
                                <td style={styles.td}>{item.initialStock}</td>
                                <td style={styles.td}>{item.physicalCount}</td>
                                <td style={styles.td}>{renderDiscrepancy(item.discrepancy)}</td>
                                <td style={styles.td}>{item.unit}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <h4 style={{ fontSize: '1.1rem', marginTop: '32px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Hasil Pemeriksaan Aset</h4>
            <div style={{display: 'flex', gap: '16px', marginBottom: '16px', padding: '20px', backgroundColor: '#f9fafb', borderRadius: 'var(--radius-md)' }} className="summary-flex">
                <div style={{flex: 1}}><strong>Total Aset Dicek:</strong> {assetSummary.totalChecked}</div>
                <div style={{flex: 1}}><strong>Kondisi Berubah:</strong> {assetSummary.changed}</div>
                <div style={{flex: 1, ...styles.discrepancyNegative}}><strong>Menjadi Rusak:</strong> {assetSummary.becameRusak}</div>
            </div>
            {report.assetChanges.length > 0 &&
                <div className="responsive-table-wrapper">
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>Nama Aset</th>
                                <th style={styles.th}>Kondisi Awal</th>
                                <th style={styles.th}>Kondisi Baru</th>
                            </tr>
                        </thead>
                        <tbody>
                            {report.assetChanges.map(change => (
                                <tr key={change.assetId}>
                                    <td style={styles.td}>{change.assetName}</td>
                                    <td style={styles.td}>{change.oldCondition}</td>
                                    <td style={styles.td}><span style={{fontWeight: 'bold', color: change.newCondition === 'Rusak' ? 'var(--danger-color)' : 'inherit'}}>{change.newCondition}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            }
        </div>
    </>;
};

// --- MAIN APP COMPONENT ---
const App = () => {
    const [stores, setStores] = useState<Store[]>([]);
    const [opnameHistory, setOpnameHistory] = useState<OpnameSession[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [view, setView] = useState<'home' | 'store-detail' | 'opname' | 'report'>('home');
    const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
    const [activeReport, setActiveReport] = useState<OpnameSession | null>(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                const { stores, history } = await db.fetchStoresAndHistory();
                setStores(stores);
                setOpnameHistory(history);
            } catch (err) {
                console.error("Gagal memuat data dari Firebase:", err);
                setError("Tidak dapat terhubung ke database. Periksa konfigurasi Firebase Anda dan koneksi internet.");
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    const selectedStore = useMemo(() => stores.find(s => s.id === selectedStoreId), [stores, selectedStoreId]);

    const handleSelectStore = (storeId: string) => { setSelectedStoreId(storeId); setView('store-detail'); };
    const handleBackToHome = () => { setSelectedStoreId(null); setView('home'); setActiveReport(null); };
    const handleStartOpname = () => { if (selectedStore) setView('opname'); };
    
    const handleOpnameComplete = async (report: OpnameSession) => {
        await db.addOpnameSession(report);
        setOpnameHistory(prev => [report, ...prev].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        setActiveReport(report);
        setView('report');
    };
    
    const handleStoreUpdate = async (updatedStore: Store) => {
        await db.writeStore(updatedStore);
        setStores(prev => prev.map(s => s.id === updatedStore.id ? updatedStore : s));
    };

    const handleAddStore = async (newStore: Store) => {
        await db.writeStore(newStore);
        setStores(prev => [...prev, newStore]);
    };

    const handleUpdateStoreInfo = async (storeId: string, data: { name: string, address: string }) => {
        const storeToUpdate = stores.find(s => s.id === storeId);
        if(storeToUpdate) {
            const updatedStore = { ...storeToUpdate, ...data };
            await db.writeStore(updatedStore);
            setStores(prev => prev.map(s => s.id === storeId ? updatedStore : s));
        }
    };
    
    const handleOpnameCancel = () => setView('store-detail');
    const handleCloseReport = () => { setActiveReport(null); setView('store-detail'); };

    const handleDeleteStore = async (storeIdToDelete: string) => {
        await db.deleteStore(storeIdToDelete);
        await db.deleteOpnameHistoryForStore(storeIdToDelete);

        setStores(currentStores => currentStores.filter(store => store.id !== storeIdToDelete));
        setOpnameHistory(currentHistory => currentHistory.filter(session => session.storeId !== storeIdToDelete));
        if (selectedStoreId === storeIdToDelete) {
             handleBackToHome();
        }
    };

    const renderContent = () => {
        if (isLoading) {
             return <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh'}}><div className="spinner" style={{width: 50, height: 50}}></div></div>;
        }
        if (error) {
             return <div style={{...styles.card, borderColor: 'var(--danger-color)', borderWidth: '2px', borderStyle: 'solid'}}><h3 style={{color: 'var(--danger-color)'}}>Terjadi Kesalahan</h3><p>{error}</p></div>;
        }

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

const root = createRoot(document.getElementById('root')!);
root.render(<App />);