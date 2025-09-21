# Admin Dashboard Troubleshooting Guide

## Issue: Admin Dashboard Only Shows Current User

If your admin dashboard is only showing the current user instead of all users, this is likely due to Row Level Security (RLS) policies in Supabase.

## Quick Fix Steps

### 1. Run the RLS Policy Fix
Execute the SQL commands in `fix-admin-rls-policies.sql` in your Supabase dashboard:

1. Go to **SQL Editor** in your Supabase dashboard
2. Copy and paste the contents from `fix-admin-rls-policies.sql`
3. Click **Run** to execute the commands

### 2. Set Yourself as Admin
After running the RLS fix, make sure you're marked as an admin:

```sql
-- Find your user ID first
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- Then set yourself as admin (replace with your actual user ID)
UPDATE profiles 
SET is_admin = TRUE 
WHERE id = 'your-user-uuid-here';
```

### 3. Test the Admin Dashboard
1. Sign out and sign back in
2. You should now see the admin dashboard
3. Check if you can see all users in the Users tab

## Alternative Manual Setup

If the automated fix doesn't work, you can manually set up the policies:

### Step 1: Check if you have admin privileges
```sql
SELECT id, email, is_admin FROM profiles WHERE id = auth.uid();
```

### Step 2: Set yourself as admin
```sql
UPDATE profiles SET is_admin = TRUE WHERE id = auth.uid();
```

### Step 3: Create admin-friendly RLS policies
```sql
-- For profiles table
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Admin can view all profiles" ON profiles 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND is_admin = TRUE
  )
);

-- For loans table  
DROP POLICY IF EXISTS "Users can view own loans" ON loans;
CREATE POLICY "Admin can view all loans" ON loans 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND is_admin = TRUE
  )
);
```

## Verification Steps

### 1. Check Your Admin Status
```sql
SELECT 
  p.id, 
  p.email, 
  p.is_admin,
  p.created_at
FROM profiles p 
WHERE p.id = auth.uid();
```

### 2. Test User Access
```sql
-- This should return all users if you're admin
SELECT COUNT(*) as total_users FROM profiles;

-- This should return all loans if you're admin  
SELECT COUNT(*) as total_loans FROM loans;
```

### 3. Check RLS Policies
```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('profiles', 'loans')
ORDER BY tablename, policyname;
```

## Common Issues & Solutions

### Issue 1: "Permission denied" errors
**Solution:** RLS policies are too restrictive. Run the fix script.

### Issue 2: Only seeing your own data
**Solution:** Your `is_admin` flag is not set to `TRUE`. Update it manually.

### Issue 3: Admin dashboard not loading
**Solution:** Check if your profile exists and has admin privileges.

### Issue 4: Users tab is empty
**Solution:** RLS policies are blocking admin access. Update the policies.

## Testing with Multiple Users

To test if the admin dashboard works properly:

1. **Create test users:**
   - Sign up with different email addresses
   - Complete their profiles
   - Apply for loans

2. **Verify admin access:**
   - Sign in as admin
   - Check if you can see all users
   - Verify you can see all loans
   - Test user management functions

## Debug Information

The admin dashboard now includes better error handling and logging. Check the browser console for:
- User loading errors
- Permission denied messages
- Admin access verification logs

## Still Having Issues?

If you're still having problems:

1. **Check the browser console** for error messages
2. **Verify your user ID** in the Supabase dashboard
3. **Ensure RLS is enabled** but policies allow admin access
4. **Test with a fresh admin account** if needed

The admin dashboard should now properly display all users and their information once the RLS policies are correctly configured.
