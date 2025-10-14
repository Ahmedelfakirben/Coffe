import { createContext, useContext, ReactNode, useState, useCallback } from 'react';
import { Product, ProductSize } from '../types/supabase';

interface CartItem {
  product: Product;
  size: ProductSize | null;
  quantity: number;
  notes: string;
}

interface CartContextType {
  items: CartItem[];
  total: number;
  paymentMethod: 'cash' | 'card' | 'digital';
  addItem: (product: Product, size?: ProductSize) => void;
  updateQuantity: (index: number, delta: number) => void;
  removeItem: (index: number) => void;
  setItemNotes: (index: number, notes: string) => void;
  setPaymentMethod: (method: 'cash' | 'card' | 'digital') => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'digital'>('cash');

  const addItem = useCallback((product: Product, size: ProductSize | null = null) => {
    setItems(currentItems => {
      const existingIndex = currentItems.findIndex(
        item => item.product.id === product.id && item.size?.id === size?.id
      );

      if (existingIndex >= 0) {
        const newItems = [...currentItems];
        newItems[existingIndex].quantity += 1;
        return newItems;
      }

      return [...currentItems, { product, size, quantity: 1, notes: '' }];
    });
  }, []);

  const updateQuantity = useCallback((index: number, delta: number) => {
    setItems(currentItems => {
      const newItems = [...currentItems];
      newItems[index].quantity += delta;
      return newItems[index].quantity <= 0 
        ? newItems.filter((_, i) => i !== index)
        : newItems;
    });
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems(currentItems => currentItems.filter((_, i) => i !== index));
  }, []);

  const setItemNotes = useCallback((index: number, notes: string) => {
    setItems(currentItems => {
      const newItems = [...currentItems];
      newItems[index].notes = notes;
      return newItems;
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const total = items.reduce((sum, item) => {
    const basePrice = item.product.base_price;
    const sizeModifier = item.size?.price_modifier || 0;
    return sum + (basePrice + sizeModifier) * item.quantity;
  }, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        total,
        paymentMethod,
        addItem,
        updateQuantity,
        removeItem,
        setItemNotes,
        setPaymentMethod,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}