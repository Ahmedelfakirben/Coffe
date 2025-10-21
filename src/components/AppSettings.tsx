import { Settings, Globe, Palette, Check } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme, Theme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

export function AppSettings() {
  const { currentLanguage, setLanguage, t } = useLanguage();
  const { currentTheme, setTheme } = useTheme();
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';

  const handleLanguageChange = async (newLanguage: 'es' | 'fr') => {
    try {
      await setLanguage(newLanguage);
      toast.success(t('messages.language-changed'));
    } catch (error) {
      console.error('Error changing language:', error);
      toast.error(t('common.error'));
    }
  };

  const handleThemeChange = async (newTheme: Theme) => {
    try {
      await setTheme(newTheme);
      toast.success(t('Tema cambiado correctamente'));
    } catch (error) {
      console.error('Error changing theme:', error);
      toast.error(t('common.error'));
    }
  };

  const themeOptions = [
    { value: 'amber' as Theme, label: 'Tema Ámbar (Actual)', color: 'bg-amber-500', description: 'Cálido y acogedor' },
    { value: 'dark' as Theme, label: 'Tema Oscuro', color: 'bg-gray-700', description: 'Elegante y profesional' },
    { value: 'blue' as Theme, label: 'Tema Azul', color: 'bg-blue-500', description: 'Fresco y confiable' },
    { value: 'green' as Theme, label: 'Tema Verde', color: 'bg-emerald-500', description: 'Natural y tranquilo' },
  ];

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Settings className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t('nav.app-settings')}</h2>
            <p className="text-sm text-gray-600">{t('settings.general.description')}</p>
          </div>
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
                currentLanguage === 'es'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                currentLanguage === 'es' ? 'border-blue-500' : 'border-gray-300'
              }`}>
                {currentLanguage === 'es' && <div className="w-2 h-2 rounded-full bg-blue-500"></div>}
              </div>
              <div className="text-left">
                <p className="font-medium">{t('settings.language.es')}</p>
                <p className="text-xs text-gray-500">{t('Español')}</p>
              </div>
            </button>

            <button
              onClick={() => handleLanguageChange('fr')}
              className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                currentLanguage === 'fr'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                currentLanguage === 'fr' ? 'border-blue-500' : 'border-gray-300'
              }`}>
                {currentLanguage === 'fr' && <div className="w-2 h-2 rounded-full bg-blue-500"></div>}
              </div>
              <div className="text-left">
                <p className="font-medium">{t('settings.language.fr')}</p>
                <p className="text-xs text-gray-500">{t('Français')}</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Configuración de tema - Solo para Super Admin */}
      {isSuperAdmin && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Palette className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">{t('settings.theme')}</h3>
            <span className="px-2 py-1 text-xs font-semibold bg-purple-100 text-purple-700 rounded">
              {t('Super Administrador')}
            </span>
          </div>

          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>⚠️ {t('Información')}:</strong> {t('El cambio de tema se aplicará a todos los usuarios del sistema de forma inmediata.')}
            </p>
          </div>

          <p className="text-sm text-gray-600 mb-4">{t('Selecciona el tema de color de la aplicación')}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {themeOptions.map((theme) => (
              <button
                key={theme.value}
                onClick={() => handleThemeChange(theme.value)}
                className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                  currentTheme === theme.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  currentTheme === theme.value ? 'border-blue-500' : 'border-gray-300'
                }`}>
                  {currentTheme === theme.value && <div className="w-2 h-2 rounded-full bg-blue-500"></div>}
                </div>
                <div className={`w-8 h-8 rounded ${theme.color}`}></div>
                <div className="text-left flex-1">
                  <p className="font-medium">{theme.label}</p>
                  <p className="text-xs text-gray-500">{theme.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Información adicional */}
      <div className="bg-gray-50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('Información')}</h3>
        <div className="space-y-3 text-sm text-gray-600">
          <p>• {t('Los cambios de idioma se aplican inmediatamente a toda la aplicación')}</p>
          <p>• {t('Los cambios de tema se aplican inmediatamente a todos los usuarios')}</p>
          <p>• {t('Solo el Super Administrador puede cambiar estos ajustes')}</p>
          <p>• {t('Los cambios se sincronizan en tiempo real')}</p>
        </div>
      </div>
    </div>
  );
}
