"use strict";
// First Published by JustineDevs
Object.defineProperty(exports, "__esModule", { value: true });
const SecurityManager_1 = require("./SecurityManager");
// Mock environment variables
process.env.KEY_PASSPHRASE = 'test-passphrase';
describe('SecurityManager', () => {
    let securityManager;
    beforeEach(() => {
        // Reset instance before each test to ensure isolation
        SecurityManager_1.SecurityManager.instance = undefined;
        securityManager = SecurityManager_1.SecurityManager.getInstance();
    });
    it('should be a singleton', () => {
        const instance1 = SecurityManager_1.SecurityManager.getInstance();
        const instance2 = SecurityManager_1.SecurityManager.getInstance();
        expect(instance1).toBe(instance2);
    });
    it('should generate a valid RSA key pair', async () => {
        const { publicKey, privateKey } = await securityManager.generateApiKeyPair();
        expect(publicKey).toContain('-----BEGIN PUBLIC KEY-----');
        expect(privateKey).toContain('-----BEGIN ENCRYPTED PRIVATE KEY-----');
    });
    it('should validate a newly generated API key', async () => {
        const { publicKey } = await securityManager.generateApiKeyPair();
        const isValid = await securityManager.validateApiKey(publicKey);
        expect(isValid).toBe(true);
    });
    it('should not validate a non-existent API key', async () => {
        const isValid = await securityManager.validateApiKey('non-existent-key');
        expect(isValid).toBe(false);
    });
    it('should add an IP to the whitelist and validate it', () => {
        const ip = '192.168.1.100';
        securityManager.addToWhitelist(ip);
        expect(securityManager.validateIp(ip)).toBe(true);
    });
    it('should not validate an IP that is not whitelisted', () => {
        const ip = '192.168.1.101';
        expect(securityManager.validateIp(ip)).toBe(false);
    });
});
//# sourceMappingURL=SecurityManager.test.js.map