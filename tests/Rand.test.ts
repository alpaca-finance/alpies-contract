import { ethers, waffle, network } from "hardhat"
import { Signer, BigNumber, Wallet } from "ethers"
import chai from "chai"
import { MockProvider, solidity } from "ethereum-waffle"
import { smockit, MockContract } from "@eth-optimism/smock"
import { advanceBlockTo, latestBlockNumber } from "./helpers/time"
import { MockBEP20, MockBEP20__factory, Rand, Rand__factory } from "../typechain"

chai.use(solidity)
const { expect } = chai
const { AddressZero } = ethers.constants
const { parseEther, formatBytes32String } = ethers.utils

type fixture = {
  rand: Rand
  mockedLINK: MockContract
}

const VRF_FEE = ethers.utils.parseEther("0.1")
const KEY_HASHED = "0xcaf3c3727e033261d383b315559476f48034c13b18f8cafed4d871abe5049186"
const MAX_WHITELIST_SPOT = 20

const loadFixtureHandler = async (maybeWallets?: Wallet[], maybeProvider?: MockProvider): Promise<fixture> => {
  const [deployer] = await ethers.getSigners()

  // Deploy mocked BEP20
  const BEP20 = (await ethers.getContractFactory("MockBEP20", deployer)) as MockBEP20__factory
  const LINK = await BEP20.deploy("LINK", "LINK")
  await LINK.deployed()
  const mockedLINK = await smockit(LINK)

  // Deploy Rand
  // Assuming deployer is VRFCoordinator for testing.
  const Rand = (await ethers.getContractFactory("Rand", deployer)) as Rand__factory
  const rand = await Rand.deploy(
    MAX_WHITELIST_SPOT,
    await deployer.getAddress(),
    mockedLINK.address,
    KEY_HASHED,
    VRF_FEE
  )
  await rand.deployed()

  return { rand, mockedLINK }
}

describe("Rand", () => {
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
  let rand: Rand

  let mockedLINK: MockContract

  beforeEach(async () => {
    ;({ rand, mockedLINK } = await waffle.loadFixture(loadFixtureHandler))
    ;[deployer, alice, bob, dev] = await ethers.getSigners()
    ;[deployerAddress, aliceAddress, bobAddress, devAddress] = await Promise.all([
      deployer.getAddress(),
      alice.getAddress(),
      bob.getAddress(),
      dev.getAddress(),
    ])
  })

  describe("#issueTicket", () => {
    context("when deployer issue ticket", async () => {
      it("should work", async () => {
        await rand.issueTicket([aliceAddress, bobAddress])

        const aliceTicketInfo = await rand.ticketInfo(0)
        expect(aliceTicketInfo.owner).to.be.eq(aliceAddress)
        expect(aliceTicketInfo.mark).to.be.eq(0)

        const bobTicketInfo = await rand.ticketInfo(1)
        expect(bobTicketInfo.owner).to.be.eq(bobAddress)
        expect(bobTicketInfo.mark).to.be.eq(0)
      })
    })
  })

  describe("#draw", () => {
    beforeEach(async () => {
      mockedLINK.smocked.balanceOf.will.return.with(ethers.utils.parseEther("88888888"))
      mockedLINK.smocked.transferAndCall.will.return.with(true)
    })

    context("when deployer call draw", async () => {
      it("should work", async () => {
        // call draw before issueTicket
        await expect(rand.draw(10)).to.be.revertedWith("ticketInfo.length too small")

        const tickets = []
        for (let i = 0; i < 100; i++) {
          tickets.push(aliceAddress)
        }
        await rand.issueTicket(tickets)

        await expect(rand.draw(100)).to.be.revertedWith("no more rand")

        let drawTx = await rand.draw(20)
        let drawTxReceipt = await drawTx.wait()
        let requestIds = drawTxReceipt.events!.map((e) => e.args![1] as string)

        expect(requestIds.length).to.be.eq(20)

        await expect(rand.draw(888)).to.be.revertedWith("some pending random")

        // Chainlink fulfill with 0, the following conditions must be satisfied:
        // - ticketInfo[0].mark = 1;
        // - pendingRandom = 19;
        // - whitelistTaken = 1;
        let fulFillTx = await rand.rawFulfillRandomness(requestIds[0], 0)
        let fulFillTxReceipt = await fulFillTx.wait()
        let fulfullInfo = fulFillTxReceipt.events!.map((e) => {
          return {
            rand: e.args![0] as string,
            owner: e.args![1] as string,
          }
        })
        expect((await rand.ticketInfo(0)).mark).to.be.eq(1)
        expect(await rand.pendingRandom()).to.be.eq(19)
        expect(await rand.whitelistTaken()).to.be.eq(1)
        expect(fulfullInfo[0].rand).to.be.eq(0)
        expect(fulfullInfo[0].owner).to.be.eq(aliceAddress)

        // Chainlink fulfill with all other requestIds with 0, the following conditions must be satisfied:
        // - LogAlreadyMark should be emitted
        // - ticketInfo[0].mark = 1;
        // - pendingRandom = 0;
        // - whitelistTaken = 1;
        for (let i = 1; i < 20; i++) {
          await expect(rand.rawFulfillRandomness(requestIds[i], 0)).to.be.emit(rand, "LogAlreadyMark")
        }
        expect((await rand.ticketInfo(0)).mark).to.be.eq(1)
        expect(await rand.pendingRandom()).to.be.eq(0)
        expect(await rand.whitelistTaken()).to.be.eq(1)

        drawTx = await rand.draw(19)
        drawTxReceipt = await drawTx.wait()
        requestIds = drawTxReceipt.events!.map((e) => e.args![1] as string)

        expect(requestIds.length).to.be.eq(19)
        // Chainlink fulfill with all requestIds with 1...18, the following conditions must be satisfied:
        // - LogMark should be emitted with (i, aliceAddress)
        // - ticketInfo[i].mark = 1;
        // - pendingRandom = 1;
        // - whitelistTaken = 19;
        for (let i = 1; i < 19; i++) {
          await expect(rand.rawFulfillRandomness(requestIds[i], i))
            .to.be.emit(rand, "LogMark")
            .withArgs(i, aliceAddress)
        }
        expect(await rand.pendingRandom()).to.be.eq(1)
        expect(await rand.whitelistTaken()).to.be.eq(19)

        // Chainlink fulfilled with 119 (over the ticket length)
        await expect(rand.rawFulfillRandomness(requestIds[18], 119))
          .to.be.emit(rand, "LogMark")
          .withArgs(19, aliceAddress)
        expect(await rand.pendingRandom()).to.be.eq(0)
        expect(await rand.whitelistTaken()).to.be.eq(20)

        // deployer try to draw again, expect to be reverted
        await expect(rand.draw(1)).to.be.revertedWith("no more rand")
      })
    })
  })
})
