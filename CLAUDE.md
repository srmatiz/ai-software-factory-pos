# CLAUDE.md

Guía para Claude Code (y cualquier contribuidor) en este repositorio. Léela antes de cambiar código.

## Qué es

POS + inventario multi-negocio para pequeños comercios. Es un proyecto en uso real y, a la vez, la base de una "software factory" de subagentes de Claude Code. Ver `README.md`.

## Stack

| Área          | Tecnología                                                           |
| ------------- | -------------------------------------------------------------------- |
| Framework     | Next.js 15 (App Router, server components, server actions), React 19 |
| Lenguaje      | TypeScript (strict)                                                  |
| Base de datos | PostgreSQL + Prisma 6 (`prisma/schema.prisma`)                       |
| Autenticación | Auth.js v5 (credenciales, sesión JWT, roles `ADMIN` / `CAJERO`)      |
| Validación    | Zod 4 (formularios y variables de entorno en `src/env.ts`)           |
| Dinero        | `Prisma.Decimal` / decimal.js (`src/lib/money.ts`)                   |
| UI            | Tailwind CSS 4 + shadcn/ui (base-ui), íconos lucide-react            |
| Pruebas       | Vitest (unit + integración), Playwright (e2e)                        |
| Calidad / CI  | ESLint, Prettier, GitHub Actions, gitleaks                           |
| Entorno local | Node 20+, npm, Docker Compose (Postgres en el puerto 5433)           |

## Comandos

```bash
docker compose up -d                    # Postgres local (puerto 5433)
npm run dev                             # http://localhost:3000
npm run db:migrate -- --name <cambio>   # tras editar prisma/schema.prisma
npm run db:seed                         # datos demo (solo desarrollo)
npm run lint && npm run typecheck && npm run format:check
```

Los comandos de pruebas están en [Testing](#testing).

## Estructura de documentación

| Ubicación                               | Contenido                                                                                                        | Estado    |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------- |
| `CLAUDE.md`                             | Reglas y convenciones para agentes y contribuidores (este archivo)                                               | ✅        |
| `README.md`                             | Qué es, cómo correrlo, secretos y despliegue                                                                     | ✅        |
| `docs/architecture.md`                  | Arquitectura: capas, multi-negocio, inventario, escáner, offline                                                 | ✅        |
| `docs/adr/`                             | Decisiones de arquitectura numeradas (`NNNN-titulo.md`)                                                          | ✅        |
| `docs/roadmap.md`                       | Módulos pendientes; fuente de tareas para la fábrica                                                             | ✅        |
| `docs/context/`                         | Contexto de dominio para los agentes (negocio, glosario, flujos)                                                 | Pendiente |
| `.claude/agents/`                       | Subagentes de la software factory (7 agentes + orchestrator)                                                     | En curso  |
| `.claude/agents/codebase-researcher.md` | Agente de solo lectura: explica cómo funciona hoy un área del código (archivos, arquitectura, patrones, riesgos) | ✅        |
| `.claude/hooks/readonly-bash.mjs`       | Hook `PreToolUse` para agentes de solo lectura: permite solo comandos de inspección en Bash                      | ✅        |
| `.claude/skills/`                       | Skills reutilizables (flujos y procedimientos que invocan los agentes)                                           | En curso  |
| `.claude/skills/commit/`                | Skill `/commit`: Conventional Commits, rama por feature, checks rápidos, revisión de secretos                    | ✅        |
| `.claude/skills/modulo/`                | Skill `/modulo`: módulo del roadmap por capas (esquema, servicio, acción, UI, pruebas)                           | ✅        |

Reglas:

- Al agregar un agente, skill o documento de contexto, regístralo en esta tabla y marca su estado.
- Las decisiones de arquitectura nuevas van en un ADR en `docs/adr/` con el siguiente número.
- Al terminar un módulo del roadmap, actualiza `docs/roadmap.md` y la tabla de estado del `README.md`.

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

## Testing

| Tipo        | Ubicación            | Comando                    | Qué cubre                                                           |
| ----------- | -------------------- | -------------------------- | ------------------------------------------------------------------- |
| Unit        | `tests/unit/`        | `npm test`                 | Lógica pura: esquemas Zod, `money.ts`, detector de escáner. Sin DB. |
| Integración | `tests/integration/` | `npm run test:integration` | Servicios contra una base real separada (`pos_test`).               |
| E2E         | `tests/e2e/`         | `npm run test:e2e`         | Flujos completos en el navegador con Playwright.                    |

**Unit**

- Toda lógica de negocio pura va en `src/lib/` sin dependencias de framework, para poder probarla aquí.
- Cada esquema Zod nuevo prueba casos válidos, campos obligatorios, negativos, formato decimal con coma y mensajes en español.

**Integración**

- Corren contra `pos_test` (nunca la base de desarrollo). La URL viene de `TEST_DATABASE_URL`, con un valor local por defecto en `vitest.config.mts`. Las migraciones se aplican solas en `tests/integration/global-setup.ts`.
- Crea negocios aislados con `createTenant()` y límpialos con `deleteTenant()` (`tests/integration/helpers.ts`). No dependas de los datos del seed.
- Todo servicio nuevo debe incluir una prueba de **aislamiento entre negocios**: el negocio B no puede leer ni modificar datos del negocio A.
- Si el servicio mueve stock, verifica el `InventoryMovement` creado (tipo, cantidad, costo) y el `Product.stock` resultante.

**E2E**

- Requieren el seed (`npm run db:seed`). Playwright levanta el servidor solo (`playwright.config.ts`).
- Para simular el escáner, escribe muy rápido y termina con Enter (`page.keyboard.type(code, { delay: 5 })`). Ver `tests/e2e/products.spec.ts`.
- Usa selectores accesibles (`getByLabel`, `getByRole`) y datos únicos por ejecución (p. ej. códigos con `Date.now()`).

**Definición de terminado**

- Siempre: lint, typecheck, format:check, unit e integración en verde.
- Además, e2e si la tarea tocó UI o flujos de usuario.
- CI (`.github/workflows/ci.yml`) ejecuta todo lo anterior más el build y gitleaks en cada push y PR.

## Convenciones

- Código, nombres y comentarios en **inglés**; textos de la UI y mensajes de validación en **español**.
- Enums de dominio en español (`COMPRA`, `VENTA`, `ADMIN`, `CAJERO`) porque se muestran al usuario.
- Componentes UI: shadcn/ui (base-ui) en `src/components/ui`. Importa `cn` desde `@/lib/utils`.
- Cambios de esquema: edita `prisma/schema.prisma` y crea una migración con nombre descriptivo; nunca edites migraciones ya aplicadas.

## Hardware

- Escáner USB = teclado (HID). Usa `useBarcodeScanner` (`src/hooks/useBarcodeScanner.ts`), que distingue ráfagas rápidas terminadas en Enter del tecleo humano.
- Impresora térmica y cajón: ESC/POS vía WebUSB/Web Serial (pendiente, ver roadmap).
