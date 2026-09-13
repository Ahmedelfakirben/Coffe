import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Trash2, X, Loader2, Search, Filter } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';
import { useCurrency } from '../contexts/CurrencyContext';

interface Category {
  id: string;
  name: string;
  description: string;
}

interface Product {
  id: string;
  category_id: string | null;
  name: string;
  description: string;
  base_price: number;
  available: boolean;
  image_url?: string;
}

interface ProductSize {
  id: string;
  product_id: string;
  size_name: string;
  price_modifier: number;
}

export function ProductsManager() {
  const { t } = useLanguage();
  const { formatCurrency } = useCurrency();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sizes, setSizes] = useState<ProductSize[]>([]);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');

  // State for unified Modal Form (Create & Edit)
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    category_id: '',
    base_price: 0,
    available: true,
  });
  const [productImage, setProductImage] = useState<File | null>(null);
  const [productPreviewUrl, setProductPreviewUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // States for manual sizes in modal
  const [tempSizes, setTempSizes] = useState<{ size_name: string; price_modifier: number }[]>([]);
  const [newSizeName, setNewSizeName] = useState('');
  const [newSizePrice, setNewSizePrice] = useState('');

  useEffect(() => {
    fetchCategories();
    fetchProducts();
    fetchSizes();
  }, []);

  // Preview for selected product image
  useEffect(() => {
    if (!productImage) {
      if (!editingProductId) {
        setProductPreviewUrl(null);
      }
      return;
    }
    const url = URL.createObjectURL(productImage);
    setProductPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [productImage, editingProductId]);

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('name');
    if (data) setCategories(data);
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('name');
    if (data) setProducts(data);
  };

  const fetchSizes = async () => {
    const { data } = await supabase.from('product_sizes').select('*');
    if (data) setSizes(data);
  };

  const handleOpenCreateModal = () => {
    setEditingProductId(null);
    setProductForm({
      name: '',
      description: '',
      category_id: categories[0]?.id || '',
      base_price: 0,
      available: true,
    });
    setProductImage(null);
    setProductPreviewUrl(null);
    setTempSizes([]);
    setNewSizeName('');
    setNewSizePrice('');
    setShowProductModal(true);
  };

  const handleOpenEditModal = (product: Product) => {
    setEditingProductId(product.id);
    setProductForm({
      name: product.name || '',
      description: product.description || '',
      category_id: product.category_id || '',
      base_price: product.base_price || 0,
      available: product.available ?? true,
    });
    setProductImage(null);
    setProductPreviewUrl(product.image_url || null);

    // Populate sizes for this product
    const existingSizes = sizes
      .filter(s => s.product_id === product.id)
      .map(s => ({ size_name: s.size_name, price_modifier: s.price_modifier }));
    setTempSizes(existingSizes);
    setNewSizeName('');
    setNewSizePrice('');
    setShowProductModal(true);
  };

  const handleAddTempSize = () => {
    if (!newSizeName.trim()) {
      toast.error(t('Ingrese un nombre para el tamaño'));
      return;
    }
    if (!newSizePrice.trim()) {
      toast.error(t('Ingrese un precio para el tamaño'));
      return;
    }
    const parsedPrice = parseFloat(newSizePrice.replace(',', '.'));
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      toast.error(t('Ingrese un precio válido para el tamaño'));
      return;
    }
    setTempSizes([...tempSizes, { size_name: newSizeName.trim(), price_modifier: parsedPrice }]);
    setNewSizeName('');
    setNewSizePrice('');
  };

  const handleRemoveTempSize = (index: number) => {
    setTempSizes(tempSizes.filter((_, i) => i !== index));
  };

  const handleSaveProduct = async () => {
    if (isSaving) return;
    if (!productForm.name.trim()) {
      toast.error(t('Ingrese un nombre para el producto'));
      return;
    }

    setIsSaving(true);
    try {
      let targetProductId = editingProductId;

      if (editingProductId) {
        // UPDATE existing product
        const { error: updateErr } = await supabase
          .from('products')
          .update({
            name: productForm.name.trim(),
            description: productForm.description.trim(),
            category_id: productForm.category_id || null,
            base_price: Number(productForm.base_price) || 0,
            available: productForm.available,
          })
          .eq('id', editingProductId);

        if (updateErr) {
          toast.error(t('Error al actualizar producto'));
          return;
        }
      } else {
        // CREATE new product
        const { data: created, error: createErr } = await supabase
          .from('products')
          .insert({
            name: productForm.name.trim(),
            description: productForm.description.trim(),
            category_id: productForm.category_id || null,
            base_price: Number(productForm.base_price) || 0,
            available: productForm.available,
          })
          .select('id')
          .single();

        if (createErr || !created) {
          toast.error(t('Error al crear producto'));
          return;
        }
        targetProductId = created.id;
      }

      // Upload image if provided
      if (targetProductId && productImage) {
        setUploadingImage(true);
        try {
          const fileExt = productImage.name.split('.').pop();
          const filePath = `products/${targetProductId}/${Date.now()}.${fileExt}`;

          toast.loading(t('Subiendo imagen...'), { id: 'image-upload' });

          const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(filePath, productImage, {
              upsert: true,
              contentType: productImage.type,
            });

          if (uploadError) {
            console.error('Error subiendo imagen:', uploadError);
            toast.error(`${t('Error subiendo imagen:')} ${uploadError.message || ''}`, { id: 'image-upload' });
          } else {
            const { data: publicData } = supabase.storage
              .from('product-images')
              .getPublicUrl(filePath);

            const publicUrl = publicData?.publicUrl;
            if (publicUrl) {
              await supabase
                .from('products')
                .update({ image_url: publicUrl })
                .eq('id', targetProductId);

              toast.success(t('Imagen subida correctamente'), { id: 'image-upload' });
            }
          }
        } catch (uploadErr) {
          console.error('Error during image upload:', uploadErr);
          toast.error(t('Error durante la subida de imagen'), { id: 'image-upload' });
        } finally {
          setUploadingImage(false);
        }
      }

      // Sync Manual Sizes
      const sizesList = [...tempSizes];
      if (newSizeName.trim() && newSizePrice.trim()) {
        const parsed = parseFloat(newSizePrice.replace(',', '.'));
        if (!isNaN(parsed) && parsed >= 0) {
          sizesList.push({ size_name: newSizeName.trim(), price_modifier: parsed });
        }
      }

      if (targetProductId) {
        // Delete old sizes
        await supabase
          .from('product_sizes')
          .delete()
          .eq('product_id', targetProductId);

        // Insert new sizes
        if (sizesList.length > 0) {
          const sizesToInsert = sizesList.map(s => ({
            product_id: targetProductId,
            size_name: s.size_name,
            price_modifier: Number(s.price_modifier) || 0,
          }));

          const { error: sizesError } = await supabase
            .from('product_sizes')
            .insert(sizesToInsert);

          if (sizesError) {
            console.error('Error saving sizes:', sizesError);
            toast.error(`${t('Error al guardar tamaños:')} ${sizesError.message || ''}`);
          }
        }
      }

      setShowProductModal(false);
      fetchProducts();
      fetchSizes();
      toast.success(editingProductId ? t('Producto actualizado correctamente') : t('Producto creado correctamente'));
    } catch (err) {
      console.error('Error guardando producto:', err);
      toast.error(t('Error al guardar producto'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm(`${t('¿Estás seguro de que deseas eliminar este producto?')}\n\n${t('El producto será eliminado permanentemente de la lista de productos activos. Los pedidos históricos que contengan este producto se mantendrán intactos.')}`)) return;

    try {
      const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('Error deleting product:', deleteError);
        toast.error(`${t('Error al eliminar producto:')} ${deleteError.message}`);
        return;
      }

      toast.success(t('Producto eliminado correctamente. El historial de pedidos se mantiene intacto.'));
      fetchProducts();
    } catch (err) {
      console.error('Error in delete operation:', err);
      toast.error(t('Error al eliminar producto'));
    }
  };

  const getCategoryName = (categoryId: string | null) => {
    return categories.find(c => c.id === categoryId)?.name || t('Sin categoría');
  };

  const getProductSizes = (productId: string) => {
    return sizes.filter(s => s.product_id === productId);
  };

  // Filtrado de productos por nombre, categoría y precio
  const filteredProducts = products.filter(product => {
    if (selectedCategoryFilter && product.category_id !== selectedCategoryFilter) {
      return false;
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      const catName = getCategoryName(product.category_id).toLowerCase();
      const nameMatch = product.name.toLowerCase().includes(term);
      const descMatch = product.description?.toLowerCase().includes(term);
      const catMatch = catName.includes(term);
      const priceMatch = product.base_price.toString().includes(term) || formatCurrency(product.base_price).toLowerCase().includes(term);
      const sizeMatch = getProductSizes(product.id).some(s =>
        s.size_name.toLowerCase().includes(term) ||
        s.price_modifier.toString().includes(term) ||
        formatCurrency(s.price_modifier).toLowerCase().includes(term)
      );

      if (!nameMatch && !descMatch && !catMatch && !priceMatch && !sizeMatch) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{t('Gestión de Productos')}</h2>
        <button
          onClick={handleOpenCreateModal}
          className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium shadow-sm"
        >
          <Plus className="w-5 h-5" />
          {t('Nuevo Producto')}
        </button>
      </div>

      {/* Modal para Crear y Modificar Producto */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-900">
                {editingProductId ? t('Editar Producto') : t('Nuevo Producto')}
              </h3>
              <button
                onClick={() => setShowProductModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Nombre')}</label>
                <input
                  type="text"
                  value={productForm.name}
                  onChange={e => setProductForm({ ...productForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Descripción')}</label>
                <textarea
                  value={productForm.description}
                  onChange={e => setProductForm({ ...productForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Categoría')}</label>
                <select
                  value={productForm.category_id}
                  onChange={e => setProductForm({ ...productForm, category_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="">{t('Seleccionar categoría')}</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Precio Base')}</label>
                <input
                  type="number"
                  step="0.01"
                  value={productForm.base_price}
                  onChange={e => setProductForm({ ...productForm, base_price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Estado')}</label>
                <select
                  value={productForm.available ? 'true' : 'false'}
                  onChange={e => setProductForm({ ...productForm, available: e.target.value === 'true' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-medium"
                >
                  <option value="true">{t('Disponible')}</option>
                  <option value="false">{t('No disponible')}</option>
                </select>
              </div>

              {/* Sección de Tamaños / Variantes */}
              <div className="border-t border-b py-3 my-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('Tamaños / Variantes (Opcional)')}</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder={t('Nombre (ej: Grande)')}
                    value={newSizeName}
                    onChange={e => setNewSizeName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTempSize();
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder={t('Precio')}
                    value={newSizePrice}
                    onChange={e => setNewSizePrice(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTempSize();
                      }
                    }}
                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleAddTempSize}
                    className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
                    title={t('Añadir tamaño')}
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                {tempSizes.length > 0 && (
                  <div className="space-y-1 mt-2 max-h-32 overflow-y-auto">
                    {tempSizes.map((s, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-gray-50 p-2 rounded text-sm border border-gray-200">
                        <span className="font-medium text-gray-800">{s.size_name} - {formatCurrency(s.price_modifier)}</span>
                        <button onClick={() => handleRemoveTempSize(idx)} className="text-red-500 hover:text-red-700 p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <div className="text-xs text-blue-600 mt-1">
                      {t('Nota: Si añades tamaños, se recomienda dejar el Precio Base en 0.')}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Imagen (opcional)')}</label>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => setProductImage(e.target.files?.[0] || null)}
                    disabled={uploadingImage}
                    className={`w-full text-sm ${uploadingImage ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                  {uploadingImage && (
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                      <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />
                    </div>
                  )}
                </div>
                {productPreviewUrl && (
                  <div className="mt-2 relative">
                    <img src={productPreviewUrl} alt={t('Vista previa')} className="h-24 w-24 object-cover rounded-lg border border-gray-200" />
                    {uploadingImage && (
                      <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSaveProduct}
                  disabled={isSaving || uploadingImage}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 font-bold shadow-sm"
                >
                  {isSaving || uploadingImage ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {uploadingImage ? t('Subiendo imagen...') : t('Guardando...')}
                    </>
                  ) : (
                    editingProductId ? t('Guardar Cambios') : t('Crear')
                  )}
                </button>
                <button
                  onClick={() => setShowProductModal(false)}
                  disabled={isSaving || uploadingImage}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 text-gray-700 py-2.5 rounded-lg transition-colors font-semibold"
                >
                  {t('Cancelar')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Barra de Búsqueda y Filtros por Nombre, Categoría y Precio */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex-1 flex flex-col sm:flex-row gap-3 w-full">
          {/* Input de Búsqueda General (Nombre, Categoría, Precio) */}
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={t('Buscar por nombre, categoría o precio...')}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none shadow-sm"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                title={t('Borrar búsqueda')}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Selector de Categoría */}
          <div className="relative min-w-[200px]">
            <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={selectedCategoryFilter}
              onChange={e => setSelectedCategoryFilter(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none appearance-none bg-white font-medium text-gray-700 shadow-sm"
            >
              <option value="">{t('Todas las categorías')}</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Contador y Reset */}
        <div className="flex items-center gap-3 text-sm text-gray-600 self-end sm:self-center">
          <span className="font-semibold text-gray-700 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200">
            {filteredProducts.length} / {products.length} {t('productos')}
          </span>
          {(searchTerm || selectedCategoryFilter) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategoryFilter('');
              }}
              className="text-xs text-amber-600 hover:text-amber-800 font-bold underline"
            >
              {t('Limpiar filtros')}
            </button>
          )}
        </div>
      </div>

      {/* Tabla de Productos (Vista limpia) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('Producto')}</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('Categoría')}</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('Precio Base')}</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('Tamaños')}</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('Estado')}</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('Acciones')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  {products.length === 0
                    ? t('No hay productos registrados')
                    : t('No se encontraron productos que coincidan con la búsqueda')}
                </td>
              </tr>
            ) : (
              filteredProducts.map(product => (
                <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {product.image_url && (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="h-11 w-11 object-cover rounded-xl border border-gray-200 shadow-sm flex-shrink-0"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      )}
                      <div>
                        <div className="font-bold text-gray-900 text-sm">{product.name}</div>
                        {product.description && (
                          <div className="text-xs text-gray-500 line-clamp-1">{product.description}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700 font-medium">
                    {getCategoryName(product.category_id)}
                  </td>
                  <td className="px-6 py-4 text-sm font-extrabold text-gray-900">
                    {formatCurrency(product.base_price)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {getProductSizes(product.id).map(s => s.size_name).join(', ') || t('Único')}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-1 text-xs font-bold rounded-full ${
                      product.available
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {product.available ? t('Disponible') : t('No disponible')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleOpenEditModal(product)}
                        className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-xl transition-colors"
                        title={t('Editar producto')}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-xl transition-colors"
                        title={t('Eliminar producto permanentemente')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
