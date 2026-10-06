# ADR 0002: Multi-negocio con aislamiento por fila

**Estado:** aceptada · 2026-10-06

## Contexto

La app debe reutilizarse en varios negocios sin desplegar una copia por cliente.

## Decisión

Una base de datos compartida; cada tabla de negocio tiene `businessId`. El `businessId` se obtiene solo de la sesión mediante `getTenantContext()`/`requireRole()`; los servicios lo reciben como primer argumento y filtran todas las consultas. Las unicidades (código de barras, SKU, número de ticket) son por negocio.

## Alternativas descartadas

- Base de datos por negocio: más aislamiento, pero operación y migraciones más costosas para el tamaño actual.
- Row Level Security de Postgres: más robusto, pero complica Prisma; se puede añadir después como defensa en profundidad.

## Consecuencias

- Cada servicio nuevo debe respetar el scoping; las pruebas de integración verifican el aislamiento.
- Un usuario pertenece a un único negocio.
