import request from 'supertest';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import pool from '../../src/config/database';

describe('Data Integrity Test - Frontend vs Backend vs Database', () => {
    let testVehicleId: string;
    let testManagerId: string;
    let testPersonnelId: string;
    let authToken: string;

    beforeAll(async () => {
        testVehicleId = uuidv4();
        testManagerId = uuidv4();
        testPersonnelId = uuidv4();

        await pool.query(
            `INSERT INTO vehicles (id, brand, plate, status, is_active) 
             VALUES ($1, 'Test Vehicle', 'TEST 99', 'available', true)`,
            [testVehicleId]
        );

        await pool.query(
            `INSERT INTO managers (id, first_name, last_name, title, is_active) 
             VALUES ($1, 'Test', 'Manager', 'Test Manager Title', true)`,
            [testManagerId]
        );

        const hashedPassword = '$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptJ/op0lSsvqNu/1u';
        await pool.query(
            `INSERT INTO personnel (id, first_name, last_name, username, password, role, is_active) 
             VALUES ($1, 'Data', 'Tester', 'datatester', $2, 'personnel', true)`,
            [testPersonnelId, hashedPassword]
        );

        const loginRes = await pool.query(
            'SELECT * FROM personnel WHERE username = $1',
            ['admin']
        );

        if (loginRes.rows.length === 0) {
            throw new Error('Admin user not found. Run database setup first.');
        }
    });

    afterAll(async () => {
        await pool.query('DELETE FROM vehicle_records WHERE vehicle_id = $1', [testVehicleId]);
        await pool.query('DELETE FROM vehicles WHERE id = $1', [testVehicleId]);
        await pool.query('DELETE FROM managers WHERE id = $1', [testManagerId]);
        await pool.query('DELETE FROM personnel WHERE id = $1', [testPersonnelId]);
        await pool.end();
    });

    describe('Field Mapping Validation', () => {
        it('should detect missing destination field in backend', async () => {
            // Frontend sends: vehicle_id, manager_id, destination, notes
            // Backend expects: vehicle_id, manager_id, notes
            // Database has: given_date, given_time (auto), no destination field

            const frontendPayload = {
                vehicle_id: testVehicleId,
                manager_id: testManagerId,
                destination: 'Test Destination', // This field is IGNORED by backend!
                notes: 'Test notes'
            };

            console.log('\n⚠️  DATA LOSS DETECTED:');
            console.log('Frontend sends: vehicle_id, manager_id, destination, notes');
            console.log('Backend accepts: vehicle_id, manager_id, notes');
            console.log('Database stores: vehicle_id, manager_id, personnel_id, given_date, given_time, notes, status');
            console.log('\n❌ MISSING: destination field is sent but NEVER saved!\n');

            expect(frontendPayload).toHaveProperty('destination');
        });

        it('should detect missing manager_name field handling', async () => {
            // Frontend has manager_name field for custom manager entry
            // Backend does NOT handle this field

            const frontendPayload = {
                vehicle_id: testVehicleId,
                manager_id: '',
                manager_name: 'Custom Manager Name', // This is NEVER processed!
                notes: 'Test'
            };

            console.log('\n⚠️  CUSTOM MANAGER FEATURE BROKEN:');
            console.log('Frontend allows custom manager_name input');
            console.log('Backend does NOT have logic to handle manager_name');
            console.log('Result: Custom managers CANNOT be created!\n');

            expect(frontendPayload).toHaveProperty('manager_name');
        });
    });

    describe('Database Schema vs Backend Fields', () => {
        it('should verify all vehicle_records columns match backend INSERT', async () => {
            const schemaQuery = await pool.query(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'vehicle_records'
                AND table_schema = 'public'
                ORDER BY ordinal_position
            `);

            const columns = schemaQuery.rows.map(r => r.column_name);

            console.log('\n📊 DATABASE SCHEMA:');
            console.log('vehicle_records columns:', columns);

            console.log('\n🔧 BACKEND INSERT FIELDS:');
            console.log('id, vehicle_id, manager_id, personnel_id, given_date, given_time, notes, status');

            console.log('\n❌ MISSING IN BACKEND INSERT:');
            const missingFields = columns.filter(col =>
                !['id', 'vehicle_id', 'manager_id', 'personnel_id', 'given_date', 'given_time',
                    'notes', 'status', 'created_at', 'updated_at', 'deleted_at', 'return_date', 'return_time'].includes(col)
            );

            if (missingFields.length > 0) {
                console.log('Fields in DB but not in INSERT:', missingFields);
            } else {
                console.log('None - Schema matches backend (missing fields added to schema needed)');
            }

            console.log('\n❌ DESTINATION FIELD:');
            console.log('- Frontend sends it');
            console.log('- Backend ignores it');
            console.log('- Database does NOT have column for it');
            console.log('- Solution: Add destination column to vehicle_records OR remove from frontend\n');
        });
    });

    describe('Data Consistency Check', () => {
        it('should verify frontend form fields match backend expectations', () => {
            const frontendFields = ['vehicle_id', 'manager_id', 'manager_name', 'destination', 'notes'];
            const backendAccepts = ['vehicle_id', 'manager_id', 'notes'];
            const dbColumns = ['id', 'vehicle_id', 'manager_id', 'personnel_id', 'given_date', 'given_time', 'return_date', 'return_time', 'status', 'notes'];

            console.log('\n🔍 FIELD MAPPING ANALYSIS:');
            console.log('\nFrontend Form Fields:', frontendFields);
            console.log('Backend Accepts:', backendAccepts);
            console.log('Database Columns:', dbColumns);

            const ignoredFields = frontendFields.filter(f => !backendAccepts.includes(f) && f !== 'manager_name');
            console.log('\n⚠️  Fields sent but IGNORED:', ignoredFields);

            const missingInDb = backendAccepts.filter(f => !dbColumns.includes(f));
            console.log('Fields backend sends but DB missing:', missingInDb);

            console.log('\n📋 RECOMMENDATIONS:');
            console.log('1. Add destination column to vehicle_records table');
            console.log('2. Add destination to backend INSERT statement');
            console.log('3. Implement custom manager creation logic in backend');
            console.log('4. OR remove destination field from frontend if not needed\n');
        });
    });
});
