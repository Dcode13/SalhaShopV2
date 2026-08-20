-- ============================================================
-- Row Level Security — lapis pengaman ke-3 (PRD §10)
-- Jalankan di Supabase SQL Editor SETELAH `prisma migrate` /
-- `prisma db push` membuat semua tabel.
--
-- Catatan penting:
--  * Aplikasi Next.js mengakses DB lewat Prisma dengan role `postgres`
--    (BYPASSRLS), jadi aplikasi tetap jalan normal.
--  * RLS ini melindungi dari akses langsung lewat PostgREST/anon key
--    Supabase — seandainya suatu saat ada endpoint yang lupa dijaga.
--  * Kolom identitas Prisma memakai camelCase → wajib pakai kutip ganda.
-- ============================================================

-- Aktifkan RLS di tabel-tabel sensitif (tanpa policy = tertutup total
-- untuk role anon/authenticated; hanya service_role/postgres yang lewat)
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE outlets           ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE products          ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_units     ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_prices    ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases         ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summaries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE receivables       ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_opnames     ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_opname_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_returns      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_requests  ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- Contoh policy scoping per outlet (aktif bila nanti memakai
-- Supabase Auth + akses client-side; kolom users."supabaseId"
-- disinkronkan dengan auth.users.id)
-- ------------------------------------------------------------

CREATE POLICY sales_scope ON sales
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u."supabaseId" = auth.uid()::text
        AND (u.role = 'OWNER' OR u."outletId" = sales."outletId")
    )
  );

CREATE POLICY inventories_scope ON inventories
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u."supabaseId" = auth.uid()::text
        AND (u.role = 'OWNER' OR u."outletId" = inventories."outletId")
    )
  );

CREATE POLICY cash_sessions_scope ON cash_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u."supabaseId" = auth.uid()::text
        AND (u.role = 'OWNER' OR u."outletId" = cash_sessions."outletId")
    )
  );
