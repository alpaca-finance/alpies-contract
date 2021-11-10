import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"
import { parseEther } from "ethers/lib/utils"
import { ethers } from "hardhat"
import { AscendingStepModel__factory, DescendingStepModel__factory } from "../../../../typechain"

interface IAscendingStepModelInput {
  START_BLOCK: string
  END_BLOCK: string
  BLOCK_PER_STEP: string
  PRICE_STEP: string
  START_PRICE: string
  PRICE_CEIL: string
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

  const descendingStepModelInput: IAscendingStepModelInput = {
    START_BLOCK: "13538000",
    END_BLOCK: "13578320",
    BLOCK_PER_STEP: "120",
    PRICE_STEP: parseEther("0.005").toString(),
    START_PRICE: parseEther("0.22").toString(),
    PRICE_CEIL: parseEther("0.25").toString(),
  }

  const AscendingStepModel = (await ethers.getContractFactory(
    "AscendingStepModel",
    (
      await ethers.getSigners()
    )[0]
  )) as AscendingStepModel__factory

  const ascendingStepModel = await AscendingStepModel.deploy(
    descendingStepModelInput.START_BLOCK,
    descendingStepModelInput.END_BLOCK,
    descendingStepModelInput.BLOCK_PER_STEP,
    descendingStepModelInput.PRICE_STEP,
    descendingStepModelInput.START_PRICE,
    descendingStepModelInput.PRICE_CEIL
  )

  console.log(">> AscendingStepModel is deployed!")
  console.log("AscendingStepModel address: ", ascendingStepModel.address)
}
export default func
func.tags = ["AscendingStepModel"]
