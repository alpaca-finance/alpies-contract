import { ethers, waffle, network } from "hardhat"
import { Signer, BigNumber, Wallet } from "ethers"
import chai from "chai"
import { MockProvider, solidity } from "ethereum-waffle"
import { smockit, MockContract } from "@eth-optimism/smock"
import { AlpacaGang02, AlpacaGang02__factory, DescendingStepModel__factory, FixedPriceModel, FixedPriceModel__factory } from "../typechain"
import { advanceBlockTo, latestBlockNumber } from "./helpers/time"

chai.use(solidity)
const { expect } = chai
const { AddressZero } = ethers.constants
const { parseEther, formatBytes32String } = ethers.utils

type fixture = {
  alpacaGang02: AlpacaGang02
}

const MAX_ALPACAS = 30
const ALPACA_PRICE = ethers.utils.parseEther("1")

const loadFixtureHandler = async (maybeWallets?: Wallet[], maybeProvider?: MockProvider): Promise<fixture> => {
  const [deployer] = await ethers.getSigners()

  // Deploy Fix PriceModel

  const FixedPriceModel = (await ethers.getContractFactory("FixedPriceModel", deployer)) as FixedPriceModel__factory
  const fixedPriceModel = await FixedPriceModel.deploy(
    ALPACA_PRICE
  )
  await fixedPriceModel.deployed()

  // Deploy AlpacaGang
  // Sale will start 1000 blocks from here and another 1000 blocks to reveal
  const AlpacaGang02 = (await ethers.getContractFactory("AlpacaGang02", deployer)) as AlpacaGang02__factory
  const alpacaGang02 = await AlpacaGang02.deploy(
    "Alpaca Gang",
    "ALPACAGANG",
    MAX_ALPACAS,
    (await latestBlockNumber()).add(1000),
    (await latestBlockNumber()).add(2000),
    fixedPriceModel.address
  )
  await alpacaGang02.deployed()

  return { alpacaGang02 }
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
  let alpacaGang02: AlpacaGang02

  // Signer
  let alpacaGangAsAlice: AlpacaGang02
  let alpacaGangAsBob: AlpacaGang02

  beforeEach(async () => {
    ; ({ alpacaGang02 } = await waffle.loadFixture(loadFixtureHandler))
      ;[deployer, alice, bob, dev] = await ethers.getSigners()
      ;[deployerAddress, aliceAddress, bobAddress, devAddress] = await Promise.all([
        deployer.getAddress(),
        alice.getAddress(),
        bob.getAddress(),
        dev.getAddress(),
      ])

    alpacaGangAsAlice = AlpacaGang02__factory.connect(alpacaGang02.address, alice) as AlpacaGang02
    alpacaGangAsBob = AlpacaGang02__factory.connect(alpacaGang02.address, bob) as AlpacaGang02
  })

  describe("#deploy", () => {
    it("should has correct states", async () => {
      expect(await alpacaGang02.reserveCount()).to.be.eq(0)
    })
  })
  describe("#mint", () => {
    context("when startBlock hasn't passed", async () => {
      it("should revert", async () => {
        await expect(alpacaGang02.mint(1)).to.be.revertedWith("!sale start")
      })
    })

    context("when startBlock is passed", async () => {
      beforeEach(async () => {
        // move block forward to pass startBlock
        await advanceBlockTo((await latestBlockNumber()).add(1000).toNumber())
      })

      describe("purchase amount > MAX_ALPACA_PURCHASE", () => {
        it("should revert", async () => {
          // Make gasPrice: 0 possible
          await network.provider.send("hardhat_setNextBlockBaseFeePerGas", ["0x0"])
          // Mint 21 alpies
          await expect(alpacaGang02.mint(21, { value: ALPACA_PRICE.mul(21), gasPrice: 0 })).to.be.revertedWith("amount > MAX_ALPACA_PURCHASE")
        })
      })

      describe("insufficient item to purchase", () => {
        it("should revert", async () => {
          // Make gasPrice: 0 possible
          await network.provider.send("hardhat_setNextBlockBaseFeePerGas", ["0x0"])
          // Mint 20 alpies
          await alpacaGang02.mint(20, { value: ALPACA_PRICE.mul(20), gasPrice: 0 })
          // Tring to mint another 20 should fail since there's only 10 left
          await expect(alpacaGang02.mint(20, { value: ALPACA_PRICE.mul(20), gasPrice: 0 })).to.be.revertedWith("sold out")
        })
      })

      describe("insufficient fund", () => {
        it("should revert", async () => {
          // Make gasPrice: 0 possible
          await network.provider.send("hardhat_setNextBlockBaseFeePerGas", ["0x0"])
          // Mint 20 alpies but provide only cost of 19 alpies
          await expect(alpacaGang02.mint(20, { value: ALPACA_PRICE.mul(19), gasPrice: 0 })).to.be.revertedWith("insufficent funds")
        })
      })
      describe("params valid", () => {
        it("should be able to mint", async () => {
          // Make gasPrice: 0 possible
          await network.provider.send("hardhat_setNextBlockBaseFeePerGas", ["0x0"])
          // Mint 20 alpies
          await alpacaGang02.mint(20, { value: ALPACA_PRICE.mul(20), gasPrice: 0 })

          expect(await alpacaGang02.reserveCount()).to.be.eq(20)
        })
      })
    })
  })

  describe("#reveal", () => {
    context("when reveal block hasn't passed", async () => {
      it("should revert", async () => {
        await expect(alpacaGangAsAlice.reveal()).to.be.revertedWith("it's not time yet")
      })
    })

    context("when reveal block has passed", async () => {
      beforeEach(async () => {
        // move block forward to pass reveal block
        await advanceBlockTo((await latestBlockNumber()).add(2000).toNumber())
      })
      describe("has been revealed already", async () => {
        it("should revert", async () => {
          await alpacaGangAsAlice.reveal()
          await expect(alpacaGangAsAlice.reveal()).to.be.revertedWith("can't reveal again")
        })
      })

      describe("has not been revealed yet", async () => {
        it("should work", async () => {
          expect(await alpacaGang02.startingIndex()).to.be.eq(0)
          await alpacaGangAsAlice.reveal()
          expect(await alpacaGang02.startingIndex()).to.not.be.eq(0)
        })
      })
    })
  })
})
