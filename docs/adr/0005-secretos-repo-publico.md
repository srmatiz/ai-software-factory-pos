# ADR 0005: Secretos con repositorio público

**Estado:** aceptada · 2026-10-06

## Contexto

El repositorio es público (portafolio) pero la app se usa en producción con datos reales.

## Decisión

- Solo `.env.example` con valores ficticios en git; `.env*` ignorado.
- `src/env.ts` valida variables con Zod al arrancar.
- Producción: variables en el proveedor de hosting; CI usa valores desechables propios del job.
- Datos del negocio en la base de datos, no en el código.
- Seed solo para desarrollo; el administrador real se crea con `npm run create-admin` (contraseña pedida por consola, bcrypt cost 12).
- gitleaks en CI.

## Consecuencias

- Clonar el repo nunca expone datos ni credenciales reales.
- Añadir una variable exige actualizar `src/env.ts`, `.env.example` y el README.
