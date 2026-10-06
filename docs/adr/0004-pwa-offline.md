# ADR 0004: Modo offline como PWA

**Estado:** aceptada (implementación pendiente) · 2026-10-06

## Contexto

La caja debe seguir vendiendo si se cae internet en el centro comercial.

## Decisión

- Service worker que cachea la app de `/pos` (la primera carga requiere conexión).
- Catálogo (código, precio, costo, impuesto) en IndexedDB con sincronización delta (`updatedAt`).
- Ventas offline con UUID generado en el cliente y número de ticket local por caja; se guardan en una cola en IndexedDB y se imprimen normalmente.
- Al reconectar, `POST /api/sync/sales` en lotes, **idempotente** por UUID; el servidor recalcula totales, descuenta stock y crea movimientos.
- Si el stock queda negativo por ventas offline, se acepta y se genera alerta (`Business.allowNegativeStock`).

## Consecuencias

- `Sale.id` no lo genera la base de datos; `Sale.createdOfflineAt` conserva la hora real de la venta.
- El stock mostrado offline es aproximado; con una sola caja el riesgo es mínimo.
