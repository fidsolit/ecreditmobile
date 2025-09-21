-- Fix RLS Policies for Admin Dashboard Access
-- Run this SQL in your Supabase dashboard to allow admins to view all users

-- First, let's create missing tables if they don't exist
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

-- Add missing columns to existing tables if they don't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS disbursement_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE;

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

DROP POLICY IF EXISTS "Users can view own loans" ON loans;
DROP POLICY IF EXISTS "Users can insert own loans" ON loans;

DROP POLICY IF EXISTS "Users can view own payments" ON payments;

DROP POLICY IF EXISTS "Users can view own activities" ON activity_log;
DROP POLICY IF EXISTS "Users can insert own activities" ON activity_log;

-- Create new admin-friendly policies for profiles
CREATE POLICY "Users can view own profile or admin can view all" ON profiles 
FOR SELECT USING (
  auth.uid() = id OR 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND is_admin = TRUE
  )
);

CREATE POLICY "Users can update own profile or admin can update all" ON profiles 
FOR UPDATE USING (
  auth.uid() = id OR 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND is_admin = TRUE
  )
);

CREATE POLICY "Users can insert own profile or admin can insert all" ON profiles 
FOR INSERT WITH CHECK (
  auth.uid() = id OR 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND is_admin = TRUE
  )
);

-- Create new admin-friendly policies for loans
CREATE POLICY "Users can view own loans or admin can view all" ON loans 
FOR SELECT USING (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND is_admin = TRUE
  )
);

CREATE POLICY "Users can insert own loans or admin can insert all" ON loans 
FOR INSERT WITH CHECK (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND is_admin = TRUE
  )
);

CREATE POLICY "Admin can update all loans" ON loans 
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND is_admin = TRUE
  )
);

-- Create new admin-friendly policies for payments
CREATE POLICY "Users can view own payments or admin can view all" ON payments 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM loans 
    WHERE loans.id = payments.loan_id AND loans.user_id = auth.uid()
  ) OR 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND is_admin = TRUE
  )
);

CREATE POLICY "Admin can insert all payments" ON payments 
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND is_admin = TRUE
  )
);

-- Create new admin-friendly policies for activity_log
CREATE POLICY "Users can view own activities or admin can view all" ON activity_log 
FOR SELECT USING (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND is_admin = TRUE
  )
);

CREATE POLICY "Users can insert own activities or admin can insert all" ON activity_log 
FOR INSERT WITH CHECK (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND is_admin = TRUE
  )
);

-- Make yourself admin (replace 'your-user-uuid-here' with your actual user ID)
-- To find your user ID: Go to Authentication > Users in Supabase dashboard
UPDATE profiles 
SET is_admin = TRUE 
WHERE id = auth.uid();

-- Alternative: If you know your user ID, you can use this instead:
-- UPDATE profiles 
-- SET is_admin = TRUE 
-- WHERE id = 'your-user-uuid-here';

-- Verify the policies are working
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
  AND tablename IN ('profiles', 'loans', 'payments', 'activity_log')
ORDER BY tablename, policyname;
