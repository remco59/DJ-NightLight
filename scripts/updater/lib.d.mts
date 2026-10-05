export function toHttpsRemote(remote: string | null | undefined): string | null
export function gitAuthConfig(httpsRemote: string | null, token: string): [string, string][]
export const COMMIT_FORMAT: string
export function parseCommits(output: string): { sha: string, shortSha: string, subject: string, author: string, date: string }[]
export function servicesToUpdate(allServices: string, ownService: string): string[]
export function redact(text: string, secrets: (string | null | undefined | false)[]): string
export const MAINTENANCE_PHASES: Set<string>
export const BUSY_PHASES: Set<string>
