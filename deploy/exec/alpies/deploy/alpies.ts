import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"
import { ethers, upgrades } from "hardhat"
import { Alpies, Alpies__factory } from "../../../../typechain"

interface IAlpiesInput {
  NAME: string
  SYMBOL: string
  MAX_SALE_ALPIES: string
  REVEAL_BLOCK: string
  PRICE_MODEL: string
  MAX_RESERVE: string
  MAX_PREMINT_AMOUNT: string
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre
  const { deploy } = deployments

  /*
  ░██╗░░░░░░░██╗░█████╗░██████╗░███╗░░██╗██╗███╗░░██╗░██████╗░
  ░██║░░██╗░░██║██╔══██╗██╔══██╗████╗░██║██║████╗░██║██╔════╝░
  ░╚██╗████╗██╔╝███████║██████╔╝██╔██╗██║██║██╔██╗██║██║░░██╗░
  ░░████╔═████║░██╔══██║██╔══██╗██║╚████║██║██║╚████║██║░░╚██╗
  ░░╚██╔╝░╚██╔╝░██║░░██║██║░░██║██║░╚███║██║██║░╚███║╚██████╔╝
  ░░░╚═╝░░░╚═╝░░╚═╝░░╚═╝╚═╝░░╚═╝╚═╝░░╚══╝╚═╝╚═╝░░╚══╝░╚═════╝░
  Check all variables below before execute the deployment script
  */

  const alpiesInput: IAlpiesInput = {
    NAME: "Alpies",
    SYMBOL: "ALPIES",
    MAX_SALE_ALPIES: "5000",
    REVEAL_BLOCK: "12112000",
    PRICE_MODEL: "0xb076AcAadB11782DFac6336b83e785839B293BDf",
    MAX_RESERVE: "116",
    MAX_PREMINT_AMOUNT: "125",
  }

  const Alpies = (await ethers.getContractFactory("Alpies", (await ethers.getSigners())[0])) as Alpies__factory

  console.log(`>> Deploying Alpies:${alpiesInput.NAME}`)

  const alpies = (await upgrades.deployProxy(Alpies, [
    alpiesInput.NAME,
    alpiesInput.SYMBOL,
    alpiesInput.MAX_SALE_ALPIES,
    alpiesInput.REVEAL_BLOCK,
    alpiesInput.PRICE_MODEL,
    alpiesInput.MAX_RESERVE,
    alpiesInput.MAX_PREMINT_AMOUNT,
  ])) as Alpies

  console.log(">> Alpies is deployed!")
  console.log("Alpies address", alpies.address)
}

export default func
func.tags = ["Alpies"]
