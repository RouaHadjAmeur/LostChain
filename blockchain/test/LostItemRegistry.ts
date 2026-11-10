
import { expect } from "chai";
import { network } from "hardhat";

describe("LostItemRegistry", function () {

  async function deployContracts() {
    const { ethers } = await network.create();

    const [reporter, claimant, stranger] = await ethers.getSigners();

    // Deploy CampusIdentity first
    const identity = await ethers.deployContract("CampusIdentity");
    await identity.waitForDeployment();

    // Register the users
    await identity.connect(reporter).registerUser("Alice", 0);
    await identity.connect(claimant).registerUser("Bob", 1);

    // Deploy LostItemRegistry using CampusIdentity's address
    const registry = await ethers.deployContract(
      "LostItemRegistry",
      [await identity.getAddress()]
    );
    await registry.waitForDeployment();

    return { ethers, identity, registry, reporter, claimant, stranger };
  }

  type Fixture = Awaited<ReturnType<typeof deployContracts>>;

  async function reportFoundItem(registry: Fixture["registry"], reporter: Fixture["reporter"]) {
    await registry.connect(reporter).reportFoundItem(
      "Black Wallet",
      "Accessories",
      "A black wallet found near the library",
      "University Library",
      ""
    );
  }

  it("should allow a registered user to report a found item", async function () {
    const { registry, reporter } = await deployContracts();

    await reportFoundItem(registry, reporter);

    const item = await registry.getItemDetails(1);

    expect(item.title).to.equal("Black Wallet");
    expect(item.reporter).to.equal(reporter.address);
    expect(item.status).to.equal(0n);
  });

  it("should allow a registered user to report a lost item", async function () {
    const { registry, reporter } = await deployContracts();

    await registry.connect(reporter).reportLostItem(
      "Laptop",
      "Electronics",
      "Silver laptop",
      "Engineering Building",
      ""
    );

    const item = await registry.getItemDetails(1);

    expect(item.title).to.equal("Laptop");
    expect(item.itemType).to.equal(0n);
  });

  it("should prevent unregistered users from reporting items", async function () {
    const { registry, stranger } = await deployContracts();

    await expect(
      registry.connect(stranger).reportFoundItem(
        "Wallet",
        "Accessories",
        "Black wallet",
        "Library",
        ""
      )
    ).to.be.revertedWith("User is not registered");
  });

  it("should allow a registered user to submit a claim", async function () {
    const { registry, reporter, claimant } = await deployContracts();

    await reportFoundItem(registry, reporter);

    await registry.connect(claimant).submitClaim(
      1,
      "I believe this wallet belongs to me."
    );

    const claim = await registry.getClaimDetails(1);
    const item = await registry.getItemDetails(1);

    expect(claim.claimant).to.equal(claimant.address);
    expect(claim.status).to.equal(0n);
    expect(item.status).to.equal(1n);
  });

  it("should prevent users from claiming their own items", async function () {
    const { registry, reporter } = await deployContracts();

    await reportFoundItem(registry, reporter);

    await expect(
      registry.connect(reporter).submitClaim(1, "My wallet")
    ).to.be.revertedWith("Cannot claim own item");
  });

  it("should allow only the reporter to accept a claim", async function () {
    const { registry, reporter, claimant } = await deployContracts();

    await reportFoundItem(registry, reporter);

    await registry.connect(claimant).submitClaim(1, "My wallet");

    await expect(
      registry.connect(claimant).acceptClaim(1)
    ).to.be.revertedWith("Only reporter can accept");

    await registry.connect(reporter).acceptClaim(1);

    const claim = await registry.getClaimDetails(1);

    expect(claim.status).to.equal(1n);
  });

  it("should allow the reporter to reject a claim", async function () {
    const { registry, reporter, claimant } = await deployContracts();

    await reportFoundItem(registry, reporter);

    await registry.connect(claimant).submitClaim(1, "My wallet");
    await registry.connect(reporter).rejectClaim(1);

    const claim = await registry.getClaimDetails(1);
    const item = await registry.getItemDetails(1);

    expect(claim.status).to.equal(2n);
    expect(item.status).to.equal(0n);
  });

  describe("recovery workflow safeguards", function () {
    it("rejects a claim on a Lost item without creating a claim", async function () {
      const { registry, reporter, claimant } = await deployContracts();
      await registry.connect(reporter).reportLostItem(
        "Laptop", "Electronics", "Silver laptop", "Engineering Building", ""
      );

      await expect(registry.connect(claimant).submitClaim(1, "My laptop"))
        .to.be.revertedWith("Not a found item");
      expect(await registry.getClaimsForItem(1)).to.have.lengthOf(0);
      expect(await registry.getPendingClaimCount(1)).to.equal(0n);
      expect((await registry.getItemDetails(1)).status).to.equal(0n);
    });

    it("rejects duplicate claims without changing counts or the original claim", async function () {
      const { registry, reporter, claimant } = await deployContracts();
      await reportFoundItem(registry, reporter);
      await registry.connect(claimant).submitClaim(1, "My wallet");

      await expect(registry.connect(claimant).submitClaim(1, "Second request"))
        .to.be.revertedWith("Already claimed");
      expect(await registry.getClaimsForItem(1)).to.have.lengthOf(1);
      expect(await registry.getPendingClaimCount(1)).to.equal(1n);
      expect((await registry.getClaimDetails(1)).message).to.equal("My wallet");
    });

    it("allows only the reporter to reject a pending claim", async function () {
      const { identity, registry, reporter, claimant, stranger } = await deployContracts();
      // Register the unrelated member to test ownership, not just registration.
      await identity.connect(stranger).registerUser("Unrelated Staff", 1);
      await reportFoundItem(registry, reporter);
      await registry.connect(claimant).submitClaim(1, "My wallet");

      for (const unauthorized of [claimant, stranger]) {
        await expect(registry.connect(unauthorized).rejectClaim(1))
          .to.be.revertedWith("Only reporter can reject");
      }
      expect((await registry.getClaimDetails(1)).status).to.equal(0n);
      expect(await registry.getPendingClaimCount(1)).to.equal(1n);

      await expect(registry.connect(reporter).rejectClaim(1))
        .to.emit(registry, "ClaimRejected").withArgs(1n);
      expect((await registry.getClaimDetails(1)).status).to.equal(2n);
      expect((await registry.getItemDetails(1)).status).to.equal(0n);
      expect(await registry.getPendingClaimCount(1)).to.equal(0n);
    });

    it("lets the claimant cancel a pending claim and reopens the item", async function () {
      const { registry, reporter, claimant } = await deployContracts();
      await reportFoundItem(registry, reporter);
      await registry.connect(claimant).submitClaim(1, "My wallet");

      await expect(registry.connect(reporter).cancelClaim(1))
        .to.be.revertedWith("Only claimant can cancel");
      expect((await registry.getClaimDetails(1)).status).to.equal(0n);
      await expect(registry.connect(claimant).cancelClaim(1))
        .to.emit(registry, "ClaimCancelled").withArgs(1n);
      expect((await registry.getClaimDetails(1)).status).to.equal(3n);
      expect((await registry.getItemDetails(1)).status).to.equal(0n);
      expect(await registry.getPendingClaimCount(1)).to.equal(0n);
      await expect(registry.connect(claimant).cancelClaim(1))
        .to.be.revertedWith("Claim not pending");
      // A cancelled claim still counts as this member's one claim for the item.
      await expect(registry.connect(claimant).submitClaim(1, "Try again"))
        .to.be.revertedWith("Already claimed");
    });

    it("keeps the item ClaimPending when another pending claim remains after cancellation", async function () {
      const { identity, registry, reporter, claimant, stranger } = await deployContracts();
      await identity.connect(stranger).registerUser("Second claimant", 0);
      await reportFoundItem(registry, reporter);
      await registry.connect(claimant).submitClaim(1, "My wallet");
      await registry.connect(stranger).submitClaim(1, "My wallet too");
      await registry.connect(claimant).cancelClaim(1);

      expect(await registry.getPendingClaimCount(1)).to.equal(1n);
      expect((await registry.getItemDetails(1)).status).to.equal(1n);
      expect((await registry.getClaimDetails(2)).status).to.equal(0n);
      await registry.connect(reporter).rejectClaim(2);
      expect(await registry.getPendingClaimCount(1)).to.equal(0n);
      expect((await registry.getItemDetails(1)).status).to.equal(0n);
    });

    for (const withClaim of [false, true]) {
      it(`only the reporter can close an ${withClaim ? "item with pending claims" : "open item"}`, async function () {
        const { identity, registry, reporter, claimant, stranger } = await deployContracts();
        await identity.connect(stranger).registerUser("Unrelated Staff", 1);
        await reportFoundItem(registry, reporter);
        if (withClaim) await registry.connect(claimant).submitClaim(1, "My wallet");

        for (const unauthorized of [claimant, stranger]) {
          await expect(registry.connect(unauthorized).closeItem(1))
            .to.be.revertedWith("Only reporter can close");
        }
        expect((await registry.getItemDetails(1)).status).to.equal(withClaim ? 1n : 0n);
        await expect(registry.connect(reporter).closeItem(1))
          .to.emit(registry, "ItemClosed").withArgs(1n);
        expect((await registry.getItemDetails(1)).status).to.equal(4n);
        expect(await registry.getPendingClaimCount(1)).to.equal(0n);
        if (withClaim) expect((await registry.getClaimDetails(1)).status).to.equal(3n);
        await expect(registry.connect(claimant).submitClaim(1, "My wallet"))
          .to.be.revertedWith("Item is not available");
      });
    }

    for (const reporterFirst of [false, true]) {
      it(`returns an item only after both confirmations (${reporterFirst ? "reporter" : "claimant"} first)`, async function () {
        const { registry, reporter, claimant } = await deployContracts();
        await reportFoundItem(registry, reporter);
        await registry.connect(claimant).submitClaim(1, "My wallet");
        await registry.connect(reporter).acceptClaim(1);
        const first = reporterFirst ? reporter : claimant;
        const second = reporterFirst ? claimant : reporter;

        await expect(registry.connect(first).confirmHandover(1))
          .to.emit(registry, "HandoverConfirmed").withArgs(1n, first.address);
        let claim = await registry.getClaimDetails(1);
        expect(claim.status).to.equal(1n);
        expect(claim.reporterConfirmed).to.equal(reporterFirst);
        expect(claim.claimantConfirmed).to.equal(!reporterFirst);
        expect((await registry.getItemDetails(1)).status).to.equal(2n);
        await expect(registry.connect(first).confirmHandover(1))
          .to.be.revertedWith("Already confirmed");
        // Repeating one's own confirmation must never stand in for the other party.
        expect((await registry.getItemDetails(1)).status).to.equal(2n);
        await expect(registry.connect(second).confirmHandover(1))
          .to.emit(registry, "ItemReturned").withArgs(1n, 1n);
        claim = await registry.getClaimDetails(1);
        expect(claim.reporterConfirmed).to.equal(true);
        expect(claim.claimantConfirmed).to.equal(true);
        expect(claim.status).to.equal(4n);
        expect((await registry.getItemDetails(1)).status).to.equal(3n);
        await expect(registry.connect(second).confirmHandover(1))
          .to.be.revertedWith("Claim has not been accepted");
      });
    }

    it("rejects claims from unregistered users without changing registry state", async function () {
      const { registry, reporter, stranger } = await deployContracts();
      await reportFoundItem(registry, reporter);
      await expect(registry.connect(stranger).submitClaim(1, "My wallet"))
        .to.be.revertedWith("User is not registered");
      expect(await registry.getClaimsForItem(1)).to.have.lengthOf(0);
      expect(await registry.getPendingClaimCount(1)).to.equal(0n);
      expect((await registry.getItemDetails(1)).status).to.equal(0n);
    });

    it("rejects unregistered handover confirmation even for an accepted claim", async function () {
      const { registry, reporter, claimant, stranger } = await deployContracts();
      await reportFoundItem(registry, reporter);
      await registry.connect(claimant).submitClaim(1, "My wallet");
      await registry.connect(reporter).acceptClaim(1);
      await expect(registry.connect(stranger).confirmHandover(1))
        .to.be.revertedWith("User is not registered");
      const claim = await registry.getClaimDetails(1);
      expect(claim.reporterConfirmed).to.equal(false);
      expect(claim.claimantConfirmed).to.equal(false);
      expect(claim.status).to.equal(1n);
      expect((await registry.getItemDetails(1)).status).to.equal(2n);
    });

    it("does not let a registered outsider confirm or pending parties bypass acceptance", async function () {
      const { identity, registry, reporter, claimant, stranger } = await deployContracts();
      await identity.connect(stranger).registerUser("Unrelated Staff", 1);
      await reportFoundItem(registry, reporter);
      await registry.connect(claimant).submitClaim(1, "My wallet");
      for (const party of [reporter, claimant]) {
        await expect(registry.connect(party).confirmHandover(1))
          .to.be.revertedWith("Claim has not been accepted");
      }
      await registry.connect(reporter).acceptClaim(1);
      await expect(registry.connect(stranger).confirmHandover(1))
        .to.be.revertedWith("Not a party to this claim");
      // Acceptance locks out close/reject/cancel shortcuts until handover is complete.
      await expect(registry.connect(reporter).closeItem(1))
        .to.be.revertedWith("Cannot close this item");
      await expect(registry.connect(reporter).rejectClaim(1))
        .to.be.revertedWith("Claim not pending");
      await expect(registry.connect(claimant).cancelClaim(1))
        .to.be.revertedWith("Claim not pending");
      expect((await registry.getItemDetails(1)).status).to.equal(2n);
    });
  });
});
