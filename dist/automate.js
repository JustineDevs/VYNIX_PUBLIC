"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
// @ts-ignore
const dotenv = __importStar(require("dotenv"));
const chalk_1 = __importDefault(require("chalk"));
const inquirer_1 = __importDefault(require("inquirer"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const NonfungiblePositionManager_json_1 = require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json");
const ENV_PATH = path_1.default.resolve(__dirname, "env");
// Load environment variables
dotenv.config({ path: ENV_PATH });
const NETWORKS_PATH = path_1.default.resolve(__dirname, "networks.json");
const TOKENS_PATH = path_1.default.resolve(__dirname, "tokens.json");
const SWAP_HISTORY_PATH = path_1.default.resolve(__dirname, "swapHistory.json");
const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function balanceOf(address owner) external view returns (uint256)"
];
// Helper to write .env (now supports multiple keys)
function saveEnv(vars) {
    // Always write PRIVATE_KEY first if present, then PRIVATE_KEY1,2,...
    let env = "";
    if (vars["PRIVATE_KEY"])
        env += `PRIVATE_KEY=${vars["PRIVATE_KEY"]}\n`;
    // Write numbered keys in order
    Object.keys(vars)
        .filter(k => /^PRIVATE_KEY\d+$/.test(k))
        .sort((a, b) => Number(a.replace("PRIVATE_KEY", "")) - Number(b.replace("PRIVATE_KEY", "")))
        .forEach(k => {
        env += `${k}=${vars[k]}\n`;
    });
    // Write other vars
    Object.entries(vars).forEach(([k, v]) => {
        if (k !== "PRIVATE_KEY" && !/^PRIVATE_KEY\d+$/.test(k))
            env += `${k}=${v ?? ""}\n`;
    });
    fs_1.default.writeFileSync(ENV_PATH, env, { encoding: "utf-8" });
}
// Helper to load private keys from .env
function loadPrivateKeysFromEnv() {
    const keys = [];
    Object.entries(process.env).forEach(([k, v]) => {
        if ((k === "PRIVATE_KEY" || /^PRIVATE_KEY\d+$/.test(k)) && v && v.startsWith("0x"))
            keys.push(v);
    });
    return keys;
}
// New: Prompt for .env creation and private key import
async function setupEnvAndKeys() {
    let envVars = {};
    if (!fs_1.default.existsSync(ENV_PATH)) {
        const { createEnv } = await inquirer_1.default.prompt([
            { type: "confirm", name: "createEnv", message: "Do you want the bot to create a .env file for you?", default: true }
        ]);
        if (createEnv) {
            const { keyMode } = await inquirer_1.default.prompt([
                { type: "list", name: "keyMode", message: "Import a single private key or multiple?", choices: ["Single", "Multiple"] }
            ]);
            let keys = [];
            if (keyMode === "Single") {
                const { pk } = await inquirer_1.default.prompt([
                    { type: "password", name: "pk", message: "Enter your private key:", mask: "*", validate: (input) => /^0x[0-9a-fA-F]{64}$/.test(input) || "Invalid private key format!" }
                ]);
                keys = [pk];
            }
            else {
                let addMore = true;
                while (addMore) {
                    const { pk } = await inquirer_1.default.prompt([
                        { type: "password", name: "pk", message: `Enter private key #${keys.length + 1}:`, mask: "*", validate: (input) => /^0x[0-9a-fA-F]{64}$/.test(input) || "Invalid private key format!" }
                    ]);
                    keys.push(pk);
                    const { more } = await inquirer_1.default.prompt([
                        { type: "confirm", name: "more", message: "Add another private key?", default: false }
                    ]);
                    addMore = more;
                }
            }
            keys.forEach((k, i) => envVars[`PRIVATE_KEY_${i + 1}`] = k);
            saveEnv(envVars);
            console.log(chalk_1.default.green(".env file created with your private key(s)!"));
            console.log(chalk_1.default.cyan("Recommendations:"));
            console.log("- Keep your .env file secure and never share it.");
            console.log("- You can add/remove keys later by editing .env or using the bot's menu.");
            console.log("- Only use testnet keys for safety.");
            dotenv.config();
        }
    }
    // Always reload env after possible changes
    dotenv.config();
    return loadPrivateKeysFromEnv();
}
// Helper to load or prompt for networks
async function getNetworks() {
    let networks = [];
    if (fs_1.default.existsSync(NETWORKS_PATH)) {
        networks = JSON.parse(fs_1.default.readFileSync(NETWORKS_PATH, "utf-8"));
    }
    if (networks.length === 0) {
        const { addNetwork } = await inquirer_1.default.prompt([
            {
                type: "confirm",
                name: "addNetwork",
                message: "No networks found. Add a custom testnet network?",
                default: true
            }
        ]);
        if (addNetwork) {
            networks.push(await promptAddNetwork());
            fs_1.default.writeFileSync(NETWORKS_PATH, JSON.stringify(networks, null, 2));
        }
    }
    return networks;
}
async function promptAddNetwork(existingNetworks = []) {
    while (true) {
        const answers = await inquirer_1.default.prompt([
            { type: "input", name: "name", message: "Network name:" },
            { type: "input", name: "rpc", message: "RPC URL:" },
            { type: "input", name: "chainId", message: "Chain ID:", validate: (v) => !isNaN(Number(v)) || "Must be a number" },
            { type: "input", name: "currencySymbol", message: "Currency Symbol:" },
            { type: "input", name: "explorer", message: "Block Explorer (optional):" }
        ]);
        const duplicate = existingNetworks.find((n) => n.rpc === answers.rpc || n.name === answers.name || n.chainId === Number(answers.chainId));
        if (duplicate) {
            log.warn("This network already exists. You can view or manage it from the Network Options menu.");
            const { whatNext } = await inquirer_1.default.prompt([
                { type: "list", name: "whatNext", message: "What do you want to do?", choices: ["Back to Menu", "Try Again"] }
            ]);
            if (whatNext === "Back to Menu")
                return null;
            continue;
        }
        return { ...answers, chainId: Number(answers.chainId) };
    }
}
// Helper to load or prompt for tokens
async function getTokens() {
    let tokens = [];
    if (fs_1.default.existsSync(TOKENS_PATH)) {
        tokens = JSON.parse(fs_1.default.readFileSync(TOKENS_PATH, "utf-8"));
    }
    if (tokens.length === 0) {
        const { addToken } = await inquirer_1.default.prompt([
            {
                type: "confirm",
                name: "addToken",
                message: "No tokens found. Add a token contract?",
                default: true
            }
        ]);
        if (addToken) {
            tokens.push(await promptAddToken());
            fs_1.default.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
        }
    }
    // Enhancement: Ask if user wants to add more pairs
    let addMore = true;
    while (addMore) {
        const { wantMore } = await inquirer_1.default.prompt([
            {
                type: "confirm",
                name: "wantMore",
                message: "Do you want to add another token pair (smart contract)?",
                default: false
            }
        ]);
        if (wantMore) {
            tokens.push(await promptAddToken());
            fs_1.default.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
        }
        else {
            addMore = false;
        }
    }
    return tokens;
}
async function promptAddToken(existingTokens = []) {
    while (true) {
        const answers = await inquirer_1.default.prompt([
            { type: "input", name: "address", message: "Token contract address:" },
            { type: "input", name: "symbol", message: "Token symbol:" },
            { type: "input", name: "decimals", message: "Token decimals:", validate: (v) => !isNaN(Number(v)) || "Must be a number" }
        ]);
        const duplicate = existingTokens.find((t) => t.address.toLowerCase() === answers.address.toLowerCase() || t.symbol === answers.symbol);
        if (duplicate) {
            log.warn("This token already exists. You can view or manage it from the Token Options menu.");
            const { whatNext } = await inquirer_1.default.prompt([
                { type: "list", name: "whatNext", message: "What do you want to do?", choices: ["Back to Menu", "Try Again"] }
            ]);
            if (whatNext === "Back to Menu")
                return null;
            continue;
        }
        return { ...answers, decimals: Number(answers.decimals) };
    }
}
// Banner
function printBanner() {
    console.log(chalk_1.default.cyan(`\n==============================`));
    console.log(chalk_1.default.cyan(`      Testnet Automation Bot   `));
    console.log(chalk_1.default.cyan(`  Pharos Testnet Swap Bot v1.0 `));
    console.log(chalk_1.default.cyan(`==============================\n`));
}
// Logging helpers
const log = {
    success: (msg) => console.log(chalk_1.default.green("✅ " + msg)),
    warn: (msg) => console.log(chalk_1.default.yellow("⚠️  " + msg)),
    error: (msg) => console.log(chalk_1.default.red("❌ " + msg)),
    loading: (msg) => console.log(chalk_1.default.cyan("🔄 " + msg)),
    step: (msg) => console.log(chalk_1.default.white("➤ " + msg)),
    info: (msg) => console.log(chalk_1.default.cyan("ℹ️  " + msg)),
};
// Ctrl+C menu
function setupSigintMenu({ networks, tokens }) {
    process.on("SIGINT", async () => {
        log.warn("Bot paused. Menu:");
        const { action } = await inquirer_1.default.prompt([
            {
                type: "list",
                name: "action",
                message: "Choose an option:",
                choices: [
                    "Add Network",
                    "Remove Network",
                    "Add Token",
                    "Remove Token",
                    "Resume Automation",
                    "Exit"
                ]
            }
        ]);
        if (action === "Add Network") {
            networks.push(await promptAddNetwork());
            fs_1.default.writeFileSync(NETWORKS_PATH, JSON.stringify(networks, null, 2));
            log.success("Network added.");
        }
        else if (action === "Remove Network") {
            if (networks.length === 0)
                return log.warn("No networks to remove.");
            const { idx } = await inquirer_1.default.prompt([
                { type: "list", name: "idx", message: "Select network to remove:", choices: networks.map((n, i) => ({ name: n.name, value: i })) }
            ]);
            networks.splice(idx, 1);
            fs_1.default.writeFileSync(NETWORKS_PATH, JSON.stringify(networks, null, 2));
            log.success("Network removed.");
        }
        else if (action === "Add Token") {
            tokens.push(await promptAddToken());
            fs_1.default.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
            log.success("Token added.");
        }
        else if (action === "Remove Token") {
            if (tokens.length === 0)
                return log.warn("No tokens to remove.");
            const { idx } = await inquirer_1.default.prompt([
                { type: "list", name: "idx", message: "Select token to remove:", choices: tokens.map((t, i) => ({ name: t.symbol, value: i })) }
            ]);
            tokens.splice(idx, 1);
            fs_1.default.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
            log.success("Token removed.");
        }
        else if (action === "Resume Automation") {
            log.loading("Resuming bot...");
            return;
        }
        else if (action === "Exit") {
            log.warn("Exiting bot.");
            process.exit(0);
        }
        // Show menu again after action
        setupSigintMenu({ networks, tokens });
    });
}
function loadSwapHistory() {
    if (fs_1.default.existsSync(SWAP_HISTORY_PATH)) {
        try {
            return JSON.parse(fs_1.default.readFileSync(SWAP_HISTORY_PATH, "utf-8"));
        }
        catch {
            return [];
        }
    }
    return [];
}
function saveSwapHistory(history) {
    fs_1.default.writeFileSync(SWAP_HISTORY_PATH, JSON.stringify(history, null, 2));
}
let swapHistory = loadSwapHistory();
let automationActive = false;
let username = "";
let simulationMode = false;
async function getUsername() {
    const { user } = await inquirer_1.default.prompt([
        { type: "input", name: "user", message: "Enter your username:" }
    ]);
    return user;
}
async function contractExists(provider, address) {
    try {
        const code = await provider.getCode(address);
        return typeof code === 'string' && code !== "0x";
    }
    catch {
        return false;
    }
}
// Add swap settings
let swapSettings = {
    intervalType: 'random', // 'random' or 'fixed'
    minInterval: 30000,
    maxInterval: 60000,
    fixedInterval: 45000,
};
async function swapSettingsMenu() {
    while (true) {
        const { swapAction } = await inquirer_1.default.prompt([
            {
                type: "list",
                name: "swapAction",
                message: "Swap Settings:",
                choices: [
                    "Set Random Interval",
                    "Set Fixed Interval",
                    "Show Current Settings",
                    "Back to Main Menu"
                ]
            }
        ]);
        if (swapAction === "Set Random Interval") {
            const minPrompt = await inquirer_1.default.prompt({
                type: "input",
                name: "min",
                message: "Minimum interval (ms):",
                default: String(swapSettings.minInterval),
                validate: (v) => !isNaN(Number(v)) && Number(v) > 0
            });
            const maxPrompt = await inquirer_1.default.prompt({
                type: "input",
                name: "max",
                message: "Maximum interval (ms):",
                default: String(swapSettings.maxInterval),
                validate: (v) => !isNaN(Number(v)) && Number(v) > 0
            });
            swapSettings.intervalType = 'random';
            swapSettings.minInterval = Number(minPrompt.min);
            swapSettings.maxInterval = Number(maxPrompt.max);
            log.success(`Random interval set: ${minPrompt.min}ms - ${maxPrompt.max}ms`);
        }
        else if (swapAction === "Set Fixed Interval") {
            const fixedPrompt = await inquirer_1.default.prompt({
                type: "input",
                name: "fixed",
                message: "Fixed interval (ms):",
                default: String(swapSettings.fixedInterval),
                validate: (v) => !isNaN(Number(v)) && Number(v) > 0
            });
            swapSettings.intervalType = 'fixed';
            swapSettings.fixedInterval = Number(fixedPrompt.fixed);
            log.success(`Fixed interval set: ${fixedPrompt.fixed}ms`);
        }
        else if (swapAction === "Show Current Settings") {
            log.step(`Current swap interval: ${swapSettings.intervalType === 'random' ? `${swapSettings.minInterval}ms - ${swapSettings.maxInterval}ms` : `${swapSettings.fixedInterval}ms`}`);
            await inquirer_1.default.prompt([{ type: "input", name: "back", message: "Press Enter to return" }]);
        }
        else if (swapAction === "Back to Main Menu") {
            break;
        }
    }
}
// Update token config for min/max, slippage, direction
async function editTokenSettings(tokens) {
    if (tokens.length === 0) {
        log.warn("No tokens to edit.");
        return;
    }
    const { idx } = await inquirer_1.default.prompt([
        { type: "list", name: "idx", message: "Select token to edit:", choices: tokens.map((t, i) => ({ name: t.symbol, value: i })).concat([{ name: "Back", value: -1 }]) }
    ]);
    if (idx === -1)
        return;
    const token = tokens[idx];
    const { min, max, slippage, direction } = await inquirer_1.default.prompt([
        { type: "input", name: "min", message: `Min swap amount (${token.symbol}):`, default: token.min || 0.001, validate: v => !isNaN(Number(v)) && Number(v) > 0 },
        { type: "input", name: "max", message: `Max swap amount (${token.symbol}):`, default: token.max || 0.01, validate: v => !isNaN(Number(v)) && Number(v) > 0 },
        { type: "input", name: "slippage", message: `Slippage %:`, default: token.slippage || 1, validate: v => !isNaN(Number(v)) && Number(v) >= 0 },
        { type: "list", name: "direction", message: `Swap direction:`, choices: [
                `A→B (${token.symbol} to USDC)`,
                `B→A (USDC to ${token.symbol})`,
                `Both`
            ], default: token.direction || `A→B (${token.symbol} to USDC)` }
    ]);
    token.min = Number(min);
    token.max = Number(max);
    token.slippage = Number(slippage);
    token.direction = direction;
    tokens[idx] = token;
    fs_1.default.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
    log.success("Token settings updated.");
}
// Update tokenOptionsMenu to add 'Edit Token Settings'
async function tokenOptionsMenu(tokens, networks) {
    while (true) {
        const { tokAction } = await inquirer_1.default.prompt([
            {
                type: "list",
                name: "tokAction",
                message: "Token Options:",
                choices: [
                    "Add Token",
                    "Remove Token",
                    "Edit Token Settings",
                    "Token History",
                    "Back to Main Menu"
                ]
            }
        ]);
        if (tokAction === "Add Token") {
            const newTok = await promptAddToken(tokens);
            if (newTok) {
                tokens.push(newTok);
                fs_1.default.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
                log.success("Token added.");
            }
        }
        else if (tokAction === "Remove Token") {
            if (tokens.length === 0) {
                log.warn("No tokens to remove.");
                continue;
            }
            const { idx } = await inquirer_1.default.prompt([
                { type: "list", name: "idx", message: "Select token to remove:", choices: tokens.map((t, i) => ({ name: t.symbol, value: i })).concat([{ name: "Back", value: -1 }]) }
            ]);
            if (idx === -1)
                continue;
            const { confirm } = await inquirer_1.default.prompt([
                { type: "confirm", name: "confirm", message: `Are you sure you want to remove token '${tokens[idx].symbol}'?`, default: false }
            ]);
            if (confirm) {
                tokens.splice(idx, 1);
                fs_1.default.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
                log.success("Token removed.");
            }
        }
        else if (tokAction === "Edit Token Settings") {
            await editTokenSettings(tokens);
        }
        else if (tokAction === "Token History") {
            if (tokens.length === 0) {
                log.warn("No tokens available.");
                continue;
            }
            const { idx } = await inquirer_1.default.prompt([
                { type: "list", name: "idx", message: "Select token to view history:", choices: tokens.map((t, i) => ({ name: t.symbol, value: i })).concat([{ name: "Back", value: -1 }]) }
            ]);
            if (idx === -1)
                continue;
            log.step(`Swap History for ${tokens[idx].symbol}:`);
            const filtered = swapHistory.filter(h => h.token === tokens[idx].symbol);
            if (filtered.length === 0) {
                console.log("  No swaps yet for this token.");
            }
            else {
                filtered.slice(-10).forEach((h, i) => console.log(`  [${i}] [${h.status.toUpperCase()}] ${h.message}${h.status !== 'success' ? ' Reason: ' + h.reason : ''}`));
            }
            await inquirer_1.default.prompt([{ type: "input", name: "back", message: "Press Enter to return" }]);
        }
        else if (tokAction === "Back to Main Menu") {
            break;
        }
    }
}
async function showInfoAndHistory(networks, tokens) {
    while (true) {
        swapHistory = loadSwapHistory();
        const { histAction } = await inquirer_1.default.prompt([
            {
                type: "list",
                name: "histAction",
                message: "Show Info & History:",
                choices: [
                    "Network History",
                    "Token History",
                    "Swap History (ERC20)",
                    "Liquidity History (ERC721)",
                    "Custom Deploy History",
                    "Back"
                ]
            }
        ]);
        if (histAction === "Network History") {
            if (networks.length === 0) {
                log.warn("No networks available.");
                continue;
            }
            const { idx } = await inquirer_1.default.prompt([
                { type: "list", name: "idx", message: "Select network to view history:", choices: networks.map((n, i) => ({ name: n.name, value: i })).concat([{ name: "Back", value: -1 }]) }
            ]);
            if (idx === -1)
                continue;
            log.step(`Swap History for ${networks[idx].name}:`);
            const filtered = swapHistory.filter(h => h.includes(networks[idx].name));
            if (filtered.length === 0) {
                console.log("  No swaps yet for this network.");
            }
            else {
                filtered.slice(-10).forEach((h, i) => console.log(`  [${i}] ${h}`));
            }
            await inquirer_1.default.prompt([{ type: "input", name: "back", message: "Press Enter to return" }]);
        }
        else if (histAction === "Token History") {
            if (tokens.length === 0) {
                log.warn("No tokens available.");
                continue;
            }
            const { idx } = await inquirer_1.default.prompt([
                { type: "list", name: "idx", message: "Select token to view history:", choices: tokens.map((t, i) => ({ name: t.symbol, value: i })).concat([{ name: "Back", value: -1 }]) }
            ]);
            if (idx === -1)
                continue;
            log.step(`Swap History for ${tokens[idx].symbol}:`);
            const filtered = swapHistory.filter(h => h.includes(tokens[idx].symbol));
            if (filtered.length === 0) {
                console.log("  No swaps yet for this token.");
            }
            else {
                filtered.slice(-10).forEach((h, i) => console.log(`  [${i}] ${h}`));
            }
            await inquirer_1.default.prompt([{ type: "input", name: "back", message: "Press Enter to return" }]);
        }
        else if (histAction === "Swap History (ERC20)") {
            log.step("All ERC20 Swap History:");
            if (swapHistory.length === 0) {
                console.log("  No ERC20 swaps yet.");
            }
            else {
                swapHistory.slice(-20).forEach((h, i) => console.log(`  [${i}] ${h}`));
            }
            await inquirer_1.default.prompt([{ type: "input", name: "back", message: "Press Enter to return" }]);
        }
        else if (histAction === "Liquidity History (ERC721)") {
            log.step("Liquidity History (ERC721):");
            console.log("  No ERC721 liquidity events tracked yet.");
            await inquirer_1.default.prompt([{ type: "input", name: "back", message: "Press Enter to return" }]);
        }
        else if (histAction === "Custom Deploy History") {
            log.step("Custom Deploy History:");
            console.log("  No custom deploy events tracked yet.");
            await inquirer_1.default.prompt([{ type: "input", name: "back", message: "Press Enter to return" }]);
        }
        else if (histAction === "Back") {
            break;
        }
    }
}
// Restore networkOptionsMenu definition if missing
async function networkOptionsMenu(networks, tokens) {
    while (true) {
        const { netAction } = await inquirer_1.default.prompt([
            {
                type: "list",
                name: "netAction",
                message: "Network Options:",
                choices: [
                    "Add Network",
                    "Remove Network",
                    "Network History",
                    "Back to Main Menu"
                ]
            }
        ]);
        if (netAction === "Add Network") {
            const newNet = await promptAddNetwork(networks);
            if (newNet) {
                networks.push(newNet);
                fs_1.default.writeFileSync(NETWORKS_PATH, JSON.stringify(networks, null, 2));
                log.success("Network added.");
            }
        }
        else if (netAction === "Remove Network") {
            if (networks.length === 0) {
                log.warn("No networks to remove.");
                continue;
            }
            const { idx } = await inquirer_1.default.prompt([
                { type: "list", name: "idx", message: "Select network to remove:", choices: networks.map((n, i) => ({ name: n.name, value: i })).concat([{ name: "Back", value: -1 }]) }
            ]);
            if (idx === -1)
                continue;
            const { confirm } = await inquirer_1.default.prompt([
                { type: "confirm", name: "confirm", message: `Are you sure you want to remove network '${networks[idx].name}'?`, default: false }
            ]);
            if (confirm) {
                networks.splice(idx, 1);
                fs_1.default.writeFileSync(NETWORKS_PATH, JSON.stringify(networks, null, 2));
                log.success("Network removed.");
            }
        }
        else if (netAction === "Network History") {
            if (networks.length === 0) {
                log.warn("No networks available.");
                continue;
            }
            const { idx } = await inquirer_1.default.prompt([
                { type: "list", name: "idx", message: "Select network to view history:", choices: networks.map((n, i) => ({ name: n.name, value: i })).concat([{ name: "Back", value: -1 }]) }
            ]);
            if (idx === -1)
                continue;
            log.step(`Swap History for ${networks[idx].name}:`);
            const filtered = swapHistory.filter(h => h.network === networks[idx].name);
            if (filtered.length === 0) {
                console.log("  No swaps yet for this network.");
            }
            else {
                filtered.slice(-10).forEach((h, i) => console.log(`  [${i}] [${h.status ? h.status.toUpperCase() : ''}] ${h.message}${h.status && h.status !== 'success' ? ' Reason: ' + h.reason : ''}`));
            }
            await inquirer_1.default.prompt([{ type: "input", name: "back", message: "Press Enter to return" }]);
        }
        else if (netAction === "Back to Main Menu") {
            break;
        }
    }
}
// Define available functions per network (can be extended)
const NETWORK_FUNCTIONS = {
// You can still override for specific networks if needed
// 'Some Network': ['Swap', ...],
};
const DEFAULT_FUNCTIONS = ["Swap", "Liquidity", "Transfer", "Faucet", "Deploy"];
// Helper to get available functions for a network
function getNetworkFunctions(networkName) {
    return NETWORK_FUNCTIONS[networkName] || DEFAULT_FUNCTIONS;
}
// Enhanced Start Automation logic
async function startAutomationMenu(networks, tokens) {
    // Select networks
    const { whichNetworks } = await inquirer_1.default.prompt([
        {
            type: "checkbox",
            name: "whichNetworks",
            message: "Select networks to run automation on (or select all):",
            choices: networks.map((n) => ({ name: n.name, value: n }))
        }
    ]);
    if (!whichNetworks || whichNetworks.length === 0) {
        log.warn("No networks selected. Returning to menu.");
        return;
    }
    // For each network, select functions
    const networkFunctionMap = {};
    for (const net of whichNetworks) {
        const available = getNetworkFunctions(net.name);
        const { funcs } = await inquirer_1.default.prompt([
            {
                type: "checkbox",
                name: "funcs",
                message: `Select functions to run for ${net.name}:`,
                choices: available
            }
        ]);
        if (!funcs || funcs.length === 0) {
            log.warn(`No functions selected for ${net.name}. Skipping this network.`);
            continue;
        }
        networkFunctionMap[net.name] = funcs;
    }
    if (Object.keys(networkFunctionMap).length === 0) {
        log.warn("No networks with functions selected. Returning to menu.");
        return;
    }
    // Confirm before starting
    console.log(chalk_1.default.cyan("You have selected the following networks and functions:"));
    Object.entries(networkFunctionMap).forEach(([net, funcs]) => {
        console.log(`- ${net}: ${funcs.join(", ")}`);
    });
    const { confirmStart } = await inquirer_1.default.prompt([
        { type: "confirm", name: "confirmStart", message: "Proceed with automation?", default: true }
    ]);
    if (!confirmStart) {
        log.warn("Automation cancelled. Returning to menu.");
        return;
    }
    // Pass selected networks and functions to automationLoop
    await automationLoop(networks.filter(n => networkFunctionMap[n.name]), tokens, networkFunctionMap);
}
// Helper: Approve token if needed
async function approveIfNeeded(tokenAddress, owner, spender, amount, wallet, provider, decimals) {
    const token = new ethers_1.ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const allowance = await token.allowance(owner, spender);
    if (allowance < amount) {
        log.step(`Approving token ${tokenAddress} for ${spender}...`);
        if (simulationMode) {
            log.info(`[SIMULATION] Would approve ${spender} for ${amount.toString()} of token ${tokenAddress}`);
            return;
        }
        const tx = await token.connect(wallet).approve(spender, ethers_1.ethers.MaxUint256);
        await tx.wait();
    }
}
// Custom Contract Interactions storage
let customContracts = [];
async function customContractMenu(networks, tokens, wallet, provider) {
    while (true) {
        const { action } = await inquirer_1.default.prompt([
            { type: "list", name: "action", message: "Custom Contract Interactions:", choices: ["Add Interaction", "View/Run Interactions", "Back"] }
        ]);
        if (action === "Add Interaction") {
            const { address, abi, method, params } = await inquirer_1.default.prompt([
                { type: "input", name: "address", message: "Contract address:" },
                { type: "input", name: "abi", message: "Contract ABI (JSON array):" },
                { type: "input", name: "method", message: "Method name to call:" },
                { type: "input", name: "params", message: "Parameters (comma-separated):" }
            ]);
            customContracts.push({ address, abi: JSON.parse(abi), method, params: params.split(",").map((p) => p.trim()) });
            log.success("Custom interaction added.");
        }
        else if (action === "View/Run Interactions") {
            if (customContracts.length === 0) {
                log.warn("No custom interactions.");
                continue;
            }
            const { idx } = await inquirer_1.default.prompt([
                { type: "list", name: "idx", message: "Select interaction:", choices: customContracts.map((c, i) => ({ name: `${c.address} - ${c.method}`, value: i })).concat([{ name: "Back", value: -1 }]) }
            ]);
            if (idx === -1)
                continue;
            const c = customContracts[idx];
            const contract = new ethers_1.ethers.Contract(c.address, c.abi, provider);
            log.step(`Running custom interaction: ${c.method}(${c.params.join(", ")}) on ${c.address}`);
            if (simulationMode) {
                log.info(`[SIMULATION] Would call ${c.method}(${c.params.join(", ")}) on ${c.address}`);
                continue;
            }
            try {
                const tx = await contract.connect(wallet)[c.method](...c.params);
                log.loading("Waiting for confirmation...");
                const receipt = await tx.wait();
                if (receipt.status === 1) {
                    log.success(`Custom contract call successful! Tx Hash: ${receipt.hash}`);
                }
                else {
                    log.warn("Custom contract call failed.");
                }
            }
            catch (err) {
                log.error(`Custom contract error: ${err.message || err}`);
            }
        }
        else if (action === "Back") {
            break;
        }
    }
}
async function mainMenu(networks, tokens, privateKey) {
    while (true) {
        const { action } = await inquirer_1.default.prompt([
            {
                type: "list",
                name: "action",
                message: "Main Menu - Choose an option:",
                choices: [
                    "Start Automation",
                    "Network Options",
                    "Token Options",
                    "Swap Settings",
                    "Show Info & History",
                    "Custom Contract Interactions",
                    simulationMode ? "Disable Simulation Mode" : "Enable Simulation Mode",
                    "Exit"
                ]
            }
        ]);
        if (action === "Start Automation") {
            await startAutomationMenu(networks, tokens);
        }
        else if (action === "Network Options") {
            await networkOptionsMenu(networks, tokens);
        }
        else if (action === "Token Options") {
            await tokenOptionsMenu(tokens, networks);
        }
        else if (action === "Swap Settings") {
            await swapSettingsMenu();
        }
        else if (action === "Show Info & History") {
            await showInfoAndHistory(networks, tokens);
        }
        else if (action === "Custom Contract Interactions") {
            // Use the first private key and walletIndex 0 for custom contract menu
            const wallet = new ethers_1.ethers.Wallet(privateKey, networks[0] ? new ethers_1.ethers.JsonRpcProvider(networks[0].rpc, networks[0].chainId) : undefined);
            await customContractMenu(networks, tokens, wallet, networks[0] ? new ethers_1.ethers.JsonRpcProvider(networks[0].rpc, networks[0].chainId) : undefined);
        }
        else if (action === "Enable Simulation Mode") {
            simulationMode = true;
            log.success("Simulation/Dry Run Mode enabled. No real transactions will be sent.");
        }
        else if (action === "Disable Simulation Mode") {
            simulationMode = false;
            log.success("Simulation/Dry Run Mode disabled. Real transactions will be sent.");
        }
        else if (action === "Exit") {
            log.warn("Exiting bot.");
            process.exit(0);
        }
    }
}
// Update automationLoop to accept networkFunctionMap and only run selected functions
async function automationLoop(selectedNetworks, tokens, networkFunctionMap) {
    automationActive = true;
    let swapCount = 0;
    let privateKeys = loadPrivateKeysFromEnv();
    let walletIndex = 0;
    log.success("Automation started! Press Ctrl+C to stop and return to menu.");
    process.on("SIGINT", () => {
        if (automationActive) {
            log.warn("\nAutomation stopped. Returning to menu...");
            automationActive = false;
        }
    });
    while (automationActive) {
        for (const net of selectedNetworks) {
            // Check if this network has selected functions
            const selectedFuncs = networkFunctionMap ? networkFunctionMap[net.name] : ["Swap"];
            if (!selectedFuncs || selectedFuncs.length === 0)
                continue;
            // Setup provider for this network
            const provider = new ethers_1.ethers.JsonRpcProvider(net.rpc, net.chainId);
            // Router contract
            const routerAbi = [
                "function multicall(uint256 deadline, bytes[] data) external payable returns (bytes[] memory)"
            ];
            const routerAddress = "0x1a4de519154ae51200b0ad7c90f7fac75547888a";
            const router = new ethers_1.ethers.Contract(routerAddress, routerAbi, provider);
            // Filter valid tokens (contract exists)
            const validTokens = [];
            for (const token of tokens) {
                const exists = await contractExists(provider, token.address);
                if (!exists) {
                    log.warn(`Token contract ${token.symbol} (${token.address}) does not exist on ${net.name}. Skipping.`);
                }
                else {
                    validTokens.push(token);
                }
            }
            if (validTokens.length === 0) {
                log.error(`No valid token contracts found on ${net.name}. Returning to menu.`);
                automationActive = false;
                break;
            }
            // For each selected function, run the logic
            for (const func of selectedFuncs) {
                if (!automationActive)
                    break;
                if (func === "Swap") {
                    // Randomly select a token for each interval
                    // (rest of swap logic as before)
                    if (privateKeys.length === 0) {
                        log.error("No private keys found. Please add at least one in .env.");
                        automationActive = false;
                        break;
                    }
                    const wallet = new ethers_1.ethers.Wallet(privateKeys[walletIndex % privateKeys.length], provider);
                    walletIndex++;
                    const token = validTokens[Math.floor(Math.random() * validTokens.length)];
                    const min = token.min || 0.001, max = token.max || 0.01;
                    const amount = Math.floor((Math.random() * (max - min) + min) * Math.pow(10, token.decimals)) / Math.pow(10, token.decimals);
                    const amountWei = ethers_1.ethers.parseUnits(amount.toString(), token.decimals);
                    const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
                    const slippage = token.slippage || 1;
                    const direction = token.direction || `A→B (${token.symbol} to USDC)`;
                    // Placeholder: encode swap data for multicall
                    // TODO: Replace with actual swap encoding when ABI is provided
                    const swapData = [];
                    log.step(`Preparing to swap ${amount} ${token.symbol} on ${net.name} using wallet ${wallet.address}`);
                    if (simulationMode) {
                        log.info(`[SIMULATION] Would perform: Swap ${amount} ${token.symbol} on ${net.name} using wallet ${wallet.address}`);
                        continue;
                    }
                    try {
                        log.loading(`Sending multicall transaction...`);
                        const tx = await router.connect(wallet).multicall(deadline, swapData);
                        log.loading("Waiting for confirmation...");
                        const receipt = await tx.wait();
                        if (receipt.status === 1) {
                            swapCount++;
                            log.success(`Swap #${swapCount} for ${token.symbol} on ${net.name} complete!`);
                            log.success(`Tx Hash: ${receipt.hash}`);
                            if (net.explorer) {
                                log.success(`Explorer: ${net.explorer.replace(/\/$/, '')}/tx/${receipt.hash}`);
                            }
                            swapHistory.push(`Swap #${swapCount} ${token.symbol} on ${net.name} Tx: ${receipt.hash}`);
                            saveSwapHistory(swapHistory);
                        }
                        else {
                            log.warn(`Swap #${swapCount + 1} failed. Check transaction.`);
                        }
                    }
                    catch (err) {
                        log.error(`Swap error: ${err.message || err}`);
                    }
                    if (!automationActive)
                        break;
                    // Wait for interval
                    let interval = 45000;
                    if (swapSettings.intervalType === 'random') {
                        interval = Math.floor(Math.random() * (swapSettings.maxInterval - swapSettings.minInterval) + swapSettings.minInterval);
                    }
                    else if (swapSettings.intervalType === 'fixed') {
                        interval = swapSettings.fixedInterval;
                    }
                    log.loading(`Waiting ${(interval / 1000).toFixed(1)} seconds before next swap...`);
                    await new Promise(res => setTimeout(res, interval));
                }
                else if (func === "Liquidity") {
                    // --- Uniswap V3 ERC721 Liquidity Logic ---
                    const liquidityPairs = [
                        { name: "USDC_NEW/USDT_NEW", token0: "0x72df0bcd7276f2dfbac900d1ce63c272c4bccced", token1: "0xed59de2d7ad9c043442e381231ee3646fc3c2939", decimals0: 6, decimals1: 18 },
                        { name: "USDC_OLD/USDT_OLD", token0: "0xad902cf99c2de2f1ba5ec4d642fd7e49cae9ee37", token1: "0xed59de2d7ad9c043442e381231ee3646fc3c2939", decimals0: 18, decimals1: 18 },
                    ];
                    let pairIdx = Math.floor(Math.random() * liquidityPairs.length);
                    let pair = liquidityPairs[pairIdx];
                    const feeOptions = [500, 3000, 10000];
                    const fee = feeOptions[Math.floor(Math.random() * feeOptions.length)];
                    const slippageOptions = [0.05, 0.30, 1.00];
                    const slippage = slippageOptions[Math.floor(Math.random() * slippageOptions.length)];
                    let amount0 = Math.random() * (0.1 - 0.01) + 0.01;
                    let amount1 = Math.random() * (0.1 - 0.01) + 0.01;
                    amount0 = Math.floor(amount0 * Math.pow(10, pair.decimals0)) / Math.pow(10, pair.decimals0);
                    amount1 = Math.floor(amount1 * Math.pow(10, pair.decimals1)) / Math.pow(10, pair.decimals1);
                    const wallet = new ethers_1.ethers.Wallet(privateKeys[walletIndex % privateKeys.length], provider);
                    walletIndex++;
                    const nfpmAddress = "0xf8a1d4ff0f9b9af7ce58e1fc1833688f3bfd6115";
                    const nfpm = new ethers_1.ethers.Contract(nfpmAddress, NonfungiblePositionManager_json_1.abi, provider);
                    // --- Check balances ---
                    const token0 = new ethers_1.ethers.Contract(pair.token0, ERC20_ABI, provider);
                    const token1 = new ethers_1.ethers.Contract(pair.token1, ERC20_ABI, provider);
                    const bal0 = await token0.balanceOf(wallet.address);
                    const bal1 = await token1.balanceOf(wallet.address);
                    if (bal0 < ethers_1.ethers.parseUnits(amount0.toString(), pair.decimals0) || bal1 < ethers_1.ethers.parseUnits(amount1.toString(), pair.decimals1)) {
                        log.warn(`Insufficient token balance for ${pair.name} on ${net.name}. Skipping liquidity add.`);
                        continue;
                    }
                    // --- Approve tokens if needed ---
                    await approveIfNeeded(pair.token0, wallet.address, nfpmAddress, ethers_1.ethers.parseUnits(amount0.toString(), pair.decimals0), wallet, provider, pair.decimals0);
                    await approveIfNeeded(pair.token1, wallet.address, nfpmAddress, ethers_1.ethers.parseUnits(amount1.toString(), pair.decimals1), wallet, provider, pair.decimals1);
                    // --- Pool initialization if needed ---
                    try {
                        await nfpm.connect(wallet).createAndInitializePoolIfNecessary(pair.token0, pair.token1, fee, ethers_1.ethers.parseUnits("1", 18) // sqrtPriceX96, placeholder for 1:1 price
                        );
                        log.step("Pool initialized or already exists.");
                    }
                    catch (e) {
                        if (e.message && e.message.includes("already initialized")) {
                            log.step("Pool already initialized.");
                        }
                        else {
                            log.warn(`Pool initialization error: ${e.message || e}`);
                        }
                    }
                    const tickLower = -887220;
                    const tickUpper = 887220;
                    const amount0Min = amount0 * (1 - slippage / 100);
                    const amount1Min = amount1 * (1 - slippage / 100);
                    const params = {
                        token0: pair.token0,
                        token1: pair.token1,
                        fee,
                        tickLower,
                        tickUpper,
                        amount0Desired: ethers_1.ethers.parseUnits(amount0.toString(), pair.decimals0),
                        amount1Desired: ethers_1.ethers.parseUnits(amount1.toString(), pair.decimals1),
                        amount0Min: ethers_1.ethers.parseUnits(amount0Min.toString(), pair.decimals0),
                        amount1Min: ethers_1.ethers.parseUnits(amount1Min.toString(), pair.decimals1),
                        recipient: wallet.address,
                        deadline: Math.floor(Date.now() / 1000) + 600
                    };
                    log.step(`Adding Uniswap V3 liquidity: Pair=${pair.name}, Fee=${fee / 10000}%, Amount0=${amount0}, Amount1=${amount1}, Slippage=${slippage}% on ${net.name}`);
                    if (simulationMode) {
                        log.info(`[SIMULATION] Would perform: Add liquidity with Pair=${pair.name}, Fee=${fee / 10000}%, Amount0=${amount0}, Amount1=${amount1}, Slippage=${slippage}% on ${net.name}`);
                        continue;
                    }
                    try {
                        const tx = await nfpm.connect(wallet).mint(params);
                        log.loading("Waiting for confirmation...");
                        const receipt = await tx.wait();
                        if (receipt.status === 1) {
                            log.success(`Liquidity position added for ${pair.name} on ${net.name}!`);
                            log.success(`Tx Hash: ${receipt.hash}`);
                            if (net.explorer) {
                                log.success(`Explorer: ${net.explorer.replace(/\/$/, '')}/tx/${receipt.hash}`);
                            }
                            swapHistory.push(`Liquidity ${pair.name} on ${net.name} Tx: ${receipt.hash}`);
                            saveSwapHistory(swapHistory);
                        }
                        else {
                            log.warn(`Liquidity add failed for ${pair.name} on ${net.name}.`);
                        }
                    }
                    catch (err) {
                        log.error(`Liquidity error: ${err.message || err}`);
                    }
                    const interval = Math.floor(Math.random() * (60000 - 30000) + 30000);
                    log.loading(`Waiting ${(interval / 1000).toFixed(1)} seconds before next liquidity action...`);
                    await new Promise(res => setTimeout(res, interval));
                }
                else if (func === "Transfer") {
                    log.step(`(Stub) Would run Transfer logic for ${net.name}`);
                    // TODO: Implement real transfer logic
                }
                else if (func === "Faucet") {
                    log.step(`(Stub) Would run Faucet logic for ${net.name}`);
                    // TODO: Implement real faucet logic
                }
                else if (func === "Deploy") {
                    log.step(`(Stub) Would run Deploy logic for ${net.name}`);
                    // TODO: Implement real deploy logic
                }
            }
            if (!automationActive)
                break;
        }
        if (!automationActive)
            break;
    }
}
async function main() {
    // Setup .env and private keys
    const privateKeys = await setupEnvAndKeys();
    printBanner();
    // Use the first private key by default
    const privateKey = privateKeys[0] || process.env.PRIVATE_KEY || "";
    const networks = await getNetworks();
    const tokens = await getTokens();
    await mainMenu(networks, tokens, privateKey);
}
main();
