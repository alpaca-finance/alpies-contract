import { ethers, waffle, network } from "hardhat"
import { Signer, BigNumber, Wallet } from "ethers"
import chai from "chai"
import { MockProvider, solidity } from "ethereum-waffle"
import { Alpies, Alpies__factory, FixedPriceModel, FixedPriceModel__factory } from "../typechain"
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

  // Deploy Alpies
  // Sale will start 1000 blocks from here and another 1000 blocks to reveal
  const Alpies = (await ethers.getContractFactory("Alpies", deployer)) as Alpies__factory
  const alpies = await Alpies.deploy(
    "Alpies",
    "ALPIES",
    MAX_ALPIES,
    (await latestBlockNumber()).add(1000),
    (await latestBlockNumber()).add(1800),
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
  let alpiesAsDeployer: Alpies
  let alpiesAsAlice: Alpies
  let alpiesAsBob: Alpies

  beforeEach(async () => {
    ; ({ alpies } = await waffle.loadFixture(loadFixtureHandler))
      ;[deployer, alice, bob, dev] = await ethers.getSigners()
      ;[deployerAddress, aliceAddress, bobAddress, devAddress] = await Promise.all([
        deployer.getAddress(),
        alice.getAddress(),
        bob.getAddress(),
        dev.getAddress(),
      ])

    alpiesAsAlice = Alpies__factory.connect(alpies.address, alice) as Alpies
    alpiesAsBob = Alpies__factory.connect(alpies.address, bob) as Alpies
    alpiesAsDeployer = Alpies__factory.connect(alpies.address, deployer) as Alpies
  })

  describe("#deploy", () => {
    it("should has correct states", async () => {
      expect(await alpies.totalSupply()).to.be.eq(PREMINT_AMOUNT)
    })
  })
  describe("#mint", () => {
    context("when startBlock hasn't passed", async () => {
      it("should revert", async () => {
        await expect(alpies.mint(1)).to.be.revertedWith("Alpies::mint:: not in sale period")
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
          await expect(alpies.mint(21, { value: ALPIES_PRICE.mul(21), gasPrice: 0 })).to.be.revertedWith("Alpies::mint:: amount > MAX_ALPIES_PURCHASE")
        })
      })

      describe("insufficient item to purchase", () => {
        it("should revert", async () => {
          // Make gasPrice: 0 possible
          await network.provider.send("hardhat_setNextBlockBaseFeePerGas", ["0x0"])
          // Mint 20 alpies
          await alpies.mint(20, { value: ALPIES_PRICE.mul(20), gasPrice: 0 })
          // Tring to mint another 20 should fail since there's only 10 left
          await expect(alpies.mint(20, { value: ALPIES_PRICE.mul(20), gasPrice: 0 })).to.be.revertedWith("Alpies::mint:: sold out")
        })
      })

      describe("insufficient fund", () => {
        it("should revert", async () => {
          // Make gasPrice: 0 possible
          await network.provider.send("hardhat_setNextBlockBaseFeePerGas", ["0x0"])
          // Mint 20 alpies but provide only cost of 19 alpies
          await expect(alpies.mint(20, { value: ALPIES_PRICE.mul(19), gasPrice: 0 })).to.be.revertedWith("Alpies::mint:: insufficent funds")
        })
      })

      describe("sale ended", () => {
        it("should revert", async () => {
          await advanceBlockTo((await latestBlockNumber()).add(2000).toNumber())
          // Make gasPrice: 0 possible
          await network.provider.send("hardhat_setNextBlockBaseFeePerGas", ["0x0"])
          // Mint 20 alpies but provide only cost of 19 alpies
          await expect(alpies.mint(20, { value: ALPIES_PRICE.mul(20), gasPrice: 0 })).to.be.revertedWith("Alpies::mint:: not in sale period")
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
    context("when reveal block hasn't passed", () => {
      context("has not sold out", () => {
        it("should revert", async () => {
          
          await expect(alpiesAsAlice.reveal()).to.be.revertedWith("Alpies::reveal:: it's not time yet")
        })
      })
      context("sold out", () => {
        it("should work", async () => {
          
          // move block forward to pass startBlock
          await advanceBlockTo((await latestBlockNumber()).add(1000).toNumber())
          // Make gasPrice: 0 possible
          await network.provider.send("hardhat_setNextBlockBaseFeePerGas", ["0x0"])
          // Mint 20 alpies
          let mintAmount = 20
          let currentSupply = await alpies.totalSupply();
          let mintTx = await alpies.mint(mintAmount, { value: ALPIES_PRICE.mul(mintAmount), gasPrice: 0 })
          // expect alpies to emit mint events equal to mint amount
          for(let mintIndex = currentSupply.toNumber(); mintIndex < currentSupply.toNumber()+mintAmount; mintIndex++){
            expect(mintTx).to.emit(alpies, "Mint").withArgs(deployerAddress, mintIndex);
          }

          // Mint another 10 to triger sold out
          mintAmount = 10
          currentSupply = await alpies.totalSupply();
          mintTx = await alpies.mint(mintAmount, { value: ALPIES_PRICE.mul(mintAmount), gasPrice: 0 })
          // expect alpies to emit mint events equal to mint amount
          for(let mintIndex = currentSupply.toNumber(); mintIndex < currentSupply.toNumber()+mintAmount; mintIndex++){
            expect(mintTx).to.emit(alpies, "Mint").withArgs(deployerAddress, mintIndex);
          }
          const revealTx = await alpiesAsAlice.reveal()
          const startingIndex = await alpiesAsAlice.startingIndex()
          expect(revealTx).to.emit(alpies,"Reveal").withArgs(aliceAddress, startingIndex)
          expect(startingIndex).to.not.be.eq(0)
          await expect(alpiesAsAlice.reveal()).to.be.revertedWith("Alpies::reveal:: can't reveal again")
        })
      })
    })

    context("when reveal block has passed", async () => {
      beforeEach(async () => {
        // move block forward to pass reveal block
        await advanceBlockTo((await latestBlockNumber()).add(2000).toNumber())
      })
      describe("has been revealed already", async () => {
        it("should revert", async () => {
          await alpiesAsAlice.reveal()
          await expect(alpiesAsAlice.reveal()).to.be.revertedWith("Alpies::reveal:: can't reveal again")
        })
      })

      describe("has not been revealed yet", async () => {
        it("should work", async () => {
          expect(await alpies.startingIndex()).to.be.eq(0)
          expect(await alpiesAsAlice.reveal()).to.emit(alpies, "Reveal").withArgs(aliceAddress, await alpies.startingIndex())
          expect(await alpies.startingIndex()).to.not.be.eq(0)
        })
      })
    })
  })

  describe("#withdraw", () => {
    context("when not owner call withdraw", () => {
      it("should revert", async () => {
        await expect(alpiesAsAlice.withdraw(aliceAddress)).to.be.reverted
      })
    })

    context("when owner call withdraw", () => {
      it("should work", async () => {
        // move block forward to pass startBlock
        await advanceBlockTo((await latestBlockNumber()).add(1000).toNumber())
        // mint alpies
        await alpiesAsAlice.mint(20, { value: ALPIES_PRICE.mul(20) })

        const balanceBefore = await deployer.getBalance()
        // Make gasPrice: 0 possible
        await network.provider.send("hardhat_setNextBlockBaseFeePerGas", ["0x0"])
        // withdraw fund from alpies contract
        await alpiesAsDeployer.withdraw(deployerAddress, { gasPrice: 0 })
        const balanceAfter = await deployer.getBalance()

        expect(balanceAfter.sub(balanceBefore)).to.eq(ALPIES_PRICE.mul(20))
      })
    })
  })
})
