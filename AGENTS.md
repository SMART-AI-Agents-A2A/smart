<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

# Project Architecture

This repository is organized around `core`, `features`, and `shared`. Follow the
existing structure before introducing new folders or abstractions.

## Frontend (`apps/front/src`)

- `core/` is for application infrastructure and wiring: router root, virtual
  route registration, providers, query/client setup, and other cross-feature
  runtime concerns.
- `features/` is for product areas and route-level screens. New pages such as
  dashboards, auth flows, smart views, chats, and agent experiences belong under
  `apps/front/src/features/<feature>/`.
- `shared/` is for reusable UI, types, and utilities that are not owned by one
  feature. Move code here only after it is genuinely shared by more than one
  feature or clearly belongs to a common design/system layer.
- Keep `apps/front/src/core/routes/routes.ts` as a thin TanStack Router virtual
  route registry. Route entries should point to files inside `features/*`, while
  page logic stays in the feature folder.
- Do not edit `apps/front/src/routeTree.gen.ts` by hand. Let the router tooling
  regenerate it.
- Prefer feature-local files over one large route file. For a substantial
  dashboard, split feature-owned parts into files such as components, data,
  hooks, or API helpers inside `features/dashboard/` instead of putting all UI,
  state, fixtures, and integration code in `index.tsx`.
- Dentro de cada feature front, manter a convenção:
  `<feature>.type.ts` para contratos/tipos e `<feature>.service.ts` para regras
  de negócio, integração HTTP/SSE e transformações de dados. Arquivos de rota
  (`index.tsx`, `signin.tsx`, etc.) devem ficar focados em composição/render.
- Avoid importing private files across feature boundaries when a public feature
  API is more appropriate. If a feature needs to expose something reusable, add
  an explicit local export for that feature rather than reaching deep into its
  internals from another feature.
- Use the existing UI stack and style language: React, TanStack Router, Base UI
  primitives, `lucide-react` icons, and the current restrained/premium Smart
  visual direction.

## Backend (`apps/api/src`)

- `core/` is for platform-level infrastructure: database setup, CORS, logging,
  OpenAPI mounting, validators, stats, and other app-wide middleware.
- `features/` is for domain modules. Follow the existing feature-local pattern:
  `*.model.ts`, `*.vo.ts`, `*.type.ts`, `*.database.ts`, `*.routes.ts`,
  `*.service.ts`, and a feature `index.ts` only when needed.
- Use `*.vo.ts` para schemas/validação e `*.type.ts` para contratos de tipos
  exportados e consumo entre módulos, evitando misturar validação e fluxo de
  serviço no mesmo arquivo.
- `shared/` is for common types and utilities that are not owned by a single
  backend feature.
- Keep Drizzle schema aggregation isolated in `core/db/schema.ts`. Model imports
  used by schema aggregation should point to direct model files, not feature
  barrels that may pull runtime-only code.

## Workflow Expectations

- Use `vp` for package, lint, test, build, and one-off binary workflows. Do not
  call `pnpm`, `npm`, `yarn`, `npx`, `vitest`, `oxlint`, or `oxfmt` directly.
- For frontend route changes, validate with `vp run front#build` when possible.
- For broad changes, use `vp check` and `vp test`; for narrow changes, prefer
  targeted validation first and mention any broader checks that were skipped.
- Keep edits narrow and preserve unrelated local changes in the working tree.
