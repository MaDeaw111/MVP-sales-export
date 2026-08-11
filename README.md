# WCAT Sales Support Web App

Release 1 provides approved-profile Email + Password login, Customer/CRM, Product/Spec,
Shipment Configuration, Standard/Special Pricing, PO commercial review, FX
approval, and private Customer PO document storage.

## Product Spec master rules

- The initial Product Spec master contains `PROD-001` to `PROD-012`, each with
  approved version `1.0` technical limits.
- Approved technical limits are historical records. Do not edit an approved
  spec in place.
- An Admin may edit a product's name, short name, and remark from
  **Products & Specs**.
- When a technical limit changes, an Admin must select **Create new product
  from this spec**, assign a new product code, adjust the copied technical
  limits, and create the new approved product. The product and its first
  approved spec are saved together.

## Local development

1. Copy `.env.example` to `.env.local` and set the public Supabase URL/key.
2. Run `pnpm run dev`.
3. Run `supabase start`, then `supabase db reset` and `supabase test db` for
   local database verification.

Run `pnpm run test:unit` and `pnpm run build` before every release.

See `docs/deployment.md` for hosted Supabase and Cloudflare Pages setup.
