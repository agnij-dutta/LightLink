import { NextResponse } from 'next/server';
import { CIRCUITS, isCircuitReady } from '../../../lib/zkProofUtils.js';

export async function GET(request) {
  try {
    return NextResponse.json({
      message: 'To set up the ZK proof service:',
      steps: [
        '1. Run npm run setup-groth16 to generate circuit artifacts',
        '2. Ensure all circuit files are present in the artifacts directory',
        '3. Restart the service'
      ],
      circuitStatus: Object.fromEntries(
        Object.entries(CIRCUITS).map(([name, _]) => [
          name,
          isCircuitReady(name)
        ])
      )
    });
  } catch (error) {
    console.error('Setup endpoint error:', error);
    return NextResponse.json(
      { 
        error: 'Setup endpoint failed',
        message: error.message 
      },
      { status: 500 }
    );
  }
} 