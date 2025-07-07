"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletManager = void 0;
// First Published by JustineDevs
const fs_1 = __importDefault(require("fs"));
class WalletManager {
    constructor() {
        this.wallets = [];
        this.filePath = 'wallets.json';
        this.loadWallets();
    }
    loadWallets() {
        if (fs_1.default.existsSync(this.filePath)) {
            this.wallets = JSON.parse(fs_1.default.readFileSync(this.filePath, 'utf-8'));
        }
    }
    listWallets() {
        return this.wallets;
    }
    addWallet(wallet) {
        this.wallets.push(wallet);
        this.saveWallets();
    }
    saveWallets() {
        fs_1.default.writeFileSync(this.filePath, JSON.stringify(this.wallets, null, 2));
    }
}
exports.WalletManager = WalletManager;
//# sourceMappingURL=WalletManager.js.map