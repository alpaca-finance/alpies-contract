import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"
import { parseEther } from "ethers/lib/utils"
import { ethers } from "hardhat"
import { DescendingStepModel__factory, Rand__factory } from "../../../../typechain"

interface IRandInput {
  MAX_WHITELIST_SPOT: string
  VRF_COORDINATOR: string
  LINK: string
  KEY_HASH: string
  VRF_FEE: string
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

  const randInput: IRandInput = {
    MAX_WHITELIST_SPOT: "",
    VRF_COORDINATOR: "",
    LINK: "",
    KEY_HASH: parseEther("0.1576").toString(),
    VRF_FEE: parseEther("8.88").toString(),
  }

  const Rand = (await ethers.getContractFactory("Rand", (await ethers.getSigners())[0])) as Rand__factory

  const rand = await Rand.deploy(
    randInput.MAX_WHITELIST_SPOT,
    randInput.VRF_COORDINATOR,
    randInput.LINK,
    randInput.KEY_HASH,
    randInput.VRF_FEE
  )

  console.log(">> Rand is deployed!")
  console.log("rand address: ", rand.address)
}
export default func
func.tags = ["Rand"]
