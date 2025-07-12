#!/bin/bash

# NIYAsaathi Azure Deployment Script (Bash)
# Prerequisites: Azure CLI installed and logged in

# Configuration
RESOURCE_GROUP_NAME="niyasaathi-rg"
APP_NAME="niyasaathi-webapp"
LOCATION="East US"
PLAN_NAME="niyasaathi-plan"

echo "🚀 Deploying NIYAsaathi to Azure..."

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI is not installed. Please install it first:"
    echo "https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Check if logged in to Azure
if ! az account show &> /dev/null; then
    echo "🔐 Please log in to Azure..."
    az login
fi

# Create Resource Group
echo "📦 Creating Resource Group: $RESOURCE_GROUP_NAME"
az group create --name $RESOURCE_GROUP_NAME --location $LOCATION

# Create App Service Plan
echo "📋 Creating App Service Plan: $PLAN_NAME"
az appservice plan create \
    --name $PLAN_NAME \
    --resource-group $RESOURCE_GROUP_NAME \
    --location $LOCATION \
    --sku B1 \
    --is-linux

# Create Web App
echo "🌐 Creating Web App: $APP_NAME"
az webapp create \
    --name $APP_NAME \
    --resource-group $RESOURCE_GROUP_NAME \
    --plan $PLAN_NAME \
    --runtime "NODE|16-lts"

# Configure Node.js version
echo "⚙️ Configuring Node.js settings..."
az webapp config appsettings set \
    --name $APP_NAME \
    --resource-group $RESOURCE_GROUP_NAME \
    --settings WEBSITE_NODE_DEFAULT_VERSION=16-lts

# Configure startup command
echo "🚀 Setting startup command..."
az webapp config set \
    --name $APP_NAME \
    --resource-group $RESOURCE_GROUP_NAME \
    --startup-file "node server.js"

# Enable logging
echo "📝 Enabling application logging..."
az webapp log config \
    --name $APP_NAME \
    --resource-group $RESOURCE_GROUP_NAME \
    --web-server-logging filesystem

# Create deployment package
echo "📦 Creating deployment package..."
zip -r deploy.zip . -x "*.git*" "node_modules/*" "backend/__pycache__/*" "*.env"

# Deploy the application
echo "📤 Deploying application..."
az webapp deployment source config-zip \
    --name $APP_NAME \
    --resource-group $RESOURCE_GROUP_NAME \
    --src ./deploy.zip

# Get the app URL
APP_URL=$(az webapp show --name $APP_NAME --resource-group $RESOURCE_GROUP_NAME --query defaultHostName --output tsv)

echo "✅ Deployment completed successfully!"
echo "🌐 Your app is available at: https://$APP_URL"
echo ""
echo "📋 Next steps:"
echo "1. Set environment variables in Azure Portal"
echo "2. Configure custom domain (optional)"
echo "3. Set up SSL certificate"
echo ""
echo "🔧 To set environment variables, run:"
echo "az webapp config appsettings set --name $APP_NAME --resource-group $RESOURCE_GROUP_NAME --settings OPENAI_API_KEY='your-key' BACKEND_URL='your-backend-url'"

# Clean up deployment package
rm deploy.zip 