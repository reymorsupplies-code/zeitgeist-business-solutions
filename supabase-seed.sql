-- ============================================
-- ZEITGEIST BUSINESS SOLUTIONS - SEED DATA
-- Run this in Supabase SQL Editor AFTER supabase-init.sql
-- ============================================

-- 1. SUPER ADMIN USER (password: zeitgeist2026)
-- In production, passwords should be hashed with bcrypt
INSERT INTO "PlatformUser" ("id", "email", "password", "fullName", "role", "isActive", "hasUsedTrial", "createdAt", "updatedAt")
VALUES (
  'clsuperadmin00000001',
  'admin@zeitgeist.business',
  'zeitgeist2026',
  'Zeitgeist Super Admin',
  'super_admin',
  true,
  false,
  NOW(),
  NOW()
) ON CONFLICT ("email") DO NOTHING;

-- 2. INDUSTRIES
INSERT INTO "Industry" ("id", "name", "slug", "description", "icon", "color", "status", "sortOrder", "createdAt", "updatedAt") VALUES
('ind_bakery', 'Bakery & Pastry', 'bakery', 'Artisan bakeries, pastry shops, and cake decorators — manage recipes, orders, and design galleries', 'Cake', '#F59E0B', 'active', 1, NOW(), NOW()),
('ind_salon', 'Salon & Beauty', 'salon', 'Hair salons, beauty parlors, and spas — appointments, stylists, and service management', 'Scissors', '#EC4899', 'active', 2, NOW(), NOW()),
('ind_legal', 'Legal Services', 'legal', 'Law firms and solo practitioners — case management, time tracking, and billing', 'Scale', '#6366F1', 'active', 3, NOW(), NOW()),
('ind_clinic', 'Medical Clinic', 'clinic', 'Medical clinics and healthcare providers — patient records, appointments, and prescriptions', 'Stethoscope', '#10B981', 'active', 4, NOW(), NOW()),
('ind_insurance', 'Insurance Agency', 'insurance', 'Insurance agencies and brokers — policy management, claims, and client tracking', 'Shield', '#8B5CF6', 'active', 5, NOW(), NOW()),
('ind_retail', 'Retail & Commerce', 'retail', 'Retail stores and shops — inventory, POS, and supplier management', 'ShoppingBag', '#F97316', 'active', 6, NOW(), NOW()),
('ind_events', 'Events & Catering', 'events', 'Event planners and catering services — event coordination, guest management, and logistics', 'PartyPopper', '#E11D48', 'active', 7, NOW(), NOW()),
('ind_professional', 'Professional Services', 'professional', 'Consultants, freelancers, and agencies — project management, time tracking, and invoicing', 'Briefcase', '#0891B2', 'active', 8, NOW(), NOW())
ON CONFLICT ("slug") DO NOTHING;

-- 3. PLANS
INSERT INTO "Plan" ("id", "name", "slug", "tier", "priceUSD", "priceTTD", "currency", "billingCycle", "tagline", "description", "idealFor", "maxUsers", "maxBranches", "features", "excludedFeatures", "isPopular", "status", "sortOrder", "createdAt", "updatedAt") VALUES
('plan_starter', 'Starter', 'starter', 'starter', 9.99, 68.00, 'TTD', 'monthly',
 'Get started with the essentials',
 'Perfect for solo entrepreneurs and small businesses just getting started with digital management. Includes core features needed to run your business day-to-day.',
 'Solo entrepreneurs and micro-businesses',
 2, 1,
 '["Dashboard","Orders/Bookings","Client Management","Basic Invoicing","Expense Tracking","1GB Storage"]',
 '["Advanced Reports","API Access","Custom Branding","Priority Support"]',
 false, 'active', 1, NOW(), NOW()),

('plan_professional', 'Professional', 'professional', 'professional', 24.99, 170.00, 'TTD', 'monthly',
 'The most popular choice for growing businesses',
 'Everything in Starter plus advanced analytics, team collaboration, and industry-specific tools. Designed for businesses that are scaling and need more power.',
 'Growing businesses with small teams',
 10, 3,
 '["Everything in Starter","Advanced Reports & Analytics","Team Collaboration","Industry-Specific Tools","Recipe/Case/Policy Management","Email Notifications","5GB Storage","Priority Support"]',
 '["API Access","Custom Branding","White Label"]',
 true, 'active', 2, NOW(), NOW()),

('plan_enterprise', 'Enterprise', 'enterprise', 'enterprise', 49.99, 340.00, 'TTD', 'monthly',
 'Full power for established operations',
 'Complete access to all features, unlimited users, API integrations, custom branding, and dedicated support. Built for businesses that demand the best.',
 'Established businesses with multiple locations',
 999, 999,
 '["Everything in Professional","Unlimited Users & Branches","API Access","Custom Branding & White Label","Advanced Automation","Dedicated Account Manager","20GB Storage","SLA Guarantee"]',
 '[]',
 false, 'active', 3, NOW(), NOW())
ON CONFLICT ("slug") DO NOTHING;

-- 4. PRICE SETTINGS
INSERT INTO "PriceSetting" ("id", "planId", "key", "valueUSD", "valueTTD", "updatedAt") VALUES
('ps_1', 'plan_starter', 'monthly_starter', 9.99, 68.00, NOW()),
('ps_2', 'plan_starter', 'annual_starter', 99.99, 680.00, NOW()),
('ps_3', 'plan_professional', 'monthly_professional', 24.99, 170.00, NOW()),
('ps_4', 'plan_professional', 'annual_professional', 249.99, 1700.00, NOW()),
('ps_5', 'plan_enterprise', 'monthly_enterprise', 49.99, 340.00, NOW()),
('ps_6', 'plan_enterprise', 'annual_enterprise', 499.99, 3400.00, NOW())
ON CONFLICT ("key") DO NOTHING;

-- 5. DEMO TENANT (Bakery)
INSERT INTO "Tenant" ("id", "name", "slug", "industryId", "planId", "planName", "status", "trialStartsAt", "trialEndsAt", "paymentVerified", "primaryColor", "accentColor", "currency", "timezone", "locale", "taxRate", "country", "address", "phone", "email", "website", "createdAt", "updatedAt")
VALUES (
  'ten_demo_bakery',
  'Sweet Caribbean Bakery',
  'sweet-caribbean-bakery',
  'ind_bakery',
  'plan_professional',
  'Professional',
  'active',
  NOW(),
  NOW() + INTERVAL '7 days',
  true,
  '#1D4ED8',
  '#2563EB',
  'TTD',
  'America/Port_of_Spain',
  'en',
  0.125,
  'TT',
  '123 Frederick Street, Port of Spain, Trinidad',
  '+1-868-555-0123',
  'info@sweetcaribbean.demo',
  'https://sweetcaribbean.demo',
  NOW(),
  NOW()
) ON CONFLICT ("slug") DO NOTHING;

-- 6. DEMO TENANT MEMBERSHIP
INSERT INTO "TenantMembership" ("id", "userId", "tenantId", "role", "status", "createdAt", "updatedAt")
VALUES (
  'mem_demo_bakery_admin',
  'clsuperadmin00000001',
  'ten_demo_bakery',
  'admin',
  'active',
  NOW(),
  NOW()
) ON CONFLICT ("userId", "tenantId") DO NOTHING;

-- 7. SAMPLE CATALOG ITEMS FOR DEMO BAKERY
INSERT INTO "CatalogItem" ("id", "tenantId", "name", "description", "category", "price", "cost", "unit", "isAvailable", "isDeleted", "createdAt", "updatedAt") VALUES
('cat_1', 'ten_demo_bakery', 'Coconut Bake', 'Traditional Trinidadian coconut bake, freshly made daily', 'Bread', 15.00, 6.50, 'loaf', true, false, NOW(), NOW()),
('cat_2', 'ten_demo_bakery', 'Currants Roll', 'Flaky pastry filled with sweet currants', 'Pastry', 8.00, 3.20, 'piece', true, false, NOW(), NOW()),
('cat_3', 'ten_demo_bakery', 'Black Cake', 'Rich Caribbean fruit cake soaked in rum', 'Cake', 250.00, 95.00, 'whole', true, false, NOW(), NOW()),
('cat_4', 'ten_demo_bakery', 'Doubles', 'Trinidad doubles with barra and channa', 'Savory', 12.00, 4.80, 'serving', true, false, NOW(), NOW()),
('cat_5', 'ten_demo_bakery', 'Sponge Cake', 'Light vanilla sponge cake, perfect for decorating', 'Cake', 120.00, 42.00, 'whole', true, false, NOW(), NOW()),
('cat_6', 'ten_demo_bakery', 'Pineapple Tart', 'Sweet pineapple-filled tart', 'Pastry', 6.00, 2.10, 'piece', true, false, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 8. SAMPLE RECIPES FOR DEMO BAKERY
INSERT INTO "Recipe" ("id", "tenantId", "name", "description", "category", "servings", "prepTime", "cookTime", "ingredients", "instructions", "costPerServing", "sellingPrice", "isPublic", "isDeleted", "createdAt", "updatedAt") VALUES
('rec_1', 'ten_demo_bakery', 'Coconut Bake', 'Traditional Trinidadian coconut bake recipe', 'Bread', 8, 30, 45,
 '[{"name":"Flour","qty":"4 cups"},{"name":"Coconut","qty":"2 cups grated"},{"name":"Sugar","qty":"1/2 cup"},{"name":"Butter","qty":"1/4 cup"},{"name":"Baking Powder","qty":"2 tsp"},{"name":"Salt","qty":"1 tsp"},{"name":"Milk","qty":"1/2 cup"}]',
 '[{"step":"Mix dry ingredients together"},{"step":"Cut in butter until crumbly"},{"step":"Add grated coconut and mix"},{"step":"Add milk gradually to form dough"},{"step":"Knead on floured surface for 5 minutes"},{"step":"Shape into round and place on greased baking sheet"},{"step":"Bake at 350F for 40-45 minutes"}]',
 2.40, 8.00, true, false, NOW(), NOW()),
('rec_2', 'ten_demo_bakery', 'Black Cake', 'Caribbean black cake - the ultimate celebration cake', 'Cake', 20, 120, 180,
 '[{"name":"Prunes","qty":"1 lb"},{"name":"Raisins","qty":"1 lb"},{"name":"Currants","qty":"1 lb"},{"name":"Cherries","qty":"1/2 lb"},{"name":"Rum","qty":"2 cups"},{"name":"Cherry Brandy","qty":"1 cup"},{"name":"Butter","qty":"1 lb"},{"name":"Sugar","qty":"1 lb"},{"name":"Eggs","qty":"10"},{"name":"Flour","qty":"2 cups"},{"name":"Baking Powder","qty":"2 tsp"},{"name":"Browning","qty":"2 tbsp"},{"name":"Vanilla","qty":"2 tsp"},{"name":"Mixed Spice","qty":"1 tsp"}]',
 '[{"step":"Soak fruits in rum and cherry brandy for at least 2 weeks (longer is better)"},{"step":"Blend soaked fruits to desired consistency"},{"step":"Cream butter and sugar until light and fluffy"},{"step":"Add eggs one at a time, beating well"},{"step":"Fold in flour, baking powder, browning, vanilla, and spice"},{"step":"Add blended fruits and mix thoroughly"},{"step":"Pour into greased and lined pans"},{"step":"Bake at 300F for 2-3 hours until tester comes out clean"},{"step":"Pour additional rum over hot cake"},{"step":"Let cool completely before serving"}]',
 14.00, 35.00, true, false, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 9. SAMPLE CLIENTS FOR DEMO BAKERY
INSERT INTO "Client" ("id", "tenantId", "name", "email", "phone", "address", "notes", "tags", "isDeleted", "createdAt", "updatedAt") VALUES
('cli_1', 'ten_demo_bakery', 'Maria Santos', 'maria@email.com', '+1-868-555-0101', '45 Ariapita Ave, Woodbrook', 'Regular customer, loves black cake', '["VIP","Corporate"]', false, NOW(), NOW()),
('cli_2', 'ten_demo_bakery', 'James Williams', 'james@email.com', '+1-868-555-0102', '78 Duke Street, Port of Spain', 'Orders for office events', '["Corporate"]', false, NOW(), NOW()),
('cli_3', 'ten_demo_bakery', 'Anita Persad', 'anita@email.com', '+1-868-555-0103', '12 Chaguanas Main Road', 'Wedding cake specialist client', '["Wedding","VIP"]', false, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Done! Your Zeitgeist platform is ready.
