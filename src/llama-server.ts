import axios from "axios";
import {Application} from "./application";
import { EventEmitter } from 'events';
import * as cp from 'child_process';
import vscode, { Terminal } from "vscode";

const STATUS_OK = 200;

export interface LlamaResponse {
    content?: string;
    generation_settings?: any;
    tokens_cached?: number;
    truncated?: boolean;
    timings?: {
        prompt_n?: number;
        prompt_ms?: number;
        prompt_per_second?: number;
        predicted_n?: number;
        predicted_ms?: number;
        predicted_per_second?: number;
    };
}

export class LlamaServer {
    // private extConfig: Configuration;
    private app: Application
    private childProcess: cp.ChildProcess | undefined;
    private uniqueTerminalTitle = "llama.vscode-llama.cpp-server";
    private vsCodeTerminal: Terminal | undefined;
    private childProcessStdErr: string = "";
    private eventEmitter: EventEmitter;
    private readonly defaultRequestParams = {
        top_k: 40,
        top_p: 0.99,
        stream: false,
        samplers: ["top_k", "top_p", "infill"],
        cache_prompt: true,
    } as const;

    constructor(application: Application) {
        this.app = application;
        this.eventEmitter = new EventEmitter();
        this.vsCodeTerminal = undefined;
    }

    private replacePlaceholders(template: string, replacements: { [key: string]: string }): string {
        return template.replace(/{(\w+)}/g, (_, key) => replacements[key] || "");
    }

    private async handleOpenAICompletion(
        chunks: any[],
        inputPrefix: string,
        inputSuffix: string,
        prompt: string,
        isPreparation = false
    ): Promise<LlamaResponse | void> {
        const client = this.app.extConfig.openai_client;
        if (!client) return;

        const additional_context = chunks.length > 0 ? "Context:\n\n" + chunks.join("\n") : "";

        const replacements = {
            inputPrefix: inputPrefix.slice(-this.app.extConfig.n_prefix),
            prompt: prompt,
            inputSuffix: inputSuffix.slice(0, this.app.extConfig.n_suffix),
        };

        const rsp = await client.completions.create({
            model: this.app.extConfig.openai_client_model || "",
            prompt: additional_context + this.replacePlaceholders(this.app.extConfig.openai_prompt_template, replacements),
            max_tokens: this.app.extConfig.n_predict,
            temperature: 0.1,
            top_p: this.defaultRequestParams.top_p,
            stream: this.defaultRequestParams.stream,
        });

        if (isPreparation) return;

        return {
            content: rsp.choices[0].text,
            generation_settings: {
                finish_reason: rsp.choices[0].finish_reason,
                model: rsp.model,
                created: rsp.created,
            },
            timings: {
                prompt_ms: rsp.usage?.prompt_tokens,
                predicted_ms: rsp.usage?.completion_tokens,
                predicted_n: rsp.usage?.total_tokens,
            },
        };
    }

    private createRequestPayload(noPredict: boolean, inputPrefix: string, inputSuffix: string, chunks: any[], prompt: string, nindent?: number) {
        if (noPredict) {
            return {
                input_prefix: inputPrefix,
                input_suffix: inputSuffix,
                input_extra: chunks,
                prompt,
                n_predict: 0,
                samplers: [],
                cache_prompt: true,
                t_max_prompt_ms: this.app.extConfig.t_max_prompt_ms,
                t_max_predict_ms: 1,
            };
        }

        return {
            input_prefix: inputPrefix,
            input_suffix: inputSuffix,
            input_extra: chunks,
            prompt,
            n_predict: this.app.extConfig.n_predict,
            ...this.defaultRequestParams,
            ...(nindent && { n_indent: nindent }),
            t_max_prompt_ms: this.app.extConfig.t_max_prompt_ms,
            t_max_predict_ms: this.app.extConfig.t_max_predict_ms,
        };
    }

    getFIMCompletion = async (
        inputPrefix: string,
        inputSuffix: string,
        prompt: string,
        chunks: any,
        nindent: number
    ): Promise<LlamaResponse | undefined> => {
        // If the server is OpenAI compatible, use the OpenAI API to get the completion
        if (this.app.extConfig.use_openai_endpoint) {
            const response = await this.handleOpenAICompletion(chunks, inputPrefix, inputSuffix, prompt);
            return response || undefined;
        }

        // else, default to llama.cpp
        const response = await axios.post<LlamaResponse>(
            `${this.app.extConfig.endpoint}/infill`,
            this.createRequestPayload(false, inputPrefix, inputSuffix, chunks, prompt, nindent),
            this.app.extConfig.axiosRequestConfig
        );

        return response.status === STATUS_OK ? response.data : undefined;
    };

    updateExtraContext = (chunks: any[]): void => {
        // If the server is OpenAI compatible, use the OpenAI API to prepare for the next FIM
        if (this.app.extConfig.use_openai_endpoint) {
            return;
        }

        // else, make a request to the API to prepare for the next FIM
        axios.post<LlamaResponse>(
            `${this.app.extConfig.endpoint}/infill`,
            this.createRequestPayload(true, "", "", chunks, "", undefined),
            this.app.extConfig.axiosRequestConfig
        );
    };

    onlaunchCmdClose = (callback: (data: { code: number, stderr: string }) => void): void => {
        this.eventEmitter.on('processClosed', callback);
    }

    shellCmd = (launchCmd: string): void => {
        if (!launchCmd) {
            return;
        }
        if (!this.app.extConfig.external_terminal){
            this.vsCodeTerminal = vscode.window.createTerminal({
                name: 'llama.cpp Command Terminal'
            });
            this.vsCodeTerminal.show(true);
            this.vsCodeTerminal.sendText(launchCmd);
            return
        }
    
        if (process.platform == 'win32'){          
            this.childProcess = cp.spawn(launchCmd, [], { shell: true, stdio: 'inherit', detached: true});
            if (this.childProcess.stderr) {
                this.childProcess.stderr.on('data', (data) => {
                    this.childProcessStdErr += data;
                });
            }
            this.childProcess.on('close', (code) => {
                this.eventEmitter.emit('processClosed', { code, stderr: this.childProcessStdErr });
                this.childProcessStdErr = "";
            });
        } else if (process.platform === 'darwin') {
            // this.childProcess = cp.spawn('osascript', [
            //     '-e',
            //     `tell application "Terminal" to do script "${launchCmd}"`
            //   ], {
            //     detached: true,
            //     stdio: 'inherit'
            //   });
            
            const startScript = `
            tell application "Terminal"
                activate
                set newTab to do script "echo 'Running command'; ${launchCmd}"
                delay 0.5 -- give Terminal time to create the tab/window
                set custom title of newTab to "${this.uniqueTerminalTitle}"
            end tell
            `;

            cp.exec(`osascript -e '${startScript}'`, (error, stdout, stderr) => {
            if (error) {
                console.error("Error launching Terminal:", error);
            }
            });
        } else if (process.platform === 'linux') {
            this.childProcess = cp.spawn('gnome-terminal', [
                '--disable-factory', // Force a new terminal instance
                '--',
                'bash',
                '-c',
                `${launchCmd}; exec bash`
              ], {
                detached: true,
                stdio: 'ignore'
              });
              this.childProcess.unref()
            
            // // Send the shell command to the terminal
            // terminal.sendText(launchCmd);
        }
    }

    killCmd = (): void => {       
        if (!this.app.extConfig.external_terminal){
            if (this.vsCodeTerminal) this.vsCodeTerminal.dispose();
            return;
        }
        if (!this.childProcess) return;
        if (process.platform === 'win32') { 
            cp.exec(`taskkill /pid ${this.childProcess?.pid} /T /F`, (err, stdout, stderr) => {
                if (err) {
                  console.error('Failed to kill process llama-server:', err);
                } else {
                  console.log('Process tree llama-server terminated.');
                }   
              });
            } else if (process.platform == "linux") { 
                if (this.childProcess && this.childProcess.pid) {
                    let pid = this.childProcess.pid == undefined ? 0 : this.childProcess.pid
                    try {
                        process.kill(-this.childProcess.pid, 'SIGTERM'); // Try SIGTERM first
                        setTimeout(() => process.kill(-pid, 'SIGKILL'), 1000); // Force kill if needed
                    } catch (err) {
                        console.error('Failed to kill process:', err);
                    }
                }
            } else if(process.platform == "darwin"){
                const killScript = `
                    tell application "Terminal"
                        set winList to every window
                        repeat with w in winList
                        set tabList to tabs of w
                        repeat with t in tabList
                            try
                            if custom title of t is equal to "${this.uniqueTerminalTitle}" then
                                close t
                                exit repeat
                            end if
                            end try
                        end repeat
                        end repeat
                    end tell
                    `;

                cp.exec(`osascript -e '${killScript}'`, (error, stdout, stderr) => {
                if (error) {
                    console.error("Error closing Terminal:", error);
                }
                });
            }
    }        
}
