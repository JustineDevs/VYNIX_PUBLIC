/**
 * The main Bot class, responsible for orchestrating the application's logic.
 */
export declare class Bot {
    private securityManager;
    private connectionManager;
    private logger;
    private networkManager;
    private walletManager;
    constructor();
    run(): Promise<void>;
    private mainMenu;
    private viewNetworks;
    private addNetwork;
    private viewWallets;
    private addWallet;
}
