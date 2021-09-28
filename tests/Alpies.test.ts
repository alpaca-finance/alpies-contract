import { ethers, waffle, network } from "hardhat"
import { Signer, BigNumber, Wallet } from "ethers"
import chai from "chai"
import { MockProvider, solidity } from "ethereum-waffle"
import { smockit, MockContract } from "@eth-optimism/smock"
import { Alpies, Alpies__factory, DescendingStepModel__factory, FixedPriceModel, FixedPriceModel__factory } from "../typechain"
import { advanceBlockTo, latestBlockNumber } from "./helpers/time"

chai.use(solidity)
const { expect } = chai
const { AddressZero } = ethers.constants
const { parseEther, formatBytes32String } = ethers.utils

type fixture = {
  alpies: Alpies
}

const MAX_ALPIES = 35
const PREMINT_AMOUNT = 5
const ALPIES_PRICE = ethers.utils.parseEther("1")

const loadFixtureHandler = async (maybeWallets?: Wallet[], maybeProvider?: MockProvider): Promise<fixture> => {
  const [deployer] = await ethers.getSigners()

  // Deploy Fix PriceModel

  const FixedPriceModel = (await ethers.getContractFactory("FixedPriceModel", deployer)) as FixedPriceModel__factory
  const fixedPriceModel = await FixedPriceModel.deploy(
    ALPIES_PRICE
  )
  await fixedPriceModel.deployed()

  // Deploy AlpacaGang
  // Sale will start 1000 blocks from here and another 1000 blocks to reveal
  const Alpies = (await ethers.getContractFactory("Alpies", deployer)) as Alpies__factory
  const alpies = await Alpies.deploy(
    "Alpies",
    "ALPIES",
    MAX_ALPIES,
    (await latestBlockNumber()).add(1000),
    (await latestBlockNumber()).add(2000),
    fixedPriceModel.address,
    PREMINT_AMOUNT
  )
  await alpies.deployed()

  return { alpies }
}

describe("Alpies", () => {
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
  let alpies: Alpies

  // Signer
  let alpacaGangAsAlice: Alpies
  let alpacaGangAsBob: Alpies

  beforeEach(async () => {
    ; ({ alpies } = await waffle.loadFixture(loadFixtureHandler))
      ;[deployer, alice, bob, dev] = await ethers.getSigners()
      ;[deployerAddress, aliceAddress, bobAddress, devAddress] = await Promise.all([
        deployer.getAddress(),
        alice.getAddress(),
        bob.getAddress(),
        dev.getAddress(),
      ])

    alpacaGangAsAlice = Alpies__factory.connect(alpies.address, alice) as Alpies
    alpacaGangAsBob = Alpies__factory.connect(alpies.address, bob) as Alpies
  })

  describe("#deploy", () => {
    it("should has correct states", async () => {
       expect(await alpies.totalSupply()).to.be.eq(PREMINT_AMOUNT)
    })
  })
  describe("#mint", () => {
    context("when startBlock hasn't passed", async () => {
      it("should revert", async () => {
        await expect(alpies.mint(1)).to.be.revertedWith("!sale start")
      })
    })

    context("when startBlock is passed", async () => {
      beforeEach(async () => {
        // move block forward to pass startBlock
        await advanceBlockTo((await latestBlockNumber()).add(1000).toNumber())
      })

      describe("purchase amount > MAX_ALPIES_PURCHASE", () => {
        it("should revert", async () => {
          // Make gasPrice: 0 possible
          await network.provider.send("hardhat_setNextBlockBaseFeePerGas", ["0x0"])
          // Mint 21 alpies
          await expect(alpies.mint(21, { value: ALPIES_PRICE.mul(21), gasPrice: 0 })).to.be.revertedWith("amount > MAX_ALPIES_PURCHASE")
        })
      })

      describe("insufficient item to purchase", () => {
        it("should revert", async () => {
          // Make gasPrice: 0 possible
          await network.provider.send("hardhat_setNextBlockBaseFeePerGas", ["0x0"])
          // Mint 20 alpies
          await alpies.mint(20, { value: ALPIES_PRICE.mul(20), gasPrice: 0 })
          // Tring to mint another 20 should fail since there's only 10 left
          await expect(alpies.mint(20, { value: ALPIES_PRICE.mul(20), gasPrice: 0 })).to.be.revertedWith("sold out")
        })
      })

      describe("insufficient fund", () => {
        it("should revert", async () => {
          // Make gasPrice: 0 possible
          await network.provider.send("hardhat_setNextBlockBaseFeePerGas", ["0x0"])
          // Mint 20 alpies but provide only cost of 19 alpies
          await expect(alpies.mint(20, { value: ALPIES_PRICE.mul(19), gasPrice: 0 })).to.be.revertedWith("insufficent funds")
        })
      })
      describe("params valid", () => {
        it("should be able to mint", async () => {
          // Make gasPrice: 0 possible
          await network.provider.send("hardhat_setNextBlockBaseFeePerGas", ["0x0"])
          // Mint 20 alpies
          await alpies.mint(20, { value: ALPIES_PRICE.mul(20), gasPrice: 0 })

          expect(await alpies.totalSupply()).to.be.eq(PREMINT_AMOUNT + 20)
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
          expect(await alpies.startingIndex()).to.be.eq(0)
          await alpacaGangAsAlice.reveal()
          expect(await alpies.startingIndex()).to.not.be.eq(0)
        })
      })
    })
  })
})
