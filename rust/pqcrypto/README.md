# Post-Quantum Cryptography WASM Bindings

**Status**: Scaffolded, not built (prevents WASM compilation overhead in demo mode)

## Future Build Instructions

When `ENABLE_PQ=true`:

1. Install Rust: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
2. Install wasm-pack: `cargo install wasm-pack`
3. Uncomment dependencies in `Cargo.toml`
4. Uncomment code in `src/lib.rs`
5. Build: `wasm-pack build --target nodejs`
6. Bindings available at `pkg/pqcrypto.js`

## Algorithms

- **Dilithium2**: NIST PQC signature scheme (2420 byte signatures)
- **Kyber768**: NIST PQC KEM (1088 byte ciphertexts, 32 byte shared secrets)
