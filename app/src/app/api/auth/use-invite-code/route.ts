import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { code, userId } = await request.json();

    if (!code || !userId) {
      return NextResponse.json(
        { error: "Missing code or userId" },
        { status: 400 },
      );
    }

    const supabase = await createServiceClient();

    // Mark invite code as used and return the updated row
    const { data, error } = await supabase
      .from("invite_codes")
      .update({
        used_by: userId,
        used_at: new Date().toISOString(),
      })
      .eq("code", code)
      .is("used_by", null)
      .select();

    if (error) {
      console.error("Failed to mark invite code as used:", error);
      return NextResponse.json(
        { error: "Failed to use invite code" },
        { status: 500 },
      );
    }

    // Check if any row was actually updated
    if (!data || data.length === 0) {
      console.error("No invite code was updated - code may not exist or already used:", code);
      return NextResponse.json(
        { error: "Invite code not found or already used" },
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
