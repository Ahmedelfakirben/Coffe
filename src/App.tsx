import { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { LoginForm } from './components/LoginForm';
import { Navigation } from './components/Navigation';
import { POS } from './components/POS';
import { OrdersDashboard } from './components/OrdersDashboard';
import { ProductsManager } from './components/ProductsManager';
import { CategoryManager } from './components/CategoryManager';
import { UserManager } from './components/UserManager';
import { SupplierManager } from './components/SupplierManager';
import { ExpenseManager } from './components/ExpenseManager';
import { Analytics } from './components/Analytics';

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [currentView, setCurrentView] = useState('pos');

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
        {currentView === 'pos' && <POS />}
        {currentView === 'orders' && <OrdersDashboard />}
        {currentView === 'products' && profile.role === 'admin' && <ProductsManager />}
        {currentView === 'categories' && profile.role === 'admin' && <CategoryManager />}
        {currentView === 'users' && profile.role === 'admin' && <UserManager />}
        {currentView === 'suppliers' && profile.role === 'admin' && <SupplierManager />}
        {currentView === 'expenses' && profile.role === 'admin' && <ExpenseManager />}
        {currentView === 'analytics' && profile.role === 'admin' && <Analytics />}
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
        <AppContent />
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
