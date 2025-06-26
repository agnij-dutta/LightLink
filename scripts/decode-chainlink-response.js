#!/usr/bin/env node

/**
 * Chainlink Functions Response Decoder
 * 
 * This script decodes the compact responses returned by the ZK proof Chainlink Functions
 * to make them human-readable for debugging and testing purposes.
 */

function decodeChainlinkResponse(encodedResponse) {
  try {
    // Decode from hex if needed
    let jsonString;
    if (encodedResponse.startsWith('0x')) {
      jsonString = Buffer.from(encodedResponse.slice(2), 'hex').toString('utf8');
    } else {
      jsonString = encodedResponse;
    }
    
    console.log('Raw JSON response:', jsonString);
    
    const compactData = JSON.parse(jsonString);
    
    // Decode compact format
    const decoded = {
      success: compactData.s,
      chainId: compactData.c,
      targetChainId: compactData.t,
      blockCount: compactData.b,
      validityHash: compactData.h,
      hasProof: compactData.p === 1,
      timestamp: compactData.ts,
      timestampReadable: new Date(compactData.ts * 1000).toISOString(),
      error: compactData.e || null
    };
    
    console.log('\n📋 Decoded Response:');
    console.log('═'.repeat(50));
    console.log(`Success: ${decoded.success ? '✅ YES' : '❌ NO'}`);
    console.log(`Source Chain ID: ${decoded.chainId}`);
    console.log(`Target Chain ID: ${decoded.targetChainId}`);
    
    if (decoded.success) {
      console.log(`Blocks Processed: ${decoded.blockCount}`);
      console.log(`Validity Hash: ${decoded.validityHash}`);
      console.log(`Has ZK Proof: ${decoded.hasProof ? '✅ YES' : '❌ NO'}`);
    } else {
      console.log(`Error: ${decoded.error}`);
    }
    
    console.log(`Timestamp: ${decoded.timestampReadable}`);
    console.log('═'.repeat(50));
    
    return decoded;
    
  } catch (error) {
    console.error('❌ Failed to decode response:', error.message);
    console.error('Input was:', encodedResponse);
    return null;
  }
}

// Command line usage
if (require.main === module) {
  const input = process.argv[2];
  if (!input) {
    console.log('Usage: node decode-chainlink-response.js <encoded_response>');
    console.log('\nExample success response:');
    decodeChainlinkResponse('{"s":true,"c":1,"t":43114,"b":1,"h":"0x1234567890abcdef","p":1,"ts":1750929332}');
    
    console.log('\nExample error response:');
    decodeChainlinkResponse('{"s":false,"e":"Block 18500 is too old","c":1,"t":43114,"ts":1750929332}');
  } else {
    decodeChainlinkResponse(input);
  }
}

module.exports = { decodeChainlinkResponse }; 