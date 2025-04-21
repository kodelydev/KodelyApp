import fs from "fs/promises"
import path from "path"
import { KodelyIgnoreController } from "../KodelyIgnoreController"
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

describe("KodelyIgnoreController Security Tests", () => {
	const TEST_CWD = "/test/path"
	let controller: KodelyIgnoreController

	// Type the mocks
	const mockFileExists = fileExistsAtPath as jest.MockedFunction<typeof fileExistsAtPath>
	const mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>

	beforeEach(() => {
		// Reset all mocks
		jest.clearAllMocks()

		// Default mock implementations
		mockFileExists.mockResolvedValue(true)
		mockReadFile.mockResolvedValue("node_modules\n.git\nsecrets.json\n.env\n**/*.key\n**/*.pem\n**/*password*\n**/*secret*")
	})

	describe("security patterns", () => {
		it("should block access to sensitive files", async () => {
			// Create and initialize controller
			controller = new KodelyIgnoreController(TEST_CWD)
			await controller.initialize()

			// Test with sensitive files
			expect(controller.validateAccess(".env")).toBe(false)
			expect(controller.validateAccess("config/server.key")).toBe(false)
			expect(controller.validateAccess("certs/private.pem")).toBe(false)
			expect(controller.validateAccess("config/password.txt")).toBe(false)
			expect(controller.validateAccess("api/secret_keys.json")).toBe(false)
		})

		it("should block commands accessing sensitive files", async () => {
			// Create and initialize controller
			controller = new KodelyIgnoreController(TEST_CWD)
			await controller.initialize()

			// Test with commands accessing sensitive files
			expect(controller.validateCommand("cat .env")).toBe(".env")
			expect(controller.validateCommand("less config/server.key")).toBe("config/server.key")
			expect(controller.validateCommand("cat certs/private.pem")).toBe("certs/private.pem")
			expect(controller.validateCommand("grep 'test' config/password.txt")).toBe("config/password.txt")
			expect(controller.validateCommand("cat api/secret_keys.json")).toBe("api/secret_keys.json")
		})

		it("should handle complex glob patterns", async () => {
			// Create and initialize controller with complex patterns
			// Note: The ignore library doesn't support complex glob patterns like {key,pem,env} in the same way as gitignore
			// So we'll use simpler patterns for testing
			mockReadFile.mockResolvedValue("**/*.key\n**/*.pem\n**/*.env\n**/secret*/**\n**/passwords/**")
			controller = new KodelyIgnoreController(TEST_CWD)
			await controller.initialize()

			// Test with files matching patterns
			expect(controller.validateAccess("any/path/file.key")).toBe(false)
			expect(controller.validateAccess("deep/nested/cert.pem")).toBe(false)
			expect(controller.validateAccess("config/local.env")).toBe(false)
			expect(controller.validateAccess("api/secret-keys/tokens.json")).toBe(false)
			expect(controller.validateAccess("data/passwords/hashed.db")).toBe(false)

			// Test with commands accessing these files
			expect(controller.validateCommand("cat any/path/file.key")).toBe("any/path/file.key")
			expect(controller.validateCommand("less deep/nested/cert.pem")).toBe("deep/nested/cert.pem")
			expect(controller.validateCommand("grep DB_PASSWORD config/local.env")).toBe("config/local.env")
		})
	})
})
