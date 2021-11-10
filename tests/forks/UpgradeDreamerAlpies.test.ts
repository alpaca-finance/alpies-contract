import { expect } from "chai"
import { BigNumber } from "ethers"
import { ethers, network, upgrades } from "hardhat"
import { DreamerAlpies__factory, Timelock__factory } from "../../typechain"
import * as timeHelpers from "../helpers/time"

async function main() {
  if (network.name !== "ethereum_mainnet_fork") throw new Error("not mainnet fork")

  const [alpiesDeployer, mainDeployer] = await ethers.getSigners()
  const timelock = Timelock__factory.connect("0xe2880836faf7FaDF094418F9E9DdDe3d132243F1", mainDeployer)
  const dreamerAlpies = DreamerAlpies__factory.connect("0x57a7c5d10c3f87f5617ac1c60da60082e44d539e", alpiesDeployer)
  const eta = 1636344000

  // Move timestamp to pass timelock
  await timeHelpers.setTimestamp(ethers.BigNumber.from(eta))

  console.log("> upgrade Alpies")
  await timelock.executeTransaction(
    "0x97116a0f3ee811Bc6d7003Ad10980DD77FB1B50e",
    0,
    "upgrade(address,address)",
    ethers.utils.defaultAbiCoder.encode(
      ["address", "address"],
      ["0x57a7c5d10c3f87f5617ac1c60da60082e44d539e", "0x57f9f0871cdA99DF77f209a2670CD0E407019Abd"]
    ),
    eta
  )

  console.log("> claim freebie before stop sale")
  await expect(
    dreamerAlpies.claimFreebies(
      1,
      "0x2bfdacF6CdBC3ECcb95E68ec448ECf3d0693F732",
      1,
      ["0x9f1bb34de5b1000dcb7d378cf18182c500d4348aac1bafe9a5459ff50e82c46c"],
      1
    )
  ).to.be.revertedWith("merkle not set")

  console.log("> stop sale")
  await dreamerAlpies.stopSale("0xd5986c257707b6a95cbd61ca211dcf6ee4d31f34bcf8dfa337d9b28663968e85", "13585400")

  console.log("> check that mint is disabled")
  await expect(dreamerAlpies.mint(1)).to.be.revertedWith("Alpies::mint:: not in sale period")
  console.log("> confirmed.. mint is disabled")

  console.log("> check alpies balance before")
  const alpiesBefore = await dreamerAlpies.balanceOf(alpiesDeployer.address)
  console.log("> claim freebies")
  await dreamerAlpies.claimFreebies(
    211,
    "0x2bfdacF6CdBC3ECcb95E68ec448ECf3d0693F732",
    "300",
    [
      "0x9f1bb34de5b1000dcb7d378cf18182c500d4348aac1bafe9a5459ff50e82c46c",
      "0x03ee794173f31c7e70c7a17d3b6e5d3725c6cc8ccb616838a4845ed46aa4cce9",
      "0xe29c6cd9dd634f1adb4ef24d3ad6c0750015513bbee64040fe734cfda52da9c1",
      "0x04f09c2dda61531a3c4ee40e0c509d11da2cc9706d7a4b9d678e1b071fb40585",
      "0xce1cf03b77d4cb3c01e5131844ed2716c8f4d0dfbab9040fe913ddfcbaa47b67",
      "0x6afd03fdfce1a5f894df84f94dd5fe3e3b05d7a1f1ef56eaea9b3494f6fed797",
      "0x21229246c822b580c77e23689d83baf40cca905cb105b0ca165dadd3b6555f76",
      "0x0683fe2adab11d559347922de9d7825e69a71ddb35779fb4f64545ec486bc456",
      "0x0ac15d636aead5b7e7dedb2656a36e4ea56b1208fae602c374f63f3e782368a0",
      "0x890ba0f727dc926d1f427ee0c26544dcd2e983d172a4340171bec9e61c765b5f",
      "0xde69252194b21bf395140ae38e74d8ec177f5f56d32a75102d8a1dfabde38b51",
    ],
    "10"
  )
  console.log("> check alpies balance after")
  const alpiesAfter = await dreamerAlpies.balanceOf(alpiesDeployer.address)

  expect(alpiesAfter.sub(alpiesBefore)).to.eq("10")
  expect(await dreamerAlpies.freebieClaimedCount(alpiesDeployer.address)).to.eq(10)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
