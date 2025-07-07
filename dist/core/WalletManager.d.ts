export interface WalletData {
    address: string;
    privateKey: string;
}
export declare class WalletManager {
    private wallets;
    private readonly filePath;
    constructor();
    private loadWallets;
    listWallets(): WalletData[];
    addWallet(wallet: WalletData): void;
    private saveWallets;
}
