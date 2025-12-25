import { getBaseSepoliaService } from '../server/services/blockchain';
import { ethers } from 'ethers';

const BASE_SEPOLIA_EXPLORER = 'https://sepolia.basescan.org';
const CONTRACT_ADDRESS = '0xD0b8f9f6c9055574D835355B466C418b7558aCE0';

async function main() {
  console.log('='.repeat(60));
  console.log('Base Sepolia Anchor Verification Script');
  console.log('='.repeat(60));
  console.log();

  if (!process.env.PRIVATE_KEY) {
    console.error('❌ ERROR: PRIVATE_KEY environment variable is not set.');
    console.error('');
    console.error('To run this script, you need to set a private key for a wallet');
    console.error('that has Base Sepolia ETH for gas fees.');
    console.error('');
    console.error('You can get testnet ETH from:');
    console.error('  - https://www.alchemy.com/faucets/base-sepolia');
    console.error('  - https://faucet.quicknode.com/base/sepolia');
    console.error('');
    console.error('Set the PRIVATE_KEY as a secret in Replit or run with:');
    console.error('  PRIVATE_KEY=0x... npx tsx scripts/verify-anchor.ts');
    process.exit(1);
  }

  try {
    console.log('📡 Initializing Base Sepolia blockchain service...');
    const blockchainService = getBaseSepoliaService();

    const walletAddress = await blockchainService.getWalletAddress();
    const balance = await blockchainService.getBalance();
    
    console.log(`✅ Wallet Address: ${walletAddress}`);
    console.log(`💰 Balance: ${balance} ETH`);
    console.log(`📋 Anchor Registry Contract: ${CONTRACT_ADDRESS}`);
    console.log();

    if (parseFloat(balance) < 0.0001) {
      console.warn('⚠️  WARNING: Low balance. You may need more testnet ETH for gas.');
      console.warn('   Get testnet ETH from https://www.alchemy.com/faucets/base-sepolia');
      console.log();
    }

    const testData = {
      type: 'verification-test',
      timestamp: new Date().toISOString(),
      message: 'P3 Protocol Base Sepolia verification test',
      version: '1.0.0',
    };

    const testDataString = JSON.stringify(testData);
    const contentHash = ethers.keccak256(ethers.toUtf8Bytes(testDataString));
    
    console.log('📝 Test Data:');
    console.log(JSON.stringify(testData, null, 2));
    console.log();
    console.log(`🔐 Content Hash: ${contentHash}`);
    console.log();

    console.log('⏳ Submitting anchor transaction to Base Sepolia...');
    console.log('   (This may take 10-30 seconds for confirmation)');
    console.log();

    const result = await blockchainService.anchorData(
      contentHash,
      JSON.stringify({ source: 'verify-anchor-script', ...testData })
    );

    console.log('✅ Anchor Created Successfully!');
    console.log('='.repeat(60));
    console.log();
    console.log(`📌 Anchor ID: ${result.anchorId}`);
    console.log(`🔗 Transaction Hash: ${result.txHash}`);
    console.log();
    console.log('🌐 View on Basescan:');
    console.log(`   ${BASE_SEPOLIA_EXPLORER}/tx/${result.txHash}`);
    console.log();

    console.log('🔍 Verifying anchor exists on-chain...');
    const isValid = await blockchainService.verifyAnchor(result.anchorId, contentHash);
    
    if (isValid) {
      console.log('✅ Anchor verification PASSED!');
      console.log('   The content hash matches the on-chain anchor.');
    } else {
      console.log('❌ Anchor verification FAILED!');
      console.log('   The content hash does not match.');
    }

    console.log();
    console.log('='.repeat(60));
    console.log('🎉 Base Sepolia anchoring test completed successfully!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error();
    console.error('❌ Error during anchor verification:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
      
      if (error.message.includes('invalid private key') || error.message.includes('INVALID_ARGUMENT')) {
        console.error();
        console.error('💡 TIP: The PRIVATE_KEY appears to be invalid.');
        console.error('   A valid private key should be:');
        console.error('   - 64 hexadecimal characters (256 bits)');
        console.error('   - Optionally prefixed with "0x"');
        console.error('   - Example format: 0x1234...abcd (64 hex chars after 0x)');
        console.error();
        console.error('   You can generate a new wallet at:');
        console.error('   - https://vanity-eth.tk/ (offline wallet generator)');
        console.error('   - Or export from MetaMask/Trust Wallet');
      }
      
      if (error.message.includes('insufficient funds')) {
        console.error();
        console.error('💡 TIP: Your wallet needs Base Sepolia testnet ETH.');
        console.error('   Get testnet ETH from https://www.alchemy.com/faucets/base-sepolia');
      }
      
      if (error.message.includes('execution reverted')) {
        console.error();
        console.error('💡 TIP: The transaction reverted. This could mean:');
        console.error('   - The contract may require payment (anchoringFee)');
        console.error('   - The contract may have access restrictions');
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

main();
