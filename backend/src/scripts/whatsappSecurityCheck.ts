import assert from 'assert';
import { normalizeWhatsAppGroupJid } from '../services/whatsappBaileys';
import { consumeWhatsAppSendTicket, issueWhatsAppSendTicket } from '../services/whatsappSendTicketStore';
import { createVehicleRecordMessage, createVisitorRecordMessage } from '../services/whatsapp';

const userA = '00000000-0000-4000-8000-000000000001';
const userB = '00000000-0000-4000-8000-000000000002';

const ticket = issueWhatsAppSendTicket('Güvenli bildirim', userA);
assert(ticket, 'Geçerli bildirim için bilet üretilmeli');
assert.strictEqual(consumeWhatsAppSendTicket(ticket, userB).success, false, 'Bilet başka kullanıcı tarafından tüketilememeli');
assert.deepStrictEqual(
    consumeWhatsAppSendTicket(ticket, userA),
    { success: true, message: 'Güvenli bildirim' },
    'Bilet yalnızca sahibi tarafından bir kez tüketilebilmeli'
);
assert.strictEqual(consumeWhatsAppSendTicket(ticket, userA).success, false, 'Tüketilen bilet tekrar kullanılamamalı');
assert.strictEqual(issueWhatsAppSendTicket('', userA), null, 'Boş mesaj için bilet üretilmemeli');
assert.strictEqual(issueWhatsAppSendTicket('x'.repeat(4_001), userA), null, 'Aşırı uzun mesaj reddedilmeli');

assert.strictEqual(normalizeWhatsAppGroupJid(' 120363000000000@g.us '), '120363000000000@g.us');
assert.strictEqual(normalizeWhatsAppGroupJid('12345@s.whatsapp.net'), null, 'Kişisel numara hedef grup olarak kabul edilmemeli');
assert.strictEqual(normalizeWhatsAppGroupJid('../../session'), null, 'Geçersiz JID reddedilmeli');

const vehicleMessage = createVehicleRecordMessage({
    vehiclePlate: '34 ABC 123',
    managerName: 'Adem\nÇelik',
    givenDate: '2026-08-18',
    givenTime: '09:30',
});
assert(vehicleMessage.includes('Tarih: 18.08.2026'), 'Araç mesajında tarih bulunmalı');
assert(!vehicleMessage.includes('Adem\nÇelik'), 'Alan içi satır sonları mesaj biçimini bozamamalı');

const visitorMessage = createVisitorRecordMessage({
    fullName: 'Test Ziyaretçi',
    entryDate: '2026-08-18',
    entryTime: '10:15',
});
assert(visitorMessage.includes('Tarih: 18.08.2026'), 'Ziyaretçi mesajında tarih bulunmalı');

console.log('WHATSAPP_SECURITY_CHECK_OK');
