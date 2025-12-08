# EasyBewerbung - E2E Test Specification

This document describes all pages, components, and user flows that must be tested.
**Every change to the codebase should be verified against these tests.**

---

## 1. Landing Page (`/`)

### Visual Elements
- [ ] Logo and brand name visible
- [ ] Navigation bar with Login/Register buttons
- [ ] Hero section with main headline and CTA
- [ ] Features section with feature cards
- [ ] Footer with links

### Functionality
- [ ] Login button navigates to `/login`
- [ ] Register button navigates to `/register`
- [ ] Language selector works (changes UI language)
- [ ] Theme toggle works (dark/light mode)
- [ ] Responsive: Mobile menu works on small screens
- [ ] All feature cards are visible

### Visual Regression
- [ ] Desktop view matches baseline
- [ ] Mobile view matches baseline
- [ ] Dark mode matches baseline
- [ ] Light mode matches baseline

---

## 2. Registration Page (`/register`)

### Visual Elements
- [ ] Registration form visible
- [ ] Email input field
- [ ] Password input field
- [ ] Full name input field
- [ ] Language selectors (mother tongue, documentation language)
- [ ] Privacy policy checkbox
- [ ] Register button
- [ ] Google Sign-In button
- [ ] Link to login page

### Functionality
- [ ] Form validation: Email format required
- [ ] Form validation: Password minimum 8 characters
- [ ] Form validation: All required fields must be filled
- [ ] Privacy policy must be accepted
- [ ] Error messages display for invalid inputs
- [ ] Successful registration redirects to `/dashboard`
- [ ] Google OAuth button is clickable
- [ ] "Already have an account?" link goes to `/login`

### Visual Regression
- [ ] Form layout matches baseline
- [ ] Error states match baseline
- [ ] Mobile view matches baseline

---

## 3. Login Page (`/login`)

### Visual Elements
- [ ] Login form visible
- [ ] Email input field
- [ ] Password input field
- [ ] Login button
- [ ] Google Sign-In button
- [ ] Link to registration page

### Functionality
- [ ] Form validation: Email required
- [ ] Form validation: Password required
- [ ] Error message on invalid credentials
- [ ] Successful login redirects to `/dashboard`
- [ ] JWT token stored in localStorage
- [ ] Google OAuth button is clickable
- [ ] "Don't have an account?" link goes to `/register`

### Visual Regression
- [ ] Form layout matches baseline
- [ ] Error states match baseline
- [ ] Mobile view matches baseline

---

## 4. Dashboard Page (`/dashboard`)

### Visual Elements
- [ ] Navigation bar with user info
- [ ] Settings button visible
- [ ] Logout button visible
- [ ] "Upload Documents" section
- [ ] "Your Documents" grid
- [ ] "Add Job Offer" section
- [ ] "Spontaneous Outreach" section
- [ ] "Your Applications" list
- [ ] RAV Report download button (when applications exist)

### Upload Documents Section
- [ ] Document type dropdown visible
- [ ] File upload input visible
- [ ] Upload button visible
- [ ] Supported formats listed (PDF, DOC, DOCX, TXT)
- [ ] Max file size displayed (25MB)

### Functionality - Document Upload
- [ ] Can select document type (CV, Reference, Diploma, etc.)
- [ ] Can select file for upload
- [ ] Upload button triggers upload
- [ ] Success message after upload
- [ ] Uploaded document appears in grid
- [ ] Can delete uploaded document
- [ ] Delete confirmation works
- [ ] Error handling for oversized files
- [ ] Error handling for unsupported formats

### Your Documents Grid
- [ ] Shows all uploaded documents
- [ ] Each document shows type and filename
- [ ] Delete button on each document
- [ ] Empty state when no documents

### Add Job Offer Section
- [ ] URL input field visible
- [ ] Application type dropdown (fulltime, internship, apprenticeship)
- [ ] Documentation language selector
- [ ] Company profile language selector
- [ ] Submit button visible

### Functionality - Add Job Offer
- [ ] URL validation (must be valid URL)
- [ ] Can select application type
- [ ] Can select languages
- [ ] Submit creates new application
- [ ] Loading state during job analysis
- [ ] Success message after creation
- [ ] New application appears in list
- [ ] Error handling for invalid URLs
- [ ] Error handling for scraping failures

### Spontaneous Outreach Section
- [ ] Company name input
- [ ] Role/position input
- [ ] Context/value proposition textarea
- [ ] Application type dropdown
- [ ] Language selectors
- [ ] Submit button

### Functionality - Spontaneous Application
- [ ] All fields are fillable
- [ ] Submit creates spontaneous application
- [ ] Application appears in list with "Spontaneous" indicator
- [ ] Validation for required fields

### Your Applications List
- [ ] Shows all applications
- [ ] Each application shows company, title, date
- [ ] Expandable job description
- [ ] "Mark as Applied" button
- [ ] "Update Status" button
- [ ] Status indicator (Applied/Not Applied)
- [ ] Result indicator (if set)
- [ ] Generation progress indicator (if generating)
- [ ] Link to application detail page
- [ ] Filter by status works
- [ ] Filter by month works
- [ ] Sort by date works

### Functionality - Application Actions
- [ ] Click expands/collapses job description
- [ ] "Mark as Applied" updates status
- [ ] "Update Status" opens modal
- [ ] Status modal allows entering result
- [ ] Can navigate to application detail
- [ ] Generation progress shows correctly
- [ ] Delete application works

### RAV Report
- [ ] Button visible when applications exist
- [ ] Button hidden when no applications
- [ ] Click downloads TXT file
- [ ] File contains application data

### Visual Regression
- [ ] Full dashboard layout matches baseline
- [ ] Empty state matches baseline
- [ ] With documents matches baseline
- [ ] With applications matches baseline
- [ ] Mobile view matches baseline

---

## 5. Application Detail Page (`/applications/[id]`)

### Visual Elements
- [ ] Back to dashboard button
- [ ] Application header (company, title)
- [ ] Job description section
- [ ] Applied status indicator
- [ ] Result indicator
- [ ] Document generation section
- [ ] Generated documents list
- [ ] Matching score section

### Document Generation Section
- [ ] Checkboxes for document types (CV, Cover Letter, Company Profile)
- [ ] Generate button
- [ ] Progress indicator during generation
- [ ] Credit cost display

### Functionality
- [ ] Back button navigates to dashboard
- [ ] Can select documents to generate
- [ ] Generate button starts generation
- [ ] Progress updates in real-time
- [ ] Generated documents appear after completion
- [ ] Can download generated documents
- [ ] Can view generated document content
- [ ] Matching score generation works
- [ ] Matching score displays strengths/gaps/recommendations

### Visual Regression
- [ ] Page layout matches baseline
- [ ] Generation in progress matches baseline
- [ ] With generated documents matches baseline
- [ ] Mobile view matches baseline

---

## 6. Settings Page (`/settings`)

### Visual Elements
- [ ] Profile section
- [ ] Full name input
- [ ] Email display (read-only)
- [ ] Preferred language selector
- [ ] Mother tongue selector
- [ ] Documentation language selector
- [ ] Extended profile section
- [ ] Employment status dropdown
- [ ] Education type dropdown
- [ ] Additional context textarea
- [ ] Save button
- [ ] Back button

### Functionality
- [ ] Can update full name
- [ ] Can change language preferences
- [ ] Can update extended profile fields
- [ ] Save button saves changes
- [ ] Success message after save
- [ ] Validation errors display
- [ ] Back button returns to dashboard
- [ ] Changes persist after page reload

### Visual Regression
- [ ] Settings form matches baseline
- [ ] Mobile view matches baseline

---

## 7. Admin Page (`/admin`)

### Access Control
- [ ] Non-admin users redirected to dashboard
- [ ] Admin users can access page

### Visual Elements
- [ ] User search section
- [ ] Search input
- [ ] Search results list
- [ ] User detail panel
- [ ] Credit grant form
- [ ] Language management section
- [ ] Activity log section

### User Search & Management
- [ ] Can search by email
- [ ] Can search by name
- [ ] Search results display correctly
- [ ] Can click user to view details
- [ ] User details show all profile info
- [ ] Activity log shows user actions
- [ ] Can grant credits to user
- [ ] Credit grant requires admin token

### Language Management
- [ ] List of all languages displayed
- [ ] Can toggle language active status
- [ ] Can change sort order
- [ ] Changes save correctly

### Visual Regression
- [ ] Admin layout matches baseline

---

## 8. Admin Documents Page (`/admin/documents`)

### Visual Elements
- [ ] Document templates list
- [ ] Each template shows name, type, provider, model
- [ ] Edit form for each template
- [ ] Provider dropdown (OpenAI, Anthropic, Google)
- [ ] Model input
- [ ] Prompt template textarea
- [ ] Credit cost input
- [ ] Active toggle
- [ ] Save button

### Functionality
- [ ] Can change display name
- [ ] Can change LLM provider
- [ ] Can change model
- [ ] Can edit prompt template
- [ ] Can adjust credit cost
- [ ] Can toggle active status
- [ ] Save persists changes
- [ ] Changes affect new generations

### Visual Regression
- [ ] Templates list matches baseline

---

## 9. Cross-Cutting Concerns

### Authentication
- [ ] Protected routes redirect to login when not authenticated
- [ ] Token expiration handled gracefully
- [ ] Logout clears token and redirects to home

### Navigation
- [ ] All navigation links work correctly
- [ ] Browser back/forward works
- [ ] Deep links work (direct URL access)

### Internationalization
- [ ] Language selector present on all pages
- [ ] UI updates when language changes
- [ ] RTL languages display correctly
- [ ] All text is translated (no hardcoded strings)

### Theme
- [ ] Theme toggle works on all pages
- [ ] Theme preference persists
- [ ] All components respect theme

### Responsive Design
- [ ] All pages work on mobile (320px)
- [ ] All pages work on tablet (768px)
- [ ] All pages work on desktop (1280px)
- [ ] Navigation adapts to screen size
- [ ] Forms are usable on mobile
- [ ] No horizontal overflow

### Error Handling
- [ ] Network errors show user-friendly messages
- [ ] API errors display appropriately
- [ ] Form validation errors are clear
- [ ] 404 page exists and works

### Performance
- [ ] Pages load within 3 seconds
- [ ] No JavaScript errors in console
- [ ] Images are optimized

---

## Test Execution

### Running Tests

```bash
# Install dependencies (first time only)
npm install
npx playwright install

# Run all E2E tests
npm run test:e2e

# Run specific test file
npm run test:e2e -- e2e/pages/landing.spec.ts

# Run visual regression tests
npm run test:visual

# Update visual baselines
npm run test:visual:update

# Run tests with UI
npm run test:e2e:ui
```

### CI/CD Integration

Tests run automatically on:
- Pull request creation
- Push to main branch
- Manual trigger

### Maintenance

When making changes:
1. Run `npm run test:e2e` after every change
2. If visual changes are intentional, update baselines
3. Add new tests for new features
4. Update this specification when adding features

---

## Test File Structure

```
e2e/
├── fixtures/           # Test data and setup
│   └── auth.ts        # Authentication helpers
├── pages/             # Page-specific tests
│   ├── landing.spec.ts
│   ├── login.spec.ts
│   ├── register.spec.ts
│   ├── dashboard.spec.ts
│   ├── application-detail.spec.ts
│   ├── settings.spec.ts
│   └── admin.spec.ts
├── flows/             # User flow tests
│   ├── registration-flow.spec.ts
│   ├── job-application-flow.spec.ts
│   └── document-generation-flow.spec.ts
├── visual/            # Visual regression tests
│   ├── landing.visual.spec.ts
│   ├── auth.visual.spec.ts
│   ├── dashboard.visual.spec.ts
│   └── ...
├── utils/             # Test utilities
│   └── helpers.ts
└── TEST_SPECIFICATION.md
```
