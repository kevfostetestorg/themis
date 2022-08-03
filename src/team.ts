import * as core from '@actions/core'
import {GitHub} from '@actions/github/lib/utils'
import {TeamData} from './InputData'
import {TeamInputs} from './ThemisInputs'

//type OctoClientType = ReturnType<typeof github.getOctokit>
export class Team {
  octokitClient: InstanceType<typeof GitHub>
  org: string
  teamSlugs: string[]
  members: string[]
  requestor: string

  constructor(
    octokitClient: InstanceType<typeof GitHub>,
    org: string,
    inputs: TeamInputs
  ) {
    this.octokitClient = octokitClient
    this.org = org
    this.teamSlugs = inputs.teams
    this.members = inputs.members
    this.requestor = inputs.requestor
  }

  private async find(org: string, team_slug: string): Promise<TeamData | null> {
    core.debug('Finding team')
    core.debug(`${team_slug}`)
    core.debug(`${org}`)
    const params = {
      org,
      team_slug
    }
    let res = {
      data: {
        name: ''
      }
    }
    try {
      res = await this.octokitClient.teams.getByName(params)
    } catch (e) {
      if (e.status === 404) {
        const message404 = `No team found for ${JSON.stringify(params)}`
        core.debug(message404)
        throw new Error(message404)
      }
      const message = `${e} fetching the team with ${JSON.stringify(params)}`
      core.debug(message)
      throw new Error(message)
    }
    const {data: team} = res
    return team
  }

  private async addMembers(
    org: string,
    team_slug: string,
    members: string[]
  ): Promise<void> {
    for (const username of members) {
      const params = {
        org,
        team_slug,
        username
      }
      core.debug(`Adding team members ${JSON.stringify(params)}`)

      try {
        await this.octokitClient.teams.addOrUpdateMembershipForUserInOrg(params)
      } catch (e) {
        const message = `${e} when adding members to the team with ${JSON.stringify(
          params
        )}`
        core.debug(message)
        throw new Error(message)
      }
    }
  }

  private async isOrgAdmin(org: string, username: string): Promise<boolean> {
    try {
      const {
        data: {role: role}
      } = await this.octokitClient.orgs.getMembershipForUser({
        org,
        username
      })
      return role === 'admin'
    } catch (e) {
      if (e.status === 404) {
        core.debug(`${username} not a member of org ${e}`)
        return false
      } else {
        core.error(
          `Got error getting org role for ${username} in ${org} = ${e}`
        )
        return false
      }
    }
  }

  private async isTeamMember(
    org: string,
    team_slug: string,
    username: string
  ): Promise<boolean> {
    const team = await this.find(this.org, team_slug)
    core.debug(`found team ${team}`)
    try {
      const {
        data: memberData
      } = await this.octokitClient.teams.getMembershipForUserInOrg({
        org,
        team_slug,
        username
      })
      core.debug(`Found member data = ${JSON.stringify(memberData)}`)
      return true
    } catch (e) {
      if (e.status === 404) {
        core.debug(`No team memberships found for ${username} ${e}`)
        return false
      } else {
        core.error(
          `Got error getting teams memberships team ${team_slug} in ${org} = ${e.message}`
        )
        return false
      }
    }
  }

  async sync(): Promise<void> {
    const isOrgAdmin = await this.isOrgAdmin(this.org, this.requestor)
    for (const teamSlug of this.teamSlugs) {
      if (
        isOrgAdmin ||
        (await this.isTeamMember(this.org, teamSlug, this.requestor))
      ) {
        await this.addMembers(this.org, teamSlug, this.members)
      } else {
        const message = `Not authorized! The requestor @${this.requestor} is neither an admin for **${this.org}** org nor a member of **${teamSlug}** team `
        core.debug(message)
        throw new Error(message)
      }
    }
  }
}
