#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🧪 Running Pattern Detection Integration Tests...\n');

try {
  // Try to run the specific test file
  const output = execSync('npm test -- --testPathPattern=patternDetectionIntegration', { 
    stdio: 'inherit',
    encoding: 'utf8'
  });
  
  console.log('\n✅ Tests completed successfully!');
} catch (error) {
  console.log('\n❌ Test errors found. Let me show you the details:');
  
  // Try to get more specific error info
  try {
    const detailedOutput = execSync('npx jest src/test-scenarios/patternDetectionIntegration.test.js --verbose --no-coverage', {
      stdio: 'pipe',
      encoding: 'utf8'
    });
    console.log(detailedOutput);
  } catch (detailedError) {
    console.log('Error details:', detailedError.stdout || detailedError.message);
  }
}
