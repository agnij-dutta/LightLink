// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IRouterClient} from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {CCIPReceiver} from "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";
import {IERC20} from "@chainlink/contracts/src/v0.8/vendor/openzeppelin-solidity/v4.8.3/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@chainlink/contracts/src/v0.8/vendor/openzeppelin-solidity/v4.8.3/contracts/token/ERC20/utils/SafeERC20.sol";

interface IZKProofAggregator {
    function isStateVerified(bytes32 stateRoot) external view returns (bool);
    function requestProofVerification(string memory sourceChain, uint256 targetBlockNumber) external returns (uint256);
}

/**
 * @title CrossChainVerifier
 * @dev Handles cross-chain proof verification using Chainlink CCIP
 * @notice This contract enables sending and receiving ZK proofs across different blockchains
 */
contract CrossChainVerifier is CCIPReceiver {
    using SafeERC20 for IERC20;

    // Events
    event ProofSentCrossChain(
        bytes32 indexed messageId,
        uint64 indexed destinationChainSelector,
        address indexed receiver,
        bytes32 stateRoot,
        uint256 feesPaid
    );
    
    event ProofReceivedCrossChain(
        bytes32 indexed messageId,
        uint64 indexed sourceChainSelector,
        address indexed sender,
        bytes32 stateRoot
    );
    
    event StateRootVerified(bytes32 indexed stateRoot, uint64 sourceChain, bool isValid);

    // Structs
    struct CrossChainProof {
        bytes32 stateRoot;
        uint256 blockNumber;
        string sourceChain;
        bytes zkProof;
        bytes publicInputs;
        uint256 timestamp;
    }

    // State variables
    IRouterClient private s_router;
    IERC20 private s_linkToken;
    IZKProofAggregator private s_zkAggregator;
    
    mapping(uint64 => bool) public allowlistedDestinationChains;
    mapping(uint64 => bool) public allowlistedSourceChains;
    mapping(address => bool) public allowlistedSenders;
    mapping(bytes32 => CrossChainProof) public receivedProofs;
    mapping(bytes32 => bool) public verifiedCrossChainStates;
    
    address public owner;
    uint256 public gasLimit = 500000;

    // Errors
    error NotEnoughBalance(uint256 currentBalance, uint256 calculatedFees);
    error NothingToWithdraw();
    error FailedToWithdrawEth(address owner, address target, uint256 value);
    error DestinationChainNotAllowlisted(uint64 destinationChainSelector);
    error SourceChainNotAllowlisted(uint64 sourceChainSelector);
    error SenderNotAllowlisted(address sender);
    error InvalidProofData();

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    modifier onlyAllowlistedDestinationChain(uint64 _destinationChainSelector) {
        if (!allowlistedDestinationChains[_destinationChainSelector])
            revert DestinationChainNotAllowlisted(_destinationChainSelector);
        _;
    }

    modifier onlyAllowlisted(uint64 _sourceChainSelector, address _sender) {
        if (!allowlistedSourceChains[_sourceChainSelector]) 
            revert SourceChainNotAllowlisted(_sourceChainSelector);
        if (!allowlistedSenders[_sender]) 
            revert SenderNotAllowlisted(_sender);
        _;
    }

    constructor(
        address _router,
        address _link,
        address _zkAggregator
    ) CCIPReceiver(_router) {
        owner = msg.sender;
        s_router = IRouterClient(_router);
        s_linkToken = IERC20(_link);
        s_zkAggregator = IZKProofAggregator(_zkAggregator);
    }

    /**
     * @dev Send ZK proof to another chain via CCIP
     * @param destinationChainSelector The chain selector of the destination chain
     * @param receiver The address to receive the proof on the destination chain
     * @param stateRoot The state root being proven
     * @param zkProof The ZK proof data
     * @param publicInputs The public inputs for the proof
     */
    function sendProofCrossChain(
        uint64 destinationChainSelector,
        address receiver,
        bytes32 stateRoot,
        bytes memory zkProof,
        bytes memory publicInputs,
        uint256 blockNumber,
        string memory sourceChain
    ) external onlyAllowlistedDestinationChain(destinationChainSelector) returns (bytes32 messageId) {
        // Verify that the proof exists locally first
        require(s_zkAggregator.isStateVerified(stateRoot), "State not verified locally");

        // Encode the proof data
        CrossChainProof memory proof = CrossChainProof({
            stateRoot: stateRoot,
            blockNumber: blockNumber,
            sourceChain: sourceChain,
            zkProof: zkProof,
            publicInputs: publicInputs,
            timestamp: block.timestamp
        });

        bytes memory data = abi.encode(proof);

        // Build CCIP message
        Client.EVM2AnyMessage memory evm2AnyMessage = Client.EVM2AnyMessage({
            receiver: abi.encode(receiver),
            data: data,
            tokenAmounts: new Client.EVMTokenAmount[](0), // No tokens
            extraArgs: Client._argsToBytes(
                Client.EVMExtraArgsV1({gasLimit: gasLimit})
            ),
            feeToken: address(s_linkToken)
        });

        // Calculate fees
        uint256 fees = s_router.getFee(destinationChainSelector, evm2AnyMessage);

        if (fees > s_linkToken.balanceOf(address(this)))
            revert NotEnoughBalance(s_linkToken.balanceOf(address(this)), fees);

        // Approve and send
        s_linkToken.approve(address(s_router), fees);
        messageId = s_router.ccipSend(destinationChainSelector, evm2AnyMessage);

        emit ProofSentCrossChain(
            messageId,
            destinationChainSelector,
            receiver,
            stateRoot,
            fees
        );

        return messageId;
    }

    /**
     * @dev Receive and process cross-chain proof via CCIP
     */
    function _ccipReceive(
        Client.Any2EVMMessage memory any2EvmMessage
    ) internal override onlyAllowlisted(
        any2EvmMessage.sourceChainSelector,
        abi.decode(any2EvmMessage.sender, (address))
    ) {
        // Decode the received proof
        CrossChainProof memory proof = abi.decode(any2EvmMessage.data, (CrossChainProof));
        
        if (proof.stateRoot == bytes32(0) || proof.zkProof.length == 0) {
            revert InvalidProofData();
        }

        // Store the received proof
        bytes32 proofId = keccak256(abi.encodePacked(
            proof.stateRoot,
            proof.blockNumber,
            proof.sourceChain
        ));
        
        receivedProofs[proofId] = proof;

        // Verify the cross-chain proof
        bool isValid = _verifyCrossChainProof(proof);
        
        if (isValid) {
            verifiedCrossChainStates[proof.stateRoot] = true;
        }

        emit ProofReceivedCrossChain(
            any2EvmMessage.messageId,
            any2EvmMessage.sourceChainSelector,
            abi.decode(any2EvmMessage.sender, (address)),
            proof.stateRoot
        );

        emit StateRootVerified(proof.stateRoot, any2EvmMessage.sourceChainSelector, isValid);
    }

    /**
     * @dev Verify a cross-chain ZK proof
     * @param proof The proof data to verify
     */
    function _verifyCrossChainProof(CrossChainProof memory proof) internal pure returns (bool) {
        // Simplified verification logic
        // In practice, this would call the appropriate ZK verifier contract
        return proof.zkProof.length > 0 && 
               proof.publicInputs.length > 0 && 
               proof.stateRoot != bytes32(0);
    }

    /**
     * @dev Request proof verification for a cross-chain state
     * @param sourceChain The source blockchain identifier
     * @param blockNumber The block number to verify
     */
    function requestCrossChainVerification(
        string memory sourceChain,
        uint256 blockNumber
    ) external returns (uint256 requestId) {
        return s_zkAggregator.requestProofVerification(sourceChain, blockNumber);
    }

    /**
     * @dev Check if a cross-chain state has been verified
     * @param stateRoot The state root to check
     */
    function isCrossChainStateVerified(bytes32 stateRoot) external view returns (bool) {
        return verifiedCrossChainStates[stateRoot];
    }

    /**
     * @dev Get received proof details
     * @param proofId The proof identifier
     */
    function getReceivedProof(bytes32 proofId) external view returns (CrossChainProof memory) {
        return receivedProofs[proofId];
    }

    /**
     * @dev Administrative functions
     */
    function allowlistDestinationChain(
        uint64 _destinationChainSelector,
        bool allowed
    ) external onlyOwner {
        allowlistedDestinationChains[_destinationChainSelector] = allowed;
    }

    function allowlistSourceChain(
        uint64 _sourceChainSelector,
        bool allowed
    ) external onlyOwner {
        allowlistedSourceChains[_sourceChainSelector] = allowed;
    }

    function allowlistSender(address _sender, bool allowed) external onlyOwner {
        allowlistedSenders[_sender] = allowed;
    }

    function setGasLimit(uint256 _gasLimit) external onlyOwner {
        gasLimit = _gasLimit;
    }

    function setZKAggregator(address _zkAggregator) external onlyOwner {
        s_zkAggregator = IZKProofAggregator(_zkAggregator);
    }

    /**
     * @dev Withdraw functions
     */
    function withdraw(address _beneficiary) public onlyOwner {
        uint256 amount = address(this).balance;
        if (amount == 0) revert NothingToWithdraw();
        
        (bool sent, ) = _beneficiary.call{value: amount}("");
        if (!sent) revert FailedToWithdrawEth(msg.sender, _beneficiary, amount);
    }

    function withdrawToken(
        address _beneficiary,
        address _token
    ) public onlyOwner {
        uint256 amount = IERC20(_token).balanceOf(address(this));
        if (amount == 0) revert NothingToWithdraw();
        
        IERC20(_token).safeTransfer(_beneficiary, amount);
    }

    /**
     * @dev Get estimated fees for cross-chain message (DISABLED - CCIP not available)
     */
    /*
    function getEstimatedFees(
        uint64 destinationChainSelector,
        address receiver,
        bytes memory data
    ) external view returns (uint256 fees) {
        Client.EVM2AnyMessage memory evm2AnyMessage = Client.EVM2AnyMessage({
            receiver: abi.encode(receiver),
            data: data,
            tokenAmounts: new Client.EVMTokenAmount[](0),
            extraArgs: Client._argsToBytes(
                Client.EVMExtraArgsV1({gasLimit: gasLimit})
            ),
            feeToken: address(s_linkToken)
        });

        return s_router.getFee(destinationChainSelector, evm2AnyMessage);
    }
    */

    receive() external payable {}
} 