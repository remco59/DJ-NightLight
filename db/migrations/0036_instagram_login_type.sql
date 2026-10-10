-- Two ways to connect Instagram: Facebook Login (through a Facebook Page, the default) and
-- Instagram Login (no Page). The login type is chosen in settings and remembered per account,
-- because the API host and token handling differ. Instagram Login has its own app id and secret.
-- NULL on social_settings means "not chosen yet": the environment (INSTAGRAM_LOGIN_TYPE) or Facebook Login applies.
ALTER TABLE "social_settings" ADD COLUMN "login_type" varchar(20);
ALTER TABLE "social_settings" ADD COLUMN "instagram_app_id" varchar(100);
ALTER TABLE "social_settings" ADD COLUMN "instagram_app_secret_encrypted" text;

ALTER TABLE "social_accounts" ADD COLUMN "login_type" varchar(20) DEFAULT 'facebook' NOT NULL;
