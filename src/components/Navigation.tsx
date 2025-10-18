import { Coffee, ShoppingCart, Package, BarChart3, ClipboardList, LogOut, Users, Tag, DollarSign, Truck, ChevronDown, Calculator } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';

interface NavigationProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  roles: string[];
}

interface NavGroup {
  name: string;
  items: NavItem[];
}

export function Navigation({ currentView, onViewChange }: NavigationProps) {
  const { user, profile, signOut } = useAuth();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [showCloseCashModal, setShowCloseCashModal] = useState(false);
  const [closingAmount, setClosingAmount] = useState('');
  const [closingLoading, setClosingLoading] = useState(false);

  const navGroups: NavGroup[] = [
    {
      name: 'Ventas',
      items: [
        { id: 'floor', label: 'Sala', icon: Users, roles: ['admin', 'cashier', 'barista'] },
        { id: 'pos', label: 'Punto de Venta', icon: ShoppingCart, roles: ['admin', 'cashier', 'barista'] },
        { id: 'orders', label: 'Órdenes', icon: ClipboardList, roles: ['admin', 'cashier', 'barista'] },
      ]
    },
    {
      name: 'Inventario',
      items: [
        { id: 'products', label: 'Productos', icon: Package, roles: ['admin'] },
        { id: 'categories', label: 'Categorías', icon: Tag, roles: ['admin'] },
        { id: 'users', label: 'Usuarios', icon: Users, roles: ['admin'] },
      ]
    },
    {
      name: 'Finanzas',
      items: [
        { id: 'cash', label: 'Caja', icon: Calculator, roles: ['admin', 'cashier'] },
        { id: 'suppliers', label: 'Proveedores', icon: Truck, roles: ['admin'] },
        { id: 'expenses', label: 'Gastos', icon: DollarSign, roles: ['admin'] },
        { id: 'analytics', label: 'Analíticas', icon: BarChart3, roles: ['admin'] },
      ]
    }
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenu) {
        const dropdownRef = dropdownRefs.current[openMenu];
        const target = event.target as Node;
        if (dropdownRef && !dropdownRef.contains(target) && !target.parentElement?.closest('.nav-dropdown')) {
          setOpenMenu(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenu]);

  const handleMenuClick = (groupName: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (openMenu === groupName) {
      setOpenMenu(null);
    } else {
      setOpenMenu(groupName);
    }
  };

  const renderMenuItem = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = currentView === item.id;

    return (
      <button
        key={item.id}
        onClick={() => {
          onViewChange(item.id);
          setOpenMenu(null);
        }}
        className={`flex items-center gap-3 w-full px-4 py-2 text-sm transition-colors ${
          isActive
            ? 'bg-amber-50 text-amber-700 font-medium'
            : 'text-gray-700 hover:bg-gray-50'
        }`}
      >
        <Icon className="w-4 h-4" />
        <span>{item.label}</span>
        {isActive && (
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 ml-auto" />
        )}
      </button>
    );
  };

  const renderGroup = (group: NavGroup, isMobile: boolean = false) => {
    const visibleItems = group.items.filter(item => 
      profile && item.roles.includes(profile.role)
    );

    if (visibleItems.length === 0) return null;

    // For cashier users, show Ventas items as individual buttons instead of dropdown
    if (profile?.role === 'cashier' && group.name === 'Ventas') {
      return (
        <div key={group.name} className="flex items-center gap-2">
          {visibleItems.map(item => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-amber-50 text-amber-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      );
    }

    const isActive = visibleItems.some(item => currentView === item.id);

    return (
      <div 
        key={group.name}
        className={`relative ${isMobile ? 'flex-shrink-0' : ''}`}
        ref={el => dropdownRefs.current[group.name] = el}
      >
        <button
          onClick={(e) => handleMenuClick(group.name, e)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
            isActive
              ? 'bg-amber-50 text-amber-700'
              : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          <span>{group.name}</span>
          <ChevronDown 
            className={`w-4 h-4 transition-transform ${
              openMenu === group.name ? 'transform rotate-180' : ''
            }`}
          />
        </button>

        {openMenu === group.name && (
          <div 
            className={`absolute top-full left-0 mt-1 ${
              isMobile ? 'w-44' : 'w-48'
            } py-2 bg-white rounded-lg shadow-lg border border-gray-100 z-50 nav-dropdown`}
            onClick={(e) => e.stopPropagation()}
          >
            {visibleItems.map(renderMenuItem)}
          </div>
        )}
      </div>
    );
  };

  const handleCloseCashSubmit = async () => {
    if (!user) return;
    const amount = parseFloat(closingAmount);
    if (isNaN(amount) || amount < 0) {
      toast.error('Ingrese un monto de cierre válido (>= 0)');
      return;
    }
    setClosingLoading(true);
    try {
      const { data: sessions, error: fetchErr } = await supabase
        .from('cash_register_sessions')
        .select('id, opened_at')
        .eq('employee_id', user.id)
        .eq('status', 'open')
        .is('closed_at', null)
        .order('opened_at', { ascending: false })
        .limit(1);
      if (fetchErr) throw fetchErr;

      if (!sessions || sessions.length === 0) {
        toast('No hay sesión de caja abierta para cerrar. Se cerrará la sesión de usuario.');
        setShowCloseCashModal(false);
        await signOut();
        return;
      }

      const sessionId = sessions[0].id;
      const { error: updateErr } = await supabase
        .from('cash_register_sessions')
        .update({
          closing_amount: amount,
          closed_at: new Date().toISOString(),
          status: 'closed',
        })
        .eq('id', sessionId);
      if (updateErr) throw updateErr;

      toast.success('Cierre de caja registrado.');
      setShowCloseCashModal(false);
      await signOut();
    } catch (err: any) {
      console.error('Error en cierre de caja:', err);
      toast.error(`No se pudo cerrar la caja: ${err.message || err}`);
    } finally {
      setClosingLoading(false);
    }
  };

  const handleLogoutClick = () => {
    if (profile?.role === 'cashier') {
      setShowCloseCashModal(true);
    } else {
      signOut();
    }
  };

  return (
    <>
      <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-20">
            <div className="flex-shrink-0 flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-600 rounded-xl flex items-center justify-center shadow-sm">
                <Coffee className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Coffee Shop</h1>
                <p className="text-sm text-gray-500">Sistema de Gestión</p>
              </div>
            </div>

            <div className="hidden lg:flex flex-1 justify-center">
              <div className="flex items-center space-x-4">
                {navGroups.map(group => renderGroup(group))}
              </div>
            </div>

            <div className="flex items-center gap-6">
              {profile && (
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{profile.full_name}</p>
                  <p className="text-xs text-gray-500 capitalize">{profile.role}</p>
                </div>
              )}
              <button
                onClick={handleLogoutClick}
                className="flex items-center gap-2 px-4 py-2.5 text-gray-700 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span>Salir</span>
              </button>
            </div>

            <div className="lg:hidden">
              <div className="flex overflow-x-auto gap-2 py-2">
                {navGroups.map(group => renderGroup(group, true))}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {showCloseCashModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Cierre de Caja</h2>
            <p className="text-sm text-gray-600 mb-4">
              Indique el monto final en caja antes de cerrar sesión.
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monto de cierre</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={closingAmount}
              onChange={(e) => setClosingAmount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded mb-4"
              placeholder="0.00"
            />
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded"
                onClick={() => setShowCloseCashModal(false)}
              >
                Cancelar
              </button>
              <button
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
                onClick={handleCloseCashSubmit}
                disabled={closingLoading}
              >
                {closingLoading ? 'Guardando...' : 'Cerrar Caja y Salir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}