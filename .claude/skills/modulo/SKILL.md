---
name: modulo
description: Construye un módulo del roadmap (p. ej. Compras, Ajustes, Caja) siguiendo el patrón de capas de Productos — esquema Zod, servicio multi-negocio, acción, UI y pruebas — y cierra con la definición de terminado y /commit. Úsalo cuando el usuario o un agente pida implementar un módulo o funcionalidad de docs/roadmap.md.
argument-hint: "<módulo del roadmap, p. ej. compras>"
---

# Módulo

Procedimiento para implementar un módulo de `docs/roadmap.md` con el patrón de capas de `CLAUDE.md`. Síguelo en orden y **detente** si un paso falla.

El argumento (`$ARGUMENTS`) nombra el módulo. Si falta o no coincide con un ítem del roadmap, pregunta cuál antes de seguir.

En adelante, `<modulo>` es el nombre del módulo en inglés y singular para el código (`purchase`, `adjustment`), y `<ruta>` es la ruta en español de la UI (`compras`, `ajustes`).

## 1. Entender el módulo

Lee, antes de escribir nada:

- El ítem en `docs/roadmap.md` y las reglas no negociables de `CLAUDE.md`.
- Los modelos relacionados en `prisma/schema.prisma` (`Product`, `InventoryMovement`, `MovementType` y los del módulo, si ya existen).
- Los ADR de `docs/adr/` que apliquen; p. ej. `0003-costo-promedio-ponderado.md` si el módulo mueve stock o costo.
- La implementación de referencia, Productos:

| Capa        | Archivo de referencia                                                |
| ----------- | -------------------------------------------------------------------- |
| Esquema     | `src/lib/schemas/product.ts`                                         |
| Servicio    | `src/server/services/products.ts`                                    |
| Acción      | `src/app/(app)/productos/actions.ts`                                 |
| UI          | `src/app/(app)/productos/page.tsx`, `product-form.tsx`, `nuevo/`     |
| Unit        | `tests/unit/product-schema.test.ts`                                  |
| Integración | `tests/integration/products.test.ts`, `tests/integration/helpers.ts` |
| E2E         | `tests/e2e/products.spec.ts`                                         |

## 2. Plan y confirmación

Presenta al usuario un plan corto y **espera su confirmación** antes de escribir código:

- Modelos y campos nuevos o modificados, con sus tipos (`Decimal(12,2)` dinero, `Decimal(12,4)` costo unitario, `Decimal(12,3)` cantidad).
- Funciones del servicio, qué rol puede invocar cada acción (`ADMIN`, `CAJERO`) y qué rutas de UI habrá.
- Si mueve stock: tipo de movimiento (`COMPRA`, `AJUSTE`, `VENTA`, `DEVOLUCION`), signo de la cantidad y si recalcula el costo.
- Errores de dominio esperados (`DomainError` con su `field`).
- Decisiones de arquitectura nuevas, que irán en un ADR.

Si el módulo es grande (p. ej. Caja), propón dividirlo en entregas y construye solo la primera.

## 3. Rama

- Si estás en `main`, crea `feat/<ruta>` (p. ej. `feat/compras`).
- Si ya estás en una rama de feature para este módulo, sigue en ella.

## 4. Esquema de base de datos

Varios modelos ya existen en `prisma/schema.prisma` (p. ej. `Supplier`, `Purchase`, `PurchaseItem`, `Sale`, `CashSession`). Úsalos tal cual si bastan; cámbialos solo si el plan lo justifica.

Si hace falta un cambio:

1. Edita `prisma/schema.prisma`. Todo modelo nuevo de nivel superior lleva `businessId` con su relación a `Business`, e índices o `@@unique` que lo incluyan (p. ej. `@@unique([businessId, number])`). Las líneas hijas (como `PurchaseItem`) pueden heredar el negocio de su padre; en ese caso, nunca las consultes sin pasar por el padre filtrado por `businessId`.
2. Crea la migración: `npm run db:migrate -- --name <cambio-descriptivo>`. Nunca edites migraciones ya aplicadas.

En cualquier caso, agrega a `deleteTenant()` en `tests/integration/helpers.ts` todo modelo en el que escriba el módulo, nuevo o existente, respetando el orden de las llaves foráneas (hijos primero; las hijas con `onDelete: Cascade` caen con su padre).

## 5. Esquema Zod — `src/lib/schemas/<modulo>.ts`

- Reutiliza el estilo de `product.ts`: los formularios llegan como strings, el vacío se vuelve `undefined` y la coma decimal se acepta (`"1,5"` → `1.5`).
- Mensajes en español: `"<Campo> es obligatorio"`, `"<Campo> no puede ser negativo"`, `"<Campo> debe ser un número"`.
- Para listas de ítems (p. ej. líneas de una compra), valida al menos un ítem y cada línea por separado.
- Exporta los tipos con `z.infer`.

Prueba unitaria en `tests/unit/<modulo>-schema.test.ts`: casos válidos, campos obligatorios, negativos, decimal con coma y mensajes en español.

Si hay cálculos puros (totales, impuestos, cambio), van en `src/lib/` con su prueba unitaria y usando `src/lib/money.ts`. Nunca `number` para dinero.

## 6. Servicio — `src/server/services/<modulo>.ts`

Firma: `fn(ctx: TenantContext, ...args, db: Db = defaultDb)`.

- **Multi-negocio:** toda consulta filtra por `ctx.businessId`. Por id: `findFirst({ where: { id, businessId: ctx.businessId } })`, nunca `findUnique({ where: { id } })`. Todo id que llegue del cliente (producto, proveedor, categoría) se verifica contra el negocio, como `assertCategoryBelongsToBusiness`.
- **Validación:** el servicio hace `schema.parse(raw)` al inicio; no confíes en que la acción ya validó.
- **Errores esperados:** `throw new DomainError(mensaje, campo?)` con mensaje en español. Traduce violaciones de unicidad (`P2002`) como `mapUniqueViolation`.
- **Dinero:** convierte a `Prisma.Decimal` al entrar al servicio.
- **Stock** (si aplica), todo dentro de un `db.$transaction(async (tx) => ...)`:
  1. Lee el producto con `tx` y filtrado por negocio.
  2. Si es una entrada con costo (p. ej. `COMPRA`), calcula el nuevo costo con `weightedAverageCost(stock, cost, qty, unitCost)` antes de actualizar el stock.
  3. Crea el `InventoryMovement`: `businessId`, `productId`, `userId: ctx.userId`, `type`, `quantity` con signo (+ entra, − sale), `unitCost`, `reference` (id del documento) y `note` si aplica.
  4. Actualiza `Product.stock` (y `cost` si cambió) con `tx`.
  5. Si el mismo producto aparece en varias líneas, procésalas en orden partiendo del stock y costo ya actualizados por la línea anterior (o agrúpalas antes). Leer el producto una sola vez al inicio da un costo promedio incorrecto.
- **Ventas:** congela `unitCost` en cada `SaleItem` con el costo del producto en ese momento.
- Nunca edites `stock` fuera de este flujo.

## 7. Prueba de integración — `tests/integration/<modulo>.test.ts`

Crea dos negocios con `createTenant()` en `beforeAll` y límpialos con `deleteTenant()` en `afterAll`. No dependas del seed.

Cubre como mínimo:

- El camino feliz de cada función del servicio.
- Validación: entrada inválida rechaza con `ZodError`; reglas de negocio con `DomainError` y su `field`.
- **Aislamiento entre negocios** (obligatorio): el negocio B no puede leer, listar ni modificar lo del negocio A, ni usar ids de A (productos, proveedores) en sus propias operaciones.
- **Si mueve stock:** el `InventoryMovement` creado (tipo, cantidad con signo, `unitCost`, `businessId`, `userId`) y el `Product.stock` resultante. Si recalcula costo, verifica el valor exacto de `Product.cost` con un caso que tenga stock previo y otro con el mismo producto en dos líneas.
- Atomicidad: si una línea falla, no queda stock ni movimientos a medias.

Corre `npm run test:integration` (necesita `docker compose up -d`).

## 8. Acción — `src/app/(app)/<ruta>/actions.ts`

- `"use server"`; cada acción empieza con `const ctx = await requireRole(...)` con los roles del plan.
- Llama al servicio con `Object.fromEntries(formData)` (o los datos ya armados si el formulario envía listas) y traduce errores con un `toFormState` como el de Productos: `ZodError` y `DomainError` → estado del formulario; lo demás se relanza.
- Después del éxito: `revalidatePath` de las rutas afectadas y `redirect` con `?ok=<estado>`, **fuera** del `try`.
- Nunca recibas `businessId` ni `userId` desde el formulario.

## 9. UI — `src/app/(app)/<ruta>/`

- `page.tsx` como server component: `getTenantContext()`, lee con el servicio y formatea con `formatMoney` y la moneda del negocio (`getBusiness`).
- Client components (`"use client"`) solo donde hay interacción: formularios con `useActionState` y escáner con `useBarcodeScanner`.
- Serializa todo `Decimal` a `string` antes de pasarlo a un client component.
- Componentes de `src/components/ui` (shadcn/base-ui), `cn` desde `@/lib/utils`, íconos de lucide-react. Textos en español y etiquetas accesibles (`<Label htmlFor>`).
- Navegación (`src/components/nav.tsx`): si la ruta ya está en `items`, no la dupliques; si no, agrégala. Usa `adminOnly: true` cuando solo `ADMIN` pueda usarla. Ocultar el enlace no autoriza: la página y las acciones siguen llamando a `requireRole`.

Prueba e2e en `tests/e2e/<ruta>.spec.ts` para el flujo principal: selectores accesibles (`getByLabel`, `getByRole`), datos únicos con `Date.now()` y el escáner simulado como en `products.spec.ts`. Requiere `npm run db:seed`.

## 10. Definición de terminado

```bash
npm run lint
npm run typecheck
npm run format:check
npm test
npm run test:integration
npm run test:e2e
```

- Si solo falla el formato: `npx prettier --write` sobre los archivos cambiados.
- Si falla otra cosa: arréglala y vuelve a correr todo. No sigas con checks en rojo.
- Si no puedes correr integración o e2e (p. ej. Postgres apagado), dilo explícitamente en el resumen; no lo des por bueno.

## 11. Documentación

- `docs/roadmap.md`: marca el módulo como hecho (o la entrega construida, si se dividió).
- `README.md`: actualiza la tabla de estado de módulos.
- Nuevas variables de entorno: `src/env.ts` + `.env.example` (valor ficticio) + README.
- Decisión de arquitectura nueva: ADR en `docs/adr/` con el siguiente número.

## 12. Cerrar

Resume para el usuario: archivos creados por capa, migración (si hubo), pruebas agregadas y resultado de cada check. Luego invoca `/commit` con tipo `feat` y el scope del módulo (p. ej. `feat(compras): register supplier purchases`).
