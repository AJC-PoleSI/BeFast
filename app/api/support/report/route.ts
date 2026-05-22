import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const reportSchema = z.object({
  email: z.string().email(),
  subject: z.string().min(5),
  description: z.string().min(20),
  page: z.string().optional(),
});

const SUPPORT_EMAIL = 'support.info@ajc-mail.com';

async function sendEmail(to: string, subject: string, html: string) {
  // Option 1: Using Resend (recommended for Vercel)
  if (process.env.RESEND_API_KEY) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'noreply@ajc.fr',
        to,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to send email with Resend');
    }
    return response.json();
  }

  // Option 2: Using Node.js Mailer (requires SMTP configuration)
  if (process.env.SMTP_HOST) {
    const nodemailer = require('nodemailer');

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    return await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@ajc.fr',
      to,
      subject,
      html,
    });
  }

  throw new Error('Email service not configured. Please set RESEND_API_KEY or SMTP_* environment variables.');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request
    const validatedData = reportSchema.parse(body);

    // Build email content
    const emailHtml = `
      <h2>Nouveau Signalement d'Erreur</h2>
      <p><strong>De:</strong> ${validatedData.email}</p>
      <p><strong>Sujet:</strong> ${validatedData.subject}</p>
      ${validatedData.page ? `<p><strong>Page:</strong> ${validatedData.page}</p>` : ''}
      <h3>Description:</h3>
      <p>${validatedData.description.replace(/\n/g, '<br>')}</p>
      <hr>
      <p style="color: #666; font-size: 12px;">
        Signalement reçu via le système de support du site.
      </p>
    `;

    // Send email to support
    await sendEmail(
      SUPPORT_EMAIL,
      `[Support] ${validatedData.subject}`,
      emailHtml
    );

    // Optionally send confirmation to user
    const userConfirmationHtml = `
      <h2>Merci pour votre signalement</h2>
      <p>Votre signalement a bien été reçu. Notre équipe l'examinera et vous répondra dès que possible.</p>
      <p><strong>Sujet:</strong> ${validatedData.subject}</p>
      <p>Référence: ${new Date().toISOString()}</p>
    `;

    try {
      await sendEmail(
        validatedData.email,
        'Confirmation: Signalement reçu',
        userConfirmationHtml
      );
    } catch (error) {
      console.error('Failed to send confirmation email to user:', error);
      // Don't fail the request if confirmation email fails
    }

    return NextResponse.json(
      { success: true, message: 'Signalement envoyé avec succès' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Support report error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
