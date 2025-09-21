-- Fix Type Mismatch Between Tables
-- This script handles the UUID vs INTEGER type mismatch for loan IDs

-- First, let's check what types actually exist in your database
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('loans', 'profiles') 
    AND column_name IN ('id', 'user_id', 'loan_id')
ORDER BY table_name, column_name;

-- Check if loans table exists and what type its ID column is
DO $$ 
DECLARE
    loans_id_type TEXT;
BEGIN
    -- Get the data type of the loans.id column
    SELECT data_type INTO loans_id_type
    FROM information_schema.columns 
    WHERE table_name = 'loans' AND column_name = 'id';
    
    IF loans_id_type IS NULL THEN
        RAISE NOTICE 'Loans table does not exist. Creating with UUID primary key.';
        
        -- Create loans table with UUID primary key
        CREATE TABLE IF NOT EXISTS loans (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            amount DECIMAL(15,2) NOT NULL,
            interest_rate DECIMAL(5,2) NOT NULL,
            term_months INTEGER NOT NULL,
            monthly_payment DECIMAL(15,2) NOT NULL,
            status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'active', 'completed')),
            application_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            approval_date TIMESTAMP WITH TIME ZONE,
            disbursement_date TIMESTAMP WITH TIME ZONE,
            due_date TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        loans_id_type := 'uuid';
    ELSE
        RAISE NOTICE 'Loans table exists with ID type: %', loans_id_type;
    END IF;
    
    -- Create payments table with matching loan_id type
    IF loans_id_type = 'integer' THEN
        RAISE NOTICE 'Creating payments table with INTEGER loan_id to match loans table.';
        
        -- Drop payments table if it exists with wrong type
        DROP TABLE IF EXISTS payments;
        
        CREATE TABLE payments (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            loan_id INTEGER REFERENCES loans(id) ON DELETE CASCADE,
            amount DECIMAL(15,2) NOT NULL,
            payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            payment_method TEXT,
            status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    ELSE
        RAISE NOTICE 'Creating payments table with UUID loan_id to match loans table.';
        
        -- Drop payments table if it exists with wrong type
        DROP TABLE IF EXISTS payments;
        
        CREATE TABLE payments (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            loan_id UUID REFERENCES loans(id) ON DELETE CASCADE,
            amount DECIMAL(15,2) NOT NULL,
            payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            payment_method TEXT,
            status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    END IF;
    
END $$;

-- Create activity_log table (this should always work since it references auth.users)
CREATE TABLE IF NOT EXISTS activity_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(15,2),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to existing tables
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS disbursement_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE;

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('profiles', 'loans', 'payments', 'activity_log')) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- Create admin-friendly policies
-- Profiles policies
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

-- Loans policies
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

-- Payments policies
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

-- Activity Log policies
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

-- Make yourself admin
UPDATE profiles 
SET is_admin = TRUE, email = auth.email()
WHERE id = auth.uid();

-- If the above doesn't work, find your user ID and update manually:
-- SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';
-- UPDATE profiles SET is_admin = TRUE WHERE id = 'your-user-uuid-here';

-- Verify the setup
SELECT 
    'Setup Complete' as status,
    (SELECT COUNT(*) FROM profiles WHERE is_admin = TRUE) as admin_count,
    (SELECT COUNT(*) FROM profiles) as total_profiles,
    (SELECT COUNT(*) FROM loans) as total_loans,
    (SELECT COUNT(*) FROM payments) as total_payments;

-- Check column types after setup
SELECT 
    table_name, 
    column_name, 
    data_type
FROM information_schema.columns 
WHERE table_name IN ('loans', 'payments') 
    AND column_name IN ('id', 'loan_id')
ORDER BY table_name, column_name;

-- Check if you're now an admin
SELECT id, email, is_admin, full_name FROM profiles WHERE id = auth.uid();
