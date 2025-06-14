// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_3_0/FunctionsClient.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";
import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";

/**
 * @title ZKProofAggregator
 * @dev Main contract for aggregating ZK proofs with Chainlink services
 * @notice This contract enables trustless cross-chain state verification through ZK proof aggregation
 */
contract ZKProofAggregator is VRFConsumerBaseV2Plus, FunctionsClient, AutomationCompatibleInterface {
    using FunctionsRequest for FunctionsRequest.Request;

    // Events
    event ProofRequested(uint256 indexed requestId, address indexed requester, uint256 blockNumber);
    event ProofVerified(uint256 indexed requestId, bool isValid, bytes32 stateRoot);
    event RandomnessReceived(uint256 indexed requestId, uint256 randomValue, uint256 selectedBlock);
    event FunctionsRequestSent(bytes32 indexed requestId, string sourceChain, uint256 blockNumber);
    event FunctionsResponseReceived(bytes32 indexed requestId, bytes proof, bytes publicInputs);

    // Structs
    struct ProofRequest {
        address requester;
        uint256 timestamp;
        string sourceChain;
        uint256 blockNumber;
        bytes32 stateRoot;
        bool isCompleted;
        bool isValid;
    }

    struct ZKProof {
        uint256[2] a;
        uint256[2][2] b;
        uint256[2] c;
        uint256[] publicInputs;
    }

    // State variables
    mapping(uint256 => ProofRequest) public proofRequests;
    mapping(bytes32 => uint256) public functionsRequestToProofId;
    
    uint256 public requestCounter;
    uint256 public lastUpkeepTimestamp;
    uint256 public upkeepInterval = 3600; // 1 hour

    // Chainlink VRF Configuration
    uint256 private s_subscriptionId;
    bytes32 private s_keyHash;
    uint32 private s_callbackGasLimit = 2500000;
    uint16 private s_requestConfirmations = 3;
    uint32 private s_numWords = 1;

    // Chainlink Functions Configuration
    uint64 private s_functionsSubscriptionId;
    uint32 private s_functionsGasLimit = 300000;
    bytes32 private s_functionsDonId;
    
    // ZK Verification
    mapping(bytes32 => bool) public verifiedProofs;
    
    // Access control
    mapping(address => bool) public authorizedCallers;

    modifier onlyAuthorized() {
        require(authorizedCallers[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }

    constructor(
        address vrfCoordinator,
        address functionsRouter,
        uint256 vrfSubscriptionId,
        bytes32 vrfKeyHash,
        uint64 functionsSubscriptionId,
        bytes32 functionsDonId
    ) VRFConsumerBaseV2Plus(vrfCoordinator) FunctionsClient(functionsRouter) {
        s_subscriptionId = vrfSubscriptionId;
        s_keyHash = vrfKeyHash;
        s_functionsSubscriptionId = functionsSubscriptionId;
        s_functionsDonId = functionsDonId;
        authorizedCallers[msg.sender] = true;
        lastUpkeepTimestamp = block.timestamp;
    }

    /**
     * @dev Request proof verification for a specific chain state
     * @param sourceChain The identifier of the source blockchain
     * @param targetBlockNumber The block number to verify (0 for random selection)
     */
    function requestProofVerification(
        string memory sourceChain,
        uint256 targetBlockNumber
    ) external returns (uint256 requestId) {
        requestId = ++requestCounter;
        
        proofRequests[requestId] = ProofRequest({
            requester: msg.sender,
            timestamp: block.timestamp,
            sourceChain: sourceChain,
            blockNumber: targetBlockNumber,
            stateRoot: bytes32(0),
            isCompleted: false,
            isValid: false
        });

        // If no specific block is requested, use VRF to select randomly
        if (targetBlockNumber == 0) {
            _requestRandomBlock(requestId);
        } else {
            _requestProofGeneration(requestId, targetBlockNumber);
        }

        emit ProofRequested(requestId, msg.sender, targetBlockNumber);
        return requestId;
    }

    /**
     * @dev Internal function to request random block selection via VRF
     */
    function _requestRandomBlock(uint256 proofRequestId) internal {
        uint256 vrfRequestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: s_keyHash,
                subId: s_subscriptionId,
                requestConfirmations: s_requestConfirmations,
                callbackGasLimit: s_callbackGasLimit,
                numWords: s_numWords,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({nativePayment: false})
                )
            })
        );
        
        // Store mapping from VRF request to proof request
        functionsRequestToProofId[bytes32(vrfRequestId)] = proofRequestId;
    }

    /**
     * @dev Callback function for VRF randomness
     */
    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override {
        uint256 proofRequestId = functionsRequestToProofId[bytes32(requestId)];
        require(proofRequestId != 0, "Invalid VRF request");

        // Select block within last 1000 blocks (adjust as needed)
        uint256 selectedBlock = block.number - 1000 + (randomWords[0] % 1000);
        
        proofRequests[proofRequestId].blockNumber = selectedBlock;
        
        emit RandomnessReceived(requestId, randomWords[0], selectedBlock);
        
        // Now request proof generation for the selected block
        _requestProofGeneration(proofRequestId, selectedBlock);
    }

    /**
     * @dev Internal function to request proof generation via Chainlink Functions
     */
    function _requestProofGeneration(uint256 proofRequestId, uint256 blockNumber) internal {
        ProofRequest storage request = proofRequests[proofRequestId];
        
        // JavaScript source code for Chainlink Functions
        string memory source = string(abi.encodePacked(
            "const sourceChain = args[0];",
            "const blockNumber = parseInt(args[1]);",
            "// Fetch block data and generate ZK proof",
            "const blockData = await fetchBlockData(sourceChain, blockNumber);",
            "const proof = await generateZKProof(blockData);",
            "return Functions.encodeString(JSON.stringify({proof, publicInputs: blockData.stateRoot}));"
        ));

        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(source);
        
        string[] memory args = new string[](2);
        args[0] = request.sourceChain;
        args[1] = uint256ToString(blockNumber);
        req.setArgs(args);

        bytes32 functionsRequestId = _sendRequest(
            req.encodeCBOR(),
            s_functionsSubscriptionId,
            s_functionsGasLimit,
            s_functionsDonId
        );

        functionsRequestToProofId[functionsRequestId] = proofRequestId;
        
        emit FunctionsRequestSent(functionsRequestId, request.sourceChain, blockNumber);
    }

    /**
     * @dev Callback function for Chainlink Functions response
     */
    function _fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        uint256 proofRequestId = functionsRequestToProofId[requestId];
        require(proofRequestId != 0, "Invalid Functions request");

        if (err.length > 0) {
            // Handle error
            proofRequests[proofRequestId].isCompleted = true;
            return;
        }

        // Parse response to extract proof and public inputs
        (bytes memory proof, bytes memory publicInputs) = abi.decode(response, (bytes, bytes));
        
        emit FunctionsResponseReceived(requestId, proof, publicInputs);
        
        // Verify the ZK proof
        bool isValid = _verifyZKProof(proof, publicInputs);
        
        ProofRequest storage request = proofRequests[proofRequestId];
        request.isCompleted = true;
        request.isValid = isValid;
        request.stateRoot = bytes32(publicInputs);

        if (isValid) {
            verifiedProofs[bytes32(publicInputs)] = true;
        }

        emit ProofVerified(proofRequestId, isValid, bytes32(publicInputs));
    }

    /**
     * @dev Verify ZK proof on-chain
     * @notice This is a simplified verification - in practice, use generated Solidity verifier
     */
    function _verifyZKProof(bytes memory proof, bytes memory publicInputs) internal pure returns (bool) {
        // Placeholder for actual ZK proof verification
        // In a real implementation, this would call the generated Solidity verifier contract
        return proof.length > 0 && publicInputs.length > 0;
    }

    /**
     * @dev Chainlink Automation upkeep check
     */
    function checkUpkeep(bytes calldata) external view override returns (bool upkeepNeeded, bytes memory) {
        upkeepNeeded = (block.timestamp - lastUpkeepTimestamp) > upkeepInterval;
        return (upkeepNeeded, "");
    }

    /**
     * @dev Chainlink Automation upkeep perform
     */
    function performUpkeep(bytes calldata) external override {
        require((block.timestamp - lastUpkeepTimestamp) > upkeepInterval, "Upkeep not needed");
        
        lastUpkeepTimestamp = block.timestamp;
        
        // Trigger periodic proof verification
        this.requestProofVerification("ethereum", 0); // Random block on Ethereum
    }

    /**
     * @dev Check if a state root has been verified
     */
    function isStateVerified(bytes32 stateRoot) external view returns (bool) {
        return verifiedProofs[stateRoot];
    }

    /**
     * @dev Get proof request details
     */
    function getProofRequest(uint256 requestId) external view returns (ProofRequest memory) {
        return proofRequests[requestId];
    }

    /**
     * @dev Administrative functions
     */
    function setUpkeepInterval(uint256 newInterval) external onlyOwner {
        upkeepInterval = newInterval;
    }

    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        authorizedCallers[caller] = authorized;
    }

    function setVRFConfig(
        uint256 subscriptionId,
        bytes32 keyHash,
        uint32 callbackGasLimit
    ) external onlyOwner {
        s_subscriptionId = subscriptionId;
        s_keyHash = keyHash;
        s_callbackGasLimit = callbackGasLimit;
    }

    function setFunctionsConfig(
        uint64 subscriptionId,
        uint32 gasLimit,
        bytes32 donId
    ) external onlyOwner {
        s_functionsSubscriptionId = subscriptionId;
        s_functionsGasLimit = gasLimit;
        s_functionsDonId = donId;
    }

    /**
     * @dev Utility function to convert uint to string
     */
    function uint256ToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
} 