
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Store, Item } from '../../types/data';
import { styles } from '../../styles';
import { Modal, ConfirmModal } from '../common/Modals';
import { MasterDataView } from './MasterDataView';
import { PlusIcon, PencilIcon, TrashIcon } from '../common/Icons';

interface StoreItemsViewProps {
    store: Store;
    onStoreUpdate: (store: Store) => void;
}

const generateId = (prefix: string) => `${prefix}${Date.now()}${Math.random().toString(36).substring(2, 6)}`;

export const StoreItemsView: React.FC<StoreItemsViewProps> = ({ store, onStoreUpdate }) => {
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
