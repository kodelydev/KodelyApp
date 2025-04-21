# Kodely - Cost-Efficient AI Coding Assistant

Kodely is a VSCode extension that provides an AI coding assistant focused on optimizing LLM API costs while maintaining high-quality results. It helps developers reduce token usage, manage context windows efficiently, and produce solutions in a cost-effective manner.

<div align="center">
  <p align="center">
  Screenshot to be added.
  </p>
</div>

## Features

### Cost Optimization
- **Local RAG Implementation**: Efficiently retrieves relevant context without sending all code to the LLM
- **Intelligent Context Window Management**: Optimizes token usage by prioritizing the most relevant code snippets
- **Task Breakdown Optimization**: Breaks complex tasks into smaller, more manageable chunks to reduce token usage
- **Output Optimization**: Produces efficient, lean code to minimize expensive output tokens

### Customizable Cost-Quality Balance
Choose your preferred optimization level:
- **Cost-Focused**: Prioritizes minimizing token usage and API costs
- **Balanced**: Maintains a balance between cost efficiency and quality
- **Quality-Focused**: Prioritizes thoroughness and quality over token efficiency

### Core Functionality
- **Code Generation**: Generate code based on natural language descriptions
- **Code Explanation**: Get explanations for complex code
- **Code Improvement**: Enhance existing code with AI suggestions
- **Terminal Integration**: Get help with terminal commands
- **Multi-Provider Support**: Works with various LLM providers including Anthropic, OpenAI, and more

## Getting Started

1. Install the Kodely extension from the VSCode marketplace
2. Configure your preferred AI provider and API key in the settings
3. Set your desired cost optimization level
4. Start coding with Kodely!

## What Can Kodely Do?

- 🚀 **Generate Code** from natural language descriptions
- 🔧 **Refactor & Debug** existing code
- 📝 **Write & Update** documentation
- 🤔 **Answer Questions** about your codebase
- 🔄 **Automate** repetitive tasks
- 🏗️ **Create** new files and projects

## Quick Start

1. Install Kodely
2. Connect Your AI Provider
3. Try Your First Task

## Key Features

### Multiple Modes

Kodely adapts to your needs with specialized modes:

- **Code Mode:** For general-purpose coding tasks
- **Architect Mode:** For planning and technical leadership
- **Ask Mode:** For answering questions and providing information
- **Debug Mode:** For systematic problem diagnosis
- **Custom Modes:** Create unlimited specialized personas for security auditing, performance optimization, documentation, or any other task

### Smart Tools

Kodely comes with powerful tools that can:

- Read and write files in your project
- Execute commands in your VS Code terminal
- Control a web browser
- Use external tools via MCP (Model Context Protocol)

### Cost Optimization Settings

Kodely provides several settings to help you optimize your LLM API costs:

- **Optimization Level**: Choose between Cost-Focused, Balanced, or Quality-Focused modes
- **Maximum Context Window Usage**: Control what percentage of the model's context window to use
- **Maximum Output Tokens**: Limit the number of tokens generated in responses
- **Local RAG**: Enable or disable local Retrieval Augmented Generation
- **Code Compression**: Optionally compress code in the context window to reduce token usage

## Requirements

- VSCode 1.60.0 or higher
- Internet connection for API access
- API key for your preferred LLM provider

## Privacy & Security

- Kodely uses a `.kodelyignore` file (similar to `.gitignore`) to specify files that should not be accessed by the AI
- All processing happens through your own API keys
- No data is stored on our servers

## Local Setup & Development

1. **Clone** the repo:

```sh
git clone https://github.com/kodelydev/KodelyApp.git
```

2. **Install dependencies**:

```sh
npm run install:all
```

3. **Start the webview (Vite/React app with HMR)**:

```sh
npm run dev
```

4. **Debug**:
   Press `F5` (or **Run** → **Start Debugging**) in VSCode to open a new session with Kodely loaded.

Changes to the webview will appear immediately. Changes to the core extension will require a restart of the extension host.

Alternatively you can build a .vsix and install it directly in VSCode:

```sh
npm run build
```

A `.vsix` file will appear in the `bin/` directory which can be installed with:

```sh
code --install-extension bin/kodely-<version>.vsix
```

## License

MIT

---

Kodely is focused on helping developers reduce AI API costs while maintaining high-quality results. By optimizing token usage and implementing efficient context management, Kodely provides a cost-effective solution for AI-assisted coding.
