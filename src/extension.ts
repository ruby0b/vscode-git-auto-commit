import * as vscode from "vscode";
import path from 'path';
import { API, Change, GitExtension, Repository, Status } from "./git.d.js";

function translateStatus(type: Status): "modify" | "create" | "delete" | null {
	switch (type) {
		case Status.INDEX_MODIFIED:
		case Status.MODIFIED:
			return 'modify';
		case Status.INDEX_ADDED:
		case Status.INTENT_TO_ADD:
			return 'create';
		case Status.INDEX_DELETED:
		case Status.DELETED:
			return 'delete';
		case Status.INDEX_RENAMED:
		case Status.INTENT_TO_RENAME:
		// return 'R';
		case Status.TYPE_CHANGED:
		// return 'T';
		case Status.UNTRACKED:
		// return 'U';
		case Status.IGNORED:
		// return 'I';
		case Status.DELETED_BY_THEM:
		// return 'D';
		case Status.DELETED_BY_US:
		// return 'D';
		case Status.INDEX_COPIED:
		// return 'C';
		case Status.BOTH_DELETED:
		case Status.ADDED_BY_US:
		case Status.ADDED_BY_THEM:
		case Status.BOTH_ADDED:
		case Status.BOTH_MODIFIED:
		// return '!';
		default:
			return null;
	}
}

function onChange(git: API, document: vscode.TextDocument) {
	if (git.repositories.some((repo: Repository) => repo.state.indexChanges.length > 0)) {
		return;
	}

	let maybeFoundRepo: Repository | null = null;
	let maybeFoundChange: Change | null = null;
	for (const repo of git.repositories) {
		for (const change of repo.state.workingTreeChanges) {
			if (document.uri.fsPath === change.uri.path) {
				maybeFoundRepo = repo;
				maybeFoundChange = change;
			}
		}
	}
	if (maybeFoundRepo === null || maybeFoundChange === null) {
		return;
	}

	const repo = maybeFoundRepo;
	const change = maybeFoundChange;

	// Check if the status is in the list of events to trigger on
	const status = translateStatus(change.status);
	if (status === null || !vscode.workspace.getConfiguration("git-auto-commit").get("events", [] as string[]).includes(status)) {
		return;
	}

	const relativePath = path.relative(repo.rootUri.path, change.uri.path);
	repo.add([change.uri.fsPath]).then(() => {
		maybeFoundRepo?.commit("Modified: " + relativePath).then(() => {
			vscode.commands.executeCommand("git.sync");
		});
	});
}


export function activate(context: vscode.ExtensionContext) {
	const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');
	if (!gitExtension) {
		vscode.window.showErrorMessage("Git extension not found.");
		return;
	}
	const git = gitExtension.exports.getAPI(1);

	context.subscriptions.push(
		vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => onChange(git, document))
	);
}

export function deactivate() { }
