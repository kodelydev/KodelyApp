import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import { glob } from "glob"
import { KodelyIgnoreController } from "../ignore/KodelyIgnoreController"

/**
 * Interface for a document in the RAG index
 */
interface IndexedDocument {
    path: string;
    content: string;
    language: string;
    lastModified: number;
    tokens: number;
    // Enhanced metadata
    symbols?: string[];      // Function/class/variable names
    imports?: string[];      // Imported modules/packages
    exports?: string[];      // Exported symbols
    comments?: string[];     // Extracted comments
    fileType?: string;       // More specific file type (e.g., 'react-component', 'test')
}

/**
 * Interface for a search result
 */
interface SearchResult {
    document: IndexedDocument;
    relevanceScore: number;
}

/**
 * Service for local RAG (Retrieval Augmented Generation) implementation
 * This provides efficient context retrieval without sending all code to the LLM
 */
export class LocalRagService {
    private context: vscode.ExtensionContext;
    private indexedDocuments: Map<string, IndexedDocument> = new Map();
    private indexPath: string;
    private isIndexing: boolean = false;
    private kodelyIgnoreController?: KodelyIgnoreController;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.indexPath = path.join(context.globalStorageUri.fsPath, 'rag-index');

        // Get the workspace folder path for the ignore controller
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const workspacePath = workspaceFolders[0].uri.fsPath;
            this.kodelyIgnoreController = new KodelyIgnoreController(workspacePath);
        }
    }

    /**
     * Initialize the RAG service
     */
    public async initialize(): Promise<void> {
        try {
            // Check if the index file exists
            try {
                await fs.access(this.indexPath);
            } catch (err) {
                // File doesn't exist, create an empty index
                console.log('RAG index file does not exist, creating empty index');
                this.indexedDocuments = new Map();
                await this.saveIndex();
                return;
            }

            await this.loadIndex();
        } catch (error) {
            console.error('Failed to load RAG index:', error);
            // Create a new index if loading fails
            this.indexedDocuments = new Map();
            // Try to save the empty index
            try {
                await this.saveIndex();
            } catch (saveErr) {
                console.error('Failed to create empty index:', saveErr);
            }
        }
    }

    /**
     * Index the workspace files
     */
    public async indexWorkspace(workspaceFolders: readonly vscode.WorkspaceFolder[]): Promise<void> {
        if (this.isIndexing) {
            return;
        }

        this.isIndexing = true;

        try {
            for (const folder of workspaceFolders) {
                const folderPath = folder.uri.fsPath;

                // Get all files in the workspace
                const files = await glob('**/*', {
                    cwd: folderPath,
                    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
                    nodir: true
                });

                for (const file of files) {
                    const filePath = path.join(folderPath, file);

                    // Skip files that match .kodelyignore patterns
                    if (this.kodelyIgnoreController && !this.kodelyIgnoreController.validateAccess(filePath)) {
                        continue;
                    }

                    try {
                        const stats = await fs.stat(filePath);

                        // Skip large files (>1MB)
                        if (stats.size > 1024 * 1024) {
                            continue;
                        }

                        // Check if file is already indexed and up to date
                        const existingDoc = this.indexedDocuments.get(filePath);
                        if (existingDoc && existingDoc.lastModified >= stats.mtime.getTime()) {
                            continue;
                        }

                        // Read and index the file
                        const content = await fs.readFile(filePath, 'utf-8');
                        const language = this.getLanguageFromPath(filePath);

                        // Simple token count estimation (can be improved with a proper tokenizer)
                        const tokens = this.estimateTokenCount(content);

                        // Extract metadata
                        const symbols = this.extractSymbols(content, language);
                        const imports = this.extractImports(content, language);
                        const exports = this.extractExports(content, language);
                        const comments = this.extractComments(content, language);
                        const fileType = this.detectFileType(filePath, content, language);

                        this.indexedDocuments.set(filePath, {
                            path: filePath,
                            content,
                            language,
                            lastModified: stats.mtime.getTime(),
                            tokens,
                            symbols,
                            imports,
                            exports,
                            comments,
                            fileType
                        });
                    } catch (error) {
                        console.error(`Error indexing file ${filePath}:`, error);
                    }
                }
            }

            // Save the index
            await this.saveIndex();
        } finally {
            this.isIndexing = false;
        }
    }

    /**
     * Search for relevant documents based on a query
     */
    public async search(query: string, maxResults: number = 5, maxTokens: number = 10000): Promise<SearchResult[]> {
        const results: SearchResult[] = [];
        let totalTokens = 0;

        // Simple relevance scoring based on term frequency
        const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);

        for (const doc of this.indexedDocuments.values()) {
            const content = doc.content.toLowerCase();
            let score = 0;

            // Score based on content match
            for (const term of queryTerms) {
                const count = (content.match(new RegExp(term, 'g')) || []).length;
                score += count;
            }

            // Boost score based on metadata matches
            // Check if any query terms match symbols (higher weight)
            if (doc.symbols) {
                for (const term of queryTerms) {
                    for (const symbol of doc.symbols) {
                        if (symbol.toLowerCase().includes(term)) {
                            // Higher weight for symbol matches
                            score += 5;
                        }
                    }
                }
            }

            // Check if any query terms match imports
            if (doc.imports) {
                for (const term of queryTerms) {
                    for (const importPath of doc.imports) {
                        if (importPath.toLowerCase().includes(term)) {
                            score += 2;
                        }
                    }
                }
            }

            // Check if any query terms match exports
            if (doc.exports) {
                for (const term of queryTerms) {
                    for (const exportName of doc.exports) {
                        if (exportName.toLowerCase().includes(term)) {
                            score += 3;
                        }
                    }
                }
            }

            // Check if any query terms match comments
            if (doc.comments) {
                for (const term of queryTerms) {
                    for (const comment of doc.comments) {
                        if (comment.toLowerCase().includes(term)) {
                            score += 1.5;
                        }
                    }
                }
            }

            // Check if query mentions a specific file type
            if (doc.fileType && queryTerms.some(term =>
                doc.fileType!.toLowerCase().includes(term) ||
                (term === 'test' && doc.fileType!.includes('-test')) ||
                (term === 'react' && doc.fileType!.includes('-react'))
            )) {
                score += 4;
            }

            // Normalize by document length
            score = score / (doc.tokens || 1);

            if (score > 0) {
                results.push({
                    document: doc,
                    relevanceScore: score
                });
            }
        }

        // Sort by relevance score
        results.sort((a, b) => b.relevanceScore - a.relevanceScore);

        // Filter to respect token limit
        const filteredResults: SearchResult[] = [];
        for (const result of results.slice(0, maxResults)) {
            if (totalTokens + result.document.tokens <= maxTokens) {
                filteredResults.push(result);
                totalTokens += result.document.tokens;
            }
        }

        return filteredResults;
    }

    /**
     * Get relevant context for a query
     */
    public async getRelevantContext(query: string, maxTokens: number = 10000): Promise<string> {
        const results = await this.search(query, 10, maxTokens);

        if (results.length === 0) {
            return "";
        }

        // Format the results into a context string
        let context = "Relevant code from the codebase:\n\n";

        for (const result of results) {
            const doc = result.document;
            const relativePath = vscode.workspace.asRelativePath(doc.path);

            // Add file metadata
            context += `File: ${relativePath} (${doc.language}${doc.fileType && doc.fileType !== doc.language ? `, ${doc.fileType}` : ''})\n`;

            // Add symbols if available
            if (doc.symbols && doc.symbols.length > 0) {
                context += `Symbols: ${doc.symbols.join(', ')}\n`;
            }

            // Add imports if available
            if (doc.imports && doc.imports.length > 0) {
                context += `Imports: ${doc.imports.join(', ')}\n`;
            }

            // Add exports if available
            if (doc.exports && doc.exports.length > 0) {
                context += `Exports: ${doc.exports.join(', ')}\n`;
            }

            // Add code content
            context += `\`\`\`${doc.language}\n${doc.content}\n\`\`\`\n\n`;
        }

        return context;
    }

    /**
     * Save the index to disk
     */
    private async saveIndex(): Promise<void> {
        try {
            // Create directory if it doesn't exist
            await fs.mkdir(path.dirname(this.indexPath), { recursive: true });

            // Convert Map to array for serialization
            const serializedIndex = Array.from(this.indexedDocuments.entries());

            // Save to disk
            await fs.writeFile(this.indexPath, JSON.stringify(serializedIndex), 'utf-8');
            console.log('RAG index saved successfully');
        } catch (error) {
            console.error('Failed to save RAG index:', error);
        }
    }

    /**
     * Load the index from disk
     */
    private async loadIndex(): Promise<void> {
        try {
            const data = await fs.readFile(this.indexPath, 'utf-8');
            const serializedIndex = JSON.parse(data) as [string, IndexedDocument][];

            this.indexedDocuments = new Map(serializedIndex);
        } catch (error) {
            throw new Error(`Failed to load RAG index: ${error}`);
        }
    }

    /**
     * Get the language from a file path
     */
    private getLanguageFromPath(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase();

        const languageMap: Record<string, string> = {
            '.js': 'javascript',
            '.ts': 'typescript',
            '.jsx': 'javascript',
            '.tsx': 'typescript',
            '.py': 'python',
            '.java': 'java',
            '.c': 'c',
            '.cpp': 'cpp',
            '.cs': 'csharp',
            '.go': 'go',
            '.rb': 'ruby',
            '.php': 'php',
            '.html': 'html',
            '.css': 'css',
            '.json': 'json',
            '.md': 'markdown',
            '.yml': 'yaml',
            '.yaml': 'yaml',
            '.sh': 'bash',
            '.bat': 'batch',
            '.ps1': 'powershell',
            '.sql': 'sql',
            '.rs': 'rust',
            '.swift': 'swift',
            '.kt': 'kotlin',
            '.scala': 'scala',
            '.dart': 'dart',
            '.lua': 'lua',
            '.r': 'r'
        };

        return languageMap[ext] || 'plaintext';
    }

    /**
     * Estimate token count for a string
     * This is a simple estimation, a proper tokenizer would be more accurate
     */
    private estimateTokenCount(text: string): number {
        // Simple estimation: ~4 characters per token for English text
        return Math.ceil(text.length / 4);
    }

    /**
     * Extract symbols (function/class/variable names) from content
     */
    private extractSymbols(content: string, language: string): string[] {
        const symbols: string[] = [];

        try {
            // Simple regex-based extraction based on language
            if (language === 'javascript' || language === 'typescript') {
                // Match function declarations, class declarations, and variable declarations
                const functionMatches = content.match(/function\s+([a-zA-Z0-9_$]+)\s*\(/g) || [];
                const classMatches = content.match(/class\s+([a-zA-Z0-9_$]+)/g) || [];
                const constMatches = content.match(/const\s+([a-zA-Z0-9_$]+)\s*=/g) || [];
                const letMatches = content.match(/let\s+([a-zA-Z0-9_$]+)\s*=/g) || [];
                const varMatches = content.match(/var\s+([a-zA-Z0-9_$]+)\s*=/g) || [];
                const arrowFunctionMatches = content.match(/const\s+([a-zA-Z0-9_$]+)\s*=\s*\([^)]*\)\s*=>/g) || [];

                // Extract the actual names
                functionMatches.forEach(match => {
                    const name = match.replace(/function\s+/, '').replace(/\s*\(.*/, '');
                    if (name) symbols.push(name);
                });

                classMatches.forEach(match => {
                    const name = match.replace(/class\s+/, '');
                    if (name) symbols.push(name);
                });

                constMatches.forEach(match => {
                    const name = match.replace(/const\s+/, '').replace(/\s*=.*/, '');
                    if (name) symbols.push(name);
                });

                letMatches.forEach(match => {
                    const name = match.replace(/let\s+/, '').replace(/\s*=.*/, '');
                    if (name) symbols.push(name);
                });

                varMatches.forEach(match => {
                    const name = match.replace(/var\s+/, '').replace(/\s*=.*/, '');
                    if (name) symbols.push(name);
                });

                arrowFunctionMatches.forEach(match => {
                    const name = match.replace(/const\s+/, '').replace(/\s*=.*/, '');
                    if (name) symbols.push(name);
                });
            } else if (language === 'python') {
                // Match function and class declarations in Python
                const functionMatches = content.match(/def\s+([a-zA-Z0-9_]+)\s*\(/g) || [];
                const classMatches = content.match(/class\s+([a-zA-Z0-9_]+)/g) || [];

                functionMatches.forEach(match => {
                    const name = match.replace(/def\s+/, '').replace(/\s*\(.*/, '');
                    if (name) symbols.push(name);
                });

                classMatches.forEach(match => {
                    const name = match.replace(/class\s+/, '');
                    if (name) symbols.push(name);
                });
            }
            // Add more language-specific extractors as needed
        } catch (error) {
            console.error('Error extracting symbols:', error);
        }

        return [...new Set(symbols)]; // Remove duplicates
    }

    /**
     * Extract imports from content
     */
    private extractImports(content: string, language: string): string[] {
        const imports: string[] = [];

        try {
            if (language === 'javascript' || language === 'typescript') {
                // Match ES6 imports
                const importMatches = content.match(/import\s+.*?from\s+['"]([^'"]+)['"];?/g) || [];
                // Match require statements
                const requireMatches = content.match(/require\s*\(['"]([^'"]+)['"]\)/g) || [];

                importMatches.forEach(match => {
                    const importPath = match.match(/from\s+['"]([^'"]+)['"];?/);
                    if (importPath && importPath[1]) imports.push(importPath[1]);
                });

                requireMatches.forEach(match => {
                    const requirePath = match.match(/require\s*\(['"]([^'"]+)['"]\)/);
                    if (requirePath && requirePath[1]) imports.push(requirePath[1]);
                });
            } else if (language === 'python') {
                // Match Python imports
                const importMatches = content.match(/import\s+([a-zA-Z0-9_.]+)/g) || [];
                const fromImportMatches = content.match(/from\s+([a-zA-Z0-9_.]+)\s+import/g) || [];

                importMatches.forEach(match => {
                    const importPath = match.replace(/import\s+/, '');
                    if (importPath) imports.push(importPath);
                });

                fromImportMatches.forEach(match => {
                    const importPath = match.replace(/from\s+/, '').replace(/\s+import.*/, '');
                    if (importPath) imports.push(importPath);
                });
            }
            // Add more language-specific extractors as needed
        } catch (error) {
            console.error('Error extracting imports:', error);
        }

        return [...new Set(imports)]; // Remove duplicates
    }

    /**
     * Extract exports from content
     */
    private extractExports(content: string, language: string): string[] {
        const exports: string[] = [];

        try {
            if (language === 'javascript' || language === 'typescript') {
                // Match named exports
                const namedExportMatches = content.match(/export\s+(?:const|let|var|function|class)\s+([a-zA-Z0-9_$]+)/g) || [];
                // Match default exports
                const defaultExportMatches = content.match(/export\s+default\s+(?:class|function)?\s*([a-zA-Z0-9_$]+)/g) || [];

                namedExportMatches.forEach(match => {
                    const parts = match.split(/\s+/);
                    if (parts.length >= 3) exports.push(parts[2]);
                });

                defaultExportMatches.forEach(match => {
                    const parts = match.split(/\s+/);
                    if (parts.length >= 3) exports.push('default: ' + parts[parts.length - 1]);
                });
            }
            // Add more language-specific extractors as needed
        } catch (error) {
            console.error('Error extracting exports:', error);
        }

        return [...new Set(exports)]; // Remove duplicates
    }

    /**
     * Extract comments from content
     * @param content The file content
     * @param language The programming language (unused but kept for consistency with other methods)
     */
    private extractComments(content: string, language: string): string[] {
        const comments: string[] = [];

        try {
            // Match single-line comments (for JS, TS, Java, C++, etc.)
            const singleLineComments = content.match(/\/\/.*$/gm) || [];
            // Match multi-line comments (for JS, TS, Java, C++, etc.)
            const multiLineComments = content.match(/\/\*[\s\S]*?\*\//g) || [];
            // Match Python/shell/Ruby comments
            const hashComments = content.match(/#.*$/gm) || [];

            // Language-specific comment handling could be added here if needed

            singleLineComments.forEach(comment => {
                const cleanComment = comment.replace(/\/\/\s*/, '').trim();
                if (cleanComment) comments.push(cleanComment);
            });

            multiLineComments.forEach(comment => {
                const cleanComment = comment.replace(/\/\*\s*/, '').replace(/\s*\*\//, '').trim();
                if (cleanComment) comments.push(cleanComment);
            });

            hashComments.forEach(comment => {
                const cleanComment = comment.replace(/#\s*/, '').trim();
                if (cleanComment) comments.push(cleanComment);
            });
        } catch (error) {
            console.error('Error extracting comments:', error);
        }

        return comments;
    }

    /**
     * Detect file type based on content and path
     */
    private detectFileType(filePath: string, content: string, language: string): string {
        // Default to the language as the file type
        let fileType = language;

        try {
            const fileName = path.basename(filePath).toLowerCase();

            // Check for test files
            if (fileName.includes('.test.') || fileName.includes('.spec.') ||
                fileName.startsWith('test_') || content.includes('@test') ||
                content.includes('describe(') && content.includes('it(')) {
                fileType = `${language}-test`;
            }

            // Check for React components
            else if ((language === 'javascript' || language === 'typescript') &&
                    (content.includes('import React') || content.includes('from "react"') ||
                     content.includes('extends Component') || content.includes('React.Component') ||
                     content.includes('useState(') || content.includes('useEffect('))) {
                fileType = `${language}-react`;
            }

            // Check for configuration files
            else if (fileName === 'package.json' || fileName === 'tsconfig.json' ||
                    fileName.endsWith('.config.js') || fileName.endsWith('.config.ts')) {
                fileType = 'config';
            }

            // Check for documentation files
            else if (language === 'markdown' || fileName.endsWith('.md') ||
                    fileName === 'readme' || fileName === 'readme.txt') {
                fileType = 'documentation';
            }
        } catch (error) {
            console.error('Error detecting file type:', error);
        }

        return fileType;
    }
}
