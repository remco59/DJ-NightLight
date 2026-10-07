-- The Instagram connection uses Facebook Login: the account is found through a Facebook Page,
-- the stored token is checked daily (not refreshed), and Facebook Login for Business needs a configuration id.
ALTER TABLE "social_settings" ADD COLUMN "login_config_id" varchar(100);

ALTER TABLE "social_accounts" ADD COLUMN "page_id" varchar(100);
ALTER TABLE "social_accounts" ADD COLUMN "page_name" varchar(200);
ALTER TABLE "social_accounts" RENAME COLUMN "last_refresh_attempt_at" TO "last_checked_at";
ALTER TABLE "social_accounts" RENAME COLUMN "last_refresh_error" TO "last_error";
