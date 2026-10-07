---
name: commit
description: Crea un commit con Conventional Commits en una rama de feature, después de correr los checks rápidos (lint, typecheck, formato, unit) y revisar que no se filtren secretos. Úsalo cuando el usuario o un agente pida hacer commit, guardar o registrar cambios en git.
argument-hint: "[descripción opcional del cambio]"
---

# Commit

Procedimiento para registrar cambios en git en este repositorio. Síguelo en orden y **detente** si un paso falla.

El argumento opcional (`$ARGUMENTS`) describe la intención del cambio; úsalo para el mensaje, pero confírmalo contra el diff real.

## 1. Entender el cambio

```bash
git status --short
git branch --show-current
git diff            # sin preparar
git diff --cached   # ya preparado
```

- Si no hay cambios, dilo y termina.
- Si hay cambios **no relacionados entre sí** (p. ej. un módulo nuevo y un arreglo de docs sin relación), propón dividirlos en varios commits y pregunta antes de seguir.

## 2. Revisar secretos y archivos prohibidos

El repositorio es público. **Nunca** incluyas:

- `.env` o cualquier `.env.*` salvo `.env.example`
- llaves o certificados (`*.pem`, `*.key`), dumps de base de datos, `node_modules/`, `.next/`, `test-results/`, `playwright-report/`

Después de preparar los archivos (paso 6, `git add`), y antes de `git commit`, busca patrones de secretos en las líneas añadidas:

```bash
git diff --cached -U0 | grep -E '^\+' \
  | grep -E "gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|sk-ant-|xox[bp]-|BEGIN [A-Z ]*PRIVATE KEY|postgres(ql)?://[^:/]+:[^@]+@" \
  | grep -v "@localhost" \
  | grep -vF '[A-Za-z0-9]{20,}' || echo "sin coincidencias"
```

Las URLs de Postgres hacia `localhost` son las de desarrollo (`docker-compose.yml`, `.env.example`) y se permiten. El último filtro descarta la línea de patrones de este mismo skill: un token real nunca contiene sintaxis de regex.

Si aparece algo sospechoso: **no hagas commit**, muéstraselo al usuario y explica el riesgo. Las variables reales van en el proveedor de hosting (ver `README.md`, sección de secretos).

No modifiques `git config` (identidad, hooks, etc.).

## 3. Rama

- Si estás en `main`, crea una rama antes de commitear: `git switch -c <tipo>/<tema-en-kebab-case>`, usando el mismo `<tipo>` del mensaje (paso 5). Ejemplos: `feat/compras`, `fix/scanner-enter`, `docs/claude-md-testing`, `chore/commit-skill`.
- Si ya estás en una rama de feature, sigue en ella.

## 4. Checks rápidos

```bash
npm run lint
npm run typecheck
npm run format:check
npm test
```

- Si solo falla `format:check`: corre `npx prettier --write` sobre los archivos cambiados, vuelve a verificar e incluye el formateo en el commit.
- Si falla cualquier otro check: **no hagas commit**. Resume el error (archivo, línea, mensaje) y propón el arreglo.
- Las pruebas de integración y e2e las corre CI; si el cambio toca servicios o UI, recuérdale al usuario que puede correrlas localmente (ver `CLAUDE.md`, sección Testing).

## 5. Mensaje (Conventional Commits)

Formato, **en inglés**:

```
<tipo>(<scope>): <resumen>

- <qué cambió y por qué>
- <...>

<trailers>
```

**Tipos**

| Tipo       | Cuándo                                                 |
| ---------- | ------------------------------------------------------ |
| `feat`     | Funcionalidad nueva para el usuario                    |
| `fix`      | Corrección de un bug                                   |
| `refactor` | Cambio interno sin cambiar comportamiento              |
| `test`     | Solo pruebas                                           |
| `docs`     | Solo documentación (`docs/`, `README.md`, `CLAUDE.md`) |
| `chore`    | Herramientas, config, agentes, skills                  |
| `ci`       | Workflows de GitHub Actions                            |
| `build`    | Dependencias, lockfile, configuración de build         |
| `perf`     | Mejora de rendimiento                                  |

**Scopes** (opcional; usa el módulo o área afectada): `productos`, `compras`, `inventario`, `pos`, `impresion`, `reportes`, `offline`, `config`, `auth`, `db`, `ui`, `agents`, `skills`, `deps`.

**Reglas**

- Resumen en imperativo, minúsculas, sin punto final, máximo 72 caracteres: `feat(compras): register supplier purchases`.
- Cuerpo con viñetas que expliquen el _qué_ y el _por qué_; omítelo si el resumen basta.
- Cambio incompatible (p. ej. migración que rompe datos o API): agrega `!` después del scope y un trailer `BREAKING CHANGE: <explicación>`.
- Si el cambio cierra un issue: trailer `Closes #<n>`.
- Agrega al final el trailer de atribución que indique la configuración de Claude Code en la sesión (p. ej. `Co-Authored-By: ...`), si hay uno.

## 6. Commit

Prepara solo los archivos del cambio (no uses `git add -A` a ciegas) y usa un heredoc para conservar el formato:

```bash
git add <archivos>
# ahora corre la búsqueda de secretos del paso 2
git commit -F - <<'EOF'
feat(compras): register supplier purchases

- ...

Co-Authored-By: ...
EOF
```

- Nunca uses `--no-verify` ni `--amend` sobre commits ya publicados.
- Si un hook de git falla, arregla la causa y crea un commit nuevo.

## 7. Cerrar

```bash
git log -1 --stat
```

Muestra el hash, el mensaje y los archivos incluidos. Luego **pregunta** si debe hacer push:

```bash
git push -u origin <rama>
```

Si el usuario acepta y la rama no es `main`, sugiere abrir un Pull Request (`gh pr create`) para que CI y la revisión corran antes de integrar.
