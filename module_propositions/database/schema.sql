-- ==========================================
-- BASES DE DONNÉES : MODULE PROPOSITIONS
-- ==========================================

-- ==========================================
-- 1. PRÉ-GÉNÉRATION (Référentiels & Catalogues)
-- Données qui alimentent les menus déroulants
-- ==========================================

-- Table des Chefs de Projet (CDP)
CREATE TABLE IF NOT EXISTS public.propale_cdp (
    id SERIAL PRIMARY KEY,
    civilite VARCHAR(50),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    initials VARCHAR(10) UNIQUE NOT NULL, -- Initiales utilisées pour générer l'ID de propale (ex: JDU)
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    pole VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table du Catalogue des Phases Types (pour pré-remplir le formulaire)
CREATE TABLE IF NOT EXISTS public.propale_phase_type (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    default_objectifs TEXT,
    default_methodologie TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- ==========================================
-- 2. POST-GÉNÉRATION (Sauvegarde du Dashboard)
-- Données générées par le formulaire
-- ==========================================

-- Table principale des Propositions Commerciales
CREATE TABLE IF NOT EXISTS public.proposals (
    id VARCHAR(50) PRIMARY KEY, -- L'ID généré (ex: JDU-20240504-1045)
    status VARCHAR(50) DEFAULT 'envoyée', -- 'envoyée', 'validée', 'refusée', 'CE éditée'
    
    -- Informations de base
    cdp_id INTEGER REFERENCES public.propale_cdp(id) ON DELETE SET NULL,
    study_type VARCHAR(255),
    start_date DATE NOT NULL,
    global_frais_annexes DECIMAL(10,2) DEFAULT 0,
    suivi_jeh_count INTEGER DEFAULT 1,
    suivi_jeh_price DECIMAL(10,2) DEFAULT 200.00,
    total_ht DECIMAL(10,2) DEFAULT 0,
    total_ttc DECIMAL(10,2) DEFAULT 0,
    
    -- Informations Client
    client_company VARCHAR(255),
    is_autoentrepreneur BOOLEAN DEFAULT false,
    client_civilite VARCHAR(20),
    client_first_name VARCHAR(100),
    client_last_name VARCHAR(100),
    client_email VARCHAR(255),
    client_phone VARCHAR(50),
    
    -- Le Contexte
    context_situation TEXT,
    context_intervention TEXT,
    context_enjeu TEXT,
    
    -- Le Cahier des Charges
    cdc_objectifs TEXT,
    cdc_contraintes TEXT,
    cdc_livrables TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table des Phases spécifiques à une Proposition (Relation 1 à Plusieurs)
CREATE TABLE IF NOT EXISTS public.proposal_phases (
    id SERIAL PRIMARY KEY,
    proposal_id VARCHAR(50) REFERENCES public.proposals(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL, -- Pour garder l'ordre de l'échéancier (1, 2, 3...)
    
    -- Textes édités par l'utilisateur
    name VARCHAR(255) NOT NULL,
    objectifs TEXT,
    methodologie TEXT,
    contraintes TEXT,
    
    -- Échéancier
    duree_semaines INTEGER DEFAULT 1,
    
    -- Intervenants
    intervenants_count DECIMAL(5,1) DEFAULT 1.0, -- Permet les décimales (ex: 1.5)
    intervenants_niveau VARCHAR(10), -- 'L3', 'M1', 'M2'
    
    -- Budget
    jeh_count INTEGER DEFAULT 1,
    jeh_price DECIMAL(10,2) DEFAULT 200.00
);

-- ==========================================
-- 3. CONVENTIONS D'ÉTUDES (CE)
-- Copie des tables propositions pour isoler les contrats signés et permettre les statistiques
-- ==========================================

-- Table principale des CE (Convention d'Étude)
CREATE TABLE IF NOT EXISTS public.conventions (
    id VARCHAR(50) PRIMARY KEY, -- L'ID de la CE (souvent calqué sur celui de la propale)
    proposal_id VARCHAR(50) REFERENCES public.proposals(id) ON DELETE SET NULL, -- Lien vers la propale d'origine
    status VARCHAR(50) DEFAULT 'en cours', -- 'en cours', 'terminée', 'facturée'
    
    -- Informations de base
    cdp_id INTEGER REFERENCES public.propale_cdp(id) ON DELETE SET NULL,
    study_type VARCHAR(255),
    start_date DATE NOT NULL,
    global_frais_annexes DECIMAL(10,2) DEFAULT 0,
    suivi_jeh_count INTEGER DEFAULT 1,
    suivi_jeh_price DECIMAL(10,2) DEFAULT 200.00,
    total_ht DECIMAL(10,2) DEFAULT 0,
    total_ttc DECIMAL(10,2) DEFAULT 0,
    
    -- Informations Client
    client_company VARCHAR(255),
    is_autoentrepreneur BOOLEAN DEFAULT false,
    client_civilite VARCHAR(20),
    client_first_name VARCHAR(100),
    client_last_name VARCHAR(100),
    client_email VARCHAR(255),
    client_phone VARCHAR(50),
    
    -- Le Contexte
    context_situation TEXT,
    context_intervention TEXT,
    context_enjeu TEXT,
    
    -- Le Cahier des Charges
    cdc_objectifs TEXT,
    cdc_contraintes TEXT,
    cdc_livrables TEXT,
    
    -- Données spécifiques à la CE (pour le futur)
    signature_date DATE,
    billing_schedule TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table des Phases spécifiques à une CE
CREATE TABLE IF NOT EXISTS public.convention_phases (
    id SERIAL PRIMARY KEY,
    convention_id VARCHAR(50) REFERENCES public.conventions(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    
    -- Textes
    name VARCHAR(255) NOT NULL,
    objectifs TEXT,
    methodologie TEXT,
    contraintes TEXT,
    
    -- Échéancier
    duree_semaines INTEGER DEFAULT 1,
    
    -- Intervenants
    intervenants_count DECIMAL(5,1) DEFAULT 1.0,
    intervenants_niveau VARCHAR(10),
    
    -- Budget
    jeh_count INTEGER DEFAULT 1,
    jeh_price DECIMAL(10,2) DEFAULT 200.00
);
