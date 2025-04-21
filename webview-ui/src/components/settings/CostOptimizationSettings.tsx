import { HTMLAttributes, useEffect, useRef } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeCheckbox, VSCodeRadio, VSCodeRadioGroup } from "@vscode/webview-ui-toolkit/react"
import { DollarSign } from "lucide-react"

import { cn } from "@/lib/utils"
import { Slider } from "@/components/ui"

import { SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
// No need to import CostOptimizationLevel as we're using string literals

type CostOptimizationSettingsProps = HTMLAttributes<HTMLDivElement> & {
    optimizationLevel: "low" | "balanced" | "high";
    maxContextWindowUsage: number;
    useLocalRag: boolean;
    maxOutputTokens: number;
    compressCodeInContext: boolean;
    setCachedStateField: SetCachedStateField<
        "optimizationLevel" | "maxContextWindowUsage" | "useLocalRag" | "maxOutputTokens" | "compressCodeInContext"
    >;
}

export function CostOptimizationSettings({
    optimizationLevel,
    maxContextWindowUsage,
    useLocalRag,
    maxOutputTokens,
    compressCodeInContext,
    setCachedStateField,
    className,
    ...props
}: CostOptimizationSettingsProps) {
    const { t } = useAppTranslation()

    // Sync slider values with optimization level only when the optimization level changes
    // This allows users to customize settings after selecting a preset
    const prevOptimizationLevelRef = useRef(optimizationLevel);

    useEffect(() => {
        // Only update settings when the optimization level changes
        if (prevOptimizationLevelRef.current !== optimizationLevel) {
            // Update the settings based on the new optimization level
            if (optimizationLevel === "low") {
                // LOW = quality-focused (95% context, RAG disabled, 4000 tokens, no compression)
                setCachedStateField("maxContextWindowUsage", 95);
                setCachedStateField("useLocalRag", false);
                setCachedStateField("maxOutputTokens", 4000);
                setCachedStateField("compressCodeInContext", false);
            } else if (optimizationLevel === "balanced") {
                // BALANCED (85% context, RAG enabled, 2000 tokens, no compression)
                setCachedStateField("maxContextWindowUsage", 85);
                setCachedStateField("useLocalRag", true);
                setCachedStateField("maxOutputTokens", 2000);
                setCachedStateField("compressCodeInContext", false);
            } else if (optimizationLevel === "high") {
                // HIGH = cost-focused (70% context, RAG enabled, 1000 tokens, compression enabled)
                setCachedStateField("maxContextWindowUsage", 70);
                setCachedStateField("useLocalRag", true);
                setCachedStateField("maxOutputTokens", 1000);
                setCachedStateField("compressCodeInContext", true);
            }

            // Update the ref to the current optimization level
            prevOptimizationLevelRef.current = optimizationLevel;
        }
    }, [optimizationLevel, setCachedStateField]);

    return (
        <div className={cn("flex flex-col gap-4", className)} {...props}>
            <SectionHeader
                icon={<DollarSign className="w-5 h-5" />}
                title={t("settings:costOptimization.title")}
                description={t("settings:costOptimization.description")}
            />

            <Section>
                <div className="flex flex-col gap-4">
                    <div className="font-medium">{t("settings:costOptimization.optimizationLevel.label")}</div>
                    <div className="text-xs opacity-70 mb-2">
                        Select a preset level, then customize individual settings below if needed.
                    </div>
                    <VSCodeRadioGroup orientation="vertical">
                        <VSCodeRadio
                            checked={optimizationLevel === "low"}
                            onChange={() => {
                                setCachedStateField("optimizationLevel", "low");
                                // The useEffect hook will handle updating the settings
                            }}
                        >
                            {t("settings:costOptimization.optimizationLevel.qualityFocused")}
                        </VSCodeRadio>
                        <div className="text-xs ml-6 mb-2 opacity-70">
                            {t("settings:costOptimization.optimizationLevel.qualityFocusedDescription")}
                        </div>

                        <VSCodeRadio
                            checked={optimizationLevel === "balanced"}
                            onChange={() => {
                                setCachedStateField("optimizationLevel", "balanced");
                                // The useEffect hook will handle updating the settings
                            }}
                        >
                            {t("settings:costOptimization.optimizationLevel.balanced")}
                        </VSCodeRadio>
                        <div className="text-xs ml-6 mb-2 opacity-70">
                            {t("settings:costOptimization.optimizationLevel.balancedDescription")}
                        </div>

                        <VSCodeRadio
                            checked={optimizationLevel === "high"}
                            onChange={() => {
                                setCachedStateField("optimizationLevel", "high");
                                // The useEffect hook will handle updating the settings
                            }}
                        >
                            {t("settings:costOptimization.optimizationLevel.costFocused")}
                        </VSCodeRadio>
                        <div className="text-xs ml-6 mb-2 opacity-70">
                            {t("settings:costOptimization.optimizationLevel.costFocusedDescription")}
                        </div>
                    </VSCodeRadioGroup>
                </div>

                <div className="flex flex-col gap-2 mt-4">
                    <div className="font-medium">{t("settings:costOptimization.maxContextWindowUsage.label")}</div>
                    <div className="flex items-center gap-1">
                        <Slider
                            min={50}
                            max={100}
                            step={5}
                            value={[maxContextWindowUsage]}
                            onValueChange={([value]) => setCachedStateField("maxContextWindowUsage", value)}
                        />
                        <div className="w-12 text-sm text-center">{maxContextWindowUsage}%</div>
                    </div>
                    <div className="text-xs opacity-70">
                        {t("settings:costOptimization.maxContextWindowUsage.description")}
                    </div>
                </div>

                <div className="flex flex-col gap-2 mt-4">
                    <div className="font-medium">{t("settings:costOptimization.maxOutputTokens.label")}</div>
                    <div className="flex items-center gap-1">
                        <Slider
                            min={500}
                            max={8000}
                            step={500}
                            value={[maxOutputTokens]}
                            onValueChange={([value]) => setCachedStateField("maxOutputTokens", value)}
                        />
                        <div className="w-16 text-sm text-center">{maxOutputTokens}</div>
                    </div>
                    <div className="text-xs opacity-70">
                        {t("settings:costOptimization.maxOutputTokens.description")}
                    </div>
                </div>

                <div className="flex flex-col gap-2 mt-4">
                    <VSCodeCheckbox
                        checked={useLocalRag}
                        onChange={(e) => {
                            const target = e.target as HTMLInputElement;
                            if (target) {
                                setCachedStateField("useLocalRag", target.checked);
                            }
                        }}
                    >
                        {t("settings:costOptimization.useLocalRag.label")}
                    </VSCodeCheckbox>
                    <div className="text-xs opacity-70 ml-6">
                        {t("settings:costOptimization.useLocalRag.description")}
                    </div>
                </div>

                <div className="flex flex-col gap-2 mt-4">
                    <VSCodeCheckbox
                        checked={compressCodeInContext}
                        onChange={(e) => {
                            const target = e.target as HTMLInputElement;
                            if (target) {
                                setCachedStateField("compressCodeInContext", target.checked);
                            }
                        }}
                    >
                        {t("settings:costOptimization.compressCodeInContext.label")}
                    </VSCodeCheckbox>
                    <div className="text-xs opacity-70 ml-6">
                        {t("settings:costOptimization.compressCodeInContext.description")}
                    </div>
                </div>
            </Section>
        </div>
    )
}