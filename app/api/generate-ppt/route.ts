import { NextResponse } from 'next/server';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import fs from 'fs';
import path from 'path';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeBudget } from '@/lib/budget/compute';

/**
 * PowerPoint stocke parfois les balises {TAG} en plusieurs fragments XML séparés.
 * Ex: <r><t>{NOM_</t></r><r><t>PHASE}</t></r>
 * Cette fonction nettoie le XML pour reconstruire les balises entières sur un seul fragment.
 */
function fixBrokenTags(content: string): string {
  return content.replace(
    /\{([^}]*?)<\/[^>]+>(?:<[^>]+>)*([^{]*?)\}/g,
    (match, before, after) => {
      const tagContent = (before + after).replace(/<[^>]*>/g, '').trim();
      if (/^[#/]?[A-Z_a-z][A-Z_a-z0-9]*$/.test(tagContent)) {
        return `{${tagContent}}`;
      }
      return match;
    }
  );
}

/**
 * Échappe les caractères spéciaux XML pour éviter de corrompre le fichier PPTX.
 */
function escapeXml(unsafe: any): string {
  if (unsafe === null || unsafe === undefined) return '';
  const str = String(unsafe);
  return str.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

/**
 * Modifie le texte d'une zone de texte PowerPoint identifiée par son nom.
 * Cette fonction remplace tout le contenu textuel par un paragraphe propre pour éviter les coupures de PowerPoint.
 */
function setShapeText(xmlStr: string, shapeName: string, text: string): string {
  // Regex pour trouver le conteneur du TextBox par son nom unique et isoler sa zone de texte <p:txBody>
  const shapeRegex = new RegExp(`(<p:sp>(?:(?!</p:sp>)[\\s\\S])*?name="${shapeName}"(?:(?!</p:sp>)[\\s\\S])*?<p:txBody>(?:(?!</p:sp>)[\\s\\S])*?)(<a:p>(?:(?!</p:txBody>)[\\s\\S])*?</p:txBody>)`);
  const match = xmlStr.match(shapeRegex);
  if (!match) {
    console.warn(`[PPT] Shape de texte "${shapeName}" introuvable pour remplacement de texte.`);
    return xmlStr;
  }
  
  // Reconstruire un paragraphe propre avec le texte échappé aux couleurs AJC
  const newParagraphs = `
            <a:p>
              <a:pPr algn="ctr"/>
              <a:r>
                <a:rPr lang="fr-FR" sz="1200" b="1">
                  <a:solidFill><a:srgbClr val="002C5A"/></a:solidFill>
                  <a:latin typeface="Montserrat"/>
                </a:rPr>
                <a:t>${escapeXml(text)}</a:t>
              </a:r>
            </a:p>
          </p:txBody>`;
  
  return xmlStr.replace(match[0], match[1] + newParagraphs);
}

function generateBudgetTableXml(phases: any[], suiviJeh: number, suiviHt: number, suiviTtc: number, totalHt: number, totalTtc: number, x: number, y: number, cx: number, cy: number, tvaMult: number = 1.2): string {
  // Proportions aérées et centrées : largeur totale = 16 000 000 EMUs
  const tblGrid = `
    <a:tblGrid>
      <a:gridCol w="6500000"/>
      <a:gridCol w="2500000"/>
      <a:gridCol w="3500000"/>
      <a:gridCol w="3500000"/>
    </a:tblGrid>
  `;

  let rowsXml = `
    <a:tr h="685800">
      <a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR" sz="1300" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="Montserrat"/></a:rPr><a:t>PHASE</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="002C5A"/></a:solidFill></a:tcPr></a:tc>
      <a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="fr-FR" sz="1300" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="Montserrat"/></a:rPr><a:t>JEH</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="002C5A"/></a:solidFill></a:tcPr></a:tc>
      <a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="r"/><a:r><a:rPr lang="fr-FR" sz="1300" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="Montserrat"/></a:rPr><a:t>PRIX HT</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="002C5A"/></a:solidFill></a:tcPr></a:tc>
      <a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="r"/><a:r><a:rPr lang="fr-FR" sz="1300" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="Montserrat"/></a:rPr><a:t>PRIX TTC</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="002C5A"/></a:solidFill></a:tcPr></a:tc>
    </a:tr>
  `;

  for (let i = 0; i < phases.length; i++) {
    const p = phases[i];
    const htVal = (p.jehCount || p.jeh_count || 0) * (p.jehPrice || p.jeh_price || 0);
    const ttcVal = htVal * tvaMult;
    rowsXml += `
      <a:tr h="457200">
        <a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR" sz="1200"><a:solidFill><a:srgbClr val="333333"/></a:solidFill><a:latin typeface="Montserrat"/></a:rPr><a:t>${escapeXml(p.name || `Phase ${i + 1}`)}</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="F5F8FF"/></a:solidFill></a:tcPr></a:tc>
        <a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="fr-FR" sz="1200"><a:solidFill><a:srgbClr val="333333"/></a:solidFill><a:latin typeface="Montserrat"/></a:rPr><a:t>${p.jehCount || p.jeh_count || 0}</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="F5F8FF"/></a:solidFill></a:tcPr></a:tc>
        <a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="r"/><a:r><a:rPr lang="fr-FR" sz="1200"><a:solidFill><a:srgbClr val="333333"/></a:solidFill><a:latin typeface="Montserrat"/></a:rPr><a:t>${htVal.toLocaleString('fr-FR')} €</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="F5F8FF"/></a:solidFill></a:tcPr></a:tc>
        <a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="r"/><a:r><a:rPr lang="fr-FR" sz="1200"><a:solidFill><a:srgbClr val="333333"/></a:solidFill><a:latin typeface="Montserrat"/></a:rPr><a:t>${ttcVal.toLocaleString('fr-FR')} €</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="F5F8FF"/></a:solidFill></a:tcPr></a:tc>
      </a:tr>
    `;
  }

  // Ligne Suivi Chef de Projet (police normale sans italique)
  rowsXml += `
    <a:tr h="457200">
      <a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR" sz="1200"><a:solidFill><a:srgbClr val="555555"/></a:solidFill><a:latin typeface="Montserrat"/></a:rPr><a:t>Suivi Chef de Projet</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="EEF2FA"/></a:solidFill></a:tcPr></a:tc>
      <a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="fr-FR" sz="1200"><a:solidFill><a:srgbClr val="555555"/></a:solidFill><a:latin typeface="Montserrat"/></a:rPr><a:t>${suiviJeh}</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="EEF2FA"/></a:solidFill></a:tcPr></a:tc>
      <a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="r"/><a:r><a:rPr lang="fr-FR" sz="1200"><a:solidFill><a:srgbClr val="555555"/></a:solidFill><a:latin typeface="Montserrat"/></a:rPr><a:t>${suiviHt.toLocaleString('fr-FR')} €</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="EEF2FA"/></a:solidFill></a:tcPr></a:tc>
      <a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="r"/><a:r><a:rPr lang="fr-FR" sz="1200"><a:solidFill><a:srgbClr val="555555"/></a:solidFill><a:latin typeface="Montserrat"/></a:rPr><a:t>${suiviTtc.toLocaleString('fr-FR')} €</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="EEF2FA"/></a:solidFill></a:tcPr></a:tc>
    </a:tr>
  `;

  // Unique ligne de TOTAL fusionnant HT et TTC en rouge premium (E34670)
  rowsXml += `
    <a:tr h="609600">
      <a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR" sz="1600" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="Montserrat"/></a:rPr><a:t>TOTAL</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="E34670"/></a:solidFill></a:tcPr></a:tc>
      <a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="fr-FR"/></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="E34670"/></a:solidFill></a:tcPr></a:tc>
      <a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="r"/><a:r><a:rPr lang="fr-FR" sz="1600" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="Montserrat"/></a:rPr><a:t>${totalHt.toLocaleString('fr-FR')} € HT</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="E34670"/></a:solidFill></a:tcPr></a:tc>
      <a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="r"/><a:r><a:rPr lang="fr-FR" sz="1600" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="Montserrat"/></a:rPr><a:t>${totalTtc.toLocaleString('fr-FR')} € TTC</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="E34670"/></a:solidFill></a:tcPr></a:tc>
    </a:tr>
  `;

  return `
    <p:graphicFrame>
      <p:nvGraphicFramePr>
        <p:cNvPr id="101" name="TableBudget"/>
        <p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr>
        <p:nvPr/>
      </p:nvGraphicFramePr>
      <p:xfrm>
        <a:off x="${x}" y="${y}"/>
        <a:ext cx="${cx}" cy="${cy}"/>
      </p:xfrm>
      <a:graphic>
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">
          <a:tbl>
            <a:tblPr firstRow="1" bandRow="1">
              <a:tableStyleId>{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}</a:tableStyleId>
            </a:tblPr>
            ${tblGrid}
            ${rowsXml}
          </a:tbl>
        </a:graphicData>
      </a:graphic>
    </p:graphicFrame>
  `;
}

function generateGanttTableXml(phases: any[], phaseWeeks: any[], numWeeks: number, weekColWidth: number, x: number, y: number, cx: number, cy: number): string {
  // Le planning complet intègre systématiquement : 1 sem Préparation + numWeeks d'études + 1 sem Finalisation
  const totalWeeks = numWeeks + 2;
  
  let tblGrid = '<a:tblGrid><a:gridCol w="4000000"/><a:gridCol w="1200000"/>';
  for (let w = 1; w <= totalWeeks; w++) {
    tblGrid += `<a:gridCol w="${weekColWidth}"/>`;
  }
  tblGrid += '</a:tblGrid>';

  let trHeader = `<a:tr h="600000">`;
  trHeader += `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR" sz="1300" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="Montserrat"/></a:rPr><a:t>PHASES DE L&apos;ÉTUDE</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="002C5A"/></a:solidFill></a:tcPr></a:tc>`;
  trHeader += `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="fr-FR" sz="1300" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="Montserrat"/></a:rPr><a:t>DURÉE</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="002C5A"/></a:solidFill></a:tcPr></a:tc>`;
  
  // En-tête des semaines
  trHeader += `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="fr-FR" sz="1000" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="Montserrat"/></a:rPr><a:t>PRÉPA</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="002C5A"/></a:solidFill></a:tcPr></a:tc>`;
  for (let w = 1; w <= numWeeks; w++) {
    trHeader += `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="fr-FR" sz="1100" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="Montserrat"/></a:rPr><a:t>S${w}</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="002C5A"/></a:solidFill></a:tcPr></a:tc>`;
  }
  trHeader += `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="fr-FR" sz="1000" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="Montserrat"/></a:rPr><a:t>BILAN</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="002C5A"/></a:solidFill></a:tcPr></a:tc>`;
  trHeader += `</a:tr>`;

  let rowsXml = trHeader;

  // 1. Ligne de Préparation (Semaine 1) - Coloriée en Or soft
  let prepRow = `<a:tr h="550000">`;
  prepRow += `<a:tc><a:txBody><a:bodyPr lIns="100000" rIns="100000" tIns="50000" bIns="50000"/><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR" sz="1100" b="1"><a:solidFill><a:srgbClr val="002C5A"/></a:solidFill><a:latin typeface="Montserrat"/></a:rPr><a:t>Préparation &amp; Recrutement</a:t></a:r></a:p></a:txBody><a:tcPr anchor="ctr"><a:solidFill><a:srgbClr val="F5F8FF"/></a:solidFill></a:tcPr></a:tc>`;
  prepRow += `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="fr-FR" sz="1100"><a:solidFill><a:srgbClr val="333333"/></a:solidFill><a:latin typeface="Montserrat"/></a:rPr><a:t>1 sem.</a:t></a:r></a:p></a:txBody><a:tcPr anchor="ctr"><a:solidFill><a:srgbClr val="F5F8FF"/></a:solidFill></a:tcPr></a:tc>`;
  
  // Semaine de prépa coloriée en Or soft (D4AF37)
  prepRow += `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:endParaRPr lang="fr-FR"/></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="D4AF37"/></a:solidFill></a:tcPr></a:tc>`;
  
  // Les autres semaines restent blanches
  for (let w = 1; w <= numWeeks + 1; w++) {
    prepRow += `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:endParaRPr lang="fr-FR"/></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:tcPr></a:tc>`;
  }
  prepRow += `</a:tr>`;
  rowsXml += prepRow;

  // 2. Lignes des phases normales (décalées de +1 pour laisser la place à la prépa)
  for (let i = 0; i < phases.length; i++) {
    const p = phases[i];
    const pDuree = Number(p.dureeSemaines || p.duree_semaines || 1);
    const activeRange = phaseWeeks[i];
    const phaseColor = '105BA6'; // Bleu AJC

    let rowXml = `<a:tr h="550000">`;
    rowXml += `<a:tc><a:txBody><a:bodyPr lIns="100000" rIns="100000" tIns="50000" bIns="50000"/><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR" sz="1100" b="1"><a:solidFill><a:srgbClr val="002C5A"/></a:solidFill><a:latin typeface="Montserrat"/></a:rPr><a:t>${escapeXml(p.name)}</a:t></a:r></a:p></a:txBody><a:tcPr anchor="ctr"><a:solidFill><a:srgbClr val="F5F8FF"/></a:solidFill></a:tcPr></a:tc>`;
    rowXml += `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="fr-FR" sz="1100"><a:solidFill><a:srgbClr val="333333"/></a:solidFill><a:latin typeface="Montserrat"/></a:rPr><a:t>${pDuree} sem.</a:t></a:r></a:p></a:txBody><a:tcPr anchor="ctr"><a:solidFill><a:srgbClr val="F5F8FF"/></a:solidFill></a:tcPr></a:tc>`;
    
    // Semaine de prépa blanche
    rowXml += `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:endParaRPr lang="fr-FR"/></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:tcPr></a:tc>`;
    
    // Semaines d'étude
    for (let w = 1; w <= numWeeks; w++) {
      const isActive = w >= activeRange.start && w <= activeRange.end;
      if (isActive) {
        rowXml += `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:endParaRPr lang="fr-FR"/></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="${phaseColor}"/></a:solidFill></a:tcPr></a:tc>`;
      } else {
        rowXml += `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:endParaRPr lang="fr-FR"/></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:tcPr></a:tc>`;
      }
    }
    
    // Semaine de bilan/finalisation blanche
    rowXml += `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:endParaRPr lang="fr-FR"/></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:tcPr></a:tc>`;
    rowXml += `</a:tr>`;
    rowsXml += rowXml;
  }

  // 3. Ligne de Finalisation (Clôture en Bronze/Orange à la dernière semaine)
  let finalRow = `<a:tr h="550000">`;
  finalRow += `<a:tc><a:txBody><a:bodyPr lIns="100000" rIns="100000" tIns="50000" bIns="50000"/><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR" sz="1100" b="1"><a:solidFill><a:srgbClr val="002C5A"/></a:solidFill><a:latin typeface="Montserrat"/></a:rPr><a:t>Finalisation &amp; Clôture administrative</a:t></a:r></a:p></a:txBody><a:tcPr anchor="ctr"><a:solidFill><a:srgbClr val="F5F8FF"/></a:solidFill></a:tcPr></a:tc>`;
  finalRow += `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="fr-FR" sz="1100"><a:solidFill><a:srgbClr val="333333"/></a:solidFill><a:latin typeface="Montserrat"/></a:rPr><a:t>1 sem.</a:t></a:r></a:p></a:txBody><a:tcPr anchor="ctr"><a:solidFill><a:srgbClr val="F5F8FF"/></a:solidFill></a:tcPr></a:tc>`;
  
  // Semaines d'étude et de prépa restent blanches
  for (let w = 1; w <= numWeeks + 1; w++) {
    finalRow += `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:endParaRPr lang="fr-FR"/></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:tcPr></a:tc>`;
  }
  // Dernière semaine de finalisation coloriée en Or (D4AF37)
  finalRow += `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:endParaRPr lang="fr-FR"/></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="D4AF37"/></a:solidFill></a:tcPr></a:tc>`;
  finalRow += `</a:tr>`;
  rowsXml += finalRow;

  return `
    <p:graphicFrame>
      <p:nvGraphicFramePr>
        <p:cNvPr id="200" name="TableGantt"/>
        <p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr>
        <p:nvPr/>
      </p:nvGraphicFramePr>
      <p:xfrm>
        <a:off x="${x}" y="${y}"/>
        <a:ext cx="${cx}" cy="${cy}"/>
      </p:xfrm>
      <a:graphic>
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">
          <a:tbl>
            <a:tblPr firstRow="1" bandRow="1">
              <a:tableStyleId>{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}</a:tableStyleId>
            </a:tblPr>
            ${tblGrid}
            ${rowsXml}
          </a:tbl>
        </a:graphicData>
      </a:graphic>
    </p:graphicFrame>
  `;
}

function replacePlaceholderShapeWithTable(
  slideXml: string,
  placeholder: string,
  generateTableXmlFn: (x: number, y: number, cx: number, cy: number) => string,
  defaultCoords: { x: number; y: number; cx: number; cy: number }
): string {
  const placeholderSpRegex = new RegExp(`<p:sp>(?:(?!<\\/p:sp>)[\\s\\S])*?${placeholder}[\\s\\S]*?<\\/p:sp>`);
  const match = slideXml.match(placeholderSpRegex);
  if (!match) {
    console.warn(`[PPT] Shape contenant ${placeholder} non trouvée dans le XML de la slide.`);
    return slideXml;
  }

  const shapeXml = match[0];
  let x = defaultCoords.x;
  let y = defaultCoords.y;
  let cx = defaultCoords.cx;
  let cy = defaultCoords.cy;

  const offMatch = shapeXml.match(/<a:off\s+x="(\d+)"\s+y="(\d+)"/);
  if (offMatch) {
    x = parseInt(offMatch[1], 10);
    y = parseInt(offMatch[2], 10);
  }

  const extMatch = shapeXml.match(/<a:ext\s+cx="(\d+)"\s+cy="(\d+)"/);
  if (extMatch) {
    cx = parseInt(extMatch[1], 10);
    cy = parseInt(extMatch[2], 10);
  }

  console.log(`[PPT] Remplacement de ${placeholder} aux coordonnées : x=${x}, y=${y}, cx=${cx}, cy=${cy}`);
  const tableXml = generateTableXmlFn(x, y, cx, cy);
  return slideXml.replace(shapeXml, tableXml);
}

export async function POST(req: Request) {
  // Utiliser le template unique directement modifiable par l'utilisateur
  const templatePath = path.resolve(process.cwd(), 'public', 'template.pptx');
  if (!fs.existsSync(templatePath)) {
    return NextResponse.json({
      error: 'Le fichier modèle "template.pptx" est introuvable dans le dossier "public".'
    }, { status: 404 });
  }

  let data: any = {};
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  // Multiplicateur TVA : piloté par parametres.tva_rate (transmis dans le payload),
  // défaut 20 %. Remplace les anciens "* 1.2" codés en dur.
  const TVA_MULT = 1 + (Number(data.tva_rate ?? 20) / 100);

  // 1. Résolution globale du CDP depuis la vraie table personnes (par UUID)
  if (data.cdp_id && (!data.cdp_first_name || !data.cdp_last_name)) {
    const sb = createAdminClient();
    const { data: cdp } = await sb
      .from('personnes')
      .select('prenom, nom, email, portable')
      .eq('id', data.cdp_id)
      .maybeSingle();
    if (cdp) {
      data.cdp_civilite = data.cdp_civilite || 'M.';
      data.cdp_first_name = cdp.prenom || '';
      data.cdp_last_name = cdp.nom || '';
      data.cdp_initials = ((cdp.prenom?.charAt(0) || '') + (cdp.nom?.charAt(0) || '')).toUpperCase();
      data.cdp_email = cdp.email || '';
      data.cdp_phone = cdp.portable || '';
    }
  }

  const cdpCivilite = data.cdp_civilite || 'M.';
  const cdpTitle = cdpCivilite === 'Mme' ? 'Cheffe de Projet' : 'Chef de Projet';

  try {
    // Charger le template
    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);

    // --- PRÉ-TRAITEMENT : corriger les balises XML fragmentées par PowerPoint ---
    const xmlFiles = Object.keys(zip.files).filter(f => f.endsWith('.xml'));
    xmlFiles.forEach(filename => {
      try {
        const xmlContent = zip.files[filename].asText();
        let fixed = fixBrokenTags(xmlContent);
        
        // Remplacer Montserrat Ultra Bold/Extra Bold par Montserrat standard (le gras est conservé par PowerPoint)
        fixed = fixed.replace(/typeface="Montserrat Ultra Bold"/g, 'typeface="Montserrat"')
                     .replace(/typeface="Montserrat-UltraBold"/g, 'typeface="Montserrat"')
                     .replace(/typeface="Montserrat ExtraBold"/g, 'typeface="Montserrat"')
                     .replace(/typeface="Montserrat-ExtraBold"/g, 'typeface="Montserrat"');

        // Forcer l'auto-ajustement des cadres de texte (autofit) sur toutes les slides
        fixed = fixed.replace(/<a:noAutofit\s*\/>/g, '<a:normAutofit/>');

        // Retirer le P devant le numéro de proposition {NUM_PROP}
        fixed = fixed.replace(/P\{NUM_PROP\}/g, '{NUM_PROP}')
                     .replace(/P-\{NUM_PROP\}/g, '{NUM_PROP}')
                     .replace(/P\s+\{NUM_PROP\}/g, '{NUM_PROP}');

        // Aligner à gauche la slide 9 (Contexte et Enjeux)
        if (fixed.includes('{SITUATION_CTX}') || fixed.includes('SITUATION_CTX')) {
          fixed = fixed.replace(/algn="ctr"/g, 'algn="l"');
        }

        // Mettre en gras la balise de l'entreprise {CLIENT_COMPANY}
        fixed = fixed.replace(/(<a:rPr[^>]*?)(b="0"|b="false")?([^>]*?>\s*<a:t>\{CLIENT_COMPANY\})/g, (match, prefix, boldAttr, suffix) => {
          if (prefix.includes(' b="')) {
            return prefix.replace(/b="[^"]*"/, 'b="1"') + suffix;
          }
          return prefix + ' b="1"' + suffix;
        });

        if (fixed !== xmlContent) {
          zip.file(filename, fixed);
        }
      } catch {
        // Ignorer si on ne peut pas lire le fichier XML
      }
    });

    const phases = Array.isArray(data.phases) ? data.phases : [];

    // =========================================================================
    // 1. DUPLICATION DYNAMIQUE DES SLIDES DE PHASES
    // =========================================================================
    if (phases.length > 0) {
      // a. Lire presentation.xml.rels pour faire le mapping rId -> slide filename
      const presRelsXml = zip.file('ppt/_rels/presentation.xml.rels')!.asText();
      const rIdToFile: { [key: string]: string } = {};
      const relRegex = /Id="([^"]+)"[^>]*Target="slides\/([^"]+)"/g;
      let relMatch;
      while ((relMatch = relRegex.exec(presRelsXml)) !== null) {
        rIdToFile[relMatch[1]] = relMatch[2];
      }

      // b. Lire presentation.xml pour connaitre l'ordre des slides
      const presXml = zip.file('ppt/presentation.xml')!.asText();
      const sldIdRegex = /<p:sldId\s+id="(\d+)"\s+r:id="([^"]+)"/g;
      let sldIdMatch;
      const slides: Array<{ id: string; rId: string; file: string }> = [];
      while ((sldIdMatch = sldIdRegex.exec(presXml)) !== null) {
        const rId = sldIdMatch[2];
        const file = rIdToFile[rId];
        if (file) {
          slides.push({ id: sldIdMatch[1], rId, file });
        }
      }

      // c. Trouver la slide modèle (celle qui contient `{NOM_PHASE}`)
      let templateSlide: { id: string; rId: string; file: string } | null = null;
      let modelIndex = -1;
      for (let i = 0; i < slides.length; i++) {
        const slideFile = `ppt/slides/${slides[i].file}`;
        if (zip.file(slideFile)) {
          const slideXml = zip.file(slideFile)!.asText();
          if (slideXml.includes('{NOM_PHASE}')) {
            templateSlide = slides[i];
            modelIndex = i;
            break;
          }
        }
      }

      if (templateSlide && modelIndex !== -1) {
        console.log(`[PPT] Slide modèle de phase trouvée : ${templateSlide.file} (ID: ${templateSlide.id}, rId: ${templateSlide.rId})`);

        // =========================================================================
        // DÉLÉTION DYNAMIQUE DES 15 SLIDES STATIQUES (Slide 14 à 28)
        // =========================================================================
        const staticSlidesToDelete = slides.slice(modelIndex + 1, modelIndex + 16);
        console.log(`[PPT] Suppression dynamique de ${staticSlidesToDelete.length} slides de phases statiques...`);

        let updatedPresXml = presXml;
        let updatedPresRelsXml = presRelsXml;
        let contentTypesXml = zip.file('[Content_Types].xml')!.asText();

        for (const s of staticSlidesToDelete) {
          // Supprimer de presentation.xml
          updatedPresXml = updatedPresXml.replace(
            new RegExp(`<p:sldId\\s+id="${s.id}"\\s+r:id="${s.rId}"\\s*\\/?>`, 'g'), 
            ''
          );
          // Supprimer de presentation.xml.rels
          updatedPresRelsXml = updatedPresRelsXml.replace(
            new RegExp(`<Relationship[^>]*Id="${s.rId}"[^>]*/>`, 'g'), 
            ''
          );
          // Supprimer de [Content_Types].xml pour éviter les incohérences de fichiers absents !
          const partName = `/ppt/slides/${s.file}`;
          contentTypesXml = contentTypesXml.replace(
            new RegExp(`<Override[^>]*PartName="${partName}"[^>]*/>`, 'g'),
            ''
          );
          // Supprimer le fichier slide du ZIP
          try {
            zip.remove(`ppt/slides/${s.file}`);
            zip.remove(`ppt/slides/_rels/${s.file}.rels`);
          } catch (e) {}
        }

        // Extraire les fichiers originaux
        const originalSlideXml = zip.file(`ppt/slides/${templateSlide.file}`)!.asText();
        const originalSlideRelsPath = `ppt/slides/_rels/${templateSlide.file}.rels`;
        const originalRelsFile = zip.file(originalSlideRelsPath);
        const originalRelsContent = originalRelsFile ? originalRelsFile.asText() : null;

        // Déterminer les IDs de départ pour éviter toute collision
        const existingIds = slides.map(s => parseInt(s.id, 10)).filter(id => !isNaN(id));
        let nextSlideId = Math.max(...existingIds, 255) + 1;

        let newSldIdTags = '';

        // Générer une slide pour chaque phase
        for (let i = 0; i < phases.length; i++) {
          const p = phases[i];
          const relId = `rIdGenFastPhase${i}`;
          const newSlideFile = `slide_genfast_phase_${i}.xml`;
          const slideId = nextSlideId++;

          // Dupliquer le XML et injecter directement les valeurs
          let newXml = fixBrokenTags(originalSlideXml);
          
          // Forcer l'auto-ajustement des cadres de texte (autofit) en remplaçant noAutofit par normAutofit
          newXml = newXml.replace(/<a:noAutofit\s*\/>/g, '<a:normAutofit/>');

          newXml = newXml
            .replace(/{NOM_PHASE}/g, escapeXml(p.name || `Phase ${i + 1}`))
            .replace(/{INDEX}/g, String(i + 1))
            .replace(/{TOTAL}/g, String(phases.length))
            .replace(/{TXT_OBJ}/g, escapeXml(p.objectifs || ''))
            .replace(/{TXT_METHO}/g, escapeXml(p.methodologie || ''))
            .replace(/{TXT_CONTRAINTES}/g, escapeXml(p.contraintes || ''))
            .replace(/{DUREE}/g, String(p.dureeSemaines || p.duree_semaines || 1))
            .replace(/{NB_JEH}/g, String(p.jehCount || p.jeh_count || 1))
            .replace(/{PRIX}/g, ((p.jehCount || p.jeh_count || 0) * (p.jehPrice || p.jeh_price || 0)).toLocaleString('fr-FR') + ' €')
            .replace(/TITRE DE LA PRESTATION/g, escapeXml(data.study_type || 'Étude'))
            .replace(/TITRE DE LA PRESTATION/gi, escapeXml(data.study_type || 'Étude'));

          // Sauvegarder la nouvelle slide
          zip.file(`ppt/slides/${newSlideFile}`, newXml);

          // Copier les relations de la slide d'origine
          if (originalRelsContent) {
            zip.file(`ppt/slides/_rels/${newSlideFile}.rels`, originalRelsContent);
          }

          // Déclarer la nouvelle slide dans [Content_Types].xml
          const partName = `/ppt/slides/${newSlideFile}`;
          const overrideTag = `<Override PartName="${partName}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
          if (!contentTypesXml.includes(partName)) {
            contentTypesXml = contentTypesXml.replace('</Types>', `${overrideTag}</Types>`);
          }

          // Déclarer la nouvelle relation de slide dans presentation.xml.rels
          const newRelTag = `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/${newSlideFile}"/>`;
          updatedPresRelsXml = updatedPresRelsXml.replace('</Relationships>', `${newRelTag}</Relationships>`);

          // Construire les balises de structure pour presentation.xml
          newSldIdTags += `<p:sldId id="${slideId}" r:id="${relId}"/>`;
        }

        // Sauvegarder les fichiers globaux mis à jour
        zip.file('[Content_Types].xml', contentTypesXml);
        zip.file('ppt/_rels/presentation.xml.rels', updatedPresRelsXml);

        // Remplacer la slide modèle par les slides dupliquées dans presentation.xml
        const originalSldIdTagRegex = new RegExp(`<p:sldId\\s+id="${templateSlide.id}"\\s+r:id="${templateSlide.rId}"\\s*\\/?>`);
        const updatedPresXmlFinal = updatedPresXml.replace(originalSldIdTagRegex, newSldIdTags);
        zip.file('ppt/presentation.xml', updatedPresXmlFinal);
      }
    }

    // =========================================================================
    // 2. REMPLISSAGE DYNAMIQUE DU TABLEAU BUDGET (SLIDE 32)
    // =========================================================================
    let budgetSlideFile: string | null = null;
    const allFiles = Object.keys(zip.files);
    for (const filename of allFiles) {
      if (filename.startsWith('ppt/slides/slide') && filename.endsWith('.xml')) {
        const content = zip.file(filename)!.asText();
        if (content.includes('{TABLE_BUDGET}') || content.includes('PHASE_NOM_PLACEHOLDER')) {
          budgetSlideFile = filename;
          break;
        }
      }
    }

    if (budgetSlideFile && phases.length > 0) {
      console.log(`[PPT] Slide Budget trouvée : ${budgetSlideFile}`);
      let budgetXml = zip.file(budgetSlideFile)!.asText();
      budgetXml = fixBrokenTags(budgetXml);

      // Calculs financiers globaux — source unique : lib/budget/compute.
      // La marge est « fondue » dans le JEH (grossissement du SDP) et les frais
      // de structure sont inclus dans le Total HT, exactement comme la synthèse
      // affichée côté CDP et la validation trésorerie.
      const suiviJeh = data.suivi_jeh_count !== undefined ? data.suivi_jeh_count : 1;
      const suiviPrice = data.suivi_jeh_price !== undefined ? data.suivi_jeh_price : 200;
      const suiviHt = suiviJeh * suiviPrice;
      const suiviTtc = suiviHt * TVA_MULT;

      const budgetBreakdown = computeBudget({
        phases: phases.map((p: any) => ({
          name: p.name || '',
          jehCount: Number(p.jehCount || p.jeh_count || 0),
          jehPrice: Number(p.jehPrice || p.jeh_price || 0),
        })),
        suiviJehCount: Number(suiviJeh || 0),
        suiviJehPrice: Number(suiviPrice || 0),
        margeJePct: Number(data.marge_je || 0),
        fraisDossier: Number(data.frais_dossier || 0),
        globalFraisAnnexes: Number(data.global_frais_annexes || 0),
        tvaPct: Number(data.tva_rate ?? 20),
      });
      const totalHt = budgetBreakdown.totalHt;
      const totalTtc = budgetBreakdown.netAPayer;

      if (budgetXml.includes('{TABLE_BUDGET}')) {
        budgetXml = replacePlaceholderShapeWithTable(
          budgetXml,
          '{TABLE_BUDGET}',
          (x, y, cx, cy) => generateBudgetTableXml(phases, suiviJeh, suiviHt, suiviTtc, totalHt, totalTtc, x, y, cx, cy, TVA_MULT),
          { x: 1144000, y: 2000000, cx: 16000000, cy: 4800000 }
        );
      } else if (budgetXml.includes('PHASE_NOM_PLACEHOLDER')) {
        // Repérer la ligne du tableau contenant PHASE_NOM_PLACEHOLDER
        const trRegex = /<a:tr[^>]*>(?:(?!<\/a:tr>)[\s\S])*?PHASE_NOM_PLACEHOLDER[\s\S]*?<\/a:tr>/;
        const rowMatch = budgetXml.match(trRegex);

        if (rowMatch) {
          const rowTemplate = rowMatch[0];
          let newRowsXml = '';

          for (let i = 0; i < phases.length; i++) {
            const p = phases[i];
            const htVal = (p.jehCount || p.jeh_count || 0) * (p.jehPrice || p.jeh_price || 0);
            const ttcVal = htVal * TVA_MULT;

            let rowXml = rowTemplate
              .replace('PHASE_NOM_PLACEHOLDER', escapeXml(p.name || `Phase ${i + 1}`))
              .replace('PHASE_JEH_PLACEHOLDER', String(p.jehCount || p.jeh_count || 0))
              .replace('PHASE_HT_PLACEHOLDER', htVal.toLocaleString('fr-FR') + ' €')
              .replace('PHASE_TTC_PLACEHOLDER', ttcVal.toLocaleString('fr-FR') + ' €');

            newRowsXml += rowXml;
          }

          budgetXml = budgetXml.replace(rowTemplate, newRowsXml);
        }
      }
      zip.file(budgetSlideFile, budgetXml);
    }

    // =========================================================================
    // 3. ADAPTATIVITÉ DE LA SLIDE MÉTHODOLOGIE DE L'ÉTUDE (SLIDE 12)
    // =========================================================================
    let methodologySlideFile: string | null = null;
    for (const filename of allFiles) {
      if (filename.startsWith('ppt/slides/slide') && filename.endsWith('.xml')) {
        const content = zip.file(filename)!.asText();
        if (content.includes('Phase 1') && content.includes('Phase 2') && content.includes('Phase 3')) {
          methodologySlideFile = filename;
          break;
        }
      }
    }

    if (methodologySlideFile) {
      console.log(`[PPT] Slide Méthodologie trouvée : ${methodologySlideFile}`);
      let methXml = zip.file(methodologySlideFile)!.asText();
      methXml = fixBrokenTags(methXml);

      const nbPhases = phases.length;

      // Extraire les modèles XML de la 5ème phase pour duplication (si N > 5)
      const getShapeXml = (xmlStr: string, shapeName: string, tagType: 'sp' | 'grpSp'): string => {
        const shapeRegex = new RegExp(`<p:${tagType}>(?:(?!</p:${tagType}>)[\\s\\S])*?name="${shapeName}"[\\s\\S]*?</p:${tagType}>`);
        const match = xmlStr.match(shapeRegex);
        return match ? match[0] : '';
      };

      const group5XmlModel = getShapeXml(methXml, 'Group 14', 'grpSp'); 
      const text5XmlModel = getShapeXml(methXml, 'TextBox 44', 'sp');   
      const arrow5XmlModel = getShapeXml(methXml, 'AutoShape 21', 'sp'); 

      // Calculer l'échelle de réduction pour éviter de déborder
      const scale = nbPhases <= 5 ? 1.0 : 5 / nbPhases;

      const origCircleX = [1134795, 4785206, 8435618, 12052566, 15745943];
      const origTextX = [616348, 4268157, 7917171, 11590926, 15227496];
      const origArrowX = [2846735, 6573469, 10186697, 13879043];

      let circleX: number[] = [];
      let textX: number[] = [];
      let arrowX: number[] = [];

      if (nbPhases <= 5) {
        // Centrage horizontal classique
        const spanWidth = (origTextX[nbPhases - 1] + 2444156) - 616348;
        const newLeft = (18288000 - spanWidth) / 2;
        const shift = newLeft - 616348;

        for (let i = 0; i < nbPhases; i++) {
          circleX.push(origCircleX[i] + shift);
          textX.push(origTextX[i] + shift);
          if (i < nbPhases - 1) {
            arrowX.push(origArrowX[i] + shift);
          }
        }
      } else {
        // Calcul paramétrique avec mise à l'échelle pour N > 5
        const circle1X = 1134795 * scale;
        const circleNX = 18288000 - 2542057 * scale;
        const step = (circleNX - circle1X) / (nbPhases - 1);

        for (let i = 0; i < nbPhases; i++) {
          const cX = Math.round(circle1X + i * step);
          circleX.push(cX);
          textX.push(Math.round(cX - 518447 * scale));
          
          if (i < nbPhases - 1) {
            const nextCX = Math.round(circle1X + (i + 1) * step);
            const aX = Math.round((cX + nextCX - 153005 * scale) / 2);
            arrowX.push(aX);
          }
        }
      }

      // Helper pour mettre à jour les coordonnées d'une forme
      const updateShapeCoords = (xmlStr: string, shapeName: string, tagType: 'sp' | 'grpSp', x: number, y: number, cx: number, cy: number): string => {
        const shapeRegex = new RegExp(`(<p:${tagType}>(?:(?!</p:${tagType}>)[\\s\\S])*?name="${shapeName}"[\\s\\S]*?<a:off x=")(\\d+)(" y=")(\\d+)("\\/>[\\s\\S]*?<a:ext cx=")(\\d+)(" cy=")(\\d+)("\\/>)`);
        return xmlStr.replace(shapeRegex, (match, prefix, oldX, middle, oldY, extPrefix, oldCx, extMiddle, oldCy, suffix) => {
          return `${prefix}${x}${middle}${y}${extPrefix}${cx}${extMiddle}${cy}${suffix}`;
        });
      };

      const circleNames = ['Group 2', 'Group 5', 'Group 8', 'Group 11', 'Group 14'];
      const textNames = ['TextBox 39', 'TextBox 41', 'TextBox 42', 'TextBox 43', 'TextBox 44'];
      const arrowNames = ['AutoShape 18', 'AutoShape 19', 'AutoShape 20', 'AutoShape 21'];

      // Remplacer les noms des phases avec notre outil de modification de zone de texte robuste !
      const limit = Math.min(5, nbPhases);
      for (let i = 0; i < limit; i++) {
        const phaseName = phases[i]?.name || '';
        methXml = setShapeText(methXml, textNames[i], phaseName);
      }

      // Mettre à jour les coordonnées des formes actives d'origine
      for (let i = 0; i < limit; i++) {
        methXml = updateShapeCoords(methXml, circleNames[i], 'grpSp', circleX[i], 2443956, Math.round(1407262 * scale), Math.round(1242249 * scale));
        methXml = updateShapeCoords(methXml, textNames[i], 'sp', textX[i], 3926683, Math.round(2444156 * scale), Math.round(727710 * scale));
        
        if (i < limit - 1) {
          methXml = updateShapeCoords(methXml, arrowNames[i], 'sp', arrowX[i], 3065081, Math.round(1560267 * scale), 0);
        }
      }

      const deleteShape = (xmlStr: string, shapeName: string, tagType: 'sp' | 'grpSp'): string => {
        const shapeRegex = new RegExp(`<p:${tagType}>(?:(?!<\\/p:${tagType}>)[\\s\\S])*?name="${shapeName}"[\\s\\S]*?</p:${tagType}>`);
        return xmlStr.replace(shapeRegex, '');
      };

      // Supprimer les formes inutilisées d'origine si N < 5
      if (nbPhases < 5) {
        methXml = deleteShape(methXml, 'Group 14', 'grpSp');
        methXml = deleteShape(methXml, 'TextBox 44', 'sp');
        methXml = deleteShape(methXml, 'AutoShape 21', 'sp');
      }
      if (nbPhases < 4) {
        methXml = deleteShape(methXml, 'Group 11', 'grpSp');
        methXml = deleteShape(methXml, 'TextBox 43', 'sp');
        methXml = deleteShape(methXml, 'AutoShape 20', 'sp');
      }
      if (nbPhases < 3) {
        methXml = deleteShape(methXml, 'Group 8', 'grpSp');
        methXml = deleteShape(methXml, 'TextBox 42', 'sp');
        methXml = deleteShape(methXml, 'AutoShape 19', 'sp');
      }
      if (nbPhases < 2) {
        methXml = deleteShape(methXml, 'Group 5', 'grpSp');
        methXml = deleteShape(methXml, 'TextBox 41', 'sp');
        methXml = deleteShape(methXml, 'AutoShape 18', 'sp');
      }

      // Dupliquer et insérer les formes pour i > 5
      if (nbPhases > 5 && group5XmlModel && text5XmlModel && arrow5XmlModel) {
        let additionalShapesXml = '';
        
        for (let i = 5; i < nbPhases; i++) {
          const p = phases[i];
          const newId = 1000 + i;

          // 1. Dupliquer et positionner le Cercle
          let newCircle = group5XmlModel
            .replace(/name="Group 14"/g, `name="Group Gen ${i + 1}"`)
            .replace(/id="13"/g, `id="${newId}"`) 
            .replace(/<a:t>5<\/a:t>/g, `<a:t>${i + 1}</a:t>`);

          newCircle = updateShapeCoords(newCircle, `Group Gen ${i + 1}`, 'grpSp', circleX[i], 2443956, Math.round(1407262 * scale), Math.round(1242249 * scale));
          additionalShapesXml += newCircle;

          // 2. Dupliquer et positionner le Texte
          let newText = text5XmlModel
            .replace(/name="TextBox 44"/g, `name="TextBox Gen ${i + 1}"`)
            .replace(/id="44"/g, `id="${newId + 50}"`);

          newText = newText.replace(/<a:t>[^<]*<\/a:t>/g, '<a:t></a:t>');
          newText = newText.replace(/<a:p>/, `<a:p><a:r><a:rPr lang="fr-FR" sz="1000" b="1"><a:solidFill><a:srgbClr val="002C5A"/></a:solidFill><a:latin typeface="Montserrat"/></a:rPr><a:t>${escapeXml(p.name)}</a:t></a:r>`);

          newText = updateShapeCoords(newText, `TextBox Gen ${i + 1}`, 'sp', textX[i], 3926683, Math.round(2444156 * scale), Math.round(727710 * scale));
          additionalShapesXml += newText;

          // 3. Dupliquer et positionner la Flèche entre i et i+1 (sauf pour la dernière phase)
          if (i < nbPhases - 1) {
            let newArrow = arrow5XmlModel
              .replace(/name="AutoShape 21"/g, `name="AutoShape Gen ${i + 1}"`)
              .replace(/id="21"/g, `id="${newId + 100}"`);

            newArrow = updateShapeCoords(newArrow, `AutoShape Gen ${i + 1}`, 'sp', arrowX[i], 3065081, Math.round(1560267 * scale), 0);
            additionalShapesXml += newArrow;
          }
        }

        methXml = methXml.replace('</p:spTree>', `${additionalShapesXml}</p:spTree>`);
      }
      zip.file(methodologySlideFile, methXml);
    }

    // =========================================================================
    // 3.5. GÉNÉRATION DE L'ÉCHÉANCIER GANTT DYNAMIQUE (SLIDE 31)
    // =========================================================================
    let ganttSlideFile: string | null = null;
    const allFilesAfter = Object.keys(zip.files);
    for (const filename of allFilesAfter) {
      if (filename.startsWith('ppt/slides/slide') && filename.endsWith('.xml')) {
        const content = zip.file(filename)!.asText();
        if (content.includes('{TABLE_GANTT}') || (content.includes('aucune valeur contractuelle') && content.includes('Initialisation'))) {
          ganttSlideFile = filename;
          break;
        }
      }
    }

    if (ganttSlideFile && phases.length > 0) {
      console.log(`[PPT] Slide Échéancier Gantt trouvée : ${ganttSlideFile}`);
      let ganttXml = zip.file(ganttSlideFile)!.asText();
      ganttXml = fixBrokenTags(ganttXml);
      
      const phaseWeeks: Array<{ start: number; end: number }> = [];
      const phaseEndWeekMap = new Map<string, number>();
      let totalWeeks = 0;

      for (let i = 0; i < phases.length; i++) {
        const p = phases[i];
        const pDuree = Number(p.dureeSemaines || p.duree_semaines || 1);
        let startWeek = 1;

        const pStartAfter = p.startAfterPhaseId !== undefined ? String(p.startAfterPhaseId) : (p.start_after_phase_id !== undefined ? String(p.start_after_phase_id) : 'project_start');
        
        if (pStartAfter && pStartAfter !== 'project_start') {
          // On cherche la phase de référence dans nos phases précédentes
          let refPhaseIndex = -1;
          for (let j = 0; j < i; j++) {
            const prevP = phases[j];
            const prevId = prevP.phaseId !== undefined ? String(prevP.phaseId) : (prevP.id !== undefined ? String(prevP.id) : String(j));
            if (prevId === pStartAfter) {
              refPhaseIndex = j;
              break;
            }
          }
          
          if (refPhaseIndex !== -1) {
            const refEnd = phaseWeeks[refPhaseIndex]?.end;
            if (refEnd !== undefined) {
              startWeek = refEnd + 1;
            }
          } else {
            // Fallback: Si la phase de référence n'est pas trouvée par ID, on essaie comme index direct
            const possibleIndex = parseInt(pStartAfter, 10);
            if (!isNaN(possibleIndex) && possibleIndex >= 0 && possibleIndex < i) {
              const refEnd = phaseWeeks[possibleIndex]?.end;
              if (refEnd !== undefined) {
                startWeek = refEnd + 1;
              }
            } else {
              // Fallback séquentiel standard
              const prevEndFallback = phaseWeeks[i - 1]?.end;
              if (prevEndFallback !== undefined) {
                startWeek = prevEndFallback + 1;
              }
            }
          }
        } else {
          // Si pStartAfter est 'project_start' ou non défini, la phase commence en semaine 1 !
          startWeek = 1;
        }
        
        const endWeek = startWeek + pDuree - 1;
        phaseWeeks.push({ start: startWeek, end: endWeek });
        const pId = p.phaseId !== undefined ? String(p.phaseId) : String(i);
        phaseEndWeekMap.set(pId, endWeek);
        
        if (endWeek > totalWeeks) {
          totalWeeks = endWeek;
        }
      }
      const numWeeks = totalWeeks > 0 ? totalWeeks : 6;
      // Augmenter la taille du planning pour qu'il prenne plus de place
      const weekColWidth = Math.floor(11800000 / (numWeeks + 2));

      if (ganttXml.includes('{TABLE_GANTT}')) {
        ganttXml = replacePlaceholderShapeWithTable(
          ganttXml,
          '{TABLE_GANTT}',
          (x, y, cx, cy) => generateGanttTableXml(phases, phaseWeeks, numWeeks, weekColWidth, x, y, cx, cy),
          { x: 744000, y: 2200000, cx: 16800000, cy: 5800000 }
        );
        zip.file(ganttSlideFile, ganttXml);
      } else {
        const footerNoteXml = `<p:sp><p:nvSpPr><p:cNvPr id="57" name="ZoneTexte 22"><a:extLst><a:ext uri="{FF2B5EF4-FFF2-40B4-BE49-F238E27FC236}"><a16:creationId xmlns:a16="http://schemas.microsoft.com/office/drawing/2014/main" id="{D1DCB3D2-8430-857D-E7B5-EFC76A56D1B8}"/></a:ext></a:extLst></p:cNvPr><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="9296400" y="10052471"/><a:ext cx="9139040" cy="253916"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square" rtlCol="0"><a:spAutoFit/></a:bodyPr><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR" sz="1050" noProof="0"><a:solidFill><a:srgbClr val="002C5A"/></a:solidFill><a:effectLst/><a:latin typeface="Montserrat" panose="00000500000000000000" pitchFamily="2" charset="0"/></a:rPr><a:t>Cette proposition commerciale n'a aucune valeur contractuelle, l'acceptation de celle-ci se fera par le biais de la Convention d'Etude </a:t></a:r><a:endParaRPr lang="fr-FR" sz="1050" noProof="0"><a:solidFill><a:srgbClr val="002C5A"/></a:solidFill><a:effectLst/></a:endParaRPr></a:p></p:txBody></p:sp>`;
        const ganttTableXml = generateGanttTableXml(phases, phaseWeeks, numWeeks, weekColWidth, 744000, 2200000, 16800000, 5800000);
        
        const newGanttSlideXml = [
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
          '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">',
          '  <p:cSld>',
          '    <p:spTree>',
          '      <p:nvGrpSpPr>',
          '        <p:cNvPr id="1" name=""/>',
          '        <p:cNvGrpSpPr/>',
          '        <p:nvPr/>',
          '      </p:nvGrpSpPr>',
          '      <p:grpSpPr>',
          '        <a:xfrm>',
          '          <a:off x="0" y="0"/>',
          '          <a:ext cx="0" cy="0"/>',
          '          <a:chOff x="0" y="0"/>',
          '          <a:chExt cx="0" cy="0"/>',
          '        </a:xfrm>',
          '      </p:grpSpPr>',
          ganttTableXml,
          footerNoteXml,
          '    </p:spTree>',
          '    <p:extLst>',
          '      <p:ext uri="{BB962C8B-B14F-4D97-AF65-F5344CB8AC3E}">',
          '        <p14:creationId xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" val="1969516322"/>',
          '      </p:ext>',
          '    </p:extLst>',
          '  </p:cSld>',
          '  <p:clrMapOvr>',
          '    <a:masterClrMapping/>',
          '  </p:clrMapOvr>',
          '</p:sld>'
        ].join('\n');

        zip.file(ganttSlideFile, newGanttSlideXml);
      }
    }

    // =========================================================================
    // 4. INITIALISATION ET RENDU DOCXTEMPLATER (AUTRES SLIDES)
    // =========================================================================
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '', // Supprimer la balise si non fournie
    });

    // Calculs financiers globaux — source unique : lib/budget/compute.
    const suiviJeh = data.suivi_jeh_count !== undefined ? data.suivi_jeh_count : 1;
    const suiviPrice = data.suivi_jeh_price !== undefined ? data.suivi_jeh_price : 200;
    const suiviHt = suiviJeh * suiviPrice;
    const suiviTtc = suiviHt * TVA_MULT;

    const globalBudget = computeBudget({
      phases: phases.map((p: any) => ({
        name: p.name || '',
        jehCount: Number(p.jehCount || p.jeh_count || 0),
        jehPrice: Number(p.jehPrice || p.jeh_price || 0),
      })),
      suiviJehCount: Number(suiviJeh || 0),
      suiviJehPrice: Number(suiviPrice || 0),
      margeJePct: Number(data.marge_je || 0),
      fraisDossier: Number(data.frais_dossier || 0),
      globalFraisAnnexes: Number(data.global_frais_annexes || 0),
      tvaPct: Number(data.tva_rate ?? 20),
    });
    const totalHt = globalBudget.totalHt;
    const totalTtc = globalBudget.netAPayer;

    // Durée totale = somme des durées de phase
    const dureeTotale = phases.reduce((acc: number, p: any) => acc + (p.dureeSemaines || p.duree_semaines || 0), 0);

    // Dates
    const dateRedacStr = data.start_date 
      ? new Date(data.start_date).toLocaleDateString('fr-FR') 
      : new Date().toLocaleDateString('fr-FR');
    const dateVal = data.start_date ? new Date(data.start_date) : new Date();
    dateVal.setMonth(dateVal.getMonth() + 2); // Exactement 2 mois de validité !
    const dateValStr = dateVal.toLocaleDateString('fr-FR');

    const renderData = {
      PRON: data.client_civilite === 'M.' ? 'Monsieur' : 'Madame',
      CLIENT_PRENOM: data.client_first_name || '',
      CLIENT_NOM: data.client_last_name || '',
      CLIENT_COMPANY: (data.taille_entreprise === 'microentreprise' || data.is_autoentrepreneur || data.isAutoentrepreneur)
        ? `${data.client_civilite || 'M.'} ${data.client_first_name || ''} ${data.client_last_name || ''}`.trim()
        : (data.client_company || ''),
      MAIL_CLIENT: data.client_email || '',
      NOM_ETUDE: data.study_type || '',
      TITRE_ETUDE: data.study_type || '',
      NUM_PROP: data.id || '',
      TOTAL: phases.length,
      TOTAL_HT: totalHt.toLocaleString('fr-FR') + ' €',
      TOTAL_TTC: totalTtc.toLocaleString('fr-FR') + ' €',
      SUIVI_JEH_COUNT: String(suiviJeh),
      SUIVI_HT: suiviHt.toLocaleString('fr-FR') + ' €',
      SUIVI_TTC: suiviTtc.toLocaleString('fr-FR') + ' €',
      SITUATION_CTX: data.context_situation || '',
      INTERV_CTX: data.context_intervention || '',
      ENJEU_CTX: data.context_enjeu || '',
      OBJECTIF_CDC: data.cdc_objectifs || '',
      CONTRAINTES_CDC: data.cdc_contraintes || '',
      LIVRABLES_CDC: data.cdc_livrables || '',
      PREN_CDP: data.cdp_first_name || '',
      NOM_CDP: data.cdp_last_name || '',
      CDP: data.cdp_initials || '',
      MAIL_CDP: data.cdp_email || '',
      NUM_CDP: data.cdp_phone || '',
      TITRE_CDP: cdpTitle, // Injecte dynamiquement "Chef de Projet" ou "Cheffe de Projet"
      DUREE_TOTALE: String(dureeTotale + 2),
      DATE_REDACTION: dateRedacStr,
      DATE_VALIDITE: dateValStr,
      phases: [] // Déjà traité manuellement par notre injecteur de slides
    };

    // Rendu global
    try {
      doc.render(renderData);
    } catch (renderError: any) {
      if (renderError?.properties?.errors) {
        console.warn('[PPT] Rendu docxtemplater partiel - erreurs :', renderError.properties.errors.length);
      } else {
        console.warn('[PPT] Erreur lors du rendu docxtemplater :', renderError?.message);
      }
    }

    // Récupérer le buffer ZIP final
    const buf = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    const filename = `Proposition_${(data.client_company || 'AJC').replace(/[^a-zA-Z0-9]/g, '_')}.pptx`;
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (fatalError: any) {
    console.error('[PPT] Erreur fatale de génération :', fatalError?.stack || fatalError?.message);
    return NextResponse.json({
      error: `Erreur de génération : ${fatalError?.message || 'Erreur inconnue'}`
    }, { status: 500 });
  }
}
