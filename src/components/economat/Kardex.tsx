import { useState, useEffect } from 'react';
import { Search, ArrowUpRight, ArrowDownRight, Package } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { useLanguage } from '../../contexts/LanguageContext';
import { InventoryItem } from '../../types/supabase';

interface Transaction {
  transaction_id: string;
  transaction_type: string;
  transaction_date: string;
  item_id: string;
  quantity: number;
  unit_cost: number;
  total_value: number;
  notes: string | null;
  user_id: string | null;
  created_at: string;
  user_name?: string;
}

export function Kardex() {
  const { t } = useLanguage();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    if (selectedItemId) {
      fetchTransactions(selectedItemId);
    } else {
      setTransactions([]);
    }
  }, [selectedItemId]);

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase.from('inventory_items').select('*').order('name');
      if (error) throw error;
      setItems(data || []);
      if (data && data.length > 0) {
        setSelectedItemId(data[0].id);
      }
    } catch (err) {
      console.error('Error fetching items:', err);
    }
  };

  const fetchTransactions = async (itemId: string) => {
    setLoading(true);
    try {
      // Obtenemos transacciones de la vista SQL
      const { data, error } = await supabase
        .from('inventory_transactions_view')
        .select('*')
        .eq('item_id', itemId)
        .order('transaction_date', { ascending: false });

      if (error) throw error;

      // Para los nombres de usuarios, haremos un fetch manual a employee_profiles
      // (ya que la vista no hace join con employee_profiles para simplificar)
      const userIds = [...new Set((data || []).map(t => t.user_id).filter(id => id))];
      
      let usersMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: usersData } = await supabase
          .from('employee_profiles')
          .select('id, full_name')
          .in('id', userIds);
          
        if (usersData) {
          usersMap = usersData.reduce((acc, user) => {
            acc[user.id] = user.full_name;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      const transactionsWithUsers = (data || []).map(t => ({
        ...t,
        user_name: t.user_id ? usersMap[t.user_id] : 'Sistema'
      }));

      setTransactions(transactionsWithUsers);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      toast.error('Error al cargar el historial del producto');
    } finally {
      setLoading(false);
    }
  };

  const selectedItem = items.find(i => i.id === selectedItemId);

  const getTransactionTypeLabel = (type: string) => {
    if (type === 'receipt') return 'Entrada (Compra)';
    if (type === 'issue_internal_use') return 'Salida (Uso Interno)';
    if (type === 'issue_loss') return 'Salida (Merma/Pérdida)';
    if (type === 'issue_expired') return 'Salida (Caducado)';
    if (type === 'issue_adjustment') return 'Ajuste de Inventario';
    return type;
  };

  return (
    <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Kardex (Libro Mayor)</h3>
          <p className="text-gray-500 text-sm">Historial detallado de movimientos por artículo</p>
        </div>
        
        <div className="w-full md:w-72 relative">
          <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <select
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 appearance-none font-medium text-gray-900"
          >
            {items.map(item => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </div>
      </div>

      {selectedItem && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
            <p className="text-amber-700 text-sm font-semibold mb-1">Stock Actual</p>
            <p className="text-2xl font-black text-amber-900">
              {selectedItem.current_stock} <span className="text-sm font-medium text-amber-700">{selectedItem.unit}</span>
            </p>
          </div>
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
            <p className="text-blue-700 text-sm font-semibold mb-1">Costo Unitario Ref.</p>
            <p className="text-2xl font-black text-blue-900">
              {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(selectedItem.unit_cost)}
            </p>
          </div>
          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
            <p className="text-emerald-700 text-sm font-semibold mb-1">Valor Total en Stock</p>
            <p className="text-2xl font-black text-emerald-900">
              {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(selectedItem.current_stock * selectedItem.unit_cost)}
            </p>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Cargando movimientos...</div>
        ) : transactions.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider rounded-tl-xl">Fecha</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Tipo de Movimiento</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Responsable</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Cantidad</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Costo U.</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider rounded-tr-xl">Valor Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map((tx) => {
                const isEntry = tx.quantity > 0;
                return (
                  <tr key={tx.transaction_id + tx.transaction_type} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-semibold text-gray-900">
                        {new Date(tx.transaction_date).toLocaleDateString('es-ES')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(tx.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {isEntry ? (
                          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                            <ArrowDownRight className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                            <ArrowUpRight className="w-4 h-4" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-bold text-gray-900">{getTransactionTypeLabel(tx.transaction_type)}</p>
                          {tx.notes && <p className="text-xs text-gray-500">{tx.notes}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-700 bg-gray-100 px-2.5 py-1 rounded-full inline-block font-medium">
                        {tx.user_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <span className={`font-black text-lg ${isEntry ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isEntry ? '+' : ''}{tx.quantity}
                      </span>
                      <span className="text-xs text-gray-500 ml-1">{selectedItem?.unit}</span>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap text-sm text-gray-600">
                      {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(tx.unit_cost)}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <span className={`font-bold ${isEntry ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(tx.total_value)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No hay movimientos registrados para este artículo.</p>
          </div>
        )}
      </div>
    </div>
  );
}
