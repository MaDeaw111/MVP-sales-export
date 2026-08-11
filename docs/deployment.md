# Release 1 deployment checklist

## Supabase

1. In the Supabase Dashboard, open **Authentication → Users → Add user**.
   Create the user with their work email and a strong temporary password.
   Confirm the user in the Dashboard when prompted, or have the user complete
   the confirmation email before their first sign-in.
2. Bootstrap the first Admin through the SQL editor before that user signs in,
   using the employee's exact lowercase email:

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

## Product Spec master data

`Data/Product_Spec.xlsx` supplies the approved `1.0` specifications for
`PROD-001` through `PROD-012`. Its technical limits are stored in
`product_specs.parameters`. After a spec is approved, do not change those
technical values in place: create a new Product Code and a new approved spec.
Admin may still update non-technical product master fields such as name, short
name, and remark.

## Release verification

```powershell
pnpm run test:unit
pnpm run build
supabase test db
```

Confirm an authenticated but unapproved account is rejected, an External Sales
user cannot see another agent's customer, and a Management user can approve
FX/Special Price.
