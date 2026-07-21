// Request Logger Middleware
// Add this to your app.js to see what requests are coming in

export const requestLogger = (req, res, next) => {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  INCOMING REQUEST                                     ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`📍 Method: ${req.method}`);
  console.log(`📍 Path: ${req.path}`);
  console.log(`📍 Full URL: ${req.protocol}://${req.get('host')}${req.originalUrl}`);
  console.log(`\n📦 Headers:`);
  console.log(`   Authorization: ${req.headers.authorization ? req.headers.authorization.substring(0, 30) + '...' : 'NOT PROVIDED'}`);
  console.log(`   Content-Type: ${req.headers['content-type'] || 'NOT SET'}`);
  console.log(`\n📄 Body:`, JSON.stringify(req.body, null, 2));
  console.log(`\n📌 Query Params:`, req.query);
  console.log('═'.repeat(58) + '\n');
  next();
};

// To use this, add to app.js after express.json() and before routes:
// import { requestLogger } from './requestLogger.js';
// app.use(requestLogger);
