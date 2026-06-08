# Working Rules
- Läs alltid `AGENTS.md` innan du gör ändringar.
- Ändra bara kod som är direkt relevant för den aktuella uppgiften.
- Behåll svenska tecken. Alla filer ska sparas i UTF-8. Om det finns risk för felkodning, använd Unicode-escapes (t.ex. `\u00e5`) i strängar.
- Starta om backend eller andra lokala processer automatiskt när det behövs (utan att be användaren).

# MPS2 Documentation
- C:\Temp - Allt under min användare\Misc\mps2-170925-084806.pdf

# GiftcardV3 API
- https://giftcardv3api-preprod.microdeb.se/api-docs/
- Fokus: `Orders` (skicka om / omplanera, avbryta schemalagd leverans)

# Databasschema
- C:\Temp - Allt under min användare\Misc\MPS Schema\MPSschema_oncard.rpt
- C:\Temp - Allt under min användare\Misc\AI\giftcardV3.rpt

# Git-rutin för samarbete
- `main` ska alltid vara fungerande och stabil.
- Ingen ska arbeta direkt i `main`.
- Skapa alltid en kortlivad branch per uppgift från senaste `main`.
- Använd branch-prefix:
  - `feature/` för nya funktioner
  - `fix/` för buggrättningar
  - `hotfix/` för akuta rättningar
  - `design/` för rena UI/designändringar
  - `chore/` för tekniskt underhåll
- Rekommenderat flöde:
  - `git checkout main`
  - `git pull origin main`
  - `git checkout -b <branchnamn>`
  - gör ändringen
  - `git push -u origin <branchnamn>`
- Brancher ska vara små och avgränsade till en uppgift.
- Om en branch lever längre än en dag ska den synkas med `main` ofta.
- Mergning till `main` ska ske först när ändringen är testad och genomgången.
- Tagga stabila versioner när användaren ber om det.
