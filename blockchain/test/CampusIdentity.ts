
import { expect } from "chai";
import { network } from "hardhat";

describe("CampusIdentity", function () {
  async function deployCampusIdentity() {
    const { ethers } = await network.create();

    const campusIdentity = await ethers.deployContract("CampusIdentity");

    await campusIdentity.waitForDeployment();

    return { campusIdentity, ethers };
  }

  it("should allow a Student to register", async function () {
    const { campusIdentity, ethers } = await deployCampusIdentity();

    const [student] = await ethers.getSigners();

    await campusIdentity
      .connect(student)
      .registerUser("Alice", 0);

    const profile = await campusIdentity.getUserProfile(student.address);

    expect(profile.name).to.equal("Alice");
    expect(profile.role).to.equal(0n);
    expect(profile.registered).to.equal(true);
  });

  it("should allow a Staff member to register", async function () {
    const { campusIdentity, ethers } = await deployCampusIdentity();

    const [, staff] = await ethers.getSigners();

    await campusIdentity
      .connect(staff)
      .registerUser("Bob", 1);

    const profile = await campusIdentity.getUserProfile(staff.address);

    expect(profile.name).to.equal("Bob");
    expect(profile.role).to.equal(1n);
  });

  it("should prevent duplicate registration", async function () {
    const { campusIdentity, ethers } = await deployCampusIdentity();

    const [student] = await ethers.getSigners();

    await campusIdentity.registerUser("Alice", 0);

    await expect(
      campusIdentity
        .connect(student)
        .registerUser("Alice Again", 0)
    ).to.be.revertedWith("Already registered");
  });

  it("should prevent empty names", async function () {
    const { campusIdentity, ethers } = await deployCampusIdentity();

    await expect(
      campusIdentity.registerUser("", 0)
    ).to.be.revertedWith("Name cannot be empty");
  });

  it("should allow users to update their names", async function () {
    const { campusIdentity, ethers } = await deployCampusIdentity();

    await campusIdentity.registerUser("Alice", 0);
    await campusIdentity.updateUserProfile("Alice Updated");

    const [owner] = await ethers.getSigners();

    const profile = await campusIdentity.getUserProfile(owner.address);

    expect(profile.name).to.equal("Alice Updated");
  });

  it("should correctly count registered users", async function () {
    const { campusIdentity, ethers } = await deployCampusIdentity();

    const [, student, staff] = await ethers.getSigners();

    await campusIdentity.connect(student).registerUser("Alice", 0);
    await campusIdentity.connect(staff).registerUser("Bob", 1);

    expect(await campusIdentity.getUserCount()).to.equal(2n);
  });

  it("should identify registered and unregistered addresses", async function () {
    const { campusIdentity, ethers } = await deployCampusIdentity();

    const [student, unregistered] = await ethers.getSigners();

    await campusIdentity.connect(student).registerUser("Alice", 0);

    expect(await campusIdentity.isRegistered(student.address)).to.equal(true);
    expect(await campusIdentity.isRegistered(unregistered.address)).to.equal(false);
  });
});
