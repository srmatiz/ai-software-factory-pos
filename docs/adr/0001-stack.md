# ADR 0001: Stack tecnológico

**Estado:** aceptada · 2026-10-06

## Contexto

Un solo desarrollador, una app que debe usarse en una tienda real, ser reutilizable para otros negocios, funcionar sin conexión en la caja y servir como proyecto de portafolio construido con agentes de IA.

## Decisión

Next.js 15 (App Router) + TypeScript estricto, PostgreSQL + Prisma, Auth.js v5 (credenciales, JWT), Tailwind + shadcn/ui, Zod, Vitest + Playwright, GitHub Actions.

## Consecuencias

- Un solo proyecto para UI y API (server actions), lo que simplifica despliegue y el contexto que necesitan los agentes.
- TypeScript de punta a punta con tipos generados por Prisma: errores detectados por `tsc` antes de ejecutar.
- PWA posible sin app nativa (ver ADR 0004).
- Dependencia de Node en el servidor; Auth.js v5 aún en beta (riesgo aceptado, API estable en la práctica).
