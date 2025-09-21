-- Create Missing Tables and Fix Admin Access
-- Run this SQL in your Supabase dashboard

-- First, let's create the missing payments table if it doesn't exist
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  loan_id UUID REFERENCES loans(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  payment_method TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create activity_log table if it doesn't exist
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

-- Add missing columns to loans table if they don't exist
ALTER TABLE loans ADD COLUMN IF NOT EXISTS disbursement_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE;

-- Enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

DROP POLICY IF EXISTS "Users can view own loans" ON loans;
DROP POLICY IF EXISTS "Users can insert own loans" ON loans;

DROP POLICY IF EXISTS "Users can view own payments" ON payments;
DROP POLICY IF EXISTS "Users can insert own payments" ON payments;

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

-- Create functions for updating timestamps if they don't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_loans_updated_at ON loans;
CREATE TRIGGER update_loans_updated_at BEFORE UPDATE ON loans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Make yourself admin (this will work for the current user)
UPDATE profiles 
SET is_admin = TRUE, email = auth.email()
WHERE id = auth.uid();

-- If the above doesn't work, you can manually set your user ID
-- First, find your user ID:
-- SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';
-- Then update:
-- UPDATE profiles SET is_admin = TRUE WHERE id = 'your-user-uuid-here';

-- Verify the setup
SELECT 
  'profiles' as table_name,
  COUNT(*) as record_count
FROM profiles
UNION ALL
SELECT 
  'loans' as table_name,
  COUNT(*) as record_count
FROM loans
UNION ALL
SELECT 
  'payments' as table_name,
  COUNT(*) as record_count
FROM payments
UNION ALL
SELECT 
  'activity_log' as table_name,
  COUNT(*) as record_count
FROM activity_log;

-- Check if you're now an admin
SELECT id, email, is_admin, full_name FROM profiles WHERE id = auth.uid();
