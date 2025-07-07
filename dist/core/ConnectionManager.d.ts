interface Connection {
    id: string;
    endpoint: string;
    lastUsed: number;
    isActive: boolean;
}
export declare class ConnectionManager {
    private static instance;
    private connections;
    private securityManager;
    private readonly MAX_RETRIES;
    private readonly CONNECTION_TIMEOUT;
    private constructor();
    static getInstance(): ConnectionManager;
    getConnection(endpoint: string): Promise<Connection>;
    private establishConnection;
    private isConnectionValid;
    closeConnection(endpoint: string): void;
    private cleanup;
    startCleanup(interval?: number): void;
}
export {};
