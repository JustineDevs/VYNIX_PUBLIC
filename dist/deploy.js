"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const hardhat_1 = __importDefault(require("hardhat"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function getRandomWords(arr, count) {
    const used = new Set();
    const result = [];
    while (result.length < count) {
        const idx = Math.floor(Math.random() * arr.length);
        if (!used.has(idx)) {
            used.add(idx);
            result.push(arr[idx]);
        }
    }
    return result;
}
async function main() {
    const hreAny = hardhat_1.default;
    const deployLog = {};
    const scriptsDir = __dirname;
    // --- Deploy CustomERC20 ---
    const ERC20Artifact = await hreAny.artifacts.readArtifact("CustomERC20");
    const cryptoWords = ERC20Artifact.abi.find((x) => x.name === 'cryptoWords') ? Array.from({ length: 256 }, (_, i) => `Word${i}`) : [];
    // fallback: use hardcoded words if not found in ABI
    if (cryptoWords.length === 0) {
        cryptoWords.push("Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Theta", "Lambda", "Sigma", "Omega", "Block", "Chain", "Node", "Miner", "Wallet", "Token", "Coin", "Hash", "Nonce", "Gas", "Stake", "Yield", "Farm", "Swap", "Pool", "Vault", "Bridge", "Oracle", "DEX", "CEX", "DAO", "NFT", "DeFi", "CeFi", "L2", "Rollup", "Shard", "Fork", "Airdrop", "Burn", "Mint", "Freeze", "Unfreeze", "Approve", "Transfer", "Allowance", "Liquidity", "Router", "Factory", "Pair", "Stable", "Volatile", "Pump", "Dump", "Moon", "Bear", "Bull", "Whale", "Shark", "Dolphin", "Crab", "Fish", "Hodl", "Fomo", "Fud", "Rekt", "Sats", "Gwei", "Wei", "Ether", "Bitcoin", "Ethereum", "Solana", "Polygon", "Avalanche", "Arbitrum", "Optimism", "Base", "Blast", "Linea", "Scroll", "ZkSync", "Starknet", "Mantle", "Sei", "Injective", "Cosmos", "Polkadot", "Near", "Aptos", "Sui", "Celestia", "Eigen", "Mina", "Celo", "Kava", "Osmosis", "Juno", "Secret", "Akash", "IBC", "IBC", "IBC", "IBC", "IBC", "IBC", "IBC", "IBC", "IBC", "IBC", "USDT", "USDC", "DAI", "FRAX", "LUSD", "TUSD", "BUSD", "GUSD", "PAX", "sUSD", "WBTC", "WETH", "WBNB", "WAVAX", "WMATIC", "WFTM", "WGLMR", "WONE", "WCELO", "WNEAR", "UNI", "AAVE", "COMP", "MKR", "SNX", "CRV", "BAL", "YFI", "SUSHI", "1INCH", "LDO", "RPL", "ANKR", "BNT", "REN", "KNC", "ZRX", "BAT", "MANA", "ENJ", "SAND", "AXS", "SLP", "GALA", "ILV", "IMX", "APE", "GMT", "STEPN", "XRP", "DOGE", "SHIB", "PEPE", "FLOKI", "BONK", "TAMA", "CATE", "ELON", "HOGE", "SAFEMOON", "BabyDoge", "Pitbull", "Kishu", "Akita", "Samoyed", "DogeGF", "DogeBonk", "DogeChain", "DogeSwap", "DogePad", "Meta", "Verse", "Web3", "Dapp", "GameFi", "SocialFi", "Move", "Proof", "StakeFi", "YieldFi", "Layer", "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen", "Twenty", "Genesis", "Origin", "Prime", "Core", "Edge", "NodeFi", "ChainFi", "BridgeFi", "SwapFi", "VaultFi", "OracleFi", "RouterFi", "FactoryFi", "PairFi", "StableFi", "VolatileFi", "PumpFi", "DumpFi", "MoonFi", "BearFi", "BullFi", "WhaleFi", "SharkFi", "DolphinFi", "CrabFi", "FishFi", "HodlFi", "FomoFi", "FudFi", "RektFi", "SatsFi", "GweiFi", "WeiFi", "EtherFi", "BitcoinFi", "EthereumFi", "SolanaFi", "PolygonFi", "AvalancheFi", "ArbitrumFi", "OptimismFi", "BaseFi", "BlastFi", "LineaFi");
    }
    const [word1, word2] = getRandomWords(cryptoWords, 2);
    const name = `${word1} ${word2}`;
    const symbol = `${word1.slice(0, 3)}${word2.slice(0, 3)}`.toUpperCase();
    const initialSupply = hreAny.ethers.parseUnits("1000000", 18);
    const ERC20Factory = await hreAny.ethers.getContractFactory("CustomERC20");
    const erc20 = await ERC20Factory.deploy(name, symbol, initialSupply);
    await erc20.waitForDeployment();
    const erc20Address = await erc20.getAddress();
    console.log(`CustomERC20 deployed to: ${erc20Address} (name: ${name}, symbol: ${symbol})`);
    deployLog.ERC20 = { address: erc20Address, name, symbol, initialSupply: initialSupply.toString() };
    // --- Deploy CustomERC1155 ---
    const intervalWords = ["Minute", "Hour", "Day", "Week", "Month", "Year", "Epoch", "Era", "Cycle", "Phase"];
    const [intervalWord] = getRandomWords(intervalWords, 1);
    const [cryptoWord] = getRandomWords(cryptoWords, 1);
    const uri = "https://example.com/api/item/{id}.json";
    const ERC1155Factory = await hreAny.ethers.getContractFactory("CustomERC1155");
    const erc1155 = await ERC1155Factory.deploy(intervalWord, cryptoWord, uri);
    await erc1155.waitForDeployment();
    const erc1155Address = await erc1155.getAddress();
    console.log(`CustomERC1155 deployed to: ${erc1155Address} (name: ${intervalWord} ${cryptoWord})`);
    deployLog.ERC1155 = { address: erc1155Address, name: `${intervalWord} ${cryptoWord}`, uri };
    // --- Deploy CustomERC165 ---
    const [w1, w2, w3] = getRandomWords(cryptoWords, 3);
    const ERC165Factory = await hreAny.ethers.getContractFactory("CustomERC165");
    const erc165 = await ERC165Factory.deploy(w1, w2, w3);
    await erc165.waitForDeployment();
    const erc165Address = await erc165.getAddress();
    const description = `${w1} ${w2} ${w3}`;
    console.log(`CustomERC165 deployed to: ${erc165Address} (description: ${description})`);
    deployLog.ERC165 = { address: erc165Address, description };
    // Save deployment log
    fs_1.default.writeFileSync(path_1.default.join(scriptsDir, "deployed-contracts.json"), JSON.stringify(deployLog, null, 2));
    console.log("\nDeployment summary saved to deployed-contracts.json");
}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
