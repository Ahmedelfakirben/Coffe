# Scripts SQL para Sistema de Backup

## Archivos Disponibles

### 1. `backup_simple.sql` ⭐ **RECOMENDADO**

**Usar este archivo** - Es la versión simplificada y corregida.

**Qué hace:**
- ✅ Agrega permiso `backup` para `super_admin` en `role_permissions`
- ✅ Crea tabla `backup_history` con estructura correcta
- ✅ Configura políticas RLS básicas
- ✅ Sin columnas inexistentes
- ✅ Compatible con tu estructura actual de base de datos

**Cómo ejecutar:**
```sql
-- Simplemente copia y pega el contenido completo en Supabase SQL Editor
-- y presiona "Run"
```

---

### 2. `backup_system_setup.sql`

Versión completa con funcionalidades adicionales.

**Qué hace:**
- ✅ Todo lo que hace `backup_simple.sql`
- ✅ Índices adicionales para mejor rendimiento
- ✅ Función de limpieza automática de historial antiguo
- ✅ Comentarios detallados en el código
- ✅ Consultas de verificación

**Nota:** También ha sido corregido para no usar `page_name`.

---

## Instrucciones de Instalación

### Paso 1: Ir a Supabase
1. Abre [Supabase Dashboard](https://app.supabase.com)
2. Selecciona tu proyecto
3. Ve a **SQL Editor** en el menú lateral
4. Haz clic en **+ New query**

### Paso 2: Ejecutar el Script
1. Copia el contenido de `backup_simple.sql`
2. Pégalo en el editor
3. Haz clic en **Run** (o presiona Ctrl+Enter)

### Paso 3: Verificar
Deberías ver un mensaje de éxito y un resultado mostrando:
```
mensaje: "Permiso de backup creado"
role: "super_admin"
section: "system"
page_id: "backup"
can_access: true
```

---

## Estructura de la Tabla role_permissions

Tu tabla tiene esta estructura:
```sql
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY,
  role VARCHAR(50),
  section VARCHAR(100),      -- ⚠️ Requerido
  page_id VARCHAR(100),
  can_access BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(role, section, page_id)
);
```

Por eso necesitamos incluir la columna `section` en el INSERT.

---

## Qué Hace Cada Parte del Script

### 1. Insertar Permiso
```sql
INSERT INTO role_permissions (role, section, page_id, can_access)
VALUES ('super_admin', 'system', 'backup', true)
ON CONFLICT (role, section, page_id)
DO UPDATE SET can_access = true;
```
- Crea un permiso para que `super_admin` pueda acceder a la página `backup`
- Si ya existe, lo actualiza para asegurar que esté habilitado
- La `section` es 'system' porque el backup está en el menú Sistema

### 2. Crear Tabla de Historial
```sql
CREATE TABLE IF NOT EXISTS backup_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  backup_type VARCHAR(20) CHECK (backup_type IN ('manual', 'automatic')),
  size_mb DECIMAL(10,2) NOT NULL,
  tables_included TEXT[] NOT NULL,
  status VARCHAR(20) CHECK (status IN ('completed', 'failed')),
  notes TEXT
);
```
- Guarda un registro de cada backup creado
- `created_by`: Quién lo creó
- `backup_type`: Manual o automático
- `size_mb`: Tamaño del backup
- `tables_included`: Qué tablas se incluyeron
- `status`: Si se completó correctamente

### 3. Políticas RLS
```sql
CREATE POLICY "Super admins can view backup history"
  ON backup_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE employee_profiles.id = auth.uid()
      AND employee_profiles.role = 'super_admin'
      AND employee_profiles.active = true
      AND employee_profiles.deleted_at IS NULL
    )
  );
```
- Solo los `super_admin` activos pueden ver el historial
- Solo los `super_admin` activos pueden crear registros
- Seguridad a nivel de base de datos

---

## Verificación Post-Instalación

Ejecuta estas consultas para verificar que todo esté correcto:

### Verificar Permiso
```sql
SELECT * FROM role_permissions
WHERE page_id = 'backup';
```

Deberías ver:
- `role`: super_admin
- `section`: system
- `page_id`: backup
- `can_access`: true

### Verificar Tabla de Historial
```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'backup_history'
ORDER BY ordinal_position;
```

Deberías ver 8 columnas: id, created_at, created_by, backup_type, size_mb, tables_included, status, notes

### Verificar Políticas RLS
```sql
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'backup_history';
```

Deberías ver 2 políticas: una para SELECT y otra para INSERT

---

## Troubleshooting

### Error: "column page_name does not exist"
- ✅ **Solucionado** - Los scripts actuales no usan `page_name`
- Usa `backup_simple.sql`

### Error: "duplicate key value violates unique constraint"
- El permiso ya existe en tu base de datos
- No es un problema, significa que ya se ejecutó antes
- El script usará `ON CONFLICT DO UPDATE` para actualizarlo

### Error: "relation backup_history already exists"
- La tabla ya existe
- No es un problema, el script usa `CREATE TABLE IF NOT EXISTS`
- No creará una nueva si ya existe

### Error: "policy already exists"
- Las políticas ya existen
- Elimínalas primero con:
```sql
DROP POLICY IF EXISTS "Super admins can view backup history" ON backup_history;
DROP POLICY IF EXISTS "Super admins can insert backup history" ON backup_history;
```
- Luego vuelve a ejecutar el script

---

## Limpieza (Si necesitas empezar de nuevo)

Para eliminar todo y empezar de nuevo:

```sql
-- Eliminar políticas
DROP POLICY IF EXISTS "Super admins can view backup history" ON backup_history;
DROP POLICY IF EXISTS "Super admins can insert backup history" ON backup_history;

-- Eliminar tabla
DROP TABLE IF EXISTS backup_history;

-- Eliminar permiso
DELETE FROM role_permissions WHERE page_id = 'backup';
```

Luego ejecuta de nuevo `backup_simple.sql`

---

## ¿Qué Script Usar?

| Situación | Script Recomendado |
|-----------|-------------------|
| Primera instalación | `backup_simple.sql` |
| Quiero funciones extras | `backup_system_setup.sql` |
| Tengo errores | `backup_simple.sql` |
| Re-instalación | `backup_simple.sql` |

---

**Recomendación:** Usa siempre `backup_simple.sql` a menos que necesites específicamente las funciones adicionales del script completo.
