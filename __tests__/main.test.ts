import {wait} from '../src/wait'
import * as process from 'process'
import * as cp from 'child_process'
import * as path from 'path'
import {type} from 'os'
import * as core from '@actions/core'
import * as github from '@actions/github'
import {Team} from '../src/team'
import {TeamInputs, CollaboratorInputs, RepoInputs} from '../src/ThemisInputs'
import * as inputHelper from '../src/input-helper'
import nock = require('nock')

beforeAll(() => {
  //process.env['INPUT_PAT_TOKEN'] = 'abc'
  process.env['INPUT_ISSUE_BODY_JSON'] =
    '{"members":"yjayaraman\\r\\nregpaco","teams":"core\\r\\ndocs", "issue_name":"teaminputs"}'
  process.env['GITHUB_REPOSITORY'] = 'decyjphr-org/admin'
  process.env['GITHUB_ACTOR'] = 'decyjphr'
  process.env['INPUT_ISSUE_NAME'] = 'teaminputs'
})

beforeEach(() => {
  nock.disableNetConnect()

  const orgowners = JSON.parse(
    JSON.stringify(require('./fixtures/response/organization.membership.json'))
  )
  nock('https://api.github.com')
    .get('/orgs/decyjphr-org/memberships/decyjphr')
    .reply(200, orgowners)

  const teamadd = JSON.parse(
    JSON.stringify(require('./fixtures/response/team.add.json'))
  )
  nock('https://api.github.com')
    .put(/orgs\/decyjphr-org\/teams\/[a-z]*\/memberships/)
    .reply(200, teamadd)

  const teamget = JSON.parse(
    JSON.stringify(require('./fixtures/response/team.get.json'))
  )
  nock('https://api.github.com')
    .get(/orgs\/decyjphr-org\/teams\/[a-z]*/)
    .reply(200, teamget)
})

test('throws invalid number', async () => {
  const input = parseInt('foo', 10)
  await expect(wait(input)).rejects.toThrow('milliseconds not a number')
})

test('wait 500 ms', async () => {
  const start = new Date()
  await wait(500)
  const end = new Date()
  var delta = Math.abs(end.getTime() - start.getTime())
  expect(delta).toBeGreaterThan(450)
})

test('Input Helper test', () => {
  const inputs:
    | TeamInputs
    | RepoInputs
    | CollaboratorInputs
    | undefined = inputHelper.getInputs()
  const teamInputs: TeamInputs = inputs as TeamInputs
  expect(teamInputs.members).toContain('yjayaraman')
  expect(teamInputs.teams).toContain('core')
  expect(teamInputs.requestor).toBe('decyjphr')
  expect(teamInputs.pat_token).toBeDefined()
})

test('Unit test Team.sync', async () => {
  const inputs:
    | TeamInputs
    | RepoInputs
    | CollaboratorInputs
    | undefined = inputHelper.getInputs()

  core.debug(`Inputs ${JSON.stringify(inputs)}`)
  core.debug(`Inputs is TeamInputs ${inputs instanceof TeamInputs}`)
  if (inputs instanceof TeamInputs) {
    const teamInputs: TeamInputs = inputs
    core.debug(`Members ${teamInputs.members}`) // debug is only output if you set the secret `ACTIONS_RUNNER_DEBUG` to true
    core.debug(`Teams ${teamInputs.teams}`)
    //const token = core.getInput('github_token', {required: true})
    const octokit = github.getOctokit(teamInputs.pat_token)
    const team: Team = new Team(octokit, github.context.repo.owner, teamInputs)
    core.debug(`Team is ${team}`)
    await team.sync()
    core.setOutput(
      'status',
      `Successfully created members ${JSON.stringify(
        teamInputs.members
      )} for teams ${JSON.stringify(teamInputs.teams)}`
    )
  } else {
    throw new Error('Input not a team input')
  }
})

test('Unit test requestor not member for Team.sync', async () => {
  process.env['GITHUB_ACTOR'] = 'devasena'
  const inputs:
    | TeamInputs
    | CollaboratorInputs
    | RepoInputs
    | undefined = inputHelper.getInputs()
  const teamInputs: TeamInputs = inputs as TeamInputs
  const token = core.getInput('pat_token', {required: true})
  const octokit = github.getOctokit(token)
  const team: Team = new Team(octokit, github.context.repo.owner, teamInputs)
  try {
    await team.sync()
  } catch (e) {
    expect(e).toBeInstanceOf(Error)
    core.error(`Main exited ${e}`)
    core.setFailed(`${e.message}`)
  }
})

test('Unit test Team.sync with error', async () => {
  jest.setTimeout(10000)
  process.env['INPUT_ISSUE_BODY_JSON'] =
    '{"members":"__yjayaraman\\r\\n__regpaco","teams":"__core\\r\\n__docs", "issue_name":"teaminputs"}'
  const inputs:
    | TeamInputs
    | CollaboratorInputs
    | RepoInputs
    | undefined = inputHelper.getInputs()
  const teamInputs: TeamInputs = inputs as TeamInputs
  const token = core.getInput('pat_token', {required: true})
  const octokit = github.getOctokit(token)
  const team: Team = new Team(octokit, github.context.repo.owner, teamInputs)
  try {
    await team.sync()
  } catch (e) {
    expect(e).toBeInstanceOf(Error)
    core.error(`Main exited ${e}`)
    core.setFailed(`${e.message}`)
  }
})
/*
test('Input Helper test prerelease', () => {
  process.env['INPUT_PRERELEASE'] = PreRelease.withBuildNumber
  process.env['INPUT_INITIAL_VERSION'] = '0.0.1'
  const teamInputs = inputHelper.getInputs()
  expect(teamInputs.bump).toBe('')
  expect(teamInputs.initialVersion).toBe('0.0.1')
  expect(teamInputs.preRelease).toBe(PreRelease.withBuildNumber)
})

test('Team 0.1.0 firstRelease test', () => {
  const team = new Team('0.1.0', true)
  expect(Team.getNextVersion()).toBe('0.1.0')
})

test('Team 0.1.0 firstRelease PreRelease.withBuildNumber test', () => {
  const Team = new Team(
    '0.1.0',
    true,
    undefined,
    PreRelease.withBuildNumber
  )
  expect(Team.getNextVersion()).toBe('0.1.0-alpha.1')
})

test('Team 0.1.0 bump=major firstRelease test', () => {
  const Team = new Team('0.1.0', true, Bumps.major)
  expect(Team.getNextVersion()).toBe('0.1.0')
})

test('Team 0.1.0 PreRelease.WithBuildNumber test', () => {
  const Team = new Team(
    '0.1.0',
    false,
    undefined,
    PreRelease.withBuildNumber
  )
  expect(Team.getNextVersion()).toBe('0.1.0-alpha.1')
})

test('Team 0.4.3-rc.3 PreRelease.WithBuildNumber test', () => {
  const Team = new Team(
    '0.4.3-rc.3',
    false,
    undefined,
    PreRelease.withBuildNumber,
    'rc'
  )
  expect(Team.getNextVersion()).toBe('0.4.3-rc.4')
})

test('Team 0.4.3-rc.3 PreRelease.WithBuildNumber prelable=alpha test', () => {
  const Team = new Team(
    '0.4.3-rc.3',
    false,
    undefined,
    PreRelease.withBuildNumber
  )
  expect(Team.getNextVersion()).toBe('0.4.3-alpha.1')
})

test('Team 0.1.0 Bumps.major PreRelease.WithBuildNumber test', () => {
  const Team = new Team(
    '0.1.0',
    false,
    Bumps.major,
    PreRelease.withBuildNumber
  )
  expect(Team.getNextVersion()).toBe('1.0.0-alpha.1')
})

test('Team 0.1.0 Bumps.minor PreRelease.WithBuildNumber test', () => {
  const Team = new Team(
    '0.1.0',
    false,
    Bumps.minor,
    PreRelease.withBuildNumber
  )
  expect(Team.getNextVersion()).toBe('0.2.0-alpha.1')
})

test('Team 0.1.0 Bumps.patch PreRelease.WithBuildNumber test', () => {
  const Team = new Team(
    '0.1.0',
    false,
    Bumps.patch,
    PreRelease.withBuildNumber
  )
  expect(Team.getNextVersion()).toBe('0.1.1-alpha.1')
})

test('Team 0.1.0 Bumps.None PreRelease.WithBuildNumber test', () => {
  const Team = new Team(
    '0.1.0',
    false,
    undefined,
    PreRelease.withBuildNumber
  )
  expect(Team.getNextVersion()).toBe('0.1.0-alpha.1')
})

test('Team 0.1.0-alpha.1 Bumps.None PreRelease.WithBuildNumber test', () => {
  const Team = new Team(
    '0.1.0-alpha.1',
    false,
    undefined,
    PreRelease.withBuildNumber
  )
  expect(Team.getNextVersion()).toBe('0.1.0-alpha.2')
})

test('Team 0.1.0-alpha.1 Bumps.None PreRelease.WithBuildNumber label=beta test', () => {
  const Team = new Team(
    '0.1.0-alpha.1',
    false,
    undefined,
    PreRelease.withBuildNumber,
    'beta'
  )
  expect(Team.getNextVersion()).toBe('0.1.0-beta.1')
})

test('Team 0.1.0-alpha.1 Bumps.final PreRelease.WithBuildNumber label=beta test', () => {
  const Team = new Team(
    '0.1.0-alpha.1',
    false,
    Bumps.final,
    PreRelease.withBuildNumber,
    'beta'
  )
  expect(Team.getNextVersion()).toBe('0.1.0')
})

test('Team 0.1.0-alpha.1 Bumps.Final', () => {
  const Team = new Team('0.1.0-alpha.1', false, Bumps.final)
  expect(Team.getNextVersion()).toBe('0.1.0')
})

test('Team 1.0.0 bump=major test', () => {
  const Team = new Team('1.0.0', false, Bumps.major)
  expect(Team.getNextVersion()).toBe('2.0.0')
})

test('Team 1.0.0 bump=minor test', () => {
  const Team = new Team('1.0.0', false, Bumps.minor)
  expect(Team.getNextVersion()).toBe('1.1.0')
})

test('Team 1.0.0 bump=patch test', () => {
  const Team = new Team('1.0.0', false, Bumps.patch)
  expect(Team.getNextVersion()).toBe('1.0.1')
})

test('Team Invalid Team Error test', () => {
  try {
    const Team = new Team('1.0.0', false)
    Team.getNextVersion()
  } catch (err) {
    expect(err.toString()).toEqual(
      'Error: Invalid Team Operation: At least one of Bump or PreRelease has to be defined or IsFirstRelease must be true'
    )
  }
})

test('Team Invalid Bumps.final Error test', () => {
  try {
    const Team = new Team('1.0.0', false, Bumps.final)
    Team.getNextVersion()
  } catch (err) {
    expect(err.toString()).toEqual(
      'Error: Invalid Team Operation: Cannot do Bump Final and not have the previous release as a PreRelease'
    )
  }
})
*/
/*
// shows how the runner will run a javascript action with env / stdout protocol
test('test bump major', () => {
  process.env['INPUT_BUMP'] = 'major'
  process.env['INPUT_INITIAL_VERSION'] = '0.0.1'

  const np = process.execPath
  const ip = path.join(__dirname, '..', 'lib', 'main.js')
  try {
    const options: cp.ExecFileSyncOptions = {
      env: process.env
    }
    console.log(cp.execFileSync(np, [ip], options).toString())
  } catch (err) {
    expect(err).toBeInstanceOf(Error)
  }
})


test('test bump minor', () => {
  process.env['INPUT_BUMP'] = 'minor'
  process.env['INPUT_INITIAL_VERSION'] = '0.1.1'

  const np = process.execPath
  const ip = path.join(__dirname, '..', 'lib', 'main.js')
  try {
    const options: cp.ExecFileSyncOptions = {
      env: process.env
    }
    console.log(cp.execFileSync(np, [ip], options).toString())
  } catch (err) {
    expect(err).toBeInstanceOf(Error)
  }
})

test('test bump patch', () => {
  process.env['INPUT_BUMP'] = 'patch'
  process.env['INPUT_INITIAL_VERSION'] = '0.1.1'
  const np = process.execPath
  const ip = path.join(__dirname, '..', 'lib', 'main.js')
  try {
    const options: cp.ExecFileSyncOptions = {
      env: process.env
    }
    console.log(cp.execFileSync(np, [ip], options).toString())
  } catch (err) {
    expect(err).toBeInstanceOf(Error)
  }
})

test('test bump invalid', () => {
  process.env['INPUT_BUMP'] = 'ssss'
  process.env['INPUT_INITIAL_VERSION'] = '0.1.1'
  const np = process.execPath
  const ip = path.join(__dirname, '..', 'lib', 'main.js')
  try {
    const options: cp.ExecFileSyncOptions = {
      env: process.env
    }
    console.log(cp.execFileSync(np, [ip], options).toString())
  } catch (err) {
    console.log(err)
    expect(err).toBeDefined
  }
})
*/
