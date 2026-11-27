CREATE TABLE `price_history` (
	`id` text PRIMARY KEY NOT NULL,
	`offer_key` text NOT NULL,
	`price_cents` integer NOT NULL,
	`observed_at` integer NOT NULL,
	`source` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `prices_offer_time` ON `price_history` (`offer_key`,`observed_at`);