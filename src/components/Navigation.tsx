import { Coffee, ShoppingCart, Package, BarChart3, ClipboardList, LogOut, Users, Tag, DollarSign, Truck, ChevronDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useState, useRef, useEffect } from 'react';

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
  const { profile, signOut } = useAuth();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const navGroups: NavGroup[] = [
    {
      name: 'Ventas',
      items: [
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

  return (
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
              onClick={signOut}
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
  );
}