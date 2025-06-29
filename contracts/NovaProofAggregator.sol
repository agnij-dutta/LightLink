// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ZKProofAggregator.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";

/**
 * @title NovaProofAggregator
 * @dev Enhanced ZK proof aggregator with Nova recursive proof capabilities
 * @notice This contract enables recursive proof composition for scalable verification
 */
contract NovaProofAggregator is ZKProofAggregator {
    using FunctionsRequest for FunctionsRequest.Request;
    
    // Events for Nova operations
    event NovaFoldingStarted(uint256 indexed batchId, uint256[] proofIds, address indexed requester);
    event NovaFoldingCompleted(uint256 indexed batchId, bytes32 aggregatedHash, bool isValid);
    event RecursiveProofGenerated(uint256 indexed batchId, uint256 recursionDepth, bytes recursiveProof);
    
    // Structs for Nova
    struct NovaInstance {
        uint256 stepIn;
        uint256 stepOut;
        uint256 programCounter;
        bytes32 stateRootIn;
        bytes32 stateRootOut;
        bytes32 nullifierHash;
        bool isValid;
    }
    
    struct RecursiveProofBatch {
        uint256[] proofIds;
        address requester;
        uint256 timestamp;
        uint256 recursionDepth;
        bytes32 aggregatedHash;
        NovaInstance foldedInstance;
        bool isCompleted;
        mapping(uint256 => bytes32) proofHashes;
        mapping(uint256 => uint256[4]) publicInputs;
    }
    
    // State variables for Nova
    mapping(uint256 => RecursiveProofBatch) public recursiveProofBatches;
    mapping(bytes32 => bool) public usedNullifiers; // Prevent double folding
    mapping(uint256 => uint256) public proofToBatch; // Map proof ID to batch ID
    
    uint256 public batchCounter;
    uint256 public maxRecursionDepth = 16;
    uint256 public minProofsPerBatch = 2;
    uint256 public maxProofsPerBatch = 8;
    
    // Nova circuit verifier (would be deployed separately)
    address public novaVerifier;
    
    // Reference to the base ZK proof aggregator contract for reading existing proofs
    ZKProofAggregator public immutable baseZKContract;
    
    modifier validBatch(uint256 batchId) {
        require(batchId > 0 && batchId <= batchCounter, "Invalid batch ID");
        _;
    }
    
    modifier onlyBatchRequester(uint256 batchId) {
        require(recursiveProofBatches[batchId].requester == msg.sender, "Not batch requester");
        _;
    }
    
    constructor(
        address vrfCoordinator,
        address functionsRouter,
        uint256 vrfSubscriptionId,
        bytes32 vrfKeyHash,
        uint64 functionsSubscriptionId,
        bytes32 functionsDonId,
        address groth16VerifierAddress,
        address _novaVerifier,
        address _baseZKContract
    ) ZKProofAggregator(
        vrfCoordinator,
        functionsRouter,
        vrfSubscriptionId,
        vrfKeyHash,
        functionsSubscriptionId,
        functionsDonId,
        groth16VerifierAddress
    ) {
        novaVerifier = _novaVerifier;
        baseZKContract = ZKProofAggregator(_baseZKContract);
    }
    
    /**
     * @dev Start Nova folding process for multiple proofs
     * @param proofIds Array of proof IDs to aggregate recursively
     * @return batchId Unique identifier for this folding batch
     */
    function startNovaFolding(uint256[] memory proofIds) 
        external 
        returns (uint256 batchId) 
    {
        require(
            proofIds.length >= minProofsPerBatch && proofIds.length <= maxProofsPerBatch, 
            "Invalid proof count"
        );
        
        // Verify all proofs exist and are completed (read from base ZK contract)
        for (uint256 i = 0; i < proofIds.length; i++) {
            // Get proof data from base ZK contract
            ProofRequest memory proof = baseZKContract.getProofRequest(proofIds[i]);
            
            require(proof.isCompleted, "Proof not completed");
            require(proof.isValid, "Invalid proof");
            require(proofToBatch[proofIds[i]] == 0, "Proof already in batch");
        }
        
        batchId = ++batchCounter;
        RecursiveProofBatch storage batch = recursiveProofBatches[batchId];
        
        batch.proofIds = proofIds;
        batch.requester = msg.sender;
        batch.timestamp = block.timestamp;
        batch.recursionDepth = 0;
        batch.isCompleted = false;
        
        // Store proof hashes and public inputs (read from base ZK contract)
        for (uint256 i = 0; i < proofIds.length; i++) {
            uint256 proofId = proofIds[i];
            proofToBatch[proofId] = batchId;
            
            // Get proof data from base ZK contract
            ProofRequest memory proof = baseZKContract.getProofRequest(proofId);
            
            // Generate proof hash from state root and block number
            batch.proofHashes[i] = keccak256(
                abi.encodePacked(
                    proof.stateRoot,
                    proof.blockNumber,
                    proof.sourceChain
                )
            );
            
            // Store public inputs (simplified for demo)
            batch.publicInputs[i] = [
                uint256(proof.stateRoot),
                proof.blockNumber,
                uint256(keccak256(bytes(proof.sourceChain))),
                block.timestamp
            ];
        }
        
        emit NovaFoldingStarted(batchId, proofIds, msg.sender);
        
        // Request recursive proof generation
        _requestRecursiveProofGeneration(batchId);
        
        return batchId;
    }
    
    /**
     * @dev Internal function to request recursive proof generation
     */
    function _requestRecursiveProofGeneration(uint256 batchId) internal {
        RecursiveProofBatch storage batch = recursiveProofBatches[batchId];
        
        // Enhanced JavaScript source for Nova folding
        string memory source = string(abi.encodePacked(
            "// Nova folding: compute deterministic aggregatedHash and return as string\n",
            "const batchId = BigInt(args[0]);\n",
            "const proofCount = BigInt(args[1]);\n",
            "const stepIn = BigInt(args[2]);\n",
            "// Simple deterministic 32-byte hex hash without ethers.js\n",
            "function simpleHash(str){let h1=0,h2=0;for(let i=0;i<str.length;i++){const ch=str.charCodeAt(i);h1=((h1<<5)-h1+ch)|0;h2=((h2<<3)+ch*7)|0;}const toHex=v=>((v>>>0).toString(16).padStart(8,'0'));return '0x'+toHex(h1)+toHex(h2)+toHex(h1^h2)+toHex((h1+h2)*13);}\n",
            "const aggregatedHash = simpleHash(batchId.toString()+','+proofCount.toString()+','+stepIn.toString());\n",
            "return Functions.encodeString(aggregatedHash);"
        ));

        // Use the parent contract's helper to send Functions request
        _sendNovaFunctionsRequest(batchId, source, batch.proofIds.length, batch.recursionDepth);
    }
    
    /**
     * @dev Helper function to send Nova Functions request
     */
    function _sendNovaFunctionsRequest(
        uint256 batchId,
        string memory source,
        uint256 proofCount,
        uint256 recursionDepth
    ) internal {
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(source);
        
        // Prepare arguments for Nova proof generation
        string[] memory args = new string[](3);
        args[0] = uint256ToString(batchId);
        args[1] = uint256ToString(proofCount);
        args[2] = uint256ToString(recursionDepth);
        req.setArgs(args);

        bytes32 functionsRequestId = _sendRequest(
            req.encodeCBOR(),
            s_functionsSubscriptionId,
            s_functionsGasLimit,
            s_functionsDonId
        );
        
        // Use batchId + 10000 to distinguish from regular proof requests
        functionsRequestToProofId[functionsRequestId] = batchId + 10000;
        
        emit FunctionsRequestSent(functionsRequestId, "nova-batch", batchId);
    }

    /**
     * @dev Override fulfillRequest to handle Nova operations
     */
    function _fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal virtual override {
        uint256 requestType = functionsRequestToProofId[requestId];
        
        if (requestType > 10000) { // Nova batch IDs
            uint256 batchId = requestType - 10000;
            _handleNovaResponse(batchId, response, err);
        } else {
            // Handle regular proof responses
            super._fulfillRequest(requestId, response, err);
        }
    }
    
    /**
     * @dev Continue recursive folding with additional depth
     * @param batchId The batch to continue folding
     */
    function continueRecursiveFolding(uint256 batchId) 
        external 
        validBatch(batchId)
        onlyBatchRequester(batchId)
    {
        RecursiveProofBatch storage batch = recursiveProofBatches[batchId];
        require(batch.isCompleted, "Previous folding not completed");
        require(batch.recursionDepth < maxRecursionDepth, "Max recursion depth reached");
        
        batch.recursionDepth++;
        batch.isCompleted = false; // Reset for next round
        _requestRecursiveProofGeneration(batchId);
    }
    
    /**
     * @dev Handle Nova proof generation response
     */
    function _handleNovaResponse(
        uint256 batchId, 
        bytes memory response, 
        bytes memory err
    ) internal {
        if (err.length > 0) {
            emit FunctionsRequestError(bytes32(batchId), err); // Using parent contract's event
            return;
        }
        
        RecursiveProofBatch storage batch = recursiveProofBatches[batchId];
        
        // Parse Nova response (simplified for demo)
        batch.aggregatedHash = keccak256(response);
        batch.isCompleted = true;
        
        // Create folded instance for next recursion
        batch.foldedInstance = NovaInstance({
            stepIn: batch.recursionDepth,
            stepOut: batch.recursionDepth + 1,
            programCounter: block.timestamp,
            stateRootIn: keccak256(abi.encodePacked(batch.proofIds)),
            stateRootOut: batch.aggregatedHash,
            nullifierHash: keccak256(abi.encodePacked(batchId, batch.requester)),
            isValid: true
        });
        
        emit NovaFoldingCompleted(batchId, batch.aggregatedHash, true);
        emit RecursiveProofGenerated(batchId, batch.recursionDepth, response);
    }
    
    /**
     * @dev Verify Nova recursive proof on-chain
     * @param batchId The batch ID to verify
     * @param proof The recursive proof to verify
     * @return isValid Whether the proof is valid
     */
    function verifyNovaProof(
        uint256 batchId, 
        bytes memory proof
    ) external view validBatch(batchId) returns (bool isValid) {
        RecursiveProofBatch storage batch = recursiveProofBatches[batchId];
        require(batch.isCompleted, "Batch not completed");
        
        // Simplified verification for demo
        bytes32 computedHash = keccak256(proof);
        return computedHash == batch.aggregatedHash;
    }
    
    /**
     * @dev Get recursive proof batch details
     */
    function getRecursiveProofBatch(uint256 batchId) 
        external 
        view 
        validBatch(batchId) 
        returns (
            uint256[] memory proofIds,
            address requester,
            uint256 timestamp,
            uint256 recursionDepth,
            bytes32 aggregatedHash,
            bool isCompleted
        ) 
    {
        RecursiveProofBatch storage batch = recursiveProofBatches[batchId];
        return (
            batch.proofIds,
            batch.requester,
            batch.timestamp,
            batch.recursionDepth,
            batch.aggregatedHash,
            batch.isCompleted
        );
    }
    
    /**
     * @dev Get folded instance for a batch
     */
    function getFoldedInstance(uint256 batchId) 
        external 
        view 
        validBatch(batchId) 
        returns (NovaInstance memory) 
    {
        return recursiveProofBatches[batchId].foldedInstance;
    }
    
    /**
     * @dev Admin function to update recursion parameters
     */
    function updateRecursionParams(
        uint256 _maxRecursionDepth,
        uint256 _minProofsPerBatch,
        uint256 _maxProofsPerBatch
    ) external onlyContractOwner {
        require(_maxRecursionDepth > 0 && _maxRecursionDepth <= 32, "Invalid max depth");
        require(_minProofsPerBatch >= 2 && _minProofsPerBatch <= _maxProofsPerBatch, "Invalid batch sizes");
        
        maxRecursionDepth = _maxRecursionDepth;
        minProofsPerBatch = _minProofsPerBatch;
        maxProofsPerBatch = _maxProofsPerBatch;
    }
} 