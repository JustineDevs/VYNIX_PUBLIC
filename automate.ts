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

const ENV_PATH = path.resolve(__dirname, ".env");
const ENV_EXAMPLE_PATH = path.resolve(__dirname, "env.example");
// Robust dotenv loading: try both script dir and project root
(function robustDotenvLoad() {
  const scriptEnv = path.resolve(__dirname, ".env");
  const rootEnv = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(scriptEnv)) {
    dotenv.config({ path: scriptEnv });
    console.log(`Loaded .env from: ${scriptEnv}`);
  } else if (fs.existsSync(rootEnv)) {
    dotenv.config({ path: rootEnv });
    console.log(`Loaded .env from: ${rootEnv}`);
  } else {
    console.log("No .env file found in script or project root.");
  }
})();

const NETWORKS_PATH = path.resolve(__dirname, "networks.json");
const TOKENS_PATH = path.resolve(__dirname, "tokens.json");
const SWAP_HISTORY_PATH = path.resolve(__dirname, "swapHistory.json");
const ACTIVITY_HISTORY_PATH = path.resolve(__dirname, "activityHistory.json");

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

// Helper to validate private key format and checksum
function validatePrivateKey(privateKey: string): { isValid: boolean; error?: string } {
  // Check if it starts with 0x
  if (!privateKey.startsWith('0x')) {
    return { isValid: false, error: "Private key must start with '0x'" };
  }
  
  // Check if it's exactly 66 characters (0x + 64 hex chars)
  if (privateKey.length !== 66) {
    return { isValid: false, error: "Private key must be exactly 64 hexadecimal characters after '0x'" };
  }
  
  // Check if it contains only valid hexadecimal characters
  const hexRegex = /^0x[0-9a-fA-F]{64}$/;
  if (!hexRegex.test(privateKey)) {
    return { isValid: false, error: "Private key contains invalid characters. Only hexadecimal (0-9, a-f, A-F) allowed" };
  }
  
  // Check if it's not all zeros (common invalid key)
  if (privateKey === '0x0000000000000000000000000000000000000000000000000000000000000000') {
    return { isValid: false, error: "Private key cannot be all zeros" };
  }
  
  // Check if it's not the example key from env.example
  if (privateKey === '0x0000000000000000000000000000000000000000000000000000000000000000') {
    return { isValid: false, error: "Please replace the example private key with your actual private key" };
  }
  
  return { isValid: true };
}

// Helper to copy env.example to .env
async function copyEnvExampleToEnv(): Promise<boolean> {
  try {
    if (!fs.existsSync(ENV_EXAMPLE_PATH)) {
      console.log(chalk.red("❌ env.example file not found!"));
      return false;
    }
    
    if (fs.existsSync(ENV_PATH)) {
      const { overwrite } = await inquirer.prompt([
        { 
          type: "confirm", 
          name: "overwrite", 
          message: "A .env file already exists. Do you want to overwrite it?", 
          default: false 
        }
      ]);
      if (!overwrite) {
        console.log(chalk.yellow("⚠️  Keeping existing .env file"));
        return true;
      }
    }
    
    fs.copyFileSync(ENV_EXAMPLE_PATH, ENV_PATH);
    console.log(chalk.green("✅ Successfully copied env.example to .env"));
    return true;
  } catch (error) {
    console.log(chalk.red(`❌ Error copying env.example to .env: ${error}`));
    return false;
  }
}

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
    if ((k === "PRIVATE_KEY" || /^PRIVATE_KEY\d+$/.test(k)) && v && v.startsWith("0x")) {
      const validation = validatePrivateKey(v);
      if (validation.isValid) {
        keys.push(v);
      } else {
        console.log(chalk.yellow(`⚠️  Skipping invalid private key ${k}: ${validation.error}`));
      }
    }
  });
  return keys;
}

// Add global variables to track all available wallets and their balances
let allWallets: Array<{privateKey: string, address: string, balance: bigint, hasBalance: boolean}> = [];
let currentWalletIndex = 0;

// Function to initialize all wallets from private keys
async function initializeWallets(provider: ethers.JsonRpcProvider): Promise<void> {
  const privateKeys = loadPrivateKeysFromEnv();
  allWallets = [];
  
  for (const pk of privateKeys) {
    try {
      const wallet = new ethers.Wallet(pk, provider);
      const balance = await provider.getBalance(wallet.address);
      const hasBalance = balance > ethers.parseEther("0.0001"); // Minimum balance threshold
      
      allWallets.push({
        privateKey: pk,
        address: wallet.address,
        balance: balance,
        hasBalance: hasBalance
      });
      
      console.log(chalk.cyan(`📊 Wallet ${wallet.address.substring(0, 6)}...${wallet.address.substring(wallet.address.length - 4)}: ${ethers.formatEther(balance)} ETH ${hasBalance ? '✅' : '❌'}`));
    } catch (error) {
      console.log(chalk.red(`❌ Failed to initialize wallet: ${error}`));
    }
  }
  
  const walletsWithBalance = allWallets.filter(w => w.hasBalance);
  console.log(chalk.green(`\n✅ Initialized ${allWallets.length} wallets, ${walletsWithBalance.length} have sufficient balance`));
}

// Function to get next available wallet with balance
function getNextWalletWithBalance(): {privateKey: string, address: string} | null {
  const walletsWithBalance = allWallets.filter(w => w.hasBalance);
  if (walletsWithBalance.length === 0) {
    return null;
  }
  
  const wallet = walletsWithBalance[currentWalletIndex % walletsWithBalance.length];
  currentWalletIndex = (currentWalletIndex + 1) % walletsWithBalance.length;
  return { privateKey: wallet.privateKey, address: wallet.address };
}

// Function to update wallet balance after transactions
async function updateWalletBalance(address: string, provider: ethers.JsonRpcProvider): Promise<void> {
  const walletIndex = allWallets.findIndex(w => w.address === address);
  if (walletIndex !== -1) {
    try {
      const balance = await provider.getBalance(address);
      allWallets[walletIndex].balance = balance;
      allWallets[walletIndex].hasBalance = balance > ethers.parseEther("0.0001");
    } catch (error) {
      console.log(chalk.red(`❌ Failed to update balance for ${address}: ${error}`));
    }
  }
}

// New: Prompt for .env creation and private key import
async function setupEnvAndKeys() {
  let envVars: Record<string, string> = {};

  // Check for .env existence and reload if needed
  const scriptEnv = path.resolve(__dirname, ".env");
  const rootEnv = path.resolve(process.cwd(), ".env");
  let envExists = fs.existsSync(scriptEnv) || fs.existsSync(rootEnv);
  if (!envExists) {
    // Prompt to create .env if not found
    const { createEnv } = await inquirer.prompt([
      { type: "confirm", name: "createEnv", message: "No .env file found. Do you want the bot to create a .env file for you?", default: true }
    ]);
    if (createEnv) {
      const { envMethod } = await inquirer.prompt([
        {
          type: "list",
          name: "envMethod",
          message: "How would you like to create the .env file?",
          choices: [
            { name: "Copy from env.example (recommended)", value: "copy" },
            { name: "Create manually with private keys", value: "manual" }
          ]
        }
      ]);
      if (envMethod === "copy") {
        if (await copyEnvExampleToEnv()) {
          console.log(chalk.cyan("\n📝 Please edit the .env file with your actual private keys:"));
          console.log(chalk.cyan("   - Replace the example keys (0x0000...) with your real private keys"));
          console.log(chalk.cyan("   - Make sure each key starts with '0x' and is 64 characters long"));
          console.log(chalk.cyan("   - You can add multiple keys as PRIVATE_KEY_1, PRIVATE_KEY_2, etc."));
          console.log(chalk.cyan("   - Save the file and restart the bot when ready\n"));
          const { continueSetup } = await inquirer.prompt([
            { type: "confirm", name: "continueSetup", message: "Continue with setup?", default: true }
          ]);
          if (!continueSetup) {
            console.log(chalk.yellow("Setup cancelled. Please edit .env file and restart the bot."));
            return await setupEnvAndKeys();
          }
        } else {
          console.log(chalk.red("Failed to create .env file. Please create it manually."));
          return await setupEnvAndKeys();
        }
      } else {
        return await setupNewPrivateKeys();
      }
    } else {
      // User chose not to create .env, return to startup
      return await setupEnvAndKeys();
    }
  }
  
  // Always reload env after possible changes
  dotenv.config();
  const privateKeys = loadPrivateKeysFromEnv();
  
  if (privateKeys.length === 0) {
    console.log(chalk.red("❌ No valid private keys found in .env file!"));
    console.log(chalk.cyan("Please ensure your .env file contains valid private keys:"));
    console.log(chalk.cyan("- Each key should start with '0x' and be 64 characters long"));
    console.log(chalk.cyan("- Example: PRIVATE_KEY_1=0x1234567890abcdef..."));
    console.log(chalk.cyan("- Make sure you're not using the example keys from env.example"));
    
    const { retry } = await inquirer.prompt([
      { type: "confirm", name: "retry", message: "Would you like to set up private keys now?", default: true }
    ]);
    
    if (retry) {
      return await setupNewPrivateKeys();
    } else {
      console.log(chalk.yellow("Setup cancelled. Please edit .env file and restart the bot."));
      process.exit(0);
    }
  }
  
  console.log(chalk.green(`✅ Loaded ${privateKeys.length} valid private key(s)`));
  console.log(chalk.cyan("All imported keys will be used for automation."));
  console.log(chalk.cyan("Wallets with insufficient balance will be skipped automatically."));
  return privateKeys;
}

// Helper function to add more private keys to existing setup
async function addMorePrivateKeys(existingKeys: string[]): Promise<string[]> {
  console.log(chalk.cyan(`\n📝 You currently have ${existingKeys.length} private key(s). Adding more...`));
  
  let newKeys: string[] = [];
  let addMore = true;
  let envVars: Record<string, string> = {};
  
  while (addMore) {
    while (true) {
      const { pk } = await inquirer.prompt([
        { 
          type: "password", 
          name: "pk", 
          message: `Enter private key #${existingKeys.length + newKeys.length + 1}:`, 
          mask: "*"
        }
      ]);
      
      const normalizedPk = pk.startsWith('0x') ? pk : '0x' + pk;
      const validation = validatePrivateKey(normalizedPk);
      if (validation.isValid) {
        // Check if key already exists in existing or new keys
        if (existingKeys.includes(normalizedPk) || newKeys.includes(normalizedPk)) {
          console.log(chalk.yellow("⚠️  This private key already exists"));
          const { retry } = await inquirer.prompt([
            { type: "confirm", name: "retry", message: "Try a different key?", default: true }
          ]);
          if (!retry) {
            addMore = false;
            break;
          }
        } else {
          newKeys.push(normalizedPk);
          console.log(chalk.green(`✅ Added private key #${existingKeys.length + newKeys.length}`));
          break;
        }
      } else {
        console.log(chalk.red(`❌ ${validation.error}`));
        const { retry } = await inquirer.prompt([
          { type: "confirm", name: "retry", message: "Try again?", default: true }
        ]);
        if (!retry) {
          addMore = false;
          break;
        }
      }
    }
    
    if (addMore) {
      const { more } = await inquirer.prompt([
        { type: "confirm", name: "more", message: "Add another private key?", default: false }
      ]);
      addMore = more;
    }
  }
  
  if (newKeys.length > 0) {
    // Save new keys to .env file
    const allKeys = [...existingKeys, ...newKeys];
    allKeys.forEach((k, i) => envVars[`PRIVATE_KEY_${i + 1}`] = k);
    saveEnv(envVars);
    
    console.log(chalk.green(`\n✅ Successfully added ${newKeys.length} new private key(s)!`));
    console.log(chalk.green(`📊 Total private keys: ${allKeys.length}`));
    console.log(chalk.cyan("All imported keys will be used for automation."));
    console.log(chalk.cyan("Wallets with insufficient balance will be skipped automatically."));
    
    // Log activity
    logActivity({ 
      type: 'settings', 
      setting: 'private_keys', 
      action: 'added', 
      count: newKeys.length,
      total: allKeys.length 
    });
    
    dotenv.config();
    return allKeys;
  } else {
    console.log(chalk.yellow("No new keys added. Continuing with existing keys."));
    return existingKeys;
  }
}

// Helper function to setup new private keys from scratch
async function setupNewPrivateKeys(): Promise<string[]> {
  const { keyMode } = await inquirer.prompt([
    { type: "list", name: "keyMode", message: "Import a single private key or multiple?", choices: ["Single", "Multiple"] }
  ]);
  
  let keys: string[] = [];
  let envVars: Record<string, string> = {};
  
  if (keyMode === "Single") {
    while (true) {
      const { pk } = await inquirer.prompt([
        { 
          type: "password", 
          name: "pk", 
          message: "Enter your private key:", 
          mask: "*"
        }
      ]);
      
      const normalizedPk = pk.startsWith('0x') ? pk : '0x' + pk;
      const validation = validatePrivateKey(normalizedPk);
      if (validation.isValid) {
        keys = [normalizedPk];
        break;
      } else {
        console.log(chalk.red(`❌ ${validation.error}`));
        const { retry } = await inquirer.prompt([
          { type: "confirm", name: "retry", message: "Try again?", default: true }
        ]);
        if (!retry) {
          console.log(chalk.yellow("Setup cancelled."));
          process.exit(0);
        }
      }
    }
  } else {
    let addMore = true;
    while (addMore) {
      while (true) {
        const { pk } = await inquirer.prompt([
          { 
            type: "password", 
            name: "pk", 
            message: `Enter private key #${keys.length + 1}:`, 
            mask: "*"
          }
        ]);
        
        const normalizedPk = pk.startsWith('0x') ? pk : '0x' + pk;
        const validation = validatePrivateKey(normalizedPk);
        if (validation.isValid) {
          // Check if key already exists
          if (keys.includes(normalizedPk)) {
            console.log(chalk.yellow("⚠️  This private key already exists"));
            const { retry } = await inquirer.prompt([
              { type: "confirm", name: "retry", message: "Try a different key?", default: true }
            ]);
            if (!retry) {
              addMore = false;
              break;
            }
          } else {
            keys.push(normalizedPk);
            break;
          }
        } else {
          console.log(chalk.red(`❌ ${validation.error}`));
          const { retry } = await inquirer.prompt([
            { type: "confirm", name: "retry", message: "Try again?", default: true }
          ]);
          if (!retry) {
            addMore = false;
            break;
          }
        }
      }
      
      if (addMore) {
        const { more } = await inquirer.prompt([
          { type: "confirm", name: "more", message: "Add another private key?", default: false }
        ]);
        addMore = more;
      }
    }
  }
  
  if (keys.length > 0) {
    keys.forEach((k, i) => envVars[`PRIVATE_KEY_${i + 1}`] = k);
    saveEnv(envVars);
    console.log(chalk.green(`✅ Successfully imported ${keys.length} private key(s)!`));
    console.log(chalk.cyan("All imported keys will be used for automation."));
    console.log(chalk.cyan("Wallets with insufficient balance will be skipped automatically."));
    
    // Log activity
    logActivity({ 
      type: 'settings', 
      setting: 'private_keys', 
      action: 'setup', 
      count: keys.length 
    });
    
    dotenv.config();
    return keys;
  } else {
    console.log(chalk.red("No private keys were set up. Exiting."));
    process.exit(1);
  }
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
  console.log(chalk.cyan(`    Bot v1.0 made by JustineDevs `));
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
  useFixedAmount: false,
  swapAmount: 0.01,
  swapAmountRange: null as number | null,
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
          "Set Swap Amount",
          "Show Current Settings",
          "Back"
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
    } else if (swapAction === "Set Swap Amount") {
      const { useFixed } = await inquirer.prompt({
        type: "confirm",
        name: "useFixed",
        message: "Use a fixed swap amount for all swaps?",
        default: swapSettings.useFixedAmount
      });
      swapSettings.useFixedAmount = useFixed;
      if (useFixed) {
        const { amount } = await inquirer.prompt({
          type: "input",
          name: "amount",
          message: "Enter main swap amount:",
          default: String(swapSettings.swapAmount),
          validate: (v: string) => !isNaN(Number(v)) && Number(v) > 0
        });
        const { amountRange } = await inquirer.prompt({
          type: "input",
          name: "amountRange",
          message: "Enter optional upper range for random swap amount (leave blank for fixed):",
          default: swapSettings.swapAmountRange !== null ? String(swapSettings.swapAmountRange) : "",
          validate: (v: string) => v === '' || (!isNaN(Number(v)) && Number(v) > 0)
        });
        swapSettings.swapAmount = Number(amount);
        swapSettings.swapAmountRange = amountRange === '' ? null : Number(amountRange);
        log.success(`Swap amount set: ${amount}${amountRange ? ` (random between ${amount} and ${amountRange})` : ''}`);
      } else {
        log.success("Bot will use min/max or random swap amount as before.");
      }
    } else if (swapAction === "Show Current Settings") {
      log.step(`Current swap interval: ${swapSettings.intervalType === 'random' ? `${swapSettings.minInterval}ms - ${swapSettings.maxInterval}ms` : `${swapSettings.fixedInterval}ms`}`);
      log.step(`Swap amount: ${swapSettings.useFixedAmount ? `Fixed at ${swapSettings.swapAmount}${swapSettings.swapAmountRange ? ` (random between ${swapSettings.swapAmount} and ${swapSettings.swapAmountRange})` : ''}` : 'Random/min/max per token'}`);
      await inquirer.prompt([{ type: "input", name: "back", message: "Press Enter to return" }]);
    } else if (swapAction === "Back") {
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
          "Back"
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
    } else if (tokAction === "Back") {
      break;
    }
  }
}

async function showInfoAndHistory(networks: any[], tokens: any[]) {
  while (true) {
    activityHistory = loadActivityHistory();
    const { histAction } = await inquirer.prompt([
      {
        type: "list",
        name: "histAction",
        message: "Show Info & History:",
        choices: [
          "All Activity",
          "Network History",
          "Token History",
          "Swap History (ERC20)",
          "Liquidity History (ERC721)",
          "Custom Deploy History",
          "Back"
        ]
      }
    ]);
    if (histAction === "All Activity") {
      log.step("All Activity (Settings, Swaps, Transfers, etc.):");
      if (activityHistory.length === 0) {
        console.log("  No activity yet.");
      } else {
        activityHistory.slice(-50).forEach((a: any, i: number) => {
          const time = new Date(a.timestamp).toLocaleString();
          if (a.type === 'settings') {
            console.log(`  [${i}] [${time}] SETTINGS: ${a.setting} (${a.action}) ${a.receiver ? `Receiver: ${a.receiver}` : ''}`);
          } else if (a.type === 'swap') {
            console.log(`  [${i}] [${time}] SWAP: ${a.from} -> ${a.to} (${a.amount}) on ${a.network} [${a.status}]${a.txHash ? ` Tx: ${a.txHash}` : ''}`);
          } else if (a.type === 'transfer') {
            console.log(`  [${i}] [${time}] TRANSFER: to ${a.receiver} on ${a.network} [${a.status}]${a.txHash ? ` Tx: ${a.txHash}` : ''}`);
          } else {
            console.log(`  [${i}] [${time}] ${a.type.toUpperCase()}: ${JSON.stringify(a)}`);
          }
        });
      }
      await inquirer.prompt([{ type: "input", name: "back", message: "Press Enter to return" }]);
    } else if (histAction === "Network History") {
      if (networks.length === 0) { log.warn("No networks available."); continue; }
      const { idx } = await inquirer.prompt([
        { type: "list", name: "idx", message: "Select network to view history:", choices: networks.map((n, i) => ({ name: n.name, value: i })).concat([{ name: "Back", value: -1 }]) }
      ]);
      if (idx === -1) continue;
      const selectedNetwork = networks[idx].name;
      log.step(`Activity History for ${selectedNetwork}:`);
      const filtered = activityHistory.filter((a: any) => a.network === selectedNetwork);
      if (filtered.length === 0) {
        console.log("  No activity yet for this network.");
      } else {
        filtered.slice(-50).forEach((a: any, i: number) => {
          const time = new Date(a.timestamp).toLocaleString();
          if (a.type === 'settings') {
            console.log(`  [${i}] [${time}] SETTINGS: ${a.setting} (${a.action}) ${a.receiver ? `Receiver: ${a.receiver}` : ''}`);
          } else if (a.type === 'swap') {
            console.log(`  [${i}] [${time}] SWAP: ${a.from} -> ${a.to} (${a.amount}) on ${a.network} [${a.status}]${a.txHash ? ` Tx: ${a.txHash}` : ''}`);
          } else if (a.type === 'transfer') {
            console.log(`  [${i}] [${time}] TRANSFER: to ${a.receiver} on ${a.network} [${a.status}]${a.txHash ? ` Tx: ${a.txHash}` : ''}`);
          } else {
            console.log(`  [${i}] [${time}] ${a.type.toUpperCase()}: ${JSON.stringify(a)}`);
          }
        });
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
          "Back"
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
      const selectedNetwork = networks[idx].name;
      log.step(`Activity History for ${selectedNetwork}:`);
      const filtered = activityHistory.filter(a => a.network === selectedNetwork);
      if (filtered.length === 0) {
        console.log("  No activity yet for this network.");
      } else {
        filtered.slice(-50).forEach((a, i) => {
          const time = new Date(a.timestamp).toLocaleString();
          if (a.type === 'settings') {
            console.log(`  [${i}] [${time}] SETTINGS: ${a.setting} (${a.action}) ${a.receiver ? `Receiver: ${a.receiver}` : ''}`);
          } else if (a.type === 'swap') {
            console.log(`  [${i}] [${time}] SWAP: ${a.from} -> ${a.to} (${a.amount}) on ${a.network} [${a.status}]${a.txHash ? ` Tx: ${a.txHash}` : ''}`);
          } else if (a.type === 'transfer') {
            console.log(`  [${i}] [${time}] TRANSFER: to ${a.receiver} on ${a.network} [${a.status}]${a.txHash ? ` Tx: ${a.txHash}` : ''}`);
          } else {
            console.log(`  [${i}] [${time}] ${a.type.toUpperCase()}: ${JSON.stringify(a)}`);
          }
        });
      }
      await inquirer.prompt([{ type: "input", name: "back", message: "Press Enter to return" }]);
    } else if (netAction === "Back") {
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

// Track last swap pair and direction
let lastSwap = {
  from: null as string | null,
  to: null as string | null,
  direction: null as 'AtoB' | 'BtoA' | null,
};

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
  if (validTokens.length < 2) {
    log.error(`Not enough valid token contracts found on ${net.name}. Skipping swap.`);
    return { status: 'skipped', reason: 'Not enough valid tokens' };
  }
  const wallet = new ethers.Wallet(privateKeys[walletIndex % privateKeys.length], provider);
  walletIndex++;

  // Try all possible pairs for sufficient balance
  let pairFound = false;
  let fromToken: any = null, toToken: any = null, direction: 'AtoB' | 'BtoA' | null = null;
  let amount = 0;
  let triedPairs: Set<string> = new Set();
  let pairList: [any, any, 'AtoB' | 'BtoA'][] = [];

  // Build all possible pairs (A->B and B->A for each unique pair)
  for (let i = 0; i < validTokens.length; i++) {
    for (let j = 0; j < validTokens.length; j++) {
      if (i !== j) {
        pairList.push([validTokens[i], validTokens[j], 'AtoB']);
        pairList.push([validTokens[j], validTokens[i], 'BtoA']);
      }
    }
  }

  // Try lastSwap first if available
  if (lastSwap.from && lastSwap.to && lastSwap.direction) {
    const tA = validTokens.find(t => t.symbol === lastSwap.from);
    const tB = validTokens.find(t => t.symbol === lastSwap.to);
    if (tA && tB) {
      pairList.unshift([tA, tB, lastSwap.direction]);
    }
  }

  for (const [fToken, tToken, dir] of pairList) {
    const fromBalance = await getTokenBalance(fToken, wallet.address, provider, ethers);
    if (swapSettings.useFixedAmount) {
      if (swapSettings.swapAmountRange && swapSettings.swapAmountRange > swapSettings.swapAmount) {
        amount = Math.random() * (swapSettings.swapAmountRange - swapSettings.swapAmount) + swapSettings.swapAmount;
        amount = Math.floor(amount * Math.pow(10, fToken.decimals)) / Math.pow(10, fToken.decimals);
      } else {
        amount = swapSettings.swapAmount;
      }
    } else {
      const min = fToken.min || 0.001, max = fToken.max || 0.01;
      amount = Math.floor((Math.random() * (max - min) + min) * Math.pow(10, fToken.decimals)) / Math.pow(10, fToken.decimals);
    }
    if (fromBalance >= amount) {
      fromToken = fToken;
      toToken = tToken;
      direction = dir;
      pairFound = true;
      break;
    }
    triedPairs.add(`${fToken.symbol}->${tToken.symbol}`);
  }
  if (!pairFound) {
    log.warn('No swap pairs with sufficient balance found. Skipping swap.');
    return { status: 'skipped', reason: 'Insufficient balance for all pairs' };
  }

  const amountWei = ethers.parseUnits(toFixedDecimals(amount, fromToken.decimals), fromToken.decimals);
  const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
  const swapData: string[] = [];
  log.step(`Preparing to swap ${amount} ${fromToken.symbol} to ${toToken.symbol} on ${net.name} using wallet ${wallet.address}`);
  if (simulationMode) {
    log.info(`[SIMULATION] Would perform: Swap ${amount} ${fromToken.symbol} to ${toToken.symbol} on ${net.name} using wallet ${wallet.address}`);
    // Update lastSwap
    lastSwap = { from: fromToken.symbol, to: toToken.symbol, direction };
    logActivity({ type: 'swap', status: 'simulated', network: net.name, from: fromToken.symbol, to: toToken.symbol, amount, wallet: wallet.address });
    return { status: 'simulated' };
  }
  try {
    log.loading(`Sending multicall transaction...`);
    const tx = await router.connect(wallet).multicall(deadline, swapData);
    log.loading("Waiting for confirmation...");
    const receipt = await tx.wait();
    if (receipt.status === 1) {
      swapCount++;
      log.success(`Swap #${swapCount} for ${fromToken.symbol} to ${toToken.symbol} on ${net.name} complete!`);
      log.success(`Tx Hash: ${receipt.hash}`);
      swapHistory.push({ status: 'success', txHash: receipt.hash, type: 'Swap', network: net.name });
      logActivity({ type: 'swap', status: 'success', network: net.name, from: fromToken.symbol, to: toToken.symbol, amount, wallet: wallet.address, txHash: receipt.hash });
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

function pickRandomPair(tokens: any[]): [any, any] {
  if (tokens.length < 2) throw new Error('Need at least 2 tokens');
  let idxA = Math.floor(Math.random() * tokens.length);
  let idxB;
  do {
    idxB = Math.floor(Math.random() * tokens.length);
  } while (idxB === idxA);
  return [tokens[idxA], tokens[idxB]];
}

async function getTokenBalance(token: any, address: string, provider: any, ethers: any): Promise<number> {
  const erc20 = new ethers.Contract(token.address, ["function balanceOf(address) view returns (uint256)"], provider);
  const bal = await erc20.balanceOf(address);
  return Number(ethers.formatUnits(bal, token.decimals));
}

// --- Extracted function for Transfer ---
async function runTransfer({net, provider, privateKeys, walletIndex, simulationMode, log, receiver}: any) {
  // For demo, just simulate or prompt for address
  if (simulationMode) {
    log.info("[SIMULATION] Would perform: Transfer PHRS");
    logActivity({ type: 'transfer', status: 'simulated', network: net.name, receiver });
    return { status: 'simulated' };
  }
  let toAddress = receiver;
  if (!toAddress) {
    const prompt = await inquirer.prompt([
      { type: "input", name: "toAddress", message: "Enter the receiver address for PHRS transfer (or leave blank to skip):" }
    ]);
    toAddress = prompt.toAddress;
  }
  if (!toAddress) {
    const { stop } = await inquirer.prompt([
      { type: "confirm", name: "stop", message: "No receiver address provided. Do you want to stop the bot?", default: false }
    ]);
    if (stop) {
      automationActive = false;
      return { status: 'stopped', reason: 'User stopped bot' };
    }
    return { status: 'skipped', reason: 'No address provided' };
  }
  const wallet = new ethers.Wallet(privateKeys[walletIndex % privateKeys.length], provider);
  walletIndex++;
  let amount = 0.000001;
  if (globalTransferAmount !== null) {
    if (globalTransferAmountRange && globalTransferAmountRange > globalTransferAmount) {
      amount = Math.random() * (globalTransferAmountRange - globalTransferAmount) + globalTransferAmount;
      amount = Math.floor(amount * 1e6) / 1e6; // 6 decimals for PHRS
    } else {
      amount = globalTransferAmount;
    }
  }
  try {
    log.step(`Preparing PHRS transfer: ${amount} PHRS to ${toAddress}`);
    const balance = await provider.getBalance(wallet.address);
    const required = ethers.parseEther(amount.toString());
    if (balance < required) {
      log.warn(`Skipping transfer: Insufficient PHRS balance: ${ethers.formatEther(balance)} < ${amount}`);
      const { stop } = await inquirer.prompt([
        { type: "confirm", name: "stop", message: "Insufficient balance. Do you want to stop the bot?", default: false }
      ]);
      if (stop) {
        automationActive = false;
        return { status: 'stopped', reason: 'User stopped bot' };
      }
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
    logActivity({ type: 'transfer', status: 'success', network: net.name, receiver: toAddress, txHash: receipt.hash });
    return { status: 'success', txHash: receipt.hash };
  } catch (error: any) {
    log.error(`Transfer failed: ${error.message}`);
    const { stop } = await inquirer.prompt([
      { type: "confirm", name: "stop", message: "Transfer failed. Do you want to stop the bot?", default: false }
    ]);
    if (stop) {
      automationActive = false;
      return { status: 'stopped', reason: 'User stopped bot' };
    }
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
async function runDeploy({net, provider, privateKeys, walletIndex, simulationMode, log}: any) {
  if (simulationMode) {
    log.info("[SIMULATION] Would perform: Deploy/StartTimer");
    return { status: 'simulated' };
  }
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
  const wallet = new ethers.Wallet(privateKeys[walletIndex % privateKeys.length], provider);
  walletIndex++;
  const timerContract = new ethers.Contract(contractAddress, contractAbi, wallet);
  const randomSeconds = Math.floor(Math.random() * (50 - 30 + 1)) + 30;
  const duration = randomSeconds; // seconds
  log.step(`Calling startTimer with duration ${duration} seconds...`);
  try {
    const tx = await timerContract.startTimer(duration);
    log.loading("Waiting for startTimer confirmation...");
    const receipt = await tx.wait();
    log.success(`startTimer called. Tx: ${receipt.hash}`);
    log.step(`Explorer: https://testnet.pharosscan.xyz/tx/${receipt.hash}`);
    return { status: 'success', txHash: receipt.hash };
  } catch (e: any) {
    log.error(`startTimer failed: ${e.message}`);
    return { status: 'error', reason: e.message };
  }
}

// Enhanced Start Automation logic
async function startAutomationMenu(networks: any[], tokens: any[]) {
  // Check if user has private keys
  const privateKeys = loadPrivateKeysFromEnv();
  if (privateKeys.length === 0) {
    console.log(chalk.red("❌ No private keys found!"));
    console.log(chalk.cyan("Please import private keys first in Modify Settings > Private Key Management"));
    
    const { goToSettings } = await inquirer.prompt([
      { type: "confirm", name: "goToSettings", message: "Go to Private Key Management now?", default: true }
    ]);
    
    if (goToSettings) {
      await privateKeyManagementMenu();
      // Reload keys after management
      dotenv.config();
      const updatedKeys = loadPrivateKeysFromEnv();
      if (updatedKeys.length === 0) {
        console.log(chalk.yellow("No private keys imported. Returning to main menu."));
        return;
      }
    } else {
      console.log(chalk.yellow("Automation cancelled. Returning to main menu."));
      return;
    }
  }
  
  // Scan wallet balances before proceeding
  console.log(chalk.cyan("\n🔍 Scanning wallet balances..."));
  const availableWallets = await scanWalletBalances(networks, privateKeys);
  
  if (availableWallets.length === 0) {
    console.log(chalk.red("❌ No wallets with sufficient balance found!"));
    console.log(chalk.cyan("Please ensure your wallets have enough funds for automation"));
    
    const { goToWalletSettings } = await inquirer.prompt([
      { type: "confirm", name: "goToWalletSettings", message: "Go to Wallet Settings to check balances?", default: true }
    ]);
    
    if (goToWalletSettings) {
      await walletSettingsMenu();
    }
    return;
  }
  
  console.log(chalk.green(`✅ Found ${availableWallets.length} wallet(s) with sufficient balance`));
  
  // Select networks
  const { whichNetworks } = await inquirer.prompt([
    {
      type: "checkbox",
      name: "whichNetworks",
      message: "Select networks to run automation on:",
      choices: networks.map((n) => ({ name: n.name, value: n }))
    }
  ]);
  
  if (!whichNetworks || whichNetworks.length === 0) {
    const { confirmCancel } = await inquirer.prompt([
      { type: "confirm", name: "confirmCancel", message: "No networks selected. Cancel automation?", default: true }
    ]);
    if (confirmCancel) {
      log.warn("Automation cancelled. Returning to main menu.");
      return;
    }
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
      const { skipNetwork } = await inquirer.prompt([
        { type: "confirm", name: "skipNetwork", message: `No functions selected for ${net.name}. Skip this network?`, default: true }
      ]);
      if (!skipNetwork) {
        log.warn("Automation cancelled. Returning to main menu.");
        return;
      }
      continue;
    }
    networkFunctionMap[net.name] = funcs;
  }
  
  if (Object.keys(networkFunctionMap).length === 0) {
    const { confirmCancel } = await inquirer.prompt([
      { type: "confirm", name: "confirmCancel", message: "No networks with functions selected. Cancel automation?", default: true }
    ]);
    if (confirmCancel) {
      log.warn("Automation cancelled. Returning to main menu.");
      return;
    }
  }
  
  // Confirm before starting
  console.log(chalk.cyan("\n📋 Automation Summary:"));
  console.log(chalk.cyan("=".repeat(40)));
  console.log(chalk.green(`💰 Available Wallets: ${availableWallets.length}`));
  Object.entries(networkFunctionMap).forEach(([net, funcs]) => {
    console.log(chalk.white(`🌐 ${net}: ${funcs.join(", ")}`));
  });
  
  const { confirmStart } = await inquirer.prompt([
    { type: "confirm", name: "confirmStart", message: "Proceed with automation?", default: true }
  ]);
  
  if (!confirmStart) {
    const { confirmCancel } = await inquirer.prompt([
      { type: "confirm", name: "confirmCancel", message: "Are you sure you want to cancel automation?", default: false }
    ]);
    if (confirmCancel) {
      log.warn("Automation cancelled. Returning to main menu.");
      return;
    }
  }
  
  // Pass selected networks and functions to automationLoop
  await automationLoop(
    networks.filter(n => networkFunctionMap[n.name]),
    tokens,
    networkFunctionMap
  );
}

// New function to scan wallet balances
async function scanWalletBalances(networks: any[], privateKeys: string[]): Promise<any[]> {
  const availableWallets = [];
  
  for (const network of networks) {
    const provider = new ethers.JsonRpcProvider(network.rpc, network.chainId);
    
    for (let i = 0; i < privateKeys.length; i++) {
      try {
        const wallet = new ethers.Wallet(privateKeys[i], provider);
        const balance = await provider.getBalance(wallet.address);
        const balanceEth = ethers.formatEther(balance);
        const minBalance = globalMinimumBalance || 0.001;
        
        if (parseFloat(balanceEth) >= minBalance) {
          availableWallets.push({
            privateKey: privateKeys[i],
            address: wallet.address,
            balance: balanceEth,
            network: network.name,
            index: i
          });
        }
      } catch (error: any) {
        console.log(chalk.red(`Error checking wallet ${i + 1} on ${network.name}: ${error.message}`));
      }
    }
  }
  
  return availableWallets;
}

// Global variables for wallet settings
let globalMinimumBalance = 0.001;
let globalAutoBalanceDistribution = false;

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

let autoTokenApprovalEnabled = true;

async function profitLossTrackingMenu() {
  log.info("Profit/Loss Tracking feature coming soon!");
  log.info("Recommended: Track all swaps and transfers, calculate net profit/loss per token and overall, and display a summary here.");
  await inquirer.prompt([{ type: "input", name: "back", message: "Press Enter to return" }]);
}

async function automaticTokenApprovalMenu() {
  while (true) {
    log.info(`Automatic Token Approval is currently ${autoTokenApprovalEnabled ? 'ENABLED' : 'DISABLED'}`);
    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "Automatic Token Approval Options:",
        choices: [
          autoTokenApprovalEnabled ? "Disable" : "Enable",
          "Show Recommendations",
          "Back"
        ]
      }
    ]);
    if (action === "Enable") {
      autoTokenApprovalEnabled = true;
      log.success("Automatic Token Approval enabled.");
    } else if (action === "Disable") {
      autoTokenApprovalEnabled = false;
      log.success("Automatic Token Approval disabled.");
    } else if (action === "Show Recommendations") {
      log.info("Recommended: Add per-token approval status, auto-approve on swap/transfer, and show approval history here.");
      await inquirer.prompt([{ type: "input", name: "back", message: "Press Enter to return" }]);
    } else if (action === "Back") {
      break;
    }
  }
}

async function healthChecksMenu() {
  log.info("Health Checks & Self-Healing feature coming soon!");
  log.info("Recommended: Check RPC/network status, auto-retry failed operations, and alert on persistent issues. Add self-healing logic to auto-recover from common errors.");
  await inquirer.prompt([{ type: "input", name: "back", message: "Press Enter to return" }]);
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
          new inquirer.Separator("= Settings ="),
          "Modify Settings",
          new inquirer.Separator("= Advanced Features ="),
          "Profit/Loss Tracking",
          "Automatic Token Approval",
          "Health Checks & Self-Healing",
          new inquirer.Separator("= Info ="),
          "Show Info & History",
          new inquirer.Separator("= Other ="),
          "Other",
          "Exit"
        ]
      }
    ]);
    
    if (action === "Start Automation") {
      await startAutomationMenu(networks, tokens);
    } else if (action === "Modify Settings") {
      await modifySettingsMenu(networks, tokens, privateKey);
    } else if (action === "Profit/Loss Tracking") {
      await profitLossTrackingMenu();
    } else if (action === "Automatic Token Approval") {
      await automaticTokenApprovalMenu();
    } else if (action === "Health Checks & Self-Healing") {
      await healthChecksMenu();
    } else if (action === "Show Info & History") {
      await showInfoAndHistory(networks, tokens);
    } else if (action === "Other") {
      await otherMenu();
    } else if (action === "Exit") {
      const { confirmExit } = await inquirer.prompt([
        { type: "confirm", name: "confirmExit", message: "Are you sure you want to exit the bot?", default: false }
      ]);
      if (confirmExit) {
        log.warn("Exiting bot.");
        process.exit(0);
      }
    }
  }
}

async function modifySettingsMenu(networks: any[], tokens: any[], privateKey: string) {
  while (true) {
    const { setting } = await inquirer.prompt([
      {
        type: "list",
        name: "setting",
        message: "Modify Settings:",
        choices: [
          "Wallet Settings",
          "Private Key Management",
          "Swap Settings",
          "Transfer Settings",
          "Liquidity Settings",
          "Network Options",
          "Token Options",
          "Deploy Options",
          "Back"
        ]
      }
    ]);
    
    if (setting === "Wallet Settings") {
      await walletSettingsMenu();
      logActivity({ type: 'settings', action: 'modify', setting: 'Wallet Settings' });
    } else if (setting === "Private Key Management") {
      await privateKeyManagementMenu();
      logActivity({ type: 'settings', action: 'modify', setting: 'Private Key Management' });
    } else if (setting === "Swap Settings") {
      await swapSettingsMenu();
      log.info("Recommended: You can add slippage, max gas, swap direction, and more in future updates.");
      logActivity({ type: 'settings', action: 'modify', setting: 'Swap Settings', details: { ...swapSettings } });
    } else if (setting === "Transfer Settings") {
      await transferSettingsMenu();
    } else if (setting === "Liquidity Settings") {
      log.info("Liquidity settings are not yet implemented. Recommended: Add min/max liquidity, auto-withdraw, and alerts in future updates.");
      logActivity({ type: 'settings', action: 'view', setting: 'Liquidity Settings' });
      await inquirer.prompt([{ type: "input", name: "back", message: "Press Enter to return" }]);
    } else if (setting === "Network Options") {
      await networkOptionsMenu(networks, tokens);
      log.info("Recommended: Add network priority, auto-switch, and RPC health checks in future updates.");
      logActivity({ type: 'settings', action: 'modify', setting: 'Network Options' });
    } else if (setting === "Token Options") {
      await tokenOptionsMenu(tokens, networks);
      log.info("Recommended: Add token sorting, favorite tokens, and auto-approve in future updates.");
      logActivity({ type: 'settings', action: 'modify', setting: 'Token Options' });
    } else if (setting === "Deploy Options") {
      await deployOptionsMenu(networks, tokens, privateKey);
      log.info("Recommended: Add contract verification, upgradeability, and deployment history in future updates.");
      logActivity({ type: 'settings', action: 'modify', setting: 'Deploy Options' });
    } else if (setting === "Back") {
      break;
    }
  }
}

// Private Key Management menu
async function privateKeyManagementMenu() {
  while (true) {
    const currentKeys = loadPrivateKeysFromEnv();
    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: `Private Key Management (${currentKeys.length} keys loaded):`,
        choices: [
          "View Current Keys",
          "Add New Private Key",
          "Remove Private Key",
          "Replace All Keys",
          "Copy from env.example",
          "Back"
        ]
      }
    ]);
    
    if (action === "View Current Keys") {
      if (currentKeys.length === 0) {
        console.log(chalk.yellow("⚠️  No private keys found in .env file"));
      } else {
        console.log(chalk.cyan("\n📋 Current Private Keys:"));
        console.log(chalk.cyan("=".repeat(80)));
        
        // Load networks for balance checking
        const networks = await getNetworks();
        
        for (let i = 0; i < currentKeys.length; i++) {
          const key = currentKeys[i];
          const maskedKey = key.substring(0, 6) + "..." + key.substring(key.length - 4);
          const wallet = new ethers.Wallet(key);
          
          console.log(chalk.white(`\n🔑 Key ${i + 1} (PRIVATE_KEY${i === 0 ? '' : '_' + (i + 1)}):`));
          console.log(chalk.gray(`   Address: ${wallet.address}`));
          console.log(chalk.gray(`   Private Key: ${maskedKey}`));
          
          // Show balances across networks
          if (networks.length > 0) {
            console.log(chalk.cyan("   Balances:"));
            for (const network of networks) {
              try {
                const provider = new ethers.JsonRpcProvider(network.rpc, network.chainId);
                const balance = await provider.getBalance(wallet.address);
                const balanceEth = ethers.formatEther(balance);
                const status = parseFloat(balanceEth) > 0.001 ? chalk.green("✅") : chalk.red("❌");
                
                console.log(chalk.gray(`     ${network.name}: ${balanceEth} ${network.nativeCurrency || 'ETH'} ${status}`));
              } catch (error) {
                console.log(chalk.red(`     ${network.name}: Error checking balance`));
              }
            }
          }
        }
        
        console.log(chalk.cyan("\n" + "=".repeat(80)));
        console.log(chalk.cyan(`Total: ${currentKeys.length} key(s)`));
        
        // Show summary statistics
        const totalWallets = currentKeys.length;
        let activeWallets = 0;
        
        if (networks.length > 0) {
          for (const network of networks) {
            try {
              const provider = new ethers.JsonRpcProvider(network.rpc, network.chainId);
              for (const key of currentKeys) {
                const wallet = new ethers.Wallet(key, provider);
                const balance = await provider.getBalance(wallet.address);
                if (balance > ethers.parseEther("0.001")) {
                  activeWallets++;
                  break; // Count wallet as active if it has balance on any network
                }
              }
            } catch (error) {
              // Skip network if error
            }
          }
        }
        
        console.log(chalk.green(`Active Wallets: ${activeWallets}/${totalWallets}`));
      }
      await inquirer.prompt([{ type: "input", name: "back", message: "Press Enter to continue" }]);
    } else if (action === "Add New Private Key") {
      const { keyMode } = await inquirer.prompt([
        { 
          type: "list", 
          name: "keyMode", 
          message: "Import a single private key or multiple?", 
          choices: ["Single", "Multiple"] 
        }
      ]);
      
      if (keyMode === "Single") {
        while (true) {
          const { pk } = await inquirer.prompt([
            { 
              type: "password", 
              name: "pk", 
              message: "Enter new private key:", 
              mask: "*"
            }
          ]);
          
          const normalizedPk = pk.startsWith('0x') ? pk : '0x' + pk;
          const validation = validatePrivateKey(normalizedPk);
          if (validation.isValid) {
            // Check if key already exists in current keys
            if (currentKeys.includes(normalizedPk)) {
              console.log(chalk.yellow("⚠️  This private key already exists in your .env file"));
              const { retry } = await inquirer.prompt([
                { type: "confirm", name: "retry", message: "Try a different key?", default: true }
              ]);
              if (!retry) break;
            } else {
              const newKeyIndex = currentKeys.length + 1;
              const envVars: Record<string, string> = {};
              envVars[`PRIVATE_KEY_${newKeyIndex}`] = normalizedPk;
              saveEnv(envVars);
              console.log(chalk.green(`✅ Private key added as PRIVATE_KEY_${newKeyIndex}`));
              console.log(chalk.cyan("This wallet will be used in automation if it has sufficient balance."));
              dotenv.config(); // Reload environment
              break;
            }
          } else {
            console.log(chalk.red(`❌ ${validation.error}`));
          }
          
          const { retry } = await inquirer.prompt([
            { type: "confirm", name: "retry", message: "Try again?", default: true }
          ]);
          if (!retry) break;
        }
      } else {
        // Multiple keys mode
        let addMore = true;
        let addedKeys: string[] = [];
        
        while (addMore) {
          while (true) {
            const { pk } = await inquirer.prompt([
              { 
                type: "password", 
                name: "pk", 
                message: `Enter private key #${addedKeys.length + 1}:`, 
                mask: "*"
              }
            ]);
            
            const normalizedPk = pk.startsWith('0x') ? pk : '0x' + pk;
            const validation = validatePrivateKey(normalizedPk);
            if (validation.isValid) {
              // Check if key already exists in current keys
              if (currentKeys.includes(normalizedPk)) {
                console.log(chalk.yellow("⚠️  This private key already exists in your .env file"));
                const { retry } = await inquirer.prompt([
                  { type: "confirm", name: "retry", message: "Try a different key?", default: true }
                ]);
                if (!retry) {
                  addMore = false;
                  break;
                }
              } else {
                addedKeys.push(normalizedPk);
                console.log(chalk.green(`✅ Private key #${addedKeys.length} added`));
                break;
              }
            } else {
              console.log(chalk.red(`❌ ${validation.error}`));
              const { retry } = await inquirer.prompt([
                { type: "confirm", name: "retry", message: "Try again?", default: true }
              ]);
              if (!retry) {
                addMore = false;
                break;
              }
            }
          }
          
          if (addMore) {
            const { more } = await inquirer.prompt([
              { type: "confirm", name: "more", message: "Add another private key?", default: false }
            ]);
            addMore = more;
          }
        }
        
        if (addedKeys.length > 0) {
          // Save all added keys
          const envVars: Record<string, string> = {};
          addedKeys.forEach((key, index) => {
            const newKeyIndex = currentKeys.length + index + 1;
            envVars[`PRIVATE_KEY_${newKeyIndex}`] = key;
          });
          saveEnv(envVars);
          console.log(chalk.green(`✅ Successfully added ${addedKeys.length} new private key(s)`));
          console.log(chalk.cyan("All new wallets will be used in automation if they have sufficient balance."));
          dotenv.config(); // Reload environment
        }
      }
    } else if (action === "Remove Private Key") {
      if (currentKeys.length === 0) {
        console.log(chalk.yellow("⚠️  No private keys to remove"));
        await inquirer.prompt([{ type: "input", name: "back", message: "Press Enter to continue" }]);
      } else {
        const keyChoices = currentKeys.map((key, index) => {
          const maskedKey = key.substring(0, 6) + "..." + key.substring(key.length - 4);
          const wallet = new ethers.Wallet(key);
          return { 
            name: `${index + 1}. ${maskedKey} (${wallet.address.substring(0, 6)}...)`, 
            value: index 
          };
        });
        
        const { keyIndex } = await inquirer.prompt([
          { 
            type: "list", 
            name: "keyIndex", 
            message: "Select key to remove:", 
            choices: keyChoices
          }
        ]);
        
        const selectedKey = currentKeys[keyIndex];
        const selectedWallet = new ethers.Wallet(selectedKey);
        
        console.log(chalk.yellow(`\n⚠️  You are about to remove:`));
        console.log(chalk.white(`   Address: ${selectedWallet.address}`));
        console.log(chalk.white(`   Private Key: ${selectedKey.substring(0, 6)}...${selectedKey.substring(selectedKey.length - 4)}`));
        
        const { confirm } = await inquirer.prompt([
          { type: "confirm", name: "confirm", message: "Are you sure you want to remove this key?", default: false }
        ]);
        
        if (confirm) {
          // Remove the key by rewriting the .env file without it
          const envVars: Record<string, string> = {};
          let newIndex = 1;
          currentKeys.forEach((key, index) => {
            if (index !== keyIndex) {
              envVars[`PRIVATE_KEY${newIndex === 1 ? '' : '_' + newIndex}`] = key;
              newIndex++;
            }
          });
          saveEnv(envVars);
          
          console.log(chalk.green("✅ Private key removed successfully"));
          console.log(chalk.cyan(`   Removed: ${selectedWallet.address}`));
          
          // Log the activity
          logActivity({
            type: 'private_key_management',
            action: 'remove',
            details: {
              removed_address: selectedWallet.address,
              remaining_keys: currentKeys.length - 1,
              removed_index: keyIndex + 1
            },
            status: 'completed'
          });
          
          dotenv.config(); // Reload environment
        } else {
          console.log(chalk.cyan("❌ Key removal cancelled"));
        }
      }
    } else if (action === "Replace All Keys") {
      console.log(chalk.yellow(`\n⚠️  You are about to replace ALL ${currentKeys.length} existing private keys`));
      console.log(chalk.white("This action will:"));
      console.log(chalk.white("   • Remove all current private keys"));
      console.log(chalk.white("   • Add new private keys"));
      console.log(chalk.white("   • Update your .env file"));
      
      const { confirm } = await inquirer.prompt([
        { type: "confirm", name: "confirm", message: "Are you sure you want to replace ALL existing private keys?", default: false }
      ]);
      
      if (confirm) {
        // Log the replacement start
        logActivity({
          type: 'private_key_management',
          action: 'replace_all_start',
          details: {
            previous_keys_count: currentKeys.length,
            previous_addresses: currentKeys.map(key => new ethers.Wallet(key).address)
          },
          status: 'started'
        });
        
        const { keyMode } = await inquirer.prompt([
          { type: "list", name: "keyMode", message: "Import a single private key or multiple?", choices: ["Single", "Multiple"] }
        ]);
        
        let keys: string[] = [];
        if (keyMode === "Single") {
          while (true) {
            const { pk } = await inquirer.prompt([
              { 
                type: "password", 
                name: "pk", 
                message: "Enter your private key:", 
                mask: "*"
              }
            ]);
            const normalizedPk = pk.startsWith('0x') ? pk : '0x' + pk;
            const validation = validatePrivateKey(normalizedPk);
            if (validation.isValid) {
              keys = [normalizedPk];
              break;
            } else {
              console.log(chalk.red(`❌ ${validation.error}`));
              const { retry } = await inquirer.prompt([
                { type: "confirm", name: "retry", message: "Try again?", default: true }
              ]);
              if (!retry) break;
            }
          }
        } else {
          let addMore = true;
          while (addMore) {
            while (true) {
              const { pk } = await inquirer.prompt([
                { 
                  type: "password", 
                  name: "pk", 
                  message: `Enter private key #${keys.length + 1}:`, 
                  mask: "*"
                }
              ]);
              const normalizedPk = pk.startsWith('0x') ? pk : '0x' + pk;
              const validation = validatePrivateKey(normalizedPk);
              if (validation.isValid) {
                keys.push(normalizedPk);
                console.log(chalk.green(`✅ Private key #${keys.length} added`));
                break;
              } else {
                console.log(chalk.red(`❌ ${validation.error}`));
                const { retry } = await inquirer.prompt([
                  { type: "confirm", name: "retry", message: "Try again?", default: true }
                ]);
                if (!retry) {
                  addMore = false;
                  break;
                }
              }
            }
            
            if (addMore) {
              const { more } = await inquirer.prompt([
                { type: "confirm", name: "more", message: "Add another private key?", default: false }
              ]);
              addMore = more;
            }
          }
        }
        
        if (keys.length > 0) {
          const envVars: Record<string, string> = {};
          keys.forEach((k, i) => envVars[`PRIVATE_KEY${i === 0 ? '' : '_' + (i + 1)}`] = k);
          saveEnv(envVars);
          
          console.log(chalk.green(`✅ Successfully replaced all keys with ${keys.length} new key(s)`));
          console.log(chalk.cyan("New wallet addresses:"));
          keys.forEach((key, index) => {
            const wallet = new ethers.Wallet(key);
            console.log(chalk.white(`   ${index + 1}. ${wallet.address}`));
          });
          
          // Log the replacement completion
          logActivity({
            type: 'private_key_management',
            action: 'replace_all_complete',
            details: {
              new_keys_count: keys.length,
              new_addresses: keys.map(key => new ethers.Wallet(key).address),
              previous_keys_count: currentKeys.length
            },
            status: 'completed'
          });
          
          dotenv.config(); // Reload environment
        } else {
          console.log(chalk.yellow("❌ No keys were added. Keeping existing keys."));
          
          // Log the cancellation
          logActivity({
            type: 'private_key_management',
            action: 'replace_all_cancelled',
            details: {
              reason: 'no_keys_provided',
              previous_keys_count: currentKeys.length
            },
            status: 'cancelled'
          });
        }
      } else {
        console.log(chalk.cyan("❌ Key replacement cancelled"));
      }
    } else if (action === "Copy from env.example") {
      if (await copyEnvExampleToEnv()) {
        console.log(chalk.cyan("\n📝 Please edit the .env file with your actual private keys:"));
        console.log(chalk.cyan("   - Replace the example keys (0x0000...) with your real private keys"));
        console.log(chalk.cyan("   - Make sure each key starts with '0x' and is 64 characters long"));
        console.log(chalk.cyan("   - You can add multiple keys as PRIVATE_KEY_1, PRIVATE_KEY_2, etc."));
        console.log(chalk.cyan("   - Save the file and restart the bot when ready\n"));
        
        const { continueSetup } = await inquirer.prompt([
          { type: "confirm", name: "continueSetup", message: "Continue with setup?", default: true }
        ]);
        
        if (!continueSetup) {
          console.log(chalk.yellow("Setup cancelled. Please edit .env file and restart the bot."));
          process.exit(0);
        }
        dotenv.config(); // Reload environment
        // After reloading, check if valid keys are now available
        const updatedKeys = loadPrivateKeysFromEnv();
        if (updatedKeys.length > 0) {
          console.log(chalk.green(`✅ Successfully loaded ${updatedKeys.length} valid private key(s)`));
        } else {
          console.log(chalk.yellow("⚠️  No valid private keys found. Please edit .env file with real keys."));
        }
      }
    } else if (action === "Back") {
      break;
    }
  }
}

// Transfer Settings menu (now with amount and range)
async function transferSettingsMenu() {
  while (true) {
    const { transferSetting } = await inquirer.prompt([
      {
        type: "list",
        name: "transferSetting",
        message: "Transfer Settings:",
        choices: [
          "Set Default Receiver Address",
          "Set Transfer Amount & Range",
          "Back"
        ]
      }
    ]);
    if (transferSetting === "Set Default Receiver Address") {
      const { receiver } = await inquirer.prompt([
        { type: "input", name: "receiver", message: "Enter default receiver address (leave blank to clear):" }
      ]);
      globalTransferReceiver = receiver || null;
      log.success(receiver ? `Default receiver set: ${receiver}` : "Default receiver cleared.");
      logActivity({ type: 'settings', action: 'modify', setting: 'Transfer Settings', receiver });
    } else if (transferSetting === "Set Transfer Amount & Range") {
      const { amount } = await inquirer.prompt([
        { type: "input", name: "amount", message: "Enter main transfer amount:", default: globalTransferAmount !== null ? String(globalTransferAmount) : "0.000001", validate: (v: string) => !isNaN(Number(v)) && Number(v) > 0 }
      ]);
      const { amountRange } = await inquirer.prompt([
        { type: "input", name: "amountRange", message: "Enter optional upper range for random transfer amount (leave blank for fixed):", default: globalTransferAmountRange !== null ? String(globalTransferAmountRange) : "", validate: (v: string) => v === '' || (!isNaN(Number(v)) && Number(v) > 0) }
      ]);
      globalTransferAmount = Number(amount);
      globalTransferAmountRange = amountRange === '' ? null : Number(amountRange);
      log.success(`Transfer amount set: ${amount}${amountRange ? ` (random between ${amount} and ${amountRange})` : ''}`);
      logActivity({ type: 'settings', action: 'modify', setting: 'Transfer Amount', amount: globalTransferAmount, amountRange: globalTransferAmountRange });
    } else if (transferSetting === "Back") {
      break;
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
          "Back"
        ]
      }
    ]);
    if (otherAction === "Enable Simulation Mode") {
      simulationMode = true;
      log.success("Simulation/Dry Run Mode enabled. No real transactions will be sent.");
    } else if (otherAction === "Disable Simulation Mode") {
      simulationMode = false;
      log.success("Simulation/Dry Run Mode disabled. Real transactions will be sent.");
    } else if (otherAction === "Back") {
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
let globalTransferAmount: number | null = null;
let globalTransferAmountRange: number | null = null;

async function automationLoop(selectedNetworks: any[], tokens: any[], networkFunctionMap?: Record<string, string[]>) {
  automationActive = true;
  let swapCount = 0, transferCount = 0, faucetCount = 0, deployCount = 0, checkinCount = 0, liquidityCount = 0;
  let swapHistory: any[] = [];
  
  log.success("Automation started! Press Ctrl+C to stop and return to menu.");
  let stopRequested = false;
  
  // Setup SIGINT handler
  const sigintHandler = async () => {
    if (automationActive && !stopRequested) {
      stopRequested = true;
      const { confirmStop } = await inquirer.prompt([
        { type: "confirm", name: "confirmStop", message: "Are you sure you want to stop automation?", default: true }
      ]);
      if (confirmStop) {
        log.warn("\nAutomation stopped. Returning to menu...");
        automationActive = false;
        process.removeListener('SIGINT', sigintHandler);
      } else {
        stopRequested = false;
      }
    }
  };
  
  process.on("SIGINT", sigintHandler);
  
  // Prompt for transfer receiver if running all functions, but only if not already set
  let promptForReceiver = false;
  for (const net of selectedNetworks) {
    let selectedFuncs = networkFunctionMap ? networkFunctionMap[net.name] : ["Swap"];
    if (selectedFuncs.includes("Run all functions")) {
      selectedFuncs = getNetworkFunctions(net.name).filter(f => f !== "Run all functions");
    }
    // If only Liquidity is selected, return to main menu
    if (selectedFuncs.length === 1 && selectedFuncs[0] === "Liquidity") {
      log.warn("Liquidity function is not implemented yet. Returning to main menu.");
      automationActive = false;
      process.removeListener('SIGINT', sigintHandler);
      return;
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
  
  try {
    while (automationActive) {
      for (const net of selectedNetworks) {
        if (!automationActive) break;
        
        let selectedFuncs = networkFunctionMap ? networkFunctionMap[net.name] : ["Swap"];
        if (selectedFuncs.includes("Run all functions")) {
          selectedFuncs = getNetworkFunctions(net.name).filter(f => f !== "Run all functions");
        }
        
        // If only Liquidity is selected, return to main menu
        if (selectedFuncs.length === 1 && selectedFuncs[0] === "Liquidity") {
          log.warn("Liquidity function is not implemented yet. Returning to main menu.");
          automationActive = false;
          break;
        }
        
        if (!selectedFuncs || selectedFuncs.length === 0) continue;
        const provider = new ethers.JsonRpcProvider(net.rpc, net.chainId);
        
        // Initialize wallets for this network
        await initializeWallets(provider);
        
        // Check if we have any wallets with balance
        const walletsWithBalance = allWallets.filter(w => w.hasBalance);
        if (walletsWithBalance.length === 0) {
          log.warn(`❌ No wallets with sufficient balance on ${net.name}. Skipping network.`);
          continue;
        }
        
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
          if (!automationActive) break;
          
          let summary: any[] = [];
          
          // Get next wallet with balance for each operation
          const wallet = getNextWalletWithBalance();
          if (!wallet) {
            log.warn("❌ No wallets with sufficient balance. Skipping operations.");
            continue;
          }
          
          // SWAP
          if (automationActive) {
            let swapResult = await runSwap({net, tokens, provider, privateKeys: [wallet.privateKey], walletIndex: 0, simulationMode, log, contractExists, toFixedDecimals, ethers, swapCount, swapHistory});
            summary.push({ function: 'Swap', wallet: wallet.address.substring(0, 6) + '...', ...swapResult });
            if (swapResult.status === 'success') {
              await updateWalletBalance(wallet.address, provider);
            }
          }
          
          // LIQUIDITY (skip, just log)
          if (automationActive) {
            log.warn('This function is not implemented yet. Skipping Liquidity.');
            summary.push({ function: 'Liquidity', status: 'skipped', reason: 'Not implemented' });
          }
          
          // TRANSFER
          if (automationActive) {
            const transferWallet = getNextWalletWithBalance();
            if (transferWallet) {
              let transferResult = await runTransfer({net, provider, privateKeys: [transferWallet.privateKey], walletIndex: 0, simulationMode, log, receiver: globalTransferReceiver});
              summary.push({ function: 'Transfer', wallet: transferWallet.address.substring(0, 6) + '...', ...transferResult });
              if (transferResult.status === 'success') {
                await updateWalletBalance(transferWallet.address, provider);
              }
            } else {
              summary.push({ function: 'Transfer', status: 'skipped', reason: 'No wallet with balance' });
            }
          }
          
          // FAUCET
          if (automationActive) {
            const faucetWallet = getNextWalletWithBalance();
            if (faucetWallet) {
              let faucetResult = await runFaucet({net, provider, privateKeys: [faucetWallet.privateKey], walletIndex: 0, simulationMode, log});
              summary.push({ function: 'Faucet', wallet: faucetWallet.address.substring(0, 6) + '...', ...faucetResult });
              if (faucetResult.status === 'success') {
                await updateWalletBalance(faucetWallet.address, provider);
              }
            } else {
              summary.push({ function: 'Faucet', status: 'skipped', reason: 'No wallet with balance' });
            }
          }
          
          // CHECK-IN
          if (automationActive) {
            const checkinWallet = getNextWalletWithBalance();
            if (checkinWallet) {
              let checkinResult = await runCheckin({net, provider, privateKeys: [checkinWallet.privateKey], walletIndex: 0, simulationMode, log});
              summary.push({ function: 'Check-in', wallet: checkinWallet.address.substring(0, 6) + '...', ...checkinResult });
              if (checkinResult.status === 'success') {
                await updateWalletBalance(checkinWallet.address, provider);
              }
            } else {
              summary.push({ function: 'Check-in', status: 'skipped', reason: 'No wallet with balance' });
            }
          }
          
          // DEPLOY
          if (automationActive) {
            const deployWallet = getNextWalletWithBalance();
            if (deployWallet) {
              let deployResult = await runDeploy({net, provider, privateKeys: [deployWallet.privateKey], walletIndex: 0, simulationMode, log});
              summary.push({ function: 'Deploy', wallet: deployWallet.address.substring(0, 6) + '...', ...deployResult });
              if (deployResult.status === 'success') {
                await updateWalletBalance(deployWallet.address, provider);
              }
            } else {
              summary.push({ function: 'Deploy', status: 'skipped', reason: 'No wallet with balance' });
            }
          }
          
          // Display summary
          if (automationActive) {
            log.info("\n=== Bulk Run Summary ===");
            summary.forEach((s: any) => {
              const walletInfo = s.wallet ? ` (${s.wallet})` : '';
              log.info(`${s.function}: ${s.status}${walletInfo}${s.txHash ? ` (Tx: ${s.txHash})` : ''}${s.reason ? ` - ${s.reason}` : ''}`);
            });
            log.info("=======================\n");
          }
          
          // Wait random interval before next bulk run
          if (!automationActive) break;
          const waitSec = Math.floor(Math.random() * (40 - 30 + 1)) + 30;
          log.loading(`Waiting ${waitSec} seconds before next bulk run...`);
          await new Promise(res => setTimeout(res, waitSec * 1000));
          continue;
        }
        
        // Otherwise, run selected functions sequentially (not in parallel)
        for (const func of selectedFuncs) {
          if (!automationActive) break;
          
          const wallet = getNextWalletWithBalance();
          if (!wallet) {
            log.warn(`❌ No wallet with balance for ${func}. Skipping.`);
            continue;
          }
          
          if (func === "Swap") {
            let swapResult = await runSwap({net, tokens, provider, privateKeys: [wallet.privateKey], walletIndex: 0, simulationMode, log, contractExists, toFixedDecimals, ethers, swapCount, swapHistory});
            if (swapResult.status === 'success') {
              swapCount++;
              log.success(`Swap #${swapCount} for ${tokens[0].symbol} on ${net.name} complete! (${wallet.address.substring(0, 6)}...)`);
              log.success(`Tx Hash: ${swapResult.txHash}`);
              log.success(`Explorer: https://testnet.pharosscan.xyz/tx/${swapResult.txHash}`);
              swapHistory.push({ status: 'success', txHash: swapResult.txHash, type: 'Swap', network: net.name, wallet: wallet.address.substring(0, 6) + '...' });
              await updateWalletBalance(wallet.address, provider);
            } else {
              log.warn(`Swap #${swapCount + 1} failed. Reason: ${swapResult.reason}`);
              swapHistory.push({ status: swapResult.status, type: 'Swap', network: net.name, reason: swapResult.reason, wallet: wallet.address.substring(0, 6) + '...' });
            }
          } else if (func === "Liquidity") {
            log.warn('This function is not implemented yet. Please go back.');
            automationActive = false;
            break;
          } else if (func === "Transfer") {
            let transferResult = await runTransfer({net, provider, privateKeys: [wallet.privateKey], walletIndex: 0, simulationMode, log, receiver: globalTransferReceiver});
            if (transferResult.status === 'success') {
              transferCount++;
              log.success(`Transfer completed: ${transferResult.txHash} (${wallet.address.substring(0, 6)}...)`);
              log.step(`Explorer: https://testnet.pharosscan.xyz/tx/${transferResult.txHash}`);
              swapHistory.push({ status: transferResult.status, type: 'Transfer', network: net.name, reason: transferResult.reason, wallet: wallet.address.substring(0, 6) + '...' });
              await updateWalletBalance(wallet.address, provider);
            } else {
              log.warn(`Transfer failed. Reason: ${transferResult.reason}`);
              swapHistory.push({ status: transferResult.status, type: 'Transfer', network: net.name, reason: transferResult.reason, wallet: wallet.address.substring(0, 6) + '...' });
            }
          } else if (func === "Faucet") {
            let faucetResult = await runFaucet({net, provider, privateKeys: [wallet.privateKey], walletIndex: 0, simulationMode, log});
            if (faucetResult.status === 'success') {
              faucetCount++;
              log.success(`Faucet claimed successfully (${wallet.address.substring(0, 6)}...)`);
              swapHistory.push({ status: faucetResult.status, type: 'Faucet', network: net.name, reason: faucetResult.reason, wallet: wallet.address.substring(0, 6) + '...' });
              await updateWalletBalance(wallet.address, provider);
            } else {
              log.warn(`Faucet claim failed. Reason: ${faucetResult.reason}`);
              swapHistory.push({ status: faucetResult.status, type: 'Faucet', network: net.name, reason: faucetResult.reason, wallet: wallet.address.substring(0, 6) + '...' });
            }
          } else if (func === "Check-in") {
            let checkinResult = await runCheckin({net, provider, privateKeys: [wallet.privateKey], walletIndex: 0, simulationMode, log});
            if (checkinResult.status === 'success') {
              checkinCount++;
              log.success(`Check-in successful (${wallet.address.substring(0, 6)}...)`);
              swapHistory.push({ status: checkinResult.status, type: 'Check-in', network: net.name, reason: checkinResult.reason, wallet: wallet.address.substring(0, 6) + '...' });
              await updateWalletBalance(wallet.address, provider);
            } else {
              log.warn(`Check-in failed. Reason: ${checkinResult.reason}`);
              swapHistory.push({ status: checkinResult.status, type: 'Check-in', network: net.name, reason: checkinResult.reason, wallet: wallet.address.substring(0, 6) + '...' });
            }
          } else if (func === "Deploy") {
            let deployResult = await runDeploy({net, provider, privateKeys: [wallet.privateKey], walletIndex: 0, simulationMode, log});
            if (deployResult.status === 'success') {
              deployCount++;
              log.success(`Deploy/StartTimer called. Tx: ${deployResult.txHash} (${wallet.address.substring(0, 6)}...)`);
              log.step(`Explorer: https://testnet.pharosscan.xyz/tx/${deployResult.txHash}`);
              swapHistory.push({ status: deployResult.status, type: 'Deploy', network: net.name, reason: deployResult.reason, wallet: wallet.address.substring(0, 6) + '...' });
              await updateWalletBalance(wallet.address, provider);
            } else {
              log.warn(`Deploy/StartTimer failed. Reason: ${deployResult.reason}`);
              swapHistory.push({ status: deployResult.status, type: 'Deploy', network: net.name, reason: deployResult.reason, wallet: wallet.address.substring(0, 6) + '...' });
            }
          }
          
          // Add a small delay between operations to prevent overwhelming the network
          if (automationActive && selectedFuncs.length > 1) {
            await new Promise(res => setTimeout(res, 2000));
          }
        }
        
        if (!automationActive) break;
      }
      
      // Add delay between network cycles
      if (automationActive) {
        const waitSec = Math.floor(Math.random() * (60 - 30 + 1)) + 30;
        log.loading(`Waiting ${waitSec} seconds before next cycle...`);
        await new Promise(res => setTimeout(res, waitSec * 1000));
      }
    }
  } finally {
    // Clean up SIGINT handler
    process.removeListener('SIGINT', sigintHandler);
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

function loadActivityHistory() {
  if (fs.existsSync(ACTIVITY_HISTORY_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(ACTIVITY_HISTORY_PATH, "utf-8"));
    } catch {
      return [];
    }
  }
  return [];
}

function saveActivityHistory(history: any[]) {
  fs.writeFileSync(ACTIVITY_HISTORY_PATH, JSON.stringify(history, null, 2));
}

let activityHistory: any[] = loadActivityHistory();

function logActivity(entry: any) {
  activityHistory.push({ ...entry, timestamp: new Date().toISOString() });
  saveActivityHistory(activityHistory);
}

// Wallet Settings Menu and Helper Functions
async function walletSettingsMenu() {
  while (true) {
    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: `Wallet Settings (${loadPrivateKeysFromEnv().length} keys loaded):`,
        choices: [
          "View Wallet Balances",
          "Set Minimum Balance Threshold",
          "Wallet Priority Settings",
          "Auto-Balance Distribution",
          "Wallet Health Check",
          "Back"
        ]
      }
    ]);
    if (action === "View Wallet Balances") {
      await viewWalletBalances(true); // pass true for responsive mode
    } else if (action === "Set Minimum Balance Threshold") {
      await setMinimumBalanceThreshold(true);
    } else if (action === "Wallet Priority Settings") {
      await walletPrioritySettings(true);
    } else if (action === "Auto-Balance Distribution") {
      await autoBalanceDistribution(true);
    } else if (action === "Wallet Health Check") {
      await walletHealthCheck(true);
    } else if (action === "Back") {
      break;
    }
  }
}

// Update each function to accept a 'responsive' parameter and skip the 'Press Enter' prompt if true
async function viewWalletBalances(responsive = false) {
  const currentKeys = loadPrivateKeysFromEnv();
  if (currentKeys.length === 0) {
    console.log(chalk.yellow("⚠️  No private keys found"));
    if (!responsive) await inquirer.prompt([{ type: "input", name: "back", message: "Press Enter to continue" }]);
    return;
  }
  console.log(chalk.cyan("\n📊 Wallet Balance Overview:"));
  console.log(chalk.cyan("=".repeat(50)));
  const networks = await getNetworks();
  if (networks.length === 0) {
    console.log(chalk.yellow("No networks configured. Please add networks first."));
    if (!responsive) await inquirer.prompt([{ type: "input", name: "back", message: "Press Enter to continue" }]);
    return;
  }
  for (const network of networks) {
    console.log(chalk.green(`\n🌐 ${network.name}:`));
    const provider = new ethers.JsonRpcProvider(network.rpc, network.chainId);
    for (let i = 0; i < currentKeys.length; i++) {
      try {
        const wallet = new ethers.Wallet(currentKeys[i], provider);
        const balance = await provider.getBalance(wallet.address);
        const balanceEth = ethers.formatEther(balance);
        const status = parseFloat(balanceEth) > 0.001 ? chalk.green("✅ Active") : chalk.red("❌ Low Balance");
        console.log(chalk.white(`  Wallet ${i + 1}: ${wallet.address.substring(0, 6)}...${wallet.address.substring(wallet.address.length - 4)}`));
        console.log(chalk.gray(`    Balance: ${balanceEth} ${network.nativeCurrency || 'ETH'} ${status}`));
      } catch (error: any) {
        console.log(chalk.red(`  Wallet ${i + 1}: Error checking balance - ${error.message}`));
      }
    }
  }
  if (!responsive) await inquirer.prompt([{ type: "input", name: "back", message: "Press Enter to continue" }]);
}

async function setMinimumBalanceThreshold(responsive = false) {
  const { threshold } = await inquirer.prompt([
    {
      type: "input",
      name: "threshold",
      message: "Set minimum balance threshold (in ETH):",
      default: "0.001",
      validate: (value) => {
        const num = parseFloat(value);
        return !isNaN(num) && num >= 0 ? true : "Please enter a valid number >= 0";
      }
    }
  ]);
  globalMinimumBalance = parseFloat(threshold);
  console.log(chalk.green(`✅ Minimum balance threshold set to ${threshold} ETH`));
  logActivity({ type: 'settings', action: 'set', setting: 'minimum_balance_threshold', value: threshold });
  if (!responsive) await inquirer.prompt([{ type: "input", name: "back", message: "Press Enter to continue" }]);
}

async function walletPrioritySettings(responsive = false) {
  const currentKeys = loadPrivateKeysFromEnv();
  if (currentKeys.length === 0) {
    console.log(chalk.yellow("⚠️  No private keys found"));
    if (!responsive) await inquirer.prompt([{ type: "input", name: "back", message: "Press Enter to continue" }]);
    return;
  }
  console.log(chalk.cyan("\n🎯 Wallet Priority Settings:"));
  console.log(chalk.cyan("Higher priority wallets will be used first for automation"));
  const priorities = [];
  for (let i = 0; i < currentKeys.length; i++) {
    const wallet = new ethers.Wallet(currentKeys[i]);
    const { priority } = await inquirer.prompt([
      {
        type: "input",
        name: "priority",
        message: `Priority for Wallet ${i + 1} (${wallet.address.substring(0, 6)}...):`,
        default: (i + 1).toString(),
        validate: (value) => {
          const num = parseInt(value);
          return !isNaN(num) && num > 0 ? true : "Please enter a valid number > 0";
        }
      }
    ]);
    priorities.push({ index: i, priority: parseInt(priority) });
  }
  priorities.sort((a, b) => a.priority - b.priority);
  console.log(chalk.green("\n✅ Wallet priority order updated:"));
  priorities.forEach((item, i) => {
    const wallet = new ethers.Wallet(currentKeys[item.index]);
    console.log(chalk.white(`  ${i + 1}. Wallet ${item.index + 1} (${wallet.address.substring(0, 6)}...) - Priority: ${item.priority}`));
  });
  logActivity({ type: 'settings', action: 'set', setting: 'wallet_priorities', priorities });
  if (!responsive) await inquirer.prompt([{ type: "input", name: "back", message: "Press Enter to continue" }]);
}

async function autoBalanceDistribution(responsive = false) {
  const { enabled } = await inquirer.prompt([
    {
      type: "list",
      name: "enabled",
      message: "Auto-balance distribution:",
      choices: [
        { name: "Enable - Automatically distribute funds between wallets", value: true },
        { name: "Disable - Use wallets as-is", value: false }
      ]
    }
  ]);
  globalAutoBalanceDistribution = enabled;
  console.log(chalk.green(`✅ Auto-balance distribution ${enabled ? 'enabled' : 'disabled'}`));
  logActivity({ type: 'settings', action: 'set', setting: 'auto_balance_distribution', enabled });
  if (!responsive) await inquirer.prompt([{ type: "input", name: "back", message: "Press Enter to continue" }]);
}

async function walletHealthCheck(responsive = false) {
  const currentKeys = loadPrivateKeysFromEnv();
  if (currentKeys.length === 0) {
    console.log(chalk.yellow("⚠️  No private keys found"));
    if (!responsive) await inquirer.prompt([{ type: "input", name: "back", message: "Press Enter to continue" }]);
    return;
  }
  console.log(chalk.cyan("\n🏥 Running Wallet Health Check..."));
  const networks = await getNetworks();
  let healthyWallets = 0;
  let totalWallets = currentKeys.length * networks.length;
  for (const network of networks) {
    console.log(chalk.green(`\n🌐 Checking ${network.name}:`));
    const provider = new ethers.JsonRpcProvider(network.rpc, network.chainId);
    for (let i = 0; i < currentKeys.length; i++) {
      try {
        const wallet = new ethers.Wallet(currentKeys[i], provider);
        const balance = await provider.getBalance(wallet.address);
        const balanceEth = ethers.formatEther(balance);
        const hasBalance = parseFloat(balanceEth) > (globalMinimumBalance || 0.001);
        if (hasBalance) {
          console.log(chalk.green(`  ✅ Wallet ${i + 1}: Healthy (${balanceEth} ${network.nativeCurrency || 'ETH'})`));
          healthyWallets++;
        } else {
          console.log(chalk.red(`  ❌ Wallet ${i + 1}: Low balance (${balanceEth} ${network.nativeCurrency || 'ETH'})`));
        }
      } catch (error: any) {
        console.log(chalk.red(`  ❌ Wallet ${i + 1}: Error (${error.message})`));
      }
    }
  }
  const healthPercentage = Math.round((healthyWallets / totalWallets) * 100);
  console.log(chalk.cyan(`\n📊 Health Summary: ${healthyWallets}/${totalWallets} wallets healthy (${healthPercentage}%)`));
  if (healthPercentage < 50) {
    console.log(chalk.yellow("⚠️  Consider adding funds to your wallets for better automation performance"));
  }
  if (!responsive) await inquirer.prompt([{ type: "input", name: "back", message: "Press Enter to continue" }]);
}

async function main() {
  // Ensure .env is set up and private keys are loaded with user permission
  const privateKeys = await setupEnvAndKeys();
  if (!privateKeys || privateKeys.length === 0) {
    console.log('\x1b[31m%s\x1b[0m', '❌ No valid private keys found after loading .env. Please check your .env file and restart the bot.');
    process.exit(1);
  }
  const privateKey = privateKeys[0] || process.env.PRIVATE_KEY || "";

  printBanner();

  // Load networks and tokens
  const networks = await getNetworks();
  const tokens = await getTokens();
  
  // Go directly to main menu
  await mainMenu(networks, tokens, privateKey);
}

// Helper: Ask user to return to main menu or exit
async function promptReturnToMainMenu(networks: any[], tokens: any[], privateKey: string) {
  const { nextAction } = await inquirer.prompt([
    {
      type: "list",
      name: "nextAction",
      message: "Operation stopped. What would you like to do?",
      choices: [
        { name: "Return to Main Menu", value: "main" },
        { name: "Exit Bot", value: "exit" }
      ]
    }
  ]);
  if (nextAction === "main") {
    await mainMenu(networks, tokens, privateKey);
  } else {
    log.warn("Exiting bot.");
    process.exit(0);
  }
}

main(); 