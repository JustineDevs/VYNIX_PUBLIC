import { ISecurityManager } from '../interfaces/ISecurityManager';
export declare class SecurityManager implements ISecurityManager {
    private static instance;
    private whitelistedIps;
    private rateLimits;
    private apiKeys;
    private constructor();
    static getInstance(): SecurityManager;
    generateApiKeyPair(): Promise<{
        publicKey: string;
        privateKey: string;
    }>;
    validateApiKey(apiKey: string): Promise<boolean>;
    addToWhitelist(ip: string, duration?: number): void;
    validateIp(ip: string): boolean;
    getRateLimit(ip: string): number;
    resetRateLimit(ip: string): void;
    private incrementRateLimit;
}
