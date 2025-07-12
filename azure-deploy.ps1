# NIYAsaathi Azure Deployment Script
# Prerequisites: Azure CLI installed and logged in

param(
    [string]$ResourceGroupName = "niyasaathi-rg",
    [string]$AppName = "niyasaathi-webapp",
    [string]$Location = "East US",
    [string]$PlanName = "niyasaathi-plan"
)

Write-Host "🚀 Deploying NIYAsaathi to Azure..." -ForegroundColor Green

# Check if Azure CLI is installed
if (!(Get-Command az -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Azure CLI is not installed. Please install it first: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli" -ForegroundColor Red
    exit 1
}

# Check if logged in to Azure
$account = az account show 2>$null
if (!$account) {
    Write-Host "🔐 Please log in to Azure..." -ForegroundColor Yellow
    az login
}

# Create Resource Group
Write-Host "📦 Creating Resource Group: $ResourceGroupName" -ForegroundColor Blue
az group create --name $ResourceGroupName --location $Location

# Create App Service Plan
Write-Host "📋 Creating App Service Plan: $PlanName" -ForegroundColor Blue
az appservice plan create --name $PlanName --resource-group $ResourceGroupName --location $Location --sku B1 --is-linux

# Create Web App
Write-Host "🌐 Creating Web App: $AppName" -ForegroundColor Blue
az webapp create --name $AppName --resource-group $ResourceGroupName --plan $PlanName --runtime "NODE|16-lts"

# Configure Node.js version
Write-Host "⚙️ Configuring Node.js settings..." -ForegroundColor Blue
az webapp config appsettings set --name $AppName --resource-group $ResourceGroupName --settings WEBSITE_NODE_DEFAULT_VERSION=16-lts

# Configure startup command
Write-Host "🚀 Setting startup command..." -ForegroundColor Blue
az webapp config set --name $AppName --resource-group $ResourceGroupName --startup-file "node server.js"

# Enable logging
Write-Host "📝 Enabling application logging..." -ForegroundColor Blue
az webapp log config --name $AppName --resource-group $ResourceGroupName --web-server-logging filesystem

# Deploy the application
Write-Host "📤 Deploying application..." -ForegroundColor Blue
az webapp deployment source config-zip --name $AppName --resource-group $ResourceGroupName --src ./deploy.zip

# Get the app URL
$appUrl = az webapp show --name $AppName --resource-group $ResourceGroupName --query defaultHostName --output tsv

Write-Host "✅ Deployment completed successfully!" -ForegroundColor Green
Write-Host "🌐 Your app is available at: https://$appUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Yellow
Write-Host "1. Set environment variables in Azure Portal"
Write-Host "2. Configure custom domain (optional)"
Write-Host "3. Set up SSL certificate"
Write-Host ""
Write-Host "🔧 To set environment variables, run:" -ForegroundColor Gray
Write-Host "az webapp config appsettings set --name $AppName --resource-group $ResourceGroupName --settings OPENAI_API_KEY='your-key' BACKEND_URL='your-backend-url'" 