import { ethers } from "ethers";
import { Interface } from "ethers";
// @ts-ignore
import * as dotenv from "dotenv";
import chalk from "chalk";
import inquirer from "inquirer";
import fs from "fs";
import path from "path";
import { abi as nfpmAbi } from '@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json';
import axios from "axios";

const ENV_PATH = path.resolve(__dirname, "env");
// Load environment variables
dotenv.config({ path: ENV_PATH });

const NETWORKS_PATH = path.resolve(__dirname, "networks.json");
const TOKENS_PATH = path.resolve(__dirname, "tokens.json");
const SWAP_HISTORY_PATH = path.resolve(__dirname, "swapHistory.json");

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address owner) external view returns (uint256)"
];

// Add ABIs for deployed contracts
const CUSTOM_ERC20_ABI = [
  // Only relevant functions for interaction
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function cryptoWords(uint256) view returns (string)"
];
const CUSTOM_ERC1155_ABI = [
  "function name() view returns (string)",
  "function intervalWord() view returns (string)",
  "function balanceOf(address, uint256) view returns (uint256)",
  "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)",
  "function cryptoWords(uint256) view returns (string)"
];
const CUSTOM_ERC165_ABI = [
  "function getDescription() view returns (string)",
  "function description() view returns (string)",
  "function cryptoWords(uint256) view returns (string)"
];

const DEPLOYED_ADDRESSES = {
  ERC20: "0x21FEEd10C4d26F8D69D6F677cf370192E40B038D",
  ERC1155: "0x46Ac4a76adeC59D230c4189B61fe14E00071E25e",
  ERC165: "0x6A32308EF415682543883Ec598dBfA78c9488771"
};

// Helper to write .env (now supports multiple keys)
function saveEnv(vars: Record<string, string | undefined>) {
  // Always write PRIVATE_KEY first if present, then PRIVATE_KEY1,2,...
  let env = "";
  if (vars["PRIVATE_KEY"]) env += `PRIVATE_KEY=${vars["PRIVATE_KEY"]}\n`;
  // Write numbered keys in order
  Object.keys(vars)
    .filter(k => /^PRIVATE_KEY\d+$/.test(k))
    .sort((a, b) => Number(a.replace("PRIVATE_KEY", "")) - Number(b.replace("PRIVATE_KEY", "")))
    .forEach(k => {
      env += `${k}=${vars[k]}\n`;
    });
  // Write other vars
  Object.entries(vars).forEach(([k, v]) => {
    if (k !== "PRIVATE_KEY" && !/^PRIVATE_KEY\d+$/.test(k)) env += `${k}=${v ?? ""}\n`;
  });
  fs.writeFileSync(ENV_PATH, env, { encoding: "utf-8" });
}

// Helper to load private keys from .env
function loadPrivateKeysFromEnv(): string[] {
  const keys: string[] = [];
  Object.entries(process.env).forEach(([k, v]) => {
    if ((k === "PRIVATE_KEY" || /^PRIVATE_KEY\d+$/.test(k)) && v && v.startsWith("0x")) keys.push(v);
  });
  return keys;
}

// New: Prompt for .env creation and private key import
async function setupEnvAndKeys() {
  let envVars: Record<string, string> = {};
  if (!fs.existsSync(ENV_PATH)) {
    const { createEnv } = await inquirer.prompt([
      { type: "confirm", name: "createEnv", message: "Do you want the bot to create a .env file for you?", default: true }
    ]);
    if (createEnv) {
      const { keyMode } = await inquirer.prompt([
        { type: "list", name: "keyMode", message: "Import a single private key or multiple?", choices: ["Single", "Multiple"] }
      ]);
      let keys: string[] = [];
      if (keyMode === "Single") {
        const { pk } = await inquirer.prompt([
          { type: "password", name: "pk", message: "Enter your private key:", mask: "*", validate: (input: string) => /^0x[0-9a-fA-F]{64}$/.test(input) || "Invalid private key format!" }
        ]);
        keys = [pk];
      } else {
        let addMore = true;
        while (addMore) {
          const { pk } = await inquirer.prompt([
            { type: "password", name: "pk", message: `Enter private key #${keys.length + 1}:`, mask: "*", validate: (input: string) => /^0x[0-9a-fA-F]{64}$/.test(input) || "Invalid private key format!" }
          ]);
          keys.push(pk);
          const { more } = await inquirer.prompt([
            { type: "confirm", name: "more", message: "Add another private key?", default: false }
          ]);
          addMore = more;
        }
      }
      keys.forEach((k, i) => envVars[`PRIVATE_KEY_${i + 1}`] = k);
      saveEnv(envVars);
      console.log(chalk.green(".env file created with your private key(s)!"));
      console.log(chalk.cyan("Recommendations:"));
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
  let networks: any[] = [];
  if (fs.existsSync(NETWORKS_PATH)) {
    networks = JSON.parse(fs.readFileSync(NETWORKS_PATH, "utf-8"));
  }
  if (networks.length === 0) {
    const { addNetwork } = await inquirer.prompt([
      {
        type: "confirm",
        name: "addNetwork",
        message: "No networks found. Add a custom testnet network?",
        default: true
      }
    ]);
    if (addNetwork) {
      networks.push(await promptAddNetwork());
      fs.writeFileSync(NETWORKS_PATH, JSON.stringify(networks, null, 2));
    }
  }
  return networks;
}

async function promptAddNetwork(existingNetworks: any[] = []) {
  while (true) {
    const answers = await inquirer.prompt([
      { type: "input", name: "name", message: "Network name:" },
      { type: "input", name: "rpc", message: "RPC URL:" },
      { type: "input", name: "chainId", message: "Chain ID:", validate: (v: string) => !isNaN(Number(v)) || "Must be a number" },
      { type: "input", name: "currencySymbol", message: "Currency Symbol:" },
      { type: "input", name: "explorer", message: "Block Explorer (optional):" }
    ]);
    const duplicate = existingNetworks.find((n: any) => n.rpc === answers.rpc || n.name === answers.name || n.chainId === Number(answers.chainId));
    if (duplicate) {
      log.warn("This network already exists. You can view or manage it from the Network Options menu.");
      const { whatNext } = await inquirer.prompt([
        { type: "list", name: "whatNext", message: "What do you want to do?", choices: ["Back to Menu", "Try Again"] }
      ]);
      if (whatNext === "Back to Menu") return null;
      continue;
    }
    return { ...answers, chainId: Number(answers.chainId) };
  }
}

// Helper to load or prompt for tokens
async function getTokens() {
  let tokens: any[] = [];
  if (fs.existsSync(TOKENS_PATH)) {
    tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, "utf-8"));
  }
  if (tokens.length === 0) {
    const { addToken } = await inquirer.prompt([
      {
        type: "confirm",
        name: "addToken",
        message: "No tokens found. Add a token contract?",
        default: true
      }
    ]);
    if (addToken) {
      tokens.push(await promptAddToken());
      fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
    }
  }
  // Removed repeated prompt for adding more tokens
  return tokens;
}

async function promptAddToken(existingTokens: any[] = []) {
  while (true) {
    const answers = await inquirer.prompt([
      { type: "input", name: "address", message: "Token contract address:" },
      { type: "input", name: "symbol", message: "Token symbol:" },
      { type: "input", name: "decimals", message: "Token decimals:", validate: (v: string) => !isNaN(Number(v)) || "Must be a number" }
    ]);
    const duplicate = existingTokens.find((t: any) => t.address.toLowerCase() === answers.address.toLowerCase() || t.symbol === answers.symbol);
    if (duplicate) {
      log.warn("This token already exists. You can view or manage it from the Token Options menu.");
      const { whatNext } = await inquirer.prompt([
        { type: "list", name: "whatNext", message: "What do you want to do?", choices: ["Back to Menu", "Try Again"] }
      ]);
      if (whatNext === "Back to Menu") return null;
      continue;
    }
    return { ...answers, decimals: Number(answers.decimals) };
  }
}

// Banner
function printBanner() {
  console.log(chalk.cyan(`\n==============================`));
  console.log(chalk.cyan(`      Testnet Automation Bot   `));
  console.log(chalk.cyan(`  Pharos Testnet Swap Bot v1.0 `));
  console.log(chalk.cyan(`==============================\n`));
}

// Logging helpers
const log = {
  success: (msg: string) => console.log(chalk.green("✅ " + msg)),
  warn: (msg: string) => console.log(chalk.yellow("⚠️  " + msg)),
  error: (msg: string) => console.log(chalk.red("❌ " + msg)),
  loading: (msg: string) => console.log(chalk.cyan("🔄 " + msg)),
  step: (msg: string) => console.log(chalk.white("➤ " + msg)),
  info: (msg: string) => console.log(chalk.cyan("ℹ️  " + msg)),
};

// Ctrl+C menu
function setupSigintMenu({ networks, tokens }: { networks: any[]; tokens: any[] }) {
  process.on("SIGINT", async () => {
    log.warn("Bot paused. Menu:");
    const { action } = await inquirer.prompt([
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
      fs.writeFileSync(NETWORKS_PATH, JSON.stringify(networks, null, 2));
      log.success("Network added.");
    } else if (action === "Remove Network") {
      if (networks.length === 0) return log.warn("No networks to remove.");
      const { idx } = await inquirer.prompt([
        { type: "list", name: "idx", message: "Select network to remove:", choices: networks.map((n, i) => ({ name: n.name, value: i })) }
      ]);
      networks.splice(idx, 1);
      fs.writeFileSync(NETWORKS_PATH, JSON.stringify(networks, null, 2));
      log.success("Network removed.");
    } else if (action === "Add Token") {
      tokens.push(await promptAddToken());
      fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
      log.success("Token added.");
    } else if (action === "Remove Token") {
      if (tokens.length === 0) return log.warn("No tokens to remove.");
      const { idx } = await inquirer.prompt([
        { type: "list", name: "idx", message: "Select token to remove:", choices: tokens.map((t, i) => ({ name: t.symbol, value: i })) }
      ]);
      tokens.splice(idx, 1);
      fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
      log.success("Token removed.");
    } else if (action === "Resume Automation") {
      log.loading("Resuming bot...");
      return;
    } else if (action === "Exit") {
      log.warn("Exiting bot.");
      process.exit(0);
    }
    // Show menu again after action
    setupSigintMenu({ networks, tokens });
  });
}

function loadSwapHistory() {
  if (fs.existsSync(SWAP_HISTORY_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(SWAP_HISTORY_PATH, "utf-8"));
    } catch {
      return [];
    }
  }
  return [];
}

function saveSwapHistory(history: any[]) {
  fs.writeFileSync(SWAP_HISTORY_PATH, JSON.stringify(history, null, 2));
}

let swapHistory: any[] = loadSwapHistory();

let automationActive = false;
let username = "";
let simulationMode = false;

async function getUsername() {
  const { user } = await inquirer.prompt([
    { type: "input", name: "user", message: "Enter your username:" }
  ]);
  return user;
}

async function contractExists(provider: ethers.JsonRpcProvider, address: string): Promise<boolean> {
  try {
    const code = await provider.getCode(address);
    return typeof code === 'string' && code !== "0x";
  } catch {
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
    const { swapAction } = await inquirer.prompt([
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
      const minPrompt = await inquirer.prompt({
        type: "input",
        name: "min",
        message: "Minimum interval (ms):",
        default: String(swapSettings.minInterval),
        validate: (v: string) => !isNaN(Number(v)) && Number(v) > 0
      });
      const maxPrompt = await inquirer.prompt({
        type: "input",
        name: "max",
        message: "Maximum interval (ms):",
        default: String(swapSettings.maxInterval),
        validate: (v: string) => !isNaN(Number(v)) && Number(v) > 0
      });
      swapSettings.intervalType = 'random';
      swapSettings.minInterval = Number(minPrompt.min);
      swapSettings.maxInterval = Number(maxPrompt.max);
      log.success(`Random interval set: ${minPrompt.min}ms - ${maxPrompt.max}ms`);
    } else if (swapAction === "Set Fixed Interval") {
      const fixedPrompt = await inquirer.prompt({
        type: "input",
        name: "fixed",
        message: "Fixed interval (ms):",
        default: String(swapSettings.fixedInterval),
        validate: (v: string) => !isNaN(Number(v)) && Number(v) > 0
      });
      swapSettings.intervalType = 'fixed';
      swapSettings.fixedInterval = Number(fixedPrompt.fixed);
      log.success(`Fixed interval set: ${fixedPrompt.fixed}ms`);
    } else if (swapAction === "Show Current Settings") {
      log.step(`Current swap interval: ${swapSettings.intervalType === 'random' ? `${swapSettings.minInterval}ms - ${swapSettings.maxInterval}ms` : `${swapSettings.fixedInterval}ms`}`);
      await inquirer.prompt([{ type: "input", name: "back", message: "Press Enter to return" }]);
    } else if (swapAction === "Back to Main Menu") {
      break;
    }
  }
}

// Update token config for min/max, slippage, direction
async function editTokenSettings(tokens: any[]) {
  if (tokens.length === 0) { log.warn("No tokens to edit."); return; }
  const { idx } = await inquirer.prompt([
    { type: "list", name: "idx", message: "Select token to edit:", choices: tokens.map((t, i) => ({ name: t.symbol, value: i })).concat([{ name: "Back", value: -1 }]) }
  ]);
  if (idx === -1) return;
  const token = tokens[idx];
  const { min, max, slippage, direction } = await inquirer.prompt([
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
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
  log.success("Token settings updated.");
}

// Update tokenOptionsMenu to add 'Edit Token Settings'
async function tokenOptionsMenu(tokens: any[], networks: any[]) {
  while (true) {
    const { tokAction } = await inquirer.prompt([
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
        fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
        log.success("Token added.");
      }
    } else if (tokAction === "Remove Token") {
      if (tokens.length === 0) { log.warn("No tokens to remove."); continue; }
      const { idx } = await inquirer.prompt([
        { type: "list", name: "idx", message: "Select token to remove:", choices: tokens.map((t, i) => ({ name: t.symbol, value: i })).concat([{ name: "Back", value: -1 }]) }
      ]);
      if (idx === -1) continue;
      const { confirm } = await inquirer.prompt([
        { type: "confirm", name: "confirm", message: `Are you sure you want to remove token '${tokens[idx].symbol}'?`, default: false }
      ]);
      if (confirm) {
        tokens.splice(idx, 1);
        fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
        log.success("Token removed.");
      }
    } else if (tokAction === "Edit Token Settings") {
      await editTokenSettings(tokens);
    } else if (tokAction === "Token History") {
      if (tokens.length === 0) { log.warn("No tokens available."); continue; }
      const { idx } = await inquirer.prompt([
        { type: "list", name: "idx", message: "Select token to view history:", choices: tokens.map((t, i) => ({ name: t.symbol, value: i })).concat([{ name: "Back", value: -1 }]) }
      ]);
      if (idx === -1) continue;
      log.step(`Swap History for ${tokens[idx].symbol}:`);
      const filtered = swapHistory.filter(h => h.token === tokens[idx].symbol);
      if (filtered.length === 0) {
        console.log("  No swaps yet for this token.");
      } else {
        filtered.slice(-10).forEach((h, i) => console.log(`  [${i}] [${h.status.toUpperCase()}] ${h.message}${h.status !== 'success' ? ' Reason: ' + h.reason : ''}`));
      }
      await inquirer.prompt([{ type: "input", name: "back", message: "Press Enter to return" }]);
    } else if (tokAction === "Back to Main Menu") {
      break;
    }
  }
}

async function showInfoAndHistory(networks: any[], tokens: any[]) {
  while (true) {
    swapHistory = loadSwapHistory();
    const { histAction } = await inquirer.prompt([
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
      if (networks.length === 0) { log.warn("No networks available."); continue; }
      const { idx } = await inquirer.prompt([
        { type: "list", name: "idx", message: "Select network to view history:", choices: networks.map((n, i) => ({ name: n.name, value: i })).concat([{ name: "Back", value: -1 }]) }
      ]);
      if (idx === -1) continue;
      log.step(`Swap History for ${networks[idx].name}:`);
      const filtered = swapHistory.filter(h => h.includes(networks[idx].name));
      if (filtered.length === 0) {
        console.log("  No swaps yet for this network.");
      } else {
        filtered.slice(-10).forEach((h, i) => console.log(`  [${i}] ${h}`));
      }
      await inquirer.prompt([{ type: "input", name: "back", message: "Press Enter to return" }]);
    } else if (histAction === "Token History") {
      if (tokens.length === 0) { log.warn("No tokens available."); continue; }
      const { idx } = await inquirer.prompt([
        { type: "list", name: "idx", message: "Select token to view history:", choices: tokens.map((t, i) => ({ name: t.symbol, value: i })).concat([{ name: "Back", value: -1 }]) }
      ]);
      if (idx === -1) continue;
      log.step(`Swap History for ${tokens[idx].symbol}:`);
      const filtered = swapHistory.filter(h => h.includes(tokens[idx].symbol));
      if (filtered.length === 0) {
        console.log("  No swaps yet for this token.");
      } else {
        filtered.slice(-10).forEach((h, i) => console.log(`  [${i}] ${h}`));
      }
      await inquirer.prompt([{ type: "input", name: "back", message: "Press Enter to return" }]);
    } else if (histAction === "Swap History (ERC20)") {
      log.step("All ERC20 Swap History:");
      if (swapHistory.length === 0) {
        console.log("  No ERC20 swaps yet.");
      } else {
        swapHistory.slice(-20).forEach((h, i) => console.log(`  [${i}] ${h}`));
      }
      await inquirer.prompt([{ type: "input", name: "back", message: "Press Enter to return" }]);
    } else if (histAction === "Liquidity History (ERC721)") {
      log.step("Liquidity History (ERC721):");
      console.log("  No ERC721 liquidity events tracked yet.");
      await inquirer.prompt([{ type: "input", name: "back", message: "Press Enter to return" }]);
    } else if (histAction === "Custom Deploy History") {
      log.step("Custom Deploy History:");
      console.log("  No custom deploy events tracked yet.");
      await inquirer.prompt([{ type: "input", name: "back", message: "Press Enter to return" }]);
    } else if (histAction === "Back") {
      break;
    }
  }
}

// Restore networkOptionsMenu definition if missing
async function networkOptionsMenu(networks: any[], tokens: any[]) {
  while (true) {
    const { netAction } = await inquirer.prompt([
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
        fs.writeFileSync(NETWORKS_PATH, JSON.stringify(networks, null, 2));
        log.success("Network added.");
      }
    } else if (netAction === "Remove Network") {
      if (networks.length === 0) { log.warn("No networks to remove."); continue; }
      const { idx } = await inquirer.prompt([
        { type: "list", name: "idx", message: "Select network to remove:", choices: networks.map((n, i) => ({ name: n.name, value: i })).concat([{ name: "Back", value: -1 }]) }
      ]);
      if (idx === -1) continue;
      const { confirm } = await inquirer.prompt([
        { type: "confirm", name: "confirm", message: `Are you sure you want to remove network '${networks[idx].name}'?`, default: false }
      ]);
      if (confirm) {
        networks.splice(idx, 1);
        fs.writeFileSync(NETWORKS_PATH, JSON.stringify(networks, null, 2));
        log.success("Network removed.");
      }
    } else if (netAction === "Network History") {
      if (networks.length === 0) { log.warn("No networks available."); continue; }
      const { idx } = await inquirer.prompt([
        { type: "list", name: "idx", message: "Select network to view history:", choices: networks.map((n, i) => ({ name: n.name, value: i })).concat([{ name: "Back", value: -1 }]) }
      ]);
      if (idx === -1) continue;
      log.step(`Swap History for ${networks[idx].name}:`);
      const filtered = swapHistory.filter(h => h.network === networks[idx].name);
      if (filtered.length === 0) {
        console.log("  No swaps yet for this network.");
      } else {
        filtered.slice(-10).forEach((h, i) => console.log(`  [${i}] [${h.status ? h.status.toUpperCase() : ''}] ${h.message}${h.status && h.status !== 'success' ? ' Reason: ' + h.reason : ''}`));
      }
      await inquirer.prompt([{ type: "input", name: "back", message: "Press Enter to return" }]);
    } else if (netAction === "Back to Main Menu") {
      break;
    }
  }
}

// Define available functions per network (can be extended)
const NETWORK_FUNCTIONS: Record<string, string[]> = {
  'Pharos Testnet': ["Swap", "Liquidity", "Transfer", "Faucet", "Deploy", "Check-in", "Run all functions"],
  // You can still override for specific networks if needed
  // 'Some Network': ['Swap', ...],
};

const DEFAULT_FUNCTIONS = ["Swap", "Liquidity", "Transfer", "Faucet", "Deploy", "Run all functions"];

// Helper to get available functions for a network
function getNetworkFunctions(networkName: string): string[] {
  return NETWORK_FUNCTIONS[networkName] || DEFAULT_FUNCTIONS;
}

// --- Extracted function for Swap ---
async function runSwap({net, tokens, provider, privateKeys, walletIndex, simulationMode, log, contractExists, toFixedDecimals, ethers, swapCount, swapHistory}: any) {
  // Router contract
  const routerAbi = [
    "function multicall(uint256 deadline, bytes[] data) external payable returns (bytes[] memory)"
  ];
  const routerAddress = "0x1a4de519154ae51200b0ad7c90f7fac75547888a";
  const router = new ethers.Contract(routerAddress, routerAbi, provider) as any;
  // Filter valid tokens (contract exists)
  const validTokens = [];
  for (const token of tokens) {
    const exists = await contractExists(provider, token.address);
    if (exists) validTokens.push(token);
  }
  if (validTokens.length === 0) {
    log.error(`No valid token contracts found on ${net.name}. Skipping swap.`);
    return { status: 'skipped', reason: 'No valid tokens' };
  }
  const wallet = new ethers.Wallet(privateKeys[walletIndex % privateKeys.length], provider);
  walletIndex++;
  const token = validTokens[Math.floor(Math.random() * validTokens.length)];
  const min = token.min || 0.001, max = token.max || 0.01;
  const amount = Math.floor((Math.random() * (max - min) + min) * Math.pow(10, token.decimals)) / Math.pow(10, token.decimals);
  const amountWei = ethers.parseUnits(toFixedDecimals(amount, token.decimals), token.decimals);
  const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
  const swapData: string[] = [];
  log.step(`Preparing to swap ${amount} ${token.symbol} on ${net.name} using wallet ${wallet.address}`);
  if (simulationMode) {
    log.info(`[SIMULATION] Would perform: Swap ${amount} ${token.symbol} on ${net.name} using wallet ${wallet.address}`);
    return { status: 'simulated' };
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
      swapHistory.push({ status: 'success', txHash: receipt.hash, type: 'Swap', network: net.name });
      return { status: 'success', txHash: receipt.hash };
    } else {
      log.warn(`Swap #${swapCount + 1} failed. Check transaction.`);
      return { status: 'failed' };
    }
  } catch (err: any) {
    log.error(`Swap error: ${err.message || err}`);
    return { status: 'error', reason: err.message };
  }
}

// --- Extracted function for Transfer ---
async function runTransfer({net, provider, privateKeys, walletIndex, simulationMode, log, receiver}: any) {
  // For demo, just simulate or prompt for address
  if (simulationMode) {
    log.info("[SIMULATION] Would perform: Transfer PHRS");
    return { status: 'simulated' };
  }
  let toAddress = receiver;
  if (!toAddress) {
    // Prompt for receiver address only if not provided
    const input = await inquirer.prompt([
      { type: "input", name: "toAddress", message: "Enter the receiver address for PHRS transfer (or leave blank to skip):" }
    ]);
    toAddress = input.toAddress;
    if (!toAddress) return { status: 'skipped', reason: 'No address provided' };
  }
  const wallet = new ethers.Wallet(privateKeys[walletIndex % privateKeys.length], provider);
  walletIndex++;
  const amount = 0.000001;
  try {
    log.step(`Preparing PHRS transfer: ${amount} PHRS to ${toAddress}`);
    const balance = await provider.getBalance(wallet.address);
    const required = ethers.parseEther(amount.toString());
    if (balance < required) {
      log.warn(`Skipping transfer: Insufficient PHRS balance: ${ethers.formatEther(balance)} < ${amount}`);
      return { status: 'skipped', reason: 'Insufficient balance' };
    }
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.parseUnits('1', 'gwei');
    const tx = await wallet.sendTransaction({
      to: toAddress,
      value: required,
      gasLimit: 21000,
      gasPrice,
      maxFeePerGas: feeData.maxFeePerGas || undefined,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || undefined,
    });
    log.loading(`Transfer transaction sent, waiting for confirmation...`);
    const receipt = await provider.waitForTransaction(tx.hash);
    log.success(`Transfer completed: ${receipt.hash}`);
    log.step(`Explorer: https://testnet.pharosscan.xyz/tx/${receipt.hash}`);
    return { status: 'success', txHash: receipt.hash };
  } catch (error: any) {
    log.error(`Transfer failed: ${error.message}`);
    return { status: 'error', reason: error.message };
  }
}

// --- Helper: claimFaucet (TypeScript) ---
// If randomUseragent and HttpsProxyAgent are available, import them. Otherwise, use static User-Agent and skip proxy.
// import randomUseragent from 'random-useragent';
// import HttpsProxyAgent from 'https-proxy-agent';

async function claimFaucetTS(wallet: any, log: any, proxy: string | null = null): Promise<boolean> {
  try {
    log.step(`Checking faucet eligibility for wallet: ${wallet.address}`);
    const message = "pharos";
    const signature = await wallet.signMessage(message);
    log.step(`Signed message: ${signature}`);
    const loginUrl = `https://api.pharosnetwork.xyz/user/login?address=${wallet.address}&signature=${signature}&inviteCode=03k2hgkzM1rh5Dog`;
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
      // "User-Agent": randomUseragent.getRandom(),
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };
    const axiosConfig: any = {
      method: 'post',
      url: loginUrl,
      headers,
      // httpsAgent: proxy ? new HttpsProxyAgent(proxy) : undefined,
    };
    log.loading('Sending login request for faucet...');
    const loginResponse = await axios(axiosConfig);
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
    const statusResponse = await axios({
      method: 'get',
      url: statusUrl,
      headers: statusHeaders,
      // httpsAgent: proxy ? new HttpsProxyAgent(proxy) : undefined,
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
    const claimResponse = await axios({
      method: 'post',
      url: claimUrl,
      headers: statusHeaders,
      // httpsAgent: proxy ? new HttpsProxyAgent(proxy) : undefined,
    });
    const claimData = claimResponse.data;
    if (claimData.code === 0) {
      log.success(`Faucet claimed successfully for ${wallet.address}`);
      return true;
    } else {
      log.error(`Faucet claim failed: ${claimData.msg || 'Unknown error'}`);
      return false;
    }
  } catch (error: any) {
    log.error(`Faucet claim failed for ${wallet.address}: ${error.message}`);
    return false;
  }
}

// --- Helper: performCheckIn (TypeScript) ---
async function performCheckInTS(wallet: any, log: any, proxy: string | null = null): Promise<string | null> {
  try {
    log.step(`Performing daily check-in for wallet: ${wallet.address}`);
    const message = "pharos";
    const signature = await wallet.signMessage(message);
    log.step(`Signed message: ${signature}`);
    const loginUrl = `https://api.pharosnetwork.xyz/user/login?address=${wallet.address}&signature=${signature}&inviteCode=03k2hgkzM1rh5Dog`;
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
      // "User-Agent": randomUseragent.getRandom(),
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };
    const axiosConfig: any = {
      method: 'post',
      url: loginUrl,
      headers,
      // httpsAgent: proxy ? new HttpsProxyAgent(proxy) : undefined,
    };
    log.loading('Sending login request...');
    const loginResponse = await axios(axiosConfig);
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
    const checkInResponse = await axios({
      method: 'post',
      url: checkInUrl,
      headers: checkInHeaders,
      // httpsAgent: proxy ? new HttpsProxyAgent(proxy) : undefined,
    });
    const checkInData = checkInResponse.data;
    if (checkInData.code === 0) {
      log.success(`Check-in successful for ${wallet.address}`);
      return jwt;
    } else {
      log.warn(`Check-in failed, possibly already checked in: ${checkInData.msg || 'Unknown error'}`);
      return jwt;
    }
  } catch (error: any) {
    log.error(`Check-in failed for ${wallet.address}: ${error.message}`);
    return null;
  }
}

// --- Update runFaucet and runCheckin to use these helpers ---
async function runFaucet({net, provider, privateKeys, walletIndex, simulationMode, log}: any) {
  if (simulationMode) {
    log.info("[SIMULATION] Would perform: Faucet claim");
    return { status: 'simulated' };
  }
  const wallet = new ethers.Wallet(privateKeys[walletIndex % privateKeys.length], provider);
  walletIndex++;
  try {
    const success = await claimFaucetTS(wallet, log);
    if (success) {
      return { status: 'success' };
    } else {
      return { status: 'failed' };
    }
  } catch (err: any) {
    log.error(`Faucet error: ${err.message}`);
    return { status: 'error', reason: err.message };
  }
}

async function runCheckin({net, provider, privateKeys, walletIndex, simulationMode, log}: any) {
  if (simulationMode) {
    log.info("[SIMULATION] Would perform: Check-in");
    return { status: 'simulated' };
  }
  const wallet = new ethers.Wallet(privateKeys[walletIndex % privateKeys.length], provider);
  walletIndex++;
  try {
    const jwt = await performCheckInTS(wallet, log);
    if (jwt) {
      return { status: 'success' };
    } else {
      return { status: 'failed' };
    }
  } catch (err: any) {
    log.error(`Check-in error: ${err.message}`);
    return { status: 'error', reason: err.message };
  }
}

// --- Extracted function for Deploy ---
async function runDeploy({net, provider, privateKeys, walletIndex, simulationMode, log, deployReceiver}: any) {
  // Load deployed contract addresses
  let deployed;
  try {
    deployed = JSON.parse(fs.readFileSync(path.resolve(__dirname, "deployed-contracts.json"), "utf-8"));
  } catch {
    log.error("Could not load deployed-contracts.json. Please deploy contracts first.");
    return { status: 'error', reason: 'No deployed contracts' };
  }
  const actions = [
    'timer', // PerpetualTimer
    'erc20', // CustomERC20 transfer
    'erc1155', // CustomERC1155 transfer
    'erc165' // CustomERC165 read
  ];
  // Randomly select 2 unique actions
  const selected = [] as string[];
  while (selected.length < 2) {
    const pick = actions[Math.floor(Math.random() * actions.length)];
    if (!selected.includes(pick)) selected.push(pick);
  }
  const wallet = new ethers.Wallet(privateKeys[walletIndex % privateKeys.length], provider);
  walletIndex++;
  let results: any[] = [];
  for (const action of selected) {
    if (action === 'timer') {
      // PerpetualTimer
      const contractAddress = "0x541805121a6E4C4DD2D36c90bFFc70A1379d66F3";
      const contractAbi = [
        { "inputs": [], "stateMutability": "nonpayable", "type": "constructor" },
        { "anonymous": false, "inputs": [ { "indexed": true, "internalType": "address", "name": "caller", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "newStartTime", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "newDuration", "type": "uint256" } ], "name": "TimerReset", "type": "event" },
        { "anonymous": false, "inputs": [ { "indexed": true, "internalType": "address", "name": "starter", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "startTime", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "duration", "type": "uint256" } ], "name": "TimerStarted", "type": "event" },
        { "inputs": [], "name": "checkTimer", "outputs": [ { "internalType": "string", "name": "status", "type": "string" }, { "internalType": "uint256", "name": "timeLeft", "type": "uint256" } ], "stateMutability": "view", "type": "function" },
        { "inputs": [], "name": "getCurrentTime", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" },
        { "inputs": [], "name": "isTimerActive", "outputs": [ { "internalType": "bool", "name": "", "type": "bool" } ], "stateMutability": "view", "type": "function" },
        { "inputs": [], "name": "owner", "outputs": [ { "internalType": "address", "name": "", "type": "address" } ], "stateMutability": "view", "type": "function" },
        { "inputs": [ { "internalType": "uint256", "name": "durationInSeconds", "type": "uint256" } ], "name": "startTimer", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
        { "inputs": [], "name": "timerDuration", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" },
        { "inputs": [], "name": "timerStart", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" }
      ];
      const timerContract = new ethers.Contract(contractAddress, contractAbi, wallet);
      const randomSeconds = Math.floor(Math.random() * (50 - 30 + 1)) + 30;
      log.step(`Calling startTimer with duration ${randomSeconds} seconds...`);
      try {
        const tx = await timerContract.startTimer(randomSeconds);
        log.loading("Waiting for startTimer confirmation...");
        const receipt = await tx.wait();
        log.success(`startTimer called. Tx: ${receipt.hash}`);
        results.push({ status: 'success', txHash: receipt.hash, action: 'PerpetualTimer' });
      } catch (e: any) {
        log.error(`startTimer failed: ${e.message}`);
        results.push({ status: 'error', reason: e.message, action: 'PerpetualTimer' });
      }
    } else if (action === 'erc20') {
      // CustomERC20 transfer
      const contractAddress = deployed.ERC20.address;
      const contract = new ethers.Contract(contractAddress, CUSTOM_ERC20_ABI, wallet);
      const receiver = deployReceiver;
      const amount = Math.floor(Math.random() * (5000 - 1000 + 1)) + 1000;
      log.step(`Transferring ${amount} CustomERC20 tokens to ${receiver}...`);
      try {
        const decimals = 18;
        const tx = await contract.transfer(receiver, ethers.parseUnits(amount.toString(), decimals));
        log.loading("Waiting for ERC20 transfer confirmation...");
        const receipt = await tx.wait();
        log.success(`CustomERC20 transfer complete. Tx: ${receipt.hash}`);
        results.push({ status: 'success', txHash: receipt.hash, action: 'CustomERC20 Transfer', amount });
      } catch (e: any) {
        log.error(`CustomERC20 transfer failed: ${e.message}`);
        results.push({ status: 'error', reason: e.message, action: 'CustomERC20 Transfer' });
      }
    } else if (action === 'erc1155') {
      // CustomERC1155 transfer
      const contractAddress = deployed.ERC1155.address;
      const contract = new ethers.Contract(contractAddress, CUSTOM_ERC1155_ABI, wallet);
      const receiver = deployReceiver;
      const tokenId = 1;
      const amount = Math.floor(Math.random() * (10 - 1 + 1)) + 1;
      log.step(`Transferring ${amount} CustomERC1155 tokens (id 1) to ${receiver}...`);
      try {
        const tx = await contract.safeTransferFrom(wallet.address, receiver, tokenId, amount, "0x");
        log.loading("Waiting for ERC1155 transfer confirmation...");
        const receipt = await tx.wait();
        log.success(`CustomERC1155 transfer complete. Tx: ${receipt.hash}`);
        results.push({ status: 'success', txHash: receipt.hash, action: 'CustomERC1155 Transfer', amount });
      } catch (e: any) {
        log.error(`CustomERC1155 transfer failed: ${e.message}`);
        results.push({ status: 'error', reason: e.message, action: 'CustomERC1155 Transfer' });
      }
    } else if (action === 'erc165') {
      // CustomERC165 read
      const contractAddress = deployed.ERC165.address;
      const contract = new ethers.Contract(contractAddress, CUSTOM_ERC165_ABI, wallet);
      try {
        const desc = await contract.getDescription();
        log.success(`CustomERC165 description: ${desc}`);
        results.push({ status: 'success', action: 'CustomERC165 Read', description: desc });
      } catch (e: any) {
        log.error(`CustomERC165 read failed: ${e.message}`);
        results.push({ status: 'error', reason: e.message, action: 'CustomERC165 Read' });
      }
    }
  }
  // Return summary for bulk run
  return { status: 'multi', results };
}

// Enhanced Start Automation logic
async function startAutomationMenu(networks: any[], tokens: any[]) {
  // Select networks
  const { whichNetworks } = await inquirer.prompt([
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
  const networkFunctionMap: Record<string, string[]> = {};
  for (const net of whichNetworks) {
    const available = getNetworkFunctions(net.name);
    const { funcs } = await inquirer.prompt([
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
  console.log(chalk.cyan("You have selected the following networks and functions:"));
  Object.entries(networkFunctionMap).forEach(([net, funcs]) => {
    console.log(`- ${net}: ${funcs.join(", ")}`);
  });
  const { confirmStart } = await inquirer.prompt([
    { type: "confirm", name: "confirmStart", message: "Proceed with automation?", default: true }
  ]);
  if (!confirmStart) {
    log.warn("Automation cancelled. Returning to menu.");
    return;
  }
  // Pass selected networks and functions to automationLoop
  await automationLoop(
    networks.filter(n => networkFunctionMap[n.name]),
    tokens,
    networkFunctionMap
  );
}

// Helper: Approve token if needed
async function approveIfNeeded(tokenAddress: string, owner: string, spender: string, amount: bigint, wallet: any, provider: any, decimals: number) {
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const allowance = await token.allowance(owner, spender);
  if (allowance < amount) {
    log.step(`Approving token ${tokenAddress} for ${spender}...`);
    if (simulationMode) {
      log.info(`[SIMULATION] Would approve ${spender} for ${amount.toString()} of token ${tokenAddress}`);
      return;
    }
    const tx = await (token.connect(wallet) as any).approve(spender, ethers.MaxUint256);
    await tx.wait();
  }
}

// Custom Contract Interactions storage
let customContracts: any[] = [];

async function customContractMenu(networks: any[], tokens: any[], wallet: any, provider: any) {
  while (true) {
    const { action } = await inquirer.prompt([
      { type: "list", name: "action", message: "Custom Contract Interactions:", choices: ["Add Interaction", "View/Run Interactions", "Back"] }
    ]);
    if (action === "Add Interaction") {
      const { address, abi, method, params } = await inquirer.prompt([
        { type: "input", name: "address", message: "Contract address:" },
        { type: "input", name: "abi", message: "Contract ABI (JSON array):" },
        { type: "input", name: "method", message: "Method name to call:" },
        { type: "input", name: "params", message: "Parameters (comma-separated):" }
      ]);
      customContracts.push({ address, abi: JSON.parse(abi), method, params: params.split(",").map((p: string) => p.trim()) });
      log.success("Custom interaction added.");
    } else if (action === "View/Run Interactions") {
      if (customContracts.length === 0) { log.warn("No custom interactions."); continue; }
      const { idx } = await inquirer.prompt([
        { type: "list", name: "idx", message: "Select interaction:", choices: customContracts.map((c, i) => ({ name: `${c.address} - ${c.method}`, value: i })).concat([{ name: "Back", value: -1 }]) }
      ]);
      if (idx === -1) continue;
      const c = customContracts[idx];
      const contract = new ethers.Contract(c.address, c.abi, provider);
      log.step(`Running custom interaction: ${c.method}(${c.params.join(", ")}) on ${c.address}`);
      if (simulationMode) {
        log.info(`[SIMULATION] Would call ${c.method}(${c.params.join(", ")}) on ${c.address}`);
        continue;
      }
      try {
        const tx = await (contract.connect(wallet) as any)[c.method](...c.params);
        log.loading("Waiting for confirmation...");
        const receipt = await tx.wait();
        if (receipt.status === 1) {
          log.success(`Custom contract call successful! Tx Hash: ${receipt.hash}`);
        } else {
          log.warn("Custom contract call failed.");
        }
      } catch (err: any) {
        log.error(`Custom contract error: ${err.message || err}`);
      }
    } else if (action === "Back") {
      break;
    }
  }
}

// Helper to round/truncate to correct decimals for parseUnits
function toFixedDecimals(amount: number, decimals: number): string {
  return amount.toFixed(decimals);
}

async function mainMenu(networks: any[], tokens: any[], privateKey: string) {
  while (true) {
    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "Main Menu - Choose an option:",
        choices: [
          new inquirer.Separator("= Automation ="),
          "Start Automation",
          new inquirer.Separator("= Network & Tokens ="),
          "Network Options",
          "Token Options",
          "Swap Settings",
          new inquirer.Separator("= Info ="),
          "Show Info & History",
          new inquirer.Separator("= Contracts ="),
          "Deploy Options",
          new inquirer.Separator("= Other ="),
          "Other",
          "Exit"
        ]
      }
    ]);
    if (action === "Start Automation") {
      await startAutomationMenu(networks, tokens);
    } else if (action === "Network Options") {
      await networkOptionsMenu(networks, tokens);
    } else if (action === "Token Options") {
      await tokenOptionsMenu(tokens, networks);
    } else if (action === "Swap Settings") {
      await swapSettingsMenu();
    } else if (action === "Show Info & History") {
      await showInfoAndHistory(networks, tokens);
    } else if (action === "Deploy Options") {
      await deployOptionsMenu(networks, tokens, privateKey);
    } else if (action === "Other") {
      await otherMenu();
    } else if (action === "Exit") {
      log.warn("Exiting bot.");
      process.exit(0);
    }
  }
}

async function otherMenu() {
  while (true) {
    const { otherAction } = await inquirer.prompt([
      {
        type: "list",
        name: "otherAction",
        message: "Other Options:",
        choices: [
          simulationMode ? "Disable Simulation Mode" : "Enable Simulation Mode",
          "Back to Main Menu"
        ]
      }
    ]);
    if (otherAction === "Enable Simulation Mode") {
      simulationMode = true;
      log.success("Simulation/Dry Run Mode enabled. No real transactions will be sent.");
    } else if (otherAction === "Disable Simulation Mode") {
      simulationMode = false;
      log.success("Simulation/Dry Run Mode disabled. Real transactions will be sent.");
    } else if (otherAction === "Back to Main Menu") {
      break;
    }
  }
}

async function deployOptionsMenu(networks: any[], tokens: any[], privateKey: string) {
  while (true) {
    const { deployAction } = await inquirer.prompt([
      {
        type: "list",
        name: "deployAction",
        message: "Deploy Options:",
        choices: [
          "Custom Contract Interactions",
          "Deployed Contracts",
          "Back"
        ]
      }
    ]);
    if (deployAction === "Custom Contract Interactions") {
      const wallet = new ethers.Wallet(privateKey, networks[0] ? new ethers.JsonRpcProvider(networks[0].rpc, networks[0].chainId) : undefined);
      while (true) {
        await customContractMenu(networks, tokens, wallet, networks[0] ? new ethers.JsonRpcProvider(networks[0].rpc, networks[0].chainId) : undefined);
        const { cont } = await inquirer.prompt([
          { type: "confirm", name: "cont", message: "Continue with another contract interaction?", default: false }
        ]);
        if (!cont) break;
      }
    } else if (deployAction === "Deployed Contracts") {
      const wallet = new ethers.Wallet(privateKey, networks[0] ? new ethers.JsonRpcProvider(networks[0].rpc, networks[0].chainId) : undefined);
      while (true) {
        await deployedContractsMenu(wallet, networks[0] ? new ethers.JsonRpcProvider(networks[0].rpc, networks[0].chainId) : undefined);
        const { cont } = await inquirer.prompt([
          { type: "confirm", name: "cont", message: "Continue with another deployed contract?", default: false }
        ]);
        if (!cont) break;
      }
    } else if (deployAction === "Back") {
      break;
    }
  }
}

// In automationLoop, add logic to prompt for transfer receiver before running all functions
let globalTransferReceiver: string | null = null;
async function automationLoop(selectedNetworks: any[], tokens: any[], networkFunctionMap?: Record<string, string[]>) {
  automationActive = true;
  let swapCount = 0, transferCount = 0, faucetCount = 0, deployCount = 0, checkinCount = 0, liquidityCount = 0;
  let swapHistory: any[] = [];
  let privateKeys = loadPrivateKeysFromEnv();
  let walletIndex = 0;
  log.success("Automation started! Press Ctrl+C to stop and return to menu.");
  let stopRequested = false;
  let returnToStartAutomation = false;
  process.on("SIGINT", async () => {
    if (automationActive && !stopRequested) {
      stopRequested = true;
      const { confirmStop } = await inquirer.prompt([
        { type: "confirm", name: "confirmStop", message: "Are you sure you want to stop automation?", default: true }
      ]);
      if (confirmStop) {
        log.warn("\nAutomation stopped. Returning to Start Automation menu...");
        automationActive = false;
        returnToStartAutomation = true;
      } else {
        stopRequested = false;
      }
    }
  });
  // Prompt for transfer receiver if running all functions, but only if not already set
  let promptForReceiver = false;
  for (const net of selectedNetworks) {
    let selectedFuncs = networkFunctionMap ? networkFunctionMap[net.name] : ["Swap"];
    if (selectedFuncs.includes("Run all functions")) {
      selectedFuncs = getNetworkFunctions(net.name).filter(f => f !== "Run all functions");
    }
    if (
      selectedFuncs.length === 6 &&
      selectedFuncs.includes("Swap") &&
      selectedFuncs.includes("Liquidity") &&
      selectedFuncs.includes("Transfer") &&
      selectedFuncs.includes("Faucet") &&
      selectedFuncs.includes("Deploy") &&
      selectedFuncs.includes("Check-in")
    ) {
      promptForReceiver = true;
      break;
    }
  }
  if (promptForReceiver && !globalTransferReceiver) {
    const { receiver } = await inquirer.prompt([
      { type: "input", name: "receiver", message: "Enter the receiver address for all Transfer steps in automation:" }
    ]);
    globalTransferReceiver = receiver;
  }
  while (automationActive) {
    for (const net of selectedNetworks) {
      let selectedFuncs = networkFunctionMap ? networkFunctionMap[net.name] : ["Swap"];
      if (selectedFuncs.includes("Run all functions")) {
        selectedFuncs = getNetworkFunctions(net.name).filter(f => f !== "Run all functions");
      }
      if (!selectedFuncs || selectedFuncs.length === 0) continue;
      const provider = new ethers.JsonRpcProvider(net.rpc, net.chainId);
      // If running all functions, do them in sequence, not parallel
      if (
        selectedFuncs.length === 6 &&
        selectedFuncs.includes("Swap") &&
        selectedFuncs.includes("Liquidity") &&
        selectedFuncs.includes("Transfer") &&
        selectedFuncs.includes("Faucet") &&
        selectedFuncs.includes("Deploy") &&
        selectedFuncs.includes("Check-in")
      ) {
        let summary: any[] = [];
        // SWAP
        let swapResult = await runSwap({net, tokens, provider, privateKeys, walletIndex, simulationMode, log, contractExists, toFixedDecimals, ethers, swapCount, swapHistory});
        summary.push({ function: 'Swap', ...swapResult });
        // LIQUIDITY
        log.warn("Liquidity function is not yet implemented.");
        summary.push({ function: 'Liquidity', status: 'skipped', reason: 'Not implemented' });
        // TRANSFER
        let transferResult = await runTransfer({net, provider, privateKeys, walletIndex, simulationMode, log, receiver: globalTransferReceiver});
        summary.push({ function: 'Transfer', ...transferResult });
        // FAUCET
        let faucetResult = await runFaucet({net, provider, privateKeys, walletIndex, simulationMode, log});
        summary.push({ function: 'Faucet', ...faucetResult });
        // DEPLOY
        let deployResult = await runDeploy({net, provider, privateKeys, walletIndex, simulationMode, log, deployReceiver: globalTransferReceiver});
        summary.push({ function: 'Deploy', ...deployResult });
        // CHECK-IN
        let checkinResult = await runCheckin({net, provider, privateKeys, walletIndex, simulationMode, log});
        summary.push({ function: 'Check-in', ...checkinResult });
        // Display summary
        log.info("\n=== Bulk Run Summary ===");
        summary.forEach((s: any) => {
          log.info(`${s.function}: ${s.status}${s.txHash ? ` (Tx: ${s.txHash})` : ''}${s.reason ? ` - ${s.reason}` : ''}`);
        });
        log.info("=======================\n");
        // Wait random interval before next bulk run
        if (!automationActive) break;
        const waitSec = Math.floor(Math.random() * (40 - 30 + 1)) + 30;
        log.loading(`Waiting ${waitSec} seconds before next bulk run...`);
        await new Promise(res => setTimeout(res, waitSec * 1000));
        continue;
      }
      // Otherwise, run selected functions in parallel as before
      await Promise.all(selectedFuncs.map(async (func) => {
        if (!automationActive) return;
        if (func === "Swap") {
          let swapResult = await runSwap({net, tokens, provider, privateKeys, walletIndex, simulationMode, log, contractExists, toFixedDecimals, ethers, swapCount, swapHistory});
          if (swapResult.status === 'success') {
            swapCount++;
            log.success(`Swap #${swapCount} for ${tokens[0].symbol} on ${net.name} complete!`);
            log.success(`Tx Hash: ${swapResult.txHash}`);
            log.success(`Explorer: https://testnet.pharosscan.xyz/tx/${swapResult.txHash}`);
            swapHistory.push({ status: 'success', txHash: swapResult.txHash, type: 'Swap', network: net.name });
          } else {
            log.warn(`Swap #${swapCount + 1} failed. Reason: ${swapResult.reason}`);
            swapHistory.push({ status: swapResult.status, type: 'Swap', network: net.name, reason: swapResult.reason });
          }
        } else if (func === "Liquidity") {
          // Liquidity logic is currently disabled. To be implemented soon.
          log.step("(Stub) Liquidity function is not yet implemented.");
          return;
        } else if (func === "Transfer") {
          let transferResult = await runTransfer({net, provider, privateKeys, walletIndex, simulationMode, log, receiver: globalTransferReceiver});
          if (transferResult.status === 'success') {
            transferCount++;
            log.success(`Transfer completed: ${transferResult.txHash}`);
            log.step(`Explorer: https://testnet.pharosscan.xyz/tx/${transferResult.txHash}`);
            swapHistory.push({ status: transferResult.status, type: 'Transfer', network: net.name, reason: transferResult.reason });
          } else {
            log.warn(`Transfer failed. Reason: ${transferResult.reason}`);
            swapHistory.push({ status: transferResult.status, type: 'Transfer', network: net.name, reason: transferResult.reason });
          }
        } else if (func === "Faucet") {
          let faucetResult = await runFaucet({net, provider, privateKeys, walletIndex, simulationMode, log});
          if (faucetResult.status === 'success') {
            faucetCount++;
            log.success(`Faucet claimed successfully.`);
            swapHistory.push({ status: faucetResult.status, type: 'Faucet', network: net.name, reason: faucetResult.reason });
          } else {
            log.warn(`Faucet claim failed. Reason: ${faucetResult.reason}`);
            swapHistory.push({ status: faucetResult.status, type: 'Faucet', network: net.name, reason: faucetResult.reason });
          }
        } else if (func === "Check-in") {
          let checkinResult = await runCheckin({net, provider, privateKeys, walletIndex, simulationMode, log});
          if (checkinResult.status === 'success') {
            checkinCount++;
            log.success(`Check-in successful.`);
            swapHistory.push({ status: checkinResult.status, type: 'Check-in', network: net.name, reason: checkinResult.reason });
          } else {
            log.warn(`Check-in failed. Reason: ${checkinResult.reason}`);
            swapHistory.push({ status: checkinResult.status, type: 'Check-in', network: net.name, reason: checkinResult.reason });
          }
        } else if (func === "Deploy") {
          let deployResult = await runDeploy({net, provider, privateKeys, walletIndex, simulationMode, log, deployReceiver: globalTransferReceiver});
          if (deployResult.status === 'success') {
            deployCount++;
            log.success(`Deploy/StartTimer called. Tx: ${deployResult.txHash}`);
            log.step(`Explorer: https://testnet.pharosscan.xyz/tx/${deployResult.txHash}`);
            swapHistory.push({ status: deployResult.status, type: 'Deploy', network: net.name, reason: deployResult.reason });
          } else {
            log.warn(`Deploy/StartTimer failed. Reason: ${deployResult.reason}`);
            swapHistory.push({ status: deployResult.status, type: 'Deploy', network: net.name, reason: deployResult.reason });
          }
        }
      }));
      if (!automationActive) break;
    }
    if (!automationActive) break;
  }
  // If user stopped automation and returnToStartAutomation is set, go back to Start Automation menu
  if (returnToStartAutomation) {
    await startAutomationMenu(selectedNetworks, tokens);
  }
}

async function deployedContractsMenu(wallet: any, provider: any) {
  while (true) {
    const { contractType } = await inquirer.prompt([
      {
        type: "list",
        name: "contractType",
        message: "Select a deployed contract to interact with:",
        choices: [
          { name: "CustomERC20", value: "ERC20" },
          { name: "CustomERC1155", value: "ERC1155" },
          { name: "CustomERC165", value: "ERC165" },
          { name: "Back", value: "back" }
        ]
      }
    ]);
    if (contractType === "back") break;
    if (contractType === "ERC20") {
      const contract = new ethers.Contract(DEPLOYED_ADDRESSES.ERC20, CUSTOM_ERC20_ABI, wallet);
      const name = await contract.name();
      const symbol = await contract.symbol();
      const totalSupply = await contract.totalSupply();
      const myBalance = await contract.balanceOf(wallet.address);
      console.log(chalk.green(`\nCustomERC20: ${name} (${symbol})`));
      console.log(`Total Supply: ${ethers.formatUnits(totalSupply, 18)}`);
      console.log(`Your Balance: ${ethers.formatUnits(myBalance, 18)}`);
      const { erc20Action } = await inquirer.prompt([
        { type: "list", name: "erc20Action", message: "Action:", choices: ["Transfer", "Show Crypto Word", "Back"] }
      ]);
      if (erc20Action === "Transfer") {
        const { to, amount } = await inquirer.prompt([
          { type: "input", name: "to", message: "Recipient address:" },
          { type: "input", name: "amount", message: "Amount to transfer:" }
        ]);
        const tx = await contract.transfer(to, ethers.parseUnits(amount, 18));
        console.log(chalk.yellow(`Sent! Tx: ${tx.hash}`));
        await tx.wait();
      } else if (erc20Action === "Show Crypto Word") {
        const { index } = await inquirer.prompt([
          { type: "input", name: "index", message: "Word index (0-255):", validate: (v: string) => !isNaN(Number(v)) && Number(v) >= 0 && Number(v) < 256 }
        ]);
        const word = await contract.cryptoWords(index);
        console.log(chalk.cyan(`Word #${index}: ${word}`));
      }
    } else if (contractType === "ERC1155") {
      const contract = new ethers.Contract(DEPLOYED_ADDRESSES.ERC1155, CUSTOM_ERC1155_ABI, wallet);
      const name = await contract.name();
      const intervalWord = await contract.intervalWord();
      console.log(chalk.green(`\nCustomERC1155: ${name} (Interval: ${intervalWord})`));
      const { erc1155Action } = await inquirer.prompt([
        { type: "list", name: "erc1155Action", message: "Action:", choices: ["Show Balance", "Show Crypto Word", "Back"] }
      ]);
      if (erc1155Action === "Show Balance") {
        const { tokenId } = await inquirer.prompt([
          { type: "input", name: "tokenId", message: "Token ID:", default: "1" }
        ]);
        const bal = await contract.balanceOf(wallet.address, tokenId);
        console.log(chalk.cyan(`Balance of token ${tokenId}: ${bal}`));
      } else if (erc1155Action === "Show Crypto Word") {
        const { index } = await inquirer.prompt([
          { type: "input", name: "index", message: "Word index (0-255):", validate: (v: string) => !isNaN(Number(v)) && Number(v) >= 0 && Number(v) < 256 }
        ]);
        const word = await contract.cryptoWords(index);
        console.log(chalk.cyan(`Word #${index}: ${word}`));
      }
    } else if (contractType === "ERC165") {
      const contract = new ethers.Contract(DEPLOYED_ADDRESSES.ERC165, CUSTOM_ERC165_ABI, wallet);
      const desc = await contract.getDescription();
      console.log(chalk.green(`\nCustomERC165 Description: ${desc}`));
      const { erc165Action } = await inquirer.prompt([
        { type: "list", name: "erc165Action", message: "Action:", choices: ["Show Crypto Word", "Back"] }
      ]);
      if (erc165Action === "Show Crypto Word") {
        const { index } = await inquirer.prompt([
          { type: "input", name: "index", message: "Word index (0-255):", validate: (v: string) => !isNaN(Number(v)) && Number(v) >= 0 && Number(v) < 256 }
        ]);
        const word = await contract.cryptoWords(index);
        console.log(chalk.cyan(`Word #${index}: ${word}`));
      }
    }
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