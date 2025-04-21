/**
 * Utility class for compressing code to reduce token usage
 * This is used when the compressCodeInContext setting is enabled
 */
export class CodeCompressor {
    /**
     * Compress code by removing comments, extra whitespace, and other non-essential elements
     * @param code The code to compress
     * @param language The programming language of the code
     * @returns The compressed code
     */
    public static compress(code: string, language: string): string {
        switch (language.toLowerCase()) {
            case 'javascript':
            case 'typescript':
            case 'js':
            case 'ts':
                return this.compressJavaScript(code);
            case 'python':
            case 'py':
                return this.compressPython(code);
            case 'java':
                return this.compressJava(code);
            case 'c':
            case 'cpp':
            case 'c++':
            case 'csharp':
            case 'c#':
            case 'cs':
                return this.compressCFamily(code);
            default:
                // For unknown languages, just do basic compression
                return this.basicCompression(code);
        }
    }

    /**
     * Basic compression that works for most languages
     * Removes comments and extra whitespace
     */
    private static basicCompression(code: string): string {
        // Remove single-line comments
        let compressed = code.replace(/\/\/.*$/gm, '');
        
        // Remove multi-line comments
        compressed = compressed.replace(/\/\*[\s\S]*?\*\//g, '');
        
        // Remove blank lines
        compressed = compressed.replace(/^\s*[\r\n]/gm, '');
        
        // Collapse multiple spaces into one
        compressed = compressed.replace(/\s{2,}/g, ' ');
        
        return compressed;
    }

    /**
     * JavaScript/TypeScript specific compression
     */
    private static compressJavaScript(code: string): string {
        let compressed = this.basicCompression(code);
        
        // Remove console.log statements
        compressed = compressed.replace(/console\.log\(.*?\);?/g, '');
        
        // Remove debugger statements
        compressed = compressed.replace(/debugger;/g, '');
        
        return compressed;
    }

    /**
     * Python specific compression
     */
    private static compressPython(code: string): string {
        // Remove single-line comments
        let compressed = code.replace(/#.*$/gm, '');
        
        // Remove docstrings (triple-quoted strings)
        compressed = compressed.replace(/\"\"\"[\s\S]*?\"\"\"/g, '');
        compressed = compressed.replace(/\'\'\'[\s\S]*?\'\'\'/g, '');
        
        // Remove blank lines
        compressed = compressed.replace(/^\s*[\r\n]/gm, '');
        
        // Collapse multiple spaces into one
        compressed = compressed.replace(/\s{2,}/g, ' ');
        
        // Remove print statements
        compressed = compressed.replace(/print\(.*?\)/g, '');
        
        return compressed;
    }

    /**
     * Java specific compression
     */
    private static compressJava(code: string): string {
        let compressed = this.basicCompression(code);
        
        // Remove System.out.println statements
        compressed = compressed.replace(/System\.out\.println\(.*?\);/g, '');
        
        return compressed;
    }

    /**
     * C-family languages compression (C, C++, C#)
     */
    private static compressCFamily(code: string): string {
        let compressed = this.basicCompression(code);
        
        // Remove printf/cout statements
        compressed = compressed.replace(/printf\(.*?\);/g, '');
        compressed = compressed.replace(/cout\s*<<\s*.*?;/g, '');
        
        return compressed;
    }
}
