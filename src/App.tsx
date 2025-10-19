import { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
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
import { supabase } from './lib/supabase';

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [currentView, setCurrentView] = useState('pos');
  const [showOpenCashModal, setShowOpenCashModal] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('');
  const [openingLoading, setOpeningLoading] = useState(false);

  // Redirigir a Analíticas si el usuario es admin
  useEffect(() => {
    if (profile && profile.role === 'admin') {
      setCurrentView('analytics');
    }
  }, [profile]);

  useEffect(() => {
    const checkOpenCashSession = async () => {
      if (!user || !profile) return;
      if (profile.role !== 'cashier') return;
      try {
        const { data, error } = await supabase
          .from('cash_register_sessions')
          .select('id, status, closed_at')
          .eq('employee_id', user.id)
          .eq('status', 'open')
          .is('closed_at', null)
          .limit(1);
        if (error) throw error;
        const hasOpen = data && data.length > 0;
        setShowOpenCashModal(!hasOpen);
      } catch (err) {
        console.error('Error verificando sesión de caja:', err);
      }
    };
    checkOpenCashSession();
  }, [user, profile]);

  const handleOpenCashSubmit = async () => {
    if (!user) return;
    const amount = parseFloat(openingAmount);
    if (isNaN(amount) || amount < 0) {
      toast.error('Ingrese un monto válido (>= 0)');
      return;
    }
    setOpeningLoading(true);
    try {
      const { error } = await supabase
        .from('cash_register_sessions')
        .insert({
          employee_id: user.id,
          opening_amount: amount,
          status: 'open',
        });
      if (error) throw error;
      toast.success('Apertura de caja registrada');
      setShowOpenCashModal(false);
    } catch (err: any) {
      console.error('Error registrando apertura de caja:', err);
      toast.error(`No se pudo abrir caja: ${err.message || err}`);
    } finally {
      setOpeningLoading(false);
    }
  };

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
      <div className="flex-1 overflow-auto p-6">
        {currentView === 'floor' && <Sala onGoToPOS={() => setCurrentView('pos')} />}
        {currentView === 'pos' && <POS />}
        {currentView === 'orders' && <OrdersDashboard />}
        {currentView === 'products' && profile.role === 'admin' && <ProductsManager />}
        {currentView === 'categories' && profile.role === 'admin' && <CategoryManager />}
        {currentView === 'users' && profile.role === 'admin' && <UserManager />}
        {currentView === 'suppliers' && profile.role === 'admin' && <SupplierManager />}
        {currentView === 'expenses' && profile.role === 'admin' && <ExpenseManager />}
        {currentView === 'time-tracking' && profile.role === 'admin' && <EmployeeTimeTracking />}
        {currentView === 'analytics' && profile.role === 'admin' && <Analytics />}
        {currentView === 'cash' && (profile.role === 'admin' || profile.role === 'cashier') && <CashRegisterDashboard />}
      </div>

      {showOpenCashModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Apertura de Caja</h2>
            <p className="text-sm text-gray-600 mb-4">
              Indique el monto inicial en caja para comenzar su turno.
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monto inicial</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={openingAmount}
              onChange={(e) => setOpeningAmount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded mb-4"
              placeholder="0.00"
            />
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded"
                onClick={() => setShowOpenCashModal(false)}
              >
                Cancelar
              </button>
              <button
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded"
                onClick={handleOpenCashSubmit}
                disabled={openingLoading}
              >
                {openingLoading ? 'Guardando...' : 'Aceptar'}
              </button>
            </div>
          </div>
        </div>
      )}

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
        <AppContent />
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
