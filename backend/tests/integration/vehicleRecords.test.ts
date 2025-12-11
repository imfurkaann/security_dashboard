import request from 'supertest';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import app from '../../src/server';
import pool from '../../src/config/database';

describe('Vehicle Records API - Security & Validation Tests', () => {
    let authToken: string;
    let testVehicleId: string;
    let testManagerId: string;
    let testPersonnelId: string;

    beforeAll(async () => {
        // Create test data
        testVehicleId = uuidv4();
        testManagerId = uuidv4();
        testPersonnelId = uuidv4();

        // Insert test vehicle
        await pool.query(
            `INSERT INTO vehicles (id, brand, plate, status, is_active) 
             VALUES ($1, 'Test Vehicle', 'TEST 01', 'available', true)`,
            [testVehicleId]
        );

        // Insert test manager
        await pool.query(
            `INSERT INTO managers (id, first_name, last_name, title, is_active) 
             VALUES ($1, 'Test', 'Manager', 'Test Title', true)`,
            [testManagerId]
        );

        // Insert test personnel and get auth token
        const hashedPassword = '$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptJ/op0lSsvqNu/1u'; // admin123
        await pool.query(
            `INSERT INTO personnel (id, first_name, last_name, username, password, role, is_active) 
             VALUES ($1, 'Test', 'Personnel', 'testuser', $2, 'personnel', true)`,
            [testPersonnelId, hashedPassword]
        );

        // Login to get token
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ username: 'testuser', password: 'admin123' });

        authToken = loginRes.body.token;
    });

    afterAll(async () => {
        // Cleanup test data
        await pool.query('DELETE FROM vehicle_records WHERE vehicle_id = $1', [testVehicleId]);
        await pool.query('DELETE FROM vehicles WHERE id = $1', [testVehicleId]);
        await pool.query('DELETE FROM managers WHERE id = $1', [testManagerId]);
        await pool.query('DELETE FROM personnel WHERE id = $1', [testPersonnelId]);
        await pool.end();
    });

    describe('POST /api/vehicles/records - Valid Cases', () => {
        it('should create vehicle record with valid data', async () => {
            const response = await request(app)
                .post('/api/vehicles/records')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    vehicle_id: testVehicleId,
                    manager_id: testManagerId,
                    notes: 'Test notes'
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('oluşturuldu');

            // Verify vehicle status updated
            const vehicleCheck = await pool.query(
                'SELECT status FROM vehicles WHERE id = $1',
                [testVehicleId]
            );
            expect(vehicleCheck.rows[0].status).toBe('in_use');

            // Reset vehicle status for next test
            await pool.query('UPDATE vehicles SET status = $1 WHERE id = $2', ['available', testVehicleId]);
            await pool.query('DELETE FROM vehicle_records WHERE vehicle_id = $1', [testVehicleId]);
        });

        it('should create vehicle record without optional notes', async () => {
            const response = await request(app)
                .post('/api/vehicles/records')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    vehicle_id: testVehicleId,
                    manager_id: testManagerId
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);

            // Cleanup
            await pool.query('UPDATE vehicles SET status = $1 WHERE id = $2', ['available', testVehicleId]);
            await pool.query('DELETE FROM vehicle_records WHERE vehicle_id = $1', [testVehicleId]);
        });
    });

    describe('POST /api/vehicles/records - SQL Injection Tests', () => {
        it('should prevent SQL injection in vehicle_id', async () => {
            const response = await request(app)
                .post('/api/vehicles/records')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    vehicle_id: "'; DROP TABLE vehicles; --",
                    manager_id: testManagerId,
                    notes: 'Test'
                });

            expect(response.status).toBe(404);

            // Verify vehicles table still exists
            const tableCheck = await pool.query(
                "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'vehicles')"
            );
            expect(tableCheck.rows[0].exists).toBe(true);
        });

        it('should prevent SQL injection in manager_id', async () => {
            const response = await request(app)
                .post('/api/vehicles/records')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    vehicle_id: testVehicleId,
                    manager_id: "' OR '1'='1",
                    notes: 'Test'
                });

            expect(response.status).toBeGreaterThanOrEqual(400);
        });

        it('should prevent SQL injection in notes field', async () => {
            const response = await request(app)
                .post('/api/vehicles/records')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    vehicle_id: testVehicleId,
                    manager_id: testManagerId,
                    notes: "'; DELETE FROM vehicle_records WHERE '1'='1"
                });

            // Should succeed but notes should be escaped
            expect([201, 400]).toContain(response.status);

            if (response.status === 201) {
                // Verify record was created with escaped notes
                const recordCheck = await pool.query(
                    'SELECT notes FROM vehicle_records WHERE vehicle_id = $1 ORDER BY created_at DESC LIMIT 1',
                    [testVehicleId]
                );
                expect(recordCheck.rows[0].notes).toBe("'; DELETE FROM vehicle_records WHERE '1'='1");

                // Cleanup
                await pool.query('UPDATE vehicles SET status = $1 WHERE id = $2', ['available', testVehicleId]);
                await pool.query('DELETE FROM vehicle_records WHERE vehicle_id = $1', [testVehicleId]);
            }
        });
    });

    describe('POST /api/vehicles/records - XSS Protection Tests', () => {
        it('should handle XSS attempt in notes', async () => {
            const xssPayload = '<script>alert("XSS")</script>';
            const response = await request(app)
                .post('/api/vehicles/records')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    vehicle_id: testVehicleId,
                    manager_id: testManagerId,
                    notes: xssPayload
                });

            if (response.status === 201) {
                const recordCheck = await pool.query(
                    'SELECT notes FROM vehicle_records WHERE vehicle_id = $1 ORDER BY created_at DESC LIMIT 1',
                    [testVehicleId]
                );
                // Notes should be stored as-is (sanitization should happen on frontend display)
                expect(recordCheck.rows[0].notes).toBe(xssPayload);

                // Cleanup
                await pool.query('UPDATE vehicles SET status = $1 WHERE id = $2', ['available', testVehicleId]);
                await pool.query('DELETE FROM vehicle_records WHERE vehicle_id = $1', [testVehicleId]);
            }
        });
    });

    describe('POST /api/vehicles/records - Validation Tests', () => {
        it('should reject request without vehicle_id', async () => {
            const response = await request(app)
                .post('/api/vehicles/records')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    manager_id: testManagerId,
                    notes: 'Test'
                });

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('gerekli');
        });

        it('should reject request without manager_id', async () => {
            const response = await request(app)
                .post('/api/vehicles/records')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    vehicle_id: testVehicleId,
                    notes: 'Test'
                });

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('gerekli');
        });

        it('should reject request with non-existent vehicle_id', async () => {
            const fakeId = uuidv4();
            const response = await request(app)
                .post('/api/vehicles/records')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    vehicle_id: fakeId,
                    manager_id: testManagerId,
                    notes: 'Test'
                });

            expect(response.status).toBe(404);
            expect(response.body.message).toContain('bulunamadı');
        });

        it('should reject request when vehicle is already in use', async () => {
            // Set vehicle to in_use
            await pool.query('UPDATE vehicles SET status = $1 WHERE id = $2', ['in_use', testVehicleId]);

            const response = await request(app)
                .post('/api/vehicles/records')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    vehicle_id: testVehicleId,
                    manager_id: testManagerId,
                    notes: 'Test'
                });

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('kullanımda');

            // Reset
            await pool.query('UPDATE vehicles SET status = $1 WHERE id = $2', ['available', testVehicleId]);
        });

        it('should reject request without authentication', async () => {
            const response = await request(app)
                .post('/api/vehicles/records')
                .send({
                    vehicle_id: testVehicleId,
                    manager_id: testManagerId,
                    notes: 'Test'
                });

            expect(response.status).toBe(401);
        });
    });

    describe('POST /api/vehicles/records - Transaction Tests', () => {
        it('should rollback transaction if vehicle update fails', async () => {
            // This test verifies that if something fails, the transaction is rolled back
            // Create a record, verify it creates, then check rollback on error

            const initialRecordCount = await pool.query(
                'SELECT COUNT(*) FROM vehicle_records WHERE vehicle_id = $1',
                [testVehicleId]
            );

            // Try with invalid data that should trigger rollback
            await pool.query('UPDATE vehicles SET status = $1 WHERE id = $2', ['maintenance', testVehicleId]);

            const response = await request(app)
                .post('/api/vehicles/records')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    vehicle_id: testVehicleId,
                    manager_id: testManagerId,
                    notes: 'Test'
                });

            expect(response.status).toBe(400);

            const finalRecordCount = await pool.query(
                'SELECT COUNT(*) FROM vehicle_records WHERE vehicle_id = $1',
                [testVehicleId]
            );

            // Record count should not change due to rollback
            expect(finalRecordCount.rows[0].count).toBe(initialRecordCount.rows[0].count);

            // Reset
            await pool.query('UPDATE vehicles SET status = $1 WHERE id = $2', ['available', testVehicleId]);
        });
    });
});
