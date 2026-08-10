import { auth } from "@/auth";
import { stringifyCsv, workoutCsvHeaders } from "@/lib/csv";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const rows = [
    [...workoutCsvHeaders],
    ["workout-001", "2026-08-10 10:00", "下肢訓練", "槓鈴深蹲", 1, 10, 60, "kg"],
    ["workout-001", "2026-08-10 10:00", "下肢訓練", "槓鈴深蹲", 2, 10, 60, "kg"],
    ["workout-001", "2026-08-10 10:00", "下肢訓練", "槓鈴深蹲", 3, 8, 65, "kg"],
    ["workout-001", "2026-08-10 10:00", "下肢訓練", "槓鈴深蹲", 4, 8, 65, "kg"],
  ];
  return new Response(stringifyCsv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=coachlog-workout-template.csv" } });
}
