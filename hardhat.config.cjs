require("@nomicfoundation/hardhat-chai-matchers");
require("@nomicfoundation/hardhat-ignition-ethers");
require("@nomicfoundation/hardhat-verify");
require("dotenv").config();

const { vars } = require("hardhat/config");

// Get the private key from environment variables (.env file takes precedence)
const PRIVATE_KEY = process.env.PRIVATE_KEY || vars.get("PRIVATE_KEY", "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
      forking: process.env.FORK_URL ? {
        url: process.env.FORK_URL,
        blockNumber: process.env.FORK_BLOCK_NUMBER ? parseInt(process.env.FORK_BLOCK_NUMBER) : undefined,
      } : undefined,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    // Sepolia testnet
    sepolia: {
      url: vars.get("SEPOLIA_RPC_URL", "https://rpc.sepolia.org"),
      accounts: [PRIVATE_KEY],
      chainId: 11155111,
    },
    // Polygon Mumbai (now deprecated, using Amoy)
    amoy: {
      url: vars.get("AMOY_RPC_URL", "https://rpc-amoy.polygon.technology"),
      accounts: [PRIVATE_KEY],
      chainId: 80002,
    },
    // Arbitrum Sepolia
    arbitrumSepolia: {
      url: vars.get("ARBITRUM_SEPOLIA_RPC_URL", "https://sepolia-rollup.arbitrum.io/rpc"),
      accounts: [PRIVATE_KEY],
      chainId: 421614,
    },
    // Optimism Sepolia
    optimismSepolia: {
      url: vars.get("OPTIMISM_SEPOLIA_RPC_URL", "https://sepolia.optimism.io"),
      accounts: [PRIVATE_KEY],
      chainId: 11155420,
    },
    // Base Sepolia
    baseSepolia: {
      url: vars.get("BASE_SEPOLIA_RPC_URL", "https://sepolia.base.org"),
      accounts: [PRIVATE_KEY],
      chainId: 84532,
    },
    // Avalanche Fuji
    avalancheFuji: {
      url: vars.get("AVALANCHE_FUJI_RPC_URL", "https://api.avax-test.network/ext/bc/C/rpc"),
      accounts: [PRIVATE_KEY],
      chainId: 43113,
    },
  },
  etherscan: {
    apiKey: {
      sepolia: vars.get("ETHERSCAN_API_KEY", ""),
      arbitrumSepolia: vars.get("ARBISCAN_API_KEY", ""),
      optimismSepolia: vars.get("OPTIMISM_API_KEY", ""),
      baseSepolia: vars.get("BASESCAN_API_KEY", ""),
      polygonAmoy: vars.get("POLYGONSCAN_API_KEY", ""),
      avalancheFuji: vars.get("SNOWTRACE_API_KEY", ""),
      avalancheFujiTestnet: vars.get("SNOWTRACE_API_KEY", "")
    },
    customChains: [
      {
        network: "arbitrumSepolia",
        chainId: 421614,
        urls: {
          apiURL: "https://api-sepolia.arbiscan.io/api",
          browserURL: "https://sepolia.arbiscan.io/",
        },
      },
      {
        network: "optimismSepolia",
        chainId: 11155420,
        urls: {
          apiURL: "https://api-sepolia-optimism.etherscan.io/api",
          browserURL: "https://sepolia-optimism.etherscan.io/",
        },
      },
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org/",
        },
      },
      {
        network: "polygonAmoy",
        chainId: 80002,
        urls: {
          apiURL: "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com/",
        },
      },
    ],
  },
  sourcify: {
    enabled: true,
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  mocha: {
    timeout: 40000,
  },
  // Custom paths for ZK circuits
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
}; 