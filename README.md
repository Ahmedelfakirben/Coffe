# Coffee Shop - Sistema de Gestión

Sistema de gestión para cafeterías desarrollado con React, TypeScript, Tailwind CSS y Supabase.

## Características

- 🔐 Autenticación de empleados
- 💰 Punto de venta (POS)
- 📋 Gestión de órdenes
- 📦 Administración de productos
- 📊 Análisis de ventas
- 👥 Roles de usuario (Admin, Cajero, Barista)

## Requisitos Previos

- Node.js 18 o superior
- npm o pnpm
- Cuenta en Supabase

## Configuración

1. Clona el repositorio:
   ```bash
   git clone https://github.com/tu-usuario/coffee-shop.git
   cd coffee-shop
   ```

2. Instala las dependencias:
   ```bash
   npm install
   # o con pnpm
   pnpm install
   ```

3. Configura las variables de entorno:
   - Copia el archivo `.env.example` a `.env`
   - Actualiza las variables con tus credenciales de Supabase

4. Configura la base de datos:
   - Las migraciones se encuentran en `/supabase/migrations`
   - Aplica las migraciones en tu proyecto de Supabase

5. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   # o con pnpm
   pnpm dev
   ```

## Estructura del Proyecto

```
├── src/
│   ├── components/     # Componentes React
│   ├── contexts/       # Contextos de React (Auth, etc.)
│   ├── lib/           # Utilidades y configuraciones
│   ├── App.tsx        # Componente principal
│   └── main.tsx       # Punto de entrada
├── supabase/
│   └── migrations/    # Migraciones de la base de datos
└── ...
```

## Scripts Disponibles

- `npm run dev`: Inicia el servidor de desarrollo
- `npm run build`: Construye la aplicación para producción
- `npm run preview`: Vista previa de la build de producción
- `npm run typecheck`: Verifica tipos de TypeScript
- `npm run lint`: Ejecuta el linter

## Base de Datos

El esquema incluye las siguientes tablas:

- `employee_profiles`: Perfiles de empleados
- `products`: Catálogo de productos
- `orders`: Órdenes de clientes
- `order_items`: Items individuales de cada orden

## Seguridad

- Las credenciales de Supabase deben mantenerse privadas
- No compartir el archivo `.env`
- Usar políticas de RLS en Supabase para control de acceso

## Contribuir

1. Crea un fork del repositorio
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request