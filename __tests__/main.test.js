const core = require('@actions/core')
const github = require('@actions/github')
const axios = require('axios')
const main = require('../src/main')
const {
  mock_cost_center,
  mock_team_members,
  mock_org_members
} = require('./test-fixtures')

// Mock the GitHub Actions core library
const debug_mock = jest.spyOn(core, 'debug').mockImplementation()
const input_mock = jest.spyOn(core, 'getInput').mockImplementation()
const failed_mock = jest.spyOn(core, 'setFailed').mockImplementation()
const output_mock = jest.spyOn(core, 'setOutput').mockImplementation()

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
const github_mock = {
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
jest.spyOn(github, 'getOctokit').mockImplementation(() => github_mock)

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    github_mock.rest.teams.listMembersInOrg.mockReset()
    github_mock.rest.orgs.listMembers.mockReset()
    axios.get.mockReset()
  })

  it('syncs users from organizations to cost center', async () => {
    // Set up input mocks
    getInputMock.mockImplementation(name => {
  it('syncs users from organizations to cost center', async () => {
    input_mock.mockImplementation(name => {
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

    github_mock.request.mockResolvedValueOnce(mock_cost_center)
    github_mock.rest.orgs.listMembers
      .mockResolvedValueOnce(mock_org_members.org1)
      .mockResolvedValueOnce(mock_org_members.org2)

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

    expect(github_mock.request).toHaveBeenCalledWith(
      'GET /enterprises/{enterprise}/settings/billing/cost-centers',
      { enterprise: 'test-enterprise' }
    )

    // Verify org members were fetched for both orgs
    expect(github_mock.rest.orgs.listMembers).toHaveBeenCalledWith({
      org: 'org1'
    })
    expect(github_mock.rest.orgs.listMembers).toHaveBeenCalledWith({
      org: 'org2'
    })

    // Verify correct users were added/removed
    expect(output_mock).toHaveBeenCalledWith(
      'result',
      expect.stringContaining('org1-user1')
    )
  })

  it('handles team filtering when team is specified', async () => {
    getInputMock.mockImplementation(name => {
  it('handles team filtering when team is specified', async () => {
    input_mock.mockImplementation(name => {
      switch (name) {
        case 'github_team':
          return JSON.stringify([
            { org: 'org1', team: 'team1' },
            { org: 'org2', team: 'team2' }
          ])
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
    mockOctokit.rest.teams.listMembersInOrg
      .mockResolvedValueOnce({ data: [{ login: 'team1-user1' }] })
      .mockResolvedValueOnce({ data: [{ login: 'team2-user1' }] })

    github_mock.request.mockResolvedValueOnce(mock_cost_center)
    github_mock.rest.teams.listMembersInOrg
      .mockResolvedValueOnce(mock_team_members.team1)
      .mockResolvedValueOnce(mock_team_members.team2)

    await main.run()

    expect(mockOctokit.rest.teams.listMembersInOrg).toHaveBeenCalledWith({
      org: 'org1',
      team_slug: 'team1'
    })
    expect(mockOctokit.rest.teams.listMembersInOrg).toHaveBeenCalledWith({
      org: 'org2',
      team_slug: 'team2'
    })

    expect(github_mock.rest.teams.listMembersInOrg).toHaveBeenCalledWith({
      org: 'org1',
      team_slug: 'team1'
    })
    expect(github_mock.rest.teams.listMembersInOrg).toHaveBeenCalledWith({
      org: 'org2',
      team_slug: 'team2'
    })
  })

  it('handles errors gracefully', async () => {
    getInputMock.mockImplementation(name => {
  it('handles errors gracefully', async () => {
    input_mock.mockImplementation(name => {
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

    const api_error = new Error('API error')
    github_mock.request.mockRejectedValueOnce(api_error)

    await main.run()

    expect(setFailedMock).toHaveBeenCalledWith('API error')

    expect(failed_mock).toHaveBeenCalledWith(
      expect.stringContaining('API error')
    )
  })
})
