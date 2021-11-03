import { ethers, waffle, network, upgrades } from "hardhat"
import { Signer, BigNumber, Wallet } from "ethers"
import chai from "chai"
import { MockProvider, solidity } from "ethereum-waffle"
import {
  Alpies,
  Alpies__factory,
  DreamerAlpies,
  DreamerAlpies__factory,
  FixedPriceModel,
  FixedPriceModel__factory,
  MockContractContext,
  MockContractContext__factory,
} from "../typechain"
import { advanceBlockTo, latestBlockNumber } from "./helpers/time"
import { IClaim, parseBalanceMap } from "../utils/merkle/parse-balance-map"
import { formatBigNumber } from "../utils/format"

chai.use(solidity)
const { expect } = chai
const { AddressZero } = ethers.constants
const { parseEther, formatBytes32String } = ethers.utils

type fixture = {
  alpies: DreamerAlpies
  evilContract: MockContractContext
  claims: IClaim
}

// Set MAX_SALE_ALPIES to 100 + CLAIMABLE_ALPIES for easy testing
// as previous testcase base on 100 max Alpies
const CLAIMABLE_ALPIES = ethers.BigNumber.from(6)
const MAX_SALE_ALPIES = 106
const MAX_RESERVE_AMOUNT = 5
const MAX_PREMINT_AMOUNT = 10
const ALPIES_PRICE = ethers.utils.parseEther("1")
const birthCert = "RANDOM_HASH"

const loadFixtureHandler = async (maybeWallets?: Wallet[], maybeProvider?: MockProvider): Promise<fixture> => {
  const [deployer, alice, bob, eve] = await ethers.getSigners()
  const [deployerAddress, aliceAddress, bobAddress, eveAddress] = await Promise.all([
    deployer.getAddress(),
    alice.getAddress(),
    bob.getAddress(),
    eve.getAddress(),
  ])

  const { claims, merkleRoot, tokenTotal } = parseBalanceMap({
    [aliceAddress]: formatBigNumber(2, "purehex"),
    [bobAddress]: formatBigNumber(3, "purehex"),
    [eveAddress]: formatBigNumber(1, "purehex"),
  })

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
  const Alpies = (await ethers.getContractFactory("DreamerAlpies", deployer)) as DreamerAlpies__factory
  const alpies = (await upgrades.deployProxy(Alpies, [
    "Alpies",
    "ALPIES",
    MAX_SALE_ALPIES,
    (await latestBlockNumber()).add(1850),
    fixedPriceModel.address,
    MAX_RESERVE_AMOUNT,
    MAX_PREMINT_AMOUNT,
    merkleRoot,
    CLAIMABLE_ALPIES,
  ])) as DreamerAlpies
  await alpies.deployed()

  // Setup MockContractContext
  const MockContractContext = (await ethers.getContractFactory(
    "MockContractContext",
    deployer
  )) as MockContractContext__factory
  const evilContract = await MockContractContext.deploy()
  await evilContract.deployed()

  return { alpies, evilContract, claims }
}

describe("DreamerAlpies", () => {
  // Accounts
  let deployer: Signer
  let alice: Signer
  let bob: Signer
  let eve: Signer

  // Account Addresses
  let deployerAddress: string
  let aliceAddress: string
  let bobAddress: string
  let eveAddress: string

  // Merkle
  let claims: IClaim

  // Contracts
  let alpies: DreamerAlpies
  let evilContract: MockContractContext

  // Signer
  let alpiesAsDeployer: DreamerAlpies
  let alpiesAsAlice: DreamerAlpies
  let alpiesAsBob: DreamerAlpies

  beforeEach(async () => {
    ;({ alpies, evilContract, claims } = await waffle.loadFixture(loadFixtureHandler))
    ;[deployer, alice, bob, eve] = await ethers.getSigners()
    ;[deployerAddress, aliceAddress, bobAddress, eveAddress] = await Promise.all([
      deployer.getAddress(),
      alice.getAddress(),
      bob.getAddress(),
      eve.getAddress(),
    ])

    alpiesAsAlice = DreamerAlpies__factory.connect(alpies.address, alice)
    alpiesAsBob = DreamerAlpies__factory.connect(alpies.address, bob)
    alpiesAsDeployer = DreamerAlpies__factory.connect(alpies.address, deployer)
  })

  describe("#deploy", () => {
    it("should has correct states", async () => {
      expect(await alpies.claimableAlpies()).to.be.eq(CLAIMABLE_ALPIES)
      expect(await alpies.totalSupply()).to.be.eq(0)
    })
  })

  describe("#claimAlpies", () => {
    context("when users submit invalid proof", async () => {
      it("should revert", async () => {
        await expect(
          alpies.claimAlpies(
            claims[aliceAddress].index,
            aliceAddress,
            claims[bobAddress].amount,
            claims[aliceAddress].proof
          )
        ).to.be.revertedWith("invalid proof")
      })
    })

    context("when users claim already claimed proof", async () => {
      it("should revert", async () => {
        await alpies.claimAlpies(
          claims[aliceAddress].index,
          aliceAddress,
          claims[aliceAddress].amount,
          claims[aliceAddress].proof
        )

        await expect(
          alpies.claimAlpies(
            claims[aliceAddress].index,
            aliceAddress,
            claims[aliceAddress].amount,
            claims[aliceAddress].proof
          )
        ).to.be.revertedWith("already claimed")
      })
    })

    context("when users claim alpies with valid proof", async () => {
      it("should work", async () => {
        const claimableUsers = [aliceAddress, bobAddress, eveAddress]
        let lastTokenId = 0
        let totalClaimedAlpies = 0

        for (const claimableUser of claimableUsers) {
          const claimTx = await alpies.claimAlpies(
            claims[claimableUser].index,
            claimableUser,
            claims[claimableUser].amount,
            claims[claimableUser].proof
          )
          totalClaimedAlpies += Number(claims[claimableUser].amount)
          for (let i = 0; i < Number(claims[claimableUser].amount); i++) {
            expect(claimTx).to.emit(alpies, "LogMint").withArgs(claimableUser, lastTokenId)
            lastTokenId++
          }
          expect(claimTx)
            .to.emit(alpies, "LogClaim")
            .withArgs(claims[claimableUser].index, claimableUser, claims[claimableUser].amount)
          expect(await alpies.balanceOf(claimableUser)).to.be.eq(claims[claimableUser].amount)
          expect(await alpies.claimableAlpies()).to.be.eq(CLAIMABLE_ALPIES.sub(totalClaimedAlpies))
          expect(await alpies.totalSupply()).to.be.eq(totalClaimedAlpies)
          expect(await alpies.isClaimed(claims[claimableUser].index)).to.be.eq(true)
        }
      })
    })
  })

  describe("#claimFreebies", () => {
    let freebiesClaims: IClaim
    let freebiesMerkleRoot: string

    beforeEach(async () => {
      // mintReserve
      await alpies.mintReserve(MAX_RESERVE_AMOUNT)
      // setBirthCert
      await alpies.setBirthCert(birthCert)
      // move block forward to pass startBlock
      await advanceBlockTo((await latestBlockNumber()).add(1000).toNumber())
      // Make gasPrice: 0 possible
      await network.provider.send("hardhat_setNextBlockBaseFeePerGas", ["0x0"])
      // Mint 20 alpies
      const mintAmount = 20
      const currentSupply = await alpies.totalSupply()
      const reserveCount = (await alpies.reserveCount()).toNumber()
      const mintTx = await alpies.mint(mintAmount, { value: ALPIES_PRICE.mul(mintAmount), gasPrice: 0 })

      expect(await alpies.totalSupply()).to.be.eq(mintAmount + reserveCount)
      expect(await alpies.balanceOf(deployerAddress)).to.be.eq(mintAmount + reserveCount)
      // expect alpies to emit LogMint events equal to mint amount
      for (let mintIndex = currentSupply.toNumber(); mintIndex < currentSupply.toNumber() + mintAmount; mintIndex++) {
        expect(mintTx).to.emit(alpies, "LogMint").withArgs(deployerAddress, mintIndex)
      }

      // expect that there is 80 alpies left
      expect((await alpies.maxAlpies()).sub(await alpies.claimableAlpies()).sub(await alpies.totalSupply())).to.be.eq(
        80
      )

      // build Merkle proof for freebies claim
      // 80 Alpies left but 110 allocations
      const freebiesMerkleTree = parseBalanceMap({
        [aliceAddress]: formatBigNumber(60, "purehex"),
        [bobAddress]: formatBigNumber(30, "purehex"),
        [eveAddress]: formatBigNumber(20, "purehex"),
      })
      freebiesClaims = freebiesMerkleTree.claims
      freebiesMerkleRoot = freebiesMerkleTree.merkleRoot

      // stop sale
      await alpies.stopSale(freebiesMerkleRoot, await latestBlockNumber())
      // expect that reveal block changed
      expect(await alpies.revealBlock()).to.be.eq((await latestBlockNumber()).sub(1))
    })

    context("when users try to mint", async () => {
      it("should revert", async () => {
        await expect(alpies.mint(1, { value: ALPIES_PRICE.mul(1), gasPrice: 0 })).to.be.revertedWith(
          "Alpies::mint:: not in sale period"
        )
      })
    })

    context("when users submit invalid proof", async () => {
      it("should revert", async () => {
        await expect(
          alpies.claimFreebies(
            freebiesClaims[aliceAddress].index,
            aliceAddress,
            freebiesClaims[aliceAddress].amount,
            freebiesClaims[bobAddress].proof,
            1
          )
        ).to.be.revertedWith("invalid proof")
      })
    })

    context("when users claim more than what they get assigned", async () => {
      it("should revert", async () => {
        // Alice try claim 61 freebies, however she only has 60 freebies
        await expect(
          alpies.claimFreebies(
            freebiesClaims[aliceAddress].index,
            aliceAddress,
            freebiesClaims[aliceAddress].amount,
            freebiesClaims[aliceAddress].proof,
            61
          )
        ).to.be.revertedWith("exceeded max")

        // Bob claim 30 freebies, Bob should get it
        await alpies.claimFreebies(
          freebiesClaims[bobAddress].index,
          bobAddress,
          freebiesClaims[bobAddress].amount,
          freebiesClaims[bobAddress].proof,
          30
        )
        expect(await alpies.balanceOf(bobAddress)).to.be.eq(30)
        expect(await alpies.freebieClaimedCount(bobAddress)).to.be.eq(30)

        // Bob try to claim 1 more freebie, this should revert
        await expect(
          alpies.claimFreebies(
            freebiesClaims[bobAddress].index,
            bobAddress,
            freebiesClaims[bobAddress].amount,
            freebiesClaims[bobAddress].proof,
            1
          )
        ).to.be.revertedWith("exceeded max")
      })
    })

    context("when Eve comes to claim when all supply left gone", async () => {
      it("should revert", async () => {
        // Alice claim 60 freebies, Alice should get it
        alpies.claimFreebies(
          freebiesClaims[aliceAddress].index,
          aliceAddress,
          freebiesClaims[aliceAddress].amount,
          freebiesClaims[aliceAddress].proof,
          60
        )
        expect(await alpies.balanceOf(aliceAddress)).to.be.eq(60)
        expect(await alpies.freebieClaimedCount(aliceAddress)).to.be.eq(60)

        // Bob claim 20 freebies, Bob should get it
        await alpies.claimFreebies(
          freebiesClaims[bobAddress].index,
          bobAddress,
          freebiesClaims[bobAddress].amount,
          freebiesClaims[bobAddress].proof,
          20
        )
        expect(await alpies.balanceOf(bobAddress)).to.be.eq(20)
        expect(await alpies.freebieClaimedCount(bobAddress)).to.be.eq(20)

        expect((await alpies.totalSupply()).add(CLAIMABLE_ALPIES)).to.be.eq(await alpies.maxAlpies())

        // Eve try to claim 1 more freebie, this should revert
        await expect(
          alpies.claimFreebies(
            freebiesClaims[eveAddress].index,
            eveAddress,
            freebiesClaims[eveAddress].amount,
            freebiesClaims[eveAddress].proof,
            1
          )
        ).to.be.revertedWith("exceeded max supply")

        // whitelist user claim all claimable Alpies
        await alpies.claimAlpies(
          claims[aliceAddress].index,
          aliceAddress,
          claims[aliceAddress].amount,
          claims[aliceAddress].proof
        )
        await alpies.claimAlpies(
          claims[bobAddress].index,
          bobAddress,
          claims[bobAddress].amount,
          claims[bobAddress].proof
        )
        await alpies.claimAlpies(
          claims[eveAddress].index,
          eveAddress,
          claims[eveAddress].amount,
          claims[eveAddress].proof
        )
        expect(await alpies.totalSupply()).to.be.eq(await alpies.maxAlpies())
      })
    })
  })

  describe("#maxAlpies", () => {
    context("When alpies are preminted", async () => {
      it("should return correct maximum amount of alpies", async () => {
        expect(await alpies.maxAlpies()).to.eq(MAX_SALE_ALPIES)

        await alpies.mintReserve(1)
        // should get MAX_ALPIES + minted amount
        expect(await alpies.maxAlpies()).to.eq(MAX_SALE_ALPIES + 1)
      })
    })
  })

  describe("#mintReserve", () => {
    context("When try to call mintReserve after sale start", async () => {
      it("should revert", async () => {
        // move block forward to pass startBlock
        await advanceBlockTo((await latestBlockNumber()).add(1000).toNumber())
        await expect(alpies.mintReserve(5)).to.revertedWith("Alpies::beforeSaleStart:: not allow after sale start")
      })
    })

    context("When try to call mintReserve after birthCert is set", async () => {
      it("should revert", async () => {
        await alpies.setBirthCert(birthCert)
        await expect(alpies.mintReserve(5)).to.revertedWith("Alpies::mintReserve:: birthCert already set")
      })
    })

    context("When try to mintReserve more than maxReserveAmount", async () => {
      it("should revert", async () => {
        await expect(alpies.mintReserve(MAX_RESERVE_AMOUNT + 1)).to.revertedWith(
          "Alpies::mintReserve:: exceed maxReserveAmount"
        )
      })
    })

    context("When not the owner try to call mintReserve", async () => {
      it("should revert", async () => {
        await expect(alpiesAsAlice.mintReserve(1)).to.reverted
      })
    })

    context("When try to mintReserve after preMint", async () => {
      it("should revert", async () => {
        await alpies.preMint(1)
        await expect(alpies.mintReserve(2)).to.revertedWith("Alpies::mintReserve:: cannot mint reserve after premint")
      })
    })

    context("When try to mintReserve multiple times", async () => {
      it("should work", async () => {
        // Make gasPrice: 0 possible
        await network.provider.send("hardhat_setNextBlockBaseFeePerGas", ["0x0"])
        // mintReserve 1 alpie
        const mintReserveTx_1 = await alpies.mintReserve(1)
        expect(await alpies.reserveCount()).to.eq(1)
        expect(mintReserveTx_1).to.emit(alpies, "LogMint").withArgs(deployerAddress, 0)
        expect(mintReserveTx_1).to.emit(alpies, "LogMintReserve").withArgs(deployerAddress, 1, 1)
        // // mintReserve 2 alpies
        const mintReserveTx_2 = await alpies.mintReserve(2, { gasPrice: 0 })
        expect(await alpies.reserveCount()).to.eq(3)
        expect(mintReserveTx_2).to.emit(alpies, "LogMint").withArgs(deployerAddress, 1)
        expect(mintReserveTx_2).to.emit(alpies, "LogMint").withArgs(deployerAddress, 2)
        expect(mintReserveTx_2).to.emit(alpies, "LogMintReserve").withArgs(deployerAddress, 3, 2)
        // // mintReserve 2 alpies
        const mintReserveTx_3 = await alpies.mintReserve(2, { gasPrice: 0 })
        expect(await alpies.reserveCount()).to.eq(5)
        expect(await alpies.balanceOf(deployerAddress)).to.eq(5)
        expect(await alpies.totalSupply()).to.be.eq(5)
        expect(mintReserveTx_3).to.emit(alpies, "LogMint").withArgs(deployerAddress, 3)
        expect(mintReserveTx_3).to.emit(alpies, "LogMint").withArgs(deployerAddress, 4)
        expect(mintReserveTx_3).to.emit(alpies, "LogMintReserve").withArgs(deployerAddress, 5, 2)
      })
    })
  })

  describe("#preMint", () => {
    context("When try to call preMint after sale start", async () => {
      it("should revert", async () => {
        // move block forward to pass startBlock
        await advanceBlockTo((await latestBlockNumber()).add(1000).toNumber())
        await expect(alpies.preMint(5)).to.revertedWith("Alpies::beforeSaleStart:: not allow after sale start")
      })
    })

    context("When try to preMint more than maxPremintAmount", async () => {
      it("should revert", async () => {
        await expect(alpies.preMint(MAX_PREMINT_AMOUNT + 1)).to.revertedWith(
          "Alpies::preMint:: exceed maxPremintAmount"
        )
      })
    })

    context("When not the owner try to preMint", async () => {
      it("should revert", async () => {
        await expect(alpiesAsAlice.preMint(5)).to.reverted
      })
    })

    context("When try to preMint", async () => {
      it("should work", async () => {
        // frist preMint
        const preMintAmount = 5
        const preMintTx_1 = await alpies.preMint(preMintAmount)
        let preMintCount = await alpies.preMintCount()

        expect(await alpies.balanceOf(deployerAddress)).to.eq(preMintAmount)
        expect(preMintCount).to.eq(preMintAmount)
        expect(preMintTx_1).to.emit(alpies, "LogPreMint").withArgs(deployerAddress, preMintAmount, preMintAmount)

        // second preMint
        const preMintTx_2 = await alpies.preMint(preMintAmount)
        preMintCount = await alpies.preMintCount()

        expect(await alpies.balanceOf(deployerAddress)).to.eq(preMintAmount * 2)
        expect(preMintCount).to.eq(preMintAmount * 2)
        expect(preMintTx_2)
          .to.emit(alpies, "LogPreMint")
          .withArgs(deployerAddress, preMintAmount * 2, preMintAmount)
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
        // setBirthCert
        await alpies.setBirthCert(birthCert)
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

    context("when the birthCert is not set", async () => {
      it("should revert", async () => {
        // move block forward to pass startBlock
        await advanceBlockTo((await latestBlockNumber()).add(1000).toNumber())
        // try to mint for NFT
        await expect(alpies.mint(1)).to.be.revertedWith("Alpies::mint:: birthCert not set")
      })
    })

    context("when startBlock is passed", async () => {
      beforeEach(async () => {
        // mintReserve
        await alpies.mintReserve(5)
        // setBirthCert
        await alpies.setBirthCert(birthCert)
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
          const reserveCount = (await alpies.reserveCount()).toNumber()
          const mintTx = await alpies.mint(mintAmount, { value: ALPIES_PRICE.mul(mintAmount), gasPrice: 0 })

          expect(await alpies.totalSupply()).to.be.eq(mintAmount + reserveCount)
          expect(await alpies.balanceOf(deployerAddress)).to.be.eq(mintAmount + reserveCount)
          // expect alpies to emit LogMint events equal to mint amount
          for (
            let mintIndex = currentSupply.toNumber();
            mintIndex < currentSupply.toNumber() + mintAmount;
            mintIndex++
          ) {
            expect(mintTx).to.emit(alpies, "LogMint").withArgs(deployerAddress, mintIndex)
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
            expect(secondMintTx).to.emit(alpies, "LogRefund").withArgs(aliceAddress, ALPIES_PRICE.mul(15))
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
            expect(mintTx).to.not.emit(alpies, "LogRefund")
          })
        })

        context("when user purchase until MAX_ALPIES_PER_ADDRESS", () => {
          it("should not allow user to purchase more than MAX_ALPIES_PER_ADDRESS", async () => {
            // Make gasPrice: 0 possible
            // Total purchaseable Alpies at this stage = (115 + 5) - 15 - 5 = 100 Alpies
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

            // only 15 alpies left. Alice already purchased 85 alpies
            // She now have only 5 Alpies quota to mint left
            // alice wants to mint another 15 alpies
            const balanceBefore = await alice.getBalance()
            const mintTx = await alpiesAsAlice.mint(15, { value: ALPIES_PRICE.mul(15), gasPrice: 0 })
            const balanceAfter = await alice.getBalance()

            // alice should be able to mint only 5 alpies
            // alice should get a refund of ALPIES_PRICE*10
            expect(await alpies.balanceOf(aliceAddress)).to.eq(maxAlpiePerAddress)
            expect(balanceBefore.sub(balanceAfter)).to.eq(ALPIES_PRICE.mul(5))
            expect(mintTx).to.emit(alpies, "LogRefund").withArgs(aliceAddress, ALPIES_PRICE.mul(10))

            // total supply should not reach MAX_ALPIES yet
            // should not allow alice to purchase more
            expect(await alpies.totalSupply()).to.lt(MAX_SALE_ALPIES)
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
            expect(mintTx).to.emit(alpies, "LogRefund").withArgs(aliceAddress, ALPIES_PRICE.mul(5))
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
          // mintReserve
          await alpies.mintReserve(5)
          // setBirthCert
          await alpies.setBirthCert(birthCert)
          // move block forward to pass startBlock
          await advanceBlockTo((await latestBlockNumber()).add(1000).toNumber())
          // Make gasPrice: 0 possible
          await network.provider.send("hardhat_setNextBlockBaseFeePerGas", ["0x0"])

          // Total purchaseable Alpies: (115 + 5) - 15 - 5 = 100 Alpies
          // developer Mint 30 Alpies
          let mintAmount = 30
          let currentSupply = await alpies.totalSupply()
          let mintTx = await alpies.mint(mintAmount, { value: ALPIES_PRICE.mul(mintAmount), gasPrice: 0 })
          // expect alpies to emit mint events equal to mint amount
          for (
            let mintIndex = currentSupply.toNumber();
            mintIndex < currentSupply.toNumber() + mintAmount;
            mintIndex++
          ) {
            expect(mintTx).to.emit(alpies, "LogMint").withArgs(deployerAddress, mintIndex)
          }

          // Total purchaseable Alpies: (115 + 5) - 15 - 35 = 70 Alpies
          // Alice Mint 30 Alpies
          currentSupply = await alpies.totalSupply()
          mintTx = await alpiesAsAlice.mint(mintAmount, { value: ALPIES_PRICE.mul(mintAmount), gasPrice: 0 })
          // expect alpies to emit mint events equal to mint amount
          for (
            let mintIndex = currentSupply.toNumber();
            mintIndex < currentSupply.toNumber() + mintAmount;
            mintIndex++
          ) {
            expect(mintTx).to.emit(alpies, "LogMint").withArgs(aliceAddress, mintIndex)
          }

          // Total purchaseable Alpies: (115 + 5) - 15 - 65 = 40 Alpies
          // Bob Mint 30 Alpies
          currentSupply = await alpies.totalSupply()
          mintTx = await alpiesAsBob.mint(mintAmount, { value: ALPIES_PRICE.mul(mintAmount), gasPrice: 0 })
          // expect alpies to emit LogMint events equal to mint amount
          for (
            let mintIndex = currentSupply.toNumber();
            mintIndex < currentSupply.toNumber() + mintAmount;
            mintIndex++
          ) {
            expect(mintTx).to.emit(alpies, "LogMint").withArgs(bobAddress, mintIndex)
          }
          const purchaseWindowSize = await alpies.PURCHASE_WINDOW_SIZE()
          // move block pass developer purchase window
          await advanceBlockTo((await latestBlockNumber()).add(purchaseWindowSize).toNumber())

          // Total purchaseable Alpies: (115 + 5) - 15 - 95 = 10 Alpies
          // Mint another 10 to wipe out purchaseable Alpies
          mintAmount = 10
          currentSupply = await alpies.totalSupply()
          mintTx = await alpies.mint(mintAmount, { value: ALPIES_PRICE.mul(mintAmount), gasPrice: 0 })
          // expect alpies to emit LogMint events equal to mint amount
          for (
            let mintIndex = currentSupply.toNumber();
            mintIndex < currentSupply.toNumber() + mintAmount;
            mintIndex++
          ) {
            expect(mintTx).to.emit(alpies, "LogMint").withArgs(deployerAddress, mintIndex)
          }

          // Now purchaseable Alpies all gone: (115 + 5) - 15 - 105 = 0
          // However, 15 claimable Alpies hasn't claimed yet.
          // Hence, cannot reveal yet.
          await expect(alpies.reveal()).to.be.revertedWith("Alpies::reveal:: it's not time yet")

          // Claim all claimable Alpies
          const claimableUsers = [aliceAddress, bobAddress, eveAddress]
          let lastTokenId = await alpies.totalSupply()
          let totalClaimedAlpies = 0

          for (const claimableUser of claimableUsers) {
            const alpiesBalanceBeforeClaim = await alpies.balanceOf(claimableUser)
            const totalSupplyBeforeClaim = await alpies.totalSupply()
            const claimTx = await alpies.claimAlpies(
              claims[claimableUser].index,
              claimableUser,
              claims[claimableUser].amount,
              claims[claimableUser].proof
            )
            totalClaimedAlpies += Number(claims[claimableUser].amount)
            for (let i = 0; i < Number(claims[claimableUser].amount); i++) {
              expect(claimTx).to.emit(alpies, "LogMint").withArgs(claimableUser, lastTokenId)
              lastTokenId = lastTokenId.add(1)
            }
            expect(claimTx)
              .to.emit(alpies, "LogClaim")
              .withArgs(claims[claimableUser].index, claimableUser, claims[claimableUser].amount)
            expect(await alpies.balanceOf(claimableUser)).to.be.eq(
              alpiesBalanceBeforeClaim.add(claims[claimableUser].amount)
            )
            expect(await alpies.claimableAlpies()).to.be.eq(CLAIMABLE_ALPIES.sub(totalClaimedAlpies))
            expect(await alpies.totalSupply()).to.be.eq(totalSupplyBeforeClaim.add(claims[claimableUser].amount))
          }

          // Reveal should work now as purchaseable + claimable alpies are wiped out.
          const revealTx = await alpiesAsAlice.reveal()
          const startingIndex = await alpiesAsAlice.startingIndex()
          expect(revealTx).to.emit(alpies, "LogReveal").withArgs(aliceAddress, startingIndex)
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
            .to.emit(alpies, "LogReveal")
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
        // setBirthCert
        await alpies.setBirthCert(birthCert)
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

  describe("#setBirthCert", () => {
    context("when owner call setBirthCert", () => {
      it("should work", async () => {
        // setBirthCert
        await alpies.setBirthCert(birthCert)
        // get birthCert from contract
        const contractBirthCert = await alpies.birthCert()
        expect(contractBirthCert).to.eq(birthCert)
      })
    })

    context("when owner try to call setBirthCert more than once", () => {
      it("should revert", async () => {
        // setBirthCert first time
        await alpies.setBirthCert(birthCert)
        // setBirthCert again
        await expect(alpies.setBirthCert("newHash")).to.revertedWith("Alpies::setBirthCert:: birthCert already set")
        // setBirthCert empty string again
        await expect(alpies.setBirthCert("")).to.revertedWith("Alpies::setBirthCert:: birthCert already set")
      })
    })
  })

  describe("#alpiesId", () => {
    context("when try to get alpiesId before reveal", () => {
      it("should revert", async () => {
        // setBirthCert
        await alpies.setBirthCert(birthCert)
        // move block forward to pass startBlock
        await advanceBlockTo((await latestBlockNumber()).add(1000).toNumber())
        await expect(alpies.alpiesId(0)).to.revertedWith("Alpies::alpiesId:: alpies not reveal yet")
      })
    })
    context("when try to get alpiesId after reveal", () => {
      it("should work when reserveCount = maxReserveAmount", async () => {
        // mintReserve
        await alpies.mintReserve(MAX_RESERVE_AMOUNT)
        // preMint
        await alpies.preMint(10)
        // setBirthCert
        await alpies.setBirthCert(birthCert)
        // move block forward to pass startBlock
        await advanceBlockTo((await latestBlockNumber()).add(1000).toNumber())
        // move block forward to pass revealBlock
        await advanceBlockTo((await latestBlockNumber()).add(2000).toNumber())
        // reveal alpies
        await alpiesAsAlice.reveal()
        const startingIndex = await alpiesAsAlice.startingIndex()
        // mintIndex in reserve set
        let mintIndex = MAX_RESERVE_AMOUNT - 1
        let alpiesId = await alpies.alpiesId(mintIndex)
        expect(alpiesId).to.eq(mintIndex)

        // mintIndex not in reserve set
        const reserveCount = await alpies.reserveCount()
        mintIndex = reserveCount.toNumber()
        alpiesId = await alpies.alpiesId(reserveCount)

        // ( (_mintIndex + startingIndex - reserveCount) % maxSaleAlpies ) + reserveCount
        const expectAlpiesId = BigNumber.from(mintIndex)
          .add(startingIndex)
          .sub(reserveCount)
          .mod(BigNumber.from(MAX_SALE_ALPIES))
          .add(reserveCount)
        expect(alpiesId).to.eq(expectAlpiesId)
      })

      it("should work when reserveCount = 0", async () => {
        // preMint
        await alpies.preMint(10)
        // setBirthCert
        await alpies.setBirthCert(birthCert)
        // move block forward to pass startBlock
        await advanceBlockTo((await latestBlockNumber()).add(1000).toNumber())
        // move block forward to pass revealBlock
        await advanceBlockTo((await latestBlockNumber()).add(2000).toNumber())
        // reveal alpies
        await alpiesAsAlice.reveal()
        const startingIndex = await alpiesAsAlice.startingIndex()

        const reserveCount = await alpies.reserveCount()
        const mintIndex = 0
        const alpiesId = await alpies.alpiesId(reserveCount)
        // ( (_mintIndex + startingIndex - reserveCount) % maxSaleAlpies ) + reserveCount
        const expectAlpiesId = BigNumber.from(mintIndex)
          .add(startingIndex)
          .sub(reserveCount)
          .mod(BigNumber.from(MAX_SALE_ALPIES))
          .add(reserveCount)
        expect(alpiesId).to.eq(expectAlpiesId)
      })
    })
  })
})
