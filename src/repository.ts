import * as core from '@actions/core'
import {GitHub} from '@actions/github/lib/utils'
import {RepositoryData} from './InputData'
import {RepoAction, RepoInputs} from './ThemisInputs'
//import {OctokitResponse} from '@octokit/types'

//type OctoClientType = ReturnType<typeof github.getOctokit>
export class Repository {
  octokitClient: InstanceType<typeof GitHub>
  org: string
  action: RepoAction | undefined
  targetOrg: string
  repo: string
  requestor: string

  constructor(
    octokitClient: InstanceType<typeof GitHub>,
    org: string,
    inputs: RepoInputs
  ) {
    this.octokitClient = octokitClient
    this.org = org
    this.action = inputs.action
    this.repo = inputs.repo
    this.targetOrg = inputs.targetOrg
    this.requestor = inputs.requestor
  }
  private async find(
    owner: string,
    repo: string
  ): Promise<RepositoryData | undefined> {
    try {
      const res = await this.octokitClient.repos.get({
        repo,
        owner
      })
      return {name: res.data.name}
    } catch (e) {
      if (e.status === 404) {
        core.debug(`${repo} not found ${e}`)
        return undefined
      } else {
        core.error(`Got error getting repo ${repo} in ${owner} = ${e}`)
        return undefined
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

  private async isRepoAdmin(
    org: string,
    repo: string,
    username: string
  ): Promise<boolean> {
    try {
      const {
        data: {permission: permission}
      } = await this.octokitClient.repos.getCollaboratorPermissionLevel({
        owner: org,
        repo,
        username
      })
      core.debug(`Repo role for ${username} is ${JSON.stringify(permission)}`)
      return permission === 'admin'
    } catch (e) {
      if (e.status === 404) {
        core.debug(`${username} not a collaborator for the repo ${e}`)
        return false
      } else {
        core.error(
          `Got error getting repo role for ${username} in ${org} = ${e}`
        )
        return false
      }
    }
  }

  async sync(): Promise<void> {
    const isOrgAdmin = await this.isOrgAdmin(this.org, this.requestor)

    if (!isOrgAdmin) {
      const isRepoAdmin = await this.isRepoAdmin(
        this.org,
        this.repo,
        this.requestor
      )
      core.debug(`**** ${this.requestor} is a repoadmin is ${isRepoAdmin} `)
      if (!isRepoAdmin) {
        const message = `
Not authorized! 
          
The requestor @${this.requestor} is neither an admin for **${this.org}** org nor an admin for **${this.repo}** repo 
          
A person with the required permissions must approve this request to re-process it.`
        core.debug(message)
        throw new Error(message)
      }
    }

    switch (this.action) {
      case RepoAction.transfer:
        core.debug(`Transfering repo`)
        await this.transfer(this.repo, this.org, this.targetOrg)
        break
      default:
        core.debug(`Unknown Action ${this.action}`)
        break
    }
  }

  async transfer(repo: string, org: string, targetOrg: string): Promise<void> {
    await this.octokitClient.repos.transfer({
      owner: org,
      repo,
      new_owner: targetOrg
    })
  }
}
