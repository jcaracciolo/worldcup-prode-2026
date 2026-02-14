import { NextRequest, NextResponse } from "next/server";
import { createServiceDatabaseService } from "@/lib/services/database-service";

export async function POST(request: NextRequest) {
  try {
    const { code, userId, competitionId } = await request.json();

    if (!code || !userId) {
      return NextResponse.json(
        { error: "Missing code or userId" },
        { status: 400 },
      );
    }

    const db = await createServiceDatabaseService();

    // Verify the invite code and get its competition
    const { data: codeData } = await db.inviteCodes.checkInviteCode(code);
    
    if (!codeData) {
      return NextResponse.json(
        { error: "Invalid or already used invite code" },
        { status: 400 },
      );
    }

    // Verify competition matches if provided
    const targetCompetitionId = competitionId || codeData.competition_id;
    if (competitionId && codeData.competition_id !== competitionId) {
      return NextResponse.json(
        { error: "Invite code does not match competition" },
        { status: 400 },
      );
    }

    // Mark invite code as used using database service
    const result = await db.inviteCodes.useInviteCode(code, userId);

    if (!result.success) {
      console.error("Failed to mark invite code as used:", result.error);
      return NextResponse.json(
        { error: result.error || "Failed to use invite code" },
        { status: 400 },
      );
    }

    // Add user to the competition
    const memberResult = await db.competitionMembers.addMember(
      userId,
      targetCompetitionId,
      undefined, // invitedBy - could be looked up from invite code creator
    );

    if (!memberResult.success) {
      console.error("Failed to add user to competition:", memberResult.error);
      // Don't fail the whole request, just log the error
      // User can still join via settings
    }

    return NextResponse.json({ success: true, competitionId: targetCompetitionId });
  } catch (error) {
    console.error("Error in use-invite-code:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
