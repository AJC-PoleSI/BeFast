'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';

interface SupportReport {
  email: string;
  type_probleme: string;
  description: string;
  page?: string;
}

export default function SupportPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<SupportReport>({
    email: '',
    type_probleme: 'Bug technique',
    description: '',
    page: typeof window !== 'undefined' ? window.location.pathname : '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleTypeChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      type_probleme: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.type_probleme || !formData.description) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (formData.description.length < 20) {
      toast.error('La description doit contenir au moins 20 caractères');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/support/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de l\'envoi du signalement');
      }

      toast.success('Signalement envoyé avec succès. Merci pour votre retour!');
      setFormData({
        email: '',
        type_probleme: 'Bug technique',
        description: '',
        page: typeof window !== 'undefined' ? window.location.pathname : '',
      });
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
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="votre@email.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-3">
              <Label>Type de problème</Label>
              <RadioGroup
                value={formData.type_probleme}
                onValueChange={handleTypeChange}
                className="flex flex-col space-y-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Bug technique" id="type-bug" />
                  <Label htmlFor="type-bug" className="font-normal cursor-pointer">Bug technique</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Erreur d'affichage" id="type-affichage" />
                  <Label htmlFor="type-affichage" className="font-normal cursor-pointer">Erreur d'affichage</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Lenteur / Performance" id="type-lenteur" />
                  <Label htmlFor="type-lenteur" className="font-normal cursor-pointer">Lenteur / Performance</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Autre" id="type-autre" />
                  <Label htmlFor="type-autre" className="font-normal cursor-pointer">Autre</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="page">Page (optionnel)</Label>
              <Input
                id="page"
                name="page"
                type="text"
                placeholder="URL de la page où le problème s'est produit"
                value={formData.page}
                onChange={handleChange}
              />
              <p className="text-sm text-gray-500">Rempli automatiquement si possible</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description du problème</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Décrivez en détail le problème rencontré, les étapes pour le reproduire, messages d'erreur, etc."
                value={formData.description}
                onChange={handleChange}
                rows={6}
                required
              />
            </div>

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? 'Envoi en cours...' : 'Envoyer le signalement'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
