-- Agregar permiso de company-settings para super_admin
-- Solo el super_admin puede ver y editar la información de la empresa

INSERT INTO role_permissions (role, section, page_id, can_access) VALUES
  ('super_admin', 'Sistema', 'company-settings', true)
ON CONFLICT (role, section, page_id) DO NOTHING;

-- Comentario
COMMENT ON TABLE company_settings IS 'Permisos de acceso a configuración de empresa - solo super_admin';
