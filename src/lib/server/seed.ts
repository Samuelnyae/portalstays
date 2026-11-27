/**
 * HR account provisioning. Sign-up is for employees only; the single HR
 * account is provisioned here at startup, together with its organization and
 * the teams employees can join. Idempotent: once the HR account exists, this
 * changes nothing.
 */
import { Repository } from "./repository";
import type { DbPool } from "./pool";
import { hashPassword } from "./passwords";

export const HR_EMAIL = "samuelnyae18@gmail.com";
export const HR_PASSWORD = "demo@001";
export const HR_ORGANIZATION_NAME = "Entrelacs";
export const HR_TEAM_NAMES = ["Engineering", "Operations", "Support"] as const;

export async function ensureHrWorkspace(pool: DbPool): Promise<void> {
  const repo = new Repository(pool);
  const existing = await repo.getUserByEmail(HR_EMAIL);
  if (existing !== null) {
    return;
  }
  const passwordHash = await hashPassword(HR_PASSWORD);
  const organization = await repo.findOrganizationByName(HR_ORGANIZATION_NAME);
  if (organization === null) {
    await repo.createHrWorkspace({
      email: HR_EMAIL,
      passwordHash,
      organizationName: HR_ORGANIZATION_NAME,
      teamNames: [...HR_TEAM_NAMES],
    });
    return;
  }
  // The organization already exists: make sure its teams are present, then
  // attach the HR account to it.
  for (const teamName of HR_TEAM_NAMES) {
    await repo.ensureTeam(organization.id, teamName);
  }
  await repo.createHrUser({ organizationId: organization.id, email: HR_EMAIL, passwordHash });
}
