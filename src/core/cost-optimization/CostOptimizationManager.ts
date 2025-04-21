import * as vscode from "vscode"
import { ModelInfo } from "../../shared/api"

/**
 * Enum representing different cost optimization levels
 */
export enum CostOptimizationLevel {
    /**
     * Prioritize quality over cost savings (LOW cost optimization)
     */
    LOW = "low",

    /**
     * Balance between cost and quality
     */
    BALANCED = "balanced",

    /**
     * Prioritize cost savings over quality (HIGH cost optimization)
     */
    HIGH = "high"
}

/**
 * Interface for cost optimization settings
 */
export interface CostOptimizationSettings {
    /**
     * The selected optimization level
     */
    optimizationLevel: CostOptimizationLevel;

    /**
     * Maximum percentage of context window to use (0-100)
     */
    maxContextWindowUsage: number;

    /**
     * Whether to use local RAG for context retrieval
     */
    useLocalRag: boolean;

    /**
     * Maximum number of tokens to generate in a response
     */
    maxOutputTokens: number;

    /**
     * Whether to compress code in the context window
     */
    compressCodeInContext: boolean;
}

/**
 * Default settings for different optimization levels
 */
const DEFAULT_SETTINGS: Record<CostOptimizationLevel, CostOptimizationSettings> = {
    [CostOptimizationLevel.LOW]: {
        optimizationLevel: CostOptimizationLevel.LOW,
        maxContextWindowUsage: 95, // Use 95% of available context window (quality-focused)
        useLocalRag: false,
        maxOutputTokens: 4000,
        compressCodeInContext: false
    },
    [CostOptimizationLevel.BALANCED]: {
        optimizationLevel: CostOptimizationLevel.BALANCED,
        maxContextWindowUsage: 85, // Use 85% of available context window
        useLocalRag: true,
        maxOutputTokens: 2000,
        compressCodeInContext: false
    },
    [CostOptimizationLevel.HIGH]: {
        optimizationLevel: CostOptimizationLevel.HIGH,
        maxContextWindowUsage: 70, // Use only 70% of available context window (cost-focused)
        useLocalRag: true,
        maxOutputTokens: 1000,
        compressCodeInContext: true
    }
}

/**
 * Manager class for cost optimization features
 */
export class CostOptimizationManager {
    private context: vscode.ExtensionContext;
    private settings: CostOptimizationSettings;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;

        // Load settings from global state or use default balanced settings
        const savedLevel = this.context.globalState.get<CostOptimizationLevel>(
            'costOptimizationLevel',
            CostOptimizationLevel.BALANCED
        );

        const savedSettings = this.context.globalState.get<CostOptimizationSettings>(
            'costOptimizationSettings',
            DEFAULT_SETTINGS[savedLevel]
        );

        this.settings = savedSettings;
    }

    /**
     * Get the current cost optimization settings
     */
    public getSettings(): CostOptimizationSettings {
        return this.settings;
    }

    /**
     * Set the optimization level and apply default settings for that level
     */
    public async setOptimizationLevel(level: CostOptimizationLevel): Promise<void> {
        this.settings = DEFAULT_SETTINGS[level];
        await this.saveSettings();
    }

    /**
     * Update specific settings
     */
    public async updateSettings(settings: Partial<CostOptimizationSettings>): Promise<void> {
        this.settings = {
            ...this.settings,
            ...settings
        };
        await this.saveSettings();
    }

    /**
     * Save settings to global state
     */
    private async saveSettings(): Promise<void> {
        await this.context.globalState.update('costOptimizationLevel', this.settings.optimizationLevel);
        await this.context.globalState.update('costOptimizationSettings', this.settings);
    }

    /**
     * Calculate the maximum number of tokens to use for context based on model info
     */
    public calculateMaxContextTokens(modelInfo: ModelInfo): number {
        if (!modelInfo.contextWindow) {
            return 0;
        }

        // Calculate max tokens based on percentage setting
        const maxTokens = Math.floor(
            (modelInfo.contextWindow * this.settings.maxContextWindowUsage) / 100
        );

        // Reserve tokens for the model's output
        const reservedForOutput = this.settings.maxOutputTokens;

        return Math.max(0, maxTokens - reservedForOutput);
    }

    /**
     * Get the maximum output tokens based on current settings
     */
    public getMaxOutputTokens(modelInfo: ModelInfo): number {
        // If model has a lower max tokens than our setting, use the model's limit
        if (modelInfo.maxTokens && modelInfo.maxTokens < this.settings.maxOutputTokens) {
            return modelInfo.maxTokens;
        }

        return this.settings.maxOutputTokens;
    }

    /**
     * Estimate the cost of a request based on input and output tokens
     */
    public estimateRequestCost(
        modelInfo: ModelInfo,
        inputTokens: number,
        estimatedOutputTokens: number
    ): number {
        if (!modelInfo.inputPrice || !modelInfo.outputPrice) {
            return 0;
        }

        const inputCost = (modelInfo.inputPrice / 1_000_000) * inputTokens;
        const outputCost = (modelInfo.outputPrice / 1_000_000) * estimatedOutputTokens;

        return inputCost + outputCost;
    }
}
