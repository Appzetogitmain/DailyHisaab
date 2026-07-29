import express from "express";
import router from './router/router.js'
import dotenv from 'dotenv';
import cors from 'cors';
import { requestLogger } from './middleware/requestLogger.js';
// Import cron jobs - automatically starts when imported
import './cron/smartTriggersCron.js';

dotenv.config();
var app = express();

// CORS configuration
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);

        const allowedOrigins = [
            'http://localhost:5173',
            'http://localhost:3000',
            'http://localhost:8080',
            'https://daily-hisab-admin-panel.vercel.app',
            'https://appzetoapp.com',
            'http://appzetoapp.com',
            'https://www.appzetoapp.com',
            'http://www.appzetoapp.com',
            'https://admin.dailyhisab.co.in',
            'http://admin.dailyhisab.co.in',
            'https://dailyhisab.co.in',
            'http://dailyhisab.co.in',
        ];

        if (allowedOrigins.indexOf(origin) !== -1 || origin.includes('dailyhisab.co.in') || origin.includes('appzetoapp.com')) {
            callback(null, true);
        } else {
            callback(null, true);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Content-Type', 'Authorization'],
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use("/images", express.static("images"));

// ENABLE THIS LINE TO DEBUG REQUESTS (Comment out after debugging)
// app.use(requestLogger);

app.use("/daliyhisab/server", router);

// Global error handler
app.use((error, req, res, next) => {
    console.error('Global error handler:', error);
    res.status(500).json({
        success: false,
        msg: ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
        error: error.message || 'Unknown error'
    });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

app.listen(process.env.PORT, () => {
    console.log("Server started at port : ", process.env.PORT);
})