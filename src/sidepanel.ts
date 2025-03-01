import * as vscode from "vscode"
import { AssistantMessage } from "./messages"
import { Application } from "./application";
import { Uri } from "vscode";

export class SidePanel implements vscode.WebviewViewProvider {
	public static readonly sideBarId = "llama-vscode.SidePanel"
  private disposables: vscode.Disposable[] = []
  private webviewView ?: vscode.WebviewView;
  private context?: vscode.ExtensionContext
  
  constructor(private app: Application) {}
  
  initializeSidePanel(context: vscode.ExtensionContext) {
    this.disposables.push(
      vscode.window.registerWebviewViewProvider(SidePanel.sideBarId, this, {
        webviewOptions: { retainContextWhenHidden: true },
      })),
    this.context = context
    vscode.workspace.onDidChangeConfiguration((event) => {
      // const config = vscode.workspace.getConfiguration("llama-vscode");
      // this.app.extConfig.updateOnEvent(event, config);
      // TODO wait some more.
      if (this.webviewView) {
        this.webviewView.webview.postMessage({ type: "configuration", configuration: this.app.extConfig })
      }
    }, this.disposables);
  }

  private dispose() {
    while (this.disposables.length) {
      const item = this.disposables.pop()
      if (item) {
        item.dispose()
      }
    }
    // this.webviewView?.dispose()
  }
  
  resolveWebviewView(
      webviewView: vscode.WebviewView,
      context: vscode.WebviewViewResolveContext,
      token: vscode.CancellationToken): Thenable<void> | void {
		this.webviewView  = webviewView 
    if (!this.context) throw new Error("Context is not initialized")

    const extensionUri = this.context.extensionUri;
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [extensionUri],
		}
		webviewView.onDidDispose(() => this.dispose(), null, this.disposables)

    const getUri = (...parts: string[]) => webviewView.webview.asWebviewUri(Uri.joinPath(extensionUri, ...parts))
    
    // Get the local path to the built webview UI
    const scriptUri = getUri('build', 'index.js');
    
		webviewView.webview.html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webviewView.webview.cspSource}; script-src ${webviewView.webview.cspSource};">
          <title>Llama VSCode</title>
      </head>
      <body>
          <div id="root"></div>
          <script src="${scriptUri}"></script>
      </body>
      </html>
    `

		webviewView.webview.onDidReceiveMessage(
			async (message: AssistantMessage) => {
				switch (message.type) {
					case "webviewDidLaunch":
						// this.postStateToWebview()
        }
      });


		// await this.view?.webview.postMessage(message)
  }

}
