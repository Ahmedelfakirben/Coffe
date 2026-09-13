import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X, AlertTriangle, Calendar, PackageSearch } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { useLanguage } from '../../contexts/LanguageContext';
import { InventoryItem } from '../../types/supabase';
import { Supplier } from '../../types/expenses';

export function InventoryItems() {
  const { t } = useLanguage();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    unit: 'kg',
    min_stock_level: 0,
    unit_cost: 0,
    expiry_date: '',
    supplier_id: '',
  });

  useEffect(() => {
    fetchItems();
    fetchSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select(`
          *,
          supplier:suppliers(name)
        `)
        .order('name');
      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      console.error('Error fetching inventory items:', err);
      toast.error(t('Error al cargar artículos'));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const submitData = {
        ...formData,
        expiry_date: formData.expiry_date || null,
        supplier_id: formData.supplier_id || null,
      };

      if (editingItem) {
        const { error } = await supabase
          .from('inventory_items')
          .update(submitData)
          .eq('id', editingItem.id);
        if (error) throw error;
        toast.success(t('Artículo actualizado'));
      } else {
        const { error } = await supabase
          .from('inventory_items')
          .insert([submitData]);
        if (error) throw error;
        toast.success(t('Artículo creado'));
      }

      setShowForm(false);
      setEditingItem(null);
      resetForm();
      await fetchItems();
    } catch (err) {
      console.error('Error saving item:', err);
      toast.error(t('Error al guardar artículo'));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category || '',
      unit: item.unit,
      min_stock_level: item.min_stock_level,
      unit_cost: item.unit_cost,
      expiry_date: item.expiry_date ? new Date(item.expiry_date).toISOString().split('T')[0] : '',
      supplier_id: item.supplier_id || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('¿Estás seguro de eliminar este artículo?'))) return;
    try {
      const { error } = await supabase.from('inventory_items').delete().eq('id', id);
      if (error) throw error;
      toast.success(t('Artículo eliminado'));
      await fetchItems();
    } catch (err) {
      console.error('Error deleting item:', err);
      toast.error(t('Error al eliminar artículo'));
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      unit: 'kg',
      min_stock_level: 0,
      unit_cost: 0,
      expiry_date: '',
      supplier_id: '',
    });
  };

  const checkExpiryWarning = (dateStr: string | null) => {
    if (!dateStr) return false;
    const expiryDate = new Date(dateStr);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  };
  
  const isExpired = (dateStr: string | null) => {
    if (!dateStr) return false;
    const expiryDate = new Date(dateStr);
    const today = new Date();
    return expiryDate < today;
  };

  return (
    <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-gray-900">{t('economat.items')}</h3>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-5 h-5" />
          {t('Nuevo Artículo')}
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h3 className="text-xl font-bold text-gray-900">
                {editingItem ? t('Editar Artículo') : t('Nuevo Artículo')}
              </h3>
              <button
                onClick={() => { setShowForm(false); setEditingItem(null); }}
                className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-1">{t('Nombre')} *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">{t('Categoría')}</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                  placeholder="Ej. Lácteos, Granos..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">{t('Unidad')} *</label>
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                  required
                >
                  <option value="kg">Kilogramos (kg)</option>
                  <option value="g">Gramos (g)</option>
                  <option value="L">Litros (L)</option>
                  <option value="ml">Mililitros (ml)</option>
                  <option value="uds">Unidades (uds)</option>
                  <option value="cajas">Cajas</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">{t('Costo Unitario')}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-bold">DH</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.unit_cost}
                    onChange={(e) => setFormData({ ...formData, unit_cost: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-8 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">{t('Stock Mínimo (Alerta)')}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.min_stock_level}
                  onChange={(e) => setFormData({ ...formData, min_stock_level: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">{t('Fecha de Caducidad')}</label>
                <input
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">{t('Proveedor Habitual')}</label>
                <select
                  value={formData.supplier_id}
                  onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                >
                  <option value="">-- Sin proveedor --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2 flex justify-end gap-3 pt-6 border-t mt-2">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingItem(null); }}
                  className="px-6 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                >
                  {t('Cancelar')}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-amber-600 hover:bg-amber-700 text-white px-8 py-2.5 rounded-xl font-bold transition-colors disabled:opacity-50 shadow-md"
                >
                  {loading ? t('Guardando...') : editingItem ? t('Actualizar') : t('Crear')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider rounded-tl-xl">{t('Artículo')}</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t('Stock Actual')}</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t('Costo')}</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t('Caducidad')}</th>
              <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider rounded-tr-xl">{t('Acciones')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item) => {
              const isLowStock = item.current_stock <= item.min_stock_level;
              const hasExpiryWarning = checkExpiryWarning(item.expiry_date);
              const hasExpired = isExpired(item.expiry_date);
              
              return (
                <tr key={item.id} className="hover:bg-amber-50/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900 flex items-center gap-2">
                      <PackageSearch className="w-4 h-4 text-gray-400" />
                      {item.name}
                    </div>
                    {item.category && <div className="text-xs text-gray-500 mt-1">{item.category}</div>}
                  </td>
                  <td className="px-6 py-4">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${
                      isLowStock ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {isLowStock && <AlertTriangle className="w-4 h-4" />}
                      {item.current_stock} {item.unit}
                    </div>
                    {isLowStock && (
                      <div className="text-xs text-red-500 mt-1 font-medium">
                        Min: {item.min_stock_level} {item.unit}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(item.unit_cost)} / {item.unit}
                    </div>
                    {item.supplier && (
                      <div className="text-xs text-gray-500 mt-1 truncate max-w-[150px]">
                        {/* @ts-expect-error - relation joined in query */}
                        {item.supplier.name}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {item.expiry_date ? (
                      <div className={`inline-flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-lg ${
                        hasExpired ? 'bg-red-100 text-red-700' : hasExpiryWarning ? 'bg-orange-100 text-orange-700' : 'text-gray-600'
                      }`}>
                        <Calendar className="w-4 h-4" />
                        {new Date(item.expiry_date).toLocaleDateString('es-ES')}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEdit(item)}
                        className="p-2 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors"
                        title={t('Editar')}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                        title={t('Eliminar')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500 bg-gray-50/50">
                  <PackageSearch className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-lg font-medium">{t('No hay artículos registrados')}</p>
                  <p className="text-sm text-gray-400 mt-1">{t('Comienza agregando tu primer artículo al economato')}</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
