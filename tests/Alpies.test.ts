import { ethers, waffle, network } from "hardhat"
import { Signer, BigNumber, Wallet } from "ethers"
import chai from "chai"
import { MockProvider, solidity } from "ethereum-waffle"
import {
  Alpies,
  Alpies__factory,
  FixedPriceModel,
  FixedPriceModel__factory,
  MockContractContext,
  MockContractContext__factory,
} from "../typechain"
import { advanceBlockTo, latestBlockNumber } from "./helpers/time"

chai.use(solidity)
const { expect } = chai
const { AddressZero } = ethers.constants
const { parseEther, formatBytes32String } = ethers.utils

type fixture = {
  alpies: Alpies
  evilContract: MockContractContext
}

const MAX_ALPIES = 100
const MAX_PREMINT_AMOUNT = 5
const ALPIES_PRICE = ethers.utils.parseEther("1")
const provenanceHash = "RANDOM_HASH"

const loadFixtureHandler = async (maybeWallets?: Wallet[], maybeProvider?: MockProvider): Promise<fixture> => {
  const [deployer] = await ethers.getSigners()

  // Deploy Fix PriceModel
  const FixedPriceModel = (await ethers.getContractFactory("FixedPriceModel", deployer)) as FixedPriceModel__factory
  const fixedPriceModel = await FixedPriceModel.deploy(
    (await latestBlockNumber()).add(1000),
    (await latestBlockNumber()).add(1800),
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
    (await latestBlockNumber()).add(1850),
    fixedPriceModel.address,
    MAX_PREMINT_AMOUNT
  )
  await alpies.deployed()

  // Setup MockContractContext
  const MockContractContext = (await ethers.getContractFactory(
    "MockContractContext",
    deployer
  )) as MockContractContext__factory
  const evilContract = await MockContractContext.deploy()
  await evilContract.deployed()

  return { alpies, evilContract }
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
  let evilContract: MockContractContext

  // Signer
  let alpiesAsDeployer: Alpies
  let alpiesAsAlice: Alpies
  let alpiesAsBob: Alpies

  beforeEach(async () => {
    ;({ alpies, evilContract } = await waffle.loadFixture(loadFixtureHandler))
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
      expect(await alpies.totalSupply()).to.be.eq(0)
    })
  })

  describe("#maxAlpies", () => {
    context("When alpies are preminted", async () => {
      it("should return correct maximum amount of alpies", async () => {
        expect(await alpies.maxAlpies()).to.eq(MAX_ALPIES)

        await alpies.preMint(1)
        // should get MAX_ALPIES + minted amount
        expect(await alpies.maxAlpies()).to.eq(MAX_ALPIES + 1)
      })
    })
  })

  describe("#preMint", () => {
    context("When try to preMint after sale start", async () => {
      it("should revert", async () => {
        // move block forward to pass startBlock
        await advanceBlockTo((await latestBlockNumber()).add(1000).toNumber())
        await expect(alpies.preMint(5)).to.revertedWith("Alpies::preMint:: cannot premint after sale start")
      })
    })

    context("When try to preMint after provenanceHash is set", async () => {
      it("should revert", async () => {
        await alpies.setProvenanceHash(provenanceHash)
        await expect(alpies.preMint(5)).to.revertedWith("Alpies::preMint:: provenanceHash already set")
      })
    })

    context("When try to preMint more than maxPremintAmount", async () => {
      it("should revert", async () => {
        await alpies.setProvenanceHash(provenanceHash)
        await expect(alpies.preMint(MAX_PREMINT_AMOUNT + 1)).to.revertedWith(
          "Alpies::preMint:: exceed maxPremintAmount"
        )
      })
    })

    context("When not the owner try to preMint", async () => {
      it("should revert", async () => {
        await alpies.setProvenanceHash(provenanceHash)
        await expect(alpiesAsAlice.preMint(1)).to.reverted
      })
    })

    context("When try to preMint multiple times", async () => {
      it("should work", async () => {
        // Make gasPrice: 0 possible
        await network.provider.send("hardhat_setNextBlockBaseFeePerGas", ["0x0"])
        // premint 1 alpie
        const preMintTx_1 = await alpies.preMint(1)
        expect(await alpies.preMintCount()).to.eq(1)
        expect(preMintTx_1).to.emit(alpies, "Mint").withArgs(deployerAddress, 0)
        expect(preMintTx_1).to.emit(alpies, "PreMint").withArgs(deployerAddress, 1, 1)
        // // premint 2 alpies
        const preMintTx_2 = await alpies.preMint(2, { gasPrice: 0 })
        expect(await alpies.preMintCount()).to.eq(3)
        expect(preMintTx_2).to.emit(alpies, "Mint").withArgs(deployerAddress, 1)
        expect(preMintTx_2).to.emit(alpies, "Mint").withArgs(deployerAddress, 2)
        expect(preMintTx_2).to.emit(alpies, "PreMint").withArgs(deployerAddress, 3, 2)
        // // premint 2 alpies
        const preMintTx_3 = await alpies.preMint(2, { gasPrice: 0 })
        expect(await alpies.preMintCount()).to.eq(5)
        expect(await alpies.balanceOf(deployerAddress)).to.eq(5)
        expect(await alpies.totalSupply()).to.be.eq(5)
        expect(preMintTx_3).to.emit(alpies, "Mint").withArgs(deployerAddress, 3)
        expect(preMintTx_3).to.emit(alpies, "Mint").withArgs(deployerAddress, 4)
        expect(preMintTx_3).to.emit(alpies, "PreMint").withArgs(deployerAddress, 5, 2)
      })
    })
  })

  describe("#maximumPurchasable", () => {
    context("when call maximumPurchasable for first purchase", () => {
      it("should return MAX_PURCHASE_PER_WINDOW amount", async () => {
        const maxPurchasePerWindow = await alpies.MAX_PURCHASE_PER_WINDOW()
        const maxPurchaseable = await alpies.maximumPurchasable(aliceAddress)
        expect(maxPurchaseable).to.eq(maxPurchasePerWindow)
      })
    })

    context("when call maximumPurchasable for later purchase", () => {
      it("should return maxmimum purchaseable amount", async () => {
        // move block forward to pass startBlock
        await advanceBlockTo((await latestBlockNumber()).add(1000).toNumber())
        // setProvenanceHash
        await alpies.setProvenanceHash(provenanceHash)
        // mint alpies
        const amount = 1
        await alpiesAsAlice.mint(amount, { value: ALPIES_PRICE.mul(amount) })
        const maxPurchasePerWindow = await alpies.MAX_PURCHASE_PER_WINDOW()
        // if MAX_PURCHASE_PER_WINDOW is 30
        // alice already mint 1 NFT, thus she should be amount to mint another 29 NFTs
        let maxPurchaseable = await alpies.maximumPurchasable(aliceAddress)
        expect(maxPurchaseable).to.eq(maxPurchasePerWindow.sub(amount))

        // move block forward to pass alice PURCHASE_WINDOW_SIZE
        const purchaseWindowSize = await alpies.PURCHASE_WINDOW_SIZE()
        await advanceBlockTo((await latestBlockNumber()).add(purchaseWindowSize.add(1)).toNumber())
        // alice's maximumPurchasable should be reset
        maxPurchaseable = await alpies.maximumPurchasable(aliceAddress)
        expect(maxPurchaseable).to.eq(maxPurchasePerWindow)
      })
    })
  })

  describe("#mint", () => {
    context("when startBlock hasn't passed", async () => {
      it("should revert", async () => {
        await expect(alpies.mint(1)).to.be.revertedWith("Alpies::mint:: not in sale period")
      })
    })

    context("when the provenanceHash is not set", async () => {
      it("should revert", async () => {
        // move block forward to pass startBlock
        await advanceBlockTo((await latestBlockNumber()).add(1000).toNumber())
        // try to mint for NFT
        await expect(alpies.mint(1)).to.be.revertedWith("Alpies::mint:: provenanceHash not set")
      })
    })

    context("when startBlock is passed", async () => {
      beforeEach(async () => {
        // premint
        await alpies.preMint(5)
        // setProvenanceHash
        await alpies.setProvenanceHash(provenanceHash)
        // move block forward to pass startBlock
        await advanceBlockTo((await latestBlockNumber()).add(1000).toNumber())
      })

      describe("insufficient fund", () => {
        it("should revert", async () => {
          // Make gasPrice: 0 possible
          await network.provider.send("hardhat_setNextBlockBaseFeePerGas", ["0x0"])
          // Mint 20 alpies but provide only cost of 19 alpies
          await expect(alpies.mint(20, { value: ALPIES_PRICE.mul(19), gasPrice: 0 })).to.be.revertedWith(
            "Alpies::mint:: insufficent funds"
          )
        })
      })

      describe("sale ended", () => {
        it("should revert", async () => {
          await advanceBlockTo((await latestBlockNumber()).add(2000).toNumber())
          // Make gasPrice: 0 possible
          await network.provider.send("hardhat_setNextBlockBaseFeePerGas", ["0x0"])
          // Mint 20 alpies after sale ended
          await expect(alpies.mint(20, { value: ALPIES_PRICE.mul(20), gasPrice: 0 })).to.be.revertedWith(
            "Alpies::mint:: not in sale period"
          )
        })
      })

      describe("evilContract try to mint", () => {
        it("should revert", async () => {
          await expect(
            evilContract.executeTransaction(
              alpies.address,
              0,
              "mint(uint256)",
              ethers.utils.defaultAbiCoder.encode(["uint256"], ["0"])
            )
          ).to.be.revertedWith("Alpies::onlyEOA:: not eoa")
        })
      })

      describe("params valid", () => {
        it("should be able to mint", async () => {
          // Make gasPrice: 0 possible
          await network.provider.send("hardhat_setNextBlockBaseFeePerGas", ["0x0"])
          // Mint 20 alpies
          const mintAmount = 20
          const currentSupply = await alpies.totalSupply()
          const preMintCount = (await alpies.preMintCount()).toNumber()
          const mintTx = await alpies.mint(mintAmount, { value: ALPIES_PRICE.mul(mintAmount), gasPrice: 0 })

          expect(await alpies.totalSupply()).to.be.eq(mintAmount + preMintCount)
          expect(await alpies.balanceOf(deployerAddress)).to.be.eq(mintAmount + preMintCount)
          // expect alpies to emit mint events equal to mint amount
          for (
            let mintIndex = currentSupply.toNumber();
            mintIndex < currentSupply.toNumber() + mintAmount;
            mintIndex++
          ) {
            expect(mintTx).to.emit(alpies, "Mint").withArgs(deployerAddress, mintIndex)
          }
        })

        context("when user purchase more than MAX_PURCHASE_PER_WINDOW in the same window", () => {
          it("should allow user to purchase until MAX_PURCHASE_PER_WINDOW and return unused fund", async () => {
            // Make gasPrice: 0 possible
            await network.provider.send("hardhat_setNextBlockBaseFeePerGas", ["0x0"])
            const maxPurchasePerWindow = await alpies.MAX_PURCHASE_PER_WINDOW()

            // Mint 15 alpies
            const firstMintTx = await alpiesAsAlice.mint(15, { value: ALPIES_PRICE.mul(15), gasPrice: 0 })
            let userPurchaseHistory = await alpies.userPurchaseHistory(aliceAddress)
            expect(userPurchaseHistory.counter).to.eq(15)
            expect(userPurchaseHistory.windowStartBlock).to.eq(firstMintTx.blockNumber)
            expect(await alpies.balanceOf(aliceAddress)).to.eq(15)

            // Mint another 30 alpies
            // now alice should be able to mint only 15 alpies and get a refund
            const balanceBefore = await alice.getBalance()
            const secondMintTx = await alpiesAsAlice.mint(30, { value: ALPIES_PRICE.mul(30), gasPrice: 0 })
            const balanceAfter = await alice.getBalance()
            userPurchaseHistory = await alpies.userPurchaseHistory(aliceAddress)

            // alice's counter in this window should equal to MAX_PURCHASE_PER_WINDOW
            // alice's windowStartBlock should not reset
            // alice should get a refund
            expect(userPurchaseHistory.counter).to.eq(maxPurchasePerWindow)
            expect(userPurchaseHistory.windowStartBlock).to.eq(firstMintTx.blockNumber)
            expect(await alpies.balanceOf(aliceAddress)).to.eq(maxPurchasePerWindow)
            expect(balanceBefore.sub(balanceAfter)).to.eq(ALPIES_PRICE.mul(15))
            expect(secondMintTx).to.emit(alpies, "Refund").withArgs(aliceAddress, ALPIES_PRICE.mul(15))
          })
        })

        context("when user make another purchase after the window is reset", () => {
          it("should allow user to purchase equal to MAX_PURCHASE_PER_WINDOW", async () => {
            // Make gasPrice: 0 possible
            await network.provider.send("hardhat_setNextBlockBaseFeePerGas", ["0x0"])
            const maxPurchasePerWindow = await alpies.MAX_PURCHASE_PER_WINDOW()
            const purchaseWindowSize = await alpies.PURCHASE_WINDOW_SIZE()

            // Mint 15 alpies
            await alpiesAsAlice.mint(15, { value: ALPIES_PRICE.mul(15), gasPrice: 0 })
            // move block forward to pass alice PURCHASE_WINDOW_SIZE
            await advanceBlockTo((await latestBlockNumber()).add(purchaseWindowSize.add(1)).toNumber())
            // Mint maxPurchasePerWindow alpies with no refund
            const mintTx = await alpiesAsAlice.mint(maxPurchasePerWindow, {
              value: ALPIES_PRICE.mul(maxPurchasePerWindow),
              gasPrice: 0,
            })
            const userPurchaseHistory = await alpies.userPurchaseHistory(aliceAddress)

            expect(await alpies.balanceOf(aliceAddress)).to.eq(maxPurchasePerWindow.add(15))
            expect(userPurchaseHistory.counter).to.eq(maxPurchasePerWindow)
            expect(userPurchaseHistory.windowStartBlock).to.eq(mintTx.blockNumber)
            expect(mintTx).to.not.emit(alpies, "Refund")
          })
        })

        context("when user purchase until MAX_ALPIES_PER_ADDRESS", () => {
          it("should not allow user to purchase more than MAX_ALPIES_PER_ADDRESS", async () => {
            // Make gasPrice: 0 possible
            await network.provider.send("hardhat_setNextBlockBaseFeePerGas", ["0x0"])
            const purchaseWindowSize = await alpies.PURCHASE_WINDOW_SIZE()
            const maxAlpiePerAddress = await alpies.MAX_ALPIES_PER_ADDRESS()

            // alice mint 30 alpies
            await alpiesAsAlice.mint(30, { value: ALPIES_PRICE.mul(30), gasPrice: 0 })
            expect(await alpies.alpieUserPurchased(aliceAddress)).to.eq(30)
            // move block forward to pass alice PURCHASE_WINDOW_SIZE
            await advanceBlockTo((await latestBlockNumber()).add(purchaseWindowSize.add(1)).toNumber())

            // alice mint 30 alpies
            await alpiesAsAlice.mint(30, { value: ALPIES_PRICE.mul(30), gasPrice: 0 })
            expect(await alpies.alpieUserPurchased(aliceAddress)).to.eq(60)
            // move block forward to pass alice PURCHASE_WINDOW_SIZE
            await advanceBlockTo((await latestBlockNumber()).add(purchaseWindowSize.add(1)).toNumber())

            // alice mint 25 alpies
            await alpiesAsAlice.mint(25, { value: ALPIES_PRICE.mul(25), gasPrice: 0 })
            expect(await alpies.alpieUserPurchased(aliceAddress)).to.eq(85)

            // only 10 alpies left and alice already purchansed 85 alpies
            // alice wants to mint another 15 alpies
            const balanceBefore = await alice.getBalance()
            const mintTx = await alpiesAsAlice.mint(15, { value: ALPIES_PRICE.mul(15), gasPrice: 0 })
            const balanceAfter = await alice.getBalance()

            // alice should be able to mint only 5 alpies
            // alice should get a refund of ALPIES_PRICE*10
            expect(await alpies.balanceOf(aliceAddress)).to.eq(maxAlpiePerAddress)
            expect(balanceBefore.sub(balanceAfter)).to.eq(ALPIES_PRICE.mul(5))
            expect(mintTx).to.emit(alpies, "Refund").withArgs(aliceAddress, ALPIES_PRICE.mul(10))

            // total supply should not reach MAX_ALPIES yet
            // should not allow alice to purchase more
            expect(await alpies.totalSupply()).to.lt(MAX_ALPIES)
            await expect(alpiesAsAlice.mint(1, { value: ALPIES_PRICE.mul(1), gasPrice: 0 })).to.be.revertedWith(
              "Alpies::mint:: unpurchasable"
            )
          })
        })

        context("when insufficient item to purchase", () => {
          it("should allow user to purchase until sold out and return unused fund", async () => {
            // Make gasPrice: 0 possible
            await network.provider.send("hardhat_setNextBlockBaseFeePerGas", ["0x0"])

            // Mint 30 alpies
            await alpies.mint(30, { value: ALPIES_PRICE.mul(30), gasPrice: 0 })
            // move block forward to pass alice PURCHASE_WINDOW_SIZE
            const purchaseWindowSize = await alpies.PURCHASE_WINDOW_SIZE()
            await advanceBlockTo((await latestBlockNumber()).add(purchaseWindowSize.add(1)).toNumber())
            // Mint 30 alpies
            await alpies.mint(30, { value: ALPIES_PRICE.mul(30), gasPrice: 0 })
            await advanceBlockTo((await latestBlockNumber()).add(purchaseWindowSize.add(1)).toNumber())
            // Mint 30 alpies
            await alpies.mint(30, { value: ALPIES_PRICE.mul(30), gasPrice: 0 })
            await advanceBlockTo((await latestBlockNumber()).add(purchaseWindowSize.add(1)).toNumber())

            // Tring to mint another 15, but there's only 10 left
            // alice should 10 alpies and price*5 native tokens back (only pay for 10 alpies)
            const balanceBefore = await alice.getBalance()
            const mintTx = await alpiesAsAlice.mint(15, { value: ALPIES_PRICE.mul(15), gasPrice: 0 })
            const balanceAfter = await alice.getBalance()
            expect(await alpies.balanceOf(aliceAddress)).to.eq(10)
            expect(balanceBefore.sub(balanceAfter)).to.eq(ALPIES_PRICE.mul(10))
            expect(mintTx).to.emit(alpies, "Refund").withArgs(aliceAddress, ALPIES_PRICE.mul(5))
          })
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
          // premint
          await alpies.preMint(5)
          // setProvenanceHash
          await alpies.setProvenanceHash(provenanceHash)
          // move block forward to pass startBlock
          await advanceBlockTo((await latestBlockNumber()).add(1000).toNumber())
          // Make gasPrice: 0 possible
          await network.provider.send("hardhat_setNextBlockBaseFeePerGas", ["0x0"])
          // developer Mint 30 alpies with 95 NTFs left
          let mintAmount = 30
          let currentSupply = await alpies.totalSupply()
          let mintTx = await alpies.mint(mintAmount, { value: ALPIES_PRICE.mul(mintAmount), gasPrice: 0 })
          // expect alpies to emit mint events equal to mint amount
          for (
            let mintIndex = currentSupply.toNumber();
            mintIndex < currentSupply.toNumber() + mintAmount;
            mintIndex++
          ) {
            expect(mintTx).to.emit(alpies, "Mint").withArgs(deployerAddress, mintIndex)
          }

          // alice Mint 30 alpies with 65 NTFs left
          currentSupply = await alpies.totalSupply()
          mintTx = await alpiesAsAlice.mint(mintAmount, { value: ALPIES_PRICE.mul(mintAmount), gasPrice: 0 })
          // expect alpies to emit mint events equal to mint amount
          for (
            let mintIndex = currentSupply.toNumber();
            mintIndex < currentSupply.toNumber() + mintAmount;
            mintIndex++
          ) {
            expect(mintTx).to.emit(alpies, "Mint").withArgs(aliceAddress, mintIndex)
          }

          // bob Mint 30 alpies with 35 NTFs left
          currentSupply = await alpies.totalSupply()
          mintTx = await alpiesAsBob.mint(mintAmount, { value: ALPIES_PRICE.mul(mintAmount), gasPrice: 0 })
          // expect alpies to emit mint events equal to mint amount
          for (
            let mintIndex = currentSupply.toNumber();
            mintIndex < currentSupply.toNumber() + mintAmount;
            mintIndex++
          ) {
            expect(mintTx).to.emit(alpies, "Mint").withArgs(bobAddress, mintIndex)
          }

          const purchaseWindowSize = await alpies.PURCHASE_WINDOW_SIZE()
          // move block pass developer purchase window
          await advanceBlockTo((await latestBlockNumber()).add(purchaseWindowSize).toNumber())
          // Mint another 10 to triger sold out
          mintAmount = 10
          currentSupply = await alpies.totalSupply()
          mintTx = await alpies.mint(mintAmount, { value: ALPIES_PRICE.mul(mintAmount), gasPrice: 0 })
          // expect alpies to emit mint events equal to mint amount
          for (
            let mintIndex = currentSupply.toNumber();
            mintIndex < currentSupply.toNumber() + mintAmount;
            mintIndex++
          ) {
            expect(mintTx).to.emit(alpies, "Mint").withArgs(deployerAddress, mintIndex)
          }
          const revealTx = await alpiesAsAlice.reveal()
          const startingIndex = await alpiesAsAlice.startingIndex()
          expect(revealTx).to.emit(alpies, "Reveal").withArgs(aliceAddress, startingIndex)
          expect(startingIndex).to.not.be.eq(0)
          await expect(alpiesAsAlice.reveal()).to.be.revertedWith("Alpies::reveal:: can't reveal again")

          // try to mint after sold out
          await expect(alpies.mint(1, { value: ALPIES_PRICE.mul(1), gasPrice: 0 })).to.be.revertedWith(
            "Alpies::mint:: unpurchasable"
          )
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
          expect(await alpiesAsAlice.reveal())
            .to.emit(alpies, "Reveal")
            .withArgs(aliceAddress, await alpies.startingIndex())
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
        // setProvenanceHash
        await alpies.setProvenanceHash(provenanceHash)
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

  describe("#setProvenanceHash", () => {
    context("when owner call setProvenanceHash", () => {
      it("should work", async () => {
        // setProvenanceHash
        await alpies.setProvenanceHash(provenanceHash)
        // get provenanceHash from contract
        const contractProvenanceHash = await alpies.provenanceHash()
        expect(contractProvenanceHash).to.eq(provenanceHash)
      })
    })

    context("when owner try to call setProvenanceHash more than once", () => {
      it("should revert", async () => {
        // setProvenanceHash first time
        await alpies.setProvenanceHash(provenanceHash)
        // setProvenanceHash again
        await expect(alpies.setProvenanceHash("newHash")).to.revertedWith(
          "Alpies::setProvenanceHash:: provenanceHash already set"
        )
        // setProvenanceHash empty string again
        await expect(alpies.setProvenanceHash("")).to.revertedWith(
          "Alpies::setProvenanceHash:: provenanceHash already set"
        )
      })
    })
  })

  describe("#alpiesId", () => {
    context("when try to get alpiesId before reveal", () => {
      it("should revert", async () => {
        // setProvenanceHash
        await alpies.setProvenanceHash(provenanceHash)
        // move block forward to pass startBlock
        await advanceBlockTo((await latestBlockNumber()).add(1000).toNumber())
        await expect(alpies.alpiesId(0)).to.revertedWith("Alpies::alpiesId:: alpies not reveal yet")
      })
    })
    context("when try to get alpiesId after reveal", () => {
      it("should work when premintCount = maxPremintAmount", async () => {
        // premint
        await alpies.preMint(MAX_PREMINT_AMOUNT)
        // setProvenanceHash
        await alpies.setProvenanceHash(provenanceHash)
        // move block forward to pass startBlock
        await advanceBlockTo((await latestBlockNumber()).add(1000).toNumber())
        // move block forward to pass revealBlock
        await advanceBlockTo((await latestBlockNumber()).add(2000).toNumber())
        // reveal alpies
        await alpiesAsAlice.reveal()
        const startingIndex = await alpiesAsAlice.startingIndex()
        // mintIndex in premint set
        let mintIndex = MAX_PREMINT_AMOUNT - 1
        let alpiesId = await alpies.alpiesId(mintIndex)
        expect(alpiesId).to.eq(mintIndex)

        // mintIndex not in premint set
        const preMintCount = await alpies.preMintCount()
        mintIndex = preMintCount.toNumber()
        alpiesId = await alpies.alpiesId(preMintCount)
        // ( (_mintIndex + startingIndex - preMintCount) % maxSaleAlpies ) + preMintCount
        const expectAlpiesId = BigNumber.from(mintIndex)
          .add(startingIndex)
          .sub(preMintCount)
          .mod(BigNumber.from(MAX_ALPIES).sub(preMintCount))
          .add(preMintCount)
        expect(alpiesId).to.eq(expectAlpiesId)
      })

      it("should work when premintCount = 0", async () => {
        // setProvenanceHash
        await alpies.setProvenanceHash(provenanceHash)
        // move block forward to pass startBlock
        await advanceBlockTo((await latestBlockNumber()).add(1000).toNumber())
        // move block forward to pass revealBlock
        await advanceBlockTo((await latestBlockNumber()).add(2000).toNumber())
        // reveal alpies
        await alpiesAsAlice.reveal()
        const startingIndex = await alpiesAsAlice.startingIndex()

        const preMintCount = await alpies.preMintCount()
        const mintIndex = 0
        const alpiesId = await alpies.alpiesId(preMintCount)
        // ( (_mintIndex + startingIndex - preMintCount) % maxSaleAlpies ) + preMintCount
        const expectAlpiesId = BigNumber.from(mintIndex)
          .add(startingIndex)
          .sub(preMintCount)
          .mod(BigNumber.from(MAX_ALPIES).sub(preMintCount))
          .add(preMintCount)
        expect(alpiesId).to.eq(expectAlpiesId)
      })
    })
  })
})
