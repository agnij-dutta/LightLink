import { NextResponse } from 'next/server';
import fs from 'fs';
import { CIRCUITS, isCircuitReady } from '../../../lib/zkProofUtils.js';

export async function GET(request) {
  try {
    const circuitStatus = {};
    let allReady = true;
    
    // Check each circuit
    for (const [name, circuit] of Object.entries(CIRCUITS)) {
      const ready = isCircuitReady(name);
      circuitStatus[name] = {
        ready,
        wasmExists: fs.existsSync(circuit.wasmPath),
        zkeyExists: fs.existsSync(circuit.zkeyPath),
        paths: {
          wasm: circuit.wasmPath,
          zkey: circuit.zkeyPath
        }
      };
      if (!ready) allReady = false;
    }
    
    return NextResponse.json({
      status: allReady ? 'ready' : 'not_ready',
      message: allReady ? 'Service is ready' : 'Some circuits are not ready',
      circuits: circuitStatus,
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: 'Health check failed',
        error: error.message 
      },
      { status: 500 }
    );
  }
} 