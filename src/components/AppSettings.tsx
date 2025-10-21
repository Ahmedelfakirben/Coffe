import { useState, useEffect } from 'react';
import { Settings, Globe, Palette, Save, Check } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useLanguage, Language } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

interface AppSettings {
  language: Language;
  theme: 'light' | 'dark' | 'auto';
}

export function AppSettings() {
  const { currentLanguage, setLanguage, t } = useLanguage();
  const { profile } = useAuth();
  const [settings, setSettings] = useState<AppSettings>({
    language: currentLanguage,
    theme: 'auto',
  });
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const isSuperAdmin = profile?.role === 'super_admin';

  useEffect(() => {
    // Cargar configuración guardada
    const savedSettings = localStorage.getItem('app-settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(parsed);
      } catch (error) {
        console.error('Error loading app settings:', error);
      }
    }
  }, []);

  useEffect(() => {
    // Verificar si hay cambios
    const savedSettings = localStorage.getItem('app-settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        const changed = JSON.stringify(settings) !== JSON.stringify(parsed);
        setHasChanges(changed);
      } catch (error) {
        setHasChanges(true);
      }
    } else {
      setHasChanges(true);
    }
  }, [settings]);

  const handleLanguageChange = async (newLanguage: Language) => {
    try {
      setSettings(prev => ({ ...prev, language: newLanguage }));
      await setLanguage(newLanguage);
      toast.success(t('messages.language-changed'));
    } catch (error) {
      console.error('Error changing language:', error);
      toast.error(t('common.error'));
      // Revertir el cambio en el UI si hubo error
      setSettings(prev => ({ ...prev, language: currentLanguage }));
    }
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'auto') => {
    setSettings(prev => ({ ...prev, theme: newTheme }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      localStorage.setItem('app-settings', JSON.stringify(settings));
      toast.success(t('messages.settings-saved'));
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    const savedSettings = localStorage.getItem('app-settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(parsed);
      } catch (error) {
        console.error('Error resetting settings:', error);
      }
    }
  };

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Settings className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{t('nav.app-settings')}</h2>
              <p className="text-sm text-gray-600">{t('settings.general.description')}</p>
            </div>
          </div>

          {hasChanges && (
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    {t('common.loading')}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {t('common.save')}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Información sobre cambios */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <Check className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">{t('Configuración de la aplicación')}</p>
            <p>{t('Personaliza el idioma y la apariencia de la aplicación. Los cambios se aplican inmediatamente.')}</p>
          </div>
        </div>
      </div>

      {/* Configuración de idioma - Solo para Super Admin */}
      {isSuperAdmin && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">{t('settings.language')}</h3>
            <span className="px-2 py-1 text-xs font-semibold bg-purple-100 text-purple-700 rounded">
              {t('Super Administrador')}
            </span>
          </div>

          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>⚠️ {t('Información')}:</strong> {t('El cambio de idioma se aplicará a todos los usuarios del sistema de forma inmediata.')}
            </p>
          </div>

          <p className="text-sm text-gray-600 mb-4">{t('settings.language.description')}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => handleLanguageChange('es')}
              className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                settings.language === 'es'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                settings.language === 'es' ? 'border-blue-500' : 'border-gray-300'
              }`}>
                {settings.language === 'es' && <div className="w-2 h-2 rounded-full bg-blue-500"></div>}
              </div>
              <div className="text-left">
                <p className="font-medium">{t('settings.language.es')}</p>
                <p className="text-xs text-gray-500">{t('Español')}</p>
              </div>
            </button>

            <button
              onClick={() => handleLanguageChange('fr')}
              className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                settings.language === 'fr'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                settings.language === 'fr' ? 'border-blue-500' : 'border-gray-300'
              }`}>
                {settings.language === 'fr' && <div className="w-2 h-2 rounded-full bg-blue-500"></div>}
              </div>
              <div className="text-left">
                <p className="font-medium">{t('settings.language.fr')}</p>
                <p className="text-xs text-gray-500">{t('Français')}</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Configuración de tema */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Palette className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">{t('settings.theme')}</h3>
        </div>

        <p className="text-sm text-gray-600 mb-4">{t('Selecciona el tema de color de la aplicación')}</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => handleThemeChange('light')}
            className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
              settings.theme === 'light'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
              settings.theme === 'light' ? 'border-blue-500' : 'border-gray-300'
            }`}>
              {settings.theme === 'light' && <div className="w-2 h-2 rounded-full bg-blue-500"></div>}
            </div>
            <div className="text-left">
              <p className="font-medium">{t('settings.theme.light')}</p>
              <p className="text-xs text-gray-500">{t('Tema claro')}</p>
            </div>
          </button>

          <button
            onClick={() => handleThemeChange('dark')}
            className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
              settings.theme === 'dark'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
              settings.theme === 'dark' ? 'border-blue-500' : 'border-gray-300'
            }`}>
              {settings.theme === 'dark' && <div className="w-2 h-2 rounded-full bg-blue-500"></div>}
            </div>
            <div className="text-left">
              <p className="font-medium">{t('settings.theme.dark')}</p>
              <p className="text-xs text-gray-500">{t('Tema oscuro')}</p>
            </div>
          </button>

          <button
            onClick={() => handleThemeChange('auto')}
            className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
              settings.theme === 'auto'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
              settings.theme === 'auto' ? 'border-blue-500' : 'border-gray-300'
            }`}>
              {settings.theme === 'auto' && <div className="w-2 h-2 rounded-full bg-blue-500"></div>}
            </div>
            <div className="text-left">
              <p className="font-medium">{t('settings.theme.auto')}</p>
              <p className="text-xs text-gray-500">{t('Automático')}</p>
            </div>
          </button>
        </div>
      </div>

      {/* Información adicional */}
      <div className="bg-gray-50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('Información')}</h3>
        <div className="space-y-3 text-sm text-gray-600">
          <p>• {t('Los cambios de idioma se aplican inmediatamente a toda la aplicación')}</p>
          <p>• {t('La configuración se guarda automáticamente en tu navegador')}</p>
          <p>• {t('Puedes cambiar entre idiomas en cualquier momento')}</p>
          <p>• {t('El tema automático sigue la configuración de tu sistema operativo')}</p>
        </div>
      </div>
    </div>
  );
}