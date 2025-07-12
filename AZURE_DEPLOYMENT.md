# 🚀 Azure Deployment Guide for NIYAsaathi

This guide will help you deploy NIYAsaathi to Azure App Service using various methods.

## 📋 Prerequisites

1. **Azure Subscription**: Active Azure subscription
2. **Azure CLI**: Install from [Microsoft Docs](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
3. **Git**: For source control deployment
4. **Node.js**: Version 16+ (for local testing)

## 🎯 Deployment Options

### Option 1: Azure CLI (Recommended)

#### Step 1: Install and Login
```bash
# Install Azure CLI (if not already installed)
# Windows: Download from Microsoft
# macOS: brew install azure-cli
# Linux: curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Login to Azure
az login
```

#### Step 2: Run Deployment Script
```bash
# Make script executable (Linux/macOS)
chmod +x azure-deploy.sh

# Run deployment
./azure-deploy.sh
```

**For Windows PowerShell:**
```powershell
# Run PowerShell script
.\azure-deploy.ps1
```

### Option 2: Azure Portal (GUI)

#### Step 1: Create Resource Group
1. Go to [Azure Portal](https://portal.azure.com)
2. Click "Create a resource"
3. Search for "Resource group"
4. Create with name: `niyasaathi-rg`

#### Step 2: Create App Service Plan
1. In your resource group, click "Add"
2. Search for "App Service Plan"
3. Create with:
   - Name: `niyasaathi-plan`
   - OS: Linux
   - Region: East US (or your preferred region)
   - Pricing tier: B1 (Basic)

#### Step 3: Create Web App
1. In your resource group, click "Add"
2. Search for "Web App"
3. Create with:
   - Name: `niyasaathi-webapp`
   - Runtime stack: Node.js 16 LTS
   - OS: Linux
   - App Service Plan: Select the one you created

#### Step 4: Deploy Code
1. Go to your web app
2. Navigate to "Deployment Center"
3. Choose "Local Git/FTPS credentials"
4. Set up deployment credentials
5. Use Git to deploy:
   ```bash
   git remote add azure https://your-app.scm.azurewebsites.net:443/your-app.git
   git push azure main
   ```

### Option 3: Azure DevOps Pipeline

#### Step 1: Set up Azure DevOps
1. Go to [Azure DevOps](https://dev.azure.com)
2. Create a new project
3. Connect your GitHub repository

#### Step 2: Create Pipeline
1. Go to Pipelines → New Pipeline
2. Choose "Azure Repos Git" or "GitHub"
3. Select your repository
4. Choose "Existing Azure Pipelines YAML file"
5. Select `azure-deploy.yml`

#### Step 3: Configure Variables
1. Go to Library → Variable groups
2. Create a new variable group
3. Add your environment variables:
   - `OPENAI_API_KEY`
   - `BACKEND_URL`
   - `AZURE_SPEECH_KEY`
   - `AZURE_SPEECH_REGION`

## ⚙️ Configuration

### Environment Variables

Set these in Azure Portal → Your Web App → Configuration → Application settings:

```bash
# Required
OPENAI_API_KEY=your_openai_api_key
BACKEND_URL=https://your-backend-url.com

# Optional (for voice features)
AZURE_SPEECH_KEY=your_azure_speech_key
AZURE_SPEECH_REGION=your_azure_region

# Optional (for SMS)
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=your_twilio_number

# Security
JWT_SECRET=your_jwt_secret
NODE_ENV=production
```

### Using Azure CLI to Set Variables
```bash
az webapp config appsettings set \
    --name niyasaathi-webapp \
    --resource-group niyasaathi-rg \
    --settings \
        OPENAI_API_KEY="your-key" \
        BACKEND_URL="your-backend-url" \
        NODE_ENV="production"
```

## 🌐 Custom Domain Setup

### Step 1: Add Custom Domain
1. Go to your web app → Custom domains
2. Click "Add custom domain"
3. Enter your domain (e.g., `niyasaathi.com`)
4. Follow DNS configuration instructions

### Step 2: SSL Certificate
1. Go to "TLS/SSL settings"
2. Click "Add TLS/SSL binding"
3. Choose your domain
4. Select "SNI SSL" (free) or "IP based SSL"

## 📊 Monitoring and Logging

### Application Logs
```bash
# View logs
az webapp log tail --name niyasaathi-webapp --resource-group niyasaathi-rg

# Download logs
az webapp log download --name niyasaathi-webapp --resource-group niyasaathi-rg
```

### Azure Monitor
1. Go to your web app → Monitoring
2. Set up Application Insights
3. Monitor performance and errors

## 🔧 Troubleshooting

### Common Issues

#### 1. Node.js Version Issues
```bash
# Check current version
az webapp config appsettings list --name niyasaathi-webapp --resource-group niyasaathi-rg

# Set correct version
az webapp config appsettings set --name niyasaathi-webapp --resource-group niyasaathi-rg --settings WEBSITE_NODE_DEFAULT_VERSION=16-lts
```

#### 2. Startup Command Issues
```bash
# Set startup command
az webapp config set --name niyasaathi-webapp --resource-group niyasaathi-rg --startup-file "node server.js"
```

#### 3. Environment Variables Not Loading
- Check variable names (case-sensitive)
- Restart the web app after setting variables
- Verify in Azure Portal → Configuration

#### 4. CORS Issues
- Ensure `BACKEND_URL` is set correctly
- Check CORS configuration in your backend

### Performance Optimization

#### 1. Enable Compression
```bash
az webapp config appsettings set \
    --name niyasaathi-webapp \
    --resource-group niyasaathi-rg \
    --settings WEBSITE_HTTPLOGGING_RETENTION_DAYS=7
```

#### 2. Scale Up (if needed)
```bash
# Scale to S1 (Standard)
az appservice plan update \
    --name niyasaathi-plan \
    --resource-group niyasaathi-rg \
    --sku S1
```

## 💰 Cost Optimization

### Basic Plan (B1)
- **Cost**: ~$13/month
- **Features**: 1 CPU, 1.75 GB RAM
- **Suitable for**: Development and small production

### Standard Plan (S1)
- **Cost**: ~$73/month
- **Features**: 1 CPU, 1.75 GB RAM, custom domains, SSL
- **Suitable for**: Production with custom domain

### Free Plan (F1)
- **Cost**: Free
- **Limitations**: 1 GB RAM, 60 minutes/day CPU
- **Suitable for**: Testing only

## 🔒 Security Best Practices

1. **Environment Variables**: Never commit secrets to Git
2. **HTTPS**: Always use HTTPS in production
3. **CORS**: Configure CORS properly
4. **Authentication**: Use secure authentication methods
5. **Monitoring**: Set up alerts for errors and performance

## 📞 Support

If you encounter issues:

1. **Check Logs**: Use Azure Portal → Log stream
2. **Azure Status**: Check [Azure Status](https://status.azure.com)
3. **Documentation**: [Azure App Service Docs](https://docs.microsoft.com/en-us/azure/app-service/)
4. **Community**: [Stack Overflow](https://stackoverflow.com/questions/tagged/azure-app-service)

## 🎉 Success!

Once deployed, your app will be available at:
```
https://niyasaathi-webapp.azurewebsites.net
```

You can now:
- Add it to your website
- Share the URL with users
- Monitor performance
- Scale as needed

---

**Happy Deploying! 🚀** 