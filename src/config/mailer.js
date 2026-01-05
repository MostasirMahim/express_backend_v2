import nodemailer from "nodemailer";
import "dotenv/config";
import nodemailer from "nodemailer";
import path from "path";
import handlebars from "handlebars";

export const sendOtpMail = async (email, otp) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.MAIL_USER,
    to: email,
    subject: "Password reset OTP",
    html: `<p>Your OTP for password reset is: <b>${otp}</b>. It is valid for 10 minutes.</p>`,
  };

  await transporter.sendMail(mailOptions);
};



export const verifyMail = async (token, email) => {
  const EMAIL_TEMPLATE_DIR = path.join(process.cwd(), "src", "views");
  const templatePath = path.join(EMAIL_TEMPLATE_DIR, "template.hbs");

  const template = handlebars.compile(templatePath);
  const htmlToSend = template({ token: encodeURIComponent(token) });

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

  const mailConfigurations = {
    from: process.env.MAIL_USER,
    to: email,
    subject: "Email Verification",
    html: htmlToSend,
  };

  transporter.sendMail(mailConfigurations, function (error, info) {
    if (error) {
      throw new Error(error);
    }
    console.log("Email sent successfully");
    console.log(info);
  });
};