import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"
import { parseEther } from "ethers/lib/utils"

interface IDescendingStepModelInput {
  START_BLOCK: string
  END_BLOCK: string
  BLOCK_PER_STEP: string
  PRICE_STEP: string
  START_PRICE: string
  PRICE_FLOOR: string
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

  const descendingStepModelInput: IDescendingStepModelInput = {
    START_BLOCK: "",
    END_BLOCK: "",
    BLOCK_PER_STEP: "1200",
    PRICE_STEP: parseEther("0.1576").toString(),
    START_PRICE: parseEther("8.88").toString(),
    PRICE_FLOOR: parseEther("1").toString(),
  }

  const { deployer } = await getNamedAccounts()

  const descendingStepModel = await deploy("DescendingStepModel", {
    from: deployer,
    contract: "DescendingStepModel",
    args: [
      descendingStepModelInput.START_BLOCK,
      descendingStepModelInput.END_BLOCK,
      descendingStepModelInput.BLOCK_PER_STEP,
      descendingStepModelInput.PRICE_STEP,
      descendingStepModelInput.START_PRICE,
      descendingStepModelInput.PRICE_FLOOR,
    ],
    log: true,
    deterministicDeployment: false,
  })

  console.log(">> DescendingStepModel is deployed!")
  console.log("descendingStepModel receipt", descendingStepModel.receipt)
}
export default func
func.tags = ["DescendingStepModel"]
