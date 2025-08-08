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
        listMembersInOrg: jest.fn()
      },
      orgs: {
        listMembers: jest.fn()
      }
    }
  })
}))

// Mock the GitHub Cost Center API
jest.mock('axios')

// Other utilities
const timeRegex = /^\d{2}:\d{2}:\d{2}/

describe('action', () => {
  let mockOctokit

  beforeEach(() => {
    jest.clearAllMocks()
    // Set up default environment
    process.env.GITHUB_TOKEN = 'test-token'

    // Get the mocked octokit instance
    mockOctokit = github.getOctokit()
  })

  afterEach(() => {
    delete process.env.GITHUB_TOKEN
  })

  it('sets the result output for team sync', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'github_organization':
          return 'test-org'
        case 'github_team':
          return 'test-team'
        case 'github_cost_center_name':
          return 'test-cost-center'
        default:
          return ''
      }
    })

    // Mock GitHub API responses
    mockOctokit.rest.teams.listMembersInOrg.mockResolvedValue({
      data: [{ login: 'user1' }, { login: 'user2' }]
    })
    axios.get.mockResolvedValue({
      data: [{ login: 'user2' }, { login: 'user3' }]
    })
    axios.post.mockResolvedValue({})
    axios.delete.mockResolvedValue({})

    await main.run()

    // Verify that all of the core library functions were called correctly
    expect(setOutputMock).toHaveBeenNthCalledWith(
      1,
      'result',
      'Added users: user1, Removed users: user3'
    )
  })

  it('sets the result output for organization sync', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'github_organization':
          return 'test-org'
        case 'github_team':
          return '' // No team specified
        case 'github_cost_center_name':
          return 'test-cost-center'
        default:
          return ''
      }
    })

    // Mock GitHub API responses
    mockOctokit.rest.orgs.listMembers.mockResolvedValue({
      data: [{ login: 'org-user1' }, { login: 'org-user2' }]
    })
    axios.get.mockResolvedValue({
      data: [{ login: 'org-user2' }, { login: 'old-user' }]
    })
    axios.post.mockResolvedValue({})
    axios.delete.mockResolvedValue({})

    await main.run()

    // Verify that all of the core library functions were called correctly
    expect(setOutputMock).toHaveBeenNthCalledWith(
      1,
      'result',
      'Added users: org-user1, Removed users: old-user'
    )
  })

  it('handles no changes needed', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'github_organization':
          return 'test-org'
        case 'github_team':
          return 'test-team'
        case 'github_cost_center_name':
          return 'test-cost-center'
        default:
          return ''
      }
    })

    // Mock GitHub API responses - same users in both
    mockOctokit.rest.teams.listMembersInOrg.mockResolvedValue({
      data: [{ login: 'user1' }, { login: 'user2' }]
    })
    axios.get.mockResolvedValue({
      data: [{ login: 'user1' }, { login: 'user2' }]
    })

    await main.run()

    // Verify that no API calls were made to add/remove users
    expect(axios.post).not.toHaveBeenCalled()
    expect(axios.delete).not.toHaveBeenCalled()
    expect(setOutputMock).toHaveBeenNthCalledWith(
      1,
      'result',
      'Added users: , Removed users: '
    )
  })

  it('handles empty GitHub team/org', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'github_organization':
          return 'test-org'
        case 'github_team':
          return 'empty-team'
        case 'github_cost_center_name':
          return 'test-cost-center'
        default:
          return ''
      }
    })

    // Mock GitHub API responses - empty team
    mockOctokit.rest.teams.listMembersInOrg.mockResolvedValue({
      data: []
    })
    axios.get.mockResolvedValue({
      data: [{ login: 'user1' }, { login: 'user2' }]
    })
    axios.delete.mockResolvedValue({})

    await main.run()

    // Verify that users were removed but none added
    expect(axios.post).not.toHaveBeenCalled()
    expect(axios.delete).toHaveBeenCalledTimes(2)
    expect(setOutputMock).toHaveBeenNthCalledWith(
      1,
      'result',
      'Added users: , Removed users: user1, user2'
    )
  })

  it('handles empty cost center', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'github_organization':
          return 'test-org'
        case 'github_team':
          return 'test-team'
        case 'github_cost_center_name':
          return 'empty-cost-center'
        default:
          return ''
      }
    })

    // Mock GitHub API responses - empty cost center
    mockOctokit.rest.teams.listMembersInOrg.mockResolvedValue({
      data: [{ login: 'user1' }, { login: 'user2' }]
    })
    axios.get.mockResolvedValue({
      data: []
    })
    axios.post.mockResolvedValue({})

    await main.run()

    // Verify that users were added but none removed
    expect(axios.post).toHaveBeenCalledTimes(2)
    expect(axios.delete).not.toHaveBeenCalled()
    expect(setOutputMock).toHaveBeenNthCalledWith(
      1,
      'result',
      'Added users: user1, user2, Removed users: '
    )
  })

  it('sets a failed status on GitHub API error', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'github_organization':
          return 'test-org'
        case 'github_team':
          return 'test-team'
        case 'github_cost_center_name':
          return 'test-cost-center'
        default:
          return ''
      }
    })

    // Mock GitHub API error
    mockOctokit.rest.teams.listMembersInOrg.mockRejectedValue(
      new Error('GitHub API error')
    )

    await main.run()

    // Verify that all of the core library functions were called correctly
    expect(setFailedMock).toHaveBeenNthCalledWith(1, 'GitHub API error')
  })

  it('sets a failed status on Cost Center API error', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'github_organization':
          return 'test-org'
        case 'github_team':
          return 'test-team'
        case 'github_cost_center_name':
          return 'test-cost-center'
        default:
          return ''
      }
    })

    // Mock GitHub API responses
    mockOctokit.rest.teams.listMembersInOrg.mockResolvedValue({
      data: [{ login: 'user1' }, { login: 'user2' }]
    })
    axios.get.mockRejectedValue(new Error('Cost Center API error'))

    await main.run()

    // Verify that all of the core library functions were called correctly
    expect(setFailedMock).toHaveBeenNthCalledWith(1, 'Cost Center API error')
  })

  it('sets a failed status on user addition error', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'github_organization':
          return 'test-org'
        case 'github_team':
          return 'test-team'
        case 'github_cost_center_name':
          return 'test-cost-center'
        default:
          return ''
      }
    })

    // Mock GitHub API responses
    mockOctokit.rest.teams.listMembersInOrg.mockResolvedValue({
      data: [{ login: 'user1' }, { login: 'user2' }]
    })
    axios.get.mockResolvedValue({
      data: []
    })
    axios.post.mockRejectedValue(new Error('Failed to add user'))

    await main.run()

    // Verify that all of the core library functions were called correctly
    expect(setFailedMock).toHaveBeenNthCalledWith(1, 'Failed to add user')
  })

  it('sets a failed status on user removal error', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'github_organization':
          return 'test-org'
        case 'github_team':
          return 'test-team'
        case 'github_cost_center_name':
          return 'test-cost-center'
        default:
          return ''
      }
    })

    // Mock GitHub API responses
    mockOctokit.rest.teams.listMembersInOrg.mockResolvedValue({
      data: []
    })
    axios.get.mockResolvedValue({
      data: [{ login: 'user1' }]
    })
    axios.delete.mockRejectedValue(new Error('Failed to remove user'))

    await main.run()

    // Verify that all of the core library functions were called correctly
    expect(setFailedMock).toHaveBeenNthCalledWith(1, 'Failed to remove user')
  })

  it('fails if no input is provided', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'github_organization':
          throw new Error(
            'Input required and not supplied: github_organization'
          )
        default:
          return ''
      }
    })

    await main.run()

    // Verify that all of the core library functions were called correctly
    expect(setFailedMock).toHaveBeenNthCalledWith(
      1,
      'Input required and not supplied: github_organization'
    )
  })

  it('fails if cost center name is missing', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'github_organization':
          return 'test-org'
        case 'github_team':
          return 'test-team'
        case 'github_cost_center_name':
          throw new Error(
            'Input required and not supplied: github_cost_center_name'
          )
        default:
          return ''
      }
    })

    await main.run()

    // Verify that all of the core library functions were called correctly
    expect(setFailedMock).toHaveBeenNthCalledWith(
      1,
      'Input required and not supplied: github_cost_center_name'
    )
  })

  it('fails if GITHUB_TOKEN environment variable is missing', async () => {
    // Remove the GITHUB_TOKEN
    delete process.env.GITHUB_TOKEN

    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'github_organization':
          return 'test-org'
        case 'github_team':
          return 'test-team'
        case 'github_cost_center_name':
          return 'test-cost-center'
        default:
          return ''
      }
    })

    // Mock GitHub API responses
    mockOctokit.rest.teams.listMembersInOrg.mockResolvedValue({
      data: [{ login: 'user1' }]
    })
    // This should fail because no token is provided
    axios.get.mockRejectedValue(
      new Error('Request failed with status code 401')
    )

    await main.run()

    // Verify that authentication error was handled
    expect(setFailedMock).toHaveBeenNthCalledWith(
      1,
      'Request failed with status code 401'
    )
  })
})
