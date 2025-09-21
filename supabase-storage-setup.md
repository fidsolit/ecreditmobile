# Supabase Storage Setup for Profile Pictures

To enable profile picture uploads in your eCredit app, you need to set up a Supabase storage bucket for avatars.

## 1. Create Storage Bucket

In your Supabase dashboard:

1. Go to **Storage** in the left sidebar
2. Click **"New bucket"**
3. Name it `avatars`
4. Set it as **Public** (so profile pictures can be accessed publicly)
5. Click **"Create bucket"**

## 2. Set Up Bucket Policies

In the **Storage** section, click on your `avatars` bucket, then go to **Policies**:

### Policy 1: Allow users to upload their own avatars
```sql
CREATE POLICY "Users can upload their own avatars" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

### Policy 2: Allow users to update their own avatars
```sql
CREATE POLICY "Users can update their own avatars" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

### Policy 3: Allow public read access to avatars
```sql
CREATE POLICY "Public read access for avatars" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');
```

## 3. Alternative: Simple Public Bucket

If you want to keep it simple, you can make the entire bucket public:

1. Go to **Storage** → **avatars** bucket
2. Click **Settings**
3. Toggle **"Public bucket"** to ON

This allows anyone to read files from the bucket, which is fine for profile pictures.

## 4. Test the Setup

Your profile picture upload should now work! The code will:

1. Request camera roll permissions
2. Let users select/crop an image
3. Upload to the `avatars` bucket with a unique filename
4. Update the user's profile with the new image URL
5. Display the new profile picture immediately

## File Naming Convention

The app uses this naming pattern: `{user_id}-{timestamp}.{extension}`

Example: `123e4567-e89b-12d3-a456-426614174000-1640995200000.jpeg`

This ensures:
- Each user can only upload to their own folder
- Files have unique names to prevent conflicts
- Easy to identify which user owns which file
