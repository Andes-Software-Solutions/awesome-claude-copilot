---
name: ef-core
description: "Use when writing or reviewing Entity Framework Core code: DbContext and entity design, queries, change tracking, migrations, performance, security, and database testing (Testcontainers first, EF InMemory last)."
---

# Entity Framework Core Best Practices

## Data Context Design

- Keep DbContext classes focused and cohesive
- Use constructor injection for configuration options
- Override OnModelCreating for fluent API configuration
- Separate entity configurations using IEntityTypeConfiguration
- Consider using DbContextFactory pattern for console apps or tests

## Entity Design

- Use meaningful primary keys (consider natural vs surrogate keys)
- Implement proper relationships (one-to-one, one-to-many, many-to-many)
- Use data annotations or fluent API for constraints and validations
- Implement appropriate navigational properties
- Consider using owned entity types for value objects

## Performance

- Use AsNoTracking() for read-only queries
- Implement pagination for large result sets with Skip() and Take()
- Use Include() to eager load related entities when needed
- Consider projection (Select) to retrieve only required fields
- Use compiled queries for frequently executed queries
- Avoid N+1 query problems by properly including related data

## Migrations

- Create small, focused migrations
- Name migrations descriptively
- Verify migration SQL scripts before applying to production
- Consider using migration bundles for deployment
- Add data seeding through migrations when appropriate

## Querying

- Use IQueryable judiciously and understand when queries execute
- Prefer strongly-typed LINQ queries over raw SQL
- Use appropriate query operators (Where, OrderBy, GroupBy)
- Consider database functions for complex operations
- Implement specifications pattern for reusable queries

## Change Tracking & Saving

- Use appropriate change tracking strategies
- Batch your SaveChanges() calls
- Implement concurrency control for multi-user scenarios
- Consider using transactions for multiple operations
- Use appropriate DbContext lifetimes (scoped for web apps)

## Security

- Avoid SQL injection by using parameterized queries
- Implement appropriate data access permissions
- Be careful with raw SQL queries
- Consider data encryption for sensitive information
- Use migrations to manage database user permissions

## Testing

- Follow the database ladder in the `csharp-xunit` skill: Testcontainers → SQLite in-memory → dedicated test database → EF Core InMemory provider (last resort; not relational).
- Never mock `DbContext` or `DbSet` — test queries against a real provider.
- Apply migrations in the test fixture (`Database.MigrateAsync()`) so tests exercise the schema production uses.
- Test migrations against the production engine before release.

When reviewing EF Core code, identify issues and suggest improvements that follow these practices.
