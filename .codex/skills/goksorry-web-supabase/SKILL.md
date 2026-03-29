---
name: goksorry-web-supabase
description: Project-specific workflow for /home/jujin/workspace/projects/goksorry/goksorry-web. Use when working on goksorry-web database changes, Supabase CLI setup or linking, migration creation or application, schema.sql sync, legal document seed changes, or deployment prep that depends on Supabase state.
---

# Goksorry Web Supabase

## Overview

Work in `/home/jujin/workspace/projects/goksorry/goksorry-web`.
Use Supabase CLI as the default path for database migration work in this repo.

This skill is only for `goksorry-web`. Do not apply these rules to unrelated repositories.

## Core Rules

- Prefer `npx supabase ... --workdir .` from the `goksorry-web` directory.
- Use the linked remote project at `oldbntwoxhtaehpirepn` unless the user explicitly changes it.
- Treat `supabase/migrations` as the CLI source of truth for new migrations.
- Keep a matching repo-facing SQL file in `db/migrations` when a migration should remain visible in the project’s numbered migration history.
- Update `db/schema.sql` when a migration changes the durable schema or seed content represented there.
- Prefer migration files over ad-hoc SQL. If an emergency SQL editor change is unavoidable, backfill a matching migration before finishing.

## Setup and Link

When Supabase CLI is missing:

```bash
npm install -D supabase
```

When the repo has not been initialized for Supabase CLI:

```bash
npx supabase init --workdir . --yes
```

When linking the project:

```bash
npx supabase link --project-ref oldbntwoxhtaehpirepn --workdir .
```

Prefer existing CLI login state. Use a raw `SUPABASE_ACCESS_TOKEN` only when login is unavailable.

## Migration Workflow

1. Create the migration with Supabase CLI.

```bash
npx supabase migration new <migration-name> --workdir .
```

2. Edit the generated SQL in `supabase/migrations/<timestamp>_<migration-name>.sql`.

3. If the migration belongs in the repo’s numbered SQL history, add the same change to `db/migrations/<NNN>_<migration-name>.sql`.
   Use the next numeric prefix in sequence.

4. If the migration changes long-lived schema or seeded bootstrap content, update `db/schema.sql`.

5. Review pending remote changes before applying:

```bash
npx supabase db push --workdir . --dry-run
```

6. Apply the migration to the linked project:

```bash
npx supabase db push --workdir .
```

7. If the CLI prompt lists unexpected migrations, stop and reconcile the migration directories before confirming.

## Schema and Seed Conventions

- `supabase/migrations` is the apply path for Supabase CLI.
- `db/migrations` is the repo’s historical SQL mirror.
- `db/schema.sql` should reflect the current intended schema after committed migrations.
- Legal document bootstrap content belongs in migration SQL when the table or initial seeded policy text changes.

## Verification and Push

Before finishing schema-related work, run:

```bash
set -a && source .env.example && set +a && npm run build
```

When the user asks to deploy or push:

- Check `git status --short`.
- Commit only intended files.
- Push `main` only when explicitly requested.

## Avoid

- Do not run manual SQL in Supabase SQL Editor as the default path.
- Do not leave a migration applied remotely without a committed SQL file.
- Do not create new migrations only in `db/migrations` and skip `supabase/migrations`.
- Do not use these repo-specific assumptions outside `goksorry-web`.
