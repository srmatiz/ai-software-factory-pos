# Arquitectura

## Vista general

```
Navegador (PC de caja / celular)
  │  Next.js App Router: server components + server actions
  │  Escáner USB (teclado HID) ──► useBarcodeScanner
  │  [futuro] Service worker + IndexedDB (offline) · WebUSB → impresora ESC/POS → cajón
  ▼
Next.js (Node)
  middleware.ts ──► Auth.js (JWT): sin sesión → /login
  app/(app)/*/actions.ts ──► requireRole() ──► services/* ──► Prisma ──► PostgreSQL
```

## Capas

1. **UI** (`src/app`, `src/components`): server components leen datos llamando servicios; los formularios son client components que envían a server actions con `useActionState`.
2. **Acciones** (`actions.ts`): autorización por rol, invocación del servicio, traducción de `ZodError`/`DomainError` a estado de formulario, `revalidatePath` + `redirect`.
3. **Servicios** (`src/server/services`): reglas de negocio, transacciones, scoping por negocio. Reciben `TenantContext` y un `db` inyectable (las pruebas de integración usan una base aparte).
4. **Datos** (`prisma/schema.prisma`): PostgreSQL. El modelo completo (ventas, compras, caja) ya está definido aunque los módulos se implementen después.

## Multi-negocio

Base de datos compartida, aislamiento por fila: cada tabla de negocio tiene `businessId`. La sesión (JWT) lleva `businessId` y `role`; `getTenantContext()` es la única fuente de `businessId`. Las pruebas de integración verifican que un negocio no puede leer ni modificar datos de otro. Ver [ADR 0002](adr/0002-multi-negocio.md).

## Inventario y costos

- `InventoryMovement` (kardex) es la fuente de verdad; `Product.stock` es una caché que se actualiza en la misma transacción.
- Costo promedio ponderado al recibir mercancía; las ventas congelan el costo en `SaleItem.unitCost`, así la utilidad histórica no cambia cuando cambian los costos. Ver [ADR 0003](adr/0003-costo-promedio-ponderado.md).

## Escáner de códigos de barras

Los lectores USB emulan un teclado. `src/lib/barcode-scanner.ts` detecta ráfagas (< 50 ms entre teclas, mínimo 4 caracteres, terminadas en Enter). El hook escucha en fase de captura sobre `window`, así funciona sin importar el foco, y anula el Enter para no enviar formularios.

## Offline (planificado)

Ver [ADR 0004](adr/0004-pwa-offline.md): PWA con service worker, catálogo en IndexedDB, ventas con UUID generado en el cliente y sincronización idempotente.

## Seguridad y secretos

Ver [ADR 0005](adr/0005-secretos-repo-publico.md). Contraseñas con bcrypt; sesiones JWT firmadas con `AUTH_SECRET`; variables validadas con Zod en `src/env.ts`; gitleaks en CI.
