---
name: modulo
description: Convenciones para construir un módulo o funcionalidad por capas con el patrón de Productos (base de datos, esquema Zod, servicio multi-negocio, acción, UI y pruebas) y su definición de terminado. Es la referencia que leen backend-builder, frontend-builder, test-verifier e implementation-validator. Para construir una funcionalidad completa con aprobaciones y PR, usa el skill feature-factory.
---

# Módulo: convenciones por capas

Referencia para implementar un módulo de `docs/roadmap.md` o cualquier funcionalidad con el patrón de capas de `CLAUDE.md`. No es un procedimiento de punta a punta: la historia, el brief, la rama, la documentación y el commit los maneja `feature-factory`. Cada agente lee las secciones que le tocan:

| Agente                     | Secciones                                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `backend-builder`          | Base de datos, Esquema Zod, Servicio, Acción, Pruebas unitarias, Pruebas de integración, Definición de terminado |
| `frontend-builder`         | UI, Pruebas de componentes, Pruebas e2e, Definición de terminado                                                 |
| `test-verifier`            | Pruebas de integración, Pruebas e2e                                                                              |
| `implementation-validator` | Todas (como estándar contra el que comparar)                                                                     |

En adelante, `<modulo>` es el nombre del módulo en inglés y singular para el código (`purchase`, `adjustment`), y `<ruta>` es la ruta en español de la UI (`compras`, `ajustes`).

## Referencias

Antes de escribir, lee las reglas no negociables de `CLAUDE.md`, los modelos relacionados en `prisma/schema.prisma` (`Product`, `InventoryMovement`, `MovementType` y los del módulo, si ya existen) y los ADR de `docs/adr/` que apliquen; p. ej. `0003-costo-promedio-ponderado.md` si el módulo mueve stock o costo.

Implementación de referencia, Productos:

| Capa        | Archivo de referencia                                                |
| ----------- | -------------------------------------------------------------------- |
| Esquema     | `src/lib/schemas/product.ts`                                         |
| Servicio    | `src/server/services/products.ts`                                    |
| Acción      | `src/app/(app)/productos/actions.ts`                                 |
| UI          | `src/app/(app)/productos/page.tsx`, `product-form.tsx`, `nuevo/`     |
| Unit        | `tests/unit/product-schema.test.ts`                                  |
| Componentes | `tests/component/coming-soon.test.tsx`                               |
| Integración | `tests/integration/products.test.ts`, `tests/integration/helpers.ts` |
| E2E         | `tests/e2e/products.spec.ts`                                         |

## Base de datos

Varios modelos ya existen en `prisma/schema.prisma` (p. ej. `Supplier`, `Purchase`, `PurchaseItem`, `Sale`, `CashSession`). Úsalos tal cual si bastan; cámbialos solo si el brief lo justifica.

Si hace falta un cambio:

1. Edita `prisma/schema.prisma`. Tipos: `Decimal(12,2)` dinero, `Decimal(12,4)` costo unitario, `Decimal(12,3)` cantidad. Todo modelo nuevo de nivel superior lleva `businessId` con su relación a `Business`, e índices o `@@unique` que lo incluyan (p. ej. `@@unique([businessId, number])`). Las líneas hijas (como `PurchaseItem`) pueden heredar el negocio de su padre; en ese caso, nunca las consultes sin pasar por el padre filtrado por `businessId`.
2. Crea la migración: `npm run db:migrate -- --name <cambio-descriptivo>`. Nunca edites migraciones ya aplicadas.

En cualquier caso, agrega a `deleteTenant()` en `tests/integration/helpers.ts` todo modelo en el que escriba el módulo, nuevo o existente, respetando el orden de las llaves foráneas (hijos primero; las hijas con `onDelete: Cascade` caen con su padre).

Una decisión de arquitectura nueva va en un ADR en `docs/adr/` con el siguiente número.

## Esquema Zod — `src/lib/schemas/<modulo>.ts`

- Reutiliza el estilo de `product.ts`: los formularios llegan como strings, el vacío se vuelve `undefined` y la coma decimal se acepta (`"1,5"` → `1.5`). Si necesitas un helper de `product.ts` que no está exportado, expórtalo; no lo copies.
- Mensajes en español: `"<Campo> es obligatorio"`, `"<Campo> no puede ser negativo"`, `"<Campo> debe ser un número"`.
- Para listas de ítems (p. ej. líneas de una compra), valida al menos un ítem y cada línea por separado.
- Exporta los tipos con `z.infer`.

Si hay cálculos puros (totales, impuestos, cambio), van en `src/lib/` usando `src/lib/money.ts`. Nunca `number` para dinero.

## Servicio — `src/server/services/<modulo>.ts`

Firma: `fn(ctx: TenantContext, ...args, db: Db = defaultDb)`.

- **Multi-negocio:** toda consulta filtra por `ctx.businessId`. Por id: `findFirst({ where: { id, businessId: ctx.businessId } })`, nunca `findUnique({ where: { id } })`. Todo id que llegue del cliente (producto, proveedor, categoría) se verifica contra el negocio, como `assertCategoryBelongsToBusiness`.
- **Validación:** el servicio hace `schema.parse(raw)` al inicio; no confíes en que la acción ya validó.
- **Errores esperados:** `throw new DomainError(mensaje, campo?)` con mensaje en español. Traduce violaciones de unicidad (`P2002`) como `mapUniqueViolation`.
- **Dinero:** convierte a `Prisma.Decimal` al entrar al servicio.
- **Stock** (si aplica), todo dentro de un `db.$transaction(async (tx) => ...)`:
  1. Bloquea las filas de producto que vas a modificar (`SELECT ... FOR UPDATE` con `tx.$queryRaw`, filtrado por `businessId` y ordenado por id) o usa aislamiento `Serializable`. Leer dentro de la transacción no basta: con READ COMMITTED dos transacciones pueden leer el mismo stock.
  2. Si es una entrada con costo (p. ej. `COMPRA`), calcula el nuevo costo con `weightedAverageCost(stock, cost, qty, unitCost)` antes de actualizar el stock.
  3. Crea el `InventoryMovement`: `businessId`, `productId`, `userId: ctx.userId`, `type`, `quantity` con signo (+ entra, − sale), `unitCost`, `reference` (id del documento) y `note` si aplica.
  4. Actualiza `Product.stock` (y `cost` si cambió) con `tx`.
  5. Si el mismo producto aparece en varias líneas, procésalas en orden partiendo del stock y costo ya actualizados por la línea anterior (o agrúpalas antes). Leer el producto una sola vez al inicio da un costo promedio incorrecto.
- **Ventas:** congela `unitCost` en cada `SaleItem` con el costo del producto en ese momento.
- Nunca edites `stock` fuera de este flujo.

## Acción — `src/app/(app)/<ruta>/actions.ts`

- `"use server"`; cada acción empieza con `const ctx = await requireRole(...)` con los roles del brief.
- Llama al servicio con `Object.fromEntries(formData)` (o los datos ya armados si el formulario envía listas) y traduce errores con un `toFormState` como el de Productos: `ZodError` y `DomainError` → estado del formulario; lo demás se relanza. Nunca devuelvas al cliente el texto de un error inesperado.
- El tipo de retorno es el contrato con la UI: debe llevar lo que la UI muestra. Si la UI muestra errores por línea o por campo, usa la ruta completa como clave (`items.0.quantity`).
- Después del éxito: `revalidatePath` de las rutas afectadas y, si corresponde, `redirect` con `?ok=<estado>`, **fuera** del `try`.
- Nunca recibas `businessId` ni `userId` desde el cliente.

## UI — `src/app/(app)/<ruta>/`

- `page.tsx` como server component: `getTenantContext()` o `requireRole()`, lee con el servicio y formatea con `formatMoney` y la moneda del negocio (`getBusiness`).
- Client components (`"use client"`) solo donde hay interacción: formularios con `useActionState` y escáner con `useBarcodeScanner`.
- Serializa todo `Decimal` a `string` antes de pasarlo a un client component.
- Componentes de `src/components/ui` (shadcn/base-ui), `cn` desde `@/lib/utils`, íconos de lucide-react. Textos en español y etiquetas accesibles (`<Label htmlFor>`, `aria-invalid`, `aria-describedby`), como `product-form.tsx`.
- Estado de carga: el botón de envío se deshabilita y cambia su texto mientras se guarda. Errores de campo junto al campo; mensajes generales con `Alert`.
- Navegación (`src/components/nav.tsx`): si la ruta ya está en `items`, no la dupliques; si no, agrégala. Usa `adminOnly: true` cuando solo `ADMIN` pueda usarla. Ocultar el enlace no autoriza: la página y las acciones siguen llamando a `requireRole`.

## Pruebas unitarias — `tests/unit/`

- `tests/unit/<modulo>-schema.test.ts`: casos válidos, campos obligatorios, negativos, decimal con coma y mensajes en español.
- Toda lógica pura nueva de `src/lib/` (totales, cálculos) con sus casos límite.

## Pruebas de componentes — `tests/component/`

- `tests/component/<nombre>.test.tsx`, con Vitest y Testing Library en jsdom, para cada client component nuevo.
- Interactúa con consultas accesibles (`getByLabelText`, `getByRole`) y verifica lo que ve el usuario: errores, estado de carga y éxito.
- Mockea las server actions con `vi.mock` usando sus tipos de retorno reales. Los server components que leen la base se cubren con e2e.

## Pruebas de integración — `tests/integration/<modulo>.test.ts`

Crea dos negocios con `createTenant()` en `beforeAll` y límpialos con `deleteTenant()` en `afterAll`. No dependas del seed.

Cubre como mínimo:

- El camino feliz de cada función del servicio.
- Validación: entrada inválida rechaza con `ZodError`; reglas de negocio con `DomainError` y su `field`.
- **Aislamiento entre negocios** (obligatorio): el negocio B no puede leer, listar ni modificar lo del negocio A, ni usar ids de A (productos, proveedores) en sus propias operaciones.
- **Si mueve stock:** el `InventoryMovement` creado (tipo, cantidad con signo, `unitCost`, `businessId`, `userId`) y el `Product.stock` resultante. Si recalcula costo, verifica el valor exacto de `Product.cost` con un caso que tenga stock previo y otro con el mismo producto en dos líneas.
- Atomicidad: si una línea falla, no queda stock ni movimientos a medias.

Requiere Postgres (`docker compose up -d`).

## Pruebas e2e — `tests/e2e/<ruta>.spec.ts`

- El flujo principal con selectores accesibles (`getByLabel`, `getByRole`) y datos únicos por ejecución (`Date.now()`).
- Escáner simulado como en `products.spec.ts`: `page.keyboard.type(code, { delay: 5 })` y Enter.
- Requiere el seed (`npm run db:seed`); Playwright levanta el servidor solo.

## Definición de terminado

```bash
npm run lint
npm run typecheck
npm run format:check
npm test                  # unit + componentes
npm run test:integration  # si tocaste servicios
npm run test:e2e          # si tocaste UI o flujos
```

- Si solo falla el formato: `npx prettier --write` sobre los archivos cambiados.
- Si falla otra cosa: arréglala y vuelve a correr todo. No entregues con checks en rojo.
- Si no puedes correr integración o e2e (p. ej. Postgres apagado), dilo explícitamente; no lo des por bueno.
