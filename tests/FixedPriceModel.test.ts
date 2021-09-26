import { ethers, waffle, network } from "hardhat"
import { Signer, BigNumber, Wallet } from "ethers"
import chai from "chai"
import { MockProvider, solidity } from "ethereum-waffle"
import { smockit, MockContract } from "@eth-optimism/smock"
import { FixedPriceModel, FixedPriceModel__factory } from "../typechain"
import { advanceBlockTo, latestBlockNumber } from "./helpers/time"

chai.use(solidity)
const { expect } = chai
const { AddressZero } = ethers.constants
const { parseEther, formatBytes32String } = ethers.utils

const PRICE = ethers.utils.parseEther("1")
type fixture = {
  fixedPriceModel: FixedPriceModel
}


const loadFixtureHandler = async (maybeWallets?: Wallet[], maybeProvider?: MockProvider): Promise<fixture> => {
  const [deployer] = await ethers.getSigners()

  const FixedPriceModel = (await ethers.getContractFactory("FixedPriceModel", deployer)) as FixedPriceModel__factory
  const fixedPriceModel = await FixedPriceModel.deploy(
    PRICE
  )
  await fixedPriceModel.deployed()

  return { fixedPriceModel }
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
  let fixedPriceModel: FixedPriceModel

  // Signer
  let priceModelAsAlice: FixedPriceModel
  let priceModelAsBob: FixedPriceModel

  context("Contract Deployed Correctly", async () => {
    beforeEach(async () => {
      ; ({ fixedPriceModel } = await waffle.loadFixture(loadFixtureHandler))
        ;[deployer, alice, bob, dev] = await ethers.getSigners()
        ;[deployerAddress, aliceAddress, bobAddress, devAddress] = await Promise.all([
          deployer.getAddress(),
          alice.getAddress(),
          bob.getAddress(),
          dev.getAddress(),
        ])

      priceModelAsAlice = FixedPriceModel__factory.connect(fixedPriceModel.address, alice) as FixedPriceModel
      priceModelAsBob = FixedPriceModel__factory.connect(fixedPriceModel.address, bob) as FixedPriceModel
    })

    describe("price", () => {
      it("should be the same with deploy param", async () => {
        expect(await priceModelAsAlice.price()).to.be.eq(PRICE)
      })

      it("all users should see the same price", async () => {
        expect(await priceModelAsAlice.price()).to.be.eq((await priceModelAsBob.price()))
      })
    })


    context("time passed", () => {
      describe("price", () => {
        it("should stay the same", async () => {
          const startPrice = (await priceModelAsAlice.price())
          await advanceBlockTo(1000)
          const afterPrice =  (await priceModelAsAlice.price())
          expect(startPrice).to.be.eq(afterPrice)
        })
      })
    })
  })
})