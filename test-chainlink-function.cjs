#!/usr/bin/env node

// Test script for optimized ZK Proof Generation Chainlink Function
// This simulates the Chainlink Functions runtime environment with size limits

// Simple HTTP server for mocking proof service responses
const http = require('http');

// Start a mock proof service that returns proper proof format
function startMockProofService() {
  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/prove') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          console.log(`Mock proof service received request for circuit: ${data.circuit}`);
          
          // Return proper proof format
          const response = {
            success: true,
            proof: {
              pi_a: ["1", "2", "1"],
              pi_b: [["3", "4"], ["5", "6"], ["1", "0"]],
              pi_c: ["7", "8", "1"],
              protocol: "groth16"
            },
            publicSignals: ["100", "200", "300", "400"],
            isValid: true,
            proofId: "mock123",
            metadata: {
              circuit: data.circuit,
              generationTime: 100,
              verifiedLocally: true,
              isMock: true
            }
          };
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  
  server.listen(3001, () => {
    console.log('🔧 Mock proof service started on http://localhost:3001');
  });
  
  return server;
}

// Mock Chainlink Functions environment
global.Functions = {
  makeHttpRequest: async (config) => {
    const https = require('https');
    const http = require('http');
    const url = require('url');
    
    return new Promise((resolve, reject) => {
      const parsedUrl = url.parse(config.url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;
      
      const requestData = JSON.stringify(config.data);
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.path,
        method: config.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestData),
          ...config.headers
        },
        timeout: config.timeout || 30000
      };

      const req = protocol.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const response = {
              status: res.statusCode,
              data: JSON.parse(data)
            };
            resolve(response);
          } catch (error) {
            resolve({ data: data, status: res.statusCode });
          }
        });
      });

      req.on('error', (error) => {
        resolve({ error: error.message });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ error: 'Request timeout' });
      });

      if (requestData && config.method === 'POST') {
        req.write(requestData);
      }
      
      req.end();
    });
  },

  encodeString: (str) => {
    return Buffer.from(str, 'utf8').toString('hex');
  },

  keccak256: (data) => {
    const crypto = require('crypto');
    return '0x' + crypto.createHash('sha256').update(data).digest('hex');
  }
};

async function testChainlinkFunction() {
  console.log('🧪 Testing Optimized ZK Proof Generation Function\n');

  // Start mock proof service
  const mockServer = startMockProofService();

  // Test cases with focus on external proof generation
  const testCases = [
    {
      name: "Optimism Block 50000 with Working Mock Proof Service",
      args: [
        "10",        // Optimism chain ID
        "[50000]",   // Block numbers
        "8",         // Merkle depth
        "43113",     // Avalanche Fuji target chain
        "http://localhost:3001/prove" // Local mock service
      ]
    },
    {
      name: "Optimism Block 50000 with External Proof Service",
      args: [
        "10",        // Optimism chain ID
        "[50000]",   // Block numbers
        "8",         // Merkle depth
        "43113",     // Avalanche Fuji target chain
        "https://light-link.vercel.app/api/prove" // Real external service
      ]
    },
    {
      name: "Multiple Blocks with Mock Service",
      args: [
        "10",        // Optimism chain ID
        "[50000,50001]", // Multiple blocks
        "8",         // Merkle depth
        "43113",     // Avalanche Fuji target chain
        "http://localhost:3001/prove" // Local mock service
      ]
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n📋 Test: ${testCase.name}`);
    console.log(`   Args: ${JSON.stringify(testCase.args)}`);

    try {
      // Set up test environment
      global.args = testCase.args;
      
      // Load and execute the function
      const fs = require('fs');
      const functionCode = fs.readFileSync('scripts/functions/zkProofGeneration.js', 'utf8');
      
      // Remove the first line (comment) and execute
      const codeToExecute = functionCode.split('\n').slice(1).join('\n');
      
      console.log('   ⏳ Executing function...');
      const startTime = Date.now();
      
      const result = await eval(`(async () => { ${codeToExecute} })()`);
      
      const executionTime = Date.now() - startTime;
      console.log(`   ⏱️  Execution time: ${executionTime}ms`);

      if (result) {
        // Decode the result
        const hexResult = result.toString();
        const decodedResult = Buffer.from(hexResult, 'hex').toString('utf8');
        const parsedResult = JSON.parse(decodedResult);
        
        console.log(`   📏 Response size: ${decodedResult.length} bytes`);
        console.log(`   📋 Decoded result:`, parsedResult);
        
        // Check size limit (256 bytes for Chainlink Functions)
        if (decodedResult.length > 256) {
          console.log(`   ❌ FAIL: Response exceeds 256-byte limit (${decodedResult.length} bytes)`);
        } else {
          console.log(`   ✅ PASS: Response within 256-byte limit`);
        }
        
        // Check if it's a success
        if (parsedResult.s === true) {
          console.log(`   ✅ SUCCESS: External proof generation completed`);
          console.log(`   🆔 Proof ID: ${parsedResult.pid}`);
          console.log(`   🔗 Chain: ${parsedResult.cid} → ${parsedResult.tcid}`);
          console.log(`   📦 Block: ${parsedResult.bn}`);
        } else {
          console.log(`   ❌ FAIL: ${parsedResult.e || 'Unknown error'}`);
        }
        
      } else {
        console.log(`   ❌ FAIL: No result returned`);
      }

    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      if (error.stack) {
        console.log(`   📚 Stack trace: ${error.stack.split('\n')[1]?.trim()}`);
      }
    }
  }

  // Clean up
  mockServer.close();
  console.log('\n🏁 Testing completed!');
  console.log('\n📝 Notes:');
  console.log('   - Response must be under 256 bytes for Chainlink Functions');
  console.log('   - Full proof data is logged separately for external retrieval');
  console.log('   - External proof service integration is key for real ZK proofs');
  console.log('   - Check Chainlink Functions logs for "PROOF_DATA:" entries');
  console.log('   - Fixed circuit input format for proof_aggregator compatibility');
}

// Run the test
testChainlinkFunction().catch(console.error); 