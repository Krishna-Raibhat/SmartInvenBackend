-- CreateTable
CREATE TABLE "registration_otps" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "otp_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "wrong_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_sent_at" TIMESTAMP(3),
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "full_name" TEXT,
    "phone" TEXT,
    "password_hash" TEXT,
    "package_key" TEXT,

    CONSTRAINT "registration_otps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "registration_otps_email_idx" ON "registration_otps"("email");

-- CreateIndex
CREATE INDEX "registration_otps_expires_at_idx" ON "registration_otps"("expires_at");
