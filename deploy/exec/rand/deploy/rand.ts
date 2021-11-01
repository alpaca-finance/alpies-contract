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
    MAX_WHITELIST_SPOT: "20",
    VRF_COORDINATOR: "0xa555fC018435bef5A13C6c6870a9d4C11DEC329C",
    LINK: "0x84b9B910527Ad5C03A9Ca831909E21e236EA7b06",
    KEY_HASH: "0xcaf3c3727e033261d383b315559476f48034c13b18f8cafed4d871abe5049186",
    VRF_FEE: parseEther("0.1").toString(),
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
