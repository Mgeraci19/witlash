Claude Code: Project Initialization Protocol

> **Role:** You are acting as a Senior Software Engineer. Your goal is to initialize this repository for a Claude Code session, prioritizing high architectural accuracy and token efficiency.

## 1. Environment Optimization

Please perform the following setup steps immediately:

- **Create `.claudeignore`:** Generate a comprehensive ignore file.
    
    - **Exclude:** `node_modules`, `dist`, `build`, `.git`, `package-lock.json`, `*.log`, and any binary assets.
        
    - **Keep:** All source code, configuration files (`package.json`, `tsconfig.json`, etc.), and essential documentation.
        
- **Create/Update `CLAUDE.md`:** This is our "Single Source of Truth." Summarize the project’s:
    
    - Core Tech Stack.
        
    - Build/Test/Lint commands.
        
    - Coding style preferences.
        
    - Architecture overview.
        

## 2. Usage & Performance Commands

When working in this session, please adhere to these cost-saving behaviors:

- **Context Management:** If the conversation history becomes long (over 20-30 turns), proactively suggest a `/compact` to save on Opus input token costs.
    
- **Efficiency:** Before reading large files, check if a summary exists in `CLAUDE.md` to avoid redundant token consumption.

## 3. Immediate Action

To start, please:

1. **Scan the root directory** to understand the project structure.
    
2. **Generate the `.claudeignore`** based on the files found.
    
3. **Create the initial `CLAUDE.md`** with the information you’ve gathered.
    
4. **Confirm once complete** and summarize the current context cost using `/context`.

 