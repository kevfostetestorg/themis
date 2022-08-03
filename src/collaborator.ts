import * as core from '@actions/core'
import {GitHub} from '@actions/github/lib/utils'
import {CollaboratorData} from './InputData'
import {CollaboratorInputs} from './ThemisInputs'
export class Collaborator {
  octokitClient: InstanceType<typeof GitHub>
  org: string
  permission: 'admin' | 'read' | 'write' | 'maintain' | 'triage' | undefined
  collaborators: string[]
  repos: string[]
  requestor: string

  constructor(
    octokitClient: InstanceType<typeof GitHub>,
    org: string,
    inputs: CollaboratorInputs
  ) {
    this.octokitClient = octokitClient
    this.org = org
    this.permission = inputs.permission
    this.collaborators = inputs.collaborators
    this.repos = inputs.repos
    this.requestor = inputs.requestor
  }
  private async find(
    owner: string,
    repo: string
  ): Promise<CollaboratorData[] | null> {
    const existing: CollaboratorData[] = []
    let x: CollaboratorData[] | null = await this.findDirect(owner, repo)
    if (x) {
      existing.push(...x)
    }

    x = await this.findOutside(owner, repo)
    if (x) {
      existing.push(...x)
    }
    x = await this.listInvitations(owner, repo)
    if (x) {
      existing.push(...x)
    }

    return existing
  }

  private async findDirect(
    owner: string,
    repo: string
  ): Promise<CollaboratorData[] | null> {
    core.debug('Finding collaborators')
    core.debug(`${owner}`)
    core.debug(`${repo}`)
    const existing: CollaboratorData[] = []

    const params = {
      repo,
      owner,
      affiliation: 'direct'
    }
    let res
    try {
      res = await this.octokitClient.repos.listCollaborators({
        repo,
        owner,
        affiliation: 'direct'
      })
    } catch (e) {
      if (e.status === 404) {
        const message404 = `No collaborator found for ${JSON.stringify(params)}`
        core.debug(message404)
        //throw new Error(message404)
      }
      const message = `${e} fetching the collaborators with ${JSON.stringify(
        params
      )}`
      core.debug(message)
      throw new Error(message)
    }
    const x = res.data.map(user => {
      return {
        // Force all usernames to lowercase to avoid comparison issues.
        username: user.login.toLowerCase(),
        pendinginvite: false,
        permission: user.permissions
      }
    })
    existing.push(...x)
    return existing
  }

  private async findOutside(
    owner: string,
    repo: string
  ): Promise<CollaboratorData[] | null> {
    core.debug('Finding collaborators')
    core.debug(`${owner}`)
    core.debug(`${repo}`)
    const existing: CollaboratorData[] = []

    const params = {
      repo,
      owner,
      affiliation: 'outside'
    }
    let res
    try {
      res = await this.octokitClient.repos.listCollaborators({
        repo,
        owner,
        affiliation: 'outside'
      })
    } catch (e) {
      if (e.status === 404) {
        const message404 = `No collaborator found for ${JSON.stringify(params)}`
        core.debug(message404)
        //throw new Error(message404)
      }
      const message = `${e} fetching the collaborators with ${JSON.stringify(
        params
      )}`
      core.debug(message)
      throw new Error(message)
    }
    const x = res.data.map(user => {
      return {
        // Force all usernames to lowercase to avoid comparison issues.
        username: user.login.toLowerCase(),
        pendinginvite: false,
        permission: user.permissions
      }
    })
    existing.push(...x)
    return existing
  }

  private async listInvitations(
    owner: string,
    repo: string
  ): Promise<CollaboratorData[] | null> {
    core.debug('Finding collaborators')
    core.debug(`${owner}`)
    core.debug(`${repo}`)
    const existing: CollaboratorData[] = []

    const params = {
      repo,
      owner,
      affiliation: 'direct'
    }
    let res
    try {
      res = await this.octokitClient.repos.listInvitations({
        repo,
        owner
      })
    } catch (e) {
      if (e.status === 404) {
        const message404 = `No collaborator found for ${JSON.stringify(params)}`
        core.debug(message404)
        //throw new Error(message404)
      }
      const message = `${e} fetching the collaborators with ${JSON.stringify(
        params
      )}`
      core.debug(message)
      throw new Error(message)
    }
    const x = res.data.map(invite => {
      const u: string = invite?.invitee?.login.toLowerCase() || ''

      return {
        // Force all usernames to lowercase to avoid comparison issues.
        username: u,
        pendinginvite: true,
        invitation_id: invite.id,
        permission: {
          admin: invite.permissions === 'admin',
          push: invite.permissions === 'write',
          pull: invite.permissions === 'read'
        }
      }
    })
    existing.push(...x)
    return existing
  }

  private async updateInvite(
    owner: string,
    repo: string,
    invitation_id: number,
    permissions: 'admin' | 'read' | 'write' | 'maintain' | 'triage' | undefined
  ): Promise<void> {
    const data = {
      owner,
      repo,
      invitation_id,
      permissions
    }
    await this.octokitClient.repos.updateInvitation(data)
  }

  private async addCollaborator(
    owner: string,
    repo: string,
    username: string
  ): Promise<void> {
    const p: 'admin' | 'maintain' | 'triage' | 'pull' | 'push' | undefined =
      (this.permission === 'admin' && 'admin') ||
      (this.permission === 'write' && 'push') ||
      (this.permission === 'read' && 'pull') ||
      undefined
    const data = {
      owner,
      repo,
      username,
      permission: p
    }
    await this.octokitClient.repos.addCollaborator(data)
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

  async sync(): Promise<void> {
    const isOrgAdmin = await this.isOrgAdmin(this.org, this.requestor)

    for (const repo of this.repos) {
      const existings = await this.find(this.org, repo)
      core.debug(`Existing collaborators are ${JSON.stringify(existings)}`)
      if (!isOrgAdmin) {
        const isRepoAdmin = existings?.find(record => {
          return record.username === this.requestor && record.permission?.admin
        })
        core.debug(`**** ${this.requestor} is a repoadmin is ${isRepoAdmin} `)
        if (!isRepoAdmin) {
          const message = `
Not authorized! 
          
The requestor @${this.requestor} is neither an admin for **${this.org}** org nor an admin for **${repo}** repo 
          
A person with the required permissions must approve this request to re-process it.`
          core.debug(message)
          throw new Error(message)
        }
      }

      if (existings) {
        for (const existing of existings) {
          const found = this.collaborators.find(record => {
            return existing.username === record
          })
          if (found) {
            if (existing.pendinginvite) {
              // re-invite
              core.debug(
                `***** Will re-invite a pending invitation for the ${existing.username} with permission ${this.permission}`
              )
              this.updateInvite(
                this.org,
                repo,
                existing.invitation_id as number,
                this.permission
              )
            } else {
              core.debug(
                `***** Will modify the existing collaborator ${existing.username} with permission ${this.permission}`
              )
              this.addCollaborator(this.org, repo, existing.username)
            }
          }
        }
      }

      for (const collaborator of this.collaborators) {
        const found = existings?.find(record => {
          return record.username === collaborator
        })
        if (!found) {
          this.addCollaborator(this.org, repo, collaborator)
        }
      }
    }
  }
}
