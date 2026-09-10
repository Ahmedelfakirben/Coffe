import { useState } from 'react';
import { Package, ArrowDownToLine, ArrowUpFromLine, Truck, FileSpreadsheet } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { InventoryItems } from './InventoryItems';
import { ReceiptsManager } from './ReceiptsManager';
import { IssuesManager } from './IssuesManager';
import { SupplierManager } from '../SupplierManager'; // Reuse existing component
import { Kardex } from './Kardex';

export function EconomatDashboard() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'items' | 'receipts' | 'issues' | 'suppliers' | 'kardex'>('items');

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-500 text-white rounded-xl shadow-md">
          <Package className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900">{t('nav.economat')}</h2>
          <p className="text-gray-500 font-medium">Gestión integral de inventario y suministros</p>
        </div>
      </div>

      <div className="flex space-x-2 bg-gray-100/80 p-1.5 rounded-xl mb-6 overflow-x-auto shadow-inner">
        <button
          onClick={() => setActiveTab('items')}
          className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap ${
            activeTab === 'items' ? 'bg-white text-amber-700 shadow-sm ring-1 ring-black/5' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
          }`}
        >
          <Package className="w-4 h-4" />
          {t('economat.items')}
        </button>
        <button
          onClick={() => setActiveTab('receipts')}
          className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap ${
            activeTab === 'receipts' ? 'bg-white text-amber-700 shadow-sm ring-1 ring-black/5' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
          }`}
        >
          <ArrowDownToLine className="w-4 h-4" />
          {t('economat.receipts')}
        </button>
        <button
          onClick={() => setActiveTab('issues')}
          className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap ${
            activeTab === 'issues' ? 'bg-white text-amber-700 shadow-sm ring-1 ring-black/5' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
          }`}
        >
          <ArrowUpFromLine className="w-4 h-4" />
          {t('economat.issues')} / {t('economat.losses')}
        </button>
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap ${
            activeTab === 'suppliers' ? 'bg-white text-amber-700 shadow-sm ring-1 ring-black/5' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
          }`}
        >
          <Truck className="w-4 h-4" />
          {t('economat.suppliers')}
        </button>
        <button
          onClick={() => setActiveTab('kardex')}
          className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap ${
            activeTab === 'kardex' ? 'bg-white text-amber-700 shadow-sm ring-1 ring-black/5' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Kardex
        </button>
      </div>

      <div className="min-h-[500px]">
        {activeTab === 'items' && <InventoryItems />}
        {activeTab === 'receipts' && <ReceiptsManager />}
        {activeTab === 'issues' && <IssuesManager />}
        {activeTab === 'suppliers' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
             {/* Render SupplierManager inside Economat without its own padding to fit nicely */}
            <div className="-m-6">
               <SupplierManager />
            </div>
          </div>
        )}
        {activeTab === 'kardex' && <Kardex />}
      </div>
    </div>
  );
}
