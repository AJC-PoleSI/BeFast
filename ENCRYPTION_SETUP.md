# AES-256-GCM Encryption System

## Setup

### 1. Generate Master Key
```bash
openssl rand -hex 32
```

### 2. Configure Environment
Add to `.env.local`:
```
ENCRYPTION_MASTER_KEY=<generated_hex_key>
```

### 3. Apply Supabase Migrations
```bash
supabase db push
```

This creates:
- **Migration 022**: Encryption columns (_encrypted, _iv, _auth_tag) on personnes, etudes, missions
- **Migration 023**: RLS policies for encrypted data access control

## Architecture

### Files
- `lib/crypto.ts` - AES-256-GCM encryption/decryption with PBKDF2 key derivation
- `lib/actions/encryption.ts` - Server actions for encrypted profile operations
- `app/api/profil/route.ts` - GET/PUT endpoints for user's own profile
- `app/api/membres/[id]/route.ts` - GET endpoint for other members (with access control)

### Encryption Method
- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Key Derivation**: PBKDF2 (100k iterations, SHA-256)
- **Fields Encrypted**:
  - personnes: NSS, IBAN, adresse, date_naissance, ville, code_postal
  - etudes: budget_ht, notes
  - missions: notes

### Access Control (RLS Policies)
- **Users**: Can read/write own data
- **Managers**: Can read team members' data (via equipes table)
- **Admins**: Can read/write all data

## Usage

### Encrypt Profile Data
```typescript
import { updateProfileWithEncryption } from "@/lib/actions/encryption"

const result = await updateProfileWithEncryption(userId, {
  nss: "12345678901234",
  iban: "FR1234567890...",
  adresse: "123 Rue...",
})
```

### Decrypt Profile Data
```typescript
import { getDecryptedProfile } from "@/lib/actions/encryption"

const profile = await getDecryptedProfile(userId)
// profile.nss, profile.iban, etc. are now decrypted
```

### API Endpoints
```bash
# Get current user's decrypted profile
GET /api/profil

# Update current user's encrypted fields
PUT /api/profil
Body: { nss: "...", iban: "...", adresse: "..." }

# Get another member's decrypted data (with access check)
GET /api/membres/[userId]
```

## Security Notes
- Master key should be strong and unique per environment
- Never commit ENCRYPTION_MASTER_KEY to git
- RLS policies prevent unauthorized decryption at the database level
- Each user gets a unique encryption_salt, making rainbow tables ineffective
