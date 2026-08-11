# Release 1 deployment checklist

## Supabase

1. In the Supabase project, configure Google as an Auth provider and add the
   Cloudflare Pages production URL and preview URL to Auth redirect URLs.
2. Bootstrap the first Admin through the SQL editor, using the employee's exact
   lowercase Google email:

   ```sql
   insert into public.user_profiles (email, role, is_active)
   values ('admin@wcat.example', 'ADMIN', true);
   ```

3. Link the local CLI to the approved project and apply migrations one operator
   at a time:

   ```powershell
   .\node_modules\.bin\supabase.cmd link --project-ref qopretpbnebzyhwlanps
   .\node_modules\.bin\supabase.cmd db push
   ```

4. Verify the bucket `customer-po-private` is private and run database advisors.
   Do not use direct dashboard table edits after migrations are adopted.

## Cloudflare Pages

1. Connect the repository and use `pnpm run build` as the build command.
2. Set output directory to `dist`.
3. Add only these build-time variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Never add a Supabase secret/service-role key to Cloudflare Pages browser
   variables.

## Release verification

```powershell
pnpm run test:unit
pnpm run build
supabase test db
```

Confirm an unapproved Google account is rejected, an External Sales user cannot
see another agent's customer, and a Management user can approve FX/Special Price.
