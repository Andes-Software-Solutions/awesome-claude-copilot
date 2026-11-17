---
name: csharp-docs
description: "Use when adding or reviewing XML documentation comments on C# public APIs: summary, param, returns, exception, inheritdoc, remarks, and example conventions."
---

# C# XML documentation

Every public type and member carries an XML doc comment. Internal and private members get comments only for what the code cannot say (`csharp-standards`).

## Tags

- `<summary>`: one sentence, starting with a present-tense, third-person verb.
- `<remarks>`: implementation details, usage notes, other context.
- `<see langword="…"/>` for keywords (`null`, `true`, `false`, `int`); `<c>` for inline code.
- `<example>` with `<code language="csharp">` inside it for usage examples.
- `<see cref>` for references in a sentence; `<seealso>` for standalone "See also" references.
- `<paramref>` / `<typeparam>` / `<typeparamref>` for parameters and type parameters.
- `<inheritdoc/>` to inherit from a base class or interface — unless the behavior changes materially; then document the difference.
- `<exception cref>` for every exception the member throws directly, and only the likely ones from nested calls. State the condition directly ("The order was not found."), never "Thrown if…".

## Wording

| Element | Wording |
| --- | --- |
| `<param>` | Noun phrase with an article, no data type |
| `<param>`, flag enum | "A bitwise combination of the enumeration values that specifies…" |
| `<param>`, other enum | "One of the enumeration values that specifies…" |
| `<param>` / `<returns>`, Boolean | "`<see langword="true"/>` to … (or if …); otherwise, `<see langword="false"/>`." |
| `<param>`, `out` | "When this method returns, contains …. This parameter is treated as uninitialized." |
| `<returns>` | Noun phrase with an article, no data type |
| Constructor `<summary>` | "Initializes a new instance of the `<Class>` class [or struct]." |
| Primary constructor | No separate block: one `<param>` per parameter on the type's comment, after its `<summary>` |
| Property `<summary>` | "Gets or sets…" (read-write), "Gets…" (read-only), "Gets [or sets] a value that indicates whether…" (Boolean) |
| Property `<value>` | Noun phrase, no data type; default in its own sentence: "The default is `<see langword="false"/>`." Boolean: "`<see langword="true"/>` if …; otherwise, `<see langword="false"/>`. The default is …" |
