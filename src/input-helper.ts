import * as core from '@actions/core'
import {
  Inputs,
  CollaboratorInputs,
  TeamInputs,
  RepoInputs
} from './ThemisInputs'

/**
 * Helper to get all the inputs for the action
 */
export function getInputs():
  | TeamInputs
  | CollaboratorInputs
  | RepoInputs
  | undefined {
  const issue_name: string = core.getInput(Inputs.IssueName, {required: true})
  core.debug(issue_name)
  const issue_body: string = core.getInput(Inputs.IssueBody, {required: true})
  core.debug(issue_body)
  const parsed_body = JSON.parse(issue_body)
  const actor = process.env.GITHUB_ACTOR //core.getInput(Inputs.Requestor, {required: true})
  if (!actor) {
    throw new Error('actor is undefined')
  }
  const pat_token: string = core.getInput(Inputs.Token, {required: true})

  if (issue_name === 'teaminputs') {
    const inputs: TeamInputs = new TeamInputs(
      parsed_body.members.split('\r\n'),
      parsed_body.teams.split('\r\n'),
      actor,
      pat_token
    )
    return inputs
  } else if (issue_name === 'collaboratorinputs') {
    const inputs: CollaboratorInputs = new CollaboratorInputs(
      parsed_body.permission,
      parsed_body.collaborators.split('\r\n'),
      parsed_body.repos.split('\r\n'),
      actor,
      pat_token
    )
    return inputs
  } else if (issue_name === 'repoinputs') {
    const inputs: RepoInputs = new RepoInputs(
      parsed_body.action,
      parsed_body.repo,
      parsed_body.targetOrg,
      actor,
      pat_token
    )
    return inputs
  }
  //return null
}
