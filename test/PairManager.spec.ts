import { ethers } from 'hardhat';
import { PairManager } from '../typechain-types';
import { MerkleTree } from 'merkletreejs';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
const { keccak256 } = ethers.utils;
import * as _ from 'lodash';
import { expect } from 'chai';
describe('PairManager.spec', () => {
  let pairManagerContrct: PairManager;
  async function deployPairManagerFixture() {
    const Operations = await ethers.getContractFactory('Operations');
    // const MerkleMultiProof = await ethers.getContractFactory(
    //   'MerkleMultiProof',
    // );
    // const merkleMultiProof = await MerkleMultiProof.deploy();
    const operationsLib = await Operations.deploy();
    const PairManager = await ethers.getContractFactory('PairManager', {
      libraries: {
        Operations: operationsLib.address,
        // MerkleMultiProof: merkleMultiProof.address,
      },
    });

    pairManagerContrct = await PairManager.deploy();
  }
  before(deployPairManagerFixture);
  const pairList = [
    {
      sourceChain: 1,
      destChain: 7,
      sourceToken: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      destToken: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    },
    {
      sourceChain: 2,
      destChain: 7,
      sourceToken: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      destToken: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    },
    {
      sourceChain: 3,
      destChain: 7,
      sourceToken: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      destToken: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    },
  ];
  const leafs = pairList.map(pairToHash);
  const tree = new MerkleTree(leafs, keccak256, {
    sort: true,
  });
  console.log(`tree：\n`, tree.toString(), '\n');
  function pairToHash(pair: typeof pairList[0]) {
    return ethers.utils.solidityKeccak256(
      ['uint256', 'uint256', 'address', 'address'],
      [pair.sourceChain, pair.destChain, pair.sourceToken, pair.destToken],
    );
  }
  it('initialize Pair', async () => {
    const tx = await pairManagerContrct.initializePair(
      tree.getHexRoot(),
      pairList,
    );
    await expect(tx)
      .to.emit(pairManagerContrct, 'InitializePair')
      .withArgs(anyValue);
  });
  it('Verify root hash', async () => {
    expect(await pairManagerContrct.pairsHash()).to.equal(tree.getHexRoot());
  });

  it('Update root hash', async () => {
    const leafs = [pairToHash(pairList[0])];
    const allLeaves = tree.getLeaves();
    const leaves = leafs.map((row) => {
      return allLeaves[tree.getLeafIndex(<any>row)];
    });
    const proof = tree.getMultiProof(leaves);
    const proofFlags = tree.getProofFlags(leaves, proof);
    const newPair = [
      {
        sourceChain: 1,
        destChain: 6,
        sourceToken: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        destToken: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      },
    ];
    const result = await pairManagerContrct.updatePair(
      leafs,
      proof,
      proofFlags,
      <any>newPair,
    );
    await expect(result)
      .to.emit(pairManagerContrct, 'ChangePair')
      .withArgs('Update', anyValue);
  });
  it('Update After Verify RootHash', async () => {
    // new pair
    const newPairList = _.clone(pairList);
    newPairList[0] = {
      sourceChain: 1,
      destChain: 6,
      sourceToken: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      destToken: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    };
    const newTree = new MerkleTree(newPairList.map(pairToHash), keccak256, {
      sort: true,
    });
    expect(await pairManagerContrct.pairsHash()).to.equal(newTree.getHexRoot());
  });
  it('Add New Pair', async () => {
    // new pair
    const newPairList = _.clone(pairList);
    const newPair = [
      {
        sourceChain: 1,
        destChain: 13,
        sourceToken: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        destToken: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      },
    ];
    const newTree = new MerkleTree(newPairList.map(pairToHash), keccak256);
    newTree.addLeaves(<any>newPair.map(pairToHash));
    const localNewRoot = tree.getHexRoot();
    const result = await pairManagerContrct.createPair(
      localNewRoot,
      <any>newPair,
    );
    await expect(result)
      .to.emit(pairManagerContrct, 'ChangePair')
      .withArgs('Create', anyValue);
    expect(await pairManagerContrct.pairsHash()).to.equal(localNewRoot);
  });
});
//
