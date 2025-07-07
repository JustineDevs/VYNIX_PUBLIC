"use strict";
// First Published by JustineDevs
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionManager = void 0;
const SecurityManager_1 = require("../security/SecurityManager");
const crypto_1 = require("crypto");
class ConnectionManager {
    constructor() {
        this.connections = new Map();
        this.MAX_RETRIES = 3;
        this.CONNECTION_TIMEOUT = 5000; // 5 seconds
        this.securityManager = SecurityManager_1.SecurityManager.getInstance();
    }
    static getInstance() {
        if (!ConnectionManager.instance) {
            ConnectionManager.instance = new ConnectionManager();
        }
        return ConnectionManager.instance;
    }
    async getConnection(endpoint) {
        const existingConnection = this.connections.get(endpoint);
        if (existingConnection && this.isConnectionValid(existingConnection)) {
            return existingConnection;
        }
        return await this.establishConnection(endpoint);
    }
    async establishConnection(endpoint, retryCount = 0) {
        try {
            // Validate IP before establishing connection
            const ip = new URL(endpoint).hostname;
            if (!this.securityManager.validateIp(ip)) {
                throw new Error('IP not whitelisted or rate limit exceeded');
            }
            const connection = {
                id: (0, crypto_1.randomUUID)(),
                endpoint,
                lastUsed: Date.now(),
                isActive: true
            };
            this.connections.set(endpoint, connection);
            return connection;
        }
        catch (error) {
            if (retryCount < this.MAX_RETRIES) {
                // Exponential backoff
                const delay = Math.pow(2, retryCount) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.establishConnection(endpoint, retryCount + 1);
            }
            throw error;
        }
    }
    isConnectionValid(connection) {
        const age = Date.now() - connection.lastUsed;
        return connection.isActive && age < this.CONNECTION_TIMEOUT;
    }
    closeConnection(endpoint) {
        const connection = this.connections.get(endpoint);
        if (connection) {
            connection.isActive = false;
            this.connections.delete(endpoint);
        }
    }
    // Cleanup inactive connections periodically
    cleanup() {
        for (const [endpoint, connection] of this.connections.entries()) {
            if (!this.isConnectionValid(connection)) {
                this.closeConnection(endpoint);
            }
        }
    }
    // Start cleanup interval
    startCleanup(interval = 60000) {
        setInterval(() => this.cleanup(), interval);
    }
}
exports.ConnectionManager = ConnectionManager;
//# sourceMappingURL=ConnectionManager.js.map