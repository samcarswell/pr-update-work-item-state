
const azureDevOpsHandler = require(`azure-devops-node-api`);
const core = require(`@actions/core`);
const github = require(`@actions/github`);
const fetch = require("node-fetch");
const version = "1.1.4"
global.Headers = fetch.Headers;
const azBoardsItemRegex = /(AB#)[0-9]*/g;

main();
async function main () {
	try {
	        console.log("VERSION " + version);

	        const context = github.context; 
	        let vm = getValuesFromPayload(github.context.payload);

		if (process.env.GITHUB_EVENT_NAME.includes("pull_request")){
			console.log("PR event detected");

			var prTitle = await getPrTitle();
			if (typeof(prTitle) != typeof(undefined) && (
				// TODO: this should be based on config in the yml
				prTitle.includes("Code cleanup") ||
				prTitle.includes("Swagger update"))) {
				console.log("Bot branches are not being checked towards Azure Boards");
				return;
			}
			
			// try {
				// TODO: put this back in once we get the body working
				// var workItemId = await getWorkItemIdFromPrTitle();
				// await updateWorkItem(workItemId);

				const workItems = await getWorkItemsFromPrBody();
				console.log('workitems')
				console.log(workItems)
				for (let i in workItems) {
					console.log('Updating workitem ' + workItems[i])
					await updateWorkItem(workItems[i]);
					console.log("Work item " + workItems[i] + " was updated successfully");
				}
				
			// } catch (err) {
			// 	core.setFailed("Couldn't get work item ID from PR title, adjust the PR title");
			// 	core.setFailed(err.toString());
			// }
		} else {
			console.log("Not implemented");
		}
	} catch (err) {
		core.setFailed(err.toString());
	}
}

function getRequestHeaders(){
	let h = new Headers();
	let auth = 'token ' + process.env.gh_token;
	h.append('Authorization', auth);
	return h;
}

async function getWorkItemsFromPrBody() {
	const pullRequestBody = await getPrBody();

	try {
		return pullRequestBody.match(azBoardsItemRegex);
		// foundMatches.forEach((item) => {
		// 	console.log("Work item ID: " + item);
		// });
		// return foundMatches;
	} catch (err) {
		core.setFailed("Azure boards tag not found in PR body");
	}
}

async function getPrBody() {
	try {
		console.log("Getting PR body");
		const requestUrl = "https://api.github.com/repos/"+process.env.ghrepo_owner+"/"+process.env.ghrepo+"/pulls/"+process.env.pull_number;

		const response = await fetch(requestUrl, {
			method: 'GET',
			headers: getRequestHeaders()
		});
		const result = await response.json();

		try {
			return result.body;
		} catch (err) {
			return "";
		}
	} catch (err) {
		core.setFailed(err.toString());
	}
}

async function getPrTitle() {
	try {
		console.log("Getting PR title");
		const requestUrl = "https://api.github.com/repos/"+process.env.ghrepo_owner+"/"+process.env.ghrepo+"/pulls/"+process.env.pull_number;
		
		const response = await fetch(requestUrl, {
			method: 'GET',
			headers: getRequestHeaders()
		});
		const result = await response.json();
		
		try {
			return result.title;
		} catch (err) {
			return "";
		}
	} catch (err) {
		core.setFailed(err.toString());
	}
}

async function isOpened() {
    try {   
        const requestUrl = "https://api.github.com/repos/"+process.env.ghrepo_owner+"/"+process.env.ghrepo+"/pulls/"+process.env.pull_number;    
        const response = await fetch (requestUrl, {
            method: 'GET', 
            headers: getRequestHeaders()
            })
        const result = await response.json();

        var pullRequestStatus = result.state;
        return pullRequestStatus == "open";
    } catch (err){
        core.setFailed(err.toString());
    }
}

async function isMerged() {
	try {
		const newRequestUrl = "https://api.github.com/repos/"+process.env.ghrepo_owner+"/"+process.env.ghrepo+"/pulls/"+process.env.pull_number+"/merge";    
		const mergeResponse = await fetch (newRequestUrl, {
			method: 'GET', 
			headers: getRequestHeaders()
		})

		var pullRequestStatus = mergeResponse.status;
		if (pullRequestStatus == "204") {
			return true;
		}

		return false;
	} catch (err) {
		core.setFailed(err.toString());
	}
}

async function isClosed() {
    try {   
        const requestUrl = "https://api.github.com/repos/"+process.env.ghrepo_owner+"/"+process.env.ghrepo+"/pulls/"+process.env.pull_number;    
        const response= await fetch (requestUrl, {
            method: 'GET', 
            headers: getRequestHeaders()
            })
        const result = await response.json();

        var pullRequestStatus = result.state;
        return pullRequestStatus == "closed";
    } catch (err){
        core.setFailed(err.toString());
    }
}

async function handleMergedPr(workItemId) {
	let authHandler = azureDevOpsHandler.getPersonalAccessTokenHandler(process.env.ado_token);
	let connection = new azureDevOpsHandler.WebApi("https://dev.azure.com/" + process.env.ado_organization, authHandler);
	let client = await connection.getWorkItemTrackingApi();
	
	let patchDocument = [
		{
			op: "add",
			path: "/fields/System.State",
			value: process.env.closedstate
		}
	];
	
	await client.updateWorkItem(
		(customHeaders = []),
		(document = patchDocument),
		(id = workItemId),
		(project = process.env.project),
		(validateOnly = false)
		);
}

async function handleOpenedPr(workItemId) {
	let authHandler = azureDevOpsHandler.getPersonalAccessTokenHandler(process.env.ado_token);
	let connection = new azureDevOpsHandler.WebApi("https://dev.azure.com/" + process.env.ado_organization, authHandler);
	let client = await connection.getWorkItemTrackingApi();
	
	let patchDocument = [
		{
			op: "add",
			path: "/fields/System.State",
			value: process.env.propenstate
		}
	];
	
	await client.updateWorkItem(
		(customHeaders = []),
		(document = patchDocument),
		(id = workItemId),
		(project = process.env.project),
		(validateOnly = false)
		);
}

async function handleClosedPr(workItemId) {
	let authHandler = azureDevOpsHandler.getPersonalAccessTokenHandler(process.env.ado_token);
	let connection = new azureDevOpsHandler.WebApi("https://dev.azure.com/" + process.env.ado_organization, authHandler);
	let client = await connection.getWorkItemTrackingApi();
	
	let patchDocument = [
		{
			op: "add",
			path: "/fields/System.State",
			value: process.env.inprogressstate
		}
	];
	
	await client.updateWorkItem(
		(customHeaders = []),
		(document = patchDocument),
		(id = workItemId),
		(project = process.env.project),
		(validateOnly = false)
		);	
}

async function handleOpenBranch(workItemId){
	let authHandler = azureDevOpsHandler.getPersonalAccessTokenHandler(process.env.ado_token);
	let connection = new azureDevOpsHandler.WebApi("https://dev.azure.com/" + process.env.ado_organization, authHandler);
	let client = await connection.getWorkItemTrackingApi();
	
	let patchDocument = [
		{
			op: "add",
			path: "/fields/System.State",
			value: process.env.inprogressstate
		}
	];
	
	await client.updateWorkItem(
		(customHeaders = []),
		(document = patchDocument),
		(id = workItemId),
		(project = process.env.project),
		(validateOnly = false)
		);	
}

function getIdFromAbTag(abTag) {
	return abTag.split('#')[1].trim()
}

// NOTE: since i'll be using three tasks with this action, I might be able to treat closedstate
// as the closed state for that specific branch. Eg. :
// Development: 
// - propenstate: Development Completed
// - closedstate: In Development
// UAT:
// - propenstate: Ready for testing
// - closedstate: UAT
// master:
// - propenstate: Resolved
// - closedstate: Closed
async function updateWorkItem(abTag) {
	let authHandler = azureDevOpsHandler.getPersonalAccessTokenHandler(process.env.ado_token);
	let connection = new azureDevOpsHandler.WebApi("https://dev.azure.com/" + process.env.ado_organization, authHandler);
	let client = await connection.getWorkItemTrackingApi();
	const workItemId = getIdFromAbTag(abTag)
	console.log('ABTAG: ', abTag)
	console.log("WorkItemId", workItemId)
	var workItem = await client.getWorkItem(workItemId);
	console.dir(workItem);
	console.log("Detected Work Item Type: " + workItem.fields["System.WorkItemType"])
	
	if (workItem.fields["System.State"] == process.env.closedstate)
	{
	    console.log("WorkItem is already in a state of closed and cannot be updated anymore.");
	    return;
	} else if (workItem.fields["System.State"] == process.env.propenstate && await isMerged() == false) {
	    console.log("WorkItem is already in a state of PR open, will not update.");
	    return;
	} else if (workItem.fields["System.WorkItemType"] == "Product Backlog Item") {
		console.log("Product backlog item is not going to be automatically updated - needs to be updated manually.")
	}
	else {        
	    if (await isMerged() == true) {
		console.log("PR IS MERGED");
		await handleMergedPr(workItemId);  
	    } else if (await isOpened() == true) {
		console.log("PR IS OPENED: " + process.env.propenstate);
		await handleOpenedPr(workItemId);
	    } else if (await isClosed() == true) {
		console.log("PR IS CLOSED: " + process.env.inprogressstate);
		await handleClosedPr(workItemId)
	    } else {
			console.log("Branch is not implemented")
	    }
	}
}

function getValuesFromPayload(payload)
{
   var vm = {
        action: payload.action != undefined ? payload.action : "",

        env : {
            organization: process.env.ado_organization != undefined ? process.env.ado_organization : "",
            orgurl: process.env.ado_organization != undefined ? "https://dev.azure.com/" + process.env.ado_organization : "",
            ado_token: process.env.ado_token != undefined ? process.env.ado_token : "",
            project: process.env.ado_project != undefined ? process.env.ado_project : "",
            ghrepo_owner: process.env.gh_repo_owner != undefined ? process.env.gh_repo_owner :"",
            ghrepo: process.env.gh_repo != undefined ? process.env.gh_repo :"",
            pull_number: process.env.pull_number != undefined ? process.env.pull_number :"",
            closedstate: process.env.closedstate != undefined ? process.env.closedstate :"",
            propenstate: process.env.propenstate != undefined ? process.env.propenstate :"",
            inprogressstate: process.env.inprogressstate != undefined ? process.env.inprogressstate :"",
            branch_name: process.env.branch_name != undefined ? process.env.branch_name :"",
	        gh_token: process.env.gh_token != undefined ? process.env.gh_token :""
        }
    }

    return vm;
}

module.exports = {getWorkItemsFromPrBody}