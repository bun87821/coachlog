import { db } from "@/lib/db";
import { requireCoach } from "@/lib/guard";
import { listCalendarEvents } from "@/lib/google-calendar";
import { Header } from "@/components/Header";
import { BookingCalendar } from "@/components/BookingCalendar";
import { addStudent } from "@/app/actions";
import { StudentList } from "@/components/StudentList";

export default async function Dashboard() {
  const user = await requireCoach();
  const [students, events] = await Promise.all([
    db.query(`SELECT s.*, (SELECT weight FROM body_metrics WHERE student_id=s.id ORDER BY measured_at DESC LIMIT 1) weight FROM students s WHERE coach_id=$1 ORDER BY created_at DESC`, [user.id]),
    listCalendarEvents(user.id),
  ]);
  return <main className="shell">
    <Header name={user.name} />
    <div className="section-title" id="calendar"><div><div className="eyebrow">預約管理</div><h1>訓練行事曆</h1></div></div>
    <BookingCalendar students={students.rows.map(student => ({ id: student.id, name: student.name }))} events={events} />
    <div className="dashboard student-section">
      <section>
        <div className="section-title"><div><div className="eyebrow">學生管理</div><h1>你的學生</h1></div></div>
        {students.rows.length ? <StudentList students={students.rows.map(student => ({ id: student.id, name: student.name, email: student.email, weight: student.weight ? Number(student.weight) : null }))} /> : <div className="card empty">還沒有學生，從右側新增第一位。</div>}
      </section>
      <aside><div className="card"><h2>新增學生</h2><form className="stack" action={addStudent}><input name="name" placeholder="學生姓名" required /><input name="email" type="email" placeholder="Email（選填）" /><input name="phone" placeholder="電話（選填）" /><textarea name="notes" placeholder="備註" /><button>建立學生</button></form></div></aside>
    </div>
  </main>;
}
