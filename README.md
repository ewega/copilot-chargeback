# GitHub Copilot Chargeback Action

[![GitHub Super-Linter](https://github.com/ewega/copilot-chargeback/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
![CI](https://github.com/ewega/copilot-chargeback/actions/workflows/ci.yml/badge.svg)

A GitHub Action that automatically synchronizes GitHub organization or team
members with GitHub Cost Centers for Copilot billing management. This action
helps organizations implement automated chargeback systems by ensuring that the
right users are assigned to the appropriate cost centers for GitHub Copilot
usage tracking and billing.

## What This Action Does

The GitHub Copilot Chargeback Action:

- **Fetches users** from a specified GitHub organization or team
- **Synchronizes membership** with a GitHub Cost Center
- **Automatically adds** new users to the cost center when they join the
  organization/team
- **Automatically removes** users from the cost center when they leave the
  organization/team
- **Provides detailed output** of all changes made during synchronization

This automation ensures accurate billing allocation for GitHub Copilot usage
across your organization without manual intervention.

## Prerequisites

Before using this Action, ensure you have:

1. **GitHub Cost Centers set up** in your GitHub organization
2. **A GitHub Personal Access Token (PAT)** or **GitHub App** with appropriate
   permissions:
   - `org:read` - to read organization members
   - `org:admin` - to manage cost centers (if using PAT)
   - Cost center management permissions (if using GitHub App)
3. **Organization or team membership** that you want to sync with the cost
   center

## Setup Instructions

### 1. Set up GitHub Token

Create a GitHub Personal Access Token or GitHub App with the required
permissions and add it as a repository secret:

1. Go to your repository's **Settings** → **Secrets and variables** →
   **Actions**
2. Click **New repository secret**
3. Name: `GITHUB_TOKEN`
4. Value: Your PAT or GitHub App token

### 2. Identify Your Cost Center

Find the name of the GitHub Cost Center you want to sync with:

1. Go to your GitHub organization settings
2. Navigate to **Billing and plans** → **Cost centers**
3. Note the exact name of the cost center you want to manage

### 3. Create Workflow File

Create a workflow file in your repository (e.g.,
`.github/workflows/copilot-chargeback.yml`) using the examples below.

## Usage Examples

### Example 1: Sync Entire Organization

Synchronize all members of a GitHub organization with a cost center:

```yaml
name: Copilot Chargeback - Organization Sync

on:
  schedule:
    # Run daily at 9 AM UTC
    - cron: '0 9 * * *'
  workflow_dispatch: # Allow manual triggering

permissions:
  contents: read

jobs:
  sync-organization:
    runs-on: ubuntu-latest
    name: Sync Organization Members to Cost Center

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Sync GitHub Copilot Chargeback
        id: copilot-chargeback
        uses: ewega/copilot-chargeback@v1
        with:
          github_organization: 'your-org-name'
          github_cost_center_name: 'Engineering-Department'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Display Results
        run: echo "Sync completed: ${{ steps.copilot-chargeback.outputs.result }}"
```

### Example 2: Sync Specific Team

Synchronize only members of a specific team within an organization:

```yaml
name: Copilot Chargeback - Team Sync

on:
  schedule:
    # Run twice daily
    - cron: '0 9,17 * * *'
  workflow_dispatch:

permissions:
  contents: read

jobs:
  sync-team:
    runs-on: ubuntu-latest
    name: Sync Team Members to Cost Center

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Sync Frontend Team to Cost Center
        id: frontend-sync
        uses: ewega/copilot-chargeback@v1
        with:
          github_organization: 'your-org-name'
          github_team: 'frontend-team'
          github_cost_center_name: 'Frontend-Development'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Display Results
        run: echo "Frontend team sync: ${{ steps.frontend-sync.outputs.result }}"
```

### Example 3: Multiple Team Sync

Synchronize multiple teams to different cost centers:

```yaml
name: Copilot Chargeback - Multi-Team Sync

on:
  schedule:
    - cron: '0 8 * * *'
  workflow_dispatch:

permissions:
  contents: read

jobs:
  sync-teams:
    runs-on: ubuntu-latest
    name: Sync Multiple Teams
    strategy:
      matrix:
        team_config:
          - team: 'frontend-team'
            cost_center: 'Frontend-Development'
          - team: 'backend-team'
            cost_center: 'Backend-Development'
          - team: 'devops-team'
            cost_center: 'Infrastructure'

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Sync ${{ matrix.team_config.team }}
        id: team-sync
        uses: ewega/copilot-chargeback@v1
        with:
          github_organization: 'your-org-name'
          github_team: ${{ matrix.team_config.team }}
          github_cost_center_name: ${{ matrix.team_config.cost_center }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Display Results for ${{ matrix.team_config.team }}
        run: echo "${{ matrix.team_config.team }} sync: ${{ steps.team-sync.outputs.result }}"
```

## Input Parameters

| Parameter                 | Required | Description                                                                                         | Example                  |
| ------------------------- | -------- | --------------------------------------------------------------------------------------------------- | ------------------------ |
| `github_organization`     | **Yes**  | The name of the GitHub organization                                                                 | `my-company`             |
| `github_team`             | No       | The name of the team within the organization (if not provided, all organization members are synced) | `frontend-team`          |
| `github_cost_center_name` | **Yes**  | The exact name of the GitHub Cost Center                                                            | `Engineering-Department` |

## Output Parameters

| Parameter | Description                                    | Example                                       |
| --------- | ---------------------------------------------- | --------------------------------------------- |
| `result`  | Summary of users added and removed during sync | `Added users: john, jane, Removed users: bob` |

## Environment Variables

| Variable       | Required | Description                                                                   |
| -------------- | -------- | ----------------------------------------------------------------------------- |
| `GITHUB_TOKEN` | **Yes**  | GitHub Personal Access Token or GitHub App token with appropriate permissions |

## Scheduling Recommendations

Consider these scheduling patterns based on your organization's needs:

- **Daily sync**: `cron: '0 9 * * *'` - Good for most organizations
- **Twice daily**: `cron: '0 9,17 * * *'` - For rapidly changing teams
- **Weekly sync**: `cron: '0 9 * * 1'` - For stable organizations
- **Manual only**: `workflow_dispatch` - For testing or controlled updates

## Error Handling

The action will fail gracefully if:

- Required inputs are missing
- GitHub API calls fail (network issues, permission problems)
- Cost center doesn't exist
- Authentication fails

Check the workflow logs for detailed error messages to troubleshoot issues.

## Security Considerations

- **Token Security**: Never commit tokens directly to your repository. Always
  use GitHub secrets.
- **Minimum Permissions**: Grant only the minimum required permissions to your
  GitHub token.
- **Regular Rotation**: Regularly rotate your GitHub tokens according to your
  security policy.
- **Audit Logs**: Monitor GitHub audit logs for cost center changes made by this
  action.

## Troubleshooting

### Common Issues

1. **"Cost center not found"**

   - Verify the exact name of your cost center (case-sensitive)
   - Ensure your token has cost center management permissions

2. **"Organization not found"**

   - Check the organization name spelling
   - Verify your token has access to the organization

3. **"Team not found"**

   - Ensure the team exists in the specified organization
   - Verify team name spelling (use the team slug, not display name)

4. **"Insufficient permissions"**
   - Check that your GitHub token has the required scopes
   - Verify you have admin access to the organization/cost center

### Getting Help

If you encounter issues:

1. Check the [workflow run logs](../../actions) for detailed error messages
2. Verify your [action inputs](#input-parameters) are correct
3. Test with a simple organization sync first
4. Open an [issue](../../issues) with details about your setup and error
   messages

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file
for details.
