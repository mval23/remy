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

## 3. Let people sign in with a code

Remy signs you in by email, with no password. Installed apps open email links in the browser instead of the app, so Remy asks for the code from the email.

1. Go to **Authentication → Emails** (called *Email Templates* in some versions).
2. Open the **Magic Link** template and replace its body with:

   ```html
   <h2>Your Remy sign-in code</h2>
   <p>Enter this code in Remy: <strong>{{ .Token }}</strong></p>
   <p>Or, on this same device and browser, <a href="{{ .ConfirmationURL }}">sign in with this link</a>.</p>
   ```

3. Do the same for the **Confirm signup** template, which is the one used the very first time you sign in.
4. Save both.

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
- **Email limits:** Supabase's built-in email sender allows only a few sign-in emails per hour. That's plenty for one person. For more, connect your own email service under **Authentication → SMTP Settings**.
- **Deleting your data:** in Remy, **Delete everything** removes the cloud copy too. Deleting the Supabase project removes it all.
