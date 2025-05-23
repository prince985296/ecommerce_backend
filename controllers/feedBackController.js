import db from '../config/db.js';
import { sendThankYouEmail } from '../utils/sendEmail.js';

export const submitFeedback = async (req, res) => {
  const { full_name, email, phone, message,rating } = req.body;
  console.log(full_name , email)


  if (!full_name || !email || !message) {
    return res.status(400).json({ error: 'Please fill all required fields' });
  }

  try {
    await db.query(
      'INSERT INTO feedback (full_name, email, phone, message, rating) VALUES (?, ?, ?, ?, ?)',
      [full_name, email, phone, message, rating]
    );

    await sendThankYouEmail(email, full_name);
  

    res.status(200).json({ message: 'Feedback submitted and email sent successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
export const viewfeedbackinAdminPanal= async(req, res)=> {
  try {
    const result = await db.query('select * from feedback');
    if(result.length > 0){
      res.json(result)
    } else {
      res.status(404).json({ message: 'No feedback found' })
    }

  } catch (error) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

