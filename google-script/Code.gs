/**
 * PhotoMarket — email yuboruvchi Google Apps Script (veb-ilova).
 * Backend shu manzilga POST qiladi: { key, to, subject, html, text, name }.
 * Maxfiy kalit "Script properties" da (MAIL_KEY) saqlanadi — kodga yozilmaydi.
 */
function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    var secret = PropertiesService.getScriptProperties().getProperty('MAIL_KEY');
    if (!secret || d.key !== secret) return out_({ ok: false, error: 'forbidden' });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(d.to || ''))) return out_({ ok: false, error: 'bad_to' });
    if (!d.subject || !d.text) return out_({ ok: false, error: 'empty' });
    MailApp.sendEmail({
      to: String(d.to),
      subject: String(d.subject).slice(0, 200),
      body: String(d.text),
      htmlBody: d.html ? String(d.html) : undefined,
      name: String(d.name || 'PhotoMarket').slice(0, 60),
    });
    return out_({ ok: true });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
}

function doGet() { return out_({ ok: true, service: 'photomarket-mail' }); }

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/** Bir marta qo'lda ishga tushiring (▶ Run): Gmail yuborish ruxsatini so'raydi. */
function authorize() {
  MailApp.sendEmail(Session.getActiveUser().getEmail(), 'PhotoMarket sinov', 'Google Script ishlayapti.');
}
