import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"
import { parseEther } from "ethers/lib/utils"
import { ethers } from "hardhat"
import { DescendingStepModel__factory } from "../../../../../typechain"

interface IDescendingStepModelInput {
  START_BLOCK: string
  END_BLOCK: string
  BLOCK_PER_STEP: string
  PRICE_STEP: string
  START_PRICE: string
  PRICE_FLOOR: string
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

  const descendingStepModelInput: IDescendingStepModelInput = {
    START_BLOCK: "11910350",
    END_BLOCK: "12111950",
    BLOCK_PER_STEP: "1200",
    PRICE_STEP: parseEther("0.1576").toString(),
    START_PRICE: parseEther("8.88").toString(),
    PRICE_FLOOR: parseEther("1").toString(),
  }

  const DescendingStepModel = (await ethers.getContractFactory(
    "DescendingStepModel",
    (
      await ethers.getSigners()
    )[0]
  )) as DescendingStepModel__factory

  const descendingStepModel = await DescendingStepModel.deploy(
    descendingStepModelInput.START_BLOCK,
    descendingStepModelInput.END_BLOCK,
    descendingStepModelInput.BLOCK_PER_STEP,
    descendingStepModelInput.PRICE_STEP,
    descendingStepModelInput.START_PRICE,
    descendingStepModelInput.PRICE_FLOOR
  )

  console.log(">> DescendingStepModel is deployed!")
  console.log("descendingStepModel address", descendingStepModel.address)
}
export default func
func.tags = ["DescendingStepModel"]
