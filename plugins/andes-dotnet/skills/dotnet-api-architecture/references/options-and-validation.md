# Options and validation

## Options classes

- `<Area>Options` classes, each with `public const string SectionName`. Every project that reads options owns an `Options/` folder, and the class lives in the lowest project that reads it — `Api/Options/` for host concerns, `Service/Options/` for business knobs, `Repository/<Provider>/Options/` for store settings. A project with provider folders puts each provider's options inside that provider's own `Options/`, never in a shared one, so a second store carries its configuration with it.
- Bind with `AddOptions<T>().Bind(configuration.GetSection(T.SectionName)).ValidateWithFluentValidation().ValidateOnStart()`, registering the matching `IValidator<T>` alongside. Never `Configure<T>`, never `*Settings` classes.
- The `ValidateWithFluentValidation()` extension and the FluentValidation-to-`IValidateOptions<T>` adapter live in `Common/Validation/`, because every layer that registers options needs them and `Common` is the only project all of them share.
- Inside any namespace that contains an `Options` segment the folder shadows Microsoft's `Options` class: write `Microsoft.Extensions.Options.Options.Create(...)`.
- An abstract options base shared by several sections carries no `SectionName`; each concrete subclass does, and a generic `<Base>OptionsValidator<T>` is the shared rule set each subclasses so failures name their own section.

## Validators

- One `AbstractValidator<T>` per validated type, declared in the same file as the type it validates — one of the three sanctioned exceptions to file-name-equals-type-name (`naming.md`).
- Cross-field rules go in the validator, not in a `.Validate(lambda, message)` call on the options builder. Chain `.Cascade(CascadeMode.Stop)` before a rule whose predicate would throw on the value the previous rule rejects.
- A validator is `internal` unless another project registers it. Options validators stay `internal`: the owning project's `Add…` extension registers them. Request-DTO validators live in `<Root>.Dto` (`Dto/Actions/<Feature>/<Entity>Actions.cs`) and are registered by Api from that assembly — `AddValidatorsFromAssemblyContaining<PaginatedResponseDto>(includeInternalTypes: true)` — so they can stay `internal` too; a scan rooted at `Program` finds nothing in `Dto`.
- A validation limit both a DTO validator and a store configuration must agree on is a catalog in `Common/Constants/`, not a constant on either.

## Where validation runs

- Endpoints attach the validation filter of `aspnet-rest-apis` (`Api/Filters/`). ASP.NET Core's built-in minimal-API validation (`AddValidation()`) reads DataAnnotations only, so in a FluentValidation solution it has nothing to act on and must not be registered — it would add a filter to every endpoint, streaming routes included.
- An endpoint that declares a validation response (`ProducesValidationProblem()`) without attaching the filter is advertising a 400 it can never return.
- `[AsParameters]` query models (`List<Entities>ActionDto`) are validated only where the filter is attached.
- Options fail at startup through `ValidateOnStart()`, before anything external is touched; an `Api/Startup/<Name>Bootstrapper.cs` runs the checks that need a live dependency after `Build()`.
