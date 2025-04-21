import fs from "fs/promises"
import path from "path"
import { KodelyIgnoreController, LOCK_TEXT_SYMBOL } from "../KodelyIgnoreController"
import * as vscode from "vscode"

// Mock fs/promises
jest.mock("fs/promises", () => ({
	readFile: jest.fn(),
}))

// Mock path
jest.mock("path", () => ({
	join: jest.fn((dir, file) => `${dir}/${file}`),
	resolve: jest.fn((dir, file) => `${dir}/${file}`),
	relative: jest.fn((dir, file) => {
		// Simple implementation for test cases
		if (file.startsWith(dir)) {
			return file.substring(dir.length + 1)
		}
		return file
	}),
}))

// Mock vscode
jest.mock("vscode", () => ({
	workspace: {
		createFileSystemWatcher: jest.fn(() => ({
			onDidChange: jest.fn(() => ({ dispose: jest.fn() })),
			onDidCreate: jest.fn(() => ({ dispose: jest.fn() })),
			onDidDelete: jest.fn(() => ({ dispose: jest.fn() })),
			dispose: jest.fn(),
		})),
	},
	RelativePattern: jest.fn(),
}))

// Mock fileExistsAtPath
jest.mock("../../../utils/fs", () => ({
	fileExistsAtPath: jest.fn(),
}))

// Import the mocked function
import { fileExistsAtPath } from "../../../utils/fs"

describe("KodelyIgnoreController", () => {
	const TEST_CWD = "/test/path"
	let controller: KodelyIgnoreController

	// Type the mocks
	const mockFileExists = fileExistsAtPath as jest.MockedFunction<typeof fileExistsAtPath>
	const mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>
	const mockRelativePattern = vscode.RelativePattern as jest.Mock
	const mockCreateFileSystemWatcher = vscode.workspace.createFileSystemWatcher as jest.MockedFunction<
		typeof vscode.workspace.createFileSystemWatcher
	>

	beforeEach(() => {
		// Reset all mocks
		jest.clearAllMocks()

		// Default mock implementations
		mockFileExists.mockResolvedValue(true)
		mockReadFile.mockResolvedValue("node_modules\n.git\nsecrets.json")
		mockRelativePattern.mockImplementation((base, pattern) => ({ base, pattern } as any))
	})

	describe("constructor", () => {
		it("should initialize correctly", () => {
			// Create controller
			controller = new KodelyIgnoreController(TEST_CWD)

			// Verify file watcher was set up
			expect(mockRelativePattern).toHaveBeenCalledWith(TEST_CWD, ".kodelyignore")
			expect(mockCreateFileSystemWatcher).toHaveBeenCalled()
		})
	})

	describe("initialize", () => {
		it("should load .kodelyignore file if it exists", async () => {
			// Create controller
			controller = new KodelyIgnoreController(TEST_CWD)

			// Initialize controller
			await controller.initialize()

			// Verify file was checked and read
			expect(mockFileExists).toHaveBeenCalledWith(`${TEST_CWD}/.kodelyignore`)
			expect(mockReadFile).toHaveBeenCalledWith(`${TEST_CWD}/.kodelyignore`, "utf8")

			// Verify content was stored
			expect(controller.kodelyIgnoreContent).toBe("node_modules\n.git\nsecrets.json")
		})

		it("should handle missing .kodelyignore file", async () => {
			// Mock file doesn't exist
			mockFileExists.mockResolvedValue(false)

			// Create controller
			controller = new KodelyIgnoreController(TEST_CWD)

			// Initialize controller
			await controller.initialize()

			// Verify file was checked but not read
			expect(mockFileExists).toHaveBeenCalledWith(`${TEST_CWD}/.kodelyignore`)
			expect(mockReadFile).not.toHaveBeenCalled()

			// Verify no content was stored
			expect(controller.kodelyIgnoreContent).toBeUndefined()
		})
	})

	describe("validateAccess", () => {
		beforeEach(async () => {
			// Create and initialize controller
			controller = new KodelyIgnoreController(TEST_CWD)
			await controller.initialize()
		})

		it("should allow access to non-ignored files", () => {
			// Test with a file that's not in the ignore list
			const result = controller.validateAccess("src/index.ts")
			expect(result).toBe(true)
		})

		it("should deny access to ignored files", () => {
			// Test with files that are in the ignore list
			expect(controller.validateAccess("node_modules/package/index.js")).toBe(false)
			expect(controller.validateAccess(".git/HEAD")).toBe(false)
			expect(controller.validateAccess("secrets.json")).toBe(false)
		})

		it("should allow access to all files if .kodelyignore doesn't exist", async () => {
			// Mock file doesn't exist for this test
			mockFileExists.mockResolvedValue(false)

			// Create a new controller with no .kodelyignore
			mockFileExists.mockResolvedValue(false)
			const emptyController = new KodelyIgnoreController(TEST_CWD)
			await emptyController.initialize()

			// All files should be allowed
			expect(emptyController.validateAccess("node_modules/package/index.js")).toBe(true)
			expect(emptyController.validateAccess(".git/HEAD")).toBe(true)
			expect(emptyController.validateAccess("secrets.json")).toBe(true)
		})

		it("should handle paths outside of cwd", () => {
			// Test with absolute paths outside of cwd
			const result = controller.validateAccess("/usr/bin/node")
			expect(result).toBe(true)
		})
	})

	describe("validateCommand", () => {
		beforeEach(async () => {
			// Create and initialize controller
			controller = new KodelyIgnoreController(TEST_CWD)
			await controller.initialize()
		})

		it("should allow commands that don't access files", () => {
			// Test with commands that don't access files
			expect(controller.validateCommand("ls")).toBeUndefined()
			expect(controller.validateCommand("pwd")).toBeUndefined()
			expect(controller.validateCommand("echo hello")).toBeUndefined()
		})

		it("should allow commands that access non-ignored files", () => {
			// Test with commands that access non-ignored files
			expect(controller.validateCommand("cat src/index.ts")).toBeUndefined()
			expect(controller.validateCommand("less README.md")).toBeUndefined()
			expect(controller.validateCommand("grep 'test' src/app.js")).toBeUndefined()
		})

		it("should deny commands that access ignored files", () => {
			// Test with commands that access ignored files
			expect(controller.validateCommand("cat node_modules/package.json")).toBe("node_modules/package.json")
			expect(controller.validateCommand("less .git/HEAD")).toBe(".git/HEAD")
			expect(controller.validateCommand("grep 'password' secrets.json")).toBe("secrets.json")
		})

		it("should handle commands with options", () => {
			// Test with commands that have options
			expect(controller.validateCommand("cat -n src/index.ts")).toBeUndefined()
			expect(controller.validateCommand("grep -r 'test' src/")).toBeUndefined()
			expect(controller.validateCommand("cat -n secrets.json")).toBe("secrets.json")
		})

		it("should handle PowerShell commands", () => {
			// Test with PowerShell commands
			expect(controller.validateCommand("Get-Content src/index.ts")).toBeUndefined()
			expect(controller.validateCommand("gc README.md")).toBeUndefined()
			expect(controller.validateCommand("Select-String 'test' src/app.js")).toBeUndefined()
			expect(controller.validateCommand("Get-Content secrets.json")).toBe("secrets.json")
		})

		it("should allow all commands if .kodelyignore doesn't exist", async () => {
			// Create a new controller with no .kodelyignore
			mockFileExists.mockResolvedValue(false)
			const emptyController = new KodelyIgnoreController(TEST_CWD)
			await emptyController.initialize()

			// All commands should be allowed
			expect(emptyController.validateCommand("cat node_modules/package.json")).toBeUndefined()
			expect(emptyController.validateCommand("less .git/HEAD")).toBeUndefined()
			expect(emptyController.validateCommand("grep 'password' secrets.json")).toBeUndefined()
		})
	})

	describe("filterPaths", () => {
		beforeEach(async () => {
			// Create and initialize controller
			controller = new KodelyIgnoreController(TEST_CWD)
			await controller.initialize()
		})

		it("should filter out ignored paths", () => {
			// Test with a mix of allowed and ignored paths
			const paths = [
				"src/index.ts",
				"node_modules/package/index.js",
				"README.md",
				".git/HEAD",
				"app.js",
				"secrets.json",
			]

			const filtered = controller.filterPaths(paths)

			// Verify only non-ignored paths are returned
			expect(filtered).toEqual(["src/index.ts", "README.md", "app.js"])
			expect(filtered).not.toContain("node_modules/package/index.js")
			expect(filtered).not.toContain(".git/HEAD")
			expect(filtered).not.toContain("secrets.json")
		})

		it("should return all paths if .kodelyignore doesn't exist", async () => {
			// Create a new controller with no .kodelyignore
			mockFileExists.mockResolvedValue(false)
			const emptyController = new KodelyIgnoreController(TEST_CWD)
			await emptyController.initialize()

			// Test with a mix of paths
			const paths = [
				"src/index.ts",
				"node_modules/package/index.js",
				"README.md",
				".git/HEAD",
				"app.js",
				"secrets.json",
			]

			const filtered = emptyController.filterPaths(paths)

			// Verify all paths are returned
			expect(filtered).toEqual(paths)
		})
	})

	describe("getInstructions", () => {
		beforeEach(async () => {
			// Create and initialize controller
			controller = new KodelyIgnoreController(TEST_CWD)
			await controller.initialize()
		})

		it("should return formatted instructions if .kodelyignore exists", () => {
			const instructions = controller.getInstructions()

			// Verify instructions format
			expect(instructions).toContain("# .kodelyignore")
			expect(instructions).toContain(LOCK_TEXT_SYMBOL)
			expect(instructions).toContain("node_modules\n.git\nsecrets.json")
		})

		it("should return undefined if .kodelyignore doesn't exist", async () => {
			// Create a new controller with no .kodelyignore
			mockFileExists.mockResolvedValue(false)
			const emptyController = new KodelyIgnoreController(TEST_CWD)
			await emptyController.initialize()

			// Verify no instructions are returned
			expect(emptyController.getInstructions()).toBeUndefined()
		})
	})

	describe("file watcher", () => {
		it("should update ignore patterns when .kodelyignore changes", async () => {
			// Create controller
			controller = new KodelyIgnoreController(TEST_CWD)

			// Get the file watcher callback
			const fileWatcherCallbacks = mockCreateFileSystemWatcher.mock.results[0].value

			// Verify initial state
			expect(controller.kodelyIgnoreContent).toBeUndefined()

			// Initialize controller
			await controller.initialize()

			// Simulate file change event
			mockReadFile.mockResolvedValue("node_modules")
			const onChangeCallback = fileWatcherCallbacks.onDidChange.mock.calls[0][0]
			await onChangeCallback()

			// Now verify content was updated
			// Note: We're using the mock implementation, so we need to check what was passed to mockReadFile
			expect(mockReadFile).toHaveBeenCalledWith(`${TEST_CWD}/.kodelyignore`, "utf8")
		})

		it("should update ignore patterns when .kodelyignore is created", async () => {
			// Mock file doesn't exist initially
			mockFileExists.mockResolvedValue(false)

			// Create controller
			controller = new KodelyIgnoreController(TEST_CWD)

			// Get the file watcher callback
			const fileWatcherCallbacks = mockCreateFileSystemWatcher.mock.results[0].value

			// Initialize controller
			await controller.initialize()

				// Verify initial state
				expect(controller.kodelyIgnoreContent).toBeUndefined()

			// Now mock that file exists and has content
			mockFileExists.mockResolvedValue(true)
			mockReadFile.mockResolvedValue("node_modules\n.git")

			// Simulate file create event
			const onCreateCallback = fileWatcherCallbacks.onDidCreate.mock.calls[0][0]
			await onCreateCallback()

			// Verify content was updated
			// Note: We're using the mock implementation, so we need to check what was passed to mockReadFile
			expect(mockReadFile).toHaveBeenCalledWith(`${TEST_CWD}/.kodelyignore`, "utf8")
		})

		it("should update ignore patterns when .kodelyignore is deleted", async () => {
			// Create controller
			controller = new KodelyIgnoreController(TEST_CWD)

			// Get the file watcher callback
			const fileWatcherCallbacks = mockCreateFileSystemWatcher.mock.results[0].value

			// Initialize controller
			await controller.initialize()

			// Now mock that file doesn't exist
			mockFileExists.mockResolvedValue(false)

			// Simulate file delete event
			const onDeleteCallback = fileWatcherCallbacks.onDidDelete.mock.calls[0][0]
			await onDeleteCallback()

			// Verify content was reset
			expect(controller.kodelyIgnoreContent).toBeUndefined()
		})
	})

	describe("dispose", () => {
		it("should dispose all disposables", () => {
			// Create controller
			controller = new KodelyIgnoreController(TEST_CWD)

			// Get the disposables
			const fileWatcher = mockCreateFileSystemWatcher.mock.results[0].value
			const onChangeDisposable = fileWatcher.onDidChange.mock.results[0].value
			const onCreateDisposable = fileWatcher.onDidCreate.mock.results[0].value
			const onDeleteDisposable = fileWatcher.onDidDelete.mock.results[0].value

			// Call dispose
			controller.dispose()

			// Verify all disposables were disposed
			expect(onChangeDisposable.dispose).toHaveBeenCalled()
			expect(onCreateDisposable.dispose).toHaveBeenCalled()
			expect(onDeleteDisposable.dispose).toHaveBeenCalled()
			expect(fileWatcher.dispose).toHaveBeenCalled()
		})
	})
})
