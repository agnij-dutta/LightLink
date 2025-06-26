import { NextResponse } from 'next/server';
import { CIRCUITS, generateProof } from '../../../lib/zkProofUtils.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const { circuit, inputs, params } = body;
    
    if (!circuit || !inputs) {
      return NextResponse.json(
        {
          error: 'Missing required fields: circuit, inputs'
        },
        { status: 400 }
      );
    }
    
    if (!CIRCUITS[circuit]) {
      return NextResponse.json(
        {
          error: `Unknown circuit: ${circuit}`,
          availableCircuits: Object.keys(CIRCUITS)
        },
        { status: 400 }
      );
    }
    
    console.log(`Received proof request for ${circuit} with ${inputs.length} inputs`);
    
    const result = await generateProof(circuit, inputs, params);
    
    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Proof generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}

// Handle CORS preflight requests
export async function OPTIONS(request) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
} 