# LightLink ZK Proof Service Backend

A Next.js API-only backend service for generating ZK proofs using Groth16 and snarkjs.

## Features

- **ZK Proof Generation**: Real Groth16 proof generation using circuit artifacts
- **Health Monitoring**: Circuit status and readiness checks
- **CORS Support**: Cross-origin requests enabled
- **Error Handling**: Comprehensive error responses
- **Multiple Circuits**: Support for proof aggregation and merkle proof circuits

## Quick Start

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Production build
npm run build
npm start
```

The service runs on port **10000** by default.

## API Endpoints

### GET /api/health
Check service and circuit status.

```bash
curl http://localhost:10000/api/health
```

### GET /api/setup
Get setup instructions for circuit preparation.

```bash
curl http://localhost:10000/api/setup
```

### POST /api/test
Test service connectivity.

```bash
curl -X POST http://localhost:10000/api/test
```

### POST /api/prove
Generate ZK proofs.

```bash
curl -X POST http://localhost:10000/api/prove \
  -H "Content-Type: application/json" \
  -d '{
    "circuit": "proof_aggregator",
    "inputs": [
      {
        "blockHash": "0x1234567890abcdef...",
        "merkleRoot": "0x5678901234abcdef...",
        "chainId": 1,
        "blockNumber": "12345",
        "timestamp": "1234567890"
      }
    ]
  }'
```

## Circuit Requirements

The service requires compiled circuit artifacts in the parent directory's `artifacts/circuits/` folder:

```
../artifacts/circuits/
├── proof_aggregator_js/
│   └── proof_aggregator.wasm
├── proof_aggregator/
│   ├── proof_aggregator_final.zkey
│   └── verification_key.json
└── ...
```

Run circuit compilation from the project root:
```bash
npm run setup-groth16
```

## Environment Variables

- `PORT`: Service port (default: 10000)
- `NODE_ENV`: Environment mode

## Error Handling

All endpoints return structured error responses:

```json
{
  "success": false,
  "error": "Error message description"
}
```

## Dependencies

- **Next.js**: API framework
- **snarkjs**: ZK proof generation
- **cors**: Cross-origin support

## Directory Structure

```
backend/
├── app/
│   ├── api/
│   │   ├── health/route.js
│   │   ├── setup/route.js
│   │   ├── test/route.js
│   │   └── prove/route.js
│   ├── layout.js
│   └── page.js
├── lib/
│   └── zkProofUtils.js
├── next.config.js
├── package.json
└── README.md
```

## Integration

This backend is designed to work with the LightLink frontend. Update the frontend's ZK service URL to point to this backend:

```env
NEXT_PUBLIC_ZK_PROOF_SERVICE_URL=http://localhost:10000
``` 