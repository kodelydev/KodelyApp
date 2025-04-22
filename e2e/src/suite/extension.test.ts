import * as assert from "assert"
import * as vscode from "vscode"

suite("Kodely Extension", () => {
	test("Commands should be registered", async () => {
		const expectedCommands = [
			"kodely-code.plusButtonClicked",
			"kodely-code.mcpButtonClicked",
			"kodely-code.historyButtonClicked",
			"kodely-code.popoutButtonClicked",
			"kodely-code.settingsButtonClicked",
			"kodely-code.openInNewTab",
			"kodely-code.explainCode",
			"kodely-code.fixCode",
			"kodely-code.improveCode",
		]

		const commands = await vscode.commands.getCommands(true)

		for (const cmd of expectedCommands) {
			assert.ok(commands.includes(cmd), `Command ${cmd} should be registered`)
		}
	})
})
