# POS Inventario

Punto de venta e inventario **multi-negocio** para pequeños comercios: registro de productos con costo y precio de venta, lectura con escáner de código de barras y, próximamente, facturación (ticket térmico + cajón de dinero), compras, reportes de utilidad y modo offline.

> Proyecto real (en uso por una tienda en un centro comercial) y a la vez proyecto de portafolio de **AI engineering**: es la base sobre la que se construye una "software factory" de subagentes de Claude Code. Ver [docs/roadmap.md](docs/roadmap.md).

## Estado

| Módulo                                                    | Estado     |
| --------------------------------------------------------- | ---------- |
| Base: auth, roles, multi-negocio, layout                  | ✅         |
| Productos (precio, costo, margen, escáner, stock inicial) | ✅         |
| Dashboard de inventario                                   | ✅         |
| Compras (escáner, costo promedio, kardex; sin proveedor)  | ✅         |
| Caja (POS) / Impresión / Reportes / Offline               | 🗺️ Roadmap |

## Stack

Next.js 15 (App Router) · TypeScript · PostgreSQL + Prisma · Auth.js v5 · Tailwind + shadcn/ui · Zod · Vitest · Playwright · GitHub Actions.

## Inicio rápido

Requisitos: Node 20+, Docker.

```bash
npm install
cp .env.example .env            # luego reemplaza AUTH_SECRET: npx auth secret
docker compose up -d            # Postgres local en el puerto 5433
npm run db:migrate              # aplica migraciones
npm run db:seed                 # datos demo
npm run dev                     # http://localhost:3000
```

Usuarios demo: `admin@demo.local` y `cajero@demo.local`, contraseña `demo1234` (solo desarrollo).

## Scripts

| Script                                        | Qué hace                                                  |
| --------------------------------------------- | --------------------------------------------------------- |
| `npm run dev`                                 | Servidor de desarrollo                                    |
| `npm test`                                    | Pruebas unitarias (sin base de datos)                     |
| `npm run test:integration`                    | Pruebas de servicios contra la base `pos_test`            |
| `npm run test:e2e`                            | Pruebas end-to-end con Playwright (requiere seed)         |
| `npm run lint` / `typecheck` / `format:check` | Calidad de código                                         |
| `npm run create-admin`                        | Crea el negocio y su administrador real (pide contraseña) |
| `npm run db:studio`                           | Explorador visual de la base de datos                     |

## Secretos y configuración

El repositorio es público, así que **ningún secreto se versiona**:

- Solo `.env.example` (valores ficticios) está en git; `.env` está en `.gitignore`.
- `src/env.ts` valida las variables al arrancar y falla con un mensaje claro si falta alguna.
- En producción las variables (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST`) se configuran en el proveedor de hosting.
- Los datos del negocio (nombre, NIT, dirección, encabezado del ticket) viven en la base de datos, no en el código.
- El administrador real se crea con `npm run create-admin`; el seed se niega a correr en producción.
- CI ejecuta **gitleaks** en cada push para detectar secretos filtrados.

## Despliegue (resumen)

1. Crear una base Postgres administrada (Neon, Supabase, Railway…).
2. Configurar las variables de entorno en el hosting (Vercel, Railway, Fly.io…).
3. `npm run db:deploy` para aplicar migraciones y `npm run create-admin` para el primer usuario.

## Documentación

- [Arquitectura](docs/architecture.md)
- [Decisiones (ADRs)](docs/adr/)
- [Roadmap](docs/roadmap.md)
- [CLAUDE.md](CLAUDE.md): convenciones para agentes de IA y contribuidores
