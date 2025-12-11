UPDATE users 
SET password_hash = '$2a$10$oEF3m6uA286S6elSTo.7eOtVprI8ZiwJME5vmpEK3vjcBAGoS7r1q' 
WHERE username IN ('admin', 'manager1', 'manager2', 'guvenlik1', 'guvenlik2', 'guvenlik3');

SELECT username, password_hash, role FROM users ORDER BY role, username;
