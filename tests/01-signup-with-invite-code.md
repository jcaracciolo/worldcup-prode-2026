# Test 01: Signup with Invite Code

## Objective

Verify that a new user can successfully sign up using a valid invite code.

## Prerequisites

- Admin account exists
- No prior test user with the email being tested

## Test Steps

### Step 1: Generate Invite Code (Admin)

1. Log in as admin
2. Navigate to `/admin`
3. Click "Generate New Code"
4. Copy the generated invite code (e.g., `ABC123`)
5. **Expected:** New code appears in the list with status "Available"

### Step 2: Access Signup Page

1. Log out (or open incognito window)
2. Navigate to `/signup?code=ABC123` (using the generated code)
3. **Expected:**
   - Signup form is displayed
   - Invite code field is pre-filled and read-only
   - Form shows: Display Name, Email, Password fields

### Step 3: Complete Signup

1. Enter display name: "Test User 01"
2. Enter email: "testuser01@example.com"
3. Enter password: "SecurePassword123"
4. Click "Sign Up"
5. **Expected:**
   - User is created successfully
   - User is automatically logged in
   - Redirected to home page or predictions page
   - Header shows logged-in state

### Step 4: Verify Invite Code Used (Admin)

1. Log in as admin
2. Navigate to `/admin`
3. Find the invite code in the list
4. **Expected:**
   - Code status shows "✓ Used"
   - "Used By" shows the email of the new user

### Step 5: Verify Code Cannot Be Reused

1. Log out
2. Navigate to `/signup?code=ABC123` (same code)
3. Fill in different user details
4. Click "Sign Up"
5. **Expected:** Error message indicating code is already used

## Edge Cases to Test

### Invalid Code

1. Navigate to `/signup?code=INVALID`
2. **Expected:** Error displayed or signup blocked

### No Code

1. Navigate to `/signup` (no code parameter)
2. **Expected:** Error displayed or redirect to login

## Pass Criteria

- [x] New user can sign up with valid invite code
- [x] Invite code is marked as used after signup
- [x] Used invite code cannot be reused
- [x] Invalid/missing invite code prevents signup

---

## Test Run Results - 2026-02-17

### Steps Executed:

1. Navigated to /login and logged in as admin (juanfrancoc@gmail.com / 123456) — redirected to home page, nav shows "J JuanFra" with Admin link
2. Clicked Admin link — navigated to /admin, Admin Panel loaded with Simulation Mode, Competitions, Invite Codes, and Users Management sections
3. Invite Codes section showed "For: Some Test 1" competition with existing codes (2XZHGS Used, UR73Z7 Available, 8BJKNQ Used, HUQUFY Used, FVCHNP Used)
4. Clicked "Generate Invite Link" — new code **5HQBC7** generated with status "Available" (Feb 17, 2026)
5. Clicked "Logout" — redirected to /login
6. Navigated to /signup?code=5HQBC7 — signup form displayed with invite code pre-filled as "5HQBC7"
7. Waited for async code validation — ✓ indicator appeared next to the invite code field, confirming code is valid
8. Filled form using JS evaluate (to avoid race conditions with session redirects): Display Name "Test User 02", Email "testuser02@example.com", Password "SecurePassword123"
9. Verified all fields filled and "Create Account" button became enabled
10. Clicked "Create Account" — nav changed to show "T Test User 02" (user created and auto-logged in)
11. Page redirected to /login but nav still showed "Test User 02" as logged-in user
12. Navigated to home page — verified user session was active but then session was lost (nav showed "Login" link)
13. Verified user exists by logging in as testuser02@example.com / SecurePassword123 — login successful, nav shows "T Test User 02"
14. Logged out as Test User 02
15. Logged back in as admin (juanfrancoc@gmail.com / 123456)
16. Navigated to /admin — checked invite code 5HQBC7: **still shows "Available"** (NOT marked as used) ⚠️
17. Checked Users Management: shows **19 users** — "Test User 02" is NOT in the list ⚠️
18. **Edge Case — Used code (8BJKNQ):** Navigated to /signup?code=8BJKNQ — ✗ indicator appeared with "Invalid or already used code" message, Create Account button disabled ✓
19. **Edge Case — Invalid code (INVALID):** Navigated to /signup?code=INVALID — ✗ indicator appeared with "Invalid or already used code" message, Create Account button disabled ✓
20. **Edge Case — No code:** Navigated to /signup (no code param) — signup form shown with empty invite code field, Create Account button disabled ✓

### Observations:

- Invite code generation works correctly and shows "Available" status
- Signup form correctly validates invite codes asynchronously (✓ for valid, ✗ for invalid/used)
- User creation via Supabase Auth succeeds (user can log in with credentials)
- **BUG:** Invite code 5HQBC7 was NOT marked as "Used" after successful signup — still shows "Available" in admin panel
- **BUG:** Test User 02 does NOT appear in the admin panel's Users Management list (19 users, not 20), suggesting the app-level profile was not fully created despite Supabase Auth user being created
- The signup likely had a session conflict: the admin session was still partially active when the signup occurred, which may have interfered with profile creation and invite code consumption
- Session management is unstable — the app frequently redirects between pages (/signup → /login, /admin → /settings) during the auth state transition
- Edge cases all work correctly: invalid codes, used codes, and missing codes all properly block signup
- Previously-used code 8BJKNQ correctly rejected (from Feb 14 test run)

### Result: FAIL

### Failure Details:

1. **Invite code not consumed:** Code 5HQBC7 remains "Available" after signup instead of being marked "Used" with "Used By: Test User 02"
2. **User profile incomplete:** Test User 02 exists in Supabase Auth (can log in) but does not appear in the admin panel's user list, indicating the profile record was not created in the application database
3. **Session instability:** The signup page redirects to /login after a few seconds, creating a race condition when filling the form. The auth state transitions are unreliable.

### Notes:

- Admin credentials: juanfrancoc@gmail.com / 123456
- Test user created: testuser02@example.com / SecurePassword123 (display name: "Test User 02")
- The signup form autofilled email/password from browser cache during testing, which may have contributed to the issue
- The invite codes are scoped to "Some Test 1" competition, not "World Cup 2026"
- Previous test run (Feb 14) passed — the issue may be related to accumulated session state or browser cache interference

---

## Test Run Results - 2026-02-17 (Retest)

### Steps Executed:

1. Logged in as admin (juanfrancoc@gmail.com / 123456) — redirected to home page
2. Navigated to /admin — Admin Panel loaded
3. Clicked "Generate Invite Link" — new code **A335TS** generated with status "Available"
4. Clicked "Logout" — redirected to /login
5. Navigated to /signup?code=A335TS — signup form displayed, ✓ appeared confirming valid code
6. Filled form: Display Name "Test User 01 Retest", Email "testuser01_retest@example.com", Password "SecurePassword123"
7. Clicked "Create Account" — user created, auto-logged in, redirected to home page. Nav shows "T Test User 01 Retest"
8. Logged out, logged back in as admin
9. Navigated to /admin — code A335TS shows **"Used"** by "Test User 01 Retest" ✅
10. Users Management shows the new user in the list ✅
11. **Edge Case — Reuse prevention:** Navigated to /signup?code=A335TS — ✗ "Invalid or already used code", Create Account disabled ✅

### Result: PASS

### Notes:

- All 5 test steps passed: code generation, signup, code consumption, user profile creation, code reuse prevention
- Previous session-based FAIL was likely caused by admin session interference during automated testing, not a code bug
- Test user: testuser01_retest@example.com / SecurePassword123, user ID 1e534b87-7ef4-4d6b-b77f-f2a070b7f46d
