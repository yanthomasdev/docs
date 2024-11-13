import type { Octokit } from './types.js';
export declare const overviewTracked = "\n\uD83C\uDF15 **This pull request will trigger status changes.**\n\n<details>\n<summary>Learn more</summary>\n\nBy default, every PR changing files present in the [Lunaria configuration's `files` property](https://lunaria.dev/reference/configuration/#files-required) will be considered and trigger status changes accordingly.\n\nYou can change this by adding one of the keywords present in the [`ignoreKeywords` property in your Lunaria configuration file](https://lunaria.dev/reference/configuration/#ignorekeywords) in the PR's title (ignoring all files) or by [including a tracker directive](https://lunaria.dev/guides/tracking/#tracker-directives) in the merged commit's description. \n</details>";
export declare const overviewUntracked: (match: string) => string;
export declare const tableIgnoredWarning = "\n> [!NOTE]  \n> The notes below indicate what would happen if the pull request is merged when triggering status changes. Since a ignored keyword was found in the PR's title, the status changes indicated below won't be applied.\n";
export declare const trackedFilesDetails: (filesTable: string, warningsTable: string, isIgnored: boolean) => string;
export declare const notes: {
    'source-added': string;
    'source-removed': string;
    'source-changed': string;
    'source-unchanged': string;
    'localization-added': string;
    'localization-removed': string;
    'localization-changed': string;
    'localization-unchanged': string;
};
export declare const warnings: {
    outdated: {
        icon: string;
        description: string;
    };
};
export declare const body: (overview: string, trackedFiles: string) => string;
export declare function commentSummary(octokit: Octokit, issue: {
    repo: string;
    owner: string;
    issue_number: number;
}, body: string): Promise<void>;
export declare function findExistingCommentId(octokit: Octokit, issue: {
    repo: string;
    owner: string;
    issue_number: number;
}): Promise<number | undefined>;
