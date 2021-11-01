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
    MAX_WHITELIST_SPOT: "500",
    VRF_COORDINATOR: "0x747973a5A2a4Ae1D3a8fDF5479f1514F65Db9C31",
    LINK: "0x404460C6A5EdE2D891e8297795264fDe62ADBB75",
    KEY_HASH: "0xc251acd21ec4fb7f31bb8868288bfdbaeb4fbfec2df3735ddbd4f7dc8d60103c",
    VRF_FEE: parseEther("0.2").toString(),
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
