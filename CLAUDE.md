# form-8

Choreography planner (React + TypeScript + Vite), deployed to GitHub Pages on every push to `main`.

## Versioning

The version in `package.json` is shown in the page footer (injected via `__APP_VERSION__` in `vite.config.ts`).

Before every commit that changes app behavior or UI, propose a version bump to the user based on the changes and wait for their answer:

- **patch** – bug fixes, small tweaks, wording, styling
- **minor** – new user-visible features (while version is 0.x, features are minor and breaking changes are also minor)
- **major** – breaking changes, e.g. incompatible saved-data format

Apply the confirmed bump with `npm version <patch|minor|major> --no-git-tag-version` and include `package.json` and `package-lock.json` in the same commit. Skip the bump for commits that do not affect the app (docs, CI config, tests only) and say so.

## Touch

Every interaction must also work with touch on mobile: use Pointer Events and give modifier-key or hover features a touch alternative.

## Choreographies

`choreos/` holds local choreography files (e.g. JSON exports from the app) to discuss with Claude. It is git-ignored; never commit or push its contents.

## Commands

- `npm run dev` – dev server
- `npm test` – unit tests (Vitest)
- `npm run build` – typecheck and production build
- `npm run lint` – oxlint
