CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RefreshToken_token_key"
ON "RefreshToken"("token");

CREATE INDEX "RefreshToken_session_id_idx"
ON "RefreshToken"("session_id");

CREATE INDEX "RefreshToken_expires_at_idx"
ON "RefreshToken"("expires_at");

ALTER TABLE "RefreshToken"
ADD CONSTRAINT "RefreshToken_user_id_fkey"
FOREIGN KEY ("user_id")
REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;