### Sample WorkFlow File 

```yml
name: Update work item state when PR is merged, opened, closed or when branch is created

on:
   pull_request:
    branches: [master]
    types: [opened, closed, edited]
   push:
    branches: [master]

jobs:
  alert:
    runs-on: ubuntu-latest
    name: Test workflow
    steps:       
    - uses: samcarswell/pr-update-work-item-state@master
      env: 
        gh_token : '${{ secrets.GH_TOKEN }}'   
        ado_token: '${{ secrets.ADO_PERSONAL_ACCESS_TOKEN }}'
        ado_organization: '${{ secrets.ADO_ORGANIZATION }}'
        ado_project: '${{ secrets.ADO_PROJECT }}'
        closedstate: 'Done'
        propenstate: 'Ready'
        inprogressstate: 'In Progress' 
        ghrepo_owner: 'Contoso'
        ghrepo: 'Contoso-Microservice'
        pull_number: ${{github.event.number}} 
        branch_name: ${{ github.ref }}
        title_exclusions: ['Code cleanup', 'Swagger update'] # TODO: implement and test this
        include_body: true # TODO: not sure what this is: remove it? 

```

