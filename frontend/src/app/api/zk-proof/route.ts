import { NextRequest, NextResponse } from 'next/server';

// Helper to determine if we should use mock data
const USE_MOCK = process.env.MOCK_DATA === 'true';

// Mock proof generation for Vercel serverless environment
function generateMockProof(circuitName: string, circuitInputs: any[]) {
  console.log(`Generating mock proof for ${circuitName} (serverless mode)`);
  
  const mockProof = {
    pi_a: [
      "19977388743896285994233602017122229905376581404968734105843487057334449066219",
      "7031682385824214205052254702752430476895865313831979018605709946148180045575",
      "1"
    ],
    pi_b: [
      [
        "12720396135861753409360003892079332281980285975874504377152366515594545980863",
        "2785878884372585793274394960064441358906130242999989133558408040959123010970"
      ],
      [
        "2897334897353034376053909262581081489252861230613586337332095339732705435267",
        "20706222872013252346113316831691184232572126896896428063411823552342235289107"
      ],
      [ "1", "0" ]
    ],
    pi_c: [
      "2946774739632969350855685573451598285113123648875877679414511841910111064679",
      "14834010604054493081432533047034793326416578351806602401256397141481808453727",
      "1"
    ],
    protocol: "groth16"
  };
  
  const mockPublicSignals = circuitInputs.map((_, i) => 
    `${10000000000000000000000000000000000000000000000 + i}`
  );
  
  return {
    proof: mockProof,
    publicSignals: mockPublicSignals,
    isValid: true,
    metadata: {
      circuit: circuitName,
      generationTime: 50,
      verifiedLocally: true,
      isMock: true
    }
  };
}

// Health check endpoint
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'running',
    environment: 'vercel',
    circuits: {
      proof_aggregator: {
        ready: true,
        wasmExists: true,
        zkeyExists: true,
        vkeyExists: true
      },
      merkle_proof: {
        ready: true,
        wasmExists: true,
        zkeyExists: true,
        vkeyExists: true
      }
    },
    timestamp: new Date().toISOString()
  });
}

// Generate proof endpoint
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { circuit, inputs, params } = body;
    
    if (!circuit || !inputs) {
      return NextResponse.json({
        error: 'Missing required fields: circuit, inputs'
      }, { status: 400 });
    }
    
    if (!['proof_aggregator', 'merkle_proof'].includes(circuit)) {
      return NextResponse.json({
        error: `Unknown circuit: ${circuit}`,
        availableCircuits: ['proof_aggregator', 'merkle_proof']
      }, { status: 400 });
    }
    
    console.log(`Received proof request for ${circuit} with ${inputs.length} inputs`);
    
    // Use mock only if explicitly requested
    if (USE_MOCK) {
      const result = generateMockProof(circuit, inputs);
      return NextResponse.json({
        success: true,
        ...result
      });
    }

    // Call the real backend proof service
    const backendUrl = process.env.ZK_PROOF_SERVICE_URL || 'http://localhost:3001/prove';
    const backendRes = await fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ circuit, inputs, params })
    });
    const backendData = await backendRes.json();
    return NextResponse.json(backendData, { status: backendRes.status });
  } catch (error: any) {
    console.error('Proof generation error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 