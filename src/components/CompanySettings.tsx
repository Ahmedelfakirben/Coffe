import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, MapPin, Phone, Save, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface CompanySettings {
  id: string;
  company_name: string;
  address: string;
  phone: string;
}

export function CompanySettings() {
  const [settings, setSettings] = useState<CompanySettings>({
    id: '',
    company_name: '',
    address: '',
    phone: '',
  });
  const [originalSettings, setOriginalSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchSettings();
    ensureSuperAdminPermissions();
  }, []);

  useEffect(() => {
    if (originalSettings) {
      const changed = JSON.stringify(settings) !== JSON.stringify(originalSettings);
      setHasChanges(changed);
    }
  }, [settings, originalSettings]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      console.log('🔍 COMPANY SETTINGS: Fetching current settings...');
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No data found, create default settings
          console.log('⚠️ COMPANY SETTINGS: No company settings found, creating defaults...');
          await createDefaultSettings();
        } else {
          console.error('❌ COMPANY SETTINGS: Error fetching settings:', error);
          throw error;
        }
      } else if (data) {
        console.log('✅ COMPANY SETTINGS: Settings loaded successfully:', data);
        setSettings(data);
        setOriginalSettings(data);
      } else {
        console.log('⚠️ COMPANY SETTINGS: No data returned from query');
      }
    } catch (error) {
      console.error('💥 COMPANY SETTINGS: Error fetching company settings:', error);
      toast.error('Error al cargar configuración de la empresa');
    } finally {
      setLoading(false);
    }
  };

  const createDefaultSettings = async () => {
    try {
      console.log('🏗️ COMPANY SETTINGS: Creating default settings...');
      const defaultData = {
        company_name: 'El Fakir',
        address: 'Calle Principal #123, Ciudad',
        phone: '+34 000 000 000'
      };
      console.log('📋 COMPANY SETTINGS: Default data to insert:', defaultData);

      const { data, error } = await supabase
        .from('company_settings')
        .insert(defaultData)
        .select()
        .single();

      if (error) {
        console.error('❌ COMPANY SETTINGS: Error creating default settings:', error);
        throw error;
      }

      if (data) {
        console.log('✅ COMPANY SETTINGS: Default settings created successfully:', data);
        setSettings(data);
        setOriginalSettings(data);
        toast.success('Configuración por defecto creada');
      } else {
        console.log('⚠️ COMPANY SETTINGS: No data returned after creating default settings');
      }
    } catch (error) {
      console.error('💥 COMPANY SETTINGS: Error creating default settings:', error);
      toast.error('Error al crear configuración por defecto');
    }
  };

  const ensureSuperAdminPermissions = async () => {
    try {
      // Ensure super_admin has access to critical system pages
      const permissionsToEnsure = [
        { role: 'super_admin', section: 'Sistema', page_id: 'company-settings', can_access: true },
        { role: 'super_admin', section: 'Sistema', page_id: 'role-management', can_access: true }
      ];

      for (const perm of permissionsToEnsure) {
        const { error } = await supabase
          .from('role_permissions')
          .upsert(perm, {
            onConflict: 'role,section,page_id'
          });

        if (error) {
          console.error('Error ensuring super_admin permissions:', error);
        }
      }

      console.log('Super admin permissions verified');
    } catch (error) {
      console.error('Error ensuring permissions:', error);
    }
  };

  const restoreAllPermissions = async () => {
    try {
      toast.loading('Restaurando permisos...', { id: 'restore' });

      // All permissions for super_admin
      const allPermissions = [
        { role: 'super_admin', section: 'Ventas', page_id: 'floor', can_access: true },
        { role: 'super_admin', section: 'Ventas', page_id: 'pos', can_access: true },
        { role: 'super_admin', section: 'Ventas', page_id: 'orders', can_access: true },
        { role: 'super_admin', section: 'Inventario', page_id: 'products', can_access: true },
        { role: 'super_admin', section: 'Inventario', page_id: 'categories', can_access: true },
        { role: 'super_admin', section: 'Inventario', page_id: 'users', can_access: true },
        { role: 'super_admin', section: 'Finanzas', page_id: 'cash', can_access: true },
        { role: 'super_admin', section: 'Finanzas', page_id: 'time-tracking', can_access: true },
        { role: 'super_admin', section: 'Finanzas', page_id: 'suppliers', can_access: true },
        { role: 'super_admin', section: 'Finanzas', page_id: 'expenses', can_access: true },
        { role: 'super_admin', section: 'Finanzas', page_id: 'analytics', can_access: true },
        { role: 'super_admin', section: 'Sistema', page_id: 'role-management', can_access: true },
        { role: 'super_admin', section: 'Sistema', page_id: 'company-settings', can_access: true }
      ];

      for (const perm of allPermissions) {
        const { error } = await supabase
          .from('role_permissions')
          .upsert(perm, {
            onConflict: 'role,section,page_id'
          });

        if (error) {
          console.error('Error restoring permissions:', error);
        }
      }

      toast.success('Todos los permisos restaurados para super_admin', { id: 'restore' });
    } catch (error) {
      console.error('Error restoring permissions:', error);
      toast.error('Error al restaurar permisos', { id: 'restore' });
    }
  };

  const forceRefreshTickets = () => {
    console.log('🔄 COMPANY SETTINGS: Force refreshing all ticket printers...');
    window.dispatchEvent(new CustomEvent('companySettingsUpdated', {
      detail: settings
    }));
    toast.success('Ticket printers refreshed');
  };

  const checkDatabaseDirectly = async () => {
    try {
      console.log('🔍 COMPANY SETTINGS: Checking database directly...');
      const { data, error } = await supabase
        .from('company_settings')
        .select('*');

      if (error) {
        console.error('❌ COMPANY SETTINGS: Database query error:', error);
        toast.error('Error querying database');
        return;
      }

      console.log('📋 COMPANY SETTINGS: Direct database query result:', data);
      toast.success('Check console for database contents');
    } catch (error) {
      console.error('💥 COMPANY SETTINGS: Error checking database:', error);
      toast.error('Error checking database');
    }
  };

  const handleSave = async () => {
    if (!settings.company_name.trim()) {
      toast.error('El nombre de la empresa es obligatorio');
      return;
    }

    setSaving(true);
    try {
      const settingsData = {
        company_name: settings.company_name.trim(),
        address: settings.address ? settings.address.trim() : null,
        phone: settings.phone ? settings.phone.trim() : null,
      };

      console.log('💾 COMPANY SETTINGS: Saving company settings:', settingsData);
      console.log('📝 COMPANY SETTINGS: Current settings state:', settings);

      // First, check if a record already exists
      console.log('🔍 COMPANY SETTINGS: Checking for existing record...');
      const { data: existingRecord, error: checkError } = await supabase
        .from('company_settings')
        .select('*')
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('❌ COMPANY SETTINGS: Error checking existing record:', checkError);
      } else {
        console.log('📋 COMPANY SETTINGS: Existing record found:', existingRecord);
      }

      let result;

      if (existingRecord) {
        // Update existing record
        console.log('🔄 COMPANY SETTINGS: Updating existing record with ID:', existingRecord.id);
        result = await supabase
          .from('company_settings')
          .update(settingsData)
          .eq('id', existingRecord.id)
          .select()
          .single();
      } else {
        // Create new record
        console.log('➕ COMPANY SETTINGS: Creating new company settings record');
        result = await supabase
          .from('company_settings')
          .insert(settingsData)
          .select()
          .single();
      }

      if (result.error) {
        console.error('❌ COMPANY SETTINGS: Database error:', result.error);
        throw result.error;
      }

      console.log('✅ COMPANY SETTINGS: Save result:', result.data);

      // Verify the data was actually saved
      console.log('🔍 COMPANY SETTINGS: Verifying save by re-fetching...');
      const { data: verifyData, error: verifyError } = await supabase
        .from('company_settings')
        .select('*')
        .single();

      if (verifyError) {
        console.error('❌ COMPANY SETTINGS: Error verifying save:', verifyError);
      } else {
        console.log('✅ COMPANY SETTINGS: Verification - data in database:', verifyData);
      }

      // Update the settings with the saved data
      if (result.data) {
        setSettings(result.data);
        setOriginalSettings(result.data);
        setHasChanges(false);

        // Dispatch custom event to notify other components
        console.log('📡 COMPANY SETTINGS: Dispatching companySettingsUpdated event with data:', result.data);
        window.dispatchEvent(new CustomEvent('companySettingsUpdated', {
          detail: result.data
        }));

        toast.success('Configuración guardada correctamente');
      }
    } catch (error: any) {
      console.error('Error saving company settings:', error);
      toast.error(`Error al guardar la configuración: ${error.message || error}`);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (originalSettings) {
      setSettings({ ...originalSettings });
      setHasChanges(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Información de la Empresa</h2>
              <p className="text-sm text-gray-600">Configure los datos que aparecen en tickets y reportes</p>
            </div>
          </div>

          {hasChanges && (
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Deshacer
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Guardar Cambios
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Nota informativa */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">Esta información aparecerá en:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li>Todos los tickets de venta impresos</li>
              <li>Reportes Excel exportados desde Analíticas</li>
              <li>Reportes de tiempo de empleados</li>
              <li>Cualquier documento generado por el sistema</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Emergency permissions restore for super_admin */}
      <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-800">
            <p className="font-semibold mb-2">¿Problemas con permisos?</p>
            <p className="mb-3">Si no puedes acceder a esta página o a la gestión de roles, usa el botón de emergencia para restaurar todos los permisos del super_admin.</p>
            <button
              onClick={restoreAllPermissions}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              Restaurar Todos los Permisos (Super Admin)
            </button>
          </div>
        </div>
      </div>

      {/* Debug information and testing tools */}
      <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-800 w-full">
            <p className="font-semibold mb-2">🔧 Debug Information:</p>
            <div className="space-y-1 text-xs mb-3">
              <p><strong>Current Company Name:</strong> {settings.company_name || 'Not set'}</p>
              <p><strong>Current Address:</strong> {settings.address || 'Not set'}</p>
              <p><strong>Current Phone:</strong> {settings.phone || 'Not set'}</p>
              <p><strong>Settings ID:</strong> {settings.id || 'No ID (new record)'}</p>
              <p><strong>Has Changes:</strong> {hasChanges ? 'Yes' : 'No'}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={checkDatabaseDirectly}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs"
              >
                🔍 Check Database
              </button>
              <button
                onClick={forceRefreshTickets}
                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs"
              >
                🔄 Force Refresh Tickets
              </button>
              <button
                onClick={restoreAllPermissions}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
              >
                🔐 Restore Permissions
              </button>
            </div>

            <p className="mt-2 text-xs text-gray-600">
              💡 Use these buttons to debug the issue. Check browser console for detailed logs.
            </p>
          </div>
        </div>
      </div>

      {/* Formulario */}
      <div className="bg-white rounded-xl shadow-sm p-6 max-w-2xl">
        <div className="space-y-6">
          {/* Nombre de la empresa */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Building2 className="w-4 h-4 text-gray-500" />
              Nombre de la Empresa *
            </label>
            <input
              type="text"
              value={settings.company_name}
              onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ej: Coffee Shop"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Este nombre aparecerá en todos los documentos</p>
          </div>

          {/* Dirección */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <MapPin className="w-4 h-4 text-gray-500" />
              Dirección
            </label>
            <textarea
              value={settings.address}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ej: Calle Principal #123, Ciudad"
              rows={3}
            />
            <p className="text-xs text-gray-500 mt-1">Dirección física de la empresa</p>
          </div>

          {/* Teléfono */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Phone className="w-4 h-4 text-gray-500" />
              Número de Teléfono
            </label>
            <input
              type="tel"
              value={settings.phone}
              onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ej: +34 000 000 000"
            />
            <p className="text-xs text-gray-500 mt-1">Número de contacto para clientes</p>
          </div>
        </div>

        {/* Vista previa */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Vista Previa (Tickets)</h3>
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 font-mono text-sm">
            <div className="text-center space-y-1">
              <p className="font-bold text-base">{settings.company_name || 'Nombre de empresa'}</p>
              {settings.address && <p className="text-xs text-gray-600">{settings.address}</p>}
              {settings.phone && <p className="text-xs text-gray-600">Tel: {settings.phone}</p>}
            </div>
            <div className="border-t border-gray-300 my-3"></div>
            <p className="text-xs text-gray-500 text-center">Información de pedido...</p>
          </div>
        </div>
      </div>
    </div>
  );
}
