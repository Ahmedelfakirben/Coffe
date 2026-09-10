import { useState, useEffect } from 'react';
import { Plus, Trash2, X, Eye, ArrowUpFromLine, FileMinus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { InventoryIssue, InventoryIssueItem, InventoryItem } from '../../types/supabase';

export function IssuesManager() {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const [issues, setIssues] = useState<InventoryIssue[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [viewingIssue, setViewingIssue] = useState<InventoryIssue | null>(null);

  const [formData, setFormData] = useState({
    issue_type: 'internal_use',
    issue_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [issueItems, setIssueItems] = useState<Array<{ item_id: string; quantity: number; unit_cost: number; max_quantity: number }>>([]);

  useEffect(() => {
    fetchIssues();
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchIssues = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_issues')
        .select(`
          *,
          issued_by_profile:employee_profiles!inventory_issues_issued_by_fkey(full_name),
          items:inventory_issue_items(
            *,
            item:inventory_items(name, unit)
          )
        `)
        .order('issue_date', { ascending: false });

      if (error) throw error;
      setIssues(data || []);
    } catch (err) {
      console.error('Error fetching issues:', err);
      toast.error(t('Error al cargar salidas'));
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

  const addItemToIssue = () => {
    if (items.length === 0) {
      toast.error(t('No hay artículos disponibles.'));
      return;
    }
    setIssueItems([...issueItems, { 
      item_id: items[0].id, 
      quantity: 1, 
      unit_cost: items[0].unit_cost || 0,
      max_quantity: items[0].current_stock || 0
    }]);
  };

  const updateIssueItem = (index: number, field: string, value: string | number) => {
    const newItems = [...issueItems];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Auto update unit cost and max quantity if item changes
    if (field === 'item_id') {
      const selectedItem = items.find(i => i.id === value);
      if (selectedItem) {
        newItems[index].unit_cost = selectedItem.unit_cost || 0;
        newItems[index].max_quantity = selectedItem.current_stock || 0;
        // Don't let quantity exceed new max
        if (newItems[index].quantity > selectedItem.current_stock) {
          newItems[index].quantity = selectedItem.current_stock;
        }
      }
    }
    
    setIssueItems(newItems);
  };

  const removeIssueItem = (index: number) => {
    setIssueItems(issueItems.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return issueItems.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (issueItems.length === 0) {
      toast.error(t('Debes agregar al menos un artículo'));
      return;
    }

    setLoading(true);

    try {
      // 1. Create Issue
      const { data: issue, error: issueError } = await supabase
        .from('inventory_issues')
        .insert([{
          issued_by: profile?.id || null,
          issue_type: formData.issue_type,
          issue_date: formData.issue_date,
          notes: formData.notes
        }])
        .select()
        .single();

      if (issueError) throw issueError;

      // 2. Create Issue Items
      const itemsToInsert = issueItems.map(item => ({
        issue_id: issue.id,
        item_id: item.item_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        total_value: item.quantity * item.unit_cost
      }));

      const { error: itemsError } = await supabase
        .from('inventory_issue_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast.success(t('Salida registrada con éxito. Stock actualizado.'));
      setShowForm(false);
      resetForm();
      await fetchIssues();
      await fetchItems(); // update stocks
    } catch (err) {
      console.error('Error saving issue:', err);
      toast.error(t('Error al guardar la salida'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('¿Estás seguro de eliminar esta salida? ADVERTENCIA: El stock se restaurará automáticamente.'))) return;
    try {
      const { error } = await supabase.from('inventory_issues').delete().eq('id', id);
      if (error) throw error;
      toast.success(t('Salida eliminada'));
      await fetchIssues();
      await fetchItems();
    } catch (err) {
      console.error('Error deleting issue:', err);
      toast.error(t('Error al eliminar salida'));
    }
  };

  const resetForm = () => {
    setFormData({
      issue_type: 'internal_use',
      issue_date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setIssueItems([]);
  };

  const getIssueTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      'internal_use': 'Uso Interno',
      'loss': 'Merma/Pérdida',
      'expired': 'Caducado',
      'adjustment': 'Ajuste de Inventario'
    };
    return types[type] || type;
  };

  const getIssueTypeColor = (type: string) => {
    const types: Record<string, string> = {
      'internal_use': 'bg-blue-100 text-blue-700',
      'loss': 'bg-red-100 text-red-700',
      'expired': 'bg-orange-100 text-orange-700',
      'adjustment': 'bg-purple-100 text-purple-700'
    };
    return types[type] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-gray-900">{t('economat.issues')} / {t('economat.losses')}</h3>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-5 h-5" />
          {t('Nueva Salida')}
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <ArrowUpFromLine className="w-6 h-6 text-amber-600" />
                {t('Registrar Salida / Merma')}
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
                  <label className="block text-sm font-semibold text-gray-700 mb-1">{t('Tipo de Salida')}</label>
                  <select
                    value={formData.issue_type}
                    onChange={(e) => setFormData({ ...formData, issue_type: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="internal_use">Uso Interno</option>
                    <option value="loss">Merma / Pérdida</option>
                    <option value="expired">Caducado</option>
                    <option value="adjustment">Ajuste de Inventario</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">{t('Fecha')}</label>
                  <input
                    type="date"
                    required
                    value={formData.issue_date}
                    onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">{t('Motivo / Notas')}</label>
                  <input
                    type="text"
                    required
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                    placeholder="Ej. Vasos rotos..."
                  />
                </div>
              </div>

              {/* Items List */}
              <div className="flex-1">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-lg font-bold text-gray-900">{t('Artículos')}</h4>
                  <button
                    type="button"
                    onClick={addItemToIssue}
                    className="text-amber-600 hover:bg-amber-50 px-3 py-1.5 rounded-lg font-medium transition-colors text-sm flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Agregar Línea
                  </button>
                </div>

                {issueItems.length > 0 ? (
                  <div className="space-y-3">
                    {issueItems.map((item, index) => {
                      return (
                        <div key={index} className="flex flex-wrap md:flex-nowrap gap-3 items-end bg-white p-3 border border-gray-200 rounded-xl">
                          <div className="flex-1 min-w-[200px]">
                            <label className="block text-xs font-semibold text-gray-500 mb-1">{t('Artículo')}</label>
                            <select
                              value={item.item_id}
                              onChange={(e) => updateIssueItem(index, 'item_id', e.target.value)}
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm"
                            >
                              {items.map(i => (
                                <option key={i.id} value={i.id}>{i.name} (Disp: {i.current_stock} {i.unit})</option>
                              ))}
                            </select>
                          </div>
                          
                          <div className="w-32">
                            <label className="block text-xs font-semibold text-gray-500 mb-1">{t('Cantidad')} (Max: {item.max_quantity})</label>
                            <div className="relative">
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                max={item.max_quantity}
                                required
                                value={item.quantity}
                                onChange={(e) => updateIssueItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                className={`w-full px-3 py-2 bg-gray-50 border rounded-lg text-sm ${item.quantity > item.max_quantity ? 'border-red-500' : 'border-gray-300'}`}
                              />
                            </div>
                          </div>

                          <div className="w-24">
                            <label className="block text-xs font-semibold text-gray-500 mb-1">{t('Costo Unit.')}</label>
                            <input
                              type="number"
                              disabled
                              value={item.unit_cost}
                              className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-500"
                            />
                          </div>

                          <div className="w-28 pb-2 text-right">
                            <span className="text-sm font-bold text-gray-900">
                              {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(item.quantity * item.unit_cost)}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeIssueItem(index)}
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
                  <p className="text-sm text-gray-500 uppercase tracking-wider font-bold">Valor de Salida</p>
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
                    disabled={loading || issueItems.length === 0 || issueItems.some(i => i.quantity > i.max_quantity)}
                    className="bg-amber-600 hover:bg-amber-700 text-white px-8 py-3 rounded-xl font-bold transition-colors disabled:opacity-50 shadow-md"
                  >
                    {loading ? t('Guardando...') : t('Registrar Salida')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Viewing Modal */}
      {viewingIssue && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
           <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
             <div className="flex justify-between items-start mb-6">
               <div>
                  <h3 className="text-2xl font-black text-gray-900 mb-1 flex items-center gap-2">
                    {t('Detalle de Salida')}
                    <span className={`text-xs px-2.5 py-1 rounded-full ${getIssueTypeColor(viewingIssue.issue_type)}`}>
                      {getIssueTypeLabel(viewingIssue.issue_type)}
                    </span>
                  </h3>
                  <p className="text-gray-500">{new Date(viewingIssue.issue_date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
               </div>
               <button onClick={() => setViewingIssue(null)} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full">
                 <X className="w-5 h-5" />
               </button>
             </div>

             {viewingIssue.notes && (
               <div className="mb-6">
                 <p className="text-xs text-gray-500 font-bold uppercase mb-1">{t('Motivo / Notas')}</p>
                 <p className="text-sm text-gray-800 bg-gray-50 p-3 rounded-lg border border-gray-200">{viewingIssue.notes}</p>
               </div>
             )}

             <h4 className="font-bold text-gray-900 mb-3">{t('Artículos')}</h4>
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
                  {viewingIssue.items?.map((item: InventoryIssueItem & { item: unknown }) => (
                    <tr key={item.id}>
                      <td className="py-3 font-medium text-gray-900">{item.item?.name}</td>
                      <td className="py-3 text-right">{item.quantity} <span className="text-gray-500 text-xs">{item.item?.unit}</span></td>
                      <td className="py-3 text-right">{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(item.unit_cost)}</td>
                      <td className="py-3 text-right font-bold">{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(item.total_value)}</td>
                    </tr>
                  ))}
                </tbody>
             </table>
           </div>
        </div>
      )}

      {/* Issues Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider rounded-tl-xl">{t('Fecha')}</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t('Tipo')}</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t('Motivo')}</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t('Registrado por')}</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t('Artículos')}</th>
              <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider rounded-tr-xl">{t('Acciones')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {issues.map((issue) => (
              <tr key={issue.id} className="hover:bg-amber-50/30 transition-colors group">
                <td className="px-6 py-4">
                  <div className="font-bold text-gray-900">
                    {new Date(issue.issue_date).toLocaleDateString('es-ES')}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(issue.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${getIssueTypeColor(issue.issue_type)}`}>
                    {getIssueTypeLabel(issue.issue_type)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-700 truncate max-w-[200px]">{issue.notes || '-'}</div>
                </td>
                <td className="px-6 py-4">
                  {/* @ts-expect-error - relation joined in query */}
                  <div className="text-sm text-gray-700">{issue.issued_by_profile?.full_name || '-'}</div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {/* @ts-expect-error - relation joined in query */}
                  {issue.items?.length || 0} {t('líneas')}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setViewingIssue(issue)}
                      className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                      title={t('Ver Detalles')}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(issue.id)}
                      className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                      title={t('Eliminar (Revierte stock)')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {issues.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500 bg-gray-50/50">
                  <FileMinus className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-lg font-medium">{t('No hay salidas registradas')}</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
