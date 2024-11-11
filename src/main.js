const core = require('@actions/core')
const github = require('@actions/github')

const isDev = () => process.env.DEBUG === 'true'

const debug = (...args) => {
  if (isDev()) {
    console.log('[DEBUG]', ...args)
  }
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
async function run() {
  try {
    const github_team = core.getInput('github_team', { required: false })
    const github_cost_center_name = core.getInput('github_cost_center_name', {
      required: true
    })
    const github_enterprise = core.getInput('github_enterprise', {
      required: true
    })
    const github_token = core.getInput('github_token', { required: true })

    const octokit = github.getOctokit(github_token)

    // Get cost center details including organizations
    const [cost_center_id, cost_center_users, cost_center_orgs] =
      await getCostCenter(octokit, github_enterprise, github_cost_center_name)

    // Get all users from all organizations in the cost center
    const github_users = await getOrganizationUsers(
      octokit,
      cost_center_orgs,
      github_team
    )

    // Compare and update users in the cost center
    const users_to_add = github_users.filter(
      user => !cost_center_users.includes(user)
    )
    const users_to_remove = cost_center_users.filter(
      user => !github_users.includes(user)
    )

    debug(`Users to add: ${users_to_add.join(', ')}`)
    debug(`Users to remove: ${users_to_remove.join(', ')}`)

    for (const user of users_to_add) {
      debug(`Adding user: ${user} to cost center: ${cost_center_id}`)
      await octokit.request(
        'POST /enterprises/{enterprise}/settings/billing/cost-centers/{cost_center_id}/resource',
        {
          enterprise: github_enterprise,
          cost_center_id,
          users: [user]
        }
      )
    }

    for (const user of users_to_remove) {
      debug(`Removing user: ${user} from cost center: ${cost_center_id}`)
      await octokit.request(
        'DELETE /enterprises/{enterprise}/settings/billing/cost-centers/{cost_center_id}/resource',
        {
          enterprise: github_enterprise,
          cost_center_id,
          users: [user]
        }
      )
    }

    // Set outputs for other workflow steps to use
    core.setOutput(
      'result',
      `Added users: ${users_to_add.join(', ')}, Removed users: ${users_to_remove.join(', ')}`
    )
  } catch (error) {
    // Fail the workflow run if an error occurs
    core.setFailed(error.message)
  }
}

const getOrganizationUsers = async (
  octokit,
  organizations,
  team_name = null
) => {
  const all_users = new Set()

  for (const org of organizations) {
    if (team_name) {
      debug(`Fetching team members for team: ${team_name} in org: ${org}`)
      try {
        const { data: team_members } =
          await octokit.rest.teams.listMembersInOrg({
            org,
            team_slug: team_name
          })
        for (const member of team_members) {
          all_users.add(member.login)
        }
      } catch (error) {
        console.warn(
          `[WARN] Could not fetch team ${team_name} from org ${org}: ${error.message}`
        )
      }
    } else {
      debug(`Fetching organization members for org: ${org}`)
      try {
        const { data: org_members } = await octokit.rest.orgs.listMembers({
          org
        })
        for (const member of org_members) {
          all_users.add(member.login)
        }
      } catch (error) {
        console.warn(
          `[WARN] Could not fetch members from org ${org}: ${error.message}`
        )
      }
    }
  }

  debug(
    `Retrieved ${all_users.size} unique users from ${organizations.length} organizations`
  )
  return Array.from(all_users)
}

const getCostCenter = async (octokit, github_enterprise, cost_center_name) => {
  debug(
    `Getting cost center details for name: ${cost_center_name} in enterprise: ${github_enterprise}`
  )
  const start_time = Date.now()

  try {
    const { data: cost_centers_data } = await octokit.request(
      'GET /enterprises/{enterprise}/settings/billing/cost-centers',
      {
        enterprise: github_enterprise
      }
    )

    const cost_center = cost_centers_data.costCenters.find(
      center => center.name === cost_center_name
    )

    if (!cost_center) {
      console.error(
        `[ERROR] Cost center not found. Available centers: ${cost_centers_data.costCenters.map(c => c.name).join(', ')}`
      )
      throw new Error(`Cost center with name ${cost_center_name} not found`)
    }

    // Extract organizations and users from resources array
    const org_resources = cost_center.resources.filter(
      resource => resource.type === 'Org'
    )
    const user_resources = cost_center.resources.filter(
      resource => resource.type === 'User'
    )

    const organization_names = org_resources.map(org => org.name)
    const user_names = user_resources.map(user => user.name)

    const execution_time = Date.now() - start_time
    debug(
      `Found cost center ID: ${cost_center.id} with ${organization_names.length} organizations and ${user_names.length} direct users (took ${execution_time}ms)`
    )

    return [cost_center.id, user_names, organization_names]
  } catch (error) {
    console.error('[ERROR] Failed to get cost center ID:', error.message)
    if (error.response) {
      console.error('[ERROR] API Response:', {
        status: error.response.status,
        data: error.response.data
      })
    }
    throw error
  }
}

module.exports = {
  run
}
