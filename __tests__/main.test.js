/**
 * Unit tests for the action's main functionality, src/main.js
 */
const core = require('@actions/core')
const github = require('@actions/github')
const axios = require('axios')
const main = require('../src/main')

// Mock the GitHub Actions core library
const debugMock = jest.spyOn(core, 'debug').mockImplementation()
const getInputMock = jest.spyOn(core, 'getInput').mockImplementation()
const setFailedMock = jest.spyOn(core, 'setFailed').mockImplementation()
const setOutputMock = jest.spyOn(core, 'setOutput').mockImplementation()

// Mock the GitHub API
jest.mock('@actions/github', () => ({
  getOctokit: jest.fn().mockReturnValue({
    rest: {
      teams: {
        listMembersInOrg: jest.fn().mockResolvedValue({ data: [] })
      },
      orgs: {
        listMembers: jest.fn().mockResolvedValue({ data: [] })
      }
    }
  })
}))

// Mock the GitHub Cost Center API
jest.mock('axios')

// Other utilities
const timeRegex = /^\d{2}:\d{2}:\d{2}/

// Mock cost center API response
const mockCostCenterResponse = {
  data: {
    costCenters: [
      {
        id: 'test-id-123',
        name: 'test-cost-center',
        resources: [
          { type: 'Org', name: 'org1' },
          { type: 'Org', name: 'org2' },
          { type: 'User', name: 'direct-user1' },
          { type: 'User', name: 'direct-user2' },
          { type: 'Repo', name: 'some-repo' }
        ]
      }
    ]
  }
}

// Mock the Octokit instance
const mockOctokit = {
  rest: {
    teams: {
      listMembersInOrg: jest.fn()
    },
    orgs: {
      listMembers: jest.fn()
    }
  },
  request: jest.fn()
}

// Mock getOctokit to return our mock instance
jest.spyOn(github, 'getOctokit').mockImplementation(() => mockOctokit)

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('syncs users from organizations to cost center', async () => {
    // Set up input mocks
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'github_cost_center_name':
          return 'test-cost-center'
        case 'github_enterprise':
          return 'test-enterprise'
        case 'github_token':
          return 'test-token'
        default:
          return ''
      }
    })

    // Mock the cost centers API call
    mockOctokit.request.mockResolvedValueOnce(mockCostCenterResponse)

    // Mock org member responses
    mockOctokit.rest.orgs.listMembers
      .mockResolvedValueOnce({
        data: [{ login: 'org1-user1' }, { login: 'org1-user2' }]
      })
      .mockResolvedValueOnce({
        data: [{ login: 'org2-user1' }, { login: 'org1-user2' }]
      })

    await main.run()

    // Verify cost center was fetched
    expect(mockOctokit.request).toHaveBeenCalledWith(
      'GET /enterprises/{enterprise}/settings/billing/cost-centers',
      { enterprise: 'test-enterprise' }
    )

    // Verify org members were fetched for both orgs
    expect(mockOctokit.rest.orgs.listMembers).toHaveBeenCalledWith({
      org: 'org1'
    })
    expect(mockOctokit.rest.orgs.listMembers).toHaveBeenCalledWith({
      org: 'org2'
    })

    // Verify correct users were added/removed
    expect(setOutputMock).toHaveBeenCalledWith(
      'result',
      expect.stringContaining('org1-user1')
    )
  })

  it('handles team filtering when team is specified', async () => {
    // Add test for team filtering
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'github_team':
          return 'test-team'
        case 'github_cost_center_name':
          return 'test-cost-center'
        case 'github_enterprise':
          return 'test-enterprise'
        case 'github_token':
          return 'test-token'
        default:
          return ''
      }
    })

    mockOctokit.request.mockResolvedValueOnce(mockCostCenterResponse)
    mockOctokit.rest.teams.listMembersInOrg.mockResolvedValue({
      data: [{ login: 'team-user1' }]
    })

    await main.run()

    expect(mockOctokit.rest.teams.listMembersInOrg).toHaveBeenCalledWith({
      org: expect.any(String),
      team_slug: 'test-team'
    })
  })

  it('handles errors gracefully', async () => {
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'github_cost_center_name':
          return 'nonexistent-cost-center'
        case 'github_enterprise':
          return 'test-enterprise'
        case 'github_token':
          return 'test-token'
        default:
          return ''
      }
    })

    mockOctokit.request.mockRejectedValueOnce(new Error('API error'))

    await main.run()

    expect(setFailedMock).toHaveBeenCalledWith('API error')
  })
})
