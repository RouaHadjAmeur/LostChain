import {expect} from 'chai';
import {network} from 'hardhat';

describe('LostChain NFT and FT', function () {
 async function setup(){
  const {ethers}=await network.create();
  const [alice,bob,eve]=await ethers.getSigners();
  const identity=await ethers.deployContract('CampusIdentity');
  await identity.registerUser('Alice',0);
  await identity.connect(bob).registerUser('Bob',1);
  const registry=await ethers.deployContract('LostItemRegistry',[await identity.getAddress()]);
  return {ethers,identity,registry,alice,bob,eve};
 }
 it('mints one unique ERC721 membership per wallet with equal role permissions',async()=>{
  const {identity,alice,bob}=await setup();
  expect(await identity.supportsInterface('0x80ac58cd')).to.equal(true);
  expect(await identity.memberTokenId(alice.address)).to.equal(1n);
  expect(await identity.ownerOf(2)).to.equal(bob.address);
  expect(await identity.balanceOf(alice.address)).to.equal(1n);
  await expect(identity.registerUser('Duplicate',0)).to.be.revertedWith('Already registered');
 });
 it('prevents identity transfer even by an approved operator',async()=>{
  const {identity,alice,bob}=await setup();
  await identity.approve(bob.address,1);
  await expect(identity.connect(bob).transferFrom(alice.address,bob.address,1)).to.be.revertedWith('Identity is non-transferable');
  await expect(identity.transferFrom(alice.address,bob.address,1)).to.be.revertedWith('Identity is non-transferable');
  expect(await identity.ownerOf(1)).to.equal(alice.address);
 });
 it('mints FT only after both confirmations, once, and permits ERC20 transfers and allowances',async()=>{
  const {ethers,registry,alice,bob,eve}=await setup();
  await registry.reportFoundItem('Wallet','Accessories','Black','Library','');
  await registry.connect(bob).submitClaim(1,'Proof');
  await registry.acceptClaim(1);
  await registry.confirmHandover(1);
  expect(await registry.totalSupply()).to.equal(0n);
  await registry.connect(bob).confirmHandover(1);
  expect(await registry.balanceOf(alice.address)).to.equal(ethers.parseEther('10'));
  expect(await registry.totalSupply()).to.equal(ethers.parseEther('10'));
  await expect(registry.connect(bob).confirmHandover(1)).to.be.revertedWith('Claim has not been accepted');
  await registry.transfer(bob.address,ethers.parseEther('2'));
  await registry.connect(bob).approve(eve.address,ethers.parseEther('1'));
  await registry.connect(eve).transferFrom(bob.address,eve.address,ethers.parseEther('1'));
  expect(await registry.balanceOf(bob.address)).to.equal(ethers.parseEther('1'));
  expect(await registry.balanceOf(eve.address)).to.equal(ethers.parseEther('1'));
  expect(await registry.totalSupply()).to.equal(ethers.parseEther('10'));
 });
 it('issues no reward for rejected, cancelled or closed reports',async()=>{
  const {registry,bob}=await setup();
  await registry.reportFoundItem('Wallet','Accessories','Black','Library','');
  await registry.connect(bob).submitClaim(1,'Proof');
  await registry.rejectClaim(1);
  await registry.closeItem(1);
  await registry.reportFoundItem('Keys','Accessories','Silver','Library','');
  await registry.connect(bob).submitClaim(2,'Proof');
  await registry.connect(bob).cancelClaim(2);
  expect(await registry.totalSupply()).to.equal(0n);
 });
});
