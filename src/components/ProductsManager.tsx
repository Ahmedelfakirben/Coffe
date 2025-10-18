import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import { toast } from 'react-hot-toast';

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
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sizes, setSizes] = useState<ProductSize[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    category_id: '',
    base_price: 0,
    available: true,
  });
  const [newProductImage, setNewProductImage] = useState<File | null>(null);
  const [newProductPreviewUrl, setNewProductPreviewUrl] = useState<string | null>(null);
  const [editingImage, setEditingImage] = useState<File | null>(null);
  const [editingImagePreviewUrl, setEditingImagePreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
    fetchProducts();
    fetchSizes();
  }, []);

  // Vista previa para nueva imagen de producto
  useEffect(() => {
    if (!newProductImage) {
      setNewProductPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(newProductImage);
    setNewProductPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [newProductImage]);

  // Vista previa para imagen en edición
  useEffect(() => {
    if (!editingImage) {
      setEditingImagePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(editingImage);
    setEditingImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [editingImage]);

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

  const handleCreateProduct = async () => {
    try {
      const { data: created, error } = await supabase
        .from('products')
        .insert(newProduct)
        .select('id')
        .single();

      if (error) {
        alert('Error al crear producto');
        return;
      }

      if (created && newProductImage) {
        const fileExt = newProductImage.name.split('.').pop();
        const filePath = `products/${created.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(filePath, newProductImage, {
            upsert: true,
            contentType: newProductImage.type,
          });

        if (uploadError) {
          console.error('Error subiendo imagen:', uploadError);
          toast.error(`Error subiendo imagen: ${uploadError.message || 'Verifica el bucket "product-images" y permisos públicos.'}`);
        } else {
          const { data: publicData } = supabase.storage
            .from('product-images')
            .getPublicUrl(filePath);

          const publicUrl = publicData?.publicUrl;
          if (publicUrl) {
            await supabase
              .from('products')
              .update({ image_url: publicUrl })
              .eq('id', created.id);
          } else {
            toast.error('No se pudo obtener la URL pública de la imagen.');
          }
        }
      }

      setShowNewProduct(false);
      setNewProduct({ name: '', description: '', category_id: '', base_price: 0, available: true });
      setNewProductImage(null);
      setNewProductPreviewUrl(null);
      fetchProducts();
    } catch (err) {
      console.error('Error creando producto:', err);
      alert('Error al crear producto');
    }
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct) return;
    const { error } = await supabase
      .from('products')
      .update({
        name: editingProduct.name,
        description: editingProduct.description,
        category_id: editingProduct.category_id,
        base_price: editingProduct.base_price,
        available: editingProduct.available,
      })
      .eq('id', editingProduct.id);

    if (error) {
      alert('Error al actualizar producto');
      return;
    }

    // Subir nueva imagen si se seleccionó
    if (editingImage && editingProduct) {
      const fileExt = editingImage.name.split('.').pop();
      const filePath = `products/${editingProduct.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, editingImage, {
          upsert: true,
          contentType: editingImage.type,
        });

      if (uploadError) {
        console.error('Error subiendo imagen:', uploadError);
        toast.error(`Error subiendo imagen: ${uploadError.message || ''}`);
      } else {
        const { data: publicData } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath);

        if (publicData?.publicUrl) {
          await supabase
            .from('products')
            .update({ image_url: publicData.publicUrl })
            .eq('id', editingProduct.id);
        } else {
          toast.error('No se pudo obtener la URL pública de la imagen.');
        }
      }
    }

    setEditingImage(null);
    setEditingImagePreviewUrl(null);
    setEditingProduct(null);
    fetchProducts();
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este producto?\n\nEl producto será eliminado permanentemente de la lista de productos activos. Los pedidos históricos que contengan este producto se mantendrán intactos.')) return;

    try {
      // Check if product is used in any orders (for informational purposes)
      console.log('Checking product usage for ID:', id);
      const { data: orderItems, error: checkError } = await supabase
        .from('order_items')
        .select('id, orders!inner(status)')
        .eq('product_id', id)
        .limit(1);

      if (checkError) {
        console.error('Error checking product usage:', checkError);
        toast.error('Error al verificar el uso del producto');
        return;
      }

      console.log('Order items found:', orderItems);
      if (orderItems && orderItems.length > 0) {
        console.log('Product is used in orders, but will proceed with soft delete');
      }

      console.log('Proceeding with soft delete');

      // Check if product appears in order history (for informational purposes only)
      const { data: historyItems, error: historyError } = await supabase
        .from('order_history')
        .select('id, items')
        .limit(1000); // Get a reasonable number of recent history records

      if (historyError) {
        console.error('Error checking order history:', historyError);
        // Don't block deletion for history check errors
      }

      let productInHistory = false;
      if (historyItems) {
        productInHistory = historyItems.some(record => {
          try {
            const items = Array.isArray(record.items) ? record.items : [];
            return items.some((item: any) => item.product_id === id);
          } catch (err) {
            console.error('Error parsing order history items:', err);
            return false;
          }
        });
      }

      if (productInHistory) {
        console.log('Product found in order history, but proceeding with soft delete');
        toast('El producto aparece en el historial de pedidos, pero se eliminará correctamente.', {
          icon: '⚠️',
          duration: 4000
        });
      }

      // Proceed with direct deletion (constraints now allow this)
      const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('Error deleting product:', deleteError);
        toast.error(`Error al eliminar producto: ${deleteError.message}`);
        return;
      }

      toast.success('Producto eliminado correctamente. El historial de pedidos se mantiene intacto.');
      fetchProducts();
    } catch (err) {
      console.error('Error in delete operation:', err);
      toast.error('Error al eliminar producto');
    }
  };

  const getCategoryName = (categoryId: string | null) => {
    return categories.find(c => c.id === categoryId)?.name || 'Sin categoría';
  };

  const getProductSizes = (productId: string) => {
    return sizes.filter(s => s.product_id === productId);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Gestión de Productos</h2>
        <button
          onClick={() => setShowNewProduct(true)}
          className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nuevo Producto
        </button>
      </div>

      {showNewProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Nuevo Producto</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  value={newProduct.description}
                  onChange={e => setNewProduct({ ...newProduct, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                <select
                  value={newProduct.category_id}
                  onChange={e => setNewProduct({ ...newProduct, category_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">Seleccionar categoría</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Precio Base</label>
                <input
                  type="number"
                  step="0.01"
                  value={newProduct.base_price}
                  onChange={e => setNewProduct({ ...newProduct, base_price: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Imagen (opcional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => setNewProductImage(e.target.files?.[0] || null)}
                  className="w-full"
                />
                {newProductPreviewUrl && (
                  <div className="mt-2">
                    <img src={newProductPreviewUrl} alt="Vista previa" className="h-24 w-24 object-cover rounded border" />
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreateProduct}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-2 rounded-lg transition-colors"
                >
                  Crear
                </button>
                <button
                  onClick={() => setShowNewProduct(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Precio Base</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tamaños</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {products.map(product => (
              <tr key={product.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  {editingProduct?.id === product.id ? (
                    <div>
                      <input
                        type="text"
                        value={editingProduct.name}
                        onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      />
                      <div className="mt-2 flex items-center gap-3">
                        {(editingImagePreviewUrl || product.image_url) && (
                          <img
                            src={editingImagePreviewUrl || product.image_url || ''}
                            alt="Vista previa"
                            className="h-16 w-16 object-cover rounded border"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={e => {
                            const file = e.target.files?.[0] || null;
                            setEditingImage(file);
                          }}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="font-medium text-gray-900">
                        {product.name}
                      </div>
                      <div className="text-sm text-gray-500">{product.description}</div>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {editingProduct?.id === product.id ? (
                    <select
                      value={editingProduct.category_id || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, category_id: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded"
                    >
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  ) : (
                    getCategoryName(product.category_id)
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {editingProduct?.id === product.id ? (
                    <input
                      type="number"
                      step="0.01"
                      value={editingProduct.base_price}
                      onChange={e => setEditingProduct({ ...editingProduct, base_price: parseFloat(e.target.value) })}
                      className="w-20 px-2 py-1 border border-gray-300 rounded"
                    />
                  ) : (
                    `$${product.base_price.toFixed(2)}`
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {getProductSizes(product.id).map(s => s.size_name).join(', ') || 'Único'}
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    product.available
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {product.available ? 'Disponible' : 'No disponible'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  {editingProduct?.id === product.id ? (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={handleUpdateProduct}
                        className="text-green-600 hover:text-green-800"
                      >
                        <Save className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setEditingProduct(null)}
                        className="text-gray-600 hover:text-gray-800"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingProduct(product)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Editar producto"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Eliminar producto permanentemente"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
