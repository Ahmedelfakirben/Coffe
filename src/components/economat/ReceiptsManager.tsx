import { useState, useEffect } from 'react';
import { Plus, Trash2, X, Eye, ArrowDownToLine, Receipt } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { InventoryReceipt, InventoryReceiptItem, InventoryItem } from '../../types/supabase';
import { Supplier } from '../../types/expenses';

export function ReceiptsManager() {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const [receipts, setReceipts] = useState<InventoryReceipt[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState<InventoryReceipt | null>(null);

  const [formData, setFormData] = useState({
    supplier_id: '',
    receipt_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [receiptItems, setReceiptItems] = useState<Array<{ item_id: string; quantity: number; unit_cost: number }>>([]);

  useEffect(() => {
    fetchReceipts();
    fetchItems();
    fetchSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchReceipts = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_receipts')
        .select(`
          *,
          supplier:suppliers(name),
          received_by_profile:employee_profiles!inventory_receipts_received_by_fkey(full_name),
          items:inventory_receipt_items(
            *,
            item:inventory_items(name, unit)
          )
        `)
        .order('receipt_date', { ascending: false });

      if (error) throw error;
      setReceipts(data || []);
    } catch (err) {
      console.error('Error fetching receipts:', err);
      toast.error(t('Error al cargar recepciones'));
    }
  };

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase.from('inventory_items').select('*').order('name');
      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      console.error('Error fetching items:', err);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase.from('suppliers').select('id, name').order('name');
      if (error) throw error;
      setSuppliers(data || []);
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    }
  };

  const addItemToReceipt = () => {
    if (items.length === 0) {
      toast.error(t('No hay artículos disponibles. Crea uno primero.'));
      return;
    }
    setReceiptItems([...receiptItems, { item_id: items[0].id, quantity: 1, unit_cost: items[0].unit_cost || 0 }]);
  };

  const updateReceiptItem = (index: number, field: string, value: string | number) => {
    const newItems = [...receiptItems];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Auto update unit cost if item changes
    if (field === 'item_id') {
      const selectedItem = items.find(i => i.id === value);
      if (selectedItem) {
        newItems[index].unit_cost = selectedItem.unit_cost || 0;
      }
    }
    
    setReceiptItems(newItems);
  };

  const removeReceiptItem = (index: number) => {
    setReceiptItems(receiptItems.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return receiptItems.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (receiptItems.length === 0) {
      toast.error(t('Debes agregar al menos un artículo a la recepción'));
      return;
    }

    setLoading(true);

    try {
      const totalAmount = calculateTotal();

      // 1. Create Receipt
      const { data: receipt, error: receiptError } = await supabase
        .from('inventory_receipts')
        .insert([{
          supplier_id: formData.supplier_id || null,
          received_by: profile?.id || null,
          receipt_date: formData.receipt_date,
          notes: formData.notes,
          total_amount: totalAmount
        }])
        .select()
        .single();

      if (receiptError) throw receiptError;

      // 2. Create Receipt Items
      const itemsToInsert = receiptItems.map(item => ({
        receipt_id: receipt.id,
        item_id: item.item_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        total_cost: item.quantity * item.unit_cost
      }));

      const { error: itemsError } = await supabase
        .from('inventory_receipt_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast.success(t('Recepción registrada con éxito. Stock actualizado.'));
      setShowForm(false);
      resetForm();
      await fetchReceipts();
      // The trigger will automatically update stock and supplier balance
    } catch (err) {
      console.error('Error saving receipt:', err);
      toast.error(t('Error al guardar la recepción'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('¿Estás seguro de eliminar esta recepción? ADVERTENCIA: El stock y balance del proveedor se revertirán automáticamente.'))) return;
    try {
      const { error } = await supabase.from('inventory_receipts').delete().eq('id', id);
      if (error) throw error;
      toast.success(t('Recepción eliminada'));
      await fetchReceipts();
    } catch (err) {
      console.error('Error deleting receipt:', err);
      toast.error(t('Error al eliminar recepción'));
    }
  };

  const resetForm = () => {
    setFormData({
      supplier_id: '',
      receipt_date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setReceiptItems([]);
  };

  return (
    <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-gray-900">{t('economat.receipts')}</h3>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-5 h-5" />
          {t('Nueva Recepción')}
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <ArrowDownToLine className="w-6 h-6 text-amber-600" />
                {t('Registrar Recepción de Artículos')}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-6 flex-1">
              {/* Header Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">{t('Proveedor')}</label>
                  <select
                    value={formData.supplier_id}
                    onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">-- Sin proveedor --</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">{t('Fecha')}</label>
                  <input
                    type="date"
                    required
                    value={formData.receipt_date}
                    onChange={(e) => setFormData({ ...formData, receipt_date: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">{t('Notas/Albarán')}</label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                    placeholder="Ref: FAC-123"
                  />
                </div>
              </div>

              {/* Items List */}
              <div className="flex-1">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-lg font-bold text-gray-900">{t('Artículos')}</h4>
                  <button
                    type="button"
                    onClick={addItemToReceipt}
                    className="text-amber-600 hover:bg-amber-50 px-3 py-1.5 rounded-lg font-medium transition-colors text-sm flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Agregar Línea
                  </button>
                </div>

                {receiptItems.length > 0 ? (
                  <div className="space-y-3">
                    {receiptItems.map((item, index) => {
                      return (
                        <div key={index} className="flex flex-wrap md:flex-nowrap gap-3 items-end bg-white p-3 border border-gray-200 rounded-xl">
                          <div className="flex-1 min-w-[200px]">
                            <label className="block text-xs font-semibold text-gray-500 mb-1">{t('Artículo')}</label>
                            <select
                              value={item.item_id}
                              onChange={(e) => updateReceiptItem(index, 'item_id', e.target.value)}
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm"
                            >
                              {items.map(i => (
                                <option key={i.id} value={i.id}>{i.name}</option>
                              ))}
                            </select>
                          </div>
                          
                          <div className="w-24">
                            <label className="block text-xs font-semibold text-gray-500 mb-1">{t('Cantidad')}</label>
                            <div className="relative">
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                required
                                value={item.quantity}
                                onChange={(e) => updateReceiptItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm"
                              />
                            </div>
                          </div>

                          <div className="w-24">
                            <label className="block text-xs font-semibold text-gray-500 mb-1">{t('Costo Unit.')}</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              required
                              value={item.unit_cost}
                              onChange={(e) => updateReceiptItem(index, 'unit_cost', parseFloat(e.target.value) || 0)}
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm"
                            />
                          </div>

                          <div className="w-28 pb-2 text-right">
                            <span className="text-sm font-bold text-gray-900">
                              {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(item.quantity * item.unit_cost)}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeReceiptItem(index)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg mb-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    <p className="text-gray-500 text-sm">No hay artículos. Haz clic en "Agregar Línea" para comenzar.</p>
                  </div>
                )}
              </div>

              {/* Total & Submit */}
              <div className="border-t pt-4 flex justify-between items-center bg-gray-50 -mx-6 -mb-6 p-6 rounded-b-2xl">
                <div>
                  <p className="text-sm text-gray-500 uppercase tracking-wider font-bold">Total Recepción</p>
                  <p className="text-3xl font-black text-gray-900">
                    {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(calculateTotal())}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    {t('Cancelar')}
                  </button>
                  <button
                    type="submit"
                    disabled={loading || receiptItems.length === 0}
                    className="bg-amber-600 hover:bg-amber-700 text-white px-8 py-3 rounded-xl font-bold transition-colors disabled:opacity-50 shadow-md"
                  >
                    {loading ? t('Guardando...') : t('Registrar Entrada')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Viewing Modal */}
      {viewingReceipt && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
           <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
             <div className="flex justify-between items-start mb-6">
               <div>
                  <h3 className="text-2xl font-black text-gray-900 mb-1">{t('Detalle de Recepción')}</h3>
                  <p className="text-gray-500">{new Date(viewingReceipt.receipt_date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
               </div>
               <button onClick={() => setViewingReceipt(null)} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full">
                 <X className="w-5 h-5" />
               </button>
             </div>

             <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-6 flex justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-bold uppercase">{t('Proveedor')}</p>
                  <p className="font-semibold text-gray-900">
                     {/* @ts-expect-error - relation joined in query */}
                    {viewingReceipt.supplier?.name || 'Sin proveedor'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 font-bold uppercase">{t('Total')}</p>
                  <p className="text-xl font-black text-amber-600">
                    {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(viewingReceipt.total_amount)}
                  </p>
                </div>
             </div>

             {viewingReceipt.notes && (
               <div className="mb-6">
                 <p className="text-xs text-gray-500 font-bold uppercase mb-1">{t('Notas')}</p>
                 <p className="text-sm text-gray-800 bg-amber-50 p-3 rounded-lg border border-amber-100">{viewingReceipt.notes}</p>
               </div>
             )}

             <h4 className="font-bold text-gray-900 mb-3">{t('Artículos Recibidos')}</h4>
             <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 text-gray-500">{t('Artículo')}</th>
                    <th className="text-right py-2 text-gray-500">{t('Cant.')}</th>
                    <th className="text-right py-2 text-gray-500">{t('Costo U.')}</th>
                    <th className="text-right py-2 text-gray-500">{t('Subtotal')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {/* @ts-expect-error - relation joined in query */}
                  {viewingReceipt.items?.map((item: InventoryReceiptItem & { item: unknown }) => (
                    <tr key={item.id}>
                      <td className="py-3 font-medium text-gray-900">{item.item?.name}</td>
                      <td className="py-3 text-right">{item.quantity} <span className="text-gray-500 text-xs">{item.item?.unit}</span></td>
                      <td className="py-3 text-right">{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(item.unit_cost)}</td>
                      <td className="py-3 text-right font-bold">{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(item.total_cost)}</td>
                    </tr>
                  ))}
                </tbody>
             </table>
           </div>
        </div>
      )}

      {/* Receipts Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider rounded-tl-xl">{t('Fecha')}</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t('Proveedor')}</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t('Registrado por')}</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t('Artículos')}</th>
              <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">{t('Total')}</th>
              <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider rounded-tr-xl">{t('Acciones')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {receipts.map((receipt) => (
              <tr key={receipt.id} className="hover:bg-amber-50/30 transition-colors group">
                <td className="px-6 py-4">
                  <div className="font-bold text-gray-900">
                    {new Date(receipt.receipt_date).toLocaleDateString('es-ES')}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(receipt.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </td>
                <td className="px-6 py-4">
                   {/* @ts-expect-error - relation joined in query */}
                  <div className="text-sm font-medium text-gray-900">{receipt.supplier?.name || '-'}</div>
                  {receipt.notes && <div className="text-xs text-gray-500 truncate max-w-[150px]">{receipt.notes}</div>}
                </td>
                <td className="px-6 py-4">
                  {/* @ts-expect-error - relation joined in query */}
                  <div className="text-sm text-gray-700">{receipt.received_by_profile?.full_name || '-'}</div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {/* @ts-expect-error - relation joined in query */}
                  {receipt.items?.length || 0} {t('líneas')}
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="font-bold text-amber-600">
                    {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(receipt.total_amount)}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setViewingReceipt(receipt)}
                      className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                      title={t('Ver Detalles')}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(receipt.id)}
                      className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                      title={t('Eliminar (Revierte stock)')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {receipts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500 bg-gray-50/50">
                  <Receipt className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-lg font-medium">{t('No hay recepciones registradas')}</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
