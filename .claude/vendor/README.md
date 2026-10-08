# Vendored third-party guidance

Files in this folder are copied verbatim from third-party projects and read by the factory agents as reference text. They are not active skills: nothing here runs, installs hooks or downloads binaries. Do not edit them; update them by re-copying from the pinned source. Prettier ignores this folder (`.prettierignore`) so the copies stay byte-identical.

| Path | Source | Commit | License |
| --- | --- | --- | --- |
| `impeccable/reference/craft-floor.md`, `operate.md`, `layout.md`, `typeset.md`, `harden.md` | [pbakaus/impeccable](https://github.com/pbakaus/impeccable), `.claude/skills/impeccable/reference/` | `778c8a7b71ccd5bfe3ca6ac68c15d9d872d0f87d` | Apache-2.0 (`impeccable/LICENSE`) |

Related: `.claude/skills/emil-design-eng/` is a verbatim copy of [emilkowalski/skills](https://github.com/emilkowalski/skills) `skills/emil-design-eng/SKILL.md` at commit `e8a175de22ae1e49370fc144c1f3bb9aeedf988d` (MIT, `LICENSE` next to it), kept as a project skill so it can also be invoked directly.

## How the agents use them

Precedence when guidance conflicts, highest first:

1. The approved brief and story of the feature.
2. `docs/design/DESIGN.md`, once it exists (the project's own visual system).
3. Motion and interaction: `emil-design-eng`.
4. Visual system, layout, typography, states: Impeccable in **Operate** mode (`operate.md` wins over the generic advice in `harden.md` and `craft-floor.md`, e.g. fixed rem type scale instead of `clamp()`).

Skip every Impeccable step that calls its CLI (`impeccable detect`, `/impeccable ...` handoffs) and the "Live-mode signature params" sections; the CLI and hooks are intentionally not installed.
