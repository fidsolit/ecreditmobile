-- Final Admin Fix - Complete Setup Without Auth Function Errors
-- This script completely sets up admin access without using problematic auth functions

-- 1. Drop ALL existing policies to start fresh
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('profiles', 'loans', 'payments', 'activity_log')) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- 2. Temporarily disable RLS
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE loans DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log DISABLE ROW LEVEL SECURITY;

-- 3. Add missing columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS disbursement_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE;

-- 4. Create missing tables if they don't exist
CREATE TABLE IF NOT EXISTS payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    loan_id INTEGER REFERENCES loans(id) ON DELETE CASCADE,
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

-- 5. Make the most recent user an admin (this should be you if you just signed up)
UPDATE profiles 
SET is_admin = TRUE, email = (SELECT email FROM auth.users WHERE id = profiles.id)
WHERE id IN (
    SELECT id FROM profiles 
    ORDER BY created_at DESC 
    LIMIT 1
);

-- 6. Re-enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- 7. Create simple, non-recursive policies
-- Profiles: Allow all authenticated users to read (for admin dashboard)
CREATE POLICY "profiles_select_all" ON profiles 
FOR SELECT TO authenticated USING (true);

CREATE POLICY "profiles_update_own" ON profiles 
FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON profiles 
FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Loans: Allow all authenticated users to read
CREATE POLICY "loans_select_all" ON loans 
FOR SELECT TO authenticated USING (true);

CREATE POLICY "loans_update_own" ON loans 
FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "loans_insert_own" ON loans 
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Payments: Allow all authenticated users to read
CREATE POLICY "payments_select_all" ON payments 
FOR SELECT TO authenticated USING (true);

CREATE POLICY "payments_insert_all" ON payments 
FOR INSERT TO authenticated WITH CHECK (true);

-- Activity Log: Allow all authenticated users to read
CREATE POLICY "activity_select_all" ON activity_log 
FOR SELECT TO authenticated USING (true);

CREATE POLICY "activity_insert_own" ON activity_log 
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- 8. Verify the setup
SELECT 
    'Setup Complete!' as status,
    (SELECT COUNT(*) FROM profiles) as total_profiles,
    (SELECT COUNT(*) FROM profiles WHERE is_admin = TRUE) as admin_count,
    (SELECT COUNT(*) FROM loans) as total_loans,
    (SELECT COUNT(*) FROM payments) as total_payments;

-- 9. Show admin users
SELECT 
    'Admin Users:' as info,
    id,
    email,
    full_name,
    is_admin,
    created_at
FROM profiles 
WHERE is_admin = TRUE;

-- 10. Show current policies
SELECT 
    'Current Policies:' as info,
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename IN ('profiles', 'loans', 'payments', 'activity_log')
ORDER BY tablename, policyname;
