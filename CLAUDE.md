# CLAUDE.md

Guía para Claude Code (y cualquier contribuidor) en este repositorio. Léela antes de cambiar código.

## Qué es

POS + inventario multi-negocio (Next.js 15 App Router, Prisma/Postgres, Auth.js v5). Ver `README.md`, `docs/architecture.md` y `docs/roadmap.md`.

## Comandos

```bash
docker compose up -d        # Postgres local (puerto 5433)
npm run dev
npm test                    # unit (rápidas, sin DB)
npm run test:integration    # servicios contra pos_test
npm run test:e2e            # Playwright; requiere `npm run db:seed`
npm run lint && npm run typecheck && npm run format:check
npm run db:migrate -- --name <cambio>   # tras editar prisma/schema.prisma
```

Antes de dar una tarea por terminada: lint, typecheck, format:check, unit e integración en verde; e2e si tocaste UI.

## Arquitectura en capas (patrón obligatorio)

Usa el módulo **Productos** como implementación de referencia:

| Capa     | Ubicación                                     | Responsabilidad                                                                     |
| -------- | --------------------------------------------- | ----------------------------------------------------------------------------------- |
| Esquema  | `src/lib/schemas/<modulo>.ts`                 | Validación Zod de la entrada (strings del formulario → tipos). Mensajes en español. |
| Servicio | `src/server/services/<modulo>.ts`             | Lógica de negocio. Recibe `TenantContext` primero y `db` inyectable al final.       |
| Acción   | `src/app/(app)/<ruta>/actions.ts`             | `"use server"`: autoriza con `requireRole`, llama al servicio, traduce errores.     |
| UI       | `src/app/(app)/<ruta>/page.tsx` + componentes | Server components para leer; client components solo donde hay interacción.          |

Referencias: `src/server/services/products.ts`, `src/app/(app)/productos/actions.ts`, `src/app/(app)/productos/product-form.tsx`.

## Reglas no negociables

1. **Multi-negocio:** toda consulta filtra por `ctx.businessId`. El `businessId` sale **solo** de `getTenantContext()` / `requireRole()` (`src/server/tenant.ts`), nunca del cliente. Para buscar por id usa `findFirst({ where: { id, businessId } })`, no `findUnique({ where: { id } })`.
2. **Dinero:** nunca `number`/float para cálculos. Usa `Prisma.Decimal` en el servidor y `src/lib/money.ts` (decimal.js) para cálculos compartidos. Columnas: dinero `Decimal(12,2)`, costos unitarios `Decimal(12,4)`, cantidades `Decimal(12,3)`.
3. **Stock:** solo cambia mediante un `InventoryMovement` (kardex) en la **misma transacción** que actualiza `Product.stock`. Nunca edites `stock` directamente desde un formulario.
4. **Costo:** costo promedio ponderado (`weightedAverageCost`). Las ventas congelan `unitCost` en `SaleItem` para reportar utilidad.
5. **Productos:** precio de venta y costo de adquisición son obligatorios.
6. **Errores esperados:** lanza `DomainError(message, field?)` (`src/server/errors.ts`); las acciones los convierten en errores de formulario. Lo inesperado se relanza.
7. **Secretos:** nada secreto en el repo. Nuevas variables → `src/env.ts` + `.env.example` (valor ficticio) + README.
8. **Decimales al cliente:** serializa `Decimal` a `string` antes de pasarlo a un client component.

## Convenciones

- Código, nombres y comentarios en **inglés**; textos de la UI y mensajes de validación en **español**.
- Enums de dominio en español (`COMPRA`, `VENTA`, `ADMIN`, `CAJERO`) porque se muestran al usuario.
- Componentes UI: shadcn/ui (base-ui) en `src/components/ui`. Importa `cn` desde `@/lib/utils`.
- Lógica sin framework (p. ej. `src/lib/barcode-scanner.ts`) separada de hooks React para poder probarla con unit tests.
- Pruebas: unit en `tests/unit`, integración en `tests/integration` (usa `createTenant()` de `helpers.ts` y verifica aislamiento entre negocios), e2e en `tests/e2e`.
- Cambios de esquema: edita `prisma/schema.prisma` y crea una migración con nombre descriptivo; nunca edites migraciones ya aplicadas.
- Decisiones de arquitectura nuevas → un ADR en `docs/adr/` (siguiente número).

## Hardware

- Escáner USB = teclado (HID). Usa `useBarcodeScanner` (`src/hooks/useBarcodeScanner.ts`), que distingue ráfagas rápidas terminadas en Enter del tecleo humano.
- Impresora térmica y cajón: ESC/POS vía WebUSB/Web Serial (pendiente, ver roadmap).
