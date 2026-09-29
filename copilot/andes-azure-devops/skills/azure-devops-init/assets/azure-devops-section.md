## Azure DevOps

<!-- Written by the azure-devops-init skill (andes-azure-devops). Re-run it to refresh, or edit the people and conventions by hand. andes-ado-backlog-manager reads this section. -->

- **Organization**: `{organization}` — `https://dev.azure.com/{organization}`. The `azure-devops` MCP server reads it from the `ADO_ORG` environment variable and signs in with `az login`.
- **Project**: `{project}`
- **Team (board)**: `{team}`
- **Area path**: `{area-path}` — every work item the agent creates goes here.
- **Iteration root**: `{iteration-root}` — the agent lists the team's current and future iterations under it and asks which one; nothing is scheduled by default.
- **Process**: {Agile | Scrum | Basic | CMMI | inherited: name} — hierarchy `{Epic} → {Feature} → {User Story | Product Backlog Item | Issue | Requirement}`. Removal means `State = Removed`{; not available on Basic}.
- **Assignable people** — the only names the agent may assign, and it always asks which:
  - {Display Name} `{email}`
  - {Display Name} `{email}`
- **Conventions**: title prefix `{prefix | none}`; tags `{tags | none}`; story points `{S=1, M=3, L=5 | none}`; definition of done: {one line | none}; PRD mapping: PRD → Epic, `EP-n` → Feature, `US-xxx` → {story type}.
