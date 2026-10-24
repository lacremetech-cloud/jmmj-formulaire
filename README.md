# Formulaire JMMJ — World Café

Formulaire mobile (QR code) + interface admin, stockage dans Supabase (projet Sista Scale).

- `index.html` : formulaire public — https://lacremetech-cloud.github.io/jmmj-formulaire/
- `admin.html` : réponses, recherche, export CSV (protégé par code) — https://lacremetech-cloud.github.io/jmmj-formulaire/admin.html
- `config.js` : URL et clé publique Supabase
- `supabase/migrations/` : schéma `formulaire_jmmj` (table `reponses`) et fonctions `public.jmmj_*`
- `google-sheets/Code.gs` : synchronisation vers Google Sheets (Apps Script, solution de secours)
- `assets/qr-code-formulaire.png` : QR code vers le formulaire

## Sécurité

Le schéma `formulaire_jmmj` n'est pas exposé par l'API. Le public peut seulement appeler
`jmmj_submit`. La lecture/suppression exige le code admin, l'export Sheets un jeton ;
les deux sont stockés hachés dans `formulaire_jmmj.config`.

Changer le code admin (SQL Editor Supabase) :

```sql
update formulaire_jmmj.config set admin_code_hash = extensions.crypt('NOUVEAU-CODE', extensions.gen_salt('bf'));
```
