# GitHub Copilot Cost Center Sync Action

A GitHub Action that synchronizes users between a GitHub organization (or team)
and a GitHub Copilot cost center for automated Copilot chargeback.

## Why?

If you own a GitHub Enterprise account with multiple business units that should
each pay for their resources, you can do this in GitHub. However, you need to
manually assign users to the correct cost center.

This action automates the process so that if a business unit has an org or team,
anytime a user is added to the org or team, they are automatically added to
their appropriate cost center.

## Inputs

| Name                      | Description                                                               | Required |
| ------------------------- | ------------------------------------------------------------------------- | -------- |
| `github_organization`     | The GitHub organization to sync users from                                | Yes      |
| `github_team`             | GitHub team name (optional - if provided, only sync users from this team) | No       |
| `github_cost_center_name` | The name of the GitHub Cost Center to sync users to                       | Yes      |
| `github_enterprise`       | The GitHub Enterprise slug                                                | Yes      |
| `github_token`            | GitHub Personal Access Token with appropriate permissions                 | Yes      |

## Usage

To include the action in a workflow in another repository, you can use the
`uses` syntax with the `@` symbol to reference a specific branch, tag, or commit
hash.

<!-- TODO: Add YAML on how to run it -->

```yaml

```
