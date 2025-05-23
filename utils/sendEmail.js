import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

export const sendThankYouEmail = async   (toEmail, userName) => {
 
  const mailOptions = {
    from: `"Desi Tasty Cookies" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Thank You for Your Feedback!',
    html: `<div style="font-family: Arial, sans-serif; background-color: #fffaf3; padding: 20px; border-radius: 10px; max-width: 600px; margin: auto; border: 1px solid #f3e2c7;">
  <div style="text-align: center;">
    
    <h2 style="color: #b36b00;">Thank You, <span style="color: #d2691e;">${userName}</span>!</h2>
  </div>

  <p style="font-size: 16px; color: #333;">
    We're super grateful for your feedback! Your thoughts help us bake better and spread more cookie love. 🍪💛
  </p>

  <p style="font-size: 16px; color: #333;">
    Here's a virtual cookie just for you. But don’t worry — real ones are on their way next time you order! 😉
  </p>

  <div style="text-align: center; margin: 30px 0;">
    
  </div>

  <p style="font-size: 14px; color: #777;">
    Stay connected with us for more delicious bites and offers.
  </p>

  <p style="text-align: center; margin-top: 30px;">
    With love, <br/>
    <strong>Desi Testy Cookies 🍪</strong>
  </p>
</div>
`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Email sent to', toEmail);
  } catch (err) {
    console.error('Error sending email:', err.message);
  }
};
