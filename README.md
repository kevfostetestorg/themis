# Themis action

This is a **GitHub Action** for mediating org admin requests and applying policies for goverance to these requests.


## How it works

The action takes the following **inputs**:

- **issue_body_json**: Issue body from an Issue Forms based issue.
  
- **pat_token**: A personal access token with elevated permissions for doing Org admin activities

The action has the following **output**:

- **status**: The status of handling a particular request

## How to use

To use this **GitHub** Action you will need to complete the following:

1. You can use the example workflow below as a reference.
1. Have a step before calling this action to parse the `issue` body into a JSON. A good implementation is [Issue Forms Body Parser](https://github.com/peter-murray/issue-forms-body-parser)
2. Add the step in your workflow where you see fit to call this action. 
3. After the step, handle for failures or success scenarios. An example would be to update the `issue` with the status.

### Example connecting GitHub Action Workflow

In your repository you should have a `.github/workflows` folder with **GitHub** Action similar to below:

- `.github/workflows/test.yml`

This file should look like the following:

```yml
---
name: Sample Workflow

on:
  issues:
    types: [opened, reopened, labeled]    
jobs:
  test:
    name: Test Action
    if: contains(github.event.issue.labels.*.name, 'issueops')

    runs-on: ubuntu-20.04
    
    steps:
    - id: parse
      name: Run Issue form parser
      uses: peter-murray/issue-forms-body-parser@v2.0.0
      with:
        issue_id: ${{ github.event.issue.number }}
        separator: '###'
        label_marker_start: '>>'
        label_marker_end: '<<' 

    - name: Show parsed data JSON
      run: |
        echo "${{ steps.parse.outputs.payload }}"

    - name: Process the Request using Themis
      id: themis
      uses: decyjphr-actions/themis@HEAD
      with:
        issue_body_json: '${{ steps.parse.outputs.payload }}'
        pat_token: ${{secrets.pat_token}}
        
    - name: Process Failure
      if: ${{ failure() }}
      uses: actions/github-script@v5
      with:
        github-token: ${{ secrets.GITHUB_TOKEN }}
        script: |
          try { 
            await github.rest.issues.createComment({
            issue_number: context.issue.number,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: ':x: Sorry, your request could not be processed\n${{steps.themis.outputs.status}}'
            }) 
          } catch(err) {
            throw err
          }

    - name: Process Success
      uses: actions/github-script@v5
      with:
        github-token: ${{ secrets.GITHUB_TOKEN }}
        script: |
          try { 
            await github.rest.issues.createComment({
            issue_number: context.issue.number,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: ':white_check_mark: Congrats, your request has been processed\n${{steps.themis.outputs.status}}' 
            }) 
          } catch(err) {
            throw err
          }

```

## Limitations

Requires a token with elevated permissions

## How to contribute

If you would like to help contribute to this **GitHub** Action, please see [CONTRIBUTING](https://github.com/decyjphr-actions/themis/blob/master/.github/CONTRIBUTING.md)

---

### License

- [MIT License](https://github.com/decyjphr-actions/themis/blob/master/LICENSE)
