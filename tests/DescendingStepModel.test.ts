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

const BLOCKPERSTEP = 10
const PRICESTEP = ethers.utils.parseEther("0.1")
const STARTPRICE = ethers.utils.parseEther("1")
const FLOORPRICE = ethers.utils.parseEther("0.5")
type fixture = {
  descendingStepModel: DescendingStepModel
}


const loadFixtureHandler = async (maybeWallets?: Wallet[], maybeProvider?: MockProvider): Promise<fixture> => {
  const [deployer] = await ethers.getSigners()

  const startBlock = (await latestBlockNumber())
  const endBlock = (await latestBlockNumber()).add(1000)

  const DescendingStepModel = (await ethers.getContractFactory("DescendingStepModel", deployer)) as DescendingStepModel__factory
  const descendingStepModel = await DescendingStepModel.deploy(
    startBlock,
    endBlock,
    BLOCKPERSTEP,
    PRICESTEP,
    STARTPRICE,
    FLOORPRICE
  )
  await descendingStepModel.deployed()

  return { descendingStepModel }
}

describe("Desending Price Model", () => {
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
  let priceModelAsAlice: DescendingStepModel
  let priceModelAsBob: DescendingStepModel

  context("Bad params constractor", async () => {

    describe("both price and block number are wrong", async () => {
      it("should revert", async() => {
        const [deployer] = await ethers.getSigners()
  
        const DescendingStepModel = (await ethers.getContractFactory("DescendingStepModel", deployer)) as DescendingStepModel__factory
        
        const startBlock = (await latestBlockNumber()).add(1000)
        const endBlock = (await latestBlockNumber())
        const blockPerStep = 10
        const priceStep = ethers.utils.parseEther("0.1")
        const startPrice = ethers.utils.parseEther("0.5")
        const floorPrice = ethers.utils.parseEther("1")

        
        await expect(DescendingStepModel.deploy(
          startBlock,
          endBlock,
          blockPerStep,
          priceStep,
          startPrice,
          floorPrice
        )).to.be.revertedWith("end block < start block")
      })
    })

    describe("end block < start block", async () => {
      it("should revert", async() => {
        const [deployer] = await ethers.getSigners()
  
        const DescendingStepModel = (await ethers.getContractFactory("DescendingStepModel", deployer)) as DescendingStepModel__factory
  
        const startBlock = (await latestBlockNumber()).add(1000)
        const endBlock = (await latestBlockNumber())
        const blockPerStep = 10
        const priceStep = ethers.utils.parseEther("0.1")
        const startPrice = ethers.utils.parseEther("1")
        const floorPrice = ethers.utils.parseEther("0.5")

        
        await expect(DescendingStepModel.deploy(
          startBlock,
          endBlock,
          blockPerStep,
          priceStep,
          startPrice,
          floorPrice
        )).to.be.revertedWith("end block < start block")
      })
    })

    describe("floor price > start price", async () => {
      it("should revert", async() => {
        const [deployer] = await ethers.getSigners()
  
        const DescendingStepModel = (await ethers.getContractFactory("DescendingStepModel", deployer)) as DescendingStepModel__factory
  
        const startBlock = (await latestBlockNumber())
        const endBlock = (await latestBlockNumber()).add(1000)
        const blockPerStep = 10
        const priceStep = ethers.utils.parseEther("0.1")
        const startPrice = ethers.utils.parseEther("0.5")
        const floorPrice = ethers.utils.parseEther("1")

        
        await expect(DescendingStepModel.deploy(
          startBlock,
          endBlock,
          blockPerStep,
          priceStep,
          startPrice,
          floorPrice
        )).to.be.revertedWith("floor price > start price")
      })
    })
  })

  context("Contract Deployed Correctly", async () => {
    beforeEach(async () => {
      ; ({ descendingStepModel } = await waffle.loadFixture(loadFixtureHandler))
        ;[deployer, alice, bob, dev] = await ethers.getSigners()
        ;[deployerAddress, aliceAddress, bobAddress, devAddress] = await Promise.all([
          deployer.getAddress(),
          alice.getAddress(),
          bob.getAddress(),
          dev.getAddress(),
        ])

      priceModelAsAlice = DescendingStepModel__factory.connect(descendingStepModel.address, alice) as DescendingStepModel
    })

    describe("#deploy", () => {
      it("should has correct states", async () => {
        expect(await priceModelAsAlice.price()).to.be.eq(STARTPRICE)
      })
    })
  })
})