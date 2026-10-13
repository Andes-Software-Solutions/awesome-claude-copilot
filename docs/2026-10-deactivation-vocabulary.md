# Deactivation replaces soft delete in the base-entity skills

**Date:** 2026-10-13. **Status:** accepted. Renames vocabulary introduced in [2026-09-persistence-layout-and-ef-core-entity-skills.md](2026-09-persistence-layout-and-ef-core-entity-skills.md); the design itself (interceptor, named query filter, `PurgeAsync`) is unchanged.

## Why

- **The domain says deactivated.** Andes calls these rows deactivated, not deleted. Code that said `DateDeleted` and `RestoreAsync` made developers translate between the code and the business language.
- **One word across the stack.** The column, interceptor, query filter, and service methods now use the same term, so a search for "deactivat" finds every part of the mechanism.
- **"Deleted" was ambiguous.** It named both the soft-delete stamp and the EF `EntityState.Deleted` the interceptor intercepts. Reserving "delete" for the real thing (`PurgeAsync`, `_ctx.Remove`, HTTP DELETE) makes the two easier to tell apart.

## Decisions

### D1. Renames

| Old | New |
| --- | --- |
| `DateDeleted` (`IBaseEntity` / `BaseEntity<TKey>`) | `DateDeactivated` (null = active) |
| `SoftDeleteInterceptor` | `DeactivationInterceptor` |
| Named query filter `"SoftDelete"` (`IgnoreQueryFilters(["SoftDelete"])`) | `"Deactivation"` |
| `RestoreAsync` | `ReactivateAsync` |
| `GetDeletedAsync` | `GetDeactivatedAsync` |
| Banned `IsDeleted` bool | Banned `IsDeactivated` or `IsActive` bool |

The timestamp stays the only flag: no boolean beside `DateDeactivated`.

### D2. What stays, and why

- **`PurgeAsync`.** It is still a hard delete (`IgnoreQueryFilters(["Deactivation"]).Where(o => o.DateDeactivated < cutoff).ExecuteDeleteAsync`), so "purge" is the accurate word.
- **`_ctx.Remove` in services.** A service still removes the entity. `DeactivationInterceptor` turns the `Deleted` entry into `Modified` and stamps `DateDeactivated`, so service code does not change.
- **`Delete<Entity>ActionDto` and the HTTP DELETE endpoint.** The verb describes the client's request, not the storage. The endpoint deactivates the row.

### D3. Where the rename lands

The `ef-core-base-entities` skill defines the names. `ef-core`, `ef-core-enum-reference-tables`, the `dotnet-api-architecture` references (`naming.md`, `project-layout.md`, `persistence.md`), and the `andes-scaffold` API reference follow it. Both `andes-csharp-code-reviewer` twins and the Copilot `andes-csharp-expert` agent use the new names so they review and generate matching code.

## Consequences

This is a breaking change for projects built from the old skills, so every plugin moves to 1.13.0 (1.12.1 was never tagged). Released changelog sections and older records keep the old names as history.

### Migrating an existing project

1. Rename `DateDeleted` to `DateDeactivated` on the entities and base types, and update every reference.
2. Rename `SoftDeleteInterceptor` to `DeactivationInterceptor` and its registration in `<Provider>PersistenceConfiguration.cs`.
3. Rename the filter in `HasQueryFilter("SoftDelete", ...)` and every `IgnoreQueryFilters(["SoftDelete"])` call to `"Deactivation"`.
4. Rename the service methods (`RestoreAsync`, `GetDeletedAsync`) and their callers.
5. Add an EF migration with `dotnet ef migrations add RenameDateDeletedToDateDeactivated`. Open it and confirm it contains `RenameColumn` (and `RenameIndex` for the index on the column), not `DropColumn` plus `AddColumn`, which would discard the stored timestamps. If EF generated a drop and add, replace them with `RenameColumn` before applying.
