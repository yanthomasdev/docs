import * as core from '@actions/core';
import * as github from '@actions/github';
import { createLunaria } from '@lunariajs/core';
import { markdownTable } from 'markdown-table';
import {
	body,
	commentSummary,
	notes,
	overviewTracked,
	overviewUntracked,
	trackedFilesDetails,
	warnings,
} from './comment.js';
import type { Files, PullRequest } from './types.js';

type LunariaInstance = Awaited<ReturnType<typeof createLunaria>>;

/**
 * Sets the current working directory to the one specified by the `working-directory` input.
 * Necessary to allow for monorepo support.
 */
function setWorkingDirectory(workingDirectory?: string) {
	if (workingDirectory) {
		try {
			process.chdir(workingDirectory);
			core.debug('Working directory: ' + workingDirectory);
			core.debug(process.cwd());
		} catch {
			core.setFailed(
				`Failed to change working directory to ${workingDirectory}. Is the path correct?`
			);
			process.exit(1);
		}
	}
}

/**
 * Collapses a filename to only its non-base part.
 */
function collapseFilename(filename: string) {
	const basesToHide = ['src/content/docs/', 'src/i18n/'];

	if (!basesToHide) return filename;

	for (const base of basesToHide) {
		const newFilename = filename.replace(base, '');

		if (newFilename === filename) continue;
		return newFilename;
	}

	return filename;
}

/**
 * Removes the root directory of a given filename.
 * This is necessary since Lunaria's glob patterns are based on the cwd
 * and won't account for the root directory by default.
 */
function unrootFilename(root: string, filename: string) {
	if (root === '.') return filename;
	const rootDir = `${root}/`;

	if (filename.startsWith(rootDir)) return filename.replace(rootDir, '');
	return filename;
}

function getStatusOverview(title: string, ignoreKeywords: string[]) {
	const IGNORE_KEYWORDS = new RegExp(`(${ignoreKeywords.join('|')})`, 'i');
	const match = title.match(IGNORE_KEYWORDS)?.at(0);

	return {
		overview: match ? overviewUntracked(match) : overviewTracked,
		isIgnored: !!match,
	};
}

async function getTrackedFilesTable(
	pullRequest: PullRequest,
	trackedFiles: Files,
	lunaria: LunariaInstance,
	isIgnored: boolean
) {
	const { repository } = lunaria.config;
	const rows: string[][] = [];

	for (const file of trackedFiles) {
		const foundWarnings: Array<keyof typeof warnings> = [];

		const rootlessFilename = unrootFilename(repository.rootDir, file.filename);
		const collapsedPath = collapseFilename(rootlessFilename);

		core.debug(`Checking file: ${rootlessFilename}`);

		const statusType = (status: Files[number]['status']) => {
			// It might be necessary to rethink these according to how Git
			// handles the different statuses.
			switch (status) {
				case 'renamed':
				case 'copied':
					return 'added';
				case 'modified':
					return 'changed';
				default:
					return status;
			}
		};

		const fullStatus = await lunaria.getFullStatus();

		try {
			const fileStatus = fullStatus.find(
				(f) =>
					f.source.path === rootlessFilename ||
					f.localizations.findIndex((l) => l.path === rootlessFilename) !== -1
			);
			core.debug(fileStatus?.toString() ?? 'undefined');
			core.debug("File's status: " + fileStatus?.toString());
			core.debug("File's status: " + fileStatus?.source?.path);
			const isSourceLocale = fileStatus?.source?.path === rootlessFilename;

			const createdDate = new Date(pullRequest.created_at);
			// Don't go after the latest source change if the source file is part of the PR, assume creation date of PR.
			// If it wasn't possible to find the latest source change date, we assume it isn't possibly outdated.
			const latestSourceChange = !isSourceLocale
				? new Date(fileStatus?.source?.git?.latestTrackedChange?.date ?? Date.now())
				: createdDate;

			if (latestSourceChange > createdDate) foundWarnings.push('outdated');

			const warningIcons = foundWarnings.map((k) => warnings[k].icon).join(' ');
			const key =
				`${isSourceLocale ? 'source' : 'localization'}-${statusType(file.status)}` as const;
			const note = `${notes[key]} ${warningIcons}`;

			rows.push([`[${collapsedPath}](${file.blob_url})`, note]);
		} catch (e) {
			core.setFailed(`Error while processing file: ${rootlessFilename}`);
			if (e instanceof Error) core.error(e);
		}
	}

	const filesTable = markdownTable([['File', 'Note'], ...rows]);
	const warningsTable = markdownTable([
		['Icon', 'Description'],
		...Object.values(warnings).map(({ icon, description }) => [icon, description]),
	]);

	return trackedFilesDetails(filesTable, warningsTable, isIgnored);
}

async function main() {
	const context = github.context;
	const payload = context.payload;

	if (!payload.pull_request) {
		core.notice('Skipped, could not find the pull request context.');
		return;
	}

	if (!payload.repository) {
		core.notice('Skipped, could not find pull request repository.');
		return;
	}

	if (payload.action !== 'opened' && payload.action !== 'synchronize') {
		core.notice('Skipped, Lunaria action only runs during pull request opening/synchronization.');
		return;
	}

	const githubToken = core.getInput('token');
	const octokit = github.getOctokit(githubToken);

	const workingDirectory = core.getInput('working-directory');
	setWorkingDirectory(workingDirectory);

	const lunaria = await createLunaria({
		config: {
			repository: {
				name: 'withastro/docs',
			},
			sourceLocale: {
				label: 'English',
				lang: 'en',
				parameters: {
					tag: 'en',
				},
			},
			locales: [
				{
					label: 'العربية',
					lang: 'ar',
					parameters: {
						tag: 'ar',
					},
				},
				{
					label: 'Deutsch',
					lang: 'de',
					parameters: {
						tag: 'de',
					},
				},
				{
					label: 'Español',
					lang: 'es',
					parameters: {
						tag: 'es',
					},
				},
				{
					label: 'Français',
					lang: 'fr',
					parameters: {
						tag: 'fr',
					},
				},
				{
					label: 'हिन्दी',
					lang: 'hi',
					parameters: {
						tag: 'hi',
					},
				},
				{
					label: 'Italiano',
					lang: 'it',
					parameters: {
						tag: 'it',
					},
				},
				{
					label: '日本語',
					lang: 'ja',
					parameters: {
						tag: 'ja',
					},
				},
				{
					label: '한국어',
					lang: 'ko',
					parameters: {
						tag: 'ko',
					},
				},
				{
					label: 'Polski',
					lang: 'pl',
					parameters: {
						tag: 'pl',
					},
				},
				{
					label: 'Português do Brasil',
					lang: 'pt-br',
					parameters: {
						tag: 'pt-BR',
					},
				},
				{
					label: 'Русский',
					lang: 'ru',
					parameters: {
						tag: 'ru',
					},
				},
				{
					label: '简体中文',
					lang: 'zh-cn',
					parameters: {
						tag: 'zh-CN',
					},
				},
				{
					label: '正體中文',
					lang: 'zh-tw',
					parameters: {
						tag: 'zh-TW',
					},
				},
			],
			files: [
				{
					include: ['src/content/i18n/en.yml'],
					pattern: 'src/content/i18n/@tag.yml',
					type: 'dictionary',
				},
				{
					include: ['src/i18n/en/nav.ts'],
					pattern: 'src/i18n/@lang/@path',
					type: 'universal',
				},
				{
					include: ['src/content/docs/en/**/*.(md|mdx)'],
					pattern: 'src/content/docs/@lang/@path',
					type: 'universal',
				},
			],
			tracking: {
				localizableProperty: 'i18nReady',
				ignoredKeywords: [
					'lunaria-ignore',
					'typo',
					'en-only',
					'broken link',
					'i18nReady',
					'i18nIgnore',
				],
			},
		},
	});
	const config = lunaria.config;

	const pullRequestContext = {
		...context.repo,
		pull_number: payload.pull_request.number,
		issue_number: payload.pull_request.number,
	};

	const { data: pullRequest } = await octokit.rest.pulls.get(pullRequestContext);

	const pullRequestFiles = await octokit.paginate(
		octokit.rest.pulls.listFiles,
		{
			...pullRequestContext,
			per_page: 100,
		},
		(response) => response.data
	);

	const trackedFiles = pullRequestFiles.filter((file) =>
		lunaria.findFileConfig(unrootFilename(config.repository.rootDir, file.filename))
	);

	if (!trackedFiles.length) {
		core.notice("This pull request doesn't include any tracked files.");
		return;
	}

	const { overview, isIgnored } = getStatusOverview(
		pullRequest.title,
		config.tracking.ignoredKeywords
	);
	const trackedFilesTable = await getTrackedFilesTable(
		pullRequest,
		trackedFiles,
		lunaria,
		isIgnored
	);

	await commentSummary(octokit, pullRequestContext, body(overview, trackedFilesTable));
}

main().catch((e) => {
	core.setFailed(e.message);
});
