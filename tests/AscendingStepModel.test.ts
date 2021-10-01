import { ethers, waffle, network } from "hardhat"
import { Signer, BigNumber, Wallet } from "ethers"
import chai from "chai"
import { MockProvider, solidity } from "ethereum-waffle"
import { smockit, MockContract } from "@eth-optimism/smock"
import { AscendingStepModel, AscendingStepModel__factory } from "../typechain"
import { advanceBlockTo, latestBlockNumber } from "./helpers/time"

chai.use(solidity)
const { expect } = chai
const { AddressZero } = ethers.constants
const { parseEther, formatBytes32String } = ethers.utils

const BLOCKPERSTEP = 50
const STARTBLOCK = 500
const ENDBLOCK = 1000
const PRICESTEP = ethers.utils.parseEther("0.1")
const STARTPRICE = ethers.utils.parseEther("0.5")
const CEILINGPRICE = ethers.utils.parseEther("1")
type fixture = {
  ascendingStepModel: AscendingStepModel
}


const loadFixtureHandler = async (maybeWallets?: Wallet[], maybeProvider?: MockProvider): Promise<fixture> => {
  const [deployer] = await ethers.getSigners()

  const AscendingStepModel = (await ethers.getContractFactory("AscendingStepModel", deployer)) as AscendingStepModel__factory
  const ascendingStepModel = await AscendingStepModel.deploy(
    STARTBLOCK,
    ENDBLOCK,
    BLOCKPERSTEP,
    PRICESTEP,
    STARTPRICE,
    CEILINGPRICE
  )
  await ascendingStepModel.deployed()

  return { ascendingStepModel }
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
  let ascendingStepModel: AscendingStepModel

  // Signer
  let priceModelAsAlice: AscendingStepModel
  let priceModelAsBob: AscendingStepModel

  context("Bad params constractor", async () => {

    describe("both price and block number are wrong", async () => {
      it("should revert", async () => {
        const [deployer] = await ethers.getSigners()

        const AscendingStepModel = (await ethers.getContractFactory("AscendingStepModel", deployer)) as AscendingStepModel__factory

        const startBlock = (await latestBlockNumber()).add(1000)
        const endBlock = (await latestBlockNumber())
        const blockPerStep = 10
        const priceStep = ethers.utils.parseEther("0.1")
        const startPrice = ethers.utils.parseEther("1")
        const ceilingPrice = ethers.utils.parseEther("0.5")


        await expect(AscendingStepModel.deploy(
          startBlock,
          endBlock,
          blockPerStep,
          priceStep,
          startPrice,
          ceilingPrice
        )).to.be.revertedWith("AscendingStepModel::constructor:: end block < start block")
      })
    })

    describe("end block < start block", async () => {
      it("should revert", async () => {
        const [deployer] = await ethers.getSigners()

        const AscendingStepModel = (await ethers.getContractFactory("AscendingStepModel", deployer)) as AscendingStepModel__factory

        const startBlock = (await latestBlockNumber()).add(1000)
        const endBlock = (await latestBlockNumber())
        const blockPerStep = 10
        const priceStep = ethers.utils.parseEther("0.1")
        const startPrice = ethers.utils.parseEther("1")
        const ceilingPrice = ethers.utils.parseEther("0.5")


        await expect(AscendingStepModel.deploy(
          startBlock,
          endBlock,
          blockPerStep,
          priceStep,
          startPrice,
          ceilingPrice
        )).to.be.revertedWith("AscendingStepModel::constructor:: end block < start block")
      })
    })

    describe("ceiling price < start price", async () => {
      it("should revert", async () => {
        const [deployer] = await ethers.getSigners()

        const AscendingStepModel = (await ethers.getContractFactory("AscendingStepModel", deployer)) as AscendingStepModel__factory

        const startBlock = (await latestBlockNumber())
        const endBlock = (await latestBlockNumber()).add(1000)
        const blockPerStep = 10
        const priceStep = ethers.utils.parseEther("0.1")
        const startPrice = ethers.utils.parseEther("1")
        const ceilingPrice = ethers.utils.parseEther("0.5")


        await expect(AscendingStepModel.deploy(
          startBlock,
          endBlock,
          blockPerStep,
          priceStep,
          startPrice,
          ceilingPrice
        )).to.be.revertedWith("AscendingStepModel::constructor:: floor price > start price")
      })
    })
  })

  context("Contract Deployed Correctly", async () => {
    beforeEach(async () => {
      ; ({ ascendingStepModel } = await waffle.loadFixture(loadFixtureHandler))
        ;[deployer, alice, bob, dev] = await ethers.getSigners()
        ;[deployerAddress, aliceAddress, bobAddress, devAddress] = await Promise.all([
          deployer.getAddress(),
          alice.getAddress(),
          bob.getAddress(),
          dev.getAddress(),
        ])

      priceModelAsAlice = AscendingStepModel__factory.connect(ascendingStepModel.address, alice) as AscendingStepModel
      priceModelAsBob = AscendingStepModel__factory.connect(ascendingStepModel.address, bob) as AscendingStepModel
    })

    describe("price", () => {
      it("should be the same with deploy param", async () => {
        expect(await priceModelAsAlice.price()).to.be.eq(STARTPRICE)
      })

      it("all users should see the same price", async () => {
        expect(await priceModelAsAlice.price()).to.be.eq((await priceModelAsBob.price()))
      })
    })

    context("time passed", () => {
      describe("but has not reach start block", () => {
        it("price should still be at starting price", async () => {
          await advanceBlockTo(STARTBLOCK - 1)
          expect(await priceModelAsAlice.price()).to.be.eq(STARTPRICE)
        })
      })
    })

    context("time passed, reached start block", () => {
      describe("but has not reach first step", () => {
        it("price should still be at starting price", async () => {
          await advanceBlockTo(STARTBLOCK + BLOCKPERSTEP - 1)
          expect(await priceModelAsAlice.price()).to.be.eq(STARTPRICE)
        })
      })

      describe("reached the first step", () => {
        it("price should drop 1 step", async () => {
          await advanceBlockTo(STARTBLOCK + BLOCKPERSTEP)
          expect(await priceModelAsAlice.price()).to.be.eq(STARTPRICE.add(PRICESTEP))
        })
      })

      describe("reached the 5th step", () => {
        it("price should still be 5 steps", async () => {
          await advanceBlockTo(STARTBLOCK + 5*BLOCKPERSTEP)
          expect(await priceModelAsAlice.price()).to.be.eq(STARTPRICE.add(PRICESTEP.mul(5)))
        })
      })

      describe("exceed end block", () => {
        it("price should still be at floor", async () => {
          await advanceBlockTo(ENDBLOCK + 500)
          expect(await priceModelAsAlice.price()).to.be.eq(CEILINGPRICE)
        })
      })
    })
  })
})