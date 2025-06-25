#!/usr/bin/env bash
set -e

echo "🚀 Starting LightLink ZK Server deployment on Render..."

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm ci --only=production

# Create necessary directories
echo "📁 Creating required directories..."
mkdir -p artifacts/circuits
mkdir -p artifacts/circuits/merkle_proof
mkdir -p artifacts/circuits/proof_aggregator

# For Render deployment, we'll start with mock mode enabled
# Real circuit compilation requires significant resources and time
echo "⚙️  Configuring for Render deployment..."

# Create mock circuit status files to indicate circuits are "ready"
echo "🔧 Setting up mock circuit configuration..."
mkdir -p artifacts/circuits/merkle_proof/merkle_proof_js
mkdir -p artifacts/circuits/proof_aggregator/proof_aggregator_js

# Create minimal mock files that the service expects to exist
echo '{"curve":"bn128","nPublic":1,"nConstraints":1}' > artifacts/circuits/merkle_proof/verification_key.json
echo '{"curve":"bn128","nPublic":1,"nConstraints":1}' > artifacts/circuits/proof_aggregator/verification_key.json

# Create empty wasm and zkey files (will use mock proofs)
touch artifacts/circuits/merkle_proof/merkle_proof_js/merkle_proof.wasm
touch artifacts/circuits/merkle_proof/merkle_proof_final.zkey
touch artifacts/circuits/proof_aggregator/proof_aggregator_js/proof_aggregator.wasm
touch artifacts/circuits/proof_aggregator/proof_aggregator_final.zkey

echo "✅ Render deployment build completed!"
echo "🔍 Service will start in mock mode for reliable deployment."
echo "💡 To enable real circuits, set MOCK_DATA=false and provide proper circuit files."

# Optional: If you want to try circuit compilation on Render (may timeout)
if [ "$COMPILE_CIRCUITS" = "true" ]; then
  echo "🔧 Attempting circuit compilation (may timeout on free tier)..."
  
  # Set timeout for circuit operations
  timeout 300s bash -c '
    # Install circom if not available
    if ! command -v circom &> /dev/null; then
      echo "Installing circom..."
      # Circom installation would go here, but this may fail on Render
      echo "Warning: circom not available, skipping compilation"
      exit 0
    fi
    
    # Download ptau file if not present (small one for testing)
    if [ ! -f powersOfTau28_hez_final_08.ptau ]; then
      echo "Downloading powers of tau file..."
      curl -L -o powersOfTau28_hez_final_08.ptau https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_08.ptau
    fi
    
    # Compile circuits with timeout protection
    echo "Compiling merkle_proof circuit..."
    npx circom circuits/merkle_proof.circom --r1cs --wasm --sym -o artifacts/circuits/merkle_proof || echo "Circuit compilation failed, using mocks"
    
    echo "Setting up Groth16 for merkle_proof..."
    npx snarkjs groth16 setup artifacts/circuits/merkle_proof/merkle_proof.r1cs powersOfTau28_hez_final_08.ptau artifacts/circuits/merkle_proof/merkle_proof_0000.zkey || echo "Groth16 setup failed, using mocks"
    npx snarkjs zkey contribute artifacts/circuits/merkle_proof/merkle_proof_0000.zkey artifacts/circuits/merkle_proof/merkle_proof_final.zkey --name="Render Contributor" -v || echo "Key contribution failed, using mocks"
    npx snarkjs zkey export verificationkey artifacts/circuits/merkle_proof/merkle_proof_final.zkey artifacts/circuits/merkle_proof/verification_key.json || echo "Key export failed, using mocks"
  ' || {
    echo "⚠️  Circuit compilation timed out or failed, continuing with mocks..."
  }
fi

echo "🎉 Build process completed successfully!" 