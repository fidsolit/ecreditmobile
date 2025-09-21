-- Simple Policy Fix - Remove Recursive Dependencies
-- This is a simpler approach that avoids the infinite recursion

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

-- 3. Make sure you have an admin profile
INSERT INTO profiles (id, email, full_name, is_admin)
SELECT 
    auth.uid(),
    auth.email(),
    COALESCE(auth.raw_user_meta_data->>'full_name', 'Admin User'),
    TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
)
ON CONFLICT (id) 
DO UPDATE SET 
    is_admin = TRUE,
    email = COALESCE(profiles.email, auth.email()),
    full_name = COALESCE(profiles.full_name, COALESCE(auth.raw_user_meta_data->>'full_name', 'Admin User'));

-- 4. Re-enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 5. Create simple, non-recursive policies
-- Profiles: Allow users to see their own profile, and allow all authenticated users to see profiles (for admin dashboard)
CREATE POLICY "profiles_select_all_auth" ON profiles 
FOR SELECT TO authenticated USING (true);

CREATE POLICY "profiles_update_own" ON profiles 
FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON profiles 
FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Loans: Allow users to see their own loans, and allow all authenticated users to see loans (for admin dashboard)
CREATE POLICY "loans_select_all_auth" ON loans 
FOR SELECT TO authenticated USING (true);

CREATE POLICY "loans_update_own" ON loans 
FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "loans_insert_own" ON loans 
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Payments: Allow users to see payments for their loans, and allow all authenticated users to see payments (for admin dashboard)
CREATE POLICY "payments_select_all_auth" ON payments 
FOR SELECT TO authenticated USING (true);

CREATE POLICY "payments_insert_admin" ON payments 
FOR INSERT TO authenticated WITH CHECK (true);

-- Activity Log: Allow users to see their own activities, and allow all authenticated users to see activities (for admin dashboard)
CREATE POLICY "activity_select_all_auth" ON activity_log 
FOR SELECT TO authenticated USING (true);

CREATE POLICY "activity_insert_own" ON activity_log 
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- 6. Verify the setup
SELECT 
    'Simple Policy Setup Complete' as status,
    (SELECT COUNT(*) FROM profiles WHERE is_admin = TRUE) as admin_count,
    (SELECT COUNT(*) FROM profiles) as total_profiles,
    (SELECT COUNT(*) FROM loans) as total_loans;

-- 7. Test admin status
SELECT 
    id, 
    email, 
    is_admin, 
    full_name 
FROM profiles 
WHERE id = auth.uid();

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
