import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const reportSchema = z.object({
  email: z.string().email('Email invalide'),
  type_probleme: z.string(),
  description: z.string().min(20, 'La description doit contenir au moins 20 caractères'),
  page: z.string().optional(),
});

type ReportData = z.infer<typeof reportSchema>;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request
    const validatedData = reportSchema.parse(body);
    const supabase = createClient();
    
    // Get current user if any
    const { data: { user } } = await supabase.auth.getUser();

    // Insert into DB
    const { error: dbError } = await supabase
      .from('support_tickets')
      .insert({
        utilisateur_id: user?.id || null,
        email: validatedData.email,
        type_probleme: validatedData.type_probleme,
        description: validatedData.description,
        page_url: validatedData.page || null,
      });

    if (dbError) {
      console.error('Erreur DB support_tickets:', dbError);
      throw new Error('Erreur lors de l\'enregistrement en base de données');
    }

    console.log('📋 Support Report saved to DB:', {
      timestamp: new Date().toISOString(),
      ...validatedData,
    });

    // TODO: Send email notification to systeme.info@ajc-mail.com
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
