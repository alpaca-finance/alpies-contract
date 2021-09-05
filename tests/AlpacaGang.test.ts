import { ethers, waffle } from "hardhat"
import { Signer, BigNumber, Wallet } from "ethers"
import chai from "chai"
import { MockProvider, solidity } from "ethereum-waffle"
import { smockit, MockContract } from "@eth-optimism/smock"
import { AlpacaGang, AlpacaGang__factory, MockBEP20, MockBEP20__factory } from "../typechain"
import { advanceBlockTo, latestBlockNumber } from "./helpers/time"

chai.use(solidity)
const { expect } = chai
const { AddressZero } = ethers.constants
const { parseEther, formatBytes32String } = ethers.utils

type fixture = {
  alpacaGang: AlpacaGang
  mockedLINK: MockContract
}

const VRF_FEE = ethers.utils.parseEther("0.1")
const KEY_HASHED = "0xcaf3c3727e033261d383b315559476f48034c13b18f8cafed4d871abe5049186"
const MAX_ALPACAS = 20

const loadFixtureHandler = async (maybeWallets?: Wallet[], maybeProvider?: MockProvider): Promise<fixture> => {
  const [deployer] = await ethers.getSigners()

  // Deploy mocked BEP20
  const BEP20 = (await ethers.getContractFactory("MockBEP20", deployer)) as MockBEP20__factory
  const LINK = await BEP20.deploy("LINK", "LINK")
  await LINK.deployed()
  const mockedLINK = await smockit(LINK)

  // Deploy AlpacaGang
  // Assuming deployer is VRFCoordinator for testing.
  // Sale will start 1000 blocks from here.
  const AlpacaGang = (await ethers.getContractFactory("AlpacaGang", deployer)) as AlpacaGang__factory
  const alpacaGang = await AlpacaGang.deploy(
    "Alpaca Gang",
    "ALPACAGANG",
    MAX_ALPACAS,
    (await latestBlockNumber()).add(1000),
    await deployer.getAddress(),
    mockedLINK.address,
    KEY_HASHED,
    VRF_FEE
  )
  await alpacaGang.deployed()

  return { alpacaGang, mockedLINK }
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
  let alpacaGang: AlpacaGang

  let mockedLINK: MockContract

  // Signer
  let alpacaGangAsAlice: AlpacaGang
  let alpacaGangAsBob: AlpacaGang

  beforeEach(async () => {
    ;({ alpacaGang, mockedLINK } = await waffle.loadFixture(loadFixtureHandler))
    ;[deployer, alice, bob, dev] = await ethers.getSigners()
    ;[deployerAddress, aliceAddress, bobAddress, devAddress] = await Promise.all([
      deployer.getAddress(),
      alice.getAddress(),
      bob.getAddress(),
      dev.getAddress(),
    ])

    alpacaGangAsAlice = AlpacaGang__factory.connect(alpacaGang.address, alice) as AlpacaGang
    alpacaGangAsBob = AlpacaGang__factory.connect(alpacaGang.address, bob) as AlpacaGang
  })

  describe("#deploy", () => {
    it("should has correct states", async () => {
      expect(await alpacaGang.reserveCount()).to.be.eq(0)
    })
  })

  describe("#premint", () => {
    context("when try to pre mint > maxAlpacas", async () => {
      it("should revert", async () => {
        // Deployer pre-mint 20 Alpacas where max is 20.
        await alpacaGang.preMint(20)
        expect(await alpacaGang.balanceOf(alpacaGang.address)).to.be.eq(20)

        // Deployer pre-mint another 1. Expect to be revert.
        await expect(alpacaGang.preMint(1)).to.be.revertedWith("exceed max cap")

        // Sanity check other states.
        expect(await alpacaGang.freeLength()).to.be.eq(20)
      })
    })

    context("when sale has started but all Alpacas still not pre-minted", async () => {
      it("should still only owner to pre mint", async () => {
        // move blocks to pass startBlock
        await advanceBlockTo((await latestBlockNumber()).add(1000).toNumber())
        expect(await ethers.provider.getBlockNumber()).to.be.greaterThan((await alpacaGang.startBlock()).toNumber())

        // expect that pre-mint still work
        await alpacaGang.preMint(20)
        expect(await alpacaGang.freeLength()).to.be.eq(20)
        expect(await alpacaGang.balanceOf(alpacaGang.address)).to.be.eq(20)
      })
    })

    context("when all states are valid", async () => {
      it("should work perfectly fine", async () => {
        // expect that pre-mint still work
        await alpacaGang.preMint(20)

        const [freeLength] = await Promise.all([alpacaGang.freeLength()])

        expect(await alpacaGang.balanceOf(alpacaGang.address)).to.be.eq(20)

        // query all freeAlpacas from contract
        const freeAlpacas = await Promise.all(
          (() => {
            const promises = []
            for (let i = 0; i < freeLength.toNumber(); i++) {
              promises.push(
                (async () => {
                  return {
                    index: i,
                    tokenId: await alpacaGang.freeAlpacas(i),
                  }
                })()
              )
            }
            return promises
          })()
        )

        // expect that free construct correctly
        expect(freeAlpacas.length).to.be.eq(MAX_ALPACAS)
        for (const freeAlpaca of freeAlpacas) {
          expect(freeAlpaca.index).to.be.eq(freeAlpaca.tokenId)
        }
      })
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

      context("when all token is pre-minted", async () => {
        beforeEach(async () => {
          // pre-mint MAX_ALPACAS
          await alpacaGang.preMint(MAX_ALPACAS)
          mockedLINK.smocked.balanceOf.will.return.with(ethers.utils.parseEther("88888888"))
          mockedLINK.smocked.transferAndCall.will.return.with(true)
        })

        context("when amount > MAX_PURCHASE", async () => {
          it("should revert", async () => {
            await expect(alpacaGang.mint(88)).to.be.revertedWith("amount > MAX_ALPACA_PURCHASE")
          })
        })

        context("when all Alpacas get reserved", async () => {
          it("should revert", async () => {
            await alpacaGang.mint(3, { value: ethers.utils.parseEther("1.68").mul(3) })
            await expect(alpacaGang.mint(20)).to.be.revertedWith("sold out")
          })
        })

        context("when not enough LINK to pay VRF", async () => {
          it("should revert", async () => {
            mockedLINK.smocked.balanceOf.will.return.with(0)
            await expect(alpacaGang.mint(1, { value: ethers.utils.parseEther("1.68") })).to.be.revertedWith(
              "not enough LINK"
            )
          })
        })

        context("when params are valid", async () => {
          it("should work", async () => {
            await alpacaGang.mint(20, { value: ethers.utils.parseEther("1.68").mul(20) })
          })
        })
      })
    })
  })

  describe("#claim", () => {
    beforeEach(async () => {
      // Prepare sale
      await alpacaGang.preMint(20)
      await advanceBlockTo((await latestBlockNumber()).add(1000).toNumber())
    })

    context("when random user call claim without mint()", async () => {
      it("should revert", async () => {
        await expect(alpacaGang.claim([formatBytes32String("r@nd0m")])).to.be.revertedWith("!request owner")
      })
    })

    context("when claim more than 10 requests at once", async () => {
      it("should revert", async () => {
        await expect(
          alpacaGang.claim([
            formatBytes32String("r@nd0m"),
            formatBytes32String("r@nd0m"),
            formatBytes32String("r@nd0m"),
            formatBytes32String("r@nd0m"),
            formatBytes32String("r@nd0m"),
            formatBytes32String("r@nd0m"),
            formatBytes32String("r@nd0m"),
            formatBytes32String("r@nd0m"),
            formatBytes32String("r@nd0m"),
            formatBytes32String("r@nd0m"),
            formatBytes32String("r@nd0m"),
          ])
        ).to.be.revertedWith("requestIds.length > 10")
      })
    })

    context("when claim request that not fulfilled yet", async () => {
      it("should revert", async () => {
        // mint 1 Alpaca
        const mintTx = await alpacaGang.mint(1, { value: ethers.utils.parseEther("1.68") })
        const mintTxReceipt = await mintTx.wait()
        const requestIds = mintTxReceipt.events!.map((e) => e.args![1] as string)

        // expect to get 1 requestId
        expect(requestIds.length).to.be.eq(1)

        // call claim before the request has been fulfilled
        await expect(alpacaGang.claim(requestIds)).to.be.revertedWith("!request fulfilled")
      })
    })

    context("when all states are valid", async () => {
      it("should work", async () => {
        // Mint 1 Alpaca
        let mintTx = await alpacaGang.mint(1, { value: ethers.utils.parseEther("1.68") })
        let mintTxReceipt = await mintTx.wait()
        let requestIds = mintTxReceipt.events!.map((e) => e.args![1] as string)

        // Expect to get 1 requestId
        expect(requestIds.length).to.be.eq(1)

        // VRF Coordinator fulfill request
        await alpacaGang.rawFulfillRandomness(requestIds[0], 100)

        // Claim 1 Alpaca, VRF fulfill with randomness = 100
        //  the following states should be satisfy:
        // - Deployer should AlpacaGang's balance should be 1
        // - Deployer should get AlpacaGang ID 0 to his wallet
        // - freeLength should be MAX_ALPACAS - 1
        await alpacaGang.claim(requestIds)
        expect(await alpacaGang.balanceOf(deployerAddress)).to.be.eq(1)
        expect(await alpacaGang.ownerOf(0)).to.be.eq(deployerAddress)
        expect(await alpacaGang.freeLength()).to.be.eq(MAX_ALPACAS - 1)

        // Mint 1 Alpaca
        mintTx = await alpacaGang.mint(1, { value: ethers.utils.parseEther("1.68") })
        mintTxReceipt = await mintTx.wait()
        requestIds = mintTxReceipt.events!.map((e) => e.args![1] as string)

        // Expect to get 1 requestId
        expect(requestIds.length).to.be.eq(1)

        // VRF Coordinator fulfill request
        await alpacaGang.rawFulfillRandomness(requestIds[0], 19)

        // Claim 1 Alpaca, VRF fulfill with randomness = 19
        //  the following states should be satisfy:
        // - Deployer should AlpacaGang's balance should be 2
        // - Deployer should has TokenID [0, 19] to his wallet
        // - freeLength should be MAX_ALPACAS - 2
        await alpacaGang.claim(requestIds)
        expect(await alpacaGang.balanceOf(deployerAddress)).to.be.eq(2)
        expect(await alpacaGang.ownerOf(0)).to.be.eq(deployerAddress)
        expect(await alpacaGang.ownerOf(19)).to.be.eq(deployerAddress)
        expect(await alpacaGang.freeLength()).to.be.eq(MAX_ALPACAS - 2)

        // Mint all left Alpacas
        mintTx = await alpacaGang.mint(18, { value: ethers.utils.parseEther("1.68").mul(18) })
        mintTxReceipt = await mintTx.wait()
        requestIds = mintTxReceipt.events!.map((e) => e.args![1] as string)

        // Expect to get 18 requestIds
        expect(requestIds.length).to.be.eq(18)

        // Fulfil all requests
        await Promise.all(
          (() => {
            const promises = []
            for (const requestId of requestIds) {
              promises.push(alpacaGang.rawFulfillRandomness(requestId, 2))
            }
            return promises
          })()
        )

        // Claim 10 Alpaca
        //  the following states should be satisfy:
        // - Deployer should AlpacaGang's balance should be 2 + 10 = 12
        // - AlpacaGang should has MAX_ALPACAS - 12
        // - freeLength should be MAX_ALPACAS - 12
        await alpacaGang.claim(requestIds.slice(0, 10))
        expect(await alpacaGang.balanceOf(deployerAddress)).to.be.eq(12)
        expect(await alpacaGang.balanceOf(alpacaGang.address)).to.be.eq(MAX_ALPACAS - 12)
        expect(await alpacaGang.freeLength()).to.be.eq(MAX_ALPACAS - 12)

        // Claim 8 Alpaca.
        // The following states should be satisfy:
        // - Deployer should AlpacaGang's balance should be 12 + 8 = 20
        // - AlpacaGang should has MAX_ALPACAS - 20
        // - freeLength should be MAX_ALPACAS - 20
        await alpacaGang.claim(requestIds.slice(10, requestIds.length))
        expect(await alpacaGang.balanceOf(deployerAddress)).to.be.eq(20)
        expect(await alpacaGang.balanceOf(alpacaGang.address)).to.be.eq(0)
        expect(await alpacaGang.freeLength()).to.be.eq(0)

        // Deployer try to claim again with the same requestId.
        // Expect to be reverted.
        await expect(alpacaGang.claim([requestIds[0]])).to.be.revertedWith("!request owner")
      })
    })
  })

  describe("#fulfillRandomness", () => {
    context("when random user call fulfillRandomness", async () => {
      it("should revert", async () => {
        await expect(alpacaGangAsAlice.rawFulfillRandomness("0x", 100)).to.be.reverted
      })
    })

    context("when VRF Coordinator call fulfillRandomness", async () => {
      it("should work", async () => {
        await alpacaGang.rawFulfillRandomness(ethers.utils.formatBytes32String("r@nd0m"), 100)
        expect((await alpacaGang.rands(ethers.utils.formatBytes32String("r@nd0m"))).result).to.be.eq(100)
        expect((await alpacaGang.rands(ethers.utils.formatBytes32String("r@nd0m"))).isFulfilled).to.be.eq(1)
      })
    })
  })
})
