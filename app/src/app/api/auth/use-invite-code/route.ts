import { NextRequest, NextResponse } from "next/server";
import { createServiceDatabaseService } from "@/lib/services/database-service";

export async function POST(request: NextRequest) {
  try {
    const { code, userId } = await request.json();

    if (!code || !userId) {
      return NextResponse.json(
        { error: "Missing code or userId" },
        { status: 400 },
      );
    }

    const db = await createServiceDatabaseService();

    // Mark invite code as used using database service
    const result = await db.inviteCodes.useInviteCode(code, userId);

    if (!result.success) {
      console.error("Failed to mark invite code as used:", result.error);
      return NextResponse.json(
        { error: result.error || "Failed to use invite code" },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in use-invite-code:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
