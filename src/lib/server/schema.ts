/** PostgreSQL schema. Idempotent: safe to run on every boot. */
import type { DbPool } from "./pool";

const SCHEMA = `
create table if not exists organizations (
  id text primary key,
  name text not null unique
);

create table if not exists teams (
  id text primary key,
  organization_id text not null references organizations (id),
  name text not null,
  unique (organization_id, name),
  unique (id, organization_id)
);

create table if not exists users (
  id text primary key,
  organization_id text not null references organizations (id),
  team_id text,
  email text not null,
  password_hash text not null,
  role text not null check (role in ('EMPLOYEE', 'HR')),
  unique (id, organization_id),
  foreign key (team_id, organization_id) references teams (id, organization_id),
  check ((role = 'EMPLOYEE' and team_id is not null) or (role = 'HR' and team_id is null))
);
create unique index if not exists users_email_lower_key on users (lower(email));

create table if not exists check_ins (
  id text primary key,
  employee_id text not null,
  organization_id text not null,
  team_id text not null,
  connectedness integer check (connectedness between 0 and 10),
  support integer check (support between 0 and 10),
  workload integer check (workload between 0 and 10),
  score double precision check (score between 0 and 100),
  status text not null check (status in ('DRAFT', 'SUBMITTED')),
  created_at text not null,
  updated_at text not null,
  submitted_at text,
  foreign key (employee_id, organization_id) references users (id, organization_id),
  foreign key (team_id, organization_id) references teams (id, organization_id),
  check (
    (status = 'DRAFT' and submitted_at is null and score is null)
    or (
      status = 'SUBMITTED' and submitted_at is not null and score is not null
      and connectedness is not null and support is not null and workload is not null
    )
  )
);
create unique index if not exists check_ins_one_draft_per_employee
  on check_ins (employee_id) where status = 'DRAFT';
create index if not exists check_ins_org_submitted_idx
  on check_ins (organization_id, submitted_at) where status = 'SUBMITTED';
`;

export async function ensureSchema(pool: DbPool): Promise<void> {
  await pool.query(SCHEMA);
}
