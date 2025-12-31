import { useState, useEffect } from 'react';
import { Database, Download, Upload, HardDrive, AlertCircle, CheckCircle2, Clock, Trash2, RefreshCw, Settings, Wallet } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { AutomatedBackupConfig } from './AutomatedBackupConfig';
import { CashRegisterDashboard } from './CashRegisterDashboard';

interface BackupHistory {
  id: string;
  created_at: string;
  created_by: string;
  backup_type: 'manual' | 'automatic';
  size_mb: number;
  tables_included: string[];
  status: 'completed' | 'failed';
}

export function BackupManager() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'manual' | 'automated' | 'cash'>('manual');
  const [loading, setLoading] = useState(false);
  const [backupHistory, setBackupHistory] = useState<BackupHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Deleted Users States
  const [showDeletedUsersModal, setShowDeletedUsersModal] = useState(false);
  const [deletedUsers, setDeletedUsers] = useState<{ id: string, full_name: string, deleted_at: string, role: string }[]>([]);
  const [selectedDeletedUsers, setSelectedDeletedUsers] = useState<Set<string>>(new Set());
  const [loadingDeletedUsers, setLoadingDeletedUsers] = useState(false);

  const [selectedTables, setSelectedTables] = useState<string[]>([
    'products',
    'product_sizes',
    'categories',
    'orders',
    'order_items',
    'employee_profiles',
    'customers',
    'suppliers',
    'expenses',
    'cash_register_sessions',
    'cash_withdrawals',
    'employee_time_entries',
    'role_permissions',
    'company_settings',
    'app_settings',
    'tables',
    'servers',
    'backup_config'
  ]);

  const isSuperAdmin = profile?.role === 'super_admin';

  const allTables = [
    { id: 'products', name: t('Productos'), essential: true },
    { id: 'product_sizes', name: t('Tamaños de Productos'), essential: true },
    { id: 'categories', name: t('Categorías'), essential: true },
    { id: 'orders', name: t('Órdenes'), essential: true },
    { id: 'order_items', name: t('Items de Órdenes'), essential: true },
    { id: 'employee_profiles', name: t('Perfiles de Empleados'), essential: true },
    { id: 'customers', name: t('Clientes'), essential: false },
    { id: 'suppliers', name: t('Proveedores'), essential: false },
    { id: 'expenses', name: t('Gastos'), essential: false },
    { id: 'cash_register_sessions', name: t('Sesiones de Caja'), essential: true },
    { id: 'cash_withdrawals', name: t('Retiros de Caja'), essential: true },
    { id: 'employee_time_entries', name: t('Registro de Tiempo'), essential: false },
    { id: 'role_permissions', name: t('Permisos de Roles'), essential: true },
    { id: 'company_settings', name: t('Configuración de Empresa'), essential: true },
    { id: 'app_settings', name: t('Configuración de App'), essential: true },
    { id: 'tables', name: t('Mesas'), essential: true },
    { id: 'servers', name: t('Servidores'), essential: false },
    { id: 'backup_config', name: t('Configuración de Backups'), essential: false }
  ];

  useEffect(() => {
    if (isSuperAdmin) {
      loadBackupHistory();
    }
  }, [isSuperAdmin]);

  const loadBackupHistory = async () => {
    try {
      setLoadingHistory(true);
      const { data, error } = await supabase
        .from('backup_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setBackupHistory(data || []);
    } catch (error: any) {
      console.error('Error loading backup history:', error);
      // Si la tabla no existe, simplemente no mostramos historial
      setBackupHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCreateBackup = async () => {
    if (!isSuperAdmin) {
      toast.error(t('Solo el Super Administrador puede crear backups'));
      return;
    }

    if (selectedTables.length === 0) {
      toast.error(t('Selecciona al menos una tabla para el backup'));
      return;
    }

    setLoading(true);
    try {
      const backupData: any = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        tables: {},
        metadata: {
          created_by: profile?.full_name,
          created_at: new Date().toISOString(),
          tables_count: selectedTables.length
        }
      };

      let totalRecords = 0;

      // Exportar datos de cada tabla seleccionada
      for (const table of selectedTables) {
        try {
          const { data, error } = await supabase
            .from(table)
            .select('*');

          if (error) {
            console.error(`Error al exportar tabla ${table}:`, error);
            continue;
          }

          backupData.tables[table] = data || [];
          totalRecords += (data || []).length;
        } catch (err) {
          console.error(`Error processing table ${table}:`, err);
        }
      }

      // Calcular tamaño aproximado
      const jsonString = JSON.stringify(backupData, null, 2);
      const sizeInBytes = new Blob([jsonString]).size;
      const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);

      // Crear archivo de descarga
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup-coffe-${new Date().toISOString().split('T')[0]}-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Guardar registro en historial
      try {
        await supabase.from('backup_history').insert({
          created_by: profile?.id,
          backup_type: 'manual',
          size_mb: parseFloat(sizeInMB),
          tables_included: selectedTables,
          status: 'completed'
        });
      } catch (err) {
        console.log('Backup history table not available, skipping history save');
      }

      toast.success(t(`Backup creado exitosamente. ${totalRecords} registros exportados (${sizeInMB} MB)`));
      loadBackupHistory();
    } catch (error: any) {
      console.error('Error creating backup:', error);
      toast.error(t(`Error al crear backup: ${error.message}`));
      setLoading(false);
    }
  };

  const handleRestoreBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!confirm(t('¿Estás seguro de restaurar este backup? Esto podría sobrescribir datos existentes.'))) {
      return;
    }

    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const jsonContent = e.target?.result as string;
          const backupData = JSON.parse(jsonContent);

          if (!backupData.tables) throw new Error('Formato de backup inválido');

          // Orden específico de restauración para respetar claves foráneas
          const restoreOrder = [
            'categories',
            'products',
            'product_sizes',
            'employee_profiles',
            'tables',
            'customers',
            'suppliers',
            'orders',
            'order_items',
            'cash_register_sessions',
            'cash_withdrawals',
            'expenses',
            'company_settings',
            'app_settings',
            'role_permissions',
            'backup_config'
          ];

          let successCount = 0;

          for (const table of restoreOrder) {
            const tableData = backupData.tables[table];
            if (tableData && Array.isArray(tableData) && tableData.length > 0) {
              const { error } = await supabase.from(table).upsert(tableData);
              if (error) {
                console.error(`Error restoring ${table}:`, error);
                toast.error(`Error en tabla ${table}: ${error.message}`);
              } else {
                successCount++;
              }
            }
          }

          toast.success(t(`Restauración completada. ${successCount} tablas procesadas.`));
          event.target.value = '';
        } catch (err: any) {
          console.error('Error parsing backup:', err);
          toast.error(t('Error al leer archivo de backup'));
        }
      };
      reader.readAsText(file);
    } catch (error: any) {
      toast.error(t(`Error de restauración: ${error.message}`));
    } finally {
      setLoading(false);
    }
  };

  const handleResetDatabase = async () => {
    if (!confirm(t('PELIGRO CRÍTICO: ¿Estás SEGURO de borrar TODA la base de datos?\n\nSe eliminarán:\n- Ventas\n- Productos\n- Categorías\n- Configuraciones\n\nSolo quedarán los usuarios Admin. NO SE PUEDE DESHACER.'))) {
      return;
    }

    const verification = prompt(t('Escribe "BORRAR TODO" para confirmar el formateo total:'));
    if (verification !== 'BORRAR TODO') {
      toast.error(t('Verificación fallida'));
      return;
    }

    setLoading(true);
    try {
      // Orden inverso para borrado total
      const deleteOrder = [
        'order_items',
        'orders',
        'cash_withdrawals',
        'cash_register_sessions',
        'expenses',
        'employee_time_entries',
        'product_sizes',
        'products',
        'categories',
        'customers',
        'suppliers',
        'tables',
        'backup_config',
        'company_settings',
        'app_settings'
      ];

      // Borrar datos
      for (const table of deleteOrder) {
        await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
        // Fallback para tablas sin UUID estándar o RLS
        await supabase.from(table).delete().gt('created_at', '1970-01-01');
      }

      toast.success(t('Base de datos formateada correctamente.'));
    } catch (error: any) {
      console.error('Reset error:', error);
      toast.error(t('Error al resetear: ' + error.message));
    } finally {
      setLoading(false);
    }
  };

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetSelection, setResetSelection] = useState<string[]>([]);

  const operationalTables = [
    { id: 'orders', name: t('Ventas y Pedidos') },
    { id: 'cash_register_sessions', name: t('Sesiones de Caja') },
    { id: 'cash_withdrawals', name: t('Retiros de Caja') },
    { id: 'expenses', name: t('Gastos') },
    { id: 'employee_time_entries', name: t('Registro de Tiempo') },
    { id: 'company_settings', name: t('Configuración de Empresa') },
    { id: 'app_settings', name: t('Configuración de App') },
    { id: 'backup_config', name: t('Configuración de Backups') }
  ];

  /* ... previous functions ... */

  const handleResetOperationalData = () => {
    // Select all by default
    setResetSelection(operationalTables.map(t => t.id));
    setShowResetModal(true);
  };

  const executeOperationalReset = async () => {
    if (resetSelection.length === 0) {
      toast.error(t('Selecciona al menos un elemento para eliminar'));
      return;
    }

    if (!confirm(t(`¿Estás seguro de eliminar los datos seleccionados (${resetSelection.length} categorías)? Esta acción no se puede deshacer.`))) {
      return;
    }

    setLoading(true);
    try {
      // 1. Definir el orden ESTRICTO de dependencias (Hijo -> Padre)
      const strictDeleteOrder = [
        'order_items',          // Depende de orders
        'orders',               // Padre de order_items
        'cash_withdrawals',     // Depende de sessions
        'cash_register_sessions', // Padre de withdrawals
        'expenses',
        'employee_time_entries',
        'backup_config',
        'company_settings',
        'app_settings'
      ];

      // 2. Determinar qué tablas vamos a borrar basándonos en la selección
      const tablesToDelete = new Set<string>();

      // Lógica de dependencias automática
      if (resetSelection.includes('orders')) {
        tablesToDelete.add('order_items');
        tablesToDelete.add('orders');
      }

      if (resetSelection.includes('cash_register_sessions')) {
        tablesToDelete.add('cash_withdrawals');
        tablesToDelete.add('cash_register_sessions');
      } else if (resetSelection.includes('cash_withdrawals')) {
        tablesToDelete.add('cash_withdrawals');
      }

      // Añadir el resto de selecciones directas
      resetSelection.forEach(table => {
        if (!tablesToDelete.has(table)) {
          tablesToDelete.add(table);
        }
      });

      // 3. Ejecutar borrado en el orden correcto
      let totalDeleted = 0;
      for (const table of strictDeleteOrder) {
        if (tablesToDelete.has(table)) {
          console.log(`Deleting from ${table}...`);
          // @ts-ignore
          const { error, count } = await supabase.from(table).delete({ count: 'exact' }).neq('id', '00000000-0000-0000-0000-000000000000');

          if (error) {
            console.error(`Error deleting ${table}:`, error);
            // Intento fallback por si es error de UUID
            await supabase.from(table).delete().gt('created_at', '1970-01-01');
          } else {
            console.log(`Deleted ${count} rows from ${table}`);
            if (count !== null) totalDeleted += count;
          }
        }
      }

      if (totalDeleted === 0) {
        toast.error(t('No se borraron datos. Verifica los permisos (RLS) en Supabase.'));
      } else {
        toast.success(t(`Datos eliminados correctamente (${totalDeleted} registros).`));
      }
      setShowResetModal(false);
    } catch (error: any) {
      console.error('Operational reset error:', error);
      toast.error(t('Error al limpiar datos: ' + error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleTableToggle = (tableId: string) => {
    setSelectedTables(prev =>
      prev.includes(tableId)
        ? prev.filter(t => t !== tableId)
        : [...prev, tableId]
    );
  };

  const selectAllTables = () => {
    setSelectedTables(allTables.map(t => t.id));
  };

  // Deleted Users Logic
  const fetchDeletedUsers = async () => {
    setLoadingDeletedUsers(true);
    try {
      const { data, error } = await supabase
        .from('employee_profiles')
        .select('id, full_name, deleted_at, role')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (error) throw error;
      setDeletedUsers(data || []);
    } catch (err) {
      console.error('Error fetching deleted users:', err);
      toast.error('Error al cargar usuarios eliminados');
    } finally {
      setLoadingDeletedUsers(false);
    }
  };

  const handlePermanentDeleteUsers = async () => {
    if (selectedDeletedUsers.size === 0) return;

    if (!window.confirm(t('Esta acción no se puede deshacer. ¿Estás seguro?'))) return;

    setLoadingDeletedUsers(true);
    try {
      const idsToDelete = Array.from(selectedDeletedUsers);
      const { error } = await supabase
        .from('employee_profiles')
        .delete()
        .in('id', idsToDelete);

      if (error) throw error;

      toast.success(t('Usuario eliminado permanentemente'));
      setSelectedDeletedUsers(new Set());
      fetchDeletedUsers(); // Refresh list
    } catch (err: any) {
      console.error('Error deleting users:', err);
      toast.error(`${t('Error al eliminar usuario')}: ${err.message}`);
    } finally {
      setLoadingDeletedUsers(false);
    }
  };

  const toggleDeletedUserSelection = (id: string) => {
    const newSet = new Set(selectedDeletedUsers);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedDeletedUsers(newSet);
  };

  const selectAllDeletedUsers = () => {
    if (selectedDeletedUsers.size === deletedUsers.length) {
      setSelectedDeletedUsers(new Set());
    } else {
      setSelectedDeletedUsers(new Set(deletedUsers.map(u => u.id)));
    }
  };

  const selectEssentialTables = () => {
    setSelectedTables(allTables.filter(t => t.essential).map(t => t.id));
  };

  const deselectAllTables = () => {
    setSelectedTables([]);
  };

  if (!isSuperAdmin) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <AlertCircle className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-yellow-900 mb-2">
            {t('Acceso Restringido')}
          </h3>
          <p className="text-yellow-700">
            {t('Solo el Super Administrador puede acceder a la gestión de backups.')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <Database className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t('Gestión de Backups')}</h2>
            <p className="text-sm text-gray-600">{t('Crea y administra copias de seguridad de tu base de datos')}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('manual')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === 'manual'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
          >
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              {t('Backup Manual')}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('automated')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === 'automated'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
          >
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              {t('Backup Automático')}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('cash')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === 'cash'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
          >
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              {t('Gestión de Caja')}
            </div>
          </button>
        </div>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'automated' ? (
        <AutomatedBackupConfig />
      ) : activeTab === 'cash' ? (
        <CashRegisterDashboard />
      ) : (
        <div>

          {/* Info Alert */}
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">{t('Información Importante')}</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>{t('Los backups se descargan en formato JSON en tu dispositivo')}</li>
                  <li>{t('Guarda los backups en un lugar seguro fuera del servidor')}</li>
                  <li>{t('Se recomienda realizar backups periódicamente (diario/semanal)')}</li>
                  <li>{t('Los backups incluyen toda la información de las tablas seleccionadas')}</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Selección de Tablas */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <HardDrive className="w-5 h-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">{t('Seleccionar Tablas')}</h3>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={selectAllTables}
                  className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                >
                  {t('Todas')}
                </button>
                <button
                  onClick={selectEssentialTables}
                  className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                >
                  {t('Esenciales')}
                </button>
                <button
                  onClick={deselectAllTables}
                  className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                >
                  {t('Ninguna')}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {allTables.map(table => (
                <label
                  key={table.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${selectedTables.includes(table.id)
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedTables.includes(table.id)}
                    onChange={() => handleTableToggle(table.id)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${selectedTables.includes(table.id) ? 'text-indigo-900' : 'text-gray-900'
                      }`}>
                      {table.name}
                    </p>
                    {table.essential && (
                      <span className="text-xs text-green-600 font-medium">{t('Esencial')}</span>
                    )}
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                <strong>{selectedTables.length}</strong> {t('de')} <strong>{allTables.length}</strong> {t('tablas seleccionadas')}
              </p>
            </div>
          </div>

          {/* Deleted Users Management Button */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{t('Gestión de Usuarios Eliminados')}</h3>
                <p className="text-sm text-gray-600">
                  {t('Eliminar permanentemente usuarios que fueron borrados lógicamente.')}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowDeletedUsersModal(true);
                  fetchDeletedUsers();
                }}
                className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-2 border border-red-200"
              >
                <Trash2 className="w-4 h-4" />
                {t('Usuarios Eliminados')}
              </button>
            </div>
          </div>

          {/* Deleted Users Modal */}
          {showDeletedUsersModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                  <h3 className="text-xl font-bold text-gray-900">{t('Usuarios Eliminados')}</h3>
                  <button onClick={() => setShowDeletedUsersModal(false)} className="text-gray-400 hover:text-gray-600">
                    <span className="sr-only">Cerrar</span>
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                  {loadingDeletedUsers ? (
                    <div className="text-center py-8">
                      <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                      <p className="text-gray-500">Cargando...</p>
                    </div>
                  ) : deletedUsers.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      {t('No hay usuarios eliminados en el sistema')}
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center mb-4">
                        <button
                          onClick={selectAllDeletedUsers}
                          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          {selectedDeletedUsers.size === deletedUsers.length ? 'Deseleccionar todos' : t('Seleccionar Todo')}
                        </button>
                        <span className="text-sm text-gray-500">
                          {selectedDeletedUsers.size} seleccionados
                        </span>
                      </div>
                      <div className="space-y-2">
                        {deletedUsers.map(user => (
                          <div key={user.id} className={`flex items-center justify-between p-3 rounded-lg border ${selectedDeletedUsers.has(user.id) ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={selectedDeletedUsers.has(user.id)}
                                onChange={() => toggleDeletedUserSelection(user.id)}
                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                              />
                              <div>
                                <p className="font-medium text-gray-900">{user.full_name}</p>
                                <p className="text-xs text-gray-500">
                                  Rol: {user.role} • Borrado: {new Date(user.deleted_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
                  <button
                    onClick={() => setShowDeletedUsersModal(false)}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handlePermanentDeleteUsers}
                    disabled={selectedDeletedUsers.size === 0 || loadingDeletedUsers}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    {t('Eliminar Permanentemente')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Acción de Backup */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('Crear Backup')}</h3>
            <p className="text-sm text-gray-600 mb-4">
              {t('El backup se descargará como archivo JSON en tu dispositivo. Guárdalo en un lugar seguro.')}
            </p>

            <button
              onClick={handleCreateBackup}
              disabled={loading || selectedTables.length === 0}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  {t('Creando Backup...')}
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  {t('Descargar Backup Ahora')}
                </>
              )}
            </button>
          </div>

          {/* Restauración */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('Restaurar Backup')}</h3>
            <p className="text-sm text-gray-600 mb-4">
              {t('Sube un archivo JSON de backup para restaurar la información. Los datos existentes con el mismo ID se actualizarán.')}
            </p>
            <div className="flex gap-4 items-center">
              <label className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-indigo-600 text-indigo-700 hover:bg-indigo-50 rounded-lg font-medium cursor-pointer transition-all">
                <Upload className="w-5 h-5" />
                {t('Subir Archivo de Respaldo')}
                <input
                  type="file"
                  accept=".json"
                  onChange={handleRestoreBackup}
                  className="hidden"
                  disabled={loading}
                />
              </label>
              {loading && <span className="text-sm text-gray-500 animate-pulse">{t('Procesando archivo...')}</span>}
            </div>
          </div>

          {/* ZONA DE PELIGRO */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <h3 className="text-lg font-bold text-red-700">{t('Zona de Peligro')}</h3>
            </div>
            <p className="text-sm text-red-800 mb-6 font-medium">
              {t('Estas acciones son destructivas. Lee atentamente antes de continuar.')}
            </p>

            <div className="flex flex-col md:flex-row gap-4">
              <button
                onClick={handleResetDatabase}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-all shadow-sm hover:shadow-md"
              >
                <Trash2 className="w-5 h-5" />
                {t('FORMATEAR TODO (Reset Completo)')}
              </button>

              <button
                onClick={handleResetOperationalData}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold transition-all shadow-sm hover:shadow-md"
              >
                <Database className="w-5 h-5" />
                {t('Limpiar Historial Operativo')}
              </button>
            </div>
            <p className="text-xs text-red-600 mt-3">
              * {t('Formatear Todo: Borra ventas, productos, clientes, todo. Solo deja usuarios admin.')}<br />
              * {t('Limpiar Historial: Borra ventas, cierres y gastos. Mantiene productos, categorías, empleados y configuraciones.')}
            </p>
          </div>

          {/* Historial de Backups */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">{t('Historial de Backups')}</h3>
            </div>

            {loadingHistory ? (
              <div className="text-center py-8">
                <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-2" />
                <p className="text-sm text-gray-500">{t('Cargando historial...')}</p>
              </div>
            ) : backupHistory.length === 0 ? (
              <div className="text-center py-8">
                <Database className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">{t('No hay backups registrados aún')}</p>
                <p className="text-xs text-gray-400 mt-1">{t('Los backups creados aparecerán aquí')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {backupHistory.map((backup) => (
                  <div
                    key={backup.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {backup.status === 'completed' ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      )}
                      <div>
                        <p className="font-medium text-gray-900">
                          {new Date(backup.created_at).toLocaleString('es-ES')}
                        </p>
                        <p className="text-sm text-gray-600">
                          {backup.backup_type === 'manual' ? t('Manual') : t('Automático')} • {backup.size_mb.toFixed(2)} MB • {backup.tables_included.length} {t('tablas')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs font-semibold rounded ${backup.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                        }`}>
                        {backup.status === 'completed' ? t('Completado') : t('Fallido')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recomendaciones */}
          <div className="mt-6 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-purple-900 mb-3">{t('Recomendaciones')}</h3>
            <ul className="space-y-2 text-sm text-purple-800">
              <li className="flex gap-2">
                <CheckCircle2 className="w-5 h-5 text-purple-600 flex-shrink-0" />
                <span>{t('Realiza backups antes de actualizar la aplicación o hacer cambios importantes')}</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="w-5 h-5 text-purple-600 flex-shrink-0" />
                <span>{t('Guarda los backups en múltiples ubicaciones (nube, disco externo, etc.)')}</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="w-5 h-5 text-purple-600 flex-shrink-0" />
                <span>{t('Verifica periódicamente que los backups se puedan restaurar correctamente')}</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="w-5 h-5 text-purple-600 flex-shrink-0" />
                <span>{t('Mantén al menos 3 copias de backups recientes')}</span>
              </li>
            </ul>
          </div>
        </div>
      )}
      {/* Modal de Selección para Borrado Operativo */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 transform scale-100 transition-all">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Database className="w-6 h-6 text-orange-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">{t('Limpieza Selectiva')}</h3>
              </div>
              <button
                onClick={() => setShowResetModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-6">
              {t('Selecciona qué datos deseas eliminar permanentemente. Los datos no seleccionados se conservarán.')}
            </p>

            <div className="space-y-3 mb-6">
              {operationalTables.map((table) => (
                <label key={table.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={resetSelection.includes(table.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setResetSelection([...resetSelection, table.id]);
                      } else {
                        setResetSelection(resetSelection.filter(id => id !== table.id));
                      }
                    }}
                    className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                  />
                  <span className="font-medium text-gray-700">{table.name}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowResetModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
              >
                {t('Cancelar')}
              </button>
              <button
                onClick={executeOperationalReset}
                disabled={loading || resetSelection.length === 0}
                className="flex-1 px-4 py-2 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {t('Eliminar Seleccionados')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
