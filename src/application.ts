import {Configuration} from "./configuration";
import {ExtraContext} from "./extra-context";
import {LlamaServer} from "./llama-server";
import {LRUCache} from "./lru-cache";
import {Architect} from "./architect";
import {Statusbar} from "./statusbar";
import {Menu} from "./menu";
import {Completion} from "./completion";
import {Logger} from "./logger";
import { SidePanel } from "./sidepanel";

export class Application {
    private static instance: Application;
    public extConfig: Configuration;
    public extraContext: ExtraContext;
    public llamaServer: LlamaServer
    public lruResultCache: LRUCache
    public architect: Architect
    public statusbar: Statusbar
    public sidePanel: SidePanel
    public menu: Menu
    public completion: Completion
    public logger: Logger

    private constructor() {
        this.extConfig = new Configuration()
        this.llamaServer = new LlamaServer(this)
        this.extraContext = new ExtraContext(this)
        this.lruResultCache = new LRUCache(this.extConfig.max_cache_keys);
        this.architect = new Architect(this);
        this.statusbar = new Statusbar(this)
        this.sidePanel = new SidePanel(this)
        this.menu = new Menu(this)
        this.completion = new Completion(this)
        this.logger = new Logger(this)
    }

    public static getInstance(): Application {
        if (!Application.instance) {
            Application.instance = new Application();
        }
        return Application.instance;
    }

}
