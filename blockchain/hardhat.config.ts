import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { configVariable, defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers],
  networks: {
    localhost: { type: "http", chainType: "l1", url: "http://127.0.0.1:8545", chainId: 31337 },
    sepolia: {
      type: "http", chainType: "l1", chainId: 11155111,
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
  },
  solidity: {
    version: "0.8.34",
  },
});
