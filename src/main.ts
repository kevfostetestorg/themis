import * as core from '@actions/core'
import * as github from '@actions/github'
import * as inputHelper from './input-helper'
import {Team} from './team'
import {Collaborator} from './collaborator'
import {TeamInputs, CollaboratorInputs, RepoInputs} from './ThemisInputs'
import {Repository} from './repository'

async function run(): Promise<void> {
  try {
    const inputs:
      | TeamInputs
      | RepoInputs
      | CollaboratorInputs
      | undefined = inputHelper.getInputs()

    core.debug(`Inputs ${JSON.stringify(inputs)}`) // debug is only output if you set the secret `ACTIONS_RUNNER_DEBUG` to true

    if (inputs !== undefined) {
      const octokit = github.getOctokit(inputs.pat_token)

      if (inputs instanceof TeamInputs) {
        const team: Team = new Team(octokit, github.context.repo.owner, inputs)
        await team.sync()
        core.setOutput(
          'status',
          `Successfully created members ${JSON.stringify(
            inputs.members
          )} for teams ${JSON.stringify(inputs.teams)}`
        )
      } else if (inputs instanceof CollaboratorInputs) {
        const collaborator: Collaborator = new Collaborator(
          octokit,
          github.context.repo.owner,
          inputs
        )
        core.debug(`Collaborator is ${collaborator}`)
        await collaborator.sync()
        core.setOutput(
          'status',
          `Successfully added Collaborators ${JSON.stringify(
            inputs.collaborators
          )} for repos ${JSON.stringify(inputs.repos)} with permissions ${
            inputs.permission
          }`
        )
      } else if (inputs instanceof RepoInputs) {
        const repository: Repository = new Repository(
          octokit,
          github.context.repo.owner,
          inputs
        )
        core.debug(`Repository is ${repository}`)
        await repository.sync()
        core.setOutput(
          'status',
          `Successfully executed ${
            inputs.action
          } on Repository ${JSON.stringify(inputs.repo)}`
        )
      }
    }
  } catch (_e) {
    const e: Error = _e as Error
    core.setOutput('status', e.message)
    core.setFailed(`${e.message}`)
  }
}

run()
