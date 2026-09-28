# Setting up sign-in and sync

Remy works fully on one device without any of this. These steps turn on **sync**, so your phone and computer share the same profile, week and grocery list.

It uses [Supabase](https://supabase.com), which has a free plan. You'll create the account yourself; nobody else can do that step for you. Plan on about 15 minutes.

## 1. Create the Supabase project

1. Sign up at [supabase.com](https://supabase.com) (signing in with GitHub is easiest).
2. Click **New project**.
   - **Name:** `remy`
   - **Database password:** click *Generate*, then save it in your password manager. Remy never needs it, but you'd need it to manage the database later.
   - **Region:** the one closest to you.
3. Wait a minute or two while the project is created.

## 2. Create the table

1. In the left menu, open **SQL Editor** and click **New query**.
2. Open [`supabase/schema.sql`](supabase/schema.sql) from this project, copy everything, and paste it into the editor.
3. Click **Run**. You should see “Success. No rows returned.”

This creates one table where each person gets exactly one row, and security rules so each signed-in person can only read and change their own row.

## 3. Check the email sign-in setting

Remy signs you in with your email and a password. You don't need to change any email templates, and you don't need your own email domain.

1. Go to **Authentication → Sign In / Providers** (called *Providers* in some versions).
2. Make sure **Email** is turned on. It is by default.
3. Leave **Confirm email** turned on. When you create your Remy account, Supabase emails you one link to confirm the address. Open it once, on any device, then sign in to Remy with your email and password.

If you ever forget the password, Remy's **Forgot your password?** link emails you a reset link using Supabase's standard email.

## 4. Tell Supabase where Remy lives

1. Go to **Authentication → URL Configuration**.
2. **Site URL:** `https://mval23.github.io/remy/`
3. Under **Redirect URLs**, add both of these:
   - `https://mval23.github.io/remy/`
   - `http://localhost:5173/`

## 5. Copy the two connection values

1. Go to **Project Settings → API** (or **API Keys**).
2. Copy the **Project URL** (it looks like `https://abcdefgh.supabase.co`).
3. Copy the **anon / publishable** key. Don't copy the *service_role* or *secret* key: that one must stay private.

The anon key is designed to be public. It's built into the app, and the security rules from step 2 protect your data.

## 6. Give the values to the published app

1. On GitHub, open the repository, then **Settings → Secrets and variables → Actions → Variables** tab.
2. Click **New repository variable** twice:
   - Name `SUPABASE_URL`, value: the Project URL
   - Name `SUPABASE_ANON_KEY`, value: the anon key
3. Go to the **Actions** tab, choose **Deploy to GitHub Pages**, and click **Run workflow**. In about two minutes the published app has sync.

## 7. (Optional) Turn on sync on your computer while developing

In the `app` folder, copy `.env.example` to a new file named `.env.local` and fill in the two values. Git ignores `.env.local`, so it never gets uploaded. Restart `npm run dev`.

## Good to know about the free plan

- **Pausing:** free projects pause after about a week with no activity. Your data is kept. Remy keeps working on each device, and sync resumes after you click **Restore** in the Supabase dashboard.
- **Email limits:** Supabase's built-in email sender allows only a few emails per hour. Remy only emails you when you create the account or reset the password, so that's plenty.
- **Deleting your data:** in Remy, **Delete everything** removes the cloud copy too. Deleting the Supabase project removes it all.
