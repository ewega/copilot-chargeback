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

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('sets the result output', async () => {
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
    github.getOctokit().rest.teams.listMembersInOrg.mockResolvedValue({
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

  it('sets a failed status', async () => {
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
    github.getOctokit().rest.teams.listMembersInOrg.mockResolvedValue({
      data: [{ login: 'user1' }, { login: 'user2' }]
    })
    axios.get.mockRejectedValue(new Error('API error'))

    await main.run()

    // Verify that all of the core library functions were called correctly
    expect(setFailedMock).toHaveBeenNthCalledWith(1, 'API error')
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
})
