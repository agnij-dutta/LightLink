export default function Home() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <h1>🔐 LightLink ZK Proof Service</h1>
      <p>This is an API-only service for generating ZK proofs. No frontend interface is provided.</p>
      
      <h2>Available Endpoints:</h2>
      <ul>
        <li><strong>GET /api/health</strong> - Check service and circuit status</li>
        <li><strong>GET /api/setup</strong> - Get setup instructions</li>
        <li><strong>POST /api/test</strong> - Test service connectivity</li>
        <li><strong>POST /api/prove</strong> - Generate ZK proofs</li>
      </ul>
      
      <h2>Example Usage:</h2>
      <pre style={{ background: '#f5f5f5', padding: '1rem', borderRadius: '4px', overflow: 'auto' }}>
{`// Health Check
curl https://light-link.vercel.app/api/health

// Generate Proof
curl -X POST https://light-link.vercel.app/api/prove \\
  -H "Content-Type: application/json" \\
  -d '{
    "circuit": "proof_aggregator",
    "inputs": [
      {
        "blockHash": "0x1234...",
        "merkleRoot": "0x5678...",
        "chainId": 1,
        "blockNumber": "12345",
        "timestamp": "1234567890"
      }
    ]
  }'`}
      </pre>
      
      <p><em>Service deployed at <a href="https://light-link.vercel.app" target="_blank">https://light-link.vercel.app</a></em></p>
    </div>
  )
} 