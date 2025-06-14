// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SimpleMocks
 * @dev Simple mock contracts for testing purposes
 */

contract MockVRFCoordinatorV2 {
    uint256 private currentRequestId = 1;
    mapping(uint256 => address) public requestToSender;
    
    struct RandomWordsRequest {
        bytes32 keyHash;
        uint256 subId;
        uint16 requestConfirmations;
        uint32 callbackGasLimit;
        uint32 numWords;
        bytes extraArgs;
    }
    
    event RandomWordsRequested(uint256 indexed requestId, address indexed requester);
    
    function requestRandomWords(RandomWordsRequest calldata req) external returns (uint256 requestId) {
        requestId = currentRequestId++;
        requestToSender[requestId] = msg.sender;
        emit RandomWordsRequested(requestId, msg.sender);
        return requestId;
    }
    
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) external {
        address consumer = requestToSender[requestId];
        require(consumer != address(0), "Invalid request ID");
        
        (bool success,) = consumer.call(
            abi.encodeWithSignature("rawFulfillRandomWords(uint256,uint256[])", requestId, randomWords)
        );
        require(success, "Callback failed");
    }
}

contract MockLinkToken {
    string public name = "ChainLink Token";
    string public symbol = "LINK";
    uint8 public decimals = 18;
    uint256 public totalSupply = 1000000000 * 10**18;
    
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    
    constructor() {
        balanceOf[msg.sender] = totalSupply;
    }
    
    function transfer(address to, uint256 value) external returns (bool) {
        require(balanceOf[msg.sender] >= value, "Insufficient balance");
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
        emit Transfer(msg.sender, to, value);
        return true;
    }
    
    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }
    
    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }
}

contract MockFunctionsRouter {
    mapping(bytes32 => address) public requestToSender;
    
    event RequestSent(bytes32 indexed requestId, address indexed requester);
    
    function sendRequest(
        uint64 subscriptionId,
        bytes calldata data,
        uint16 dataVersion,
        uint32 callbackGasLimit,
        bytes32 donId
    ) external returns (bytes32 requestId) {
        requestId = keccak256(abi.encodePacked(block.timestamp, msg.sender, data));
        requestToSender[requestId] = msg.sender;
        emit RequestSent(requestId, msg.sender);
        return requestId;
    }
    
    function fulfillRequest(bytes32 requestId, bytes memory response, bytes memory err) external {
        address consumer = requestToSender[requestId];
        require(consumer != address(0), "Invalid request ID");
        
        (bool success,) = consumer.call(
            abi.encodeWithSignature("handleOracleResponse(bytes32,bytes,bytes)", requestId, response, err)
        );
        require(success, "Callback failed");
    }
}

contract MockAutomationRegistry {
    struct UpkeepInfo {
        address target;
        uint32 executeGas;
        bytes checkData;
        bool paused;
    }
    
    mapping(uint256 => UpkeepInfo) public upkeeps;
    uint256 public nextUpkeepId = 1;
    
    event UpkeepRegistered(uint256 indexed id, address indexed target);
    
    function registerUpkeep(
        address target,
        uint32 gasLimit,
        address admin,
        bytes calldata checkData,
        bytes calldata offchainConfig
    ) external returns (uint256 id) {
        id = nextUpkeepId++;
        upkeeps[id] = UpkeepInfo({
            target: target,
            executeGas: gasLimit,
            checkData: checkData,
            paused: false
        });
        emit UpkeepRegistered(id, target);
        return id;
    }
    
    function performUpkeep(uint256 id, bytes calldata performData) external {
        UpkeepInfo storage upkeep = upkeeps[id];
        require(upkeep.target != address(0), "Upkeep not found");
        require(!upkeep.paused, "Upkeep paused");
        
        (bool success,) = upkeep.target.call(
            abi.encodeWithSignature("performUpkeep(bytes)", performData)
        );
        require(success, "Upkeep failed");
    }
}

contract MockCCIPRouter {
    mapping(bytes32 => uint64) public messageToChain;
    uint256 public nextMessageId = 1;
    
    event MessageSent(bytes32 indexed messageId, uint64 indexed destChainSelector);
    
    function getFee(
        uint64 destChainSelector,
        bytes memory message
    ) external pure returns (uint256 fee) {
        return 0.001 ether + (message.length * 1000);
    }
    
    function ccipSend(
        uint64 destChainSelector,
        bytes memory message
    ) external payable returns (bytes32 messageId) {
        messageId = keccak256(abi.encodePacked(block.timestamp, nextMessageId++, msg.sender));
        messageToChain[messageId] = destChainSelector;
        emit MessageSent(messageId, destChainSelector);
        return messageId;
    }
} 