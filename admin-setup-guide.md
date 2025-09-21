# Admin Dashboard Setup Guide

## How to Set Up Admin Access

### 1. Database Setup

First, run the updated database schema in your Supabase dashboard:

```sql
-- Add the is_admin column to profiles table
ALTER TABLE profiles ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
```

### 2. Create Your First Admin User

In your Supabase dashboard, go to **SQL Editor** and run:

```sql
-- Replace 'your-user-uuid-here' with your actual user ID from auth.users
UPDATE profiles 
SET is_admin = TRUE 
WHERE id = 'your-user-uuid-here';
```

To find your user ID:
1. Go to **Authentication** → **Users** in your Supabase dashboard
2. Copy the UUID of your user account
3. Use that UUID in the SQL command above

### 3. Admin Dashboard Features

Once you're set as an admin, you'll have access to:

#### **Overview Tab**
- **Statistics Cards**: Total users, loans, pending applications, revenue
- **Recent Activity**: Latest loan applications with status
- **Real-time Data**: Pull-to-refresh functionality

#### **Loans Tab**
- **All Loan Applications**: Complete list with details
- **Approve/Reject Actions**: One-click loan approval
- **Loan Details**: Amount, term, monthly payment, applicant info
- **Status Management**: Track loan lifecycle

#### **Users Tab**
- **User Management**: View all registered users
- **User Information**: Names, emails, join dates
- **Credit Information**: Credit scores and loan limits
- **User Profiles**: Avatar and contact details

### 4. Admin Dashboard Functions

#### **Loan Management**
- ✅ **View all applications** in real-time
- ✅ **Approve or reject loans** with one click
- ✅ **Track application dates** and status changes
- ✅ **See loan calculations** and terms

#### **User Management**
- ✅ **Monitor user registrations**
- ✅ **View user profiles** and information
- ✅ **Track credit scores** and loan limits
- ✅ **User activity overview**

#### **Analytics & Reporting**
- ✅ **Total users** count
- ✅ **Loan volume** and amounts
- ✅ **Revenue tracking** from interest
- ✅ **Pending applications** monitoring

### 5. Security Features

- **Admin-only access**: Only users with `is_admin = TRUE` can access
- **Automatic logout**: Session management with Supabase Auth
- **Real-time updates**: Live data from your database
- **Error handling**: Graceful fallbacks and user feedback

### 6. Using the Admin Dashboard

1. **Sign in** with your admin account
2. **Navigate tabs** using the top navigation
3. **Review loan applications** in the Loans tab
4. **Approve/reject loans** by tapping action buttons
5. **Monitor statistics** in the Overview tab
6. **Pull to refresh** for latest data

### 7. Making Other Users Admin

To make additional users admin:

```sql
-- Replace 'user-uuid-here' with the target user's UUID
UPDATE profiles 
SET is_admin = TRUE 
WHERE id = 'user-uuid-here';
```

### 8. Removing Admin Access

To remove admin privileges:

```sql
-- Replace 'user-uuid-here' with the target user's UUID
UPDATE profiles 
SET is_admin = FALSE 
WHERE id = 'user-uuid-here';
```

## Admin Dashboard Benefits

- **Efficient loan processing** with one-click approvals
- **Complete user oversight** and management
- **Real-time business metrics** and analytics
- **Professional interface** for loan operations
- **Mobile-responsive design** for on-the-go management

Your admin dashboard is now ready to help you manage your eCredit loan platform efficiently! 🚀
