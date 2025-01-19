const mock_cost_center = {
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

const mock_team_members = {
  team1: { data: [{ login: 'team1-user1' }] },
  team2: { data: [{ login: 'team2-user1' }] }
}

const mock_org_members = {
  org1: { data: [{ login: 'org1-user1' }, { login: 'org1-user2' }] },
  org2: { data: [{ login: 'org2-user1' }, { login: 'org1-user2' }] }
}

module.exports = {
  mock_cost_center,
  mock_team_members,
  mock_org_members
}
