
import React, { useState, useEffect, useRef } from 'react';
import { Store, OperationalCost } from '../../types/data';
import { styles } from '../../styles';
import { ConfirmModal } from '../common/Modals';
import { PlusIcon, PencilIcon, TrashIcon } from '../common/Icons';

interface StoreCostsViewProps {
    store: Store;
    onStoreUpdate: (store: Store) => void;
}

const generateId = (prefix: string) => `${prefix}${Date.now()}${Math.random().toString(36).substring(2, 6)}`;

export const StoreCostsView: React.FC<StoreCostsViewProps> = ({ store, onStoreUpdate }) => {
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
