-- Simple Admin Fix - Create Missing Tables and Set Admin Access
-- Run this SQL in your Supabase dashboard

-- 1. Create missing tables if they don't exist
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  loan_id UUID REFERENCES loans(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  payment_method TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(15,2),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add missing columns to existing tables
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS disbursement_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE;

-- 3. Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- 4. Drop all existing policies first
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop policies for all tables
    FOR r IN (SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('profiles', 'loans', 'payments', 'activity_log')) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- 5. Create simple admin policies
-- Profiles: Allow admins to see all profiles
CREATE POLICY "admin_profiles_select" ON profiles 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND is_admin = TRUE
  )
);

CREATE POLICY "admin_profiles_update" ON profiles 
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND is_admin = TRUE
  )
);

CREATE POLICY "admin_profiles_insert" ON profiles 
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND is_admin = TRUE
  )
);

-- Loans: Allow admins to see all loans
CREATE POLICY "admin_loans_select" ON loans 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND is_admin = TRUE
  )
);

CREATE POLICY "admin_loans_update" ON loans 
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND is_admin = TRUE
  )
);

CREATE POLICY "admin_loans_insert" ON loans 
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND is_admin = TRUE
  )
);

-- Payments: Allow admins to see all payments
CREATE POLICY "admin_payments_select" ON payments 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND is_admin = TRUE
  )
);

CREATE POLICY "admin_payments_insert" ON payments 
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND is_admin = TRUE
  )
);

-- Activity Log: Allow admins to see all activities
CREATE POLICY "admin_activity_select" ON activity_log 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND is_admin = TRUE
  )
);

CREATE POLICY "admin_activity_insert" ON activity_log 
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND is_admin = TRUE
  )
);

-- 6. Make yourself admin
UPDATE profiles 
SET is_admin = TRUE, email = auth.email()
WHERE id = auth.uid();

-- If the above doesn't work, find your user ID and update manually:
-- SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';
-- UPDATE profiles SET is_admin = TRUE WHERE id = 'your-user-uuid-here';

-- 7. Verify the setup
SELECT 
  'Setup Complete' as status,
  (SELECT COUNT(*) FROM profiles WHERE is_admin = TRUE) as admin_count,
  (SELECT COUNT(*) FROM profiles) as total_profiles,
  (SELECT COUNT(*) FROM loans) as total_loans;

-- Check if you're now an admin
SELECT id, email, is_admin, full_name FROM profiles WHERE id = auth.uid();
