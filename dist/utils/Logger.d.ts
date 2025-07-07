export declare class Logger {
    private static instance;
    private logger;
    private constructor();
    static getInstance(): Logger;
    info(message: string, meta?: any): void;
    error(message: string, error?: Error): void;
    warn(message: string, meta?: any): void;
    debug(message: string, meta?: any): void;
    logSecurityEvent(event: string, details: any): void;
}
