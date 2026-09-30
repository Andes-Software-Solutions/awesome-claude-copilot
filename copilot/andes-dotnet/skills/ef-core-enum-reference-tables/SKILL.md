---
name: ef-core-enum-reference-tables
description: "Use when a column must reference a fixed set of values (status, type, category) as a lookup table tied to a C# enum: BaseEnumEntity<TEnum> with the enum as the key on both sides (stored as int), the sealed row type, BaseEnumEntityConfiguration seeding every member with HasData, enum-typed foreign keys, and the add / rename / never-delete rules for members."
---

# EF Core enum reference tables

A reference (lookup) table whose rows are the members of a C# enum: the database gets foreign-key integrity and human-readable names, the code keeps the enum. One base class, one base configuration, one sealed row type per enum. Placement per `dotnet-api-architecture` (enums in `Common/Enums/`, plural; the row type in `Entity/<Feature>/`, singular); practice per `ef-core`; the other base classes per `ef-core-base-entities`.

## Why the key is the enum

EF Core requires a foreign-key property's CLR type to equal the principal key's type (or its nullable), so an enum-typed foreign key cannot target an `int` primary key. Both sides are therefore the enum, and EF's default enum conversion stores both as `int` — the column is an `int`, the code never sees one, and no model-wide conversion is needed.

## The pieces — one type per file

```csharp
// Common/Enums/OrderStatuses.cs — plural, explicit values, never renumbered
public enum OrderStatuses
{
    Draft = 1,
    Submitted = 2,
    [Description("Cancelled by the customer before fulfilment")]
    Cancelled = 3,
}

// Entity/Base/BaseEnumEntity.cs
public abstract class BaseEnumEntity<TEnum>
    where TEnum : struct, Enum
{
    public TEnum Id { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
}

// Entity/Orders/OrderStatus.cs — the singular of the enum, sealed, no members
public sealed class OrderStatus : BaseEnumEntity<OrderStatuses>
{
}

// Entity/Orders/Order.cs — the dependent keeps the enum and the navigation
public sealed class Order : BaseModifiedEntity
{
    public OrderStatuses StatusId { get; set; }
    public OrderStatus? Status { get; set; }
}
```

## The configuration — `Repository/<Provider>/Configurations/Base/BaseEnumEntityConfiguration.cs`

```csharp
public abstract class BaseEnumEntityConfiguration<TEntity, TEnum> : IEntityTypeConfiguration<TEntity>
    where TEntity : BaseEnumEntity<TEnum>
    where TEnum : struct, Enum
{
    public void Configure(EntityTypeBuilder<TEntity> builder)
    {
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.Property(e => e.Name).HasMaxLength(64).IsRequired();
        builder.HasIndex(e => e.Name).IsUnique();
        builder.Property(e => e.Description).HasMaxLength(256);
        builder.HasData(Enum.GetValues<TEnum>().Select(value => new
        {
            Id = value,
            Name = value.ToString(),
            Description = DescriptionOf(value),
        }));
        ConfigureEntity(builder);
    }

    protected virtual void ConfigureEntity(EntityTypeBuilder<TEntity> builder)
    {
    }

    #region Private methods

    private static string? DescriptionOf(TEnum value) =>
        typeof(TEnum).GetField(value.ToString())?.GetCustomAttribute<DescriptionAttribute>()?.Description;

    #endregion
}

// Repository/Sql/Configurations/Orders/OrderStatusConfiguration.cs — usually empty; still one configuration per entity
public sealed class OrderStatusConfiguration : BaseEnumEntityConfiguration<OrderStatus, OrderStatuses>
{
}

// Repository/Sql/Configurations/Orders/OrderConfiguration.cs (excerpt) — the dependent side
builder.HasOne(o => o.Status).WithMany().HasForeignKey(o => o.StatusId).OnDelete(DeleteBehavior.Restrict);
```

- `HasData` takes anonymous objects because a type with a `required` member cannot satisfy a `new()` constraint; EF matches them to columns by property name.
- `HasData` is the right seed here: the rows are application-owned and change only with code — the `dotnet-api-architecture` rule. Operator-editable catalogs are `InsertData` in a migration instead.
- `ValueGeneratedNever()` because the value is the enum member; `Restrict` because a status with orders must never cascade.
- The table name follows the row type's plural (`OrderStatuses`); set `ToTable` in `ConfigureEntity` only when the convention collides with something.

## Lifecycle

- **Add a member:** add it to the enum with the next value, then `dotnet ef migrations add Add<Enum><Member>` — `HasData` diffs into an `InsertData`.
- **Rename a member:** the value never changes; the migration updates `Name`. Update `<Enum>Names` (wire names) in the owning Service feature in the same commit.
- **Retire a member:** never delete a member that has live rows and never reuse its value — say so in `Description`, stop offering it in DTO validators, and keep the row.
- **Reorder:** never. Sort by an explicit column added in `ConfigureEntity` if the UI needs an order.

## Wire and DTOs

- DTOs expose the enum, serialized through the feature's `<Enum>Names`; the row type never leaves the Service layer. The table exists for foreign-key integrity, reporting, and human-readable names.
- Validators (FluentValidation) check `IsInEnum()` on the enum property, not the existence of a row.

## Never

- No `int` primary key with an enum foreign key — EF Core rejects the mismatch.
- No lookup row inserted, edited, or deleted at runtime; the enum is the source of truth.
- No enum declared in `Entity` or `Dto` — they live in `Common/Enums/`, plural, one per file.
- No `HasConversion<string>()` on these keys: the column is an `int`, so renaming a member costs one data update, not a rewrite of every foreign key.
- No `BaseEntity` members on a reference table — no Guid, no soft delete, no audit stamps.
