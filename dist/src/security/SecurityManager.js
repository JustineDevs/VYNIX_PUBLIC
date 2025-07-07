"use strict";
// First Published by JustineDevs
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityManager = void 0;
const crypto_1 = __importDefault(require("crypto"));
class SecurityManager {
    constructor() {
        this.whitelistedIps = new Set();
        this.rateLimits = new Map();
        this.apiKeys = new Map();
    }
    static getInstance() {
        if (!SecurityManager.instance) {
            SecurityManager.instance = new SecurityManager();
        }
        return SecurityManager.instance;
    }
    async generateApiKeyPair() {
        const { publicKey, privateKey } = crypto_1.default.generateKeyPairSync('rsa', {
            modulusLength: 4096,
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem'
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem',
                cipher: 'aes-256-cbc',
                passphrase: process.env.KEY_PASSPHRASE || 'default-passphrase'
            }
        });
        const timestamp = Date.now();
        this.apiKeys.set(publicKey, { publicKey, timestamp });
        return { publicKey, privateKey };
    }
    async validateApiKey(apiKey) {
        const keyData = this.apiKeys.get(apiKey);
        if (!keyData)
            return false;
        // Check if key is expired (30 days)
        const isExpired = Date.now() - keyData.timestamp > 30 * 24 * 60 * 60 * 1000;
        if (isExpired) {
            this.apiKeys.delete(apiKey);
            return false;
        }
        return true;
    }
    addToWhitelist(ip, duration) {
        this.whitelistedIps.add(ip);
        if (duration) {
            setTimeout(() => {
                this.whitelistedIps.delete(ip);
            }, duration);
        }
    }
    validateIp(ip) {
        return this.whitelistedIps.has(ip) && this.getRateLimit(ip) < 60; // 60 requests per minute
    }
    getRateLimit(ip) {
        return this.rateLimits.get(ip) || 0;
    }
    resetRateLimit(ip) {
        this.rateLimits.set(ip, 0);
    }
    // Internal method to increment rate limit
    incrementRateLimit(ip) {
        const current = this.getRateLimit(ip);
        this.rateLimits.set(ip, current + 1);
        // Reset after 1 minute
        setTimeout(() => {
            this.resetRateLimit(ip);
        }, 60 * 1000);
    }
}
exports.SecurityManager = SecurityManager;
//# sourceMappingURL=SecurityManager.js.map