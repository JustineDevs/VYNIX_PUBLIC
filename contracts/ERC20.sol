// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract CustomERC20 is ERC20 {
    string[] public cryptoWords = [
        "Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Theta", "Lambda", "Sigma", "Omega",
        "Block", "Chain", "Node", "Miner", "Wallet", "Token", "Coin", "Hash", "Nonce", "Gas",
        "Stake", "Yield", "Farm", "Swap", "Pool", "Vault", "Bridge", "Oracle", "DEX", "CEX",
        "DAO", "NFT", "DeFi", "CeFi", "L2", "Rollup", "Shard", "Fork", "Airdrop", "Burn",
        "Mint", "Freeze", "Unfreeze", "Approve", "Transfer", "Allowance", "Liquidity", "Router", "Factory", "Pair",
        "Stable", "Volatile", "Pump", "Dump", "Moon", "Bear", "Bull", "Whale", "Shark", "Dolphin",
        "Crab", "Fish", "Hodl", "Fomo", "Fud", "Rekt", "Sats", "Gwei", "Wei", "Ether",
        "Bitcoin", "Ethereum", "Solana", "Polygon", "Avalanche", "Arbitrum", "Optimism", "Base", "Blast", "Linea",
        "Scroll", "ZkSync", "Starknet", "Mantle", "Sei", "Injective", "Cosmos", "Polkadot", "Near", "Aptos",
        "Sui", "Celestia", "Eigen", "Mina", "Celo", "Kava", "Osmosis", "Juno", "Secret", "Akash",
        "IBC", "USDT", "USDC", "DAI", "FRAX", "LUSD", "TUSD", "BUSD", "GUSD", "PAX", "sUSD",
        "WBTC", "WETH", "WBNB", "WAVAX", "WMATIC", "WFTM", "WGLMR", "WONE", "WCELO", "WNEAR",
        "UNI", "AAVE", "COMP", "MKR", "SNX", "CRV", "BAL", "YFI", "SUSHI", "1INCH",
        "LDO", "RPL", "ANKR", "BNT", "REN", "KNC", "ZRX", "BAT", "MANA", "ENJ",
        "SAND", "AXS", "SLP", "GALA", "ILV", "IMX", "APE", "GMT", "STEPN", "XRP",
        "DOGE", "SHIB", "PEPE", "FLOKI", "BONK", "TAMA", "CATE", "ELON", "HOGE", "SAFEMOON",
        "BabyDoge", "Pitbull", "Kishu", "Akita", "Samoyed", "DogeGF", "DogeBonk", "DogeChain", "DogeSwap", "DogePad",
        "Meta", "Verse", "Web3", "Dapp", "GameFi", "SocialFi", "Move", "Proof", "StakeFi", "YieldFi",
        "Layer", "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight",
        "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen",
        "Nineteen", "Twenty", "Genesis", "Origin", "Prime", "Core", "Edge", "NodeFi", "ChainFi", "BridgeFi",
        "SwapFi", "VaultFi", "OracleFi", "RouterFi", "FactoryFi", "PairFi", "StableFi", "VolatileFi", "PumpFi", "DumpFi",
        "MoonFi", "BearFi", "BullFi", "WhaleFi", "SharkFi", "DolphinFi", "CrabFi", "FishFi", "HodlFi", "FomoFi",
        "FudFi", "RektFi", "SatsFi", "GweiFi", "WeiFi", "EtherFi", "BitcoinFi", "EthereumFi", "SolanaFi", "PolygonFi",
        "AvalancheFi", "ArbitrumFi", "OptimismFi", "BaseFi", "BlastFi", "LineaFi", "ScrollFi", "ZkSyncFi", "StarknetFi", "MantleFi"
    ];

    constructor(string memory name_, string memory symbol_, uint256 initialSupply) ERC20(name_, symbol_) {
        _mint(msg.sender, initialSupply);
    }
} 