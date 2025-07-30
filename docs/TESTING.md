# Testing Guide for copilot-chargeback GitHub Action

This guide provides comprehensive instructions for testing the
copilot-chargeback GitHub Action both locally and against real GitHub
infrastructure.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Local Testing with act](#local-testing-with-act)
- [Integration Testing](#integration-testing)
- [Mock API Server](#mock-api-server)
- [Test Scenarios](#test-scenarios)
- [Troubleshooting](#troubleshooting)
- [Advanced Usage](#advanced-usage)

## Overview

The copilot-chargeback action provides the following testing infrastructure:

- **Local Testing**: Use `act` CLI to run GitHub Actions locally
- **Mock API Server**: Simulates cost center APIs for testing
- **Integration Testing**: Test against real GitHub APIs with mock cost center
  backend
- **Multiple Scenarios**: Test organization-only sync, team-specific sync, and
  error conditions
- **Automated Scripts**: Convenience scripts for common testing workflows

## Prerequisites

### Required Tools

1. **Node.js** (v18 or later)

   ```bash
   node --version  # Should be 18+
   ```

2. **Docker** (for act and mock API containerization)

   ```bash
   docker --version
   docker info  # Should show running Docker daemon
   ```

3. **act CLI** (for local GitHub Actions testing)

   ```bash
   # macOS
   brew install act

   # Linux/WSL
   curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

   # Or download from: https://github.com/nektos/act/releases
   ```

4. **curl** (for API testing)
   ```bash
   curl --version
   ```

### GitHub Requirements

For integration testing, you'll need:

- GitHub Personal Access Token with `org:read` and `team:read` permissions
- Access to a test GitHub organization (recommended: `copilot-chargeback-test`)
- Optional: Test teams within the organization

## Local Testing with act

### Quick Start

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Run basic local test**:
   ```bash
   ./test-infrastructure/scripts/test-local.sh --scenario basic
   ```

### Available Test Scenarios

- `basic`: Standard team-to-cost-center sync
- `org-only`: Organization-wide sync (no specific team)
- `team-sync`: Team-specific sync with validation
- `error-conditions`: Test error handling and recovery

### Manual act Usage

You can also run act directly:

```bash
# Basic test
act --env-file .env.example --workflows .github/workflows/test-local.yml

# Specific scenario
act --env-file .env.test-org-only --job test-local-org-only

# With verbose output
act --verbose --env-file .env.test-team-sync
```

### Environment Configuration

Use the provided environment templates:

- `.env.example`: Basic configuration
- `.env.test-org-only`: Organization-only sync testing
- `.env.test-team-sync`: Team-specific sync testing
- `.env.test-errors`: Error condition testing

## Integration Testing

Integration tests run the action against real GitHub APIs while using the mock
cost center API.

### Setup

1. **Set your GitHub token**:

   ```bash
   export GITHUB_TOKEN=ghp_your_token_here
   ```

2. **Run integration test**:
   ```bash
   ./test-infrastructure/scripts/test-integration.sh
   ```

### Custom Organization/Team

```bash
./test-infrastructure/scripts/test-integration.sh \
  --org your-test-org \
  --team your-test-team \
  --cost-center your-cost-center
```

### Dry Run Mode

Test connectivity without making changes:

```bash
./test-infrastructure/scripts/test-integration.sh --dry-run
```

## Mock API Server

The mock API server simulates a cost center management system for testing.

### Starting the Mock API

#### Manual Start

```bash
cd test-infrastructure/mock-api
npm install
npm start
```

#### Docker Compose

```bash
cd test-infrastructure/mock-api
docker-compose up -d
```

### API Endpoints

- `GET /health` - Health check
- `GET /cost-centers` - List all cost centers
- `GET /cost-centers/{name}/users` - Get users in cost center
- `POST /cost-centers/{name}/users` - Add user to cost center
- `DELETE /cost-centers/{name}/users/{username}` - Remove user from cost center
- `POST /reset` - Reset to initial state

### Testing Modes

Configure the API behavior for different test scenarios:

```bash
# Set to always return errors
curl -X POST http://localhost:3001/config/response-mode \
  -H "Content-Type: application/json" \
  -d '{"mode": "error"}'

# Set artificial delay
curl -X POST http://localhost:3001/config/delay \
  -H "Content-Type: application/json" \
  -d '{"delay": 1000}'
```

Available modes:

- `success`: Normal operation (default)
- `error`: Always return 500 errors
- `timeout`: Never respond (simulate timeouts)
- `partial`: Randomly fail ~30% of requests

## Test Scenarios

### Scenario 1: Basic Team Sync

Tests syncing a specific team to a cost center.

**Setup**:

```bash
cp .env.test-team-sync .env
# Edit .env with your values
```

**Expected behavior**:

- Fetches team members from GitHub
- Compares with cost center users
- Adds missing users to cost center
- Removes users not in team from cost center

### Scenario 2: Organization-Only Sync

Tests syncing all organization members.

**Setup**:

```bash
cp .env.test-org-only .env
# Edit .env with your values
```

**Expected behavior**:

- Fetches all organization members
- Syncs them to the specified cost center

### Scenario 3: Error Conditions

Tests error handling and recovery.

**Setup**:

```bash
cp .env.test-errors .env
# Uses invalid tokens and endpoints
```

**Expected behavior**:

- Action should fail gracefully
- Error messages should be descriptive
- No partial updates should occur

## Troubleshooting

### Common Issues

#### Act Issues

**Problem**: `act` command not found

```bash
# Solution: Install act
brew install act  # macOS
# or
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash
```

**Problem**: Docker permission denied

```bash
# Solution: Add user to docker group (Linux)
sudo usermod -aG docker $USER
# Then logout and login again
```

**Problem**: Act uses wrong platform

```bash
# Solution: Specify platform explicitly
act --platform ubuntu-latest=ghcr.io/catthehacker/ubuntu:act-latest
```

#### GitHub API Issues

**Problem**: 403 Forbidden errors

```bash
# Check token permissions
curl -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/user
```

**Problem**: Organization not accessible

```bash
# Verify organization access
curl -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/orgs/your-org/members
```

#### Mock API Issues

**Problem**: Port 3001 already in use

```bash
# Kill existing processes
pkill -f "node.*server.js"
# Or use different port
PORT=3002 npm start
```

**Problem**: Mock API not responding

```bash
# Check if running
curl http://localhost:3001/health

# Check logs
docker logs $(docker ps -q --filter "name=mock-api")
```

### Debug Mode

Enable verbose logging:

```bash
# For local testing
./test-infrastructure/scripts/test-local.sh --verbose

# For integration testing
./test-infrastructure/scripts/test-integration.sh --verbose

# For act directly
act --verbose
```

### Cleanup

Clean up test resources:

```bash
# Basic cleanup
./test-infrastructure/scripts/cleanup.sh

# Full cleanup (removes containers, images, node_modules)
./test-infrastructure/scripts/cleanup.sh --full --verbose
```

## Advanced Usage

### Custom Test Data

Modify test fixtures in `test-infrastructure/fixtures/`:

- `sample-org-users.json`: Mock organization members
- `sample-cost-center-users.json`: Mock cost center users

### Running Tests in CI

The test infrastructure can be used in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Setup Test Infrastructure
  run: |
    cd test-infrastructure/mock-api
    npm install
    npm start &

- name: Run Integration Tests
  run: |
    ./test-infrastructure/scripts/test-integration.sh --dry-run
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Performance Testing

Test with larger datasets:

```bash
# Modify mock API to return more users
curl -X POST http://localhost:3001/cost-centers/large-test/users \
  -H "Content-Type: application/json" \
  -d '{"username": "user1"}'
# Repeat for many users...
```

### Custom Scenarios

Create custom environment files for specific test cases:

```bash
# Copy existing template
cp .env.test-team-sync .env.custom-test

# Modify as needed
vim .env.custom-test

# Run with custom config
act --env-file .env.custom-test
```

## Example Workflows

### Full Test Suite

Run all test scenarios:

```bash
#!/bin/bash
set -e

echo "Running full test suite..."

# Test scenarios
scenarios=("basic" "org-only" "team-sync" "error-conditions")

for scenario in "${scenarios[@]}"; do
  echo "Testing scenario: $scenario"
  ./test-infrastructure/scripts/test-local.sh --scenario "$scenario"
done

echo "Running integration tests..."
./test-infrastructure/scripts/test-integration.sh --dry-run

echo "All tests completed!"
```

### Continuous Testing

Set up a watch script for development:

```bash
#!/bin/bash
# watch-tests.sh

while true; do
  echo "Running tests..."
  npm test
  ./test-infrastructure/scripts/test-local.sh --scenario basic

  echo "Waiting for changes..."
  sleep 30
done
```

## Support

For issues and questions:

1. Check the [troubleshooting section](#troubleshooting)
2. Review the action logs with `--verbose` flag
3. Check mock API health: `curl http://localhost:3001/health`
4. Validate GitHub token:
   `curl -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/user`

## Contributing

When adding new test scenarios:

1. Create appropriate environment files
2. Update the test scripts
3. Add documentation
4. Test with both act and integration modes
