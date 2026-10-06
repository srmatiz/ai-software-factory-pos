# Roadmap

La base (fase 1) está lista. Los módulos siguientes se construirán con la **software factory de subagentes** (fase 2), usando el módulo Productos y `CLAUDE.md` como referencia.

## Fase 2: software factory de subagentes

Definir en `.claude/agents/` un equipo de subagentes y un flujo que los encadene. Propuesta inicial:

- **planner**: convierte un ítem del roadmap en un plan técnico (esquema, servicio, acción, UI, pruebas).
- **implementer**: implementa siguiendo `CLAUDE.md`.
- **test-writer**: pruebas unitarias, de integración (con aislamiento por negocio) y e2e.
- **reviewer**: revisión de correctitud, seguridad (tenant, secretos) y reglas de dinero/stock.
- **docs-writer**: actualiza README, ADRs y este roadmap.

## Módulos pendientes (orden sugerido)

1. **Compras / entradas de mercancía** (`/compras`): proveedor, ítems escaneados, actualización de stock y costo promedio (`weightedAverageCost`) en una transacción, movimiento `COMPRA`.
2. **Ajustes de inventario**: conteo físico, mermas, motivo obligatorio, movimiento `AJUSTE`.
3. **Caja (POS)** (`/pos`): apertura/cierre de caja (`CashSession`), carrito con escáner, cobro (efectivo/tarjeta/transferencia, cambio), venta con `SaleItem.unitCost` congelado, movimiento `VENTA`, número de ticket `<prefijo>-<consecutivo>`.
4. **Impresión y cajón**: generador ESC/POS (58/80 mm), envío por WebUSB/Web Serial, comando de apertura de cajón (`ESC p 0 25 250`), fallback `window.print()`, interfaz `PrinterDriver`.
5. **Anulaciones y devoluciones**: solo admin, revierte stock (`DEVOLUCION`).
6. **Reportes** (`/reportes`): inventario valorizado, ventas por rango/producto/categoría/cajero, costo, utilidad y margen, kardex por producto, exportación CSV.
7. **Modo offline**: service worker (Serwist), catálogo en IndexedDB (Dexie) con sincronización delta, cola de ventas, `POST /api/sync/sales` idempotente por UUID, indicador de conexión.
8. **Configuración** (`/config`): datos del negocio, usuarios, cajas, impresora.
9. **Importación CSV de productos.**
10. **Despliegue**: hosting + Postgres administrado, migraciones en el pipeline, backups.

## Futuro

- Facturación electrónica por país detrás de una interfaz `FiscalProvider`.
- Migrar la configuración de Prisma de `package.json#prisma` a `prisma.config.ts` (requerido en Prisma 7).
