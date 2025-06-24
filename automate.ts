import { ethers } from "ethers";
// @ts-ignore
import * as dotenv from "dotenv";
import chalk from "chalk";
import inquirer from "inquirer";
import fs from "fs";
import path from "path";

// Load environment variables
dotenv.config();

const ENV_PATH = path.resolve(__dirname, ".env");
const NETWORKS_PATH = path.resolve(__dirname, "networks.json");
const TOKENS_PATH = path.resolve(__dirname, "tokens.json");

// Helper to write .env
function saveEnv(vars: Record<string, string | undefined>) {
  let env = "";
  for (const [k, v] of Object.entries(vars)) {
    env += `${k}=${v ?? ""}\n`;
  }
  fs.writeFileSync(ENV_PATH, env, { encoding: "utf-8" });
}

// Helper to load or prompt for private key
async function getPrivateKey() {
  let key = process.env.PRIVATE_KEY;
  if (!key) {
    const { privateKey } = await inquirer.prompt([
      {
        type: "password",
        name: "privateKey",
        message: "Enter your wallet PRIVATE_KEY:",
        mask: "*",
        validate: (input: string) => /^0x[0-9a-fA-F]{64}$/.test(input) || "Invalid private key format!"
      }
    ]);
    key = privateKey;
    saveEnv({ ...(process.env as Record<string, string | undefined>), PRIVATE_KEY: key, RPC_URL: process.env.RPC_URL || "" });
    dotenv.config();
  }
  return key;
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
  // Enhancement: Ask if user wants to add more pairs
  let addMore = true;
  while (addMore) {
    const { wantMore } = await inquirer.prompt([
      {
        type: "confirm",
        name: "wantMore",
        message: "Do you want to add another token pair (smart contract)?",
        default: false
      }
    ]);
    if (wantMore) {
      tokens.push(await promptAddToken());
      fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
    } else {
      addMore = false;
    }
  }
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

let automationActive = false;
let swapHistory: any[] = [];
let username = "";

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

async function automationLoop(selectedNetworks: any[], tokens: any[]) {
  automationActive = true;
  let swapCount = 0;
  log.success("Automation started! Press Ctrl+C to stop and return to menu.");
  process.on("SIGINT", () => {
    if (automationActive) {
      log.warn("\nAutomation stopped. Returning to menu...");
      automationActive = false;
    }
  });
  while (automationActive) {
    for (const net of selectedNetworks) {
      // Setup provider and wallet for this network
      const provider = new ethers.JsonRpcProvider(net.rpc, net.chainId);
      const privateKey = process.env.PRIVATE_KEY || "";
      const wallet = new ethers.Wallet(privateKey, provider);
      // Router contract
      const routerAbi = [
        "function multicall(uint256 deadline, bytes[] data) external payable returns (bytes[] memory)"
      ];
      const routerAddress = "0x1a4de519154ae51200b0ad7c90f7fac75547888a";
      const router = new ethers.Contract(routerAddress, routerAbi, wallet);
      // Filter valid tokens (contract exists)
      const validTokens = [];
      for (const token of tokens) {
        const exists = await contractExists(provider, token.address);
        if (!exists) {
          log.warn(`Token contract ${token.symbol} (${token.address}) does not exist on ${net.name}. Skipping.`);
        } else {
          validTokens.push(token);
        }
      }
      if (validTokens.length === 0) {
        log.error(`No valid token contracts found on ${net.name}. Returning to menu.`);
        automationActive = false;
        break;
      }
      // Randomly select a token for each interval
      while (automationActive) {
        const token = validTokens[Math.floor(Math.random() * validTokens.length)];
        // Randomize swap amount (use token.decimals)
        const min = 0.001, max = 0.01;
        const amount = Math.floor((Math.random() * (max - min) + min) * Math.pow(10, token.decimals)) / Math.pow(10, token.decimals);
        const amountWei = ethers.parseUnits(amount.toString(), token.decimals);
        const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
        // Placeholder: encode swap data for multicall
        // TODO: Replace with actual swap encoding when ABI is provided
        const swapData: string[] = [];
        log.step(`Preparing to swap ${amount} ${token.symbol} on ${net.name}`);
        try {
          log.loading(`Sending multicall transaction...`);
          const tx = await router.multicall(deadline, swapData);
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
          } else {
            log.warn(`Swap #${swapCount + 1} failed. Check transaction.`);
          }
        } catch (err: any) {
          log.error(`Swap error: ${err.message || err}`);
        }
        if (!automationActive) break;
        // Wait random interval 30s-1min
        const interval = Math.floor(Math.random() * (60_000 - 30_000) + 30_000);
        log.loading(`Waiting ${(interval / 1000).toFixed(1)} seconds before next swap...`);
        await new Promise(res => setTimeout(res, interval));
      }
      if (!automationActive) break;
    }
    if (!automationActive) break;
  }
}

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
      const filtered = swapHistory.filter(h => h.includes(networks[idx].name));
      if (filtered.length === 0) {
        console.log("  No swaps yet for this network.");
      } else {
        filtered.slice(-10).forEach((h, i) => console.log(`  [${i}] ${h}`));
      }
      await inquirer.prompt([{ type: "input", name: "back", message: "Press Enter to return" }]);
    } else if (netAction === "Back to Main Menu") {
      break;
    }
  }
}

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
    } else if (tokAction === "Token History") {
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
    } else if (tokAction === "Back to Main Menu") {
      break;
    }
  }
}

async function showInfoAndHistory(networks: any[], tokens: any[]) {
  while (true) {
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

async function mainMenu(networks: any[], tokens: any[], privateKey: string) {
  while (true) {
    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "Main Menu - Choose an option:",
        choices: [
          "Start Automation",
          "Network Options",
          "Token Options",
          "Show Info & History",
          "Exit"
        ]
      }
    ]);
    if (action === "Start Automation") {
      // Ask user which network(s) to use
      let selectedNetworks = networks;
      if (networks.length > 1) {
        const { which } = await inquirer.prompt([
          {
            type: "checkbox",
            name: "which",
            message: "Select networks to run automation on:",
            choices: networks.map((n) => ({ name: n.name, value: n }))
          }
        ]);
        selectedNetworks = which;
      }
      await automationLoop(selectedNetworks, tokens);
      continue; // After automation stops, return to menu
    } else if (action === "Network Options") {
      await networkOptionsMenu(networks, tokens);
    } else if (action === "Token Options") {
      await tokenOptionsMenu(tokens, networks);
    } else if (action === "Show Info & History") {
      await showInfoAndHistory(networks, tokens);
    } else if (action === "Exit") {
      log.warn("Exiting bot.");
      process.exit(0);
    }
  }
}

async function main() {
  username = await getUsername();
  printBanner();
  console.log(chalk.cyan(`Hello World Welcome Testnet Automation bot made by JustineDevs, ${username}!`));
  const privateKey = await getPrivateKey();
  const networks = await getNetworks();
  const tokens = await getTokens();
  await mainMenu(networks, tokens, privateKey || "");
}

main(); 