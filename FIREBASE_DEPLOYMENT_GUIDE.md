# Firebase Deployment Guide for NIYAsaathi

This guide will help you deploy NIYAsaathi to Firebase Hosting and Cloud Functions.

## Prerequisites

1. **Firebase CLI**: Install Firebase CLI globally
   ```bash
   npm install -g firebase-tools
   ```

2. **Node.js**: Version 16 or higher
   ```bash
   node --version
   ```

3. **Firebase Account**: Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)

## Step 1: Firebase Project Setup

1. **Create a new Firebase project**:
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Click "Add project"
   - Enter project name: `niyasaathi-app`
   - Enable Google Analytics (optional)
   - Click "Create project"

2. **Get your project ID**:
   - In Firebase Console, go to Project Settings
   - Copy the Project ID (e.g., `niyasaathi-app-12345`)

## Step 2: Configure Firebase Project

1. **Update `.firebaserc`**:
   ```json
   {
     "projects": {
       "default": "your-actual-project-id"
     }
   }
   ```
   Replace `your-actual-project-id` with your Firebase project ID.

2. **Login to Firebase CLI**:
   ```bash
   firebase login
   ```

3. **Initialize Firebase in your project**:
   ```bash
   firebase init
   ```

   Select the following options:
   - Choose features: **Hosting** and **Functions**
   - Select project: **Use an existing project**
   - Choose your project
   - Public directory: **frontend**
   - Configure as single-page app: **Yes**
   - Set up automatic builds: **No**
   - Functions directory: **firebase/functions**
   - Install dependencies: **Yes**

## Step 3: Environment Variables Setup

1. **Set Firebase Functions environment variables**:
   ```bash
   firebase functions:config:set openai.api_key="your-openai-api-key"
   ```

2. **For local development, create `.env` file in `firebase/functions/`**:
   ```
   OPENAI_API_KEY=your-openai-api-key
   ```

## Step 4: Install Dependencies

1. **Install Firebase Functions dependencies**:
   ```bash
   cd firebase/functions
   npm install
   ```

2. **Install project dependencies** (if any):
   ```bash
   cd ../..
   npm install
   ```

## Step 5: Test Locally

1. **Start Firebase emulators**:
   ```bash
   firebase emulators:start
   ```

2. **Test the application**:
   - Open `http://localhost:5000` in your browser
   - Test the chat functionality
   - Verify Firebase Functions are working

## Step 6: Deploy to Firebase

1. **Deploy everything**:
   ```bash
   firebase deploy
   ```

   This will deploy:
   - Frontend to Firebase Hosting
   - Cloud Functions to Firebase Functions

2. **Deploy only specific parts**:
   ```bash
   # Deploy only hosting
   firebase deploy --only hosting
   
   # Deploy only functions
   firebase deploy --only functions
   ```

## Step 7: Configure Custom Domain (Optional)

1. **Add custom domain in Firebase Console**:
   - Go to Hosting in Firebase Console
   - Click "Add custom domain"
   - Enter your domain (e.g., `niyasaathi.yourdomain.com`)
   - Follow the DNS configuration instructions

2. **Update DNS records**:
   - Add the provided DNS records to your domain provider
   - Wait for DNS propagation (can take up to 24 hours)

## Step 8: SSL Certificate

Firebase automatically provides SSL certificates for:
- Default Firebase hosting domain (`your-project-id.web.app`)
- Custom domains (after DNS verification)

## Step 9: Environment Variables for Production

1. **Set production environment variables**:
   ```bash
   firebase functions:config:set openai.api_key="your-production-openai-key"
   ```

2. **Deploy functions with new config**:
   ```bash
   firebase deploy --only functions
   ```

## Step 10: Monitoring and Logs

1. **View function logs**:
   ```bash
   firebase functions:log
   ```

2. **Monitor in Firebase Console**:
   - Go to Functions in Firebase Console
   - View execution logs and metrics
   - Monitor performance and errors

## Troubleshooting

### Common Issues

1. **Functions deployment fails**:
   ```bash
   # Check function logs
   firebase functions:log
   
   # Redeploy functions
   firebase deploy --only functions
   ```

2. **Environment variables not working**:
   ```bash
   # Check current config
   firebase functions:config:get
   
   # Set config again
   firebase functions:config:set openai.api_key="your-key"
   ```

3. **CORS issues**:
   - Verify CORS is enabled in `firebase/functions/index.js`
   - Check that the frontend URL is allowed

4. **Cold start issues**:
   - Functions may take time to start on first request
   - Consider using Firebase Functions with higher memory allocation

### Performance Optimization

1. **Enable function caching**:
   ```javascript
   // In firebase/functions/index.js
   app.use(cors({ origin: true, credentials: true }));
   ```

2. **Optimize function size**:
   - Remove unused dependencies
   - Use tree shaking for imports

3. **Set appropriate memory allocation**:
   ```javascript
   // In firebase/functions/index.js
   exports.api = functions
     .runWith({
       memory: '256MB',
       timeoutSeconds: 60
     })
     .https.onRequest(app);
   ```

## Security Considerations

1. **API Key Security**:
   - Never expose API keys in client-side code
   - Use Firebase Functions environment variables
   - Rotate keys regularly

2. **CORS Configuration**:
   - Restrict origins to your domain
   - Don't use `origin: '*'` in production

3. **Rate Limiting**:
   - Consider implementing rate limiting
   - Monitor function usage

## Cost Optimization

1. **Free Tier Limits**:
   - Firebase Hosting: 10GB storage, 360MB/day transfer
   - Firebase Functions: 125K invocations/month, 40K GB-seconds/month

2. **Monitor Usage**:
   - Check Firebase Console billing section
   - Set up billing alerts

## Deployment Checklist

- [ ] Firebase CLI installed and logged in
- [ ] Firebase project created and configured
- [ ] `.firebaserc` updated with correct project ID
- [ ] Environment variables set
- [ ] Dependencies installed
- [ ] Local testing completed
- [ ] Functions deployed successfully
- [ ] Hosting deployed successfully
- [ ] Custom domain configured (if needed)
- [ ] SSL certificate active
- [ ] Monitoring set up

## Support

If you encounter issues:

1. Check Firebase documentation: [firebase.google.com/docs](https://firebase.google.com/docs)
2. View Firebase Console logs
3. Check function execution logs
4. Verify environment variables are set correctly

## Next Steps

After successful deployment:

1. **Set up monitoring**: Configure alerts for function errors
2. **Implement analytics**: Add Firebase Analytics
3. **Set up CI/CD**: Configure automatic deployments
4. **Performance monitoring**: Monitor function performance
5. **Security audit**: Review security settings

Your NIYAsaathi app should now be live at:
- `https://your-project-id.web.app`
- `https://your-project-id.firebaseapp.com`
- Your custom domain (if configured) 