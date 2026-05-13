<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, but it invokes Vite through `vp dev` and `vp build`.

## Vite+ Workflow

`vp` is a global binary that handles the full development lifecycle. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

### Start

- create - Create a new project from a template
- migrate - Migrate an existing project to Vite+
- config - Configure hooks and agent integration
- staged - Run linters on staged files
- install (`i`) - Install dependencies
- env - Manage Node.js versions

### Develop

- dev - Run the development server
- check - Run format, lint, and TypeScript type checks
- lint - Lint code
- fmt - Format code
- test - Run tests

### Execute

- run - Run monorepo tasks
- exec - Execute a command from local `node_modules/.bin`
- dlx - Execute a package binary without installing it as a dependency
- cache - Manage the task cache

### Build

- build - Build for production
- pack - Build libraries
- preview - Preview production build

### Manage Dependencies

Vite+ automatically detects and wraps the underlying package manager such as pnpm, npm, or Yarn through the `packageManager` field in `package.json` or package manager-specific lockfiles.

- add - Add packages to dependencies
- remove (`rm`, `un`, `uninstall`) - Remove packages from dependencies
- update (`up`) - Update packages to latest versions
- dedupe - Deduplicate dependencies
- outdated - Check for outdated packages
- list (`ls`) - List installed packages
- why (`explain`) - Show why a package is installed
- info (`view`, `show`) - View package information from the registry
- link (`ln`) / unlink - Manage local package links
- pm - Forward a command to the package manager

### Maintain

- upgrade - Update `vp` itself to the latest version

These commands map to their corresponding tools. For example, `vp dev --port 3000` runs Vite's dev server and works the same as Vite. `vp test` runs JavaScript tests through the bundled Vitest. The version of all tools can be checked using `vp --version`. This is useful when researching documentation, features, and bugs.

## Common Pitfalls

- **Using the package manager directly:** Do not use pnpm, npm, or Yarn directly. Vite+ can handle all package manager operations.
- **Always use Vite commands to run tools:** Don't attempt to run `vp vitest` or `vp oxlint`. They do not exist. Use `vp test` and `vp lint` instead.
- **Running scripts:** Vite+ built-in commands (`vp dev`, `vp build`, `vp test`, etc.) always run the Vite+ built-in tool, not any `package.json` script of the same name. To run a custom script that shares a name with a built-in command, use `vp run <script>`. For example, if you have a custom `dev` script that runs multiple services concurrently, run it with `vp run dev`, not `vp dev` (which always starts Vite's dev server).
- **Do not install Vitest, Oxlint, Oxfmt, or tsdown directly:** Vite+ wraps these tools. They must not be installed directly. You cannot upgrade these tools by installing their latest versions. Always use Vite+ commands.
- **Use Vite+ wrappers for one-off binaries:** Use `vp dlx` instead of package-manager-specific `dlx`/`npx` commands.
- **Import JavaScript modules from `vite-plus`:** Instead of importing from `vite` or `vitest`, all modules should be imported from the project's `vite-plus` dependency. For example, `import { defineConfig } from 'vite-plus';` or `import { expect, test, vi } from 'vite-plus/test';`. You must not install `vitest` to import test utilities.
- **Type-Aware Linting:** There is no need to install `oxlint-tsgolint`, `vp lint --type-aware` works out of the box.

## CI Integration

For GitHub Actions, consider using [`voidzero-dev/setup-vp`](https://github.com/voidzero-dev/setup-vp) to replace separate `actions/setup-node`, package-manager setup, cache, and install steps with a single action.

```yaml
- uses: voidzero-dev/setup-vp@v1
  with:
    cache: true
- run: vp check
- run: vp test
```

## Review Checklist for Agents

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to validate changes.
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
  `*.model.ts`, `*.vo.ts`, `*.database.ts`, `*.routes.ts`, `*.service.ts`, and a
  feature `index.ts` only when needed.
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
