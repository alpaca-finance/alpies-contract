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
    MAX_SALE_ALPIES: "5000",
    REVEAL_BLOCK: "13578420",
    PRICE_MODEL: "0xb076AcAadB11782DFac6336b83e785839B293BDf",
    MAX_RESERVE: "26",
    MAX_PREMINT_AMOUNT: "125",
    MERKLE_ROOT: "0x31168a64dc901be62d538390f13ef5c9a3a37bd0056c8ae7a5c6db6bb0173398",
    CLAIMABLE_ALPIES: "1027",
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
