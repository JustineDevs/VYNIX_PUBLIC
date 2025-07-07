export interface ISecurityManager {
    generateApiKeyPair(): Promise<{
        publicKey: string;
        privateKey: string;
    }>;
    validateApiKey(apiKey: string): Promise<boolean>;
    addToWhitelist(ip: string, duration?: number): void;
    validateIp(ip: string): boolean;
    getRateLimit(ip: string): number;
    resetRateLimit(ip: string): void;
}
