import { config as dotEnvConfig } from "dotenv"
dotEnvConfig()

import "@openzeppelin/hardhat-upgrades"

import "@nomiclabs/hardhat-waffle"
import "hardhat-typechain"
import "hardhat-deploy"
import "solidity-coverage"

module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 31337,
      gas: 12000000,
      blockGasLimit: 0x1fffffffffffff,
      allowUnlimitedContractSize: true,
      timeout: 1800000,
      accounts: [
        {
          privateKey: process.env.LOCAL_PRIVATE_KEY_1,
          balance: "10000000000000000000000",
        },
        {
          privateKey: process.env.LOCAL_PRIVATE_KEY_2,
          balance: "10000000000000000000000",
        },
        {
          privateKey: process.env.LOCAL_PRIVATE_KEY_3,
          balance: "10000000000000000000000",
        },
        {
          privateKey: process.env.LOCAL_PRIVATE_KEY_4,
          balance: "10000000000000000000000",
        },
      ],
    },
    testnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
      accounts: [process.env.BSC_TESTNET_PRIVATE_KEY],
    },
    mainnet: {
      url: process.env.BSC_MAINNET_RPC,
      accounts: [process.env.BSC_MAINNET_PRIVATE_KEY],
    },
    rinkeby: {
      url: process.env.ETH_RINKEBY_RPC,
      accounts: [process.env.ETH_TESTNET_PRIVATE_KEY],
    },
    ethereum: {
      url: process.env.ETH_MAINNET_RPC,
      accounts: [process.env.ETH_MAINNET_PRIVATE_KEY, process.env.ETH_MAIN_DEPLOYER_PRIVATE_KEY],
    },
    ethereum_mainnet_fork: {
      url: "http://127.0.0.1:8545",
      accounts: [process.env.ETH_MAINNET_PRIVATE_KEY, process.env.ETH_MAIN_DEPLOYER_PRIVATE_KEY],
      timeout: 500000,
    },
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
  solidity: {
    version: "0.6.12",
    settings: {
      optimizer: {
        enabled: true,
        runs: 168,
      },
      evmVersion: "istanbul",
      outputSelection: {
        "*": {
          "": ["ast"],
          "*": [
            "evm.bytecode.object",
            "evm.deployedBytecode.object",
            "abi",
            "evm.bytecode.sourceMap",
            "evm.deployedBytecode.sourceMap",
            "metadata",
          ],
        },
      },
    },
  },
  paths: {
    sources: "./contracts/6.12",
    tests: "./tests",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  typechain: {
    outDir: "./typechain",
    target: process.env.TYPECHAIN_TARGET || "ethers-v5",
  },
  mocha: {
    timeout: 50000,
  },
}
