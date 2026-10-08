---
name: feature-factory
description: Orquesta la construcción de una funcionalidad completa con los siete subagentes de la fábrica (codebase-researcher → story-writer → spec-writer → backend-builder → frontend-builder → test-verifier → implementation-validator), con aprobación humana de la historia, del brief y antes del PR. Úsalo cuando el usuario pida construir, entregar o implementar una funcionalidad con la cadena completa: "build a feature", "ship a feature", "feature factory", "run the full chain", "construye una funcionalidad", "corre la fábrica".
argument-hint: "<idea de la funcionalidad>"
---

# Feature factory

Orquesta una funcionalidad de punta a punta con los subagentes de `.claude/agents/`. Tú (la conversación principal) eres el orquestador: invocas cada agente con la herramienta `Agent`, le pasas lo que necesita y hablas con el humano. **No escribes código de la funcionalidad tú mismo**; si algo falla, lo corrige el agente dueño.

El argumento (`$ARGUMENTS`) es la idea. Si falta, pídela antes de empezar.

## Reglas del orquestador

- **Los subagentes empiezan en frío.** Cada invocación lleva, completos y en texto, todos los insumos que lista la tabla de abajo. Nunca resumas una historia o un brief aprobados: pásalos tal cual.
- **Las pausas son reales.** En cada punto "PREGUNTA AL HUMANO", muestra el artefacto completo, pregunta y **termina tu turno**. No sigas hasta que responda. Silencio no es aprobación.
- **Muestra cada resultado.** Después de cada agente, resume en 2–4 líneas qué hizo y dónde quedó, para que el humano pueda seguir la cadena.
- **No decidas por el humano.** Las preguntas abiertas de la historia o del brief se le presentan en la aprobación; sus respuestas pasan a ser parte del artefacto aprobado.
- **Guarda lo aprobado** en `docs/features/<slug>/` (`story.md`, `brief.md`) apenas se apruebe, para poder retomar en otra sesión.

| Paso | Agente                     | Insumos que le pasas                                                       |
| ---- | -------------------------- | -------------------------------------------------------------------------- |
| 1    | `codebase-researcher`      | la idea, formulada como pregunta sobre el área del código                  |
| 2    | `story-writer`             | la idea, los hallazgos del researcher, reglas de negocio que dio el humano |
| 4    | `spec-writer`              | historia aprobada, hallazgos del researcher                                |
| 6    | `backend-builder`          | brief aprobado, hallazgos del researcher                                   |
| 7    | `frontend-builder`         | brief aprobado, hallazgos, resumen completo del backend-builder            |
| 8    | `test-verifier`            | historia y brief aprobados, resúmenes de ambos builders                    |
| 9    | `implementation-validator` | historia y brief aprobados, reporte del test-verifier                      |

## 0. Preparación

1. `git status --short`: si hay cambios sin commit, pregunta qué hacer con ellos antes de seguir.
2. Elige un nombre corto para la funcionalidad, en minúsculas y con guiones, a partir de la idea (p. ej. `compras-escaner`). En adelante es `<slug>`: se usa en la carpeta `docs/features/<slug>/` y en la rama `feat/<slug>`.
3. `docker compose up -d` (los builders y el test-verifier corren pruebas contra Postgres).

## 1. codebase-researcher

Invócalo con una pregunta concreta sobre el área (p. ej. "¿qué existe hoy para compras y cómo se mueve el stock?").

- Si responde con `## Clarifying question`, pásale la pregunta al humano, termina tu turno y vuelve a invocarlo con la respuesta.

## 2. story-writer

Invócalo con la idea y los hallazgos.

## 3. PREGUNTA AL HUMANO: aprobar la historia

Muestra la historia completa y pregunta: **¿apruebas, pides cambios o la rechazas?** Si tiene preguntas abiertas, pide que las responda.

- **Aprobada:** incorpora las respuestas a las preguntas abiertas, guárdala en `docs/features/<slug>/story.md` y sigue al paso 4.
- **Cambios:** vuelve a invocar `story-writer` con la historia anterior y el feedback literal del humano. Repite este paso.
- **Rechazada:** detén la cadena. Resume lo explorado (hallazgos del researcher y por qué se rechazó) para que el humano decida qué hacer. No crees rama ni archivos.

Si la historia dice que está bloqueada por un módulo que no existe, muéstralo como primer punto y recomienda no aprobarla.

## 4. spec-writer

Invócalo con la historia aprobada y los hallazgos.

## 5. PREGUNTA AL HUMANO: aprobar el brief

Muestra el brief completo y pregunta: **¿apruebas, pides cambios o lo rechazas?** Destaca sus preguntas abiertas y lo que bloquea cada una, y cualquier dependencia, scheduler o base de datos nueva.

- **Aprobado:** incorpora las respuestas, guárdalo en `docs/features/<slug>/brief.md` y sigue al paso 6.
- **Cambios:** vuelve a invocar `spec-writer` con el brief anterior y el feedback literal. Repite este paso.
- **Rechazado:** detén la cadena. La historia aprobada queda en `docs/features/<slug>/story.md`; dile al humano que puede retomar desde el paso 4 con otro enfoque técnico.

## 6. backend-builder

1. Crea la rama: desde `main` actualizado, `git switch -c feat/<slug>`.
2. Invoca `backend-builder`.
3. Si su sección "Checks" tiene algún `fail`, vuelve a invocarlo una vez con ese resultado. Si sigue fallando, detente y pregunta al humano.

## 7. frontend-builder

Invócalo con el resumen **completo** del backend (incluida la sección "Action contract").

- Si reporta algo en "Needs from backend": invoca `backend-builder` con esa lista, luego vuelve a invocar `frontend-builder`. Máximo una vuelta; si sigue faltando, pregunta al humano.
- Si "Checks" tiene un `fail`, igual que en el paso 6.

## 8. test-verifier

Invócalo. Los criterios en `fail` no se corrigen aquí: pasan al validador.

## 9. implementation-validator

Invócalo y muestra al humano sus hallazgos agrupados: críticos, importantes y menores.

## 10. Bucle de corrección (solo si hay críticos)

1. Agrupa los hallazgos críticos según el agente que indica el validador.
2. `backend-builder` primero y `frontend-builder` después, cada uno con sus hallazgos literales (archivo:línea, qué se esperaba) y el brief aprobado.
3. Si un crítico apunta a `spec-writer` o `story-writer`, **no lo corrijas en el bucle**: el brief o la historia aprobados están mal. Detente y pregunta al humano.
4. Vuelve a correr `test-verifier` y luego `implementation-validator`.
5. **Máximo 2 vueltas.** Si después de la segunda sigue habiendo críticos, detente y presenta el estado al humano.

Los importantes y menores no disparan el bucle: se presentan en el paso 11.

## 11. PREGUNTA AL HUMANO: revisión final

Presenta:

- Archivos cambiados (`git diff --stat main...HEAD`) y la rama.
- Resultado de los checks de cada builder y la tabla de criterios del test-verifier.
- Hallazgos que quedan (importantes y menores) del último validador.

Pregunta: **¿abro el PR, quieres cambios o lo dejamos aquí?**

- **Abrir PR:** si es un módulo del roadmap, marca el módulo como hecho en `docs/roadmap.md` y actualiza la tabla de estado del `README.md`. Invoca `/commit` (tipo `feat`, scope del módulo), haz `git push -u origin feat/<slug>` y abre el PR con `gh pr create`, con la historia, los criterios verificados y los hallazgos pendientes en la descripción.
- **Cambios:** decide con el humano qué agente los hace y vuelve al paso correspondiente (6, 7 o 10).
- **Dejarlo aquí:** no hagas commit; di en qué rama quedó el trabajo.
