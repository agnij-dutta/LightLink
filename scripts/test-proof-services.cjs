#!/usr/bin/env node

const axios = require('axios');

async function testProofService(name, url) {
  console.log(`\n🔍 Testing ${name} at ${url}`);
  
  const testRequest = {
    circuit: "proof_aggregator",
    inputs: [{
      proofs: [["1", "2", "3", "4", "5", "6", "7", "8"]],
      publicSignals: [["100", "200", "300", "400"]],
      merkleRoots: ["12345"],
      blockHashes: ["67890"],
      chainIds: ["1"],
      aggregationSeed: "999",
      targetChainId: "43113"
    }],
    params: {
      nProofs: 1,
      merkleDepth: 8,
      blockDepth: 8
    }
  };
  
  try {
    console.log(`📤 Sending test request...`);
    const response = await axios.post(url, testRequest, {
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      timeout: 30000
    });
    
    console.log(`📥 Response status: ${response.status}`);
    
    const data = response.data;
    console.log(`✅ ${name} is working!`);
    console.log(`Response: ${data.success ? 'SUCCESS' : 'ERROR'}`);
    
    if (data.success) {
      console.log(`- Proof generated: ${!!data.proof}`);
      console.log(`- Public signals: ${!!data.publicSignals}`);
      console.log(`- Metadata: ${JSON.stringify(data.metadata || {})}`);
    } else if (data.error) {
      console.log(`- Error: ${data.error}`);
    }
    
    return true;
    
  } catch (error) {
    if (error.response) {
      console.log(`❌ ${name} returned error status: ${error.response.status}`);
      console.log(`Response: ${JSON.stringify(error.response.data).slice(0, 300)}...`);
    } else {
      console.log(`❌ ${name} failed: ${error.message}`);
    }
    return false;
  }
}

async function testHealthEndpoint(name, url) {
  console.log(`🏥 Testing health endpoint for ${name}`);
  
  try {
    const response = await axios.get(url, {
      timeout: 10000
    });
    
    const data = response.data;
    console.log(`✅ ${name} health check passed`);
    console.log(`Status: ${data.status || 'unknown'}`);
    console.log(`Circuits: ${Object.keys(data.circuits || {}).join(', ') || 'none'}`);
    return true;
  } catch (error) {
    if (error.response) {
      console.log(`❌ ${name} health check failed: ${error.response.status}`);
    } else {
      console.log(`❌ ${name} health check error: ${error.message}`);
    }
    return false;
  }
}

async function main() {
  console.log("🧪 Testing Proof Services\n");
  console.log("=".repeat(50));
  
  const services = [
    {
      name: "Vercel External Service",
      url: "https://light-link.vercel.app/api/prove",
      healthUrl: "https://light-link.vercel.app/api/health"
    },
    {
      name: "Local Backend Service",
      url: "http://localhost:3000/api/prove",
      healthUrl: "http://localhost:3000/api/health"
    }
  ];
  
  const results = [];
  
  for (const service of services) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔧 Testing ${service.name}`);
    console.log(`${'='.repeat(60)}`);
    
    // Test health endpoint first
    const health = await testHealthEndpoint(service.name, service.healthUrl);
    
    // Test proof generation
    const proof = await testProofService(service.name, service.url);
    
    results.push({
      name: service.name,
      url: service.url,
      health,
      proof,
      working: health || proof
    });
  }
  
  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log("📊 SUMMARY");
  console.log(`${'='.repeat(60)}`);
  
  let workingServices = 0;
  
  for (const result of results) {
    const status = result.working ? '✅ WORKING' : '❌ FAILED';
    console.log(`${result.name}: ${status}`);
    
    if (result.working) {
      workingServices++;
      console.log(`  URL: ${result.url}`);
    }
  }
  
  console.log(`\n📈 Working services: ${workingServices}/${results.length}`);
  
  if (workingServices === 0) {
    console.log("\n❌ No proof services are working!");
    console.log("\n💡 Troubleshooting steps:");
    console.log("1. Start your local backend: cd backend && npm run dev");
    console.log("2. Check if Vercel deployment is up: https://light-link.vercel.app/api/health");
    console.log("3. Ensure ZK circuits are compiled: npm run setup-zk");
    console.log("4. Check firewall/network settings");
  } else {
    console.log("\n✅ At least one proof service is working!");
    console.log("\n💡 Next steps:");
    console.log("1. Run the debug script: node scripts/debug-proof-service.cjs");
    console.log("2. Test a proof request to your contract");
    console.log("3. Monitor Chainlink Functions logs for external service calls");
  }
}

main().catch(console.error); 