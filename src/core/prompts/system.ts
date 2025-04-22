import {
	Mode,
	modes,
	CustomModePrompts,
	PromptComponent,
	getRoleDefinition,
	defaultModeSlug,
	ModeConfig,
	getModeBySlug,
	getGroupName,
} from "../../shared/modes"
import { DiffStrategy } from "../../shared/tools"
import { McpHub } from "../../services/mcp/McpHub"
import { getToolDescriptionsForMode } from "./tools"
import * as vscode from "vscode"
import {
	getRulesSection,
	getSystemInfoSection,
	getObjectiveSection,
	getSharedToolUseSection,
	getMcpServersSection,
	getToolUseGuidelinesSection,
	getCapabilitiesSection,
	getModesSection,
	addCustomInstructions,
} from "./sections"
import { loadSystemPromptFile } from "./sections/custom-system-prompt"
import { formatLanguage } from "../../shared/language"
import { CostOptimizationLevel } from "../cost-optimization/CostOptimizationManager"

async function generatePrompt(
	context: vscode.ExtensionContext,
	cwd: string,
	supportsComputerUse: boolean,
	mode: Mode,
	mcpHub?: McpHub,
	diffStrategy?: DiffStrategy,
	browserViewportSize?: string,
	promptComponent?: PromptComponent,
	customModeConfigs?: ModeConfig[],
	globalCustomInstructions?: string,
	diffEnabled?: boolean,
	experiments?: Record<string, boolean>,
	enableMcpServerCreation?: boolean,
	language?: string,
	kodelyIgnoreInstructions?: string,
	optimizationLevel?: CostOptimizationLevel,
): Promise<string> {
	if (!context) {
		throw new Error("Extension context is required for generating system prompt")
	}

	// If diff is disabled, don't pass the diffStrategy
	const effectiveDiffStrategy = diffEnabled ? diffStrategy : undefined

	// Get the full mode config to ensure we have the role definition
	const modeConfig = getModeBySlug(mode, customModeConfigs) || modes.find((m) => m.slug === mode) || modes[0]
	const roleDefinition = promptComponent?.roleDefinition || modeConfig.roleDefinition

	const [modesSection, mcpServersSection] = await Promise.all([
		getModesSection(context),
		modeConfig.groups.some((groupEntry) => getGroupName(groupEntry) === "mcp")
			? getMcpServersSection(mcpHub, effectiveDiffStrategy, enableMcpServerCreation)
			: Promise.resolve(""),
	])

	const basePrompt = `${roleDefinition}

${getSharedToolUseSection()}

${getToolDescriptionsForMode(
	mode,
	cwd,
	supportsComputerUse,
	effectiveDiffStrategy,
	browserViewportSize,
	mcpHub,
	customModeConfigs,
	experiments,
)}

${getToolUseGuidelinesSection()}

${mcpServersSection}

${getCapabilitiesSection(cwd, supportsComputerUse, mcpHub, effectiveDiffStrategy)}

${modesSection}

${getRulesSection(cwd, supportsComputerUse, effectiveDiffStrategy, experiments)}

${getSystemInfoSection(cwd, mode, customModeConfigs)}

${getObjectiveSection()}

${await addCustomInstructions(promptComponent?.customInstructions || modeConfig.customInstructions || "", globalCustomInstructions || "", cwd, mode, { language: language ?? formatLanguage(vscode.env.language), kodelyIgnoreInstructions: kodelyIgnoreInstructions })}

${optimizationLevel ? getCostOptimizationInstructions(optimizationLevel) : ""}`

	return basePrompt
}

function getCostOptimizationInstructions(optimizationLevel: CostOptimizationLevel): string {
	switch (optimizationLevel) {
		case CostOptimizationLevel.HIGH:
			return `# Cost Optimization Instructions

You are operating in COST-FOCUSED mode. This means you should prioritize minimizing token usage over most other considerations, however the code still must be functional as instructed. Follow these guidelines:

1. Be extremely concise in your responses
2. Minimize the amount of code you generate
3. Focus on providing the most essential information only
4. Use local context retrieval when possible instead of requesting full files
5. Break complex tasks into smaller, more manageable chunks
6. Avoid unnecessary explanations unless specifically requested
7. Prioritize efficiency over verbosity in all interactions`
		case CostOptimizationLevel.BALANCED:
			return `# Cost Optimization Instructions

You are operating in BALANCED mode. This means you should maintain a balance between cost efficiency and quality. Follow these guidelines:

1. Be reasonably concise in your responses
2. Generate code that is complete but not overly verbose
3. Provide explanations when they add significant value
4. Use context efficiently but don't sacrifice understanding
5. Break down complex tasks when appropriate
6. Focus on delivering the right balance of quality and efficiency`
		case CostOptimizationLevel.LOW:
			return `# Cost Optimization Instructions

You are operating in QUALITY-FOCUSED mode. This means you should prioritize thoroughness and quality over token efficiency. Follow these guidelines:

1. Provide comprehensive and detailed responses
2. Generate complete, well-documented code
3. Include thorough explanations and context
4. Use as much context as needed to fully understand the problem
5. Focus on delivering the highest quality solution
6. Don't sacrifice quality or completeness for token efficiency`
		default:
			return ""
	}
}

export const SYSTEM_PROMPT = async (
	context: vscode.ExtensionContext,
	cwd: string,
	supportsComputerUse: boolean,
	mcpHub?: McpHub,
	diffStrategy?: DiffStrategy,
	browserViewportSize?: string,
	mode: Mode = defaultModeSlug,
	customModePrompts?: CustomModePrompts,
	customModes?: ModeConfig[],
	globalCustomInstructions?: string,
	diffEnabled?: boolean,
	experiments?: Record<string, boolean>,
	enableMcpServerCreation?: boolean,
	language?: string,
	kodelyIgnoreInstructions?: string,
	optimizationLevel?: CostOptimizationLevel,
): Promise<string> => {
	if (!context) {
		throw new Error("Extension context is required for generating system prompt")
	}

	const getPromptComponent = (value: unknown) => {
		if (typeof value === "object" && value !== null) {
			return value as PromptComponent
		}
		return undefined
	}

	// Try to load custom system prompt from file
	const fileCustomSystemPrompt = await loadSystemPromptFile(cwd, mode)

	// Check if it's a custom mode
	const promptComponent = getPromptComponent(customModePrompts?.[mode])

	// Get full mode config from custom modes or fall back to built-in modes
	const currentMode = getModeBySlug(mode, customModes) || modes.find((m) => m.slug === mode) || modes[0]

	// If a file-based custom system prompt exists, use it
	if (fileCustomSystemPrompt) {
		const roleDefinition = promptComponent?.roleDefinition || currentMode.roleDefinition
		const customInstructions = await addCustomInstructions(
			promptComponent?.customInstructions || currentMode.customInstructions || "",
			globalCustomInstructions || "",
			cwd,
			mode,
			{ language: language ?? formatLanguage(vscode.env.language), kodelyIgnoreInstructions: kodelyIgnoreInstructions },
		)
		// For file-based prompts, don't include the tool sections
		return `${roleDefinition}

${fileCustomSystemPrompt}

${customInstructions}`
	}

	// If diff is disabled, don't pass the diffStrategy
	const effectiveDiffStrategy = diffEnabled ? diffStrategy : undefined

	return generatePrompt(
		context,
		cwd,
		supportsComputerUse,
		currentMode.slug,
		mcpHub,
		effectiveDiffStrategy,
		browserViewportSize,
		promptComponent,
		customModes,
		globalCustomInstructions,
		diffEnabled,
		experiments,
		enableMcpServerCreation,
		language,
		kodelyIgnoreInstructions,
		optimizationLevel,
	)
}
