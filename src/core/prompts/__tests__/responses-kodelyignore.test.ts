import fs from "fs/promises"
import path from "path"
import { KodelyIgnoreController, LOCK_TEXT_SYMBOL } from "../../ignore/KodelyIgnoreController"
import * as vscode from "vscode"
import { formatListFilesResponse } from "../responses"

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

describe("KodelyIgnore Response Formatting", () => {
	const TEST_CWD = "/test/path"

	// Type the mocks
	const mockFileExists = fileExistsAtPath as jest.MockedFunction<typeof fileExistsAtPath>
	const mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>

	beforeEach(() => {
		// Reset all mocks
		jest.clearAllMocks()

		// Default mock implementations
		mockFileExists.mockResolvedValue(true)
		mockReadFile.mockResolvedValue("node_modules\n.git\nsecrets.json")
	})

	describe("formatListFilesResponse", () => {
		it("should mark ignored files with lock symbol", async () => {
			// Setup test data
			const files = [
				{
					name: "src",
					type: "directory",
					path: "src",
				},
				{
					name: "node_modules",
					type: "directory",
					path: "node_modules",
				},
				{
					name: "README.md",
					type: "file",
					path: "README.md",
				},
				{
					name: ".git",
					type: "directory",
					path: ".git",
				},
				{
					name: "secrets.json",
					type: "file",
					path: "secrets.json",
				},
			]

			// Create controller
			const controller = new KodelyIgnoreController(TEST_CWD)
			await controller.initialize()

			// Format response
			const result = formatListFilesResponse(files, controller)

			// Verify formatting
			expect(result).toContain("src/")
			expect(result).toContain(`node_modules/ ${LOCK_TEXT_SYMBOL}`)
			expect(result).toContain("README.md")
			expect(result).toContain(`.git/ ${LOCK_TEXT_SYMBOL}`)
			expect(result).toContain(`secrets.json ${LOCK_TEXT_SYMBOL}`)
		})

		it("should not mark any files when .kodelyignore doesn't exist", async () => {
			// Setup test data
			const files = [
				{
					name: "src",
					type: "directory",
					path: "src",
				},
				{
					name: "node_modules",
					type: "directory",
					path: "node_modules",
				},
				{
					name: "README.md",
					type: "file",
					path: "README.md",
				},
				{
					name: ".git",
					type: "directory",
					path: ".git",
				},
				{
					name: "secrets.json",
					type: "file",
					path: "secrets.json",
				},
			]

			// Create controller
			mockFileExists.mockResolvedValue(false)
			const controller = new KodelyIgnoreController(TEST_CWD)
			await controller.initialize()

			// Format response
			const result = formatListFilesResponse(files, controller)

			// Verify no lock symbols
			expect(result).toContain("src/")
			expect(result).toContain("node_modules/")
			expect(result).not.toContain(LOCK_TEXT_SYMBOL)
			expect(result).toContain("README.md")
			expect(result).toContain(".git/")
			expect(result).toContain("secrets.json")
		})

		it("should handle nested paths correctly", async () => {
			// Setup test data with nested paths
			const files = [
				{
					name: "index.js",
					type: "file",
					path: "node_modules/package/index.js",
				},
				{
					name: "README.md",
					type: "file",
					path: "node_modules/package/README.md",
				},
				{
					name: "config.js",
					type: "file",
					path: "src/config.js",
				},
			]

			// Create controller
			const controller = new KodelyIgnoreController(TEST_CWD)
			await controller.initialize()

			// Format response
			const result = formatListFilesResponse(files, controller)

			// Verify formatting of nested paths
			expect(result).toContain(`index.js ${LOCK_TEXT_SYMBOL}`)
			expect(result).toContain(`README.md ${LOCK_TEXT_SYMBOL}`)
			expect(result).toContain("config.js")
		})

		it("should handle empty file list", async () => {
			// Setup empty file list
			const files: any[] = []

			// Create controller
			const controller = new KodelyIgnoreController(TEST_CWD)
			await controller.initialize()

			// Format response
			const result = formatListFilesResponse(files, controller)

			// Verify empty result
			expect(result).toBe("No files found.")
		})

		it("should work without a controller", () => {
			// Setup test data
			const files = [
				{
					name: "src",
					type: "directory",
					path: "src",
				},
				{
					name: "node_modules",
					type: "directory",
					path: "node_modules",
				},
			]

			// Format response without controller
			const result = formatListFilesResponse(files)

			// Verify no lock symbols
			expect(result).toContain("src/")
			expect(result).toContain("node_modules/")
			expect(result).not.toContain(LOCK_TEXT_SYMBOL)
		})
	})
})
