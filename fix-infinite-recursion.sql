-- Fix Infinite Recursion in RLS Policies
-- This script resolves the circular dependency in the profiles table policies

-- First, let's check what policies currently exist
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename = 'profiles'
ORDER BY policyname;

-- Drop all existing policies on profiles table to break the recursion
DROP POLICY IF EXISTS "admin_profiles_select" ON profiles;
DROP POLICY IF EXISTS "admin_profiles_update" ON profiles;
DROP POLICY IF EXISTS "admin_profiles_insert" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Create a function to check admin status without triggering RLS
CREATE OR REPLACE FUNCTION is_admin_user(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    admin_status BOOLEAN;
BEGIN
    -- Query profiles table with RLS bypassed for admin check
    SELECT COALESCE(is_admin, FALSE) INTO admin_status
    FROM profiles
    WHERE id = user_id;
    
    RETURN COALESCE(admin_status, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new policies that avoid recursion
-- Allow users to see their own profile OR admins to see all profiles
CREATE POLICY "profiles_select_policy" ON profiles 
FOR SELECT USING (
    auth.uid() = id OR is_admin_user(auth.uid())
);

-- Allow users to update their own profile OR admins to update any profile
CREATE POLICY "profiles_update_policy" ON profiles 
FOR UPDATE USING (
    auth.uid() = id OR is_admin_user(auth.uid())
);

-- Allow users to insert their own profile OR admins to insert any profile
CREATE POLICY "profiles_insert_policy" ON profiles 
FOR INSERT WITH CHECK (
    auth.uid() = id OR is_admin_user(auth.uid())
);

-- Also fix other tables' policies to use the same pattern
-- Drop existing policies on other tables
DROP POLICY IF EXISTS "admin_loans_select" ON loans;
DROP POLICY IF EXISTS "admin_loans_update" ON loans;
DROP POLICY IF EXISTS "admin_loans_insert" ON loans;
DROP POLICY IF EXISTS "Users can view own loans" ON loans;
DROP POLICY IF EXISTS "Users can insert own loans" ON loans;

DROP POLICY IF EXISTS "admin_payments_select" ON payments;
DROP POLICY IF EXISTS "admin_payments_insert" ON payments;
DROP POLICY IF EXISTS "Users can view own payments" ON payments;

DROP POLICY IF EXISTS "admin_activity_select" ON activity_log;
DROP POLICY IF EXISTS "admin_activity_insert" ON activity_log;
DROP POLICY IF EXISTS "Users can view own activities" ON activity_log;
DROP POLICY IF EXISTS "Users can insert own activities" ON activity_log;

-- Create new policies for loans
CREATE POLICY "loans_select_policy" ON loans 
FOR SELECT USING (
    user_id = auth.uid() OR is_admin_user(auth.uid())
);

CREATE POLICY "loans_update_policy" ON loans 
FOR UPDATE USING (
    user_id = auth.uid() OR is_admin_user(auth.uid())
);

CREATE POLICY "loans_insert_policy" ON loans 
FOR INSERT WITH CHECK (
    user_id = auth.uid() OR is_admin_user(auth.uid())
);

-- Create new policies for payments
CREATE POLICY "payments_select_policy" ON payments 
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM loans 
        WHERE loans.id = payments.loan_id 
        AND (loans.user_id = auth.uid() OR is_admin_user(auth.uid()))
    )
);

CREATE POLICY "payments_insert_policy" ON payments 
FOR INSERT WITH CHECK (
    is_admin_user(auth.uid())
);

-- Create new policies for activity_log
CREATE POLICY "activity_select_policy" ON activity_log 
FOR SELECT USING (
    user_id = auth.uid() OR is_admin_user(auth.uid())
);

CREATE POLICY "activity_insert_policy" ON activity_log 
FOR INSERT WITH CHECK (
    user_id = auth.uid() OR is_admin_user(auth.uid())
);

-- Make sure you have an admin profile
-- First check if your profile exists
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

-- Alternative: If the above doesn't work, manually set admin status
-- Replace 'your-user-uuid-here' with your actual user ID
-- UPDATE profiles SET is_admin = TRUE WHERE id = 'your-user-uuid-here';

-- Test the policies by checking if they work
SELECT 
    'Policy Test' as test_name,
    is_admin_user(auth.uid()) as current_user_is_admin,
    (SELECT COUNT(*) FROM profiles WHERE is_admin = TRUE) as total_admins,
    (SELECT COUNT(*) FROM profiles) as total_profiles;

-- Verify the setup
SELECT 
    'Setup Complete' as status,
    (SELECT COUNT(*) FROM profiles WHERE is_admin = TRUE) as admin_count,
    (SELECT COUNT(*) FROM profiles) as total_profiles,
    (SELECT COUNT(*) FROM loans) as total_loans;

-- Show current policies
SELECT 
    tablename,
    policyname,
    cmd,
    permissive
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename IN ('profiles', 'loans', 'payments', 'activity_log')
ORDER BY tablename, policyname;
