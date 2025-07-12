# 🚀 Free Deployment Guide for NIYAsaathi

This guide covers multiple free deployment options for NIYAsaathi.

## 🎯 Quick Comparison

| Platform | Ease | Free Tier | Custom Domain | Database | Best For |
|----------|------|-----------|---------------|----------|----------|
| **Vercel** | ⭐⭐⭐⭐⭐ | 100GB/month | ✅ | ❌ | Beginners |
| **Netlify** | ⭐⭐⭐⭐ | 100GB/month | ✅ | ❌ | Static sites |
| **Render** | ⭐⭐⭐⭐ | 750h/month | ✅ | ✅ | Full-stack |
| **Railway** | ⭐⭐⭐⭐ | $5 credit | ✅ | ✅ | Production |
| **Heroku** | ⭐⭐⭐ | 550h/month | ❌ | ❌ | Classic choice |
| **Firebase** | ⭐⭐⭐ | 10GB/month | ✅ | ❌ | Google ecosystem |

## 🚀 Vercel Deployment (Recommended)

### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2: Deploy
```bash
# One command deployment!
vercel

# Follow the prompts:
# - Set up and deploy? Y
# - Which scope? [your-account]
# - Link to existing project? N
# - What's your project's name? niyasaathi
# - In which directory is your code located? ./
# - Want to override the settings? N
```

### Step 3: Set Environment Variables
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to Settings → Environment Variables
4. Add:
   - `OPENAI_API_KEY`
   - `BACKEND_URL`
   - `AZURE_SPEECH_KEY`
   - `AZURE_SPEECH_REGION`

### Step 4: Custom Domain (Optional)
1. Go to Settings → Domains
2. Add your domain
3. Follow DNS instructions

**Your app will be live at:** `https://niyasaathi.vercel.app`

---

## 🌐 Netlify Deployment

### Step 1: Connect GitHub
1. Go to [netlify.com](https://netlify.com)
2. Sign up with GitHub
3. Click "New site from Git"

### Step 2: Configure Build
- **Repository:** Select your GitHub repo
- **Branch:** main
- **Build command:** `npm install && npm run build`
- **Publish directory:** `frontend`

### Step 3: Deploy
Click "Deploy site" and wait for build to complete.

### Step 4: Environment Variables
1. Go to Site settings → Environment variables
2. Add your API keys

**Your app will be live at:** `https://random-name.netlify.app`

---

## ⚡ Render Deployment

### Step 1: Create Account
1. Go to [render.com](https://render.com)
2. Sign up with GitHub

### Step 2: Create Web Service
1. Click "New +"
2. Select "Web Service"
3. Connect your GitHub repository

### Step 3: Configure Service
- **Name:** niyasaathi
- **Environment:** Node
- **Build Command:** `npm install`
- **Start Command:** `node server.js`
- **Plan:** Free

### Step 4: Environment Variables
Add your environment variables in the dashboard.

**Your app will be live at:** `https://niyasaathi.onrender.com`

---

## 🚂 Railway Deployment

### Step 1: Sign Up
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub

### Step 2: Deploy
1. Click "Deploy from GitHub repo"
2. Select your repository
3. Railway will auto-detect Node.js

### Step 3: Environment Variables
1. Go to Variables tab
2. Add your API keys

### Step 4: Custom Domain
1. Go to Settings → Domains
2. Add your domain

**Your app will be live at:** `https://niyasaathi-production.up.railway.app`

---

## 🏗️ Heroku Deployment

### Step 1: Install Heroku CLI
```bash
# Windows: Download from heroku.com
# macOS: brew install heroku
# Linux: curl https://cli-assets.heroku.com/install.sh | sh
```

### Step 2: Login and Deploy
```bash
# Login to Heroku
heroku login

# Create app
heroku create niyasaathi-app

# Set environment variables
heroku config:set OPENAI_API_KEY=your-key
heroku config:set BACKEND_URL=your-backend-url

# Deploy
git push heroku main
```

### Step 3: Open App
```bash
heroku open
```

**Your app will be live at:** `https://niyasaathi-app.herokuapp.com`

---

## 🔥 Firebase Deployment

### Step 1: Install Firebase CLI
```bash
npm install -g firebase-tools
```

### Step 2: Initialize Firebase
```bash
# Login
firebase login

# Initialize project
firebase init hosting

# Select options:
# - Use existing project or create new
# - Public directory: frontend
# - Configure as single-page app: Yes
# - Set up automatic builds: No
```

### Step 3: Deploy
```bash
firebase deploy
```

**Your app will be live at:** `https://your-project.web.app`

---

## ⚙️ Environment Variables Setup

For all platforms, you'll need these environment variables:

### Required Variables
```bash
OPENAI_API_KEY=your_openai_api_key
BACKEND_URL=https://your-backend-url.com
NODE_ENV=production
```

### Optional Variables
```bash
AZURE_SPEECH_KEY=your_azure_speech_key
AZURE_SPEECH_REGION=your_azure_region
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
JWT_SECRET=your_jwt_secret
```

## 🔧 Troubleshooting

### Common Issues

#### 1. Build Failures
```bash
# Check if all dependencies are in package.json
npm install

# Test build locally
npm run build
```

#### 2. Environment Variables Not Loading
- Check variable names (case-sensitive)
- Restart the deployment
- Verify in platform dashboard

#### 3. CORS Issues
- Ensure `BACKEND_URL` is set correctly
- Check CORS configuration in backend

#### 4. Port Issues
- Most platforms auto-detect port
- Use `process.env.PORT` in server.js

## 📊 Performance Tips

### 1. Optimize Images
- Use WebP format
- Compress images
- Use CDN for static assets

### 2. Enable Compression
- Most platforms enable gzip automatically
- Check platform settings

### 3. Cache Static Files
- Set appropriate cache headers
- Use platform-specific caching

## 🎉 Success!

After deployment, your app will be live and you can:
- Share the URL with users
- Add it to your website
- Monitor performance
- Set up custom domains

## 💡 Recommendation

**For beginners:** Start with **Vercel** - it's the easiest and most reliable.

**For production:** Use **Railway** or **Render** - they offer more features and better performance.

---

**Happy Deploying! 🚀** 