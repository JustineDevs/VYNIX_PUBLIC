"use strict";
// First Published by JustineDevs
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Bot = void 0;
const SecurityManager_1 = require("./security/SecurityManager");
const ConnectionManager_1 = require("./core/ConnectionManager");
const Logger_1 = require("./utils/Logger");
const NetworkManager_1 = require("./core/NetworkManager");
const WalletManager_1 = require("./core/WalletManager");
const inquirer_1 = __importDefault(require("inquirer"));
/**
 * The main Bot class, responsible for orchestrating the application's logic.
 */
class Bot {
    constructor() {
        this.securityManager = SecurityManager_1.SecurityManager.getInstance();
        this.connectionManager = ConnectionManager_1.ConnectionManager.getInstance();
        this.logger = Logger_1.Logger.getInstance();
        this.networkManager = new NetworkManager_1.NetworkManager();
        this.walletManager = new WalletManager_1.WalletManager();
        this.logger.info('Vynix Bot instance created.');
    }
    async run() {
        this.logger.info('Bot is running...');
        await this.mainMenu();
    }
    async mainMenu() {
        let exit = false;
        while (!exit) {
            const { menuChoice } = await inquirer_1.default.prompt([
                {
                    type: 'list',
                    name: 'menuChoice',
                    message: 'Vynix Bot Dashboard - Main Menu',
                    choices: [
                        'View Networks',
                        'Add Network',
                        'View Wallets',
                        'Add Wallet',
                        'Exit'
                    ]
                }
            ]);
            switch (menuChoice) {
                case 'View Networks':
                    this.viewNetworks();
                    break;
                case 'Add Network':
                    await this.addNetwork();
                    break;
                case 'View Wallets':
                    this.viewWallets();
                    break;
                case 'Add Wallet':
                    await this.addWallet();
                    break;
                case 'Exit':
                    exit = true;
                    this.logger.info('Exiting Vynix Bot.');
                    break;
            }
        }
    }
    viewNetworks() {
        const networks = this.networkManager.listNetworks();
        if (networks.length === 0) {
            console.log('No networks found.');
        }
        else {
            console.log('\nNetworks:');
            networks.forEach((n, i) => {
                console.log(`${i + 1}. ${n.name} (RPC: ${n.rpc}, Chain ID: ${n.chainId})`);
            });
        }
    }
    async addNetwork() {
        const answers = await inquirer_1.default.prompt([
            { name: 'name', message: 'Network name:' },
            { name: 'rpc', message: 'RPC URL:' },
            { name: 'chainId', message: 'Chain ID:', validate: (v) => !isNaN(Number(v)) || 'Must be a number' }
        ]);
        this.networkManager.addNetwork({
            name: answers.name,
            rpc: answers.rpc,
            chainId: Number(answers.chainId)
        });
        console.log('Network added!');
    }
    viewWallets() {
        const wallets = this.walletManager.listWallets();
        if (wallets.length === 0) {
            console.log('No wallets found.');
        }
        else {
            console.log('\nWallets:');
            wallets.forEach((w, i) => {
                console.log(`${i + 1}. ${w.address}`);
            });
        }
    }
    async addWallet() {
        const answers = await inquirer_1.default.prompt([
            { name: 'address', message: 'Wallet address:' },
            { name: 'privateKey', message: 'Private key:' }
        ]);
        this.walletManager.addWallet({
            address: answers.address,
            privateKey: answers.privateKey
        });
        console.log('Wallet added!');
    }
}
exports.Bot = Bot;
//# sourceMappingURL=Bot.js.map