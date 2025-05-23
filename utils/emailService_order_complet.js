import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

// Configure your email service (example using Gmail)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS  // Changed from EMAIL_PASSWORD to EMAIL_PASS to match sendEmail.js
  },
});

// Add debug logging
console.log('Email configuration:', {
  user: process.env.EMAIL_USER,
  pass: process.env.EMAIL_PASS ? 'Password is set' : 'Password is missing'
});

export async function sendThankYouEmail(userEmail, orderDetails) {
  try {
    const mailOptions = {
      from: `"Desi Tasty Cookies" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: 'Thank you for your order!',
      html: generateThankYouEmail(orderDetails),
    };

    await transporter.sendMail(mailOptions);
    console.log('Thank you email sent successfully');
  } catch (error) {
    console.error('Error sending thank you email:', error);
    // Don't throw error - email failure shouldn't fail the whole payment process
  }
}

function generateThankYouEmail(orderDetails) {
  const address = orderDetails.address;
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>/* your styles */</style>
    </head>
    <body>
      <div class="container">
        <!-- ... other content ... -->
        <div class="order-details">
          <h3>Shipping Details</h3>
          <p><strong>Name:</strong> ${address.firstName} ${address.lastName}</p>
          <p><strong>Address:</strong> ${address.houseDetails}, ${address.areaDetails}</p>
          <p><strong>City:</strong> ${address.city}, ${address.state} - ${address.pincode}</p>
          <p><strong>Phone:</strong> ${address.phone}</p>
        </div>
        <!-- ... rest of template ... -->
      </div>
    </body>
    </html>
  `;
}