-- Fix Turkish characters in managers table
DELETE FROM managers;

INSERT INTO managers (first_name, last_name, title) VALUES
('Ali', 'Demir', 'Genel Müdür'),
('Ayşe', 'Çelik', 'İşletme Müdürü'),
('Fatma', 'Şahin', 'Pazarlama Müdürü'),
('Mustafa', 'Öztürk', 'Teknik Müdür');
