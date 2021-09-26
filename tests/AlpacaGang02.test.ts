import { ethers, waffle, network } from "hardhat"
import { Signer, BigNumber, Wallet } from "ethers"
import chai from "chai"
import { MockProvider, solidity } from "ethereum-waffle"
import { smockit, MockContract } from "@eth-optimism/smock"
import { AlpacaGang02, AlpacaGang02__factory} from "../typechain"
import { advanceBlockTo, latestBlockNumber } from "./helpers/time"

chai.use(solidity)
const { expect } = chai
const { AddressZero } = ethers.constants
const { parseEther, formatBytes32String } = ethers.utils

type fixture = {
  alpacaGang: AlpacaGang02

}

const MAX_ALPACAS = 20

const loadFixtureHandler = async (maybeWallets?: Wallet[], maybeProvider?: MockProvider): Promise<fixture> => {
  const [deployer] = await ethers.getSigners()

  // Deploy AlpacaGang
  // Assuming deployer is VRFCoordinator for testing.
  // Sale will start 1000 blocks from here.
  const AlpacaGang = (await ethers.getContractFactory("AlpacaGang", deployer)) as AlpacaGang02__factory
  const alpacaGang = await AlpacaGang.deploy(
    "Alpaca Gang",
    "ALPACAGANG",
    MAX_ALPACAS,
    (await latestBlockNumber()).add(1000),
    (await latestBlockNumber()).add(2000),
  )
  await alpacaGang.deployed()

  return { alpacaGang }
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
  let alpacaGang: AlpacaGang02

  let mockedLINK: MockContract

  // Signer
  let alpacaGangAsAlice: AlpacaGang02
  let alpacaGangAsBob: AlpacaGang02

  beforeEach(async () => {
    ;({ alpacaGang } = await waffle.loadFixture(loadFixtureHandler))
    ;[deployer, alice, bob, dev] = await ethers.getSigners()
    ;[deployerAddress, aliceAddress, bobAddress, devAddress] = await Promise.all([
      deployer.getAddress(),
      alice.getAddress(),
      bob.getAddress(),
      dev.getAddress(),
    ])

    alpacaGangAsAlice = AlpacaGang02__factory.connect(alpacaGang.address, alice) as AlpacaGang02
    alpacaGangAsBob = AlpacaGang02__factory.connect(alpacaGang.address, bob) as AlpacaGang02
  })

  describe("#deploy", () => {
    it("should has correct states", async () => {
      expect(await alpacaGang.reserveCount()).to.be.eq(0)
    })
  })
  describe("#mint", () => {
    context("when startBlock hasn't passed", async () => {
      it("should revert", async () => {
        await expect(alpacaGang.mint(1)).to.be.revertedWith("!sale start")
      })
    })

    context("when startBlock is passed", async () => {
      beforeEach(async () => {
        // move block forward to pass startBlock
        await advanceBlockTo((await latestBlockNumber()).add(1000).toNumber())
      })

      context("when not all token is pre-minted", async () => {
        it("should revert", async () => {
          await expect(alpacaGang.mint(1)).to.be.revertedWith("!sale start")
          await alpacaGang.preMint(19)
          await expect(alpacaGang.mint(1)).to.be.revertedWith("!sale start")
        })
      })

      context("when all token are minted", async () => {
        beforeEach(async () => {

        })

        context("when amount > MAX_PURCHASE", async () => {
          it("should revert", async () => {
            await expect(alpacaGang.mint(88)).to.be.revertedWith("amount > MAX_ALPACA_PURCHASE")
          })
        })


      })
    })
  })
})
