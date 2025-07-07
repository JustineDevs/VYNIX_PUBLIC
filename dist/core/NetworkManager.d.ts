export interface Network {
    name: string;
    rpc: string;
    chainId: number;
}
export declare class NetworkManager {
    private networks;
    private readonly filePath;
    constructor();
    private loadNetworks;
    listNetworks(): Network[];
    addNetwork(network: Network): void;
    private saveNetworks;
}
