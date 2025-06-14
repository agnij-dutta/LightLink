const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("ZKProofAggregator", function () {
  async function deployFixture() {
    const [owner, user, verifier] = await ethers.getSigners();

    // Deploy Mock Chainlink contracts
    const MockVRFCoordinator = await ethers.getContractFactory("MockVRFCoordinatorV2");
    const mockVRFCoordinator = await MockVRFCoordinator.deploy();
    await mockVRFCoordinator.waitForDeployment();

    const MockLinkToken = await ethers.getContractFactory("MockLinkToken");
    const mockLinkToken = await MockLinkToken.deploy();
    await mockLinkToken.waitForDeployment();

    const MockFunctionsRouter = await ethers.getContractFactory("MockFunctionsRouter");
    const mockFunctionsRouter = await MockFunctionsRouter.deploy();
    await mockFunctionsRouter.waitForDeployment();

    const MockAutomationRegistry = await ethers.getContractFactory("MockAutomationRegistry");
    const mockAutomationRegistry = await MockAutomationRegistry.deploy();
    await mockAutomationRegistry.waitForDeployment();

    // Deploy ZK Verifier
    const Groth16Verifier = await ethers.getContractFactory("Groth16Verifier");
    const groth16Verifier = await Groth16Verifier.deploy();
    await groth16Verifier.waitForDeployment();

    // Deploy main contract
    const ZKProofAggregator = await ethers.getContractFactory("ZKProofAggregator");
    const zkProofAggregator = await ZKProofAggregator.deploy(
      await mockVRFCoordinator.getAddress(), // vrfCoordinator
      await mockFunctionsRouter.getAddress(), // functionsRouter
      1, // vrfSubscriptionId
      "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c", // vrfKeyHash
      1, // functionsSubscriptionId
      "0x66756e2d657468657265756d2d73657075616e2d310000000000000000000000" // functionsDonId
    );
    await zkProofAggregator.waitForDeployment();

    return {
      zkProofAggregator,
      groth16Verifier,
      mockVRFCoordinator,
      mockLinkToken,
      mockFunctionsRouter,
      mockAutomationRegistry,
      owner,
      user,
      verifier
    };
  }

  describe("Deployment", function () {
    it("Should deploy with correct parameters", async function () {
      const { zkProofAggregator } = await loadFixture(deployFixture);
      
      // Check that the contract deployed successfully
      expect(await zkProofAggregator.getAddress()).to.be.properAddress;
    });

    it("Should set owner correctly", async function () {
      const { zkProofAggregator, owner } = await loadFixture(deployFixture);
      expect(await zkProofAggregator.owner()).to.equal(owner.address);
    });
  });

  describe("Proof Request Management", function () {
    it("Should request proof verification", async function () {
      const { zkProofAggregator, user } = await loadFixture(deployFixture);
      
      const sourceChain = "ethereum";
      const targetBlockNumber = 0; // 0 for random selection
      
      await expect(zkProofAggregator.connect(user).requestProofVerification(sourceChain, targetBlockNumber))
        .to.emit(zkProofAggregator, "ProofRequested");
      
      const requestId = 1;
      const request = await zkProofAggregator.getProofRequest(requestId);
      expect(request.requester).to.equal(user.address);
      expect(request.sourceChain).to.equal(sourceChain);
      expect(request.blockNumber).to.equal(targetBlockNumber);
    });

    it("Should handle specific block number requests", async function () {
      const { zkProofAggregator, user } = await loadFixture(deployFixture);
      
      const sourceChain = "ethereum";
      const targetBlockNumber = 123456;
      
      await expect(zkProofAggregator.connect(user).requestProofVerification(sourceChain, targetBlockNumber))
        .to.emit(zkProofAggregator, "ProofRequested");
      
      const requestId = 1;
      const request = await zkProofAggregator.getProofRequest(requestId);
      expect(request.requester).to.equal(user.address);
      expect(request.sourceChain).to.equal(sourceChain);
      expect(request.blockNumber).to.equal(targetBlockNumber);
    });
  });

  describe("State Verification", function () {
    it("Should check if state is verified", async function () {
      const { zkProofAggregator } = await loadFixture(deployFixture);
      
      const testStateRoot = ethers.keccak256(ethers.toUtf8Bytes("test_state"));
      const isVerified = await zkProofAggregator.isStateVerified(testStateRoot);
      
      expect(isVerified).to.be.false;
    });
  });

  describe("Configuration Management", function () {
    it("Should allow owner to set upkeep interval", async function () {
      const { zkProofAggregator, owner } = await loadFixture(deployFixture);
      
      const newInterval = 7200; // 2 hours
      await expect(zkProofAggregator.connect(owner).setUpkeepInterval(newInterval))
        .to.not.be.reverted;
    });

    it("Should allow owner to set authorized callers", async function () {
      const { zkProofAggregator, owner, user } = await loadFixture(deployFixture);
      
      await expect(zkProofAggregator.connect(owner).setAuthorizedCaller(user.address, true))
        .to.not.be.reverted;
    });
  });

  describe("Automation Integration", function () {
    it("Should check upkeep status", async function () {
      const { zkProofAggregator } = await loadFixture(deployFixture);
      
      const checkData = await zkProofAggregator.checkUpkeep("0x");
      expect(checkData.upkeepNeeded).to.be.false; // Initially false since upkeep was just initialized
    });

    it("Should perform upkeep", async function () {
      const { zkProofAggregator, owner } = await loadFixture(deployFixture);
      
      // Set upkeep interval to 0 to trigger upkeep
      await zkProofAggregator.connect(owner).setUpkeepInterval(0);
      
      await expect(zkProofAggregator.performUpkeep("0x"))
        .to.not.be.reverted;
    });
  });

  describe("Administrative Functions", function () {
    it("Should allow owner to set VRF configuration", async function () {
      const { zkProofAggregator, owner } = await loadFixture(deployFixture);
      
      await expect(zkProofAggregator.connect(owner).setVRFConfig(
        2, // subscriptionId
        "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c", // keyHash
        2500000 // callbackGasLimit
      )).to.not.be.reverted;
    });

    it("Should allow owner to set Functions configuration", async function () {
      const { zkProofAggregator, owner } = await loadFixture(deployFixture);
      
      await expect(zkProofAggregator.connect(owner).setFunctionsConfig(
        2, // subscriptionId
        300000, // gasLimit
        "0x66756e2d657468657265756d2d73657075616e2d310000000000000000000000" // donId
      )).to.not.be.reverted;
    });
  });

  describe("State Management", function () {
    it("Should track proof requests correctly", async function () {
      const { zkProofAggregator, user } = await loadFixture(deployFixture);
      
      const sourceChain = "ethereum";
      const targetBlockNumber = 500;
      
      await zkProofAggregator.connect(user).requestProofVerification(sourceChain, targetBlockNumber);
      
      const requestId = 1;
      const request = await zkProofAggregator.getProofRequest(requestId);
      expect(request.requester).to.equal(user.address);
      expect(request.sourceChain).to.equal(sourceChain);
      expect(request.blockNumber).to.equal(targetBlockNumber);
    });

    it("Should return valid proof request details", async function () {
      const { zkProofAggregator, user } = await loadFixture(deployFixture);
      
      const sourceChain = "ethereum";
      const targetBlockNumber = 123456;
      
      await zkProofAggregator.connect(user).requestProofVerification(sourceChain, targetBlockNumber);
      
      const requestId = 1;
      const request = await zkProofAggregator.getProofRequest(requestId);
      expect(request.requester).to.equal(user.address);
      expect(request.sourceChain).to.equal(sourceChain);
      expect(request.blockNumber).to.equal(targetBlockNumber);
      expect(request.isCompleted).to.be.false;
    });
  });

  describe("Multiple Chain Support", function () {
    it("Should support different source chains", async function () {
      const { zkProofAggregator, user } = await loadFixture(deployFixture);
      
      const chains = ["ethereum", "polygon", "arbitrum"];
      
      for (let i = 0; i < chains.length; i++) {
        await expect(zkProofAggregator.connect(user).requestProofVerification(chains[i], 1000 + i))
          .to.emit(zkProofAggregator, "ProofRequested");
        
        const request = await zkProofAggregator.getProofRequest(i + 1);
        expect(request.sourceChain).to.equal(chains[i]);
        expect(request.blockNumber).to.equal(1000 + i);
      }
    });
  });

  describe("Batch Operations", function () {
    it("Should handle multiple proof requests efficiently", async function () {
      const { zkProofAggregator, user } = await loadFixture(deployFixture);
      
      // Request multiple proofs in sequence
      const chains = ["ethereum", "polygon", "arbitrum", "avalanche", "bsc"];
      const requests = [];
      
      for (let i = 0; i < chains.length; i++) {
        const tx = await zkProofAggregator.connect(user).requestProofVerification(chains[i], 1000 + i);
        requests.push(tx);
      }
      
      // All requests should succeed
      expect(requests.length).to.equal(5);
      
      // Verify each request was stored correctly
      for (let i = 1; i <= chains.length; i++) {
        const request = await zkProofAggregator.getProofRequest(i);
        expect(request.sourceChain).to.equal(chains[i-1]);
        expect(request.blockNumber).to.equal(1000 + i - 1);
      }
    });
  });

  describe("Input Validation", function () {
    it("Should handle valid proof verification requests", async function () {
      const { zkProofAggregator, user } = await loadFixture(deployFixture);
      
      // Test various valid inputs
      await expect(zkProofAggregator.connect(user).requestProofVerification("ethereum", 0))
        .to.emit(zkProofAggregator, "ProofRequested");
      
      await expect(zkProofAggregator.connect(user).requestProofVerification("polygon", 1000))
        .to.emit(zkProofAggregator, "ProofRequested");
      
      await expect(zkProofAggregator.connect(user).requestProofVerification("arbitrum", 123456))
        .to.emit(zkProofAggregator, "ProofRequested");
    });
  });
}); 