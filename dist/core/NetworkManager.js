"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NetworkManager = void 0;
// First Published by JustineDevs
const fs_1 = __importDefault(require("fs"));
class NetworkManager {
    constructor() {
        this.networks = [];
        this.filePath = 'networks.json';
        this.loadNetworks();
    }
    loadNetworks() {
        if (fs_1.default.existsSync(this.filePath)) {
            const fileContent = fs_1.default.readFileSync(this.filePath, 'utf-8');
            if (fileContent) {
                this.networks = JSON.parse(fileContent);
            }
        }
    }
    listNetworks() {
        return this.networks;
    }
    addNetwork(network) {
        this.networks.push(network);
        this.saveNetworks();
    }
    saveNetworks() {
        fs_1.default.writeFileSync(this.filePath, JSON.stringify(this.networks, null, 2));
    }
}
exports.NetworkManager = NetworkManager;
//# sourceMappingURL=NetworkManager.js.map