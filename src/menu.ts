import {Application} from "./application";
import vscode from "vscode";

export class Menu {
    private app: Application
    constructor(application: Application) {
        this.app = application;
    }

    createMenuItems = (currentLanguage: string | undefined, isLanguageEnabled: boolean): vscode.QuickPickItem[] => {
        let menuItems = [
            {
                label: `${this.app.extConfig.enabled ? 'Disable' : 'Enable'} All Completions`,
                description: `Turn ${this.app.extConfig.enabled ? 'off' : 'on'} completions globally`
            },
            currentLanguage ? {
                label: `${isLanguageEnabled ? 'Disable' : 'Enable'} Completions for ${currentLanguage}`,
                description: `Currently ${isLanguageEnabled ? 'enabled' : 'disabled'}`
            } : null,
            {
                label: "$(gear) Edit Settings...",
            },
            {
                label: "$(book) View Documentation...",
            }]

        if (process.platform === 'darwin') { // if mac os
            menuItems.push(
                {
                    label: "Start model Qwen2.5-Coder-1.5B-Q8_0-GGUF (<= 8GB VRAM)",
                    description: `Requires brew, installs/upgrades llama.cpp server, downloads the model if not available, and runs llama.cpp server`
                },
                {
                    label: "Start model Qwen2.5-Coder-3B-Q8_0-GGUF (<= 16GB VRAM)",
                    description: `Requires brew, installs/upgrades llama.cpp server, downloads the model if not available, and runs llama.cpp server`
                },
                {
                    label: "Start model Qwen2.5-Coder-7B-Q8_0-GGUF (> 16GB VRAM)",
                    description: `Requires brew, installs/upgrades llama.cpp server, downloads the model if not available, and runs llama.cpp server`
                },
                {
                    label: "Start model Qwen2.5-Coder-1.5B-Q8_0-GGUF (CPU Only)",
                    description: `Requires brew, installs/upgrades llama.cpp server, downloads the model if not available, and runs llama.cpp server`
                }, 
                {
                    label: "Start model Qwen2.5-Coder-0.5B-Q8_0-GGUF (CPU Only)",
                    description: `Requires brew, installs/upgrades llama.cpp server, downloads the model if not available, and runs llama.cpp server`
                })
        }

        menuItems.push(
            {
                label: "Start llama.cpp server with custom command from launch_cmd property",
                description: `Runs the command from property launch_cmd`
            },
            {
                label: "Stop llama.cpp server",
                description: `Stops llama.cpp server if it was started from llama.vscode menu."`
            })     

        return menuItems.filter(Boolean) as vscode.QuickPickItem[];
    }

    handleMenuSelection = async (selected: vscode.QuickPickItem, currentLanguage: string | undefined, languageSettings: Record<string, boolean>) => {
        const DEFAULT_PORT_FIM_MODEL = "8012"
        const PRESET_PLACEHOLDER = "[preset]";
        const MODEL_PLACEHOLDER = "[model]"
        let endpointParts = this.app.extConfig.endpoint.split(":");
        let port = endpointParts[endpointParts.length -1]
        if (!Number.isInteger(Number(port))) port =  DEFAULT_PORT_FIM_MODEL
        let llmMacVramTemplate = " brew install llama.cpp && llama-server --" + PRESET_PLACEHOLDER + " --port " + port 
        let llmMacCpuTemplate = " brew install llama.cpp && llama-server -hf " + MODEL_PLACEHOLDER + " --port " + port + " -ub 1024 -b 1024 -dt 0.1 --ctx-size 0 --cache-reuse 256"
        
        switch (selected.label) {
            case "$(gear) Edit Settings...":
                await vscode.commands.executeCommand('workbench.action.openSettings', 'llama-vscode');
                break;
            case "$(gear) Start model Qwen2.5-Coder-1.5B-Q8_0-GGUF (<= 8GB VRAM)":
                await this.app.llamaServer.killCmd();
                await this.app.llamaServer.shellCmd(llmMacVramTemplate.replace(PRESET_PLACEHOLDER, "fim-qwen-1.5b-default"));
                break;
            case "Start model Qwen2.5-Coder-3B-Q8_0-GGUF (<= 16GB VRAM)":
                await this.app.llamaServer.killCmd();
                await this.app.llamaServer.shellCmd(llmMacVramTemplate.replace(PRESET_PLACEHOLDER, "fim-qwen-3b-default"));
                break;
            case "Start model Qwen2.5-Coder-7B-Q8_0-GGUF (> 16GB VRAM)":
                await this.app.llamaServer.killCmd();
                await this.app.llamaServer.shellCmd(llmMacVramTemplate.replace(PRESET_PLACEHOLDER, "fim-qwen-7b-default"));
                break;  
            case "Start model Qwen2.5-Coder-1.5B-Q8_0-GGUF (CPU Only)":
                await this.app.llamaServer.killCmd();
                await this.app.llamaServer.shellCmd(llmMacCpuTemplate.replace(MODEL_PLACEHOLDER, "ggml-org/Qwen2.5-Coder-1.5B-Q8_0-GGUF"));
                break;
            case "Start model Qwen2.5-Coder-0.5B-Q8_0-GGUF (CPU Only)":
                await this.app.llamaServer.killCmd();
                await this.app.llamaServer.shellCmd(llmMacCpuTemplate.replace(MODEL_PLACEHOLDER, "ggml-org/Qwen2.5-Coder-0.5B-Q8_0-GGUF"));
                break;
            case "Start llama.cpp server with custom command from launch_cmd property":
                await this.app.llamaServer.killCmd();
                await this.app.llamaServer.shellCmd(this.app.extConfig.launch_cmd);
                break;      
            case "Stop llama.cpp server":
                await this.app.llamaServer.killCmd();
                break;
            case "$(book) View Documentation...":
                await vscode.env.openExternal(vscode.Uri.parse('https://github.com/ggml-org/llama.vscode'));
                break;
            default:
                await this.handleCompletionToggle(selected.label, currentLanguage, languageSettings);
                break;
        }
        this.app.statusbar.updateStatusBarText();
    }
    private async handleCompletionToggle(label: string, currentLanguage: string | undefined, languageSettings: Record<string, boolean>) {
        const config = this.app.extConfig.config;
        if (label.includes('All Completions')) {
            await config.update('enabled', !this.app.extConfig.enabled, true);
        } else if (currentLanguage && label.includes(currentLanguage)) {
            const isLanguageEnabled = languageSettings[currentLanguage] ?? true;
            languageSettings[currentLanguage] = !isLanguageEnabled;
            await config.update('languageSettings', languageSettings, true);
        }
    }


    showMenu = async () => {
        const currentLanguage = vscode.window.activeTextEditor?.document.languageId;
        const isLanguageEnabled = currentLanguage ? this.app.extConfig.isCompletionEnabled(undefined, currentLanguage) : true;

        const items = this.app.menu.createMenuItems(currentLanguage, isLanguageEnabled);
        const selected = await vscode.window.showQuickPick(items, { title: "Llama Menu" });

        if (selected) {
            await this.handleMenuSelection(selected, currentLanguage, this.app.extConfig.languageSettings);
        }
    }
}
