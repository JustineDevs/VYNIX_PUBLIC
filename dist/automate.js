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
const axios_1 = __importDefault(require("axios"));
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
    'Pharos Testnet': ["Swap", "Liquidity", "Transfer", "Faucet", "Deploy", "Check-in"],
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
// Helper to round/truncate to correct decimals for parseUnits
function toFixedDecimals(amount, decimals) {
    return amount.toFixed(decimals);
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
// Helper to get full range ticks for Uniswap V3
const FULL_RANGE = { tickLower: -887272, tickUpper: 887272 };
// Placeholder: Fetch real-time price for a pair (replace with real API/oracle logic)
async function getPairPrice(token0, token1) {
    // Example hardcoded prices for WPHRS pairs (update as needed)
    if (token0.toLowerCase() === "0x76aaada469d23216be5f7c596fa25f282ff9b364" && token1.toLowerCase() === "0x72df0bcd7276f2dfbac900d1ce63c272c4bccced") {
        return 501.175; // WPHRS/USDC_NEW
    }
    if (token0.toLowerCase() === "0x76aaada469d23216be5f7c596fa25f282ff9b364" && token1.toLowerCase() === "0xd4071393f8716661958f766df660033b3d35fd29") {
        return 500.0; // WPHRS/USDT_NEW
    }
    if (token0.toLowerCase() === "0x76aaada469d23216be5f7c596fa25f282ff9b364" && token1.toLowerCase() === "0xad902cf99c2de2f1ba5ec4d642fd7e49cae9ee37") {
        return 499.0; // WPHRS/USDC_OLD
    }
    if (token0.toLowerCase() === "0x76aaada469d23216be5f7c596fa25f282ff9b364" && token1.toLowerCase() === "0xed59de2d7ad9c043442e381231ee3646fc3c2939") {
        return 498.0; // WPHRS/USDT_OLD
    }
    // Default fallback
    return 500.0;
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
                    const amountWei = ethers_1.ethers.parseUnits(toFixedDecimals(amount, token.decimals), token.decimals);
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
                    // Liquidity logic is currently disabled. To be implemented soon.
                    log.step("(Stub) Liquidity function is not yet implemented.");
                    continue;
                }
                else if (func === "Transfer") {
                    let transferActive = true;
                    process.on("SIGINT", () => {
                        log.warn("\nTransfer loop stopped by user. Returning to menu...");
                        transferActive = false;
                    });
                    let transferIndex = 0;
                    while (true) {
                        // Prompt for receiver address
                        const { toAddress } = await inquirer_1.default.prompt([
                            { type: "input", name: "toAddress", message: "Enter the receiver address for PHRS transfer (Ctrl+C to stop):" }
                        ]);
                        // Confirm action
                        const { confirm } = await inquirer_1.default.prompt([
                            { type: "confirm", name: "confirm", message: `Are you sure you want to continuously send 0.000001 PHRS to ${toAddress}?`, default: false }
                        ]);
                        if (!confirm) {
                            log.warn("Transfer cancelled by user.");
                            const { nextAction } = await inquirer_1.default.prompt([
                                { type: "list", name: "nextAction", message: "What do you want to do?", choices: ["Enter new address", "Back to Main Menu"] }
                            ]);
                            if (nextAction === "Enter new address") {
                                continue;
                            }
                            else {
                                break;
                            }
                        }
                        // Start continuous transfer loop
                        transferActive = true;
                        transferIndex = 0;
                        while (transferActive) {
                            const transferPHRS = async (wallet, provider, index) => {
                                try {
                                    const amount = 0.000001;
                                    log.step(`Preparing PHRS transfer ${index + 1}: ${amount} PHRS to ${toAddress}`);
                                    const balance = await provider.getBalance(wallet.address);
                                    const required = ethers_1.ethers.parseEther(amount.toString());
                                    if (balance < required) {
                                        log.warn(`Skipping transfer ${index + 1}: Insufficient PHRS balance: ${ethers_1.ethers.formatEther(balance)} < ${amount}`);
                                        return;
                                    }
                                    const feeData = await provider.getFeeData();
                                    const gasPrice = feeData.gasPrice || ethers_1.ethers.parseUnits('1', 'gwei');
                                    const tx = await wallet.sendTransaction({
                                        to: toAddress,
                                        value: required,
                                        gasLimit: 21000,
                                        gasPrice,
                                        maxFeePerGas: feeData.maxFeePerGas || undefined,
                                        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || undefined,
                                    });
                                    log.loading(`Transfer transaction ${index + 1} sent, waiting for confirmation...`);
                                    const receipt = await provider.waitForTransaction(tx.hash);
                                    log.success(`Transfer ${index + 1} completed: ${receipt.hash}`);
                                    log.step(`Explorer: https://testnet.pharosscan.xyz/tx/${receipt.hash}`);
                                }
                                catch (error) {
                                    log.error(`Transfer ${index + 1} failed: ${error.message}`);
                                    if (error.transaction) {
                                        log.error(`Transaction details: ${JSON.stringify(error.transaction, null, 2)}`);
                                    }
                                    if (error.receipt) {
                                        log.error(`Receipt: ${JSON.stringify(error.receipt, null, 2)}`);
                                    }
                                }
                            };
                            const wallet = new ethers_1.ethers.Wallet(privateKeys[walletIndex % privateKeys.length], provider);
                            walletIndex++;
                            await transferPHRS(wallet, provider, transferIndex);
                            transferIndex++;
                            // Wait a short interval before next send
                            await new Promise(res => setTimeout(res, 2000));
                        }
                        // After loop is stopped (Ctrl+C), ask user what to do next
                        const { nextAction } = await inquirer_1.default.prompt([
                            { type: "list", name: "nextAction", message: "What do you want to do next?", choices: ["Enter new address", "Back to Main Menu"] }
                        ]);
                        if (nextAction === "Enter new address") {
                            continue;
                        }
                        else {
                            break;
                        }
                    }
                    continue;
                }
                else if (func === "Faucet") {
                    // Faucet claim logic
                    const claimFaucet = async (wallet, proxy = null) => {
                        try {
                            log.step(`Checking faucet eligibility for wallet: ${wallet.address}`);
                            const message = "pharos";
                            const signature = await wallet.signMessage(message);
                            log.step(`Signed message: ${signature}`);
                            const loginUrl = `https://api.pharosnetwork.xyz/user/login?address=${wallet.address}&signature=${signature}&invite_code=03k2hgkzM1rh5Dog`;
                            const headers = {
                                accept: "application/json, text/plain, */*",
                                "accept-language": "en-US,en;q=0.8",
                                authorization: "Bearer null",
                                "sec-ch-ua": '"Chromium";v="136", "Brave";v="136", "Not.A/Brand";v="99"',
                                "sec-ch-ua-mobile": "?0",
                                "sec-ch-ua-platform": '"Windows"',
                                "sec-fetch-dest": "empty",
                                "sec-fetch-mode": "cors",
                                "sec-fetch-site": "same-site",
                                "sec-gpc": "1",
                                Referer: "https://testnet.pharosnetwork.xyz/",
                                "Referrer-Policy": "strict-origin-when-cross-origin",
                                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", // Replace with randomUseragent if available
                            };
                            const axiosConfig = {
                                method: 'post',
                                url: loginUrl,
                                headers,
                            };
                            log.loading('Sending login request for faucet...');
                            const loginResponse = await (0, axios_1.default)(axiosConfig);
                            const loginData = loginResponse.data;
                            if (loginData.code !== 0 || !loginData.data.jwt) {
                                log.error(`Login failed for faucet: ${loginData.msg || 'Unknown error'}`);
                                return false;
                            }
                            const jwt = loginData.data.jwt;
                            log.success(`Login successful for faucet, JWT: ${jwt}`);
                            const statusUrl = `https://api.pharosnetwork.xyz/faucet/status?address=${wallet.address}`;
                            const statusHeaders = {
                                ...headers,
                                authorization: `Bearer ${jwt}`,
                            };
                            log.loading('Checking faucet status...');
                            const statusResponse = await (0, axios_1.default)({
                                method: 'get',
                                url: statusUrl,
                                headers: statusHeaders,
                            });
                            const statusData = statusResponse.data;
                            if (statusData.code !== 0 || !statusData.data) {
                                log.error(`Faucet status check failed: ${statusData.msg || 'Unknown error'}`);
                                return false;
                            }
                            if (!statusData.data.is_able_to_faucet) {
                                const nextAvailable = new Date(statusData.data.avaliable_timestamp * 1000).toLocaleString('en-US', { timeZone: 'Asia/Makassar' });
                                log.warn(`Faucet not available until: ${nextAvailable}`);
                                return false;
                            }
                            const claimUrl = `https://api.pharosnetwork.xyz/faucet/daily?address=${wallet.address}`;
                            log.loading('Claiming faucet...');
                            const claimResponse = await (0, axios_1.default)({
                                method: 'post',
                                url: claimUrl,
                                headers: statusHeaders,
                            });
                            const claimData = claimResponse.data;
                            if (claimData.code === 0) {
                                log.success(`Faucet claimed successfully for ${wallet.address}`);
                                return true;
                            }
                            else {
                                log.error(`Faucet claim failed: ${claimData.msg || 'Unknown error'}`);
                                return false;
                            }
                        }
                        catch (error) {
                            log.error(`Faucet claim failed for ${wallet.address}: ${error.message}`);
                            return false;
                        }
                    };
                    // Run faucet claim for the current wallet
                    const wallet = new ethers_1.ethers.Wallet(privateKeys[walletIndex % privateKeys.length], provider);
                    walletIndex++;
                    await claimFaucet(wallet);
                    continue;
                }
                else if (func === "Check-in") {
                    // Daily check-in logic for Pharos Network
                    const performCheckIn = async (wallet, proxy = null) => {
                        try {
                            log.step(`Performing daily check-in for wallet: ${wallet.address}`);
                            const message = "pharos";
                            const signature = await wallet.signMessage(message);
                            log.step(`Signed message: ${signature}`);
                            const loginUrl = `https://api.pharosnetwork.xyz/user/login?address=${wallet.address}&signature=${signature}&invite_code=03k2hgkzM1rh5Dog`;
                            const headers = {
                                accept: "application/json, text/plain, */*",
                                "accept-language": "en-US,en;q=0.8",
                                authorization: "Bearer null",
                                "sec-ch-ua": '"Chromium";v="136", "Brave";v="136", "Not.A/Brand";v="99"',
                                "sec-ch-ua-mobile": "?0",
                                "sec-ch-ua-platform": '"Windows"',
                                "sec-fetch-dest": "empty",
                                "sec-fetch-mode": "cors",
                                "sec-fetch-site": "same-site",
                                "sec-gpc": "1",
                                Referer: "https://testnet.pharosnetwork.xyz/",
                                "Referrer-Policy": "strict-origin-when-cross-origin",
                                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", // Replace with randomUseragent if available
                            };
                            const axiosConfig = {
                                method: 'post',
                                url: loginUrl,
                                headers,
                            };
                            log.loading('Sending login request...');
                            const loginResponse = await (0, axios_1.default)(axiosConfig);
                            const loginData = loginResponse.data;
                            if (loginData.code !== 0 || !loginData.data.jwt) {
                                log.error(`Login failed: ${loginData.msg || 'Unknown error'}`);
                                return null;
                            }
                            const jwt = loginData.data.jwt;
                            log.success(`Login successful, JWT: ${jwt}`);
                            const checkInUrl = `https://api.pharosnetwork.xyz/sign/in?address=${wallet.address}`;
                            const checkInHeaders = {
                                ...headers,
                                authorization: `Bearer ${jwt}`,
                            };
                            log.loading('Sending check-in request...');
                            const checkInResponse = await (0, axios_1.default)({
                                method: 'post',
                                url: checkInUrl,
                                headers: checkInHeaders,
                            });
                            const checkInData = checkInResponse.data;
                            if (checkInData.code === 0) {
                                log.success(`Check-in successful for ${wallet.address}`);
                                return jwt;
                            }
                            else {
                                log.warn(`Check-in failed, possibly already checked in: ${checkInData.msg || 'Unknown error'}`);
                                return jwt;
                            }
                        }
                        catch (error) {
                            log.error(`Check-in failed for ${wallet.address}: ${error.message}`);
                            return null;
                        }
                    };
                    // Run check-in for the current wallet
                    const wallet = new ethers_1.ethers.Wallet(privateKeys[walletIndex % privateKeys.length], provider);
                    walletIndex++;
                    await performCheckIn(wallet);
                    continue;
                }
                else if (func === "Deploy") {
                    // Interact with deployed PerpetualTimer contract and call startTimer in a loop
                    let deployActive = true;
                    process.on("SIGINT", () => {
                        log.warn("\nDeploy loop stopped by user. Returning to menu...");
                        deployActive = false;
                    });
                    // Use provided contract address and ABI
                    const contractAddress = "0x541805121a6E4C4DD2D36c90bFFc70A1379d66F3";
                    const contractAbi = [
                        { "inputs": [], "stateMutability": "nonpayable", "type": "constructor" },
                        { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "caller", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "newStartTime", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "newDuration", "type": "uint256" }], "name": "TimerReset", "type": "event" },
                        { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "starter", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "startTime", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "duration", "type": "uint256" }], "name": "TimerStarted", "type": "event" },
                        { "inputs": [], "name": "checkTimer", "outputs": [{ "internalType": "string", "name": "status", "type": "string" }, { "internalType": "uint256", "name": "timeLeft", "type": "uint256" }], "stateMutability": "view", "type": "function" },
                        { "inputs": [], "name": "getCurrentTime", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
                        { "inputs": [], "name": "isTimerActive", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
                        { "inputs": [], "name": "owner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
                        { "inputs": [{ "internalType": "uint256", "name": "durationInSeconds", "type": "uint256" }], "name": "startTimer", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
                        { "inputs": [], "name": "timerDuration", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
                        { "inputs": [], "name": "timerStart", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }
                    ];
                    const wallet = new ethers_1.ethers.Wallet(privateKeys[walletIndex % privateKeys.length], provider);
                    walletIndex++;
                    const timerContract = new ethers_1.ethers.Contract(contractAddress, contractAbi, wallet);
                    log.step(`Interacting with PerpetualTimer at ${contractAddress}`);
                    // Loop: call startTimer with random interval (1-5 min)
                    while (deployActive) {
                        const randomMinutes = Math.floor(Math.random() * (5 - 1 + 1)) + 1;
                        const duration = randomMinutes * 60; // seconds
                        log.step(`Calling startTimer with duration ${duration} seconds (${randomMinutes} min)...`);
                        try {
                            const tx = await timerContract.startTimer(duration);
                            log.loading("Waiting for startTimer confirmation...");
                            const receipt = await tx.wait();
                            log.success(`startTimer called. Tx: ${receipt.hash}`);
                            log.step(`Explorer: https://testnet.pharosscan.xyz/tx/${receipt.hash}`);
                        }
                        catch (e) {
                            log.error(`startTimer failed: ${e.message}`);
                        }
                        // Wait for the same random interval before next call
                        if (!deployActive)
                            break;
                        log.loading(`Waiting ${randomMinutes} minutes before next startTimer...`);
                        await new Promise(res => setTimeout(res, duration * 1000));
                    }
                    continue;
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
