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
const TaskManager_1 = require("./core/TaskManager");
const inquirer_1 = __importDefault(require("inquirer"));
const ethers_1 = require("ethers");
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
        this.taskManager = new TaskManager_1.TaskManager();
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
                        'Manage Networks',
                        'Manage Wallets',
                        'Perform Tasks',
                        'Exit'
                    ]
                }
            ]);
            switch (menuChoice) {
                case 'Manage Networks':
                    await this.networkMenu();
                    break;
                case 'Manage Wallets':
                    await this.walletMenu();
                    break;
                case 'Perform Tasks':
                    await this.taskMenu();
                    break;
                case 'Exit':
                    exit = true;
                    this.logger.info('Exiting Vynix Bot.');
                    break;
            }
        }
    }
    async networkMenu() {
        const { choice } = await inquirer_1.default.prompt([{
                type: 'list',
                name: 'choice',
                message: 'Network Management',
                choices: ['View Networks', 'Add Network', 'Back']
            }]);
        if (choice === 'View Networks')
            this.viewNetworks();
        if (choice === 'Add Network')
            await this.addNetwork();
    }
    async walletMenu() {
        const { choice } = await inquirer_1.default.prompt([{
                type: 'list',
                name: 'choice',
                message: 'Wallet Management',
                choices: ['View Wallets', 'Add Wallet', 'Back']
            }]);
        if (choice === 'View Wallets')
            this.viewWallets();
        if (choice === 'Add Wallet')
            await this.addWallet();
    }
    async taskMenu() {
        const { taskChoice } = await inquirer_1.default.prompt([
            {
                type: 'list',
                name: 'taskChoice',
                message: 'Select a task to perform:',
                choices: ['Swap Tokens', 'Add Liquidity', 'Back']
            }
        ]);
        if (taskChoice === 'Back')
            return;
        const network = await this.selectNetwork();
        if (!network)
            return;
        const walletData = await this.selectWallet();
        if (!walletData)
            return;
        const provider = new ethers_1.JsonRpcProvider(network.rpc);
        const wallet = new ethers_1.Wallet(walletData.privateKey, provider);
        if (taskChoice === 'Swap Tokens') {
            await this.handleSwap(network, wallet);
        }
        else if (taskChoice === 'Add Liquidity') {
            await this.handleAddLiquidity(network, wallet);
        }
    }
    async handleSwap(network, wallet) {
        const { tokenIn, tokenOut, amount } = await inquirer_1.default.prompt([
            { name: 'tokenIn', message: 'Token to swap FROM (address):' },
            { name: 'tokenOut', message: 'Token to swap TO (address):' },
            { name: 'amount', message: 'Amount to swap:' }
        ]);
        await this.taskManager.swapTokens(network, wallet, tokenIn, tokenOut, amount);
    }
    async handleAddLiquidity(network, wallet) {
        const { tokenA, tokenB, amountA, amountB } = await inquirer_1.default.prompt([
            { name: 'tokenA', message: 'Token A address:' },
            { name: 'tokenB', message: 'Token B address:' },
            { name: 'amountA', message: 'Amount of Token A:' },
            { name: 'amountB', message: 'Amount of Token B:' }
        ]);
        await this.taskManager.addLiquidity(network, wallet, tokenA, tokenB, amountA, amountB);
    }
    async selectNetwork() {
        const networks = this.networkManager.listNetworks();
        if (networks.length === 0) {
            console.log('No networks found. Please add a network first.');
            return null;
        }
        const { networkName } = await inquirer_1.default.prompt([{
                type: 'list',
                name: 'networkName',
                message: 'Select a network:',
                choices: networks.map(n => n.name)
            }]);
        return networks.find(n => n.name === networkName) || null;
    }
    async selectWallet() {
        const wallets = this.walletManager.listWallets();
        if (wallets.length === 0) {
            console.log('No wallets found. Please add a wallet first.');
            return null;
        }
        const { walletAddress } = await inquirer_1.default.prompt([{
                type: 'list',
                name: 'walletAddress',
                message: 'Select a wallet:',
                choices: wallets.map(w => w.address)
            }]);
        return wallets.find(w => w.address === walletAddress) || null;
    }
    viewNetworks() {
        const networks = this.networkManager.listNetworks();
        if (networks.length === 0) {
            console.log('No networks found.');
        }
        else {
            console.log('\nAvailable Networks:');
            networks.forEach((n, i) => {
                console.log(`${i + 1}. ${n.name}`);
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
            console.log('\nAvailable Wallets:');
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