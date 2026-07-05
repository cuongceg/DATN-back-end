const brevo = require('@getbrevo/brevo');

const apiInstance = new brevo.TransactionalEmailsApi();
apiInstance.setApiKey(
  brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
);

function formatDateTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function buildEmailHtml({ recipientName, className, sessionTitle, scheduledAt, scheduledEndAt, teacherName }) {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Thông báo lịch học mới</h2>
      <p>Xin chào <strong>${recipientName}</strong>,</p>
      <p>Giáo viên <strong>${teacherName}</strong> vừa tạo một buổi học mới trong lớp <strong>${className}</strong>:</p>
      <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
        <tr>
          <td style="padding: 8px 12px; font-weight: bold; background: #f3f4f6;">Tiêu đề</td>
          <td style="padding: 8px 12px;">${sessionTitle}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; font-weight: bold; background: #f3f4f6;">Thời gian bắt đầu</td>
          <td style="padding: 8px 12px;">${formatDateTime(scheduledAt)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; font-weight: bold; background: #f3f4f6;">Thời gian kết thúc</td>
          <td style="padding: 8px 12px;">${formatDateTime(scheduledEndAt)}</td>
        </tr>
      </table>
      <p style="color: #6b7280; font-size: 13px;">Email này được gửi tự động, vui lòng không trả lời.</p>
    </div>
  `;
}

async function sendSessionScheduledEmail({ toList, session, className, teacherName }) {
  if (!toList || toList.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || 'EduApp';

  const results = await Promise.allSettled(
    toList.map(({ email, name }) => {
      const sendSmtpEmail = new brevo.SendSmtpEmail();
      sendSmtpEmail.subject = `[${className}] Lịch học mới: ${session.title}`;
      sendSmtpEmail.htmlContent = buildEmailHtml({
        recipientName: name,
        className,
        sessionTitle: session.title,
        scheduledAt: session.scheduled_at,
        scheduledEndAt: session.scheduled_end_at,
        teacherName,
      });
      sendSmtpEmail.sender = { name: senderName, email: senderEmail };
      sendSmtpEmail.to = [{ email, name }];
      return apiInstance.sendTransacEmail(sendSmtpEmail);
    })
  );

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  results
    .filter((r) => r.status === 'rejected')
    .forEach((r) => console.error('[email.service] Failed to send email:', r.reason?.message || r.reason));

  return { sent, failed };
}

module.exports = { sendSessionScheduledEmail };
