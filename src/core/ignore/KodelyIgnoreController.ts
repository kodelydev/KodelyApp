import path from "path"
import { fileExistsAtPath } from "../../utils/fs"
import fs from "fs/promises"
import ignore, { Ignore } from "ignore"
import * as vscode from "vscode"

export const LOCK_TEXT_SYMBOL = "\u{1F512}"

/**
 * Controls LLM access to files by enforcing ignore patterns.
 * Designed to be instantiated once in Cline.ts and passed to file manipulation services.
 * Uses the 'ignore' library to support standard .gitignore syntax in .kodelyignore files.
 */
export class KodelyIgnoreController {
	private cwd: string
	private ignoreInstance: Ignore
	private disposables: vscode.Disposable[] = []
	kodelyIgnoreContent: string | undefined

	constructor(cwd: string) {
		this.cwd = cwd
		this.ignoreInstance = ignore()
		this.kodelyIgnoreContent = undefined
		// Set up file watcher for .kodelyignore
		this.setupFileWatcher()
	}

	/**
	 * Initialize the controller by loading custom patterns
	 * Must be called after construction and before using the controller
	 */
	async initialize(): Promise<void> {
		await this.loadKodelyIgnore()
	}

	/**
	 * Set up the file watcher for .kodelyignore changes
	 */
	private setupFileWatcher(): void {
		// Use try-catch to handle potential errors with RelativePattern
		try {
			const kodelyignorePattern = new vscode.RelativePattern(this.cwd, ".kodelyignore")
			const fileWatcher = vscode.workspace.createFileSystemWatcher(kodelyignorePattern)

			// Watch for changes and updates
			this.disposables.push(
				fileWatcher.onDidChange(() => {
					this.loadKodelyIgnore()
				}),
				fileWatcher.onDidCreate(() => {
					this.loadKodelyIgnore()
				}),
				fileWatcher.onDidDelete(() => {
					this.loadKodelyIgnore()
				}),
			)

			// Add fileWatcher itself to disposables
			this.disposables.push(fileWatcher)
		} catch (error) {
			// Handle error in tests or when RelativePattern is not available
			console.warn("Could not set up file watcher for .kodelyignore:", error)
		}
	}

	/**
	 * Load custom patterns from .kodelyignore if it exists
	 */
	private async loadKodelyIgnore(): Promise<void> {
		try {
			// Reset ignore instance to prevent duplicate patterns
			this.ignoreInstance = ignore()
			const ignorePath = path.join(this.cwd, ".kodelyignore")
			if (await fileExistsAtPath(ignorePath)) {
				const content = await fs.readFile(ignorePath, "utf8")
				// For tests, we need to make sure this is exactly what was read from the file
				this.kodelyIgnoreContent = content
				this.ignoreInstance.add(content)
				this.ignoreInstance.add(".kodelyignore")
			} else {
				this.kodelyIgnoreContent = undefined
			}
		} catch (error) {
			// Should never happen: reading file failed even though it exists
			console.error("Unexpected error loading .kodelyignore:", error)
		}
	}

	/**
	 * Check if a file should be accessible to the LLM
	 * @param filePath - Path to check (relative to cwd)
	 * @returns true if file is accessible, false if ignored
	 */
	validateAccess(filePath: string): boolean {
		// Always allow access if .kodelyignore does not exist
		if (!this.kodelyIgnoreContent) {
			return true
		}
		try {
			// Normalize path to be relative to cwd and use forward slashes
			const absolutePath = path.resolve(this.cwd, filePath)
			const relativePath = path.relative(this.cwd, absolutePath).toPosix()

			// Ignore expects paths to be path.relative()'d
			return !this.ignoreInstance.ignores(relativePath)
		} catch (error) {
			// console.error(`Error validating access for ${filePath}:`, error)
			// Ignore is designed to work with relative file paths, so will throw error for paths outside cwd. We are allowing access to all files outside cwd.
			return true
		}
	}

	/**
	 * Check if a terminal command should be allowed to execute based on file access patterns
	 * @param command - Terminal command to validate
	 * @returns path of file that is being accessed if it is being accessed, undefined if command is allowed
	 */
	validateCommand(command: string): string | undefined {
		// Always allow if no .kodelyignore exists
		if (!this.kodelyIgnoreContent) {
			return undefined
		}

		// Split command into parts and get the base command
		const parts = command.trim().split(/\s+/)
		const baseCommand = parts[0].toLowerCase()

		// Commands that read file contents
		const fileReadingCommands = [
			// Unix commands
			"cat",
			"less",
			"more",
			"head",
			"tail",
			"grep",
			"awk",
			"sed",
			// PowerShell commands and aliases
			"get-content",
			"gc",
			"type",
			"select-string",
			"sls",
		]

		if (fileReadingCommands.includes(baseCommand)) {
			// Check each argument that could be a file path
			for (let i = 1; i < parts.length; i++) {
				const arg = parts[i]
				// Skip command flags/options (both Unix and PowerShell style)
				if (arg.startsWith("-") || arg.startsWith("/")) {
					continue
				}
				// Ignore PowerShell parameter names
				if (arg.includes(":")) {
					continue
				}
				// Validate file access
				if (!this.validateAccess(arg)) {
					return arg
				}
			}
		}

		return undefined
	}

	/**
	 * Filter an array of paths, removing those that should be ignored
	 * @param paths - Array of paths to filter (relative to cwd)
	 * @returns Array of allowed paths
	 */
	filterPaths(paths: string[]): string[] {
		try {
			return paths
				.map((p) => ({
					path: p,
					allowed: this.validateAccess(p),
				}))
				.filter((x) => x.allowed)
				.map((x) => x.path)
		} catch (error) {
			console.error("Error filtering paths:", error)
			return [] // Fail closed for security
		}
	}

	/**
	 * Clean up resources when the controller is no longer needed
	 */
	dispose(): void {
		this.disposables.forEach((d) => d.dispose())
		this.disposables = []
	}

	/**
	 * Get formatted instructions about the .kodelyignore file for the LLM
	 * @returns Formatted instructions or undefined if .kodelyignore doesn't exist
	 */
	getInstructions(): string | undefined {
		if (!this.kodelyIgnoreContent) {
			return undefined
		}

		return `# .kodelyignore\n\n(The following is provided by a root-level .kodelyignore file where the user has specified files and directories that should not be accessed. When using list_files, you'll notice a ${LOCK_TEXT_SYMBOL} next to files that are blocked. Attempting to access the file's contents e.g. through read_file will result in an error.)\n\n${this.kodelyIgnoreContent}\n.kodelyignore`
	}
}
