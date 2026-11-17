# `.editorconfig` and analyzer settings

Settings that make the IDE and analyzers enforce the `csharp-standards` non-negotiables instead of fighting them. Add the missing ones to the repository's root `.editorconfig`; never remove a stricter existing setting.

```ini
[*.cs]
csharp_style_var_for_built_in_types = true
csharp_style_var_when_type_is_apparent = true
csharp_style_var_elsewhere = true
csharp_style_prefer_primary_constructors = true
dotnet_style_prefer_collection_expression = when_types_loosely_match
csharp_style_namespace_declarations = file_scoped

# catch (Exception) is allowed; never #pragma-suppress it
dotnet_diagnostic.CA1031.severity = none
```

## StyleCop

If the repository runs StyleCop, disable the rules that contradict the file layout rather than breaking the layout:

```ini
dotnet_diagnostic.SA1124.severity = none # regions
dotnet_diagnostic.SA1202.severity = none # public before private
dotnet_diagnostic.SA1204.severity = none # static before instance
```
