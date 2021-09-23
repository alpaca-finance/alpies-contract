import { ethers, waffle, network } from "hardhat"
import { Signer, BigNumber, Wallet } from "ethers"
import chai from "chai"
import { MockProvider, solidity } from "ethereum-waffle"
import { smockit, MockContract } from "@eth-optimism/smock"
import { DescendingStepModel, DescendingStepModel__factory } from "../typechain"
import { advanceBlockTo, latestBlockNumber } from "./helpers/time"

chai.use(solidity)
const { expect } = chai
const { AddressZero } = ethers.constants
const { parseEther, formatBytes32String } = ethers.utils

type fixture = {
  descendingStepModel: DescendingStepModel
}


const loadFixtureHandler = async (maybeWallets?: Wallet[], maybeProvider?: MockProvider): Promise<fixture> => {
  const [deployer] = await ethers.getSigners()

  const DescendingStepModel = (await ethers.getContractFactory("DescendingStepModel", deployer)) as DescendingStepModel__factory
  const descendingStepModel = await DescendingStepModel.deploy()
  await descendingStepModel.deployed()

  return { descendingStepModel }
}

describe("AlpacaGang", () => {
  // Accounts
  let deployer: Signer
  let alice: Signer
  let bob: Signer
  let dev: Signer

  // Account Addresses
  let deployerAddress: string
  let aliceAddress: string
  let bobAddress: string
  let devAddress: string

  // Contracts
  let descendingStepModel: DescendingStepModel

  // Signer
  let alpacaGangAsAlice: DescendingStepModel
  let alpacaGangAsBob: DescendingStepModel

  beforeEach(async () => {
    ; ({ descendingStepModel } = await waffle.loadFixture(loadFixtureHandler))
      ;[deployer, alice, bob, dev] = await ethers.getSigners()
      ;[deployerAddress, aliceAddress, bobAddress, devAddress] = await Promise.all([
        deployer.getAddress(),
        alice.getAddress(),
        bob.getAddress(),
        dev.getAddress(),
      ])

    alpacaGangAsAlice = DescendingStepModel__factory.connect(descendingStepModel.address, alice) as DescendingStepModel
  })

  describe("#deploy", () => {
    it("should has correct states", async () => {
      expect(await descendingStepModel.price()).to.be.eq(0)
    })
  })
})