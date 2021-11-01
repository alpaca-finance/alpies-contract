import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"
import { ethers, upgrades } from "hardhat"
import { Alpies, Alpies__factory, DreamerAlpies, DreamerAlpies__factory } from "../../../../typechain"

interface IDreamerAlpiesInput {
  NAME: string
  SYMBOL: string
  MAX_SALE_ALPIES: string
  REVEAL_BLOCK: string
  PRICE_MODEL: string
  MAX_RESERVE: string
  MAX_PREMINT_AMOUNT: string
  MERKLE_ROOT: string
  CLAIMABLE_ALPIES: string
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  /*
  ░██╗░░░░░░░██╗░█████╗░██████╗░███╗░░██╗██╗███╗░░██╗░██████╗░
  ░██║░░██╗░░██║██╔══██╗██╔══██╗████╗░██║██║████╗░██║██╔════╝░
  ░╚██╗████╗██╔╝███████║██████╔╝██╔██╗██║██║██╔██╗██║██║░░██╗░
  ░░████╔═████║░██╔══██║██╔══██╗██║╚████║██║██║╚████║██║░░╚██╗
  ░░╚██╔╝░╚██╔╝░██║░░██║██║░░██║██║░╚███║██║██║░╚███║╚██████╔╝
  ░░░╚═╝░░░╚═╝░░╚═╝░░╚═╝╚═╝░░╚═╝╚═╝░░╚══╝╚═╝╚═╝░░╚══╝░╚═════╝░
  Check all variables below before execute the deployment script
  */

  const alpiesInput: IDreamerAlpiesInput = {
    NAME: "Alpies",
    SYMBOL: "ALPIES",
    MAX_SALE_ALPIES: "",
    REVEAL_BLOCK: "",
    PRICE_MODEL: "",
    MAX_RESERVE: "",
    MAX_PREMINT_AMOUNT: "",
    MERKLE_ROOT: "",
    CLAIMABLE_ALPIES: "",
  }

  const Alpies = (await ethers.getContractFactory(
    "DreamerAlpies",
    (
      await ethers.getSigners()
    )[0]
  )) as DreamerAlpies__factory

  console.log(`>> Deploying Dreamer Alpies: ${alpiesInput.NAME}`)

  const alpies = (await upgrades.deployProxy(Alpies, [
    alpiesInput.NAME,
    alpiesInput.SYMBOL,
    alpiesInput.MAX_SALE_ALPIES,
    alpiesInput.REVEAL_BLOCK,
    alpiesInput.PRICE_MODEL,
    alpiesInput.MAX_RESERVE,
    alpiesInput.MAX_PREMINT_AMOUNT,
    alpiesInput.MERKLE_ROOT,
    alpiesInput.CLAIMABLE_ALPIES,
  ])) as DreamerAlpies

  console.log(">> Dreamer Alpies is deployed!")
  console.log("Dreamer Alpies address:", alpies.address)
}

export default func
func.tags = ["DreamerAlpies"]
