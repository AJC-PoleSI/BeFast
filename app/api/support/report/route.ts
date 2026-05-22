import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const reportSchema = z.object({
  email: z.string().email('Email invalide'),
  subject: z.string().min(5, 'Le sujet doit contenir au moins 5 caractères'),
  description: z.string().min(20, 'La description doit contenir au moins 20 caractères'),
  page: z.string().optional(),
});

type ReportData = z.infer<typeof reportSchema>;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request
    const validatedData = reportSchema.parse(body);

    // Log the report (you can store it in a database later)
    console.log('📋 New Support Report:', {
      timestamp: new Date().toISOString(),
      ...validatedData,
    });

    // TODO: Send email notification to support.info@ajc-mail.com
    // when email service is configured

    return NextResponse.json(
      { success: true, message: 'Signalement envoyé avec succès' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Support report error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
