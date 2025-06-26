import { NextResponse } from 'next/server';
import { CIRCUITS } from '../../../lib/zkProofUtils.js';

export async function POST(request) {
  try {
    return NextResponse.json({
      success: true,
      message: 'ZK Proof Service is working correctly',
      timestamp: new Date().toISOString(),
      serviceStatus: 'ready',
      availableCircuits: Object.keys(CIRCUITS)
    });
  } catch (error) {
    console.error('Test endpoint error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Test endpoint failed',
        message: error.message 
      },
      { status: 500 }
    );
  }
} 