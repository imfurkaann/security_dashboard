import pool from '../config/database';
import { readSecret } from '../config/secrets';

const appRole = process.env.DB_APP_USER || 'security_app';
const auditOwnerRole = `${appRole}_audit_owner`;
const appPassword = readSecret('DB_PASSWORD', 'DB_PASSWORD_FILE');

if (!/^[a-z_][a-z0-9_]{0,62}$/.test(appRole)) {
    throw new Error('DB_APP_USER yalnızca küçük harf, rakam ve alt çizgi içerebilir');
}
if (!appPassword) throw new Error('Uygulama veritabanı parolası bulunamadı');

const run = async (): Promise<void> => {
    const client = await pool.connect();
    try {
        const currentRole = await client.query<{ role_name: string; rolsuper: boolean }>(
            'SELECT current_user AS role_name, rolsuper FROM pg_roles WHERE rolname = current_user'
        );
        if (currentRole.rows[0]?.rolsuper !== true) {
            throw new Error('Bu tek-seferlik işlem PostgreSQL yönetici bağlantısıyla çalıştırılmalıdır');
        }

        const quotedPassword = await client.query<{ value: string }>('SELECT quote_literal($1) AS value', [appPassword]);
        const quotedRole = `"${appRole.replace(/"/g, '""')}"`;
        const quotedAuditOwnerRole = `"${auditOwnerRole.replace(/"/g, '""')}"`;
        const quotedAdminRole = `"${currentRole.rows[0].role_name.replace(/"/g, '""')}"`;
        const roleExists = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [appRole]);

        await client.query('BEGIN');
        if (roleExists.rows.length === 0) {
            await client.query(
                `CREATE ROLE ${quotedRole} WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD ${quotedPassword.rows[0].value}`
            );
        } else {
            await client.query(
                `ALTER ROLE ${quotedRole} WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD ${quotedPassword.rows[0].value}`
            );
        }


        const auditOwnerExists = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [auditOwnerRole]);
        if (auditOwnerExists.rows.length === 0) {
            await client.query(`CREATE ROLE ${quotedAuditOwnerRole} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`);
        }

        const databaseName = await client.query<{ name: string }>('SELECT current_database() AS name');
        const quotedDatabase = `"${databaseName.rows[0].name.replace(/"/g, '""')}"`;
        await client.query(`GRANT CONNECT ON DATABASE ${quotedDatabase} TO ${quotedRole}`);
        await client.query(`GRANT USAGE, CREATE ON SCHEMA public TO ${quotedRole}`);
        await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${quotedRole}`);
        await client.query(`GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO ${quotedRole}`);
        await client.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${quotedRole}`);

        const relations = await client.query<{ schema_name: string; relation_name: string; relation_kind: string }>(
            `SELECT n.nspname AS schema_name, c.relname AS relation_name, c.relkind AS relation_kind
             FROM pg_class c
             JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public'
               AND c.relkind IN ('r', 'p', 'S', 'v', 'm')
               AND c.relname <> 'audit_log'`
        );
        for (const relation of relations.rows) {
            const schema = `"${relation.schema_name.replace(/"/g, '""')}"`;
            const name = `"${relation.relation_name.replace(/"/g, '""')}"`;
            const objectType = relation.relation_kind === 'S'
                ? 'SEQUENCE'
                : relation.relation_kind === 'v'
                    ? 'VIEW'
                    : relation.relation_kind === 'm'
                        ? 'MATERIALIZED VIEW'
                        : 'TABLE';
            await client.query(`ALTER ${objectType} ${schema}.${name} OWNER TO ${quotedRole}`);
        }

        await client.query(`ALTER TABLE public.audit_log OWNER TO ${quotedAuditOwnerRole}`);
        await client.query(`REVOKE ALL ON TABLE public.audit_log FROM ${quotedRole}`);
        await client.query(`GRANT SELECT, INSERT ON TABLE public.audit_log TO ${quotedRole}`);
        await client.query('ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_changed_by_fkey');
        await client.query(
            'ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.personnel(id) ON DELETE SET NULL'
        );

        // CREATE yetkisi migrationlar için yeterlidir; şema sahipliği uygulamaya
        // verilmez ki ele geçirilmiş uygulama rolü public şemasını silemesin.
        await client.query(`ALTER SCHEMA public OWNER TO ${quotedAdminRole}`);
        await client.query('COMMIT');
        console.log(JSON.stringify({ success: true, applicationRole: appRole, auditLogImmutable: true, superuser: false }));
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

run()
    .catch((error) => {
        console.error(error instanceof Error ? error.message : 'Uygulama veritabanı rolü oluşturulamadı');
        process.exitCode = 1;
    })
    .finally(() => pool.end());
