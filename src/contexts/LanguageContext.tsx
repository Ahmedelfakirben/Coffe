import { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'es' | 'fr';

export interface LanguageContextType {
  currentLanguage: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Traducciones básicas de la aplicación
const translations = {
  es: {
    // Navegación
    'nav.sales': 'Ventas',
    'nav.inventory': 'Inventario',
    'nav.finance': 'Finanzas',
    'nav.system': 'Sistema',
    'nav.floor': 'Sala',
    'nav.pos': 'Punto de Venta',
    'nav.orders': 'Órdenes',
    'nav.products': 'Productos',
    'nav.categories': 'Categorías',
    'nav.users': 'Usuarios',
    'nav.cash': 'Caja',
    'nav.time-tracking': 'Tiempo Empleados',
    'nav.suppliers': 'Proveedores',
    'nav.expenses': 'Gastos',
    'nav.analytics': 'Analíticas',
    'nav.role-management': 'Gestión de Roles',
    'nav.company-settings': 'Información Empresa',
    'nav.app-settings': 'Configuración',

    // Acciones comunes
    'common.save': 'Guardar',
    'common.cancel': 'Cancelar',
    'common.edit': 'Editar',
    'common.delete': 'Eliminar',
    'common.add': 'Agregar',
    'common.search': 'Buscar',
    'common.loading': 'Cargando...',
    'common.error': 'Error',
    'common.success': 'Éxito',

    // Configuración
    'settings.language': 'Idioma',
    'settings.language.es': 'Español',
    'settings.language.fr': 'Francés',
    'settings.language.description': 'Selecciona el idioma de la aplicación',
    'settings.general': 'Configuración General',
    'settings.general.description': 'Personaliza el comportamiento de la aplicación',
    'settings.theme': 'Tema',
    'settings.theme.light': 'Claro',
    'settings.theme.dark': 'Oscuro',
    'settings.theme.auto': 'Automático',

    // Mensajes
    'messages.language-changed': 'Idioma cambiado correctamente',
    'messages.settings-saved': 'Configuración guardada correctamente',

    // Configuración empresa
    'Información de la Empresa': 'Información de la Empresa',
    'Configure los datos que aparecen en tickets y reportes': 'Configure los datos que aparecen en tickets y reportes',
    'Esta información aparecerá en:': 'Esta información aparecerá en:',
    'Todos los tickets de venta impresos': 'Todos los tickets de venta impresos',
    'Reportes Excel exportados desde Analíticas': 'Reportes Excel exportados desde Analíticas',
    'Reportes de tiempo de empleados': 'Reportes de tiempo de empleados',
    'Cualquier documento generado por el sistema': 'Cualquier documento generado por el sistema',
    'Nombre de la Empresa': 'Nombre de la Empresa',
    'Dirección': 'Dirección',
    'Número de Teléfono': 'Número de Teléfono',
    'Guardar Cambios': 'Guardar Cambios',
    'Deshacer': 'Deshacer',
    'Vista Previa (Tickets)': 'Vista Previa (Tickets)',
    'Información de pedido...': 'Información de pedido...',
    'Este nombre aparecerá en todos los documentos': 'Este nombre aparecerá en todos los documentos',
    'Dirección física de la empresa': 'Dirección física de la empresa',
    'Número de contacto para clientes': 'Número de contacto para clientes',

    // Sistema de Gestión
    'Sistema de Gestión': 'Sistema de Gestión',
    'Menú de Navegación': 'Menú de Navegación',
    'Menú Admin': 'Menú Admin',
    'Salir': 'Salir',
    'Cerrar Sesión': 'Cerrar Sesión',
    'Sala': 'Sala',
    'Pedidos': 'Pedidos',
    'Punto de Venta': 'Punto de Venta',
    'Apertura de Caja': 'Apertura de Caja',
    'Indique el monto inicial en caja para comenzar su turno.': 'Indique el monto inicial en caja para comenzar su turno.',
    'Cierre de Caja': 'Cierre de Caja',
    'Indique el monto final en caja antes de cerrar sesión.': 'Indique el monto final en caja antes de cerrar sesión.',

    // POS - Punto de Venta
    'Cargando productos...': 'Cargando productos...',
    'Reintentar': 'Reintentar',
    'Todos': 'Todos',
    'Agregar': 'Agregar',
    'Agregar al carrito': 'Agregar al carrito',
    'Cargar más productos': 'Cargar más productos',
    'Carrito de Compras': 'Carrito de Compras',
    'El carrito está vacío': 'El carrito está vacío',
    'Selecciona productos para comenzar': 'Selecciona productos para comenzar',
    'Para llevar': 'Para llevar',
    'En sala': 'En sala',
    'Seleccione mesa': 'Seleccione mesa',
    'Confirmar Pedido': 'Confirmar Pedido',
    'Seleccionar Método de Pago': 'Seleccionar Método de Pago',
    'Efectivo': 'Efectivo',
    'Pago en efectivo': 'Pago en efectivo',
    'Tarjeta': 'Tarjeta',
    'Pago con tarjeta': 'Pago con tarjeta',
    'Digital': 'Digital',
    'Pago digital': 'Pago digital',
    'Cancelar': 'Cancelar',
    'Total del Pedido:': 'Total del Pedido:',
    'Método de Pago:': 'Método de Pago:',
    'Después': 'Después',
    'Validar e Imprimir': 'Validar e Imprimir',
  },
  fr: {
    // Navigation
    'nav.sales': 'Ventes',
    'nav.inventory': 'Inventaire',
    'nav.finance': 'Finances',
    'nav.system': 'Système',
    'nav.floor': 'Salle',
    'nav.pos': 'Point de Vente',
    'nav.orders': 'Commandes',
    'nav.products': 'Produits',
    'nav.categories': 'Catégories',
    'nav.users': 'Utilisateurs',
    'nav.cash': 'Caisse',
    'nav.time-tracking': 'Temps Employés',
    'nav.suppliers': 'Fournisseurs',
    'nav.expenses': 'Dépenses',
    'nav.analytics': 'Analytiques',
    'nav.role-management': 'Gestion des Rôles',
    'nav.company-settings': 'Informations Entreprise',
    'nav.app-settings': 'Configuration',

    // Actions communes
    'common.save': 'Enregistrer',
    'common.cancel': 'Annuler',
    'common.edit': 'Modifier',
    'common.delete': 'Supprimer',
    'common.add': 'Ajouter',
    'common.search': 'Rechercher',
    'common.loading': 'Chargement...',
    'common.error': 'Erreur',
    'common.success': 'Succès',

    // Configuration
    'settings.language': 'Langue',
    'settings.language.es': 'Espagnol',
    'settings.language.fr': 'Français',
    'settings.language.description': 'Sélectionnez la langue de l\'application',
    'settings.general': 'Configuration Générale',
    'settings.general.description': 'Personnalisez le comportement de l\'application',
    'settings.theme': 'Thème',
    'settings.theme.light': 'Clair',
    'settings.theme.dark': 'Sombre',
    'settings.theme.auto': 'Automatique',

    // Messages
    'messages.language-changed': 'Langue changée avec succès',
    'messages.settings-saved': 'Configuration sauvegardée avec succès',

    // Configuration entreprise
    'Información de la Empresa': 'Informations de l\'Entreprise',
    'Configure los datos que aparecen en tickets y reportes': 'Configurez les données qui apparaissent sur les tickets et rapports',
    'Esta información aparecerá en:': 'Ces informations apparaîtront dans :',
    'Todos los tickets de venta impresos': 'Tous les tickets de vente imprimés',
    'Reportes Excel exportados desde Analíticas': 'Rapports Excel exportés depuis Analytics',
    'Reportes de tiempo de empleados': 'Rapports de temps des employés',
    'Cualquier documento generado por el sistema': 'Tout document généré par le système',
    'Nombre de la Empresa': 'Nom de l\'Entreprise',
    'Dirección': 'Adresse',
    'Número de Teléfono': 'Numéro de Téléphone',
    'Guardar Cambios': 'Enregistrer les Modifications',
    'Deshacer': 'Annuler',
    'Vista Previa (Tickets)': 'Aperçu (Tickets)',
    'Información de pedido...': 'Informations de commande...',
    'Este nombre aparecerá en todos los documentos': 'Ce nom apparaîtra sur tous les documents',
    'Dirección física de la empresa': 'Adresse physique de l\'entreprise',
    'Número de contacto para clientes': 'Numéro de contact pour les clients',

    // Système de Gestion
    'Sistema de Gestión': 'Système de Gestion',
    'Menú de Navegación': 'Menu de Navigation',
    'Menú Admin': 'Menu Admin',
    'Salir': 'Quitter',
    'Cerrar Sesión': 'Fermer la Session',
    'Sala': 'Salle',
    'Pedidos': 'Commandes',
    'Punto de Venta': 'Point de Vente',
    'Apertura de Caja': 'Ouverture de Caisse',
    'Indique el monto inicial en caja para comenzar su turno.': 'Indiquez le montant initial en caisse pour commencer votre service.',
    'Cierre de Caja': 'Fermeture de Caisse',
    'Indique el monto final en caja antes de cerrar sesión.': 'Indiquez le montant final en caisse avant de fermer la session.',

    // POS - Punto de Venta
    'Cargando productos...': 'Chargement des produits...',
    'Reintentar': 'Réessayer',
    'Todos': 'Tous',
    'Agregar': 'Ajouter',
    'Agregar al carrito': 'Ajouter au panier',
    'Cargar más productos': 'Charger plus de produits',
    'Carrito de Compras': 'Panier d\'Achats',
    'El carrito está vacío': 'Le panier est vide',
    'Selecciona productos para comenzar': 'Sélectionnez des produits pour commencer',
    'Para llevar': 'À emporter',
    'En sala': 'En salle',
    'Seleccione mesa': 'Sélectionnez une table',
    'Confirmar Pedido': 'Confirmer la Commande',
    'Seleccionar Método de Pago': 'Sélectionner le Mode de Paiement',
    'Efectivo': 'Espèces',
    'Pago en efectivo': 'Paiement en espèces',
    'Tarjeta': 'Carte',
    'Pago con tarjeta': 'Paiement par carte',
    'Digital': 'Numérique',
    'Pago digital': 'Paiement numérique',
    'Cancelar': 'Annuler',
    'Total del Pedido:': 'Total de la Commande :',
    'Método de Pago:': 'Mode de Paiement :',
    'Después': 'Après',
    'Validar e Imprimir': 'Valider et Imprimer',

    // Login Form
    'Correo Electrónico': 'Adresse e-mail',
    'Contraseña': 'Mot de passe',
    'Iniciando sesión...': 'Connexion en cours...',
    'Iniciar Sesión': 'Se connecter',

    // Role Management
    'Gestión de Roles y Permisos': 'Gestion des Rôles et Permissions',
    'Configure los accesos para cada rol del sistema': 'Configurez les accès pour chaque rôle du système',
    'Cargando permisos...': 'Chargement des permissions...',

    // Role Management
    'Gestión de Roles y Permisos': 'Gestion des Rôles et Permissions',
    'Configure los accesos para cada rol del sistema': 'Configurez les accès pour chaque rôle du système',
    'Cargando permisos...': 'Chargement des permissions...',

    // Analytics
    'Analíticas y Reportes': 'Analyses et Rapports',
    'usuarios conectados': 'utilisateurs connectés',
    'mesas ocupadas': 'tables occupées',
    'Exportar Excel': 'Exporter Excel',
    'Ventas del día': 'Ventes du jour',
    'Órdenes completadas': 'Commandes terminées',
    'Productos activos': 'Produits actifs',
    'Ventas:': 'Ventes :',
    'Gastos:': 'Dépenses :',
    'Beneficio:': 'Bénéfice :',
    'Margen:': 'Marge :',
    'Actividad de Empleados': 'Activité des Employés',
    'No hay datos de empleados disponibles': 'Aucune donnée d\'employé disponible',
    'Notificaciones Recientes': 'Notifications Récentes',
    'No hay notificaciones recientes': 'Aucune notification récente',
    'Ventas Diarias (Últimos 7 días)': 'Ventes Quotidiennes (7 derniers jours)',
    'Productos Más Vendidos': 'Produits les Plus Vendus',
    'No hay datos de ventas disponibles': 'Aucune donnée de vente disponible',
    'No hay datos de productos disponibles': 'Aucune donnée de produit disponible',
    'Insights de Rendimiento': 'Insights de Performance',

    // Login Form
    'Correo Electrónico': 'Adresse e-mail',
    'Contraseña': 'Mot de passe',
    'Iniciando sesión...': 'Connexion en cours...',
    'Iniciar Sesión': 'Se connecter',
  }
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [currentLanguage, setCurrentLanguage] = useState<Language>('es');

  // Cargar idioma guardado al iniciar
  useEffect(() => {
    const savedLanguage = localStorage.getItem('app-language') as Language;
    if (savedLanguage && (savedLanguage === 'es' || savedLanguage === 'fr')) {
      setCurrentLanguage(savedLanguage);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setCurrentLanguage(lang);
    localStorage.setItem('app-language', lang);

    // Actualizar idioma del documento
    document.documentElement.lang = lang;
  };

  const t = (key: string): string => {
    return translations[currentLanguage][key as keyof typeof translations.es] || key;
  };

  return (
    <LanguageContext.Provider value={{ currentLanguage, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}