"use strict";
// First Published by JustineDevs
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
class Logger {
    constructor() {
        this.logger = winston_1.default.createLogger({
            level: 'info',
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
            transports: [
                new winston_1.default.transports.File({
                    filename: path_1.default.join(__dirname, '../../logs/error.log'),
                    level: 'error'
                }),
                new winston_1.default.transports.File({
                    filename: path_1.default.join(__dirname, '../../logs/combined.log')
                })
            ]
        });
        // Add console logging in development
        if (process.env.NODE_ENV !== 'production') {
            this.logger.add(new winston_1.default.transports.Console({
                format: winston_1.default.format.simple()
            }));
        }
    }
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    info(message, meta) {
        this.logger.info(message, meta);
    }
    error(message, error) {
        this.logger.error(message, {
            error: error ? {
                message: error.message,
                stack: error.stack
            } : undefined
        });
    }
    warn(message, meta) {
        this.logger.warn(message, meta);
    }
    debug(message, meta) {
        this.logger.debug(message, meta);
    }
    // Security specific logging
    logSecurityEvent(event, details) {
        this.logger.warn('Security Event', {
            event,
            details,
            timestamp: new Date().toISOString()
        });
    }
}
exports.Logger = Logger;
//# sourceMappingURL=Logger.js.map