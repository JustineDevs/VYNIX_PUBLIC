/**
 * The main Bot class, responsible for orchestrating the application's logic.
 */
export declare class Bot {
    private securityManager;
    private connectionManager;
    private logger;
    private networkManager;
    private walletManager;
    private taskManager;
    constructor();
    run(): Promise<void>;
    private mainMenu;
    private networkMenu;
    private walletMenu;
    private taskMenu;
    private handleSwap;
    private handleAddLiquidity;
    private selectNetwork;
    private selectWallet;
    private viewNetworks;
    private addNetwork;
    private viewWallets;
    private addWallet;
}
