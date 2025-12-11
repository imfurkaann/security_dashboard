import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './config/database';
import authRoutes from './routes/auth';
import vehicleRoutes from './routes/vehicles';
import visitorRoutes from './routes/visitors';
import managersRoutes from './routes/managers';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5174',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/visitors', visitorRoutes);
app.use('/api/managers', managersRoutes);

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
        status: 'OK',
        message: 'Security Management API is running',
        timestamp: new Date().toISOString()
    });
});

// Test database connection
app.get('/api/db-test', async (_req: Request, res: Response) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({
            status: 'OK',
            message: 'Database connected',
            timestamp: result.rows[0].now
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            message: 'Database connection failed',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// 404 handler
app.use((_req: Request, res: Response) => {
    res.status(404).json({
        status: 'ERROR',
        message: 'Route not found'
    });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: any) => {
    console.error('Error:', err.stack);
    res.status(500).json({
        status: 'ERROR',
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV}`);
    console.log(`🔗 API URL: http://localhost:${PORT}`);
});

export default app;
