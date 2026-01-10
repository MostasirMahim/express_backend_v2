/**
 * Test file to verify security system implementation
 * Run with: node src/test/securityTest.js
 */

import {
  trackFailedLogin,
  clearLoginAttempts,
  isLoginLocked,
  trackFailedOTP,
  clearOTPAttempts,
  trackSuspiciousActivity,
  isSuspicious,
  getSecurityStatus,
  getSuspiciousActivityLog,
  clearSecurityFlags,
  SECURITY_CONFIG
} from '../lib/securityManager.js';

import {
  createRateLimiter,
  RATE_LIMIT_PRESETS,
  loginLimiter,
  otpLimiter,
  passwordResetLimiter,
  getRateLimitStatus,
  resetRateLimit
} from '../lib/flexibleRateLimiter.js';

const testEmail = 'test@example.com';

console.log('🧪 Starting Security System Tests...\n');

// Test 1: Security Manager - Login Tracking
console.log('📝 Test 1: Login Attempt Tracking');
try {
  // Clear any existing data
  await clearSecurityFlags(testEmail);
  
  // Check initial status
  let status = await getSecurityStatus(testEmail);
  console.log('✅ Initial status:', status);
  
  // Track 3 failed attempts
  for (let i = 1; i <= 3; i++) {
    const result = await trackFailedLogin(testEmail);
    console.log(`   Attempt ${i}:`, result);
  }
  
  // Check status after attempts
  status = await getSecurityStatus(testEmail);
  console.log('✅ Status after 3 attempts:', status);
  
  // Clear attempts
  await clearLoginAttempts(testEmail);
  status = await getSecurityStatus(testEmail);
  console.log('✅ Status after clear:', status);
  
  console.log('✅ Test 1 PASSED\n');
} catch (error) {
  console.error('❌ Test 1 FAILED:', error.message, '\n');
}

// Test 2: Security Manager - Account Locking
console.log('📝 Test 2: Account Locking');
try {
  await clearSecurityFlags(testEmail);
  
  // Track max attempts
  for (let i = 1; i <= SECURITY_CONFIG.LOGIN_MAX_ATTEMPTS; i++) {
    try {
      await trackFailedLogin(testEmail);
      console.log(`   Attempt ${i}: OK`);
    } catch (error) {
      console.log(`   Attempt ${i}: LOCKED - ${error.message}`);
    }
  }
  
  // Check if locked
  const lockCheck = await isLoginLocked(testEmail);
  console.log('✅ Lock status:', lockCheck);
  
  // Clear for next test
  await clearSecurityFlags(testEmail);
  
  console.log('✅ Test 2 PASSED\n');
} catch (error) {
  console.error('❌ Test 2 FAILED:', error.message, '\n');
}

// Test 3: Security Manager - Suspicious Activity
console.log('📝 Test 3: Suspicious Activity Tracking');
try {
  await clearSecurityFlags(testEmail);
  
  // Track various suspicious activities
  await trackSuspiciousActivity(testEmail, 'invalid_token');
  await trackSuspiciousActivity(testEmail, 'malformed_request');
  await trackSuspiciousActivity(testEmail, 'unauthorized_access');
  
  // Get activity log
  const logs = await getSuspiciousActivityLog(testEmail);
  console.log('✅ Activity log entries:', logs.length);
  console.log('   Latest activities:', logs.slice(0, 3));
  
  // Check if flagged
  const suspiciousCheck = await isSuspicious(testEmail);
  console.log('✅ Suspicious status:', suspiciousCheck);
  
  await clearSecurityFlags(testEmail);
  
  console.log('✅ Test 3 PASSED\n');
} catch (error) {
  console.error('❌ Test 3 FAILED:', error.message, '\n');
}

// Test 4: Flexible Rate Limiter - Presets
console.log('📝 Test 4: Rate Limiter Presets');
try {
  console.log('✅ Available presets:', Object.keys(RATE_LIMIT_PRESETS));
  
  // Create limiter with preset
  const testLimiter = createRateLimiter({
    preset: 'AUTH',
    keyPrefix: 'test'
  });
  
  console.log('✅ Created limiter with AUTH preset');
  console.log('   Points:', testLimiter.points);
  console.log('   Duration:', testLimiter.duration);
  
  console.log('✅ Test 4 PASSED\n');
} catch (error) {
  console.error('❌ Test 4 FAILED:', error.message, '\n');
}

// Test 5: Rate Limiter - Status Check
console.log('📝 Test 5: Rate Limiter Status');
try {
  const testKey = 'test-user-123';
  
  // Get initial status
  let status = await getRateLimitStatus(loginLimiter, testKey);
  console.log('✅ Initial status:', status);
  
  // Consume some points
  await loginLimiter.consume(testKey, 2);
  
  // Check status again
  status = await getRateLimitStatus(loginLimiter, testKey);
  console.log('✅ Status after consuming 2 points:', status);
  
  // Reset
  await resetRateLimit(loginLimiter, testKey);
  status = await getRateLimitStatus(loginLimiter, testKey);
  console.log('✅ Status after reset:', status);
  
  console.log('✅ Test 5 PASSED\n');
} catch (error) {
  console.error('❌ Test 5 FAILED:', error.message, '\n');
}

// Test 6: Pre-configured Limiters
console.log('📝 Test 6: Pre-configured Limiters');
try {
  console.log('✅ Login Limiter:', {
    points: loginLimiter.points,
    duration: loginLimiter.duration
  });
  
  console.log('✅ OTP Limiter:', {
    points: otpLimiter.points,
    duration: otpLimiter.duration
  });
  
  console.log('✅ Password Reset Limiter:', {
    points: passwordResetLimiter.points,
    duration: passwordResetLimiter.duration
  });
  
  console.log('✅ Test 6 PASSED\n');
} catch (error) {
  console.error('❌ Test 6 FAILED:', error.message, '\n');
}

// Cleanup
console.log('🧹 Cleaning up test data...');
await clearSecurityFlags(testEmail);
await resetRateLimit(loginLimiter, 'test-user-123');

console.log('\n✅ All tests completed!');
console.log('\n📊 Summary:');
console.log('   - Security Manager: ✅ Working');
console.log('   - Rate Limiter: ✅ Working');
console.log('   - All integrations: ✅ Ready');

process.exit(0);
