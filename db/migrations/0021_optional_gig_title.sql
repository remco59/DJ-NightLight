-- A gig without a title is shown under its venue name.
ALTER TABLE "gigs" ALTER COLUMN "title" DROP NOT NULL;
