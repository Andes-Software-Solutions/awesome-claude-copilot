# Persistence layout and EF Core entity skills: one type per file, repositories in Service, `ef-core-base-entities`, `ef-core-enum-reference-tables`

**Date:** 2026-09-28. **Status:** accepted. Extends [2026-09-architecture-skills.md](2026-09-architecture-skills.md) and revises its decision 5 and its exceptions fix.

## Why

Grouped model files (`<Folder>Records.cs`, `<Folder>Exceptions.cs`, …) hid types behind folder-named files, fought go-to-file navigation, and produced diffs that touched unrelated types. Repository interfaces and implementations in `<Root>.Repository` forced a store-agnostic contract layer that every provider re-implemented, although EF Core's `DbContext` already is the provider-agnostic seam. Two EF Core patterns — base entities with Guid keys, soft delete, audit stamps, and a row version; enum-backed reference tables — were being re-derived per solution, often with mapping attributes the `ef-core` skill bans.

## What shipped

| Plugin | Version | Change |
| --- | --- | --- |
| `andes-dotnet` | 1.3.0 | `dotnet-api-architecture`: one type per file everywhere; repositories in `Service/<Feature>/`; `Repository` plumbing-only with `Configurations/Base/` and `Scripts/`; `ConflictException`. New skills `ef-core-base-entities`, `ef-core-enum-reference-tables`. Pointers in `csharp-standards`, `ef-core`, the reviewer twins, the expert, and the janitor |
| `andes-core` | 1.3.0 | block `v1.3.0`: the `*.cs` row names the two new skills |

## Decisions

1. **One type per file everywhere.** Two exceptions remain — interface + single implementation, validator + validated type. A leaf folder's models live in `Models/`, its exceptions in `Exceptions/<Condition>Exception.cs`, shared const-only holders in `Constants/`; a single-consumer const is a `private const`; cross-project catalogs stay in `Common/Constants/`. The rule covers Dto too: `Actions/<Feature>/<Verb><Entity>ActionDto.cs`.
2. **Repositories live in Service.** `Service/<Feature>/<Entity>Repository.cs` (`I<Entity>Repository` first) injects `<Prefix>DbContext`, translates store faults, and is registered by `Add<Feature>` in `Api/Configuration/` — `Repository` cannot reference `Service`, so the provider's `Add…Persistence` never registers it. Service uses the EF Core API but no provider type; the one provider segment it names is the `using` for the context.
3. **Repository is plumbing.** `<Provider>/` holds DI, `Options/`, `HealthChecks/`, `Provisioning/`, `Serialization/`, `Models/`, `Constants/`, `Exceptions/`, `DbContexts/`, `Configurations/` (+ `Base/`), `Interceptors/`, `Migrations/`, and `Scripts/` — `<Verb><Subject>.sql` embedded resources named after the migration that runs them, read by `<Provider>Scripts`. A non-EF provider exposes a gateway `<Provider><Subject>Store` / `I<Subject>Store` so no client type reaches Service; it wraps a client and is not a repository.
4. **`ConflictException` is the third shared exception**, mapped to 409; per-feature conflict types would need one handler each.
5. **Base entities are fluent-only.** `Version` is `byte[]` with `.IsRowVersion()` in `Configurations/Base/`, never an attribute — `Entity` references neither EF Core nor DataAnnotations, and reviewers flag any DataAnnotations use. Guid keys use `ValueGeneratedOnAdd()` and the provider's client-side generator (SQL Server sequential, Npgsql UUIDv7); `Guid.CreateVersion7()` is opt-in because SQL Server sorts `uniqueidentifier` from its last six bytes. The soft-delete filter is a named filter (`"SoftDelete"`, EF Core 10). Interceptors take `TimeProvider`; `SoftDeleteInterceptor` registers before `AuditTimestampInterceptor`. `Configure` calls `ConfigureBase` (virtual chain) then `ConfigureEntity` (abstract).
6. **Enum reference tables use the enum as the key on both sides**, since EF Core requires the foreign-key and principal-key CLR types to match; both store as `int` by convention, so no model-wide conversion. `HasData` seeds every member from `Enum.GetValues<TEnum>()` with anonymous objects. The base configuration's `ConfigureEntity` is `virtual` and empty.
7. **No `references/` in the new skills.** Each is one pattern with two to four fences.

## Corrections made while designing

- A type with a `required` member cannot be a type argument under a `new()` constraint, so the enum seed uses anonymous objects instead of `new TEntity { … }`.
- "Registered by the provider's `Add…Persistence`" was impossible under `Api → Service → Repository`; registration moved to `Add<Feature>`.
- `Dto/Actions/<Feature>/<Entity>Actions.cs` was a hidden third file-name exception; it is now one DTO per file with its validator.
- `README.md` must name every plugin skill (`registry/readme-mention`), so both new skills were added to its plugin table.

## Cost

| Measure | Value | Budget |
| --- | --- | --- |
| `dotnet-api-architecture` description | 394 characters | 400 |
| `ef-core-base-entities` description | 391 characters | 400 |
| `ef-core-enum-reference-tables` description | 358 characters | 400 |
| Always-on block | 642 words (`v1.2.0`: 573) | 700 |
| `ef-core-base-entities` load | `SKILL.md` about 185 lines, four fences | — |
| `ef-core-enum-reference-tables` load | `SKILL.md` about 115 lines, two fences | — |

## Consumer follow-up

Solutions laid out on `dotnet-api-architecture` 1.2.0 (grouped files, `Repository/<Feature>/`, `<Provider><Entity>Repository`) are not migrated automatically: `csharp-standards` applies non-negotiables to new and changed code and migrates existing code only when asked. Record the interim state as a sanctioned deviation under `## Conventions` in the solution's `AGENTS.md`, and move a feature when it is next touched.
