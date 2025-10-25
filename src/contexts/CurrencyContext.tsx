import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

export interface Currency {
  code: string;
  symbol: string;
  name: string;
  decimal_places: number;
  position: 'before' | 'after';
}

export interface CurrencyContextType {
  currentCurrency: Currency;
  setCurrency: (currency: Currency) => Promise<void>;
  formatCurrency: (amount: number) => string;
  availableCurrencies: Currency[];
  loading: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

// Divisas disponibles (mismas que en la BD)
export const AVAILABLE_CURRENCIES: Currency[] = [
  { code: 'EUR', symbol: '€', name: 'Euro', decimal_places: 2, position: 'after' },
  { code: 'USD', symbol: '$', name: 'US Dollar', decimal_places: 2, position: 'before' },
  { code: 'MAD', symbol: 'DH', name: 'Dirham Marroquí', decimal_places: 2, position: 'after' },
  { code: 'GBP', symbol: '£', name: 'British Pound', decimal_places: 2, position: 'before' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', decimal_places: 0, position: 'before' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', decimal_places: 2, position: 'after' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', decimal_places: 2, position: 'before' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', decimal_places: 2, position: 'before' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', decimal_places: 2, position: 'before' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', decimal_places: 2, position: 'after' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', decimal_places: 2, position: 'after' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone', decimal_places: 2, position: 'after' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Zloty', decimal_places: 2, position: 'after' },
  { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna', decimal_places: 2, position: 'after' },
];

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currentCurrency, setCurrentCurrency] = useState<Currency>({
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    decimal_places: 2,
    position: 'after',
  });
  const [loading, setLoading] = useState(true);

  // Cargar configuración de divisa desde Supabase
  useEffect(() => {
    loadCurrencySettings();

    // Suscribirse a cambios en tiempo real
    const channel = supabase
      .channel('currency-settings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_currency_settings',
        },
        (payload) => {
          console.log('💱 Cambio de divisa detectado:', payload);
          loadCurrencySettings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadCurrencySettings = async () => {
    try {
      const { data, error } = await supabase
        .from('app_currency_settings')
        .select('*')
        .single();

      if (error) {
        console.error('Error cargando configuración de divisa:', error);
        // Mantener EUR por defecto si hay error
        return;
      }

      if (data) {
        setCurrentCurrency({
          code: data.currency_code,
          symbol: data.currency_symbol,
          name: data.currency_name,
          decimal_places: data.decimal_places,
          position: data.position,
        });
        console.log('💱 Divisa cargada:', data.currency_code, data.currency_symbol);
      }
    } catch (err) {
      console.error('Error en loadCurrencySettings:', err);
    } finally {
      setLoading(false);
    }
  };

  const setCurrency = async (currency: Currency) => {
    try {
      const { error } = await supabase
        .from('app_currency_settings')
        .update({
          currency_code: currency.code,
          currency_symbol: currency.symbol,
          currency_name: currency.name,
          decimal_places: currency.decimal_places,
          position: currency.position,
          updated_at: new Date().toISOString(),
        })
        .eq('id', (await supabase.from('app_currency_settings').select('id').single()).data?.id);

      if (error) {
        throw error;
      }

      // Actualizar estado local
      setCurrentCurrency(currency);
      console.log('💱 Divisa actualizada a:', currency.code);
    } catch (err: any) {
      console.error('Error actualizando divisa:', err);
      throw new Error(`No se pudo actualizar la divisa: ${err.message}`);
    }
  };

  const formatCurrency = (amount: number): string => {
    // Formatear el número con los decimales apropiados
    const formatted = amount.toLocaleString('es-ES', {
      minimumFractionDigits: currentCurrency.decimal_places,
      maximumFractionDigits: currentCurrency.decimal_places,
    });

    // Retornar con símbolo en la posición correcta
    if (currentCurrency.position === 'before') {
      return `${currentCurrency.symbol} ${formatted}`;
    } else {
      return `${formatted} ${currentCurrency.symbol}`;
    }
  };

  return (
    <CurrencyContext.Provider
      value={{
        currentCurrency,
        setCurrency,
        formatCurrency,
        availableCurrencies: AVAILABLE_CURRENCIES,
        loading,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
