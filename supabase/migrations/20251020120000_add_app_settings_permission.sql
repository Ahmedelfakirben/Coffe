-- Agregar permiso de configuración de aplicación para super_admin y admin
-- Los administradores pueden configurar idioma y tema de la aplicación

INSERT INTO role_permissions (role, section, page_id, can_access) VALUES
  ('super_admin', 'Sistema', 'app-settings', true),
  ('admin', 'Sistema', 'app-settings', true)
ON CONFLICT (role, section, page_id) DO NOTHING;

-- Comentario
COMMENT ON TABLE role_permissions IS 'Permisos de acceso a configuración de aplicación - super_admin y admin';