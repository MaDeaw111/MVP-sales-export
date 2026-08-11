# WCAT Sales Support Web App

Release 1 provides approved-profile Google login, Customer/CRM, Product/Spec,
Shipment Configuration, Standard/Special Pricing, PO commercial review, FX
approval, and private Customer PO document storage.

## Local development

1. Copy `.env.example` to `.env.local` and set the public Supabase URL/key.
2. Run `pnpm run dev`.
3. Run `supabase start`, then `supabase db reset` and `supabase test db` for
   local database verification.

Run `pnpm run test:unit` and `pnpm run build` before every release.

See `docs/deployment.md` for hosted Supabase and Cloudflare Pages setup.
