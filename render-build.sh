#!/bin/bash
set -e

npm install

# Download ptau file if not present
if [ ! -f powersOfTau28_hez_final_15.ptau ]; then
  wget https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_15.ptau -O powersOfTau28_hez_final_15.ptau
fi

# Compile circuits
npx circom circuits/merkle_proof.circom --r1cs --wasm --sym -o artifacts/circuits/merkle_proof
npx circom circuits/proof_aggregator.circom --r1cs --wasm --sym -o artifacts/circuits/proof_aggregator

# Setup Groth16 for merkle_proof
npx snarkjs groth16 setup artifacts/circuits/merkle_proof/merkle_proof.r1cs powersOfTau28_hez_final_15.ptau artifacts/circuits/merkle_proof/merkle_proof_0000.zkey
npx snarkjs zkey contribute artifacts/circuits/merkle_proof/merkle_proof_0000.zkey artifacts/circuits/merkle_proof/merkle_proof_final.zkey --name="1st Contributor" -v
npx snarkjs zkey export verificationkey artifacts/circuits/merkle_proof/merkle_proof_final.zkey artifacts/circuits/merkle_proof/verification_key.json

# Setup Groth16 for proof_aggregator
npx snarkjs groth16 setup artifacts/circuits/proof_aggregator/proof_aggregator.r1cs powersOfTau28_hez_final_15.ptau artifacts/circuits/proof_aggregator/proof_aggregator_0000.zkey
npx snarkjs zkey contribute artifacts/circuits/proof_aggregator/proof_aggregator_0000.zkey artifacts/circuits/proof_aggregator/proof_aggregator_final.zkey --name="1st Contributor" -v
npx snarkjs zkey export verificationkey artifacts/circuits/proof_aggregator/proof_aggregator_final.zkey artifacts/circuits/proof_aggregator/verification_key.json
