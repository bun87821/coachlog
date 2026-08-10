import pg from "pg";
if (!process.env.DATABASE_URL) { console.log("DATABASE_URL not set; skipping migrations"); process.exit(0); }
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined });
const sql = `
CREATE TABLE IF NOT EXISTS coaches (id text PRIMARY KEY, email text UNIQUE NOT NULL, name text, image text, google_access_token text, google_refresh_token text, token_expires_at bigint, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS students (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), coach_id text NOT NULL REFERENCES coaches(id) ON DELETE CASCADE, name text NOT NULL, email text, phone text, notes text, created_at timestamptz DEFAULT now());
CREATE INDEX IF NOT EXISTS students_coach_idx ON students(coach_id);
CREATE TABLE IF NOT EXISTS body_metrics (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE, measured_at date NOT NULL DEFAULT CURRENT_DATE, weight numeric, body_fat numeric, muscle_mass numeric, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS exercises (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), coach_id text NOT NULL REFERENCES coaches(id) ON DELETE CASCADE, name text NOT NULL, UNIQUE(coach_id,name));
CREATE TABLE IF NOT EXISTS sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE, occurred_at timestamptz NOT NULL DEFAULT now(), notes text, calendar_event_id text, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS exercise_sets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, exercise_id uuid NOT NULL REFERENCES exercises(id), set_number integer NOT NULL, reps integer, weight numeric, unit text NOT NULL DEFAULT 'kg' CHECK(unit IN ('kg','lb')));
CREATE INDEX IF NOT EXISTS metrics_student_idx ON body_metrics(student_id, measured_at);
CREATE INDEX IF NOT EXISTS sessions_student_idx ON sessions(student_id, occurred_at);
`;
await db.query(sql); await db.end(); console.log("Database ready");
