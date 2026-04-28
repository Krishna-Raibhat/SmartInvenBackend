-- CreateTable
CREATE TABLE "payment_qr_store" (
    "id" TEXT NOT NULL,
    "qr_image_path" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_qr_store_pkey" PRIMARY KEY ("id")
);
