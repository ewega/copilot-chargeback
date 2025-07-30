const core = require('@actions/core')
const github = require('@actions/github')
const axios = require('axios')

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
async function run() {
  try {
    const githubOrganization = core.getInput('github_organization', {
      required: true
    })
    const githubTeam = core.getInput('github_team', { required: false })
    const githubCostCenterName = core.getInput('github_cost_center_name', {
      required: true
    })

    const octokit = github.getOctokit(process.env.GITHUB_TOKEN)

    // Fetch users from GitHub organization or team
    let githubUsers = []
    if (githubTeam) {
      const { data: teamMembers } = await octokit.rest.teams.listMembersInOrg({
        org: githubOrganization,
        team_slug: githubTeam
      })
      githubUsers = teamMembers.map(member => member.login)
    } else {
      const { data: orgMembers } = await octokit.rest.orgs.listMembers({
        org: githubOrganization
      })
      githubUsers = orgMembers.map(member => member.login)
    }

    // Get cost center API base URL (default to GitHub API if not specified)
    const costCenterApiBaseUrl =
      process.env.COST_CENTER_API_BASE_URL || 'https://api.github.com'

    // Fetch users from GitHub Cost Center
    const { data: costCenterUsers } = await axios.get(
      `${costCenterApiBaseUrl}/cost-centers/${githubCostCenterName}/users`,
      {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`
        }
      }
    )
    const costCenterUsernames = costCenterUsers.map(user => user.login)

    // Compare and update users in the cost center
    const usersToAdd = githubUsers.filter(
      user => !costCenterUsernames.includes(user)
    )
    const usersToRemove = costCenterUsernames.filter(
      user => !githubUsers.includes(user)
    )

    for (const user of usersToAdd) {
      await axios.post(
        `${costCenterApiBaseUrl}/cost-centers/${githubCostCenterName}/users`,
        { username: user },
        {
          headers: {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`
          }
        }
      )
    }

    for (const user of usersToRemove) {
      await axios.delete(
        `${costCenterApiBaseUrl}/cost-centers/${githubCostCenterName}/users/${user}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`
          }
        }
      )
    }

    // Set outputs for other workflow steps to use
    core.setOutput(
      'result',
      `Added users: ${usersToAdd.join(', ')}, Removed users: ${usersToRemove.join(', ')}`
    )
  } catch (error) {
    // Fail the workflow run if an error occurs
    core.setFailed(error.message)
  }
}

module.exports = {
  run
}
