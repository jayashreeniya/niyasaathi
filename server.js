const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            scriptSrc: ["'self'", "https://www.gstatic.com", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "http://localhost:5000", "https://api.niyasaathi.com"]
        }
    }
}));

// Compression middleware
app.use(compression());

// CORS middleware
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://niyasaathi.com', 'https://www.niyasaathi.com']
        : ['http://localhost:3000', 'http://localhost:8000'],
    credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, 'frontend')));

// API proxy routes
app.use('/api', (req, res, next) => {
    // Proxy API calls to the backend
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    req.url = req.url.replace('/api', '');
    
    // Forward the request to the backend
    const { createProxyMiddleware } = require('http-proxy-middleware');
    const proxy = createProxyMiddleware({
        target: backendUrl,
        changeOrigin: true,
        pathRewrite: {
            '^/api': ''
        }
    });
    
    proxy(req, res, next);
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Serve the main app for all other routes (SPA routing)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

app.listen(PORT, () => {
    console.log(`🚀 NIYAsaathi webapp running on port ${PORT}`);
    console.log(`📱 Frontend: http://localhost:${PORT}`);
    console.log(`🔗 Backend API: ${process.env.BACKEND_URL || 'http://localhost:5000'}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
}); 