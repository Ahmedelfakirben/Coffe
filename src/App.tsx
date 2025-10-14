import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginForm } from './components/LoginForm';
import { Navigation } from './components/Navigation';
import { POS } from './components/POS';
import { OrdersDashboard } from './components/OrdersDashboard';
import { ProductsManager } from './components/ProductsManager';
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
    <div className="min-h-screen bg-gray-50">
      <Navigation currentView={currentView} onViewChange={setCurrentView} />
      {currentView === 'pos' && <POS />}
      {currentView === 'orders' && <OrdersDashboard />}
      {currentView === 'products' && profile.role === 'admin' && <ProductsManager />}
      {currentView === 'analytics' && profile.role === 'admin' && <Analytics />}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
