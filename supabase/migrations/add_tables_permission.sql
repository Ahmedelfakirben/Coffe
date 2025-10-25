-- ============================================
-- AGREGAR PERMISO PARA GESTIÓN DE MESAS
-- ============================================
-- Inserta el permiso 'tables' para super_admin y admin
-- ============================================

-- Eliminar permisos existentes si existen
DELETE FROM public.role_permissions
WHERE page_id = 'tables';

-- Insertar permiso para super_admin
INSERT INTO public.role_permissions (role, section, page_id, can_access)
VALUES ('super_admin', 'Sistema', 'tables', true);

-- Insertar permiso para admin
INSERT INTO public.role_permissions (role, section, page_id, can_access)
VALUES ('admin', 'Sistema', 'tables', true);

-- ============================================
-- VERIFICACIÓN
-- ============================================

-- Mostrar todos los permisos de 'tables'
SELECT role, page_id, can_access
FROM public.role_permissions
WHERE page_id = 'tables'
ORDER BY role;
