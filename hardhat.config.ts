require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const { PRIVATE_KEY } = process.env;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      evmVersion: "paris",
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    nexusDevnet: {
      url: "https://rpc.nexus.xyz/http",
      chainId: 393,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
    monadTestnet: {
      url: "https://testnet-rpc.monad.xyz",
      chainId: 10143,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
    basecamp: {
      url: "https://rpc.basecamp.t.raas.gelato.cloud",
      chainId: 123420001114,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
    megaTestnet: {
      url: "https://carrot.megaeth.com/rpc",
      chainId: 6342,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
    expchainTestnet: {
      url: "https://expchain.polyhedra.network/rpc0-testnet",
      chainId: 18880,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
    pharosTestnet: {
      url: "https://testnet.dplabs-internal.com",
      chainId: 688688,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
    atletaTestnet: {
      url: "https://rpc.testnet-v2.atleta.network/",
      chainId: 2340,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
    riseTestnet: {
      url: "https://testnet.riselabs.xyz",
      chainId: 11155931,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
    teaSepolia: {
      url: "https://tea-sepolia.g.alchemy.com/public",
      chainId: 10218,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
    seismicDevnet: {
      url: "https://node-2.seismicdev.net/rpc",
      chainId: 5124,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
    fluentDevPreview: {
      url: "https://rpc.dev.gblend.xyz",
      chainId: 20993,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
    pharos: {
      url: "https://testnet.dplabs-internal.com",
      chainId: 688688,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  },
  etherscan: {
    apiKey: {
      pharos: "not-needed"
    },
    customChains: [
      {
        network: "pharos",
        chainId: 688688,
        urls: {
          apiURL: "https://testnet.pharosscan.xyz/api",
          browserURL: "https://testnet.pharosscan.xyz"
        }
      }
    ]
  }
};