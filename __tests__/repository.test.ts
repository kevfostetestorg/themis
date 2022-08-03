import nock = require('nock')
import * as core from '@actions/core'
import * as github from '@actions/github'
import {Repository} from '../src/repository'
import {TeamInputs, CollaboratorInputs, RepoInputs} from '../src/ThemisInputs'
import * as inputHelper from '../src/input-helper'

beforeAll(() => {
  //process.env['INPUT_PAT_TOKEN'] = 'abc'
  process.env['INPUT_ISSUE_BODY_JSON'] =
    '{"repo":"repo1", "action":"transfer", "targetOrg":"targetOrg", "issue_name":"repoinputs"}'
  process.env['GITHUB_REPOSITORY'] = 'decyjphr-org/admin'
  process.env['GITHUB_ACTOR'] = 'decyjphr'
  process.env['INPUT_ISSUE_NAME'] = 'repoinputs'
})

beforeEach(() => {
  //delete process.env['INPUT_BUMP']
  nock.disableNetConnect()
})

test('Input Helper test', () => {
  const inputs:
    | TeamInputs
    | CollaboratorInputs
    | RepoInputs
    | undefined = inputHelper.getInputs()

  core.debug(`Inputs ${JSON.stringify(inputs)}`)
  core.debug(`Inputs is Repo ${inputs instanceof RepoInputs}`)
  if (inputs instanceof RepoInputs) {
    const repoInputs: RepoInputs = inputs
    expect(repoInputs.action).toContain('transfer')
    expect(repoInputs.targetOrg).toContain('targetOrg')
    expect(repoInputs.repo).toContain('repo1')
    expect(repoInputs.requestor).toBe('decyjphr')
    expect(repoInputs.pat_token).toBeDefined()
  }
})

test('Unit test repository.transfer', async () => {
  const inputs:
    | TeamInputs
    | CollaboratorInputs
    | RepoInputs
    | undefined = inputHelper.getInputs()

  core.debug(`Inputs ${JSON.stringify(inputs)}`)
  core.debug(`Inputs is Repo ${inputs instanceof RepoInputs}`)
  if (inputs instanceof RepoInputs) {
    expect(inputs.action).toContain('transfer')
    expect(inputs.targetOrg).toContain('targetOrg')
    expect(inputs.repo).toContain('repo1')
    expect(inputs.requestor).toBe('decyjphr')
    expect(inputs.pat_token).toBeDefined()

    const collaboratorResponse = JSON.parse(
      JSON.stringify(
        require('./fixtures/response/repository.getcollaborators.json')
      )
    )
    console.log(`collaborator data is ${JSON.stringify(collaboratorResponse)}`)
    nock('https://api.github.com')
      .get('/repos/decyjphr-org/repo1/collaborators/decyjphr/permission')
      .reply(200, collaboratorResponse)

    const transferResponse = JSON.parse(
      JSON.stringify(require('./fixtures/response/repository.transfer.json'))
    )
    nock('https://api.github.com')
      .post('/repos/decyjphr-org/repo1/transfer')
      .reply(200, transferResponse)

    const octokit = github.getOctokit(inputs.pat_token)
    const repository: Repository = new Repository(
      octokit,
      github.context.repo.owner,
      inputs
    )
    await repository.sync()
    core.setOutput(
      'status',
      `Successfully executed ${inputs.action} on Repository ${JSON.stringify(
        inputs.repo
      )}`
    )
  } else {
    throw new Error('Input not a Repository input')
  }
})
