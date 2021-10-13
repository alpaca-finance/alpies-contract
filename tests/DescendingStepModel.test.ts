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

const BLOCKPERSTEP = 50
const STARTBLOCK = 500
const ENDBLOCK = 1000
const PRICESTEP = ethers.utils.parseEther("0.2")
const STARTPRICE = ethers.utils.parseEther("1")
const FLOORPRICE = ethers.utils.parseEther("0.5")
type fixture = {
  descendingStepModel: DescendingStepModel
}

const loadFixtureHandler = async (maybeWallets?: Wallet[], maybeProvider?: MockProvider): Promise<fixture> => {
  const [deployer] = await ethers.getSigners()

  const DescendingStepModel = (await ethers.getContractFactory(
    "DescendingStepModel",
    deployer
  )) as DescendingStepModel__factory
  const descendingStepModel = await DescendingStepModel.deploy(
    STARTBLOCK,
    ENDBLOCK,
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
      it("should revert", async () => {
        const [deployer] = await ethers.getSigners()

        const DescendingStepModel = (await ethers.getContractFactory(
          "DescendingStepModel",
          deployer
        )) as DescendingStepModel__factory

        const startBlock = (await latestBlockNumber()).add(1000)
        const endBlock = await latestBlockNumber()
        const blockPerStep = 10
        const priceStep = ethers.utils.parseEther("0.1")
        const startPrice = ethers.utils.parseEther("0.5")
        const floorPrice = ethers.utils.parseEther("1")

        await expect(
          DescendingStepModel.deploy(startBlock, endBlock, blockPerStep, priceStep, startPrice, floorPrice)
        ).to.be.revertedWith("DescendingStepModel::constructor:: end block < start block")
      })
    })

    describe("end block < start block", async () => {
      it("should revert", async () => {
        const [deployer] = await ethers.getSigners()

        const DescendingStepModel = (await ethers.getContractFactory(
          "DescendingStepModel",
          deployer
        )) as DescendingStepModel__factory

        const startBlock = (await latestBlockNumber()).add(1000)
        const endBlock = await latestBlockNumber()
        const blockPerStep = 10
        const priceStep = ethers.utils.parseEther("0.1")
        const startPrice = ethers.utils.parseEther("1")
        const floorPrice = ethers.utils.parseEther("0.5")

        await expect(
          DescendingStepModel.deploy(startBlock, endBlock, blockPerStep, priceStep, startPrice, floorPrice)
        ).to.be.revertedWith("DescendingStepModel::constructor:: end block < start block")
      })
    })

    describe("floor price > start price", async () => {
      it("should revert", async () => {
        const [deployer] = await ethers.getSigners()

        const DescendingStepModel = (await ethers.getContractFactory(
          "DescendingStepModel",
          deployer
        )) as DescendingStepModel__factory

        const startBlock = await latestBlockNumber()
        const endBlock = (await latestBlockNumber()).add(1000)
        const blockPerStep = 10
        const priceStep = ethers.utils.parseEther("0.1")
        const startPrice = ethers.utils.parseEther("0.5")
        const floorPrice = ethers.utils.parseEther("1")

        await expect(
          DescendingStepModel.deploy(startBlock, endBlock, blockPerStep, priceStep, startPrice, floorPrice)
        ).to.be.revertedWith("DescendingStepModel::constructor:: floor price > start price")
      })
    })
  })

  context("Contract Deployed Correctly", async () => {
    beforeEach(async () => {
      ;({ descendingStepModel } = await waffle.loadFixture(loadFixtureHandler))
      ;[deployer, alice, bob, dev] = await ethers.getSigners()
      ;[deployerAddress, aliceAddress, bobAddress, devAddress] = await Promise.all([
        deployer.getAddress(),
        alice.getAddress(),
        bob.getAddress(),
        dev.getAddress(),
      ])

      priceModelAsAlice = DescendingStepModel__factory.connect(
        descendingStepModel.address,
        alice
      ) as DescendingStepModel
      priceModelAsBob = DescendingStepModel__factory.connect(descendingStepModel.address, bob) as DescendingStepModel
    })

    describe("price", () => {
      it("should be the same with deploy param", async () => {
        expect(await priceModelAsAlice.price()).to.be.eq(STARTPRICE)
      })

      it("all users should see the same price", async () => {
        expect(await priceModelAsAlice.price()).to.be.eq(await priceModelAsBob.price())
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
          expect(await priceModelAsAlice.price()).to.be.eq(STARTPRICE.sub(PRICESTEP))
        })
      })

      describe("reached the thrid step", () => {
        it("price should drop to pricefloor", async () => {
          await advanceBlockTo(STARTBLOCK + 3 * BLOCKPERSTEP)
          expect(await priceModelAsAlice.price()).to.be.eq(FLOORPRICE)
        })
      })

      describe("reached floor before blockend", () => {
        it("price should return priceFloor and prevent overflow", async () => {
          await advanceBlockTo(STARTBLOCK + 6 * BLOCKPERSTEP)
          expect(await priceModelAsAlice.price()).to.be.eq(FLOORPRICE)
        })
      })

      describe("exceed end block", () => {
        it("price should still be at floor", async () => {
          await advanceBlockTo(ENDBLOCK + 500)
          expect(await priceModelAsAlice.price()).to.be.eq(FLOORPRICE)
        })
      })
    })
  })
})
