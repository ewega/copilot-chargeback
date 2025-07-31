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

| Name                      | Description                                                                                                  | Required |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| `github_organization`     | The GitHub organization to sync users from                                                                   | Yes      |
| `github_team`             | JSON array of org-team pairs. Format: `[{"org": "org1", "team": "team1"}, {"org": "org2", "team": "team2"}]` | No       |
| `github_cost_center_name` | The name of the GitHub Cost Center to sync users to                                                          | Yes      |
| `github_enterprise`       | The GitHub Enterprise slug                                                                                   | Yes      |
| `github_token`            | GitHub Personal Access Token with appropriate permissions                                                    | Yes      |

## Usage

To include the action in a workflow in another repository, you can use the
`uses` syntax with the `@` symbol to reference a specific branch, tag, or commit
hash.

<!-- TODO: Add YAML on how to run it -->

```yaml

```

## Testing

### Unit Tests

The action includes Jest unit tests. To run the tests:

Unit tests cover:

- Syncing users from organizations to cost centers
- Team-based filtering
- Error handling
- API response parsing

### Local Testing with Debug Logs

To test the action locally with debug logging:

1. Set up a `.env` file with required inputs.
2. Run the action locally using `@vercel/ncc`.
3. npx local-action . src/main.js .env

Debug logs will show:

- Cost center retrieval and parsing
- Organization member fetching
- Team member fetching (if team specified)
- User synchronization operations

### Common Issues

**Authentication Errors:**

- Ensure your GitHub token has the following permissions:
  - `admin:org` to read organization members
  - `admin:enterprise` to manage cost centers

**Cost Center Not Found:**

- Verify the cost center name matches exactly (case-sensitive).

**Organization Access:**

- Token must have access to all organizations in the cost center.

For more detailed troubleshooting, set `ACTIONS_STEP_DEBUG=true` in your
environment or workflow.
