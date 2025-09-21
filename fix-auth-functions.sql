-- Fix Auth Functions Error - Simple Admin Setup
-- This script avoids using auth functions that cause errors in regular SQL

-- 1. Drop ALL existing policies to start fresh
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('profiles', 'loans', 'payments', 'activity_log')) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- 2. Temporarily disable RLS to set up admin status
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 3. Add missing columns if they don't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 4. Create simple policies that don't cause recursion
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles: Allow all authenticated users to read (for admin dashboard)
CREATE POLICY "profiles_select_all" ON profiles 
FOR SELECT TO authenticated USING (true);

-- Allow users to update their own profile
CREATE POLICY "profiles_update_own" ON profiles 
FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Allow users to insert their own profile
CREATE POLICY "profiles_insert_own" ON profiles 
FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Loans: Allow all authenticated users to read
CREATE POLICY "loans_select_all" ON loans 
FOR SELECT TO authenticated USING (true);

-- Allow users to update their own loans
CREATE POLICY "loans_update_own" ON loans 
FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Allow users to insert their own loans
CREATE POLICY "loans_insert_own" ON loans 
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Payments: Allow all authenticated users to read
CREATE POLICY "payments_select_all" ON payments 
FOR SELECT TO authenticated USING (true);

-- Allow admins to insert payments (we'll handle this in the app)
CREATE POLICY "payments_insert_all" ON payments 
FOR INSERT TO authenticated WITH CHECK (true);

-- Activity Log: Allow all authenticated users to read
CREATE POLICY "activity_select_all" ON activity_log 
FOR SELECT TO authenticated USING (true);

-- Allow users to insert their own activities
CREATE POLICY "activity_insert_own" ON activity_log 
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- 5. Show current user information to help you set yourself as admin
SELECT 
    'Current User Info' as info_type,
    id as user_id,
    email,
    raw_user_meta_data->>'full_name' as full_name
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 5;

-- 6. Instructions for setting yourself as admin
SELECT 
    'MANUAL STEP REQUIRED' as instruction,
    'Copy your user ID from above and run this command:' as step1,
    'UPDATE profiles SET is_admin = TRUE WHERE id = ''your-user-id-here'';' as step2,
    'Replace ''your-user-id-here'' with your actual user ID' as step3;

-- 7. Verify current setup
SELECT 
    'Current Setup Status' as status,
    (SELECT COUNT(*) FROM profiles) as total_profiles,
    (SELECT COUNT(*) FROM profiles WHERE is_admin = TRUE) as admin_count,
    (SELECT COUNT(*) FROM loans) as total_loans,
    (SELECT COUNT(*) FROM payments) as total_payments;

-- 8. Show current policies
SELECT 
    tablename,
    policyname,
    cmd,
    permissive
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename IN ('profiles', 'loans', 'payments', 'activity_log')
ORDER BY tablename, policyname;
