import admin from 'firebase-admin';
import dotenv from 'dotenv'
dotenv.config();

// Initialize Firebase Admin
const initializeFirebaseAdmin = () => {
  if (!admin.apps.length) {
    try {
      // 1. Verify environment variable exists
      if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is missing');
      }

      // 2. Parse the service account JSON
      let serviceAccount;
      try {
        //
        // console.log(process.env.FIREBASE_SERVICE_ACCOUNT);
        
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        //console.log(serviceAccount.private_key);
        
      } catch (parseError) {
        console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT:', process.env.FIREBASE_SERVICE_ACCOUNT);
        throw new Error('Invalid JSON in FIREBASE_SERVICE_ACCOUNT');
      }

      // 3. Process the private key (critical step)
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key
          .replace(/\\n/g, '\n')  // Convert escaped newlines to actual newlines
          .trim();                // Remove any whitespace
      }

      // 4. Verify key format
      if (!serviceAccount.private_key.includes('-----BEGIN PRIVATE KEY-----')) {
        throw new Error('Private key missing proper PEM headers');
      }

      // 5. Initialize Firebase
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
      });

      console.log('✅ Firebase Admin initialized successfully');
      return admin;
    } catch (error) {
      console.error('❌ Firebase Admin initialization error:', error);
      throw new Error(`Failed to initialize Firebase Admin: ${error.message}`);
    }
  }
  return admin;
};

const firebaseAdmin = initializeFirebaseAdmin();

// Token verification middleware
async function verifyFirebaseToken(req, res, next) {
  console.log('Request Headers:', req.headers.authorization);
  try {
    // Authorization check
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header missing' });
    }

    // Token extraction
    const [bearer, token] = authHeader.split(' ');
    if (bearer !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Invalid authorization format' });
    }

    // Token verification
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
    
    // Token revocation check
    const user = await firebaseAdmin.auth().getUser(decodedToken.uid);
    if (user.tokensValidAfterTime && 
        decodedToken.auth_time < user.tokensValidAfterTime.seconds) {
      return res.status(401).json({ error: 'Token revoked' });
    }

    // Attach user to request
    req.user = {
      uid: decodedToken.uid,
      phone: decodedToken.phone_number || null,
      email: decodedToken.email || null,
      emailVerified: decodedToken.email_verified || false
    };
    // console.log("myuid"+decodedToken.uid)
    // console.log(decodedToken.phone_number)
    
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    
    const errorMessages = {
      'auth/id-token-expired': 'Token expired - please login again',
      'auth/argument-error': 'Invalid token format',
      'auth/user-disabled': 'Your account has been disabled',
      'auth/user-not-found': 'User not found'
    };

    res.status(401).json({
      error: errorMessages[error.code] || 'Authentication failed',
      ...(process.env.NODE_ENV === 'production' && {
        details: error.message
      })
    });
  }
}

export default verifyFirebaseToken;