import { useState, useEffect, useRef } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { CurrencyProvider } from './contexts/CurrencyContext';
import { LoginForm } from './components/LoginForm';
import { Navigation } from './components/Navigation';
import { POS } from './components/POS';
import { OrdersDashboard } from './components/OrdersDashboard';
import { Sala } from './components/Sala';
import { ProductsManager } from './components/ProductsManager';
import { CategoryManager } from './components/CategoryManager';
import { UserManager } from './components/UserManager';
import { SupplierManager } from './components/SupplierManager';
import { ExpenseManager } from './components/ExpenseManager';
import { Analytics } from './components/Analytics';
import { CashRegisterDashboard } from './components/CashRegisterDashboard';
import { EmployeeTimeTracking } from './components/EmployeeTimeTracking';
import { RoleManagement } from './components/RoleManagement';
import { CompanySettings } from './components/CompanySettings';
import { AppSettings } from './components/AppSettings';
import { ServerManager } from './components/ServerManager';
import { BackupManager } from './components/BackupManager';
import { TableManager } from './components/TableManager';
import { EconomatDashboard } from './components/economat/EconomatDashboard';
import { supabase } from './lib/supabase';

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [currentView, setCurrentView] = useState('pos');
  const [userPermissions, setUserPermissions] = useState<{ [key: string]: boolean }>({});
  const hasRedirectedRef = useRef(false);

  // Cargar permisos del usuario desde la base de datos
  useEffect(() => {
    const fetchUserPermissions = async () => {
      if (!profile?.role) return;

      try {
        const { data, error } = await supabase
          .from('role_permissions')
          .select('page_id, can_access')
          .eq('role', profile.role)
          .eq('can_access', true);

        if (error) {
          console.error('Error fetching permissions:', error);
          return;
        }

        // Crear un mapa de permisos por page_id
        const permissionsMap: { [key: string]: boolean } = {};
        data?.forEach(perm => {
          permissionsMap[perm.page_id] = perm.can_access;
        });

        setUserPermissions(permissionsMap);
      } catch (err) {
        console.error('Error loading permissions:', err);
      }
    };

    fetchUserPermissions();

    // Suscribirse a cambios en permisos
    const channel = supabase
      .channel('app-role-permissions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'role_permissions',
          filter: `role=eq.${profile?.role}`
        },
        () => {
          fetchUserPermissions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.role]);

  // Redirigir a página apropiada según el rol SOLO en el login inicial
  useEffect(() => {
    // Si no hay perfil, resetear el flag para el próximo login
    if (!profile) {
      hasRedirectedRef.current = false;
      return;
    }

    // Solo redirigir si NO se ha redirigido antes en esta sesión y la vista actual es la por defecto
    if (!hasRedirectedRef.current && currentView === 'pos') {
      let defaultView = 'pos'; // Default fallback

      // Determinar página por defecto según el rol
      switch (profile.role) {
        case 'cashier':
          defaultView = userPermissions['pos'] ? 'pos' :
                       userPermissions['floor'] ? 'floor' :
                       userPermissions['orders'] ? 'orders' :
                       userPermissions['cash'] ? 'cash' : 'pos';
          break;
        case 'barista':
          defaultView = userPermissions['pos'] ? 'pos' :
                       userPermissions['orders'] ? 'orders' :
                       userPermissions['floor'] ? 'floor' : 'pos';
          break;
        case 'waiter':
          defaultView = userPermissions['floor'] ? 'floor' :
                       userPermissions['orders'] ? 'orders' :
                       userPermissions['pos'] ? 'pos' : 'floor';
          break;
        case 'admin':
        case 'super_admin':
          // Para admin y super_admin, mantener lógica existente pero más inteligente
          if (userPermissions['analytics']) {
            defaultView = 'analytics';
          } else if (userPermissions['pos']) {
            defaultView = 'pos';
          } else if (userPermissions['orders']) {
            defaultView = 'orders';
          } else if (userPermissions['products']) {
            defaultView = 'products';
          } else {
            // Encontrar la primera página disponible
            const availablePages = ['pos', 'orders', 'products', 'categories', 'users', 'suppliers', 'expenses', 'time-tracking', 'cash', 'analytics'];
            defaultView = availablePages.find(page => userPermissions[page]) || 'pos';
          }
          break;
        default:
          defaultView = 'pos';
      }

      setCurrentView(defaultView);
      hasRedirectedRef.current = true;
    }
  }, [profile, userPermissions, currentView]);

  // Si la vista actual deja de tener permiso, redirigir a una permitida
  useEffect(() => {
    if (profile && Object.keys(userPermissions).length > 0 && !userPermissions[currentView]) {
      const fallback = userPermissions['floor'] ? 'floor' :
                       userPermissions['pos'] ? 'pos' :
                       Object.keys(userPermissions).find(k => userPermissions[k]) || 'floor';
      setCurrentView(fallback);
    }
  }, [userPermissions, currentView, profile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return <LoginForm />;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <Navigation currentView={currentView} onViewChange={setCurrentView} />
      <div className={`flex-1 ${currentView === 'floor' ? 'overflow-hidden' : 'overflow-auto p-6'}`}>
        {currentView === 'floor' && userPermissions['floor'] && <Sala onGoToPOS={() => setCurrentView('pos')} />}
        {currentView === 'pos' && userPermissions['pos'] && <POS />}
        {currentView === 'orders' && userPermissions['orders'] && <OrdersDashboard />}
        {currentView === 'products' && userPermissions['products'] && <ProductsManager />}
        {currentView === 'categories' && userPermissions['categories'] && <CategoryManager />}
        {currentView === 'users' && userPermissions['users'] && <UserManager />}
        {currentView === 'suppliers' && userPermissions['suppliers'] && <SupplierManager />}
        {currentView === 'expenses' && userPermissions['expenses'] && <ExpenseManager />}
        {currentView === 'time-tracking' && userPermissions['time-tracking'] && <EmployeeTimeTracking />}
        {currentView === 'analytics' && userPermissions['analytics'] && <Analytics />}
        {currentView === 'cash' && userPermissions['cash'] && <CashRegisterDashboard />}
        {currentView === 'role-management' && userPermissions['role-management'] && <RoleManagement />}
        {currentView === 'company-settings' && userPermissions['company-settings'] && <CompanySettings />}
        {currentView === 'app-settings' && userPermissions['app-settings'] && <AppSettings />}
        {currentView === 'tables' && userPermissions['tables'] && <TableManager />}
        {currentView === 'server' && userPermissions['server'] && <ServerManager />}
        {currentView === 'backup' && userPermissions['backup'] && <BackupManager />}
        {currentView === 'economat' && userPermissions['economat'] && <EconomatDashboard />}
      </div>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#22c55e',
              secondary: '#fff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <LanguageProvider>
          <ThemeProvider>
            <CurrencyProvider>
              <AppContent />
            </CurrencyProvider>
          </ThemeProvider>
        </LanguageProvider>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
