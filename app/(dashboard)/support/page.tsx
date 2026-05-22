'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';

const reportSchema = z.object({
  email: z.string().email('Email invalide'),
  subject: z.string().min(5, 'Le sujet doit contenir au moins 5 caractères'),
  description: z.string().min(20, 'La description doit contenir au moins 20 caractères'),
  page: z.string().optional(),
});

type ReportFormData = z.infer<typeof reportSchema>;

export default function SupportPage() {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ReportFormData>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      email: '',
      subject: '',
      description: '',
      page: typeof window !== 'undefined' ? window.location.pathname : '',
    },
  });

  const onSubmit = async (data: ReportFormData) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/support/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de l\'envoi du signalement');
      }

      toast.success('Signalement envoyé avec succès. Merci pour votre retour!');
      form.reset();
    } catch (error) {
      toast.error('Erreur: ' + (error instanceof Error ? error.message : 'Impossible d\'envoyer le signalement'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Support & Signalements</h1>
        <p className="text-gray-600 mt-2">Signaler une erreur ou un problème sur le site</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Formulaire de Signalement</CardTitle>
          <CardDescription>
            Décrivez le problème que vous avez rencontré et nous nous en occuperons rapidement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <input
                        {...field}
                        type="email"
                        placeholder="votre@email.com"
                        className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sujet</FormLabel>
                    <FormControl>
                      <input
                        {...field}
                        type="text"
                        placeholder="Résumé du problème"
                        className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="page"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Page (optionnel)</FormLabel>
                    <FormControl>
                      <input
                        {...field}
                        type="text"
                        placeholder="URL de la page où le problème s'est produit"
                        className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </FormControl>
                    <FormDescription>Rempli automatiquement si possible</FormDescription>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description du problème</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Décrivez en détail le problème rencontré, les étapes pour le reproduire, messages d'erreur, etc."
                        rows={6}
                        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? 'Envoi en cours...' : 'Envoyer le signalement'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}