-- ==============================================================================
-- SCRIPT DE LIMPIEZA DE PEDIDOS E HISTORIAL (RESET DE PRUEBAS A CERO)
-- ==============================================================================
-- Este script elimina ÚNICAMENTE las órdenes de prueba, sus productos asociados
-- y el historial de cambios, MANTENIENDO COMPLETAMENTE INTACTOS:
--   ✅ Usuarios y perfiles de empleados
--   ✅ Categorías y Productos
--   ✅ Tamaños y precios
--   ✅ Configuración de la empresa y permisos
--   ✅ Distribución de mesas (se dejan en estado 'disponible')
-- ==============================================================================

BEGIN;

-- 1. Eliminar el historial y auditoría de pedidos
DELETE FROM public.order_history;

-- 2. Eliminar el registro de pedidos borrados (si existe la tabla)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deleted_orders') THEN
        DELETE FROM public.deleted_orders;
    END IF;
END $$;

-- 3. Eliminar los items/detalles de los pedidos
DELETE FROM public.order_items;

-- 4. Eliminar las órdenes principales
DELETE FROM public.orders;

-- 5. Restablecer las mesas a estado 'disponible' ('available')
UPDATE public.tables SET status = 'available';

-- ==============================================================================
-- OPCIONAL: Si también deseas reiniciar las sesiones de apertura/cierre de caja
-- que abriste durante las pruebas, descomenta la siguiente línea:
-- DELETE FROM public.cash_register_sessions;
-- ==============================================================================

COMMIT;

-- Consulta de verificación para comprobar que todo quedó limpio y los productos a salvo:
SELECT 
    (SELECT count(*) FROM public.orders) AS total_pedidos,
    (SELECT count(*) FROM public.order_items) AS total_items,
    (SELECT count(*) FROM public.order_history) AS total_historial,
    (SELECT count(*) FROM public.products) AS productos_intactos,
    (SELECT count(*) FROM public.categories) AS categorias_intactas,
    (SELECT count(*) FROM public.employee_profiles) AS empleados_intactos;
